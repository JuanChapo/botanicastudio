import { MercadoPagoConfig, Preference } from 'mercadopago';
import { CATALOG, SHIPPING_COST, FREE_SHIPPING_FROM, MAX_QTY } from './_catalog.js';

// IMPORTANTE: NO usar un fallback a MP_ACCESS_TOKEN aqui. Diagnosticamos
// que Vercel expone una variable MP_ACCESS_TOKEN (obsoleta, con un valor
// invalido) que no aparece en el panel de Environment Variables del
// proyecto, y que por el `||` anterior siempre ganaba sobre la variable
// correcta y vigente MERCADOPAGO_ACCESS_TOKEN. Usamos solo esta ultima.
//
// DIAGNOSTICO TEMPORAL: leemos la variable DENTRO del handler (no en el
// top-level del modulo) para descartar que sea un problema de timing en
// el arranque en frio de la funcion.
const SITE_URL = process.env.SITE_URL || 'https://botanicastudio.mx';

export default async function handler(req, res) {
        const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
        res.setHeader('Access-Control-Allow-Origin', SITE_URL);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Falla temprano y claro si falta la credencial, en vez de un 500 generico.
  if (!ACCESS_TOKEN) {
            console.error('FALTA MERCADOPAGO_ACCESS_TOKEN en las variables de entorno de Vercel');
            // DIAGNOSTICO TEMPORAL (solo logs del servidor, nunca en la respuesta
          // publica): listamos que nombres de variables de entorno existen de
          // verdad en este arranque de la funcion, para ver si Vercel esta
          // inyectando ALGUNA variable custom o ninguna en absoluto.
          const allKeys = Object.keys(process.env);
            console.error(
                        'DIAG env (early-return): total_keys=', allKeys.length,
                        'matching=', JSON.stringify(allKeys.filter((k) => /TOKEN|MERCADO|MP_|SITE_URL/i.test(k))),
                        'node:', process.version,
                        'vercel_env:', process.env.VERCEL_ENV,
                        'region:', process.env.VERCEL_REGION,
                      );
            // DIAGNOSTICO TEMPORAL: sin exponer ningun valor, distinguimos si la
          // variable no existe en absoluto vs si existe pero esta vacia.
          return res.status(500).json({
                      error: 'payment_not_configured',
                      debug_env_info: {
                                    has_key: Object.prototype.hasOwnProperty.call(process.env, 'MERCADOPAGO_ACCESS_TOKEN'),
                                    value_type: typeof process.env.MERCADOPAGO_ACCESS_TOKEN,
                                    value_length: typeof process.env.MERCADOPAGO_ACCESS_TOKEN === 'string' ? process.env.MERCADOPAGO_ACCESS_TOKEN.length : null,
                                    is_empty_string: process.env.MERCADOPAGO_ACCESS_TOKEN === '',
                                    total_env_keys: allKeys.length,
                                    has_public_key_var: Object.prototype.hasOwnProperty.call(process.env, 'NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY'),
                                    vercel_env: process.env.VERCEL_ENV || null,
                                    vercel_region: process.env.VERCEL_REGION || null,
                                    vercel_url: process.env.VERCEL_URL || null,
                                    vercel_git_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
                                    node_version: process.version,
                      },
          });
  }

  try {
            const { items, entrega } = req.body || {};

          if (!Array.isArray(items) || items.length === 0) {
                      return res.status(400).json({ error: 'No items provided' });
          }

          // ── Datos de entrega ─────────────────────────────────────────
          // Se validan aqui y no solo en el navegador: sin esto podriamos
          // cobrar un pedido que despues no sabemos a donde llevar.
          const d = sanitizarEntrega(entrega);
            if (d.error) return res.status(400).json({ error: d.error });

          // ── Re-precio del lado del servidor ──────────────────────────
          // Del carrito que manda el navegador SOLO confiamos en `id` y `qty`.
          // Nombre y precio salen del catalogo. Asi, aunque alguien manipule
          // el precio en la consola, MercadoPago cobra el precio real.
          const lineItems = [];
            for (const item of items) {
                        const product = CATALOG[item.id];
                        if (!product) {
                                      return res.status(400).json({ error: `Producto desconocido: ${item.id}` });
                        }

              const qty = Number.parseInt(item.qty, 10);
                        if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
                                      return res.status(400).json({ error: `Cantidad invalida para el producto ${item.id}` });
                        }

              lineItems.push({
                            id: String(item.id),
                            title: product.name,
                            quantity: qty,
                            unit_price: product.price,
                            currency_id: 'MXN',
              });
            }

          // El envio tambien se calcula aqui, no en el navegador.
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
                                    // Los datos de entrega viajan con la preferencia. Asi el
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
            // DIAGNOSTICO TEMPORAL (solo en logs del servidor, nunca en la
          // respuesta publica): nombres de variables de entorno presentes,
          // para ver si existe una MP_ACCESS_TOKEN ademas de la oficial.
          console.error(
                      'DIAG env:',
                      JSON.stringify(Object.keys(process.env).filter((k) => /TOKEN|MERCADO|MP_/i.test(k))),
                      'node:', process.version,
                      'vercel_env:', process.env.VERCEL_ENV,
                    );
            // DIAGNOSTICO TEMPORAL: exponemos el motivo exacto del error de
          // MercadoPago para depurar el 500 persistente. Se revierte en cuanto
          // encontremos la causa. No incluye ningun token ni credencial: solo
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
                                      only_expected_charset: /^[A-Za-z0-9_-]+$/.test(ACCESS_TOKEN),
                                      hyphen_count: (ACCESS_TOKEN.match(/-/g) || []).length,
                                      has_MP_ACCESS_TOKEN_var: Object.prototype.hasOwnProperty.call(process.env, 'MP_ACCESS_TOKEN'),
                                      has_MERCADOPAGO_ACCESS_TOKEN_var: Object.prototype.hasOwnProperty.call(process.env, 'MERCADOPAGO_ACCESS_TOKEN'),
                                      source_var: process.env.MP_ACCESS_TOKEN ? 'MP_ACCESS_TOKEN' : 'MERCADOPAGO_ACCESS_TOKEN',
                        },
            });
  }
}

