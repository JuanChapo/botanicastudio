import { MercadoPagoConfig, Preference } from 'mercadopago';
import { CATALOG, SHIPPING_COST, FREE_SHIPPING_FROM, MAX_QTY } from './_catalog.js';

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
const SITE_URL = process.env.SITE_URL || 'https://botanicastudio.mx';

export default async function handler(req, res) {
  // Sólo nuestro propio dominio necesita llamar a esta API.
  res.setHeader('Access-Control-Allow-Origin', SITE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Falla temprano y claro si falta la credencial, en vez de un 500 genérico.
  if (!ACCESS_TOKEN) {
    console.error('FALTA MP_ACCESS_TOKEN en las variables de entorno de Vercel');
    return res.status(500).json({ error: 'payment_not_configured' });
  }

  try {
    const { items, payer } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    // ── Re-precio del lado del servidor ──────────────────────────
    // Del carrito que manda el navegador SÓLO confiamos en `id` y `qty`.
    // Nombre y precio salen del catálogo. Así, aunque alguien manipule
    // el precio en la consola, MercadoPago cobra el precio real.
    const lineItems = [];
    for (const item of items) {
      const product = CATALOG[item.id];
      if (!product) {
        return res.status(400).json({ error: `Producto desconocido: ${item.id}` });
      }

      const qty = Number.parseInt(item.qty, 10);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        return res.status(400).json({ error: `Cantidad inválida para el producto ${item.id}` });
      }

      lineItems.push({
        id: String(item.id),
        title: product.name,
        quantity: qty,
        unit_price: product.price,
        currency_id: 'MXN',
      });
    }

    // El envío también se calcula aquí, no en el navegador.
    const subtotal = lineItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const shippingCost = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_COST;

    const preference = new Preference(new MercadoPagoConfig({ accessToken: ACCESS_TOKEN }));

    const result = await preference.create({
      body: {
        items: lineItems,
        payer: payer || {},
        shipments: { cost: shippingCost, mode: 'not_specified' },
        back_urls: {
          success: `${SITE_URL}/gracias`,
          failure: `${SITE_URL}/error`,
          pending: `${SITE_URL}/pendiente`,
        },
        auto_return: 'approved',
        statement_descriptor: 'BOTANICA STUDIO',
        notification_url: `${SITE_URL}/api/webhook`,
      },
    });

    return res.status(200).json({ id: result.id, init_point: result.init_point });
  } catch (error) {
    // Log detallado del lado servidor (visible en los logs de Vercel),
    // pero sin filtrar nada de esto al navegador.
    console.error('MercadoPago error:', error?.message, error?.cause ?? error);
    return res.status(500).json({ error: 'Error creating payment preference' });
  }
}
