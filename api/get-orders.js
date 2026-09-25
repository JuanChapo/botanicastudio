// =====================================================
// API para obtener órdenes reales de MercadoPago
// Se ejecuta automáticamente cada cierto tiempo
// =====================================================

export default async function handler(req, res) {
  // Solo GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    
    if (!MP_ACCESS_TOKEN) {
      console.error('❌ MP_ACCESS_TOKEN no configurado en .env');
      return res.status(500).json({ error: 'Access token not configured' });
    }

    // Traer últimas 100 búsquedas de payment
    const response = await fetch(
      'https://api.mercadopago.com/v1/payments/search?status=approved&limit=100&sort=date_created&criteria=desc',
      {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`❌ Error MercadoPago: ${response.status}`);
      return res.status(response.status).json({ error: 'MercadoPago API error' });
    }

    const data = await response.json();

    // Transformar datos de MP a formato del panel
    const orders = data.results.map((payment) => {
      const metadata = payment.metadata || {};
      
      return {
        id: payment.id,
        date: new Date(payment.date_created),
        client: payment.payer?.name || 'Cliente',
        product: metadata.product_name || 'Producto',
        qty: metadata.quantity || 1,
        total: payment.transaction_amount || 0,
        status: payment.status === 'approved' ? 'approved' : 'pending',
        phone: metadata.phone || payment.payer?.phone?.number || 'No disponible',
        mp_id: payment.id,
        mp_status: payment.status,
      };
    });

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 'max-age=0'); // Sin caché para datos actuales

    return res.status(200).json({
      success: true,
      orders,
      lastUpdate: new Date().toISOString(),
      count: orders.length,
    });
  } catch (error) {
    console.error('❌ Error en API get-orders:', error.message);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
