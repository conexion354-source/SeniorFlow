import * as XLSX from 'xlsx';

export const CAMPOS_IMPORTACION_COMPRA = [
  { id: 'codigo', etiqueta: 'Código interno' },
  { id: 'codigoProveedor', etiqueta: 'Código proveedor' },
  { id: 'descripcion', etiqueta: 'Descripción' },
  { id: 'cantidad', etiqueta: 'Cantidad' },
  { id: 'unidad', etiqueta: 'Unidad' },
  { id: 'costo', etiqueta: 'Precio / costo unitario' },
  { id: 'descuento', etiqueta: 'Descuento %' },
  { id: 'iva', etiqueta: 'IVA %' },
  { id: 'proveedor', etiqueta: 'Proveedor' }
];

const limpio = (valor) => String(valor ?? '').replace(/\s+/g, ' ').trim();
const normalizar = (valor) => limpio(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const numeroCompraImportada = (valor) => {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const texto = limpio(valor).replace(/[^\d.,+\-]/g, '');
  if (!texto || !/\d/.test(texto)) return null;
  const ultimaComa = texto.lastIndexOf(',');
  const ultimoPunto = texto.lastIndexOf('.');
  let normalizado = texto;
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    const decimal = Math.max(ultimaComa, ultimoPunto);
    normalizado = `${texto.slice(0, decimal).replace(/[.,]/g, '')}.${texto.slice(decimal + 1)}`;
  } else if (ultimaComa >= 0 || ultimoPunto >= 0) {
    const separador = ultimaComa >= 0 ? ',' : '.';
    const partes = texto.split(separador);
    const decimales = partes.at(-1) || '';
    normalizado = partes.length > 2 || (decimales.length === 3 && partes[0] !== '0')
      ? partes.join('')
      : `${partes.slice(0, -1).join('') || '0'}.${decimales}`;
  }
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
};

const patrones = {
  codigoProveedor: /cod(?:igo)?\.?\s*(?:del?\s*)?prov|referencia|ref\.?\s*prov/,
  codigo: /^(?:cod(?:igo)?|sku|ean|gtin|id\s*producto|articulo\s*n)/,
  descripcion: /descrip|detalle|denominacion|nombre\s*(?:del?\s*)?(?:producto|articulo)|^producto$|^articulo$/,
  cantidad: /^cant|cantidad|^qty$|^unidades$/,
  unidad: /^unidad$|^medida$|^u\.?m\.?$/,
  costo: /^precio\b|costo\s*(?:unit|neto)?|valor\s*unit|^p\.?\s*unit|^p\.?\s*u\.?$|^importe\s*unit/,
  descuento: /descuento|^dto|^desc\.?\s*%/,
  iva: /^iva|alicuota/,
  proveedor: /^proveedor$|^fabricante$/
};

export const detectarEncabezadoCompra = (matriz = []) => {
  let mejor = { indice: 0, puntaje: -1 };
  matriz.slice(0, 25).forEach((fila, indice) => {
    const textos = (fila || []).map(normalizar);
    const puntaje = textos.reduce((total, texto) => total + Object.values(patrones).some((patron) => patron.test(texto)) * 2, 0);
    if (puntaje > mejor.puntaje) mejor = { indice, puntaje };
  });
  if (mejor.puntaje > 0) return mejor.indice;
  return Math.max(0, matriz.findIndex((fila) => (fila || []).some((valor) => limpio(valor))));
};

export const columnasCompraImportada = (matriz = [], encabezado = 0) => {
  const ancho = Math.max(0, ...(matriz.slice(Math.max(0, encabezado), encabezado + 20).map((fila) => fila?.length || 0)));
  return Array.from({ length: ancho }, (_, indice) => ({
    indice,
    nombre: limpio(matriz[encabezado]?.[indice]) || `Columna ${indice + 1}`,
    ejemplo: limpio(matriz[encabezado + 1]?.[indice])
  }));
};

export const sugerirMapeoCompra = (columnas = []) => {
  const mapeo = Object.fromEntries(CAMPOS_IMPORTACION_COMPRA.map((campo) => [campo.id, '']));
  const usadas = new Set();
  for (const campo of [...CAMPOS_IMPORTACION_COMPRA].sort((a, b) => (a.id === 'codigoProveedor' ? -1 : b.id === 'codigoProveedor' ? 1 : 0))) {
    const columna = columnas.find(({ indice, nombre }) => !usadas.has(indice) && patrones[campo.id].test(normalizar(nombre)));
    if (columna) { mapeo[campo.id] = String(columna.indice); usadas.add(columna.indice); }
  }
  return mapeo;
};

export const obtenerValorCompraImportada = (fila = [], indice = '') => indice === '' || indice === null || indice === undefined
  ? ''
  : limpio(fila[Number(indice)]);

export const filasCompraImportada = (matriz = [], encabezado = 0) => matriz
  .map((valores, indice) => ({ indice, valores }))
  .filter(({ indice, valores }) => indice > encabezado && (valores || []).some((valor) => limpio(valor)));

export const esFilaTotalCompra = (fila = [], mapeo = {}) => {
  const descripcion = normalizar(obtenerValorCompraImportada(fila, mapeo.descripcion));
  return /^(?:sub\s*total|total|iva\s*\d|neto\s*gravado|percepcion|retencion)(?:\b|$)/.test(descripcion);
};

export async function leerArchivoCompraExcel(archivo) {
  if (!archivo) throw new Error('Seleccioná un archivo Excel.');
  if (archivo.size > 15 * 1024 * 1024) throw new Error('El Excel supera 15 MB. Dividilo en archivos más pequeños.');
  if (!/\.(xlsx|xls|xlsm|csv)$/i.test(archivo.name || '')) throw new Error('Usá un archivo .xlsx, .xls, .xlsm o .csv.');
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: false, dense: true, WTF: false });
  const hojas = (libro.SheetNames || []).map((nombre) => {
    const matriz = XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, defval: '', raw: false, blankrows: false })
      .map((fila) => (fila || []).map(limpio));
    if (matriz.length > 10000) throw new Error(`La hoja «${nombre}» supera 10.000 renglones. Dividí el archivo para revisarlo con seguridad.`);
    if (matriz.some((fila) => fila.length > 100)) throw new Error(`La hoja «${nombre}» supera 100 columnas. Quitá columnas innecesarias antes de cargarla.`);
    const encabezado = detectarEncabezadoCompra(matriz);
    const columnas = columnasCompraImportada(matriz, encabezado);
    return { nombre, matriz, encabezado, columnas, mapeo: sugerirMapeoCompra(columnas) };
  }).filter((hoja) => hoja.matriz.length);
  if (!hojas.length) throw new Error('El archivo no contiene hojas con datos.');
  return { nombreArchivo: archivo.name, hojas };
}
