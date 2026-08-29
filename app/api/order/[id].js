// GET /api/order/:id — public status poll for the payment-auto-confirm flow.
// No admin auth: this is called by the guest's own browser while it waits
// for /api/kaspi-notify to flip the order. Deliberately returns nothing but
// the status — never the order contents — since it's unauthenticated.

const { getPool } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const orderId = Number(req.query.id);
  if (!Number.isInteger(orderId)) {
    res.status(400).json({ ok: false, error: 'Invalid order id' });
    return;
  }

  try {
    const client = getPool();
    const result = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Order not found' });
      return;
    }
    res.status(200).json({ ok: true, status: result.rows[0].status });
  } catch (e) {
    console.error('[order/:id] DB error:', e);
    res.status(500).json({ ok: false, error: 'Failed to load order status' });
  }
};
