// Avisa por Telegram cuando entra un pedido.
//
// Necesita dos variables en Vercel:
//   TELEGRAM_BOT_TOKEN  — el que da @BotFather
//   TELEGRAM_CHAT_ID    — el grupo donde caen los avisos
//
// Si falta cualquiera de las dos, no truena: simplemente no manda nada.
// Un fallo al notificar NUNCA debe romper el cobro.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

const FRANJAS = {
  '9-13': '9:00 a 13:00',
  '13-17': '13:00 a 17:00',
  '17-21': '17:00 a 21:00',
};

/** Telegram interpreta < > & como HTML; hay que neutralizarlos. */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const money = (n) =>
  '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });

export function armarAviso(pago) {
  const m = pago.metadata || {};
  const td = pago.transaction_details || {};
  const total = td.total_paid_amount ?? pago.transaction_amount;
  const neto = td.net_received_amount;

  const productos = (pago.additional_info?.items || [])
    .map((i) => `• ${esc(i.title)} ×${i.quantity}`)
    .join('\n') || '• (sin detalle)';

  const mapa = m.mapa
    ? `https://maps.google.com/?q=${encodeURIComponent(m.mapa)}`
    : m.direccion
      ? `https://maps.google.com/?q=${encodeURIComponent(m.direccion)}`
      : null;

  const lineas = [
    `🌿 <b>PEDIDO NUEVO — ${money(total)}</b>`,
    '',
    productos,
    '',
    `<b>Recibe</b>  ${esc(m.recibe_nombre) || '—'}`,
  ];

  if (m.recibe_tel) lineas.push(`<b>Tel</b>  <a href="tel:${esc(m.recibe_tel)}">${esc(m.recibe_tel)}</a>`);
  if (m.direccion)  lineas.push(`<b>Dirección</b>  ${esc(m.direccion)}`);
  if (m.referencias) lineas.push(`<b>Referencias</b>  ${esc(m.referencias)}`);
  if (mapa)         lineas.push(`📍 <a href="${mapa}">Abrir en el mapa</a>`);

  const cuando = [m.fecha, FRANJAS[m.franja] || m.franja].filter(Boolean).join(' · ');
  if (cuando) lineas.push('', `<b>Entrega</b>  ${esc(cuando)}`);

  if (m.dedicatoria) lineas.push('', `<b>Tarjeta</b>  «${esc(m.dedicatoria)}»`);

  const compra = [m.compra_nombre, m.compra_tel, m.compra_email].filter(Boolean).map(esc).join(' · ');
  if (compra) lineas.push('', `<b>Compró</b>  ${compra}`);

  if (neto) lineas.push('', `<i>Te llegan ${money(neto)} después de comisión</i>`);

  return lineas.join('\n');
}

export async function avisarPedido(pago) {
  if (!TOKEN || !CHAT) {
    console.warn('Telegram sin configurar: falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID');
    return false;
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT,
        text: armarAviso(pago),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!r.ok) {
      const detalle = await r.text();
      console.error('Telegram rechazó el aviso:', r.status, detalle);
      return false;
    }
    return true;
  } catch (error) {
    // Que no se caiga el webhook por un aviso: el pago ya se cobró.
    console.error('No se pudo avisar por Telegram:', error?.message);
    return false;
  }
}
