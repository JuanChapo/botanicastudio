import { checkAdminPassword } from './_admin-auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ADMIN_PASSWORD) {
        return res.status(500).json({ error: 'panel_not_configured' });
  }

  const ok = checkAdminPassword(req);
    return res.status(ok ? 200 : 401).json({ ok });
}
