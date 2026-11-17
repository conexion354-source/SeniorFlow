import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarCotizacionBlue } from './cotizacion-blue.mjs';

const ahora = Date.parse('2026-11-17T19:00:00.000Z');
const respuesta = {
  moneda: 'USD', casa: 'blue', compra: 1585, venta: 1605,
  fechaActualizacion: '2026-11-17T17:57:00.000Z'
};

test('usa venta blue y conserva fecha y fuente', () => {
  const cotizacion = interpretarCotizacionBlue(respuesta, ahora);
  assert.equal(cotizacion.venta, 1605);
  assert.equal(cotizacion.compra, 1585);
  assert.match(cotizacion.hora, /17\/11\/2026/);
  assert.match(cotizacion.fuente, /dolarapi\.com/);
});

test('rechaza otra moneda o tipo de cambio', () => {
  assert.equal(interpretarCotizacionBlue({ ...respuesta, casa: 'oficial' }, ahora), null);
  assert.equal(interpretarCotizacionBlue({ ...respuesta, moneda: 'ARS' }, ahora), null);
});

test('rechaza precios inválidos y cotizaciones viejas', () => {
  assert.equal(interpretarCotizacionBlue({ ...respuesta, venta: 0 }, ahora), null);
  assert.equal(interpretarCotizacionBlue({ ...respuesta, compra: 1610 }, ahora), null);
  assert.equal(interpretarCotizacionBlue({ ...respuesta, fechaActualizacion: '2026-11-10T17:57:00.000Z' }, ahora), null);
});
