/** Shared authorization for cron endpoints (Vercel Cron sends `Authorization: Bearer …`). */
export function isCronAuthorized(request) {
  if (process.env.NODE_ENV === 'development' && !process.env.CRON_SECRET) {
    return true;
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}
