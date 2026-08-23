const { isAuthed } = require('../_auth');

module.exports = async (req, res) => {
  res.status(200).json({ ok: true, authed: isAuthed(req) });
};
