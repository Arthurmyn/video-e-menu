// GET  /api/admin/auth — is the current session authenticated?
// POST /api/admin/auth { action: 'login', password } — start a session
// POST /api/admin/auth { action: 'logout' }          — end a session
// Merged from what used to be three separate files (me/login/logout) —
// Vercel's Hobby plan caps a deployment at 12 serverless functions, and
// these three tiny auth endpoints were cheap to fold into one.

const { isAuthed, setSessionCookie, clearSessionCookie, timingSafeStrEqual } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, authed: isAuthed(req) });
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    const action = body && body.action;

    if (action === 'login') {
      const expected = process.env.ADMIN_PASSWORD;
      if (!expected || !process.env.ADMIN_SESSION_SECRET) {
        res.status(500).json({ ok: false, error: 'Server is not configured yet' });
        return;
      }
      const given = body && typeof body.password === 'string' ? body.password : '';
      if (!given || !timingSafeStrEqual(given, expected)) {
        res.status(401).json({ ok: false, error: 'Wrong password' });
        return;
      }
      setSessionCookie(res);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'logout') {
      clearSessionCookie(res);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ ok: false, error: 'Unknown action' });
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