// ── Validacion de los datos de entrega ─────────────────────────────
// Todo lo que llega del navegador se recorta y se revisa. Un pedido sin
// direccion o sin telefono es un pedido que no se puede entregar, asi
// que se rechaza antes de cobrarle a nadie.

const FRANJAS = ['9-13', '13-17', '17-21'];

function limpiar(v, max) {
        if (typeof v !== 'string') return '';
        // Fuera saltos de linea y caracteres de control; recorta al limite.
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
        if (!recibeTel)              return { error: 'El telefono de quien recibe debe tener 10 digitos' };
        if (direccion.length < 10)   return { error: 'La direccion esta incompleta' };
        if (compraNombre.length < 2) return { error: 'Falta tu nombre' };
        if (!compraTel)              return { error: 'Tu telefono debe tener 10 digitos' };
        if (compraEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(compraEmail)) {
                  return { error: 'El correo no parece valido' };
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Falta la fecha de entrega' };
        if (!FRANJAS.includes(franja))          return { error: 'Falta el horario de entrega' };

  // La fecha debe ser de hoy en adelante y dentro de los proximos 60 dias.
  // Se compara en horario de CDMX, no en el del servidor (que corre en UTC).
  const hoyCDMX = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        if (fecha < hoyCDMX) return { error: 'La fecha de entrega ya paso' };
        const tope = new Date(Date.now() + 60 * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        if (fecha > tope)    return { error: 'La fecha de entrega es demasiado lejana' };

  return {
            recibeNombre, recibeTel, direccion, compraNombre, compraTel, compraEmail, fecha, franja,
            referencias: limpiar(e.referencias, 220),
            dedicatoria: limpiar(e.dedicatoria, 300),
            mapa:        limpiar(e.mapa, 120),
  };
}
