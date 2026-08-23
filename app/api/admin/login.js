const { setSessionCookie, timingSafeStrEqual } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !process.env.ADMIN_SESSION_SECRET) {
    res.status(500).json({ ok: false, error: 'Server is not configured yet' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const given = body && typeof body.password === 'string' ? body.password : '';

  if (!given || !timingSafeStrEqual(given, expected)) {
    res.status(401).json({ ok: false, error: 'Wrong password' });
    return;
  }

  setSessionCookie(res);
  res.status(200).json({ ok: true });
};
