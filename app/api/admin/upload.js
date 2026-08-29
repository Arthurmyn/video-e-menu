// POST /api/admin/upload — uploads a video or image file to Vercel Blob and
// returns its public URL. Body is JSON { filename, contentType, dataBase64 }
// rather than a raw binary body — Vercel's Node runtime (notably `vercel dev`
// locally) doesn't reliably expose the raw request stream, but JSON bodies
// parse consistently everywhere, so the client base64-encodes the file instead.
// Requires the admin session cookie. Meant for dish cinemagraphs and the
// Kaspi payment QR code, not general file storage.

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
  const isVideo = typeof contentType === 'string' && contentType.startsWith('video/');
  const isImage = typeof contentType === 'string' && contentType.startsWith('image/');
  if (!isVideo && !isImage) {
    res.status(400).json({ ok: false, error: 'Only image or video files are accepted' });
    return;
  }
  if (typeof dataBase64 !== 'string' || !dataBase64) {
    res.status(400).json({ ok: false, error: 'Empty file' });
    return;
  }

  const rawName = typeof filename === 'string' ? filename : (isVideo ? 'clip.mp4' : 'image.jpg');
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || (isVideo ? 'clip.mp4' : 'image.jpg');
  const prefix = isVideo ? 'dish-videos' : 'payment-qr';

  try {
    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length === 0) { res.status(400).json({ ok: false, error: 'Empty file' }); return; }
    if (buffer.length > MAX_BYTES) { res.status(413).json({ ok: false, error: 'File too large (max 4MB)' }); return; }

    const blob = await put(`${prefix}/${Date.now()}-${safeName}`, buffer, {
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
