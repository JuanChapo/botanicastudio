// Entrega al navegador la clave pública de Google Maps.
//
// ¿Por qué un endpoint y no ponerla en el HTML? Para que no viva en el
// repositorio y puedas rotarla desde Vercel sin volver a desplegar.
//
// OJO — esta clave la ve cualquiera que abra el inspector, y no hay
// forma de evitarlo: Google Maps corre en el navegador. Lo que la
// protege NO es esconderla, es restringirla:
//
//   Google Cloud → Credenciales → tu clave → Restricciones de aplicación
//   → Sitios web → agrega:  https://botanicastudio.mx/*
//
// Sin esa restricción, cualquiera puede copiarla y gastar tu cuota.

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // 5 minutos de caché: no tiene sentido pedirla en cada visita.
  res.setHeader('Cache-Control', 'public, max-age=300');

  return res.status(200).json({
    mapsKey: process.env.GOOGLE_MAPS_PUBLIC_KEY || null,
  });
}
