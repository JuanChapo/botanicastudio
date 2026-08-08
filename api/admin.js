import crypto from 'node:crypto';

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
const CLAVE = process.env.ADMIN_PASSWORD;

/**
 * Compara sin filtrar información por el tiempo que tarda.
 * Un `===` normal corta en la primera letra distinta, y midiendo esa
 * diferencia se puede adivinar la contraseña carácter por carácter.
 */
function claveCorrecta(recibida) {
  if (!CLAVE || typeof recibida !== 'string') return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(CLAVE);
  // Se comparan hasheadas para que la longitud tampoco delate nada.
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // Que ningún buscador indexe esto jamás.
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!CLAVE) {
    console.error('FALTA ADMIN_PASSWORD en las variables de entorno');
    return res.status(500).json({ error: 'admin_not_configured' });
  }
  if (!ACCESS_TOKEN) return res.status(500).json({ error: 'payment_not_configured' });

  const { clave, dias } = req.body || {};

  if (!claveCorrecta(clave)) {
    // Medio segundo de castigo: sin esto, probar claves por fuerza bruta
    // sale gratis. No es una defensa completa, pero encarece mucho el intento.
    await espera(500);
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  const rango = Math.min(Math.max(parseInt(dias, 10) || 30, 1), 365);
  const desde = new Date(Date.now() - rango * 864e5).toISOString();

  try {
    const url = new URL('https://api.mercadopago.com/v1/payments/search');
    url.searchParams.set('sort', 'date_created');
    url.searchParams.set('criteria', 'desc');
    url.searchParams.set('limit', '100');
    url.searchParams.set('begin_date', desde);
    url.searchParams.set('end_date', 'NOW');

    const r = await fetch(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    if (!r.ok) throw new Error(`MercadoPago respondió ${r.status}`);
    const data = await r.json();

    // En esta cuenta de MercadoPago también entran pagos ajenos a la tienda
    // (recargas, compras personales). Un pedido nuestro se reconoce porque
    // lleva los datos de entrega que manda el sitio.
    const pedidos = (data.results || [])
      .filter((p) => p.metadata && (p.metadata.direccion || p.metadata.recibe_nombre))
      .map((p) => {
        const m = p.metadata || {};
        const td = p.transaction_details || {};
        const comision = (p.fee_details || []).reduce((s, f) => s + (f.amount || 0), 0);
        return {
          id: p.id,
          estado: p.status,
          fecha: p.date_created,
          productos: (p.additional_info?.items || []).map((i) => ({
            titulo: i.title, cantidad: Number(i.quantity), precio: Number(i.unit_price),
          })),
          cobrado: td.total_paid_amount ?? p.transaction_amount,
          envio: p.shipping_amount || 0,
          comision: Number(comision.toFixed(2)),
          neto: td.net_received_amount ?? null,
          metodo: p.payment_method_id,
          entrega: {
            recibe: m.recibe_nombre || '', tel: m.recibe_tel || '',
            direccion: m.direccion || '', referencias: m.referencias || '',
            mapa: m.mapa || '', fecha: m.fecha || '', franja: m.franja || '',
            dedicatoria: m.dedicatoria || '',
          },
          compra: {
            nombre: m.compra_nombre || '', tel: m.compra_tel || '', email: m.compra_email || '',
          },
        };
      });

    const pagados = pedidos.filter((p) => p.estado === 'approved');
    const ventas = pagados.reduce((s, p) => s + (p.cobrado || 0), 0);
    const comisiones = pagados.reduce((s, p) => s + (p.comision || 0), 0);

    const hoyCDMX = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const paraHoy = pagados.filter((p) => p.entrega.fecha === hoyCDMX);

    return res.status(200).json({
      rango,
      resumen: {
        pedidos: pagados.length,
        ventas: Number(ventas.toFixed(2)),
        comisiones: Number(comisiones.toFixed(2)),
        neto: Number((ventas - comisiones).toFixed(2)),
        ticket: pagados.length ? Number((ventas / pagados.length).toFixed(2)) : 0,
        entregasHoy: paraHoy.length,
      },
      pedidos,
    });
  } catch (error) {
    console.error('Error consultando MercadoPago:', error?.message);
    return res.status(500).json({ error: 'No se pudieron leer los pedidos' });
  }
}
