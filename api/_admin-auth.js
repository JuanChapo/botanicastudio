// Verifica la contraseña del panel de administración.
// La contraseña vive en Vercel como variable de entorno ADMIN_PASSWORD.
// Nunca se expone en el código ni en las respuestas públicas.

export function checkAdminPassword(req) {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return false;

  const provided =
        req.headers['x-admin-password'] ||
        (req.body && req.body.password) ||
        null;

  return typeof provided === 'string' && provided === expected;
}
