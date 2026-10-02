import { MercadoPagoConfig, Payment } from 'mercadopago';
import { checkAdminPassword } from './_admin-auth.js';

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!checkAdminPassword(req)) {
        return res.status(401).json({ error: 'unauthorized' });
  }

  if (!ACCESS_TOKEN) {
        return res.status(500).json({ error: 'payment_not_configured' });
  }

  try {
        const days = Math.min(Math.max(Number.parseInt(req.query?.days, 10) || 30, 1), 90);
        const beginDate = new Date(Date.now() - days * 864e5).toISOString();
        const endDate = new Date().toISOString();

      const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
        const payment = new Payment(client);

      const search = await payment.search({
              options: {
                        sort: 'date_created',
                        criteria: 'desc',
                        range: 'date_created',
                        begin_date: beginDate,
                        end_date: endDate,
                        limit: 100,
              },
      });

      const orders = (search.results || [])
          .filter((p) => p.status === 'approved')
          .map((p) => {
                    const m = p.metadata || {};
                    const td = p.transaction_details || {};
                    return {
                                id: p.id,
                                fecha_pago: p.date_approved || p.date_created,
                                total: td.total_paid_amount ?? p.transaction_amount,
                                neto: td.net_received_amount ?? null,
                                productos: (p.additional_info?.items || []).map((i) => ({
                                              title: i.title,
                                              quantity: i.quantity,
                                })),
                                recibe_nombre: m.recibe_nombre || null,
                                recibe_tel: m.recibe_tel || null,
                                direccion: m.direccion || null,
                                referencias: m.referencias || null,
                                mapa: m.mapa || null,
                                fecha_entrega: m.fecha || null,
                                franja: m.franja || null,
                                dedicatoria: m.dedicatoria || null,
                                compra_nombre: m.compra_nombre || null,
                                compra_tel: m.compra_tel || null,
                                compra_email: m.compra_email || null,
                    };
          });

      return res.status(200).json({ orders });
  } catch (error) {
        console.error('Error consultando pagos de MercadoPago:', error?.message);
        return res.status(500).json({ error: 'No se pudieron consultar los pedidos' });
  }
}
