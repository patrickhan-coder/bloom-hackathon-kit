import { store, send, J } from './_lib.js';

// GET /api/led — only the LED scene, uncached and one read, so console changes reach the screen within about a second
export default async function handler(req, res) {
  const s = await store();
  send(res, 200, { led: J(await s.get('hk:led'), {}) });
}
