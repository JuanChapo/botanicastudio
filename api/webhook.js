import crypto from 'node:crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
// Secreto de la firma. Se saca en: MercadoPago → Tus integraciones → tu app
// → Webhooks → "Clave secreta". Guárdalo en Vercel como MP_WEBHOOK_SECRET.
const WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;

/**
 * Verifica que la notificación venga de verdad de MercadoPago.
 * Sin esto, cualquiera puede mandar un POST a /api/webhook diciendo
 * "el pago 123 fue aprobado" y disparar lo que haya en processPayment().
 */
function isValidSignature(req, dataId) {
  if (!WEBHOOK_SECRET) return null; // no configurado todavía

  const signature = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  if (!signature || !dataId) return false;

  const parts = Object.fromEntries(
    signature.split(',').map(p => p.split('=').map(s => s.trim()))
  );
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  // MercadoPago manda notificaciones por POST (webhooks) y a veces por GET (IPN).
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  // El id del pago puede venir en el body o en el query string según el tipo.
  const type = req.body?.type || req.query?.type || req.query?.topic;
  const dataId = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;

  const valid = isValidSignature(req, dataId);
  if (valid === false) {
    console.warn('Webhook con firma inválida — descartado. data.id:', dataId);
    return res.status(401).json({ error: 'invalid signature' });
  }
  if (valid === null) {
    console.warn('MP_WEBHOOK_SECRET no configurado: no se está verificando la firma.');
  }

  // Contestamos 200 cuanto antes: si tardamos, MercadoPago reintenta
  // y acabamos procesando el mismo pago varias veces.
  res.status(200).json({ received: true });

  if (type !== 'payment' || !dataId) return;

  try {
    // Nunca confiamos en el estado que venga en la notificación:
    // se lo preguntamos directamente a MercadoPago.
    const payment = await new Payment(
      new MercadoPagoConfig({ accessToken: ACCESS_TOKEN })
    ).get({ id: dataId });

    console.log('Pago', payment.id, '→', payment.status, '· $', payment.transaction_amount);

    if (payment.status === 'approved') {
      // TODO (Fase 3): aquí va el aviso del pedido — email al cliente,
      // notificación a la floristería, alta en la hoja de pedidos.
      // Ojo: MercadoPago puede mandar la misma notificación más de una vez,
      // así que guarda payment.id y descarta los repetidos.
      console.log('PEDIDO PAGADO:', payment.id, payment.payer?.email);
    }
  } catch (error) {
    console.error('No se pudo consultar el pago', dataId, error?.message);
  }
}
