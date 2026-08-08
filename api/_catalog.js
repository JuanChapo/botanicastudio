// ══════════════════════════════════════════════════════════════
// CATÁLOGO AUTORITATIVO DE PRECIOS  —  fuente de verdad del dinero
// ══════════════════════════════════════════════════════════════
//
// ¿Por qué existe este archivo?
// El navegador NO es de fiar. Cualquiera puede abrir la consola,
// escribir  cart[0].price = 1  y pagar $1 por un arreglo de $1,450.
// Por eso el servidor NUNCA usa el precio que manda el cliente:
// sólo usa el `id`, y busca aquí el precio real.
//
// IMPORTANTE: si cambias un precio en index.html, cámbialo TAMBIÉN aquí.
// Corre `node scripts/check-precios.js` para verificar que coinciden.

export const CATALOG = {
  1:  { name: 'Ramo Atardecer',          price: 549  },
  2:  { name: 'Box Elegance Premium',    price: 1499 },
  3:  { name: 'Ramo Silvestre',          price: 399  },
  4:  { name: 'Monstera Deliciosa',      price: 549  },
  5:  { name: '50 Rosas Rojas Premium',  price: 1499 },
  6:  { name: 'Box de Tulipanes',        price: 1399 },
  7:  { name: 'Combo Sorpresa',          price: 899  },
  8:  { name: 'Snake Plant',             price: 479  },
  9:  { name: 'Arreglo Corporativo',     price: 799  },
  10: { name: 'Combo Aniversario VIP',   price: 1989 },
  11: { name: 'Mini Suculentas Set x6',  price: 499  },
  12: { name: 'Ramo Girasoles',          price: 499  },
};

// Envío — también autoritativo, por la misma razón.
export const SHIPPING_COST = 99;
export const FREE_SHIPPING_FROM = 899;

// Máximo de piezas por producto en un pedido (evita cantidades absurdas
// tipo qty = 99999 o qty negativa que reduzca el total).
export const MAX_QTY = 20;
