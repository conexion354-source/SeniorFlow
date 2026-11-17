export const DOLAR_BLUE_API_URL = 'https://dolarapi.com/v1/dolares/blue';
export const DOLAR_BLUE_REFERENCIA_URL = 'https://www.cronista.com/MercadosOnline/dolar.html';

const MIN_VENTA = 100;
const MAX_VENTA = 10000;
const MAX_ANTIGUEDAD_MS = 96 * 60 * 60 * 1000;

export const interpretarCotizacionBlue = (datos, ahora = Date.now()) => {
  if (datos?.moneda !== 'USD' || datos?.casa !== 'blue') return null;
  const venta = Number(datos.venta);
  const compra = Number(datos.compra);
  const actualizacion = new Date(datos.fechaActualizacion);
  const antiguedad = ahora - actualizacion.getTime();
  if (!Number.isFinite(venta) || venta < MIN_VENTA || venta > MAX_VENTA) return null;
  if (!Number.isFinite(compra) || compra <= 0 || compra > venta) return null;
  if (!Number.isFinite(antiguedad) || antiguedad < -10 * 60 * 1000 || antiguedad > MAX_ANTIGUEDAD_MS) return null;

  const fechaHora = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(actualizacion);
  return {
    venta,
    compra,
    fecha: datos.fechaActualizacion,
    hora: fechaHora,
    fuente: DOLAR_BLUE_API_URL
  };
};
