// Shared session helpers for /api/admin/* — not a route itself (Vercel skips
// files/folders starting with "_"). Single shared password, stateless session:
// the cookie holds an HMAC of a fixed string keyed by ADMIN_SESSION_SECRET, so
// there's no session table to manage and rotating the secret instantly logs
// everyone out.

const crypto = require('crypto');

const COOKIE_NAME = 'nauryz_admin';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function sessionToken() {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  return crypto.createHmac('sha256', secret).update('admin-session').digest('hex');
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function timingSafeStrEqual(a, b) {
  const bufA = Buffer.from(String(a)), bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isAuthed(req) {
  if (!process.env.ADMIN_SESSION_SECRET) return false;
  const given = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!given) return false;
  return timingSafeStrEqual(given, sessionToken());
}

function setSessionCookie(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${sessionToken()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SEC}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

function requireAuth(req, res) {
  if (isAuthed(req)) return true;
  res.status(401).json({ ok: false, error: 'Not authenticated' });
  return false;
}

module.exports = { isAuthed, setSessionCookie, clearSessionCookie, requireAuth, timingSafeStrEqual };
