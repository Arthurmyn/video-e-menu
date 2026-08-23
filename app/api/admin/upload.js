// POST /api/admin/upload — uploads a video file to Vercel Blob and returns its
// public URL. Body is JSON { filename, contentType, dataBase64 } rather than
// a raw binary body — Vercel's Node runtime (notably `vercel dev` locally)
// doesn't reliably expose the raw request stream, but JSON bodies parse
// consistently everywhere, so the client base64-encodes the file instead.
// Requires the admin session cookie. Meant for short dish cinemagraphs, not
// general file storage.

const { put } = require('@vercel/blob');
const { requireAuth } = require('../_auth');

const MAX_BYTES = 4 * 1024 * 1024; // stay under Vercel's ~4.5MB request body limit

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') { res.status(400).json({ ok: false, error: 'Empty request body' }); return; }

  const { filename, contentType, dataBase64 } = body;
  if (typeof contentType !== 'string' || !contentType.startsWith('video/')) {
    res.status(400).json({ ok: false, error: 'Only video files are accepted' });
    return;
  }
  if (typeof dataBase64 !== 'string' || !dataBase64) {
    res.status(400).json({ ok: false, error: 'Empty file' });
    return;
  }

  const rawName = typeof filename === 'string' ? filename : 'clip.mp4';
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'clip.mp4';

  try {
    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length === 0) { res.status(400).json({ ok: false, error: 'Empty file' }); return; }
    if (buffer.length > MAX_BYTES) { res.status(413).json({ ok: false, error: 'File too large (max 4MB)' }); return; }

    const blob = await put(`dish-videos/${Date.now()}-${safeName}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false
    });

    res.status(200).json({ ok: true, url: blob.url });
  } catch (e) {
    console.error('[admin/upload]', e);
    res.status(500).json({ ok: false, error: e.message || 'Upload failed' });
  }
};
