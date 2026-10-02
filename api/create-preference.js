import { MercadoPagoConfig, Preference } from 'mercadopago';
import { CATALOG, SHIPPING_COST, FREE_SHIPPING_FROM, MAX_QTY } from './_catalog.js';

// IMPORTANTE: NO usar un fallback a MP_ACCESS_TOKEN aqui. Diagnosticamos
// que Vercel expone una variable MP_ACCESS_TOKEN (obsoleta, con un valor
// invalido) que no aparece en el panel de Environment Variables del
// proyecto, y que por el || anterior siempre ganaba sobre la variable
// correcta y vigente MERCADOPAGO_ACCESS_TOKEN. Usamos solo esta ultima.
const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const SITE_URL = process.env.SITE_URL || 'https://botanicastudio.mx';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', SITE_URL);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

if (!ACCESS_TOKEN) {
    console.error('FALTA MERCADOPAGO_ACCESS_TOKEN en las variables de entorno de Vercel');
    return res.status(500).json({
        error: 'payment_not_configured',
        debug_env_info: {
            has_key: Object.prototype.hasOwnProperty.call(process.env, 'MERCADOPAGO_ACCESS_TOKEN'),
            value_type: typeof process.env.MERCADOPAGO_ACCESS_TOKEN,
            value_length: typeof process.env.MERCADOPAGO_ACCESS_TOKEN === 'string' ? process.env.MERCADOPAGO_ACCESS_TOKEN.length : null,
            is_empty_string: process.env.MERCADOPAGO_ACCESS_TOKEN === '',
        },
    });
}

try {
    const { items, entrega } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided' });
    }

    const d = sanitizarEntrega(entrega);
    if (d.error) return res.status(400).json({ error: d.error });

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
    console.error('MercadoPago error:', error?.message, error?.cause ?? error);
    console.error(
        'DIAG env:',
        JSON.stringify(Object.keys(process.env).filter((k) => /TOKEN|MERCADO|MP_/i.test(k))),
        'node:', process.version,
        'vercel_env:', process.env.VERCEL_ENV,
        );
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

const FRANJAS = ['9-13', '13-17', '17-21'];

function limpiar(v, max) {
    if (typeof v !== 'string') return '';
    return v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
}

function telValido(t) {
    return /^\d{10}$/.test(t.replace(/\D/g, '')) ? t.replace(/\D/g, '') : '';
}

function sanitizarEntrega(e) {
    if (!e || typeof e !== 'object') return { error: 'Faltan los datos de entrega' };

const recibeNombre = limpiar(e.recibeNombre, 80);
    const recibeTel = telValido(limpiar(e.recibeTel, 20));
    const direccion = limpiar(e.direccion, 220);
    const compraNombre = limpiar(e.compraNombre, 80);
    const compraTel = telValido(limpiar(e.compraTel, 20));
    const compraEmail = limpiar(e.compraEmail, 120);
    const fecha = limpiar(e.fecha, 10);
    const franja = limpiar(e.franja, 10);

if (recibeNombre.length < 2) return { error: 'Falta el nombre de quien recibe' };
    if (!recibeTel) return { error: 'El teléfono de quien recibe debe tener 10 dígitos' };
    if (direccion.length < 10) return { error: 'La dirección está incompleta' };
    if (compraNombre.length < 2) return { error: 'Falta tu nombre' };
    if (!compraTel) return { error: 'Tu teléfono debe tener 10 dígitos' };
    if (compraEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(compraEmail)) {
        return { error: 'El correo no parece válido' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Falta la fecha de entrega' };
    if (!FRANJAS.includes(franja)) return { error: 'Falta el horario de entrega' };

const hoyCDMX = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    if (fecha < hoyCDMX) return { error: 'La fecha de entrega ya pasó' };
    const tope = new Date(Date.now() + 60 * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    if (fecha > tope) return { error: 'La fecha de entrega es demasiado lejana' };

return {
    recibeNombre, recibeTel, direccion, compraNombre, compraTel, compraEmail, fecha, franja,
    referencias: limpiar(e.referencias, 220),
    dedicatoria: limpiar(e.dedicatoria, 300),
    mapa: limpiar(e.mapa, 120),
};
}
