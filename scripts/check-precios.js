// Verifica que los precios de index.html y api/_catalog.js coincidan.
// Corre:  node scripts/check-precios.js
//
// Si no coinciden, el cliente ve un precio y MercadoPago le cobra otro.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOG } from '../api/_catalog.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const front = new Map();
const re = /\{\s*id:\s*(\d+),\s*name:\s*"([^"]+)",[^}]*?\bprice:\s*(\d+)/g;
for (const [, id, name, price] of html.matchAll(re)) {
  front.set(Number(id), { name, price: Number(price) });
}

if (front.size === 0) {
  console.error('No se encontró ningún producto en index.html — ¿cambió el formato?');
  process.exit(1);
}

const problems = [];

for (const [id, web] of front) {
  const server = CATALOG[id];
  if (!server) {
    problems.push(`#${id} "${web.name}" está en index.html pero NO en _catalog.js — no se podrá comprar.`);
    continue;
  }
  if (server.price !== web.price) {
    problems.push(`#${id} "${web.name}": la web muestra $${web.price} pero se cobrarían $${server.price}.`);
  }
  if (server.name !== web.name) {
    problems.push(`#${id}: nombre distinto — web "${web.name}" vs catálogo "${server.name}".`);
  }
}

for (const id of Object.keys(CATALOG).map(Number)) {
  if (!front.has(id)) problems.push(`#${id} está en _catalog.js pero ya no aparece en index.html.`);
}

if (problems.length) {
  console.error(`\n${problems.length} problema(s):\n`);
  for (const p of problems) console.error('  ✗ ' + p);
  console.error('');
  process.exit(1);
}

console.log(`✓ ${front.size} productos: precios y nombres coinciden.`);
