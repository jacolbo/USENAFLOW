import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { findShareLinkBySlugToken, incrementUse, logAccess } from '../services/shareLinks.js';
import { verifyPin } from '../security/pin.js';
import { signGrant, verifyGrant } from '../security/jwt.js';

function signUrlStub(key: string, ttlSeconds = 900) {
  // Just a deterministic stub
  return `https://storage.googleapis.com/bucket/${encodeURIComponent(key)}?ttl=${ttlSeconds}`;
}

export default async function routes(f: FastifyInstance) {
  const ResolveBody = z.object({
    slug: z.string().min(3),
    token: z.string().min(6),
    pin: z.string().optional()
  });

  // Rate limit primitive
  const attempts = new Map<string, { c: number; t: number }>();
  const allow = (ip: string, max=5, windowMs=5*60*1000) => {
    const now = Date.now();
    const e = attempts.get(ip);
    if (!e || e.t < now) { attempts.set(ip, { c:1, t: now+windowMs }); return true; }
    if (e.c < max) { e.c++; return true; }
    return false;
  };

  f.post('/public/resolve', async (req, reply) => {
    const ip = (req.ip || '0.0.0.0');
    if (!allow(ip)) return reply.code(429).send({ error: { code:'rate_limited', message:'Too many attempts' }});

    const body = ResolveBody.parse(req.body);
    const link = await findShareLinkBySlugToken(body.slug, body.token);
    if (!link || link.is_revoked) return reply.code(403).send({ error: { code:'revoked', message:'Link revoked or invalid' }});
    if (link.expires_at && new Date(link.expires_at) < new Date()) return reply.code(403).send({ error:{ code:'expired', message:'Link expired' }});
    if (link.pin_hash) {
      const ok = await verifyPin(body.pin || '', link.pin_hash);
      if (!ok) return reply.code(401).send({ error:{ code:'bad_pin', message:'Incorrect PIN' }});
    }
    if (link.max_uses && link.use_count >= link.max_uses) return reply.code(403).send({ error:{ code:'exhausted', message:'Max uses reached' }});

    await incrementUse(link.id);
    await logAccess(link.id, ip, req.headers['user-agent'] || '');

    const grant = signGrant({
      sub: `share:${link.id}`,
      galleryId: link.gallery_id,
      albumId: link.album_id,
      dl: link.allow_download,
      wm: link.show_watermark
    }, 900);

    return reply.send({ grant, scope: { galleryId: link.gallery_id, albumId: link.album_id, allowDownload: link.allow_download, showWatermark: link.show_watermark }, expiresAt: link.expires_at });
  });

  // Minimal public fetch using Bearer
  f.get('/public/galleries/:slug', async (req, reply) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return reply.code(401).send({ error:{ code:'no_auth', message:'Missing token' }});
    let claims: any;
    try {
      claims = verifyGrant(token);
    } catch {
      return reply.code(401).send({ error:{ code:'bad_token', message:'Invalid token' }});
    }
    // Normally we’d check slug→id mapping; for stub we return a predictable payload.
    const assets = Array.from({ length: 6 }).map((_, i) => ({
      id: `asset-${i+1}`,
      previewUrl: claims.wm ? signUrlStub(`preview/${i+1}.jpg`) : signUrlStub(`clean/${i+1}.jpg`)
    }));
    return { title: `Gallery ${req.params['slug']}`, albumId: claims.albumId, allowDownload: claims.dl, watermarked: claims.wm, assets };
  });
}
