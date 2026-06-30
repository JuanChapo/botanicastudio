export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { type, data } = req.body;

  if (type === 'payment') {
    console.log('Payment received:', data.id);
    // Aquí puedes:
    // - Guardar el pago en una base de datos
    // - Enviar un email de confirmación
    // - Notificar por WhatsApp
    // - Actualizar el inventario
  }

  res.status(200).json({ received: true });
}
