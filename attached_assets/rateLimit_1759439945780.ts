const buckets = new Map<string, { count: number; reset: number }>();
export function allow(ip: string, max = 5, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.reset < now) {
    buckets.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count < max) {
    b.count++;
    return true;
  }
  return false;
}
