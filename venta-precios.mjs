const redondearCentavos = (importe) => Math.round((Number(importe) + Number.EPSILON) * 100) / 100;

export const tasaIvaVenta = (iva = 'sin_iva') => {
  const tasa = String(iva).replace('%', '').replace(',', '.').trim();
  return tasa === '21' || tasa === '10.5' ? Number(tasa) / 100 : 0;
};

export const precioUnitarioNetoVenta = (precioFinal = 0, iva = 'sin_iva') => {
  const final = Math.max(0, Number(precioFinal) || 0);
  const tasa = tasaIvaVenta(iva);
  return tasa ? redondearCentavos(final / (1 + tasa)) : final;
};

export const precioFinalDesdeNetoVenta = (precioNeto = 0, iva = 'sin_iva') => {
  const neto = Math.max(0, Number(precioNeto) || 0);
  const tasa = tasaIvaVenta(iva);
  return tasa ? redondearCentavos(neto * (1 + tasa)) : neto;
};
