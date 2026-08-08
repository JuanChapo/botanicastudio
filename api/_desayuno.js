// ══════════════════════════════════════════════════════════════
// DESAYUNO SORPRESA — producto configurable
// ══════════════════════════════════════════════════════════════
//
// A diferencia del resto del catálogo, este producto se arma por
// partes. Igual que con los precios fijos, el servidor NO acepta el
// precio que mande el navegador: recibe las claves elegidas, verifica
// que existan en esta lista, y suma él mismo.
//
// Si una clave no está aquí, el pedido se rechaza.

export const DESAYUNO = {
  id: 13,
  name: 'Desayuno Sorpresa Grande',
  base: 899,          // incluye un platillo, un snack y una bebida
  grupos: [
    {
      clave: 'principal',
      titulo: 'Elige tu platillo principal',
      nota: 'Incluido en el precio base.',
      obligatorio: true,
      opciones: {
        croissant: { nombre: 'Croissant relleno',        precio: 0 },
        sandwich:  { nombre: 'Sándwich',                 precio: 0 },
        waffle:    { nombre: 'Waffle con fruta',         precio: 0 },
        baguette:  { nombre: 'Baguette',                 precio: 0 },
      },
    },
    {
      clave: 'snack',
      titulo: 'Elige tu snack',
      nota: 'Incluido en el precio base.',
      obligatorio: true,
      opciones: {
        gomitas:     { nombre: 'Gomitas',                    precio: 0 },
        manguitos:   { nombre: 'Manguitos enchilados',       precio: 0 },
        ferrero:     { nombre: 'Chocolates Ferrero Rocher',  precio: 0 },
        kinder:      { nombre: 'Kinder Bueno',               precio: 0 },
        fresas:      { nombre: 'Fresas con chocolate',       precio: 0 },
        brownie:     { nombre: 'Brownie',                    precio: 0 },
        galletas:    { nombre: 'Galletas artesanales',       precio: 0 },
        concha:      { nombre: 'Concha de pan dulce',        precio: 0 },
        japoneses:   { nombre: 'Cacahuates japoneses',       precio: 0 },
        papas:       { nombre: 'Papas',                      precio: 0 },
      },
    },
    {
      clave: 'bebida',
      titulo: 'Elige tu bebida',
      nota: 'Incluida en el precio base.',
      obligatorio: true,
      opciones: {
        naranja:  { nombre: 'Jugo de naranja natural', precio: 0 },
        refresco: { nombre: 'Refresco',                precio: 0 },
        te:       { nombre: 'Té verde',                precio: 0 },
        cafe:     { nombre: 'Café americano',          precio: 0 },
        chocolate:{ nombre: 'Chocolate caliente',      precio: 0 },
      },
    },
    {
      clave: 'extra',
      titulo: 'Bebida adicional',
      nota: 'Opcional.',
      obligatorio: false,
      // ⚠ ALCOHOL: en México su venta y entrega requiere licencia y
      // verificación de edad. Pon `activo: false` para ocultar el grupo
      // completo mientras no tengas el permiso.
      activo: true,
      alcohol: true,
      opciones: {
        bacardi:  { nombre: 'Mini Bacardí',     precio: 149 },
        champana: { nombre: 'Mini champaña',    precio: 199 },
        moet:     { nombre: 'Mini Moët',        precio: 399 },
      },
    },
    {
      clave: 'decoracion',
      titulo: 'Decoración',
      nota: 'Opcional.',
      obligatorio: false,
      opciones: {
        globo:    { nombre: 'Globo con helio',        precio: 99  },
        peluche:  { nombre: 'Peluche',                precio: 199 },
        flores:   { nombre: 'Mini ramo de flores',    precio: 249 },
        vela:     { nombre: 'Vela aromática',         precio: 149 },
      },
    },
  ],
};

/**
 * Recibe las claves que eligió el cliente y devuelve el precio real.
 * Si algo no cuadra, devuelve error en vez de un precio.
 */
export function armarDesayuno(elegidas) {
  if (!elegidas || typeof elegidas !== 'object') {
    return { error: 'Faltan las opciones del desayuno' };
  }

  let total = DESAYUNO.base;
  const detalle = [];

  for (const grupo of DESAYUNO.grupos) {
    if (grupo.activo === false) continue;

    const clave = typeof elegidas[grupo.clave] === 'string' ? elegidas[grupo.clave] : '';

    if (!clave) {
      if (grupo.obligatorio) return { error: `Falta elegir: ${grupo.titulo}` };
      continue;
    }

    const opcion = grupo.opciones[clave];
    if (!opcion) return { error: `Opción no válida en ${grupo.titulo}` };

    total += opcion.precio;
    detalle.push(`${grupo.titulo.replace(/^Elige tu /, '')}: ${opcion.nombre}`);
  }

  return { total, detalle, nombre: DESAYUNO.name };
}
