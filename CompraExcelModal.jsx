import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, X } from 'lucide-react';
import {
  CAMPOS_IMPORTACION_COMPRA, columnasCompraImportada, sugerirMapeoCompra,
  filasCompraImportada, obtenerValorCompraImportada, numeroCompraImportada, esFilaTotalCompra
} from './compra-importacion.js';

export default function CompraExcelModal({ libro, onClose, onImportar }) {
  const [indiceHoja, setIndiceHoja] = useState(0);
  const hoja = libro.hojas[indiceHoja];
  const [encabezado, setEncabezado] = useState(hoja.encabezado);
  const [mapeo, setMapeo] = useState(hoja.mapeo);
  const [pagina, setPagina] = useState(0);
  const [seleccion, setSeleccion] = useState(() => new Set(filasCompraImportada(hoja.matriz, hoja.encabezado).map((fila) => fila.indice)));
  const columnas = useMemo(() => columnasCompraImportada(hoja.matriz, encabezado), [hoja, encabezado]);
  const filas = useMemo(() => filasCompraImportada(hoja.matriz, encabezado).filter(({ valores }) => !esFilaTotalCompra(valores, mapeo)), [hoja, encabezado, mapeo]);
  const paginas = Math.max(1, Math.ceil(filas.length / 100));
  const filasVisibles = filas.slice(Math.min(pagina, paginas - 1) * 100, (Math.min(pagina, paginas - 1) + 1) * 100);
  const seleccionadas = useMemo(() => filas.filter(({ indice }) => seleccion.has(indice)), [filas, seleccion]);
  const campo = (fila, id) => obtenerValorCompraImportada(fila, mapeo[id]);
  const revisar = (valores) => {
    if (!campo(valores, 'descripcion')) return 'Falta descripción';
    const cantidad = campo(valores, 'cantidad');
    if (cantidad && (!Number.isFinite(numeroCompraImportada(cantidad)) || numeroCompraImportada(cantidad) <= 0)) return 'Cantidad inválida';
    const costo = campo(valores, 'costo');
    if (costo && (!Number.isFinite(numeroCompraImportada(costo)) || numeroCompraImportada(costo) < 0)) return 'Precio inválido';
    for (const id of ['descuento', 'iva']) {
      const valor = campo(valores, id);
      if (valor && (!Number.isFinite(numeroCompraImportada(valor)) || numeroCompraImportada(valor) < 0 || numeroCompraImportada(valor) > 100)) return `${id.toUpperCase()} inválido`;
    }
    return '';
  };
  const errores = seleccionadas.filter(({ valores }) => revisar(valores));
  const sinPrecio = seleccionadas.filter(({ valores }) => !campo(valores, 'costo')).length;
  const columnasRepetidas = Object.values(mapeo).filter((indice) => indice !== '').some((indice, posicion, valores) => valores.indexOf(indice) !== posicion);

  useEffect(() => {
    setMapeo(sugerirMapeoCompra(columnas));
    setSeleccion(new Set(filasCompraImportada(hoja.matriz, encabezado).map((fila) => fila.indice)));
    setPagina(0);
  }, [encabezado, indiceHoja]);

  const cambiarHoja = (indice) => {
    const siguiente = libro.hojas[indice];
    setIndiceHoja(indice);
    setEncabezado(siguiente.encabezado);
  };
  const importar = () => {
    if (mapeo.descripcion === '' || columnasRepetidas || !seleccionadas.length || errores.length) return;
    const items = seleccionadas.map(({ indice, valores }) => {
      const numero = (id) => {
        const valor = campo(valores, id);
        return valor ? numeroCompraImportada(valor) : null;
      };
      return {
        filaExcel: indice + 1,
        codigo: campo(valores, 'codigo'),
        codigoProveedor: campo(valores, 'codigoProveedor'),
        descripcion: campo(valores, 'descripcion'),
        cantidad: numero('cantidad') ?? 1,
        unidad: campo(valores, 'unidad') || 'unid',
        costoPesos: numero('costo') === null ? '' : String(numero('costo')),
        costoExcelPendiente: numero('costo') === null,
        descuento: numero('descuento') === null ? '' : String(numero('descuento')),
        iva: numero('iva') === null ? '' : String(numero('iva')),
        proveedor: campo(valores, 'proveedor')
      };
    });
    onImportar(items);
  };

  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/60 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Importar compra desde Excel">
      <div className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2"><FileSpreadsheet size={22} className="shrink-0 text-emerald-700" /><div className="min-w-0"><h2 className="font-black text-slate-900">Cargar compra desde Excel</h2><p className="truncate text-xs text-slate-500">{libro.nombreArchivo}</p></div></div>
          <button type="button" onClick={onClose} aria-label="Cerrar importación" className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <p className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">Elegí la hoja, indicá qué columnas querés usar y revisá los renglones. No se modifica la compra hasta que pulses «Agregar a la compra».</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-700">Hoja
              <select value={indiceHoja} onChange={(e) => cambiarHoja(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2">
                {libro.hojas.map((item, indice) => <option key={indice} value={indice}>{item.nombre}</option>)}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-700">Fila de encabezados
              <select value={encabezado} onChange={(e) => setEncabezado(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2">
                <option value={-1}>Sin encabezados</option>
                {hoja.matriz.slice(0, 25).map((fila, indice) => <option key={indice} value={indice}>Fila {indice + 1}: {fila.filter(Boolean).slice(0, 4).join(' · ').slice(0, 95)}</option>)}
              </select>
            </label>
          </div>
          <div>
            <h3 className="mb-2 font-black text-slate-800">Columnas a cargar</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPOS_IMPORTACION_COMPRA.map(({ id, etiqueta }) => <label key={id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 p-2 text-xs font-bold text-slate-700">
                <input type="checkbox" checked={mapeo[id] !== ''} onChange={(e) => setMapeo((actual) => ({ ...actual, [id]: e.target.checked ? String(columnas[0]?.indice ?? '') : '' }))} className="h-4 w-4 shrink-0" />
                <span className="min-w-[80px] shrink-0">{etiqueta}</span>
                <select aria-label={`Columna para ${etiqueta}`} value={mapeo[id]} onChange={(e) => setMapeo((actual) => ({ ...actual, [id]: e.target.value }))} className="min-w-0 flex-1 rounded border border-slate-300 bg-white p-1" >
                  <option value="">No cargar</option>
                  {columnas.map((columna) => <option key={columna.indice} value={columna.indice}>{columna.nombre} {columna.ejemplo ? `(${columna.ejemplo.slice(0, 24)})` : ''}</option>)}
                </select>
              </label>)}
            </div>
            {mapeo.descripcion === '' && <p className="mt-2 text-xs font-bold text-amber-700">Elegí una columna de descripción para importar.</p>}
            {columnasRepetidas && <p className="mt-2 text-xs font-bold text-red-700">Una misma columna está asignada a más de un dato; corregí el mapeo.</p>}
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-slate-800">Vista previa · {seleccionadas.length} de {filas.length} renglones</h3><label className="text-xs font-bold"><input type="checkbox" checked={filas.length > 0 && seleccionadas.length === filas.length} onChange={(e) => setSeleccion(e.target.checked ? new Set(filas.map(({ indice }) => indice)) : new Set())} /> Seleccionar todos</label></div>
            <div className="max-h-[38dvh] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs"><thead className="sticky top-0 z-10 bg-slate-900 text-white"><tr><th className="p-2">✓</th><th className="p-2">Fila</th><th className="p-2">Código</th><th className="p-2">Descripción</th><th className="p-2">Cantidad</th><th className="p-2">Precio</th><th className="p-2">Revisión</th></tr></thead><tbody>
                {filasVisibles.map(({ indice, valores }) => <tr key={indice} className="border-t border-slate-100 even:bg-slate-50"><td className="p-2"><input type="checkbox" checked={seleccion.has(indice)} onChange={(e) => setSeleccion((actual) => { const siguiente = new Set(actual); e.target.checked ? siguiente.add(indice) : siguiente.delete(indice); return siguiente; })} /></td><td className="p-2">{indice + 1}</td><td className="p-2">{campo(valores, 'codigo') || campo(valores, 'codigoProveedor')}</td><td className="p-2">{campo(valores, 'descripcion')}</td><td className="p-2">{campo(valores, 'cantidad') || '1 (predet.)'}</td><td className="p-2">{campo(valores, 'costo') || 'Pendiente'}</td><td className="p-2 font-bold text-amber-700">{revisar(valores) || (!campo(valores, 'costo') ? 'Completar precio' : '')}</td></tr>)}
              </tbody></table>
              {!filas.length && <p className="p-4 text-center text-slate-500">No hay renglones debajo del encabezado.</p>}
            </div>
            {paginas > 1 && <div className="mt-2 flex items-center justify-end gap-3 text-xs font-bold"><button type="button" disabled={pagina === 0} onClick={() => setPagina((actual) => Math.max(0, actual - 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Anterior</button><span>Página {Math.min(pagina, paginas - 1) + 1} de {paginas}</span><button type="button" disabled={pagina >= paginas - 1} onClick={() => setPagina((actual) => Math.min(paginas - 1, actual + 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Siguiente</button></div>}
          </div>
          {errores.length > 0 && <p className="rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700">Hay {errores.length} renglón(es) seleccionados con datos inválidos. Corregí el mapeo o destildalos.</p>}
          {sinPrecio > 0 && <p className="rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-800">{sinPrecio} renglón(es) sin precio. Podés agregarlos, pero tendrás que completar esos precios antes de guardar la compra.</p>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-white p-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700">Cancelar</button><button type="button" onClick={importar} disabled={mapeo.descripcion === '' || columnasRepetidas || !seleccionadas.length || errores.length > 0} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40">Agregar {seleccionadas.length} a la compra</button></div>
      </div>
    </div>
  );
}
