import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items, payer } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'No items provided' });
    }

    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: items.map(item => ({
          id: String(item.id),
          title: item.name,
          description: item.description || '',
          quantity: item.qty,
          unit_price: item.price,
          currency_id: 'MXN',
        })),
        payer: payer || {},
        back_urls: {
          success: `${process.env.SITE_URL || 'https://botanicastudio.mx'}/gracias`,
          failure: `${process.env.SITE_URL || 'https://botanicastudio.mx'}/error`,
          pending: `${process.env.SITE_URL || 'https://botanicastudio.mx'}/pendiente`,
        },
        auto_return: 'approved',
        statement_descriptor: 'BOTANICA STUDIO',
        notification_url: `${process.env.SITE_URL || 'https://botanicastudio.mx'}/api/webhook`,
      },
    });

    res.status(200).json({
      id: result.id,
      init_point: result.init_point,
    });
  } catch (error) {
    console.error('MercadoPago error:', error);
    res.status(500).json({ error: 'Error creating payment preference' });
  }
}
