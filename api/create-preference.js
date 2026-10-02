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
        const { items, entrega } = req.body || {};

      if (!Array.isArray(items) || items.length === 0) {
              return res.status(400).json({ error: 'No items provided' });
      }

      // ── Datos de entrega ─────────────────────────────────────────
      // Se validan aquí y no sólo en el navegador: sin esto podríamos
      // cobrar un pedido que después no sabemos a dónde llevar.
      const d = sanitizarEntrega(entrega);
        if (d.error) return res.status(400).json({ error: d.error });

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
                        payer: {
                                    name: d.compraNombre,
                                    email: d.compraEmail || undefined,
                        },
                        shipments: { cost: shippingCost, mode: 'not_specified' },
                        // Los datos de entrega viajan con la preferencia. Así el
                        // webhook los recupera al confirmarse el pago y no dependemos
                        // de que el navegador nos los vuelva a mandar.
                        metadata: {
                                    recibe_nombre: d.recibeNombre,
                                    recibe_tel: d.recibeTel,
                                    direccion: d.direccion,
                                    referencias: d.referencias,
                                    mapa: d.mapa,
                                    fecha: d.fecha,
                                    franja: d.franja,
                                    dedicatoria: d.dedicatoria,
                                    compra_nombre: d.compraNombre,
                                    compra_tel: d.compraTel,
                                    compra_email: d.compraEmail,
                        },
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
        // DIAGNOSTICO TEMPORAL: exponemos el motivo exacto del error de
      // MercadoPago para depurar el 500 persistente. Se revierte en cuanto
      // encontremos la causa. No incluye ningún token ni credencial: sólo
      // metadatos de higiene (longitud, espacios) para detectar un error
      // de copy-paste sin mostrar el valor real.
      const causa = error?.cause;
        const detalle = Array.isArray(causa) ? causa : (causa ? [causa] : []);
        return res.status(500).json({
                error: 'Error creating payment preference',
                debug_message: error?.message || null,
                debug_cause: detalle,
                debug_token_info: {
                          length: ACCESS_TOKEN.length,
                          trimmed_length: ACCESS_TOKEN.trim().length,
                          has_leading_or_trailing_whitespace: ACCESS_TOKEN !== ACCESS_TOKEN.trim(),
                          has_newline: /[\r\n]/.test(ACCESS_TOKEN),
                          starts_with_APP_USR: ACCESS_TOKEN.startsWith('APP_USR-'),
                          starts_with_TEST: ACCESS_TOKEN.startsWith('TEST-'),
                          only_expected_charset: /^[A-Za-z0-9-]+$/.test(ACCESS_TOKEN),
                          hyphen_count: (ACCESS_TOKEN.match(/-/g) || []).length,
                          source_var: process.env.MP_ACCESS_TOKEN ? 'MP_ACCESS_TOKEN' : 'MERCADOPAGO_ACCESS_TOKEN',
                },
        });
  }
}

// ── Validación de los datos de entrega ─────────────────────────────
// Todo lo que llega del navegador se recorta y se revisa. Un pedido sin
// dirección o sin teléfono es un pedido que no se puede entregar, así
// que se rechaza antes de cobrarle a nadie.

const FRANJAS = ['9-13', '13-17', '17-21'];

function limpiar(v, max) {
    if (typeof v !== 'string') return '';
    // Fuera saltos de línea y caracteres de control; recorta al límite.
  return v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
}

function telValido(t) {
    return /^\d{10}$/.test(t.replace(/\D/g, '')) ? t.replace(/\D/g, '') : '';
}

function sanitizarEntrega(e) {
    if (!e || typeof e !== 'object') return { error: 'Faltan los datos de entrega' };

  const recibeNombre = limpiar(e.recibeNombre, 80);
    const recibeTel    = telValido(limpiar(e.recibeTel, 20));
    const direccion    = limpiar(e.direccion, 220);
    const compraNombre = limpiar(e.compraNombre, 80);
    const compraTel    = telValido(limpiar(e.compraTel, 20));
    const compraEmail  = limpiar(e.compraEmail, 120);
    const fecha        = limpiar(e.fecha, 10);
    const franja       = limpiar(e.franja, 10);

  if (recibeNombre.length < 2) return { error: 'Falta el nombre de quien recibe' };
    if (!recibeTel)              return { error: 'El teléfono de quien recibe debe tener 10 dígitos' };
    if (direccion.length < 10)   return { error: 'La dirección está incompleta' };
    if (compraNombre.length < 2) return { error: 'Falta tu nombre' };
    if (!compraTel)              return { error: 'Tu teléfono debe tener 10 dígitos' };
    if (compraEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(compraEmail)) {
          return { error: 'El correo no parece válido' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Falta la fecha de entrega' };
    if (!FRANJAS.includes(franja))          return { error: 'Falta el horario de entrega' };

  // La fecha debe ser de hoy en adelante y dentro de los próximos 60 días.
  // Se compara en horario de CDMX, no en el del servidor (que corre en UTC).
  const hoyCDMX = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    if (fecha < hoyCDMX) return { error: 'La fecha de entrega ya pasó' };
    const tope = new Date(Date.now() + 60 * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    if (fecha > tope)    return { error: 'La fecha de entrega es demasiado lejana' };

  return {
        recibeNombre, recibeTel, direccion, compraNombre, compraTel, compraEmail, fecha, franja,
        referencias: limpiar(e.referencias, 220),
        dedicatoria: limpiar(e.dedicatoria, 300),
        mapa:        limpiar(e.mapa, 120),
  };
}
