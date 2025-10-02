import { any, one, oneOrNone } from '../db.js';
import { nano } from '../utils/nanoid.js';
import { hashPin } from '../security/pin.js';

export async function createShareLink({
  galleryId, albumId, slug, pin, expiresAt, allowDownload, showWatermark, oneTime, maxUses, createdBy
}: any) {
  const token = nano();
  const pinHash = pin ? await hashPin(pin) : null;

  const row = await one(`
    insert into share_links (
      gallery_id, album_id, slug, token, pin_hash, expires_at,
      allow_download, show_watermark, one_time, max_uses, created_by
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    returning id, gallery_id, album_id, slug, token, expires_at, allow_download, show_watermark
  `,[galleryId, albumId || null, slug, token, pinHash, expiresAt || null, !!allowDownload, showWatermark ?? true, !!oneTime, maxUses || null, createdBy || null]);

  return row;
}

export async function getLinksForGallery(galleryId: string) {
  return any(`select * from share_links where gallery_id=$1 order by created_at desc`, [galleryId]);
}

export async function updateShareLink(id: string, patch: any) {
  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k}=$${i++}`);
    values.push(v);
  }
  values.push(id);
  const row = await one(`update share_links set ${fields.join(', ')}, updated_at=now() where id=$${i} returning *`, values);
  return row;
}

export async function findShareLinkBySlugToken(slug: string, token: string) {
  return oneOrNone(`select * from share_links where slug=$1 and token=$2`, [slug, token]);
}

export async function incrementUse(id: string) {
  await any(`update share_links set use_count = use_count + 1 where id=$1`, [id]);
}

export async function logAccess(shareLinkId: string, ip: string, userAgent: string) {
  await any(`insert into share_link_access (share_link_id, ip, user_agent) values ($1, $2::inet, $3)`, [shareLinkId, ip, userAgent]);
}
