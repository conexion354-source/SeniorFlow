import test from 'node:test';
import assert from 'node:assert/strict';
import { precioFinalDesdeNetoVenta, precioUnitarioNetoVenta } from './venta-precios.mjs';

test('el IVA se desglosa del precio final sin cambiar el cobro', () => {
  assert.equal(precioUnitarioNetoVenta(900, '21'), 743.8);
  assert.equal(precioFinalDesdeNetoVenta(743.8, '21'), 900);
  assert.equal(precioUnitarioNetoVenta(1105, '10.5'), 1000);
  assert.equal(precioFinalDesdeNetoVenta(1000, '10.5'), 1105);
});

test('sin IVA, el precio unitario sigue siendo el final', () => {
  assert.equal(precioUnitarioNetoVenta(900, 'sin_iva'), 900);
  assert.equal(precioFinalDesdeNetoVenta(900, 'sin_iva'), 900);
});
