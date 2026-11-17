// El costo confirmado de una compra sale de los importes de ese comprobante.
// `subtotal` ya incluye los descuentos y ajustes ingresados en la compra.
export const obtenerCostoUnitarioConfirmadoCompra = (item = {}) => {
  const cantidad = Number(item.cantidadRecibida ?? item.cantidad ?? 0);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 0;

  const subtotal = Number(item.subtotal);
  if (Number.isFinite(subtotal) && subtotal >= 0) return subtotal / cantidad;

  const costo = Number(item.costoPesos ?? 0);
  const descuento = Math.min(100, Math.max(0, Number(item.descuento ?? 0) || 0));
  return Number.isFinite(costo) ? Math.max(0, costo * (1 - descuento / 100)) : 0;
};
