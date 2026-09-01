// GET /api/order/:id — public status poll. Started for the payment-auto-confirm
// flow; now also surfaces real Paloma365 kitchen status (`palomaStatus`) when
// the order was successfully pushed there. No admin auth: this is called by
// the guest's own browser, so it deliberately returns nothing but status —
// never the order contents.

const { getPool, getRestaurant } = require('../_db');
const { palomaRequest, isConfigured: palomaConfigured } = require('../_paloma');

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
    const result = await client.query('SELECT status, paloma_order_id FROM orders WHERE id = $1', [orderId]);
    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Order not found' });
      return;
    }
    const row = result.rows[0];
    const response = { ok: true, status: row.status };

    if (row.paloma_order_id) {
      try {
        const restaurant = await getRestaurant(client);
        if (palomaConfigured(restaurant)) {
          const palomaResult = await palomaRequest(restaurant, 'status', { query: { order_id: row.paloma_order_id } });
          if (palomaResult.ok && palomaResult.data && palomaResult.data.status != null) {
            response.palomaStatus = String(palomaResult.data.status);
          }
        }
      } catch (e) {
        console.error('[order/:id] Failed to fetch Paloma status (non-fatal):', e);
      }
    }

    res.status(200).json(response);
  } catch (e) {
    console.error('[order/:id] DB error:', e);
    res.status(500).json({ ok: false, error: 'Failed to load order status' });
  }
};
