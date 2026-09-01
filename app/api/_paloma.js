// Shared Paloma365 API client — not a route (Vercel skips "_"-prefixed files).
// Paloma365 is a Kazakhstani POS/automation system; its API (documented at
// github.com/Vladsoftik/Paloma365_public) lets an external ordering system
// push orders straight into a restaurant's own kassa. Every call here uses
// the restaurant's OWN authkey — never a shared/global credential — and
// always resolves to { ok, ... } rather than throwing, because a Paloma
// outage or misconfiguration must never block a guest's real order.

const BASE_URL = 'https://api.paloma365.com/company/api/';
const TIMEOUT_MS = 8000; // a slow/unresponsive Paloma365 must never hang a guest's checkout

function isConfigured(restaurant) {
  return !!(restaurant && restaurant.paloma_enabled && restaurant.paloma_authkey);
}

async function palomaRequest(restaurant, method, { query, body } = {}) {
  if (!isConfigured(restaurant)) return { ok: false, error: 'Paloma365 not configured' };

  const params = new URLSearchParams({
    method,
    class: restaurant.paloma_class || 'Tester',
    authkey: restaurant.paloma_authkey,
    ...(query || {})
  });
  const url = `${BASE_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = text; }
    if (!res.ok) return { ok: false, error: `Paloma365 responded ${res.status}`, data };
    return { ok: true, data };
  } catch (e) {
    const timedOut = e.name === 'AbortError';
    return { ok: false, error: timedOut ? 'Paloma365 request timed out' : (e.message || 'Network error reaching Paloma365') };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { palomaRequest, isConfigured };
