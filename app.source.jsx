import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Wallet, TrendingUp, TrendingDown, Store, Plus, Minus, X, Lock, Unlock,
  Clock, FileText, AlertCircle, CreditCard, Users, Phone, ArrowRight, Edit2, 
  Trash2, Save, PlusCircle, Calendar, Filter, Printer, BarChart2, FileSpreadsheet, 
  LogOut, User, UserCog, UserPlus, ShieldCheck, Settings, Image as ImageIcon,
  Search, Loader2, ClipboardList, Send, FilePlus2, CheckCircle, XCircle, Package,
  Eye, EyeOff, Copy,
  Camera, ScanBarcode, ArrowDownCircle, Mail, MapPin, Globe, History, Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- INTEGRACIÓN FIREBASE ---
import { auth, db } from './firebase-config.js';
import { signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { collection, doc, setDoc, onSnapshot, deleteDoc, updateDoc, addDoc, increment } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

// --- FUNCIONES UTILITARIAS ---
const formatearDinero = (monto) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(monto);
const formatearCantidad = (valor) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(valor) || 0);
const formatearPorcentaje = (valor) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(valor) || 0);
const formatearHora = (fecha) => new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(fecha));
const formatearFecha = (fecha) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(fecha));
const parseNumeroBasico = (valor) => parseFloat((valor ?? '').toString().replace(',', '.')) || 0;
const normalizarTextoBusqueda = (valor = '') => valor.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const normalizarMetodoPago = (valor = '') => normalizarTextoBusqueda(valor).replace(/\s+/g, '_');
const normalizarCodigoParaComparar = (valor = '') => (valor ?? '').toString().trim().toLowerCase();
const BNA_COTIZACION_URL = 'https://www.bna.com.ar/Personas';
const BNA_CORS_URLS = [
  BNA_COTIZACION_URL,
  `https://api.allorigins.win/raw?url=${encodeURIComponent(BNA_COTIZACION_URL)}`,
  `https://corsproxy.io/?${encodeURIComponent(BNA_COTIZACION_URL)}`
];
const normalizarNumeroCotizacion = (valor = '') => {
  const texto = (valor ?? '').toString().trim().replace(/[^\d.,-]/g, '');
  if (!texto) return 0;
  if (texto.includes(',')) return parseFloat(texto.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(texto.replace(/,/g, '')) || 0;
};
const extraerCotizacionDolarBna = (html = '') => {
  const textoHtml = (html || '').toString();
  if (!textoHtml) return null;

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(textoHtml, 'text/html');
    const filas = Array.from(doc.querySelectorAll('#billetes table.cotizacion tbody tr'));
    const filaDolar = filas.find((fila) => normalizarTextoBusqueda(fila.querySelector('.tit')?.textContent || '').includes('dolar'));
    if (filaDolar) {
      const celdas = Array.from(filaDolar.querySelectorAll('td')).map((td) => td.textContent.trim());
      const venta = normalizarNumeroCotizacion(celdas[2] || '');
      if (venta > 0) {
        const fecha = doc.querySelector('#billetes .fechaCot')?.textContent?.trim() || '';
        const hora = Array.from(doc.querySelectorAll('#billetes .legal'))
          .map((node) => node.textContent.trim())
          .find((linea) => /hora/i.test(linea)) || '';
        return { venta, compra: normalizarNumeroCotizacion(celdas[1] || ''), fecha, hora, fuente: BNA_COTIZACION_URL };
      }
    }
  }

  const match = textoHtml.match(/Dolar\s*U\.?S\.?A[\s\S]{0,180}?<td[^>]*>\s*([\d.,]+)\s*<\/td>[\s\S]{0,80}?<td[^>]*>\s*([\d.,]+)\s*<\/td>/i);
  const venta = normalizarNumeroCotizacion(match?.[2] || '');
  if (venta <= 0) return null;
  const fecha = textoHtml.match(/class=["']fechaCot["'][^>]*>\s*([^<]+)/i)?.[1]?.trim() || '';
  const hora = textoHtml.match(/Hora\s+Actualizaci[oó]n:\s*([0-9:]+)/i)?.[0]?.trim() || '';
  return { venta, compra: normalizarNumeroCotizacion(match?.[1] || ''), fecha, hora, fuente: BNA_COTIZACION_URL };
};
const esRecargoMoraMovimiento = (mov = null) => {
  if (!mov) return false;
  if (mov.tipo === 'recargo_mora') return true;
  return Boolean(mov?.detallesPago?.esRecargoMora);
};
const esMovimientoCargoCuentaCorriente = (mov = null) => {
  if (!mov) return false;
  if (mov.tipo === 'saldo_inicial_cc') return true;
  if (esRecargoMoraMovimiento(mov)) return normalizarMetodoPago(mov.metodoPago) === 'cuenta_corriente';
  return (mov.tipo === 'venta' || mov.tipo === 'ingreso_extra') && normalizarMetodoPago(mov.metodoPago) === 'cuenta_corriente';
};
const DESCRIPCIONES_VENTA_PREESTABLECIDAS = ['Remito X', 'Factura A', 'Factura B'];
const OFERTA_TEMPLATE_BASE_URL = './oferta-template-base.jpg';
const FORM_USUARIO_VACIO = {
  nombre: '',
  username: '',
  password: '',
  rol: 'cajero',
  puedeVerClientesEspeciales: false,
  puedeUsarCombos: false,
  puedeCargarCuentaHistorica: false
};
const OPCIONES_COMPROBANTE_HISTORICO = [
  { value: 'remito_x', label: 'Remito X' },
  { value: 'factura_a', label: 'Factura A' },
  { value: 'factura_b', label: 'Factura B' }
];
const normalizarTipoComprobanteHistorico = (valor = '') => {
  const key = normalizarTextoBusqueda(valor).replace(/\s+/g, '_');
  if (key === 'factura' || key === 'factura_a') return 'factura_a';
  if (key === 'factura_b') return 'factura_b';
  if (key === 'remito' || key === 'remito_x') return 'remito_x';
  return 'remito_x';
};
const obtenerEtiquetaTipoComprobanteHistorico = (valor = '') => {
  const key = normalizarTipoComprobanteHistorico(valor);
  return OPCIONES_COMPROBANTE_HISTORICO.find((op) => op.value === key)?.label || 'Remito X';
};
const crearFormularioProducto = (producto = {}) => ({
  codigo: producto?.codigo ?? '',
  categoria: producto?.categoria ?? '',
  marca: producto?.marca ?? '',
  descripcion: producto?.descripcion ?? '',
  detalles: producto?.detalles ?? '',
  costo: (producto?.monedaCosto === 'USD_BNA' && producto?.costoOriginal !== undefined)
    ? producto?.costoOriginal
    : (producto?.costo ?? ''),
  ganancia: producto?.ganancia ?? '',
  iva: producto?.iva ?? '21',
  precio: producto?.precio ?? '',
  unidad: producto?.unidad ?? 'unid',
  cantidad: producto?.cantidad ?? '',
  imagen: producto?.imagen ?? '',
  logoMarca: producto?.logoMarca ?? '',
  monedaCosto: producto?.monedaCosto ?? 'ARS',
  costoOriginal: producto?.costoOriginal ?? producto?.costo ?? '',
  cotizacionDolarBna: producto?.cotizacionDolarBna ?? '',
  cotizacionDolarBnaFecha: producto?.cotizacionDolarBnaFecha ?? '',
  cotizacionDolarBnaHora: producto?.cotizacionDolarBnaHora ?? '',
  generarCodigoAutomatico: Boolean(producto?.generarCodigoAutomatico)
});
const formatearTextoDias = (dias = 0) => {
  const n = Math.max(0, Number.isFinite(Number(dias)) ? Number(dias) : 0);
  return `${n} día${n === 1 ? '' : 's'}`;
};
const recortarTexto = (texto = '', max = 120) => {
  const limpio = (texto || '').toString().trim();
  if (!limpio) return '';
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, Math.max(0, max - 3)).trim()}...`;
};
const textoSeguro = (valor, fallback = '') => {
  if (valor === null || valor === undefined) return fallback;
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return fallback;
};
const textoSeguroTrim = (valor, fallback = '') => {
  const limpio = textoSeguro(valor, '').trim();
  return limpio || fallback;
};
const MS_POR_DIA = 1000 * 60 * 60 * 24;
const CONTACTO_NEGOCIO_FALLBACK = {
  direccion: 'Avenida San Martin 646',
  web: 'www.mundoledchaco.com',
  whatsapp: '3735506858',
  correo: 'info@mundoledchaco.com'
};
const NOMBRE_EMPRESA_FALLBACK = 'MUNDOLED';
const CONFIG_DEFAULT = {
  nombre: NOMBRE_EMPRESA_FALLBACK,
  logo: '',
  direccion: CONTACTO_NEGOCIO_FALLBACK.direccion,
  web: CONTACTO_NEGOCIO_FALLBACK.web,
  whatsapp: CONTACTO_NEGOCIO_FALLBACK.whatsapp,
  correo: CONTACTO_NEGOCIO_FALLBACK.correo,
  pagoAlias: 'mundoled1',
  pagoCbu: '',
  pagoTitular: 'POLINI MAURO MAXIMILIANO',
  pagoBanco: 'Mercado Pago',
  pagoDetalle: '',
  recargoMoraPorcentaje: 0,
  recargosAutomaticosActivos: false,
  recargoMoraPorcentajeGlobal: 0,
  recorteIaApiKey: '',
  ofertaIaEndpoint: '',
  ofertaIaToken: ''
};
const LOGO_EMPRESA_FALLBACK_URL = './logo-empresa-mundoled.png';
const LOGO_RECIBO_PREMIUM_URL = './logo-ofertas-mundoled-white.png';
const RECORTE_IA_ENDPOINT = 'https://api.remove.bg/v1.0/removebg';
const RECORTE_IA_TIMEOUT_MS = 45000;
const OFERTA_IA_TIMEOUT_MS = 90000;
const PALABRAS_CLIENTE_INSTITUCIONAL = ['municipalidad', 'municipalidades', 'comuna', 'comunas'];
const esNombreClienteInstitucional = (nombre = '') => {
  const nombreNormalizado = normalizarTextoBusqueda(nombre);
  if (!nombreNormalizado) return false;
  return PALABRAS_CLIENTE_INSTITUCIONAL.some((palabra) => nombreNormalizado.includes(palabra));
};
const esClienteEspecial = (cliente = null) => {
  if (!cliente) return false;
  if (typeof cliente.esEspecial === 'boolean') return cliente.esEspecial;
  return esNombreClienteInstitucional(cliente?.nombre || '');
};
const obtenerContactoNegocio = (config = {}) => ({
  direccion: textoSeguroTrim(config?.direccion, CONTACTO_NEGOCIO_FALLBACK.direccion),
  web: textoSeguroTrim(config?.web, CONTACTO_NEGOCIO_FALLBACK.web),
  whatsapp: textoSeguroTrim(config?.whatsapp, CONTACTO_NEGOCIO_FALLBACK.whatsapp),
  correo: textoSeguroTrim(config?.correo, CONTACTO_NEGOCIO_FALLBACK.correo)
});
const construirContactoNegocioPdf = (config = {}, opciones = {}) => {
  const { incluirDireccion = false } = opciones;
  const contacto = obtenerContactoNegocio(config);
  const partes = [];
  if (incluirDireccion && contacto.direccion) partes.push(contacto.direccion);
  if (contacto.web) partes.push(`Web: ${contacto.web}`);
  if (contacto.whatsapp) partes.push(`WhatsApp: ${contacto.whatsapp}`);
  if (contacto.correo) partes.push(`Correo: ${contacto.correo}`);
  return partes;
};
const calcularRecargoMoraTicket = ({ montoBase = 0, fecha = null, porcentajePorTramo = 0 }) => {
  const base = Math.max(0, Number(montoBase) || 0);
  const porcentaje = Math.max(0, Number(porcentajePorTramo) || 0);
  const fechaTicket = new Date(fecha);
  const esFechaValida = Number.isFinite(fechaTicket.getTime());
  const diasImpago = esFechaValida ? Math.max(0, Math.floor((Date.now() - fechaTicket.getTime()) / MS_POR_DIA)) : 0;
  const tramos = diasImpago >= 30 ? Math.floor(diasImpago / 30) : 0;
  const recargo = base > 0 && porcentaje > 0 && tramos > 0
    ? base * (porcentaje / 100) * tramos
    : 0;
  return {
    diasImpago,
    tramos,
    recargo,
    totalConRecargo: base + recargo
  };
};
const obtenerPorcentajeRecargoConfigurado = (config = {}) => {
  const preferido = config?.recargoMoraPorcentajeGlobal;
  if (preferido !== null && preferido !== undefined && preferido !== '') {
    return Math.max(0, parseNumeroBasico(preferido));
  }
  return Math.max(0, parseNumeroBasico(config?.recargoMoraPorcentaje));
};
const obtenerEtiquetaMetodoPago = (metodo = '') => {
  const key = normalizarMetodoPago(metodo);
  if (key === 'efectivo') return 'Efectivo';
  if (key === 'transferencia') return 'Transferencia';
  if (key === 'tarjeta') return 'Tarjeta';
  if (key === 'cheque') return 'Cheque';
  if (key === 'cuenta_corriente') return 'Cuenta corriente';
  return textoSeguroTrim(metodo, 'No especificado');
};
const generarNumeroReciboCobro = (fecha = null) => {
  const base = fecha ? new Date(fecha) : new Date();
  if (!Number.isFinite(base.getTime())) return `RC-${Date.now()}`;
  const yy = String(base.getFullYear()).slice(-2);
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  const hh = String(base.getHours()).padStart(2, '0');
  const min = String(base.getMinutes()).padStart(2, '0');
  return `RC-${dd}${mm}${yy}-${hh}${min}`;
};

const numeroALetras = (numero) => {
  if (!numero || isNaN(numero) || numero < 0) return '';
  const enteros = Math.floor(numero);
  const centavos = Math.round((numero - enteros) * 100);

  const unidades = (num) => {
      switch(num) {
          case 1: return 'UN'; case 2: return 'DOS'; case 3: return 'TRES'; case 4: return 'CUATRO'; case 5: return 'CINCO';
          case 6: return 'SEIS'; case 7: return 'SIETE'; case 8: return 'OCHO'; case 9: return 'NUEVE'; default: return '';
      }
  };
  const decenas = (num) => {
      const decena = Math.floor(num/10); const unidad = num - (decena*10);
      switch(decena) {
          case 1:
              switch(unidad) { case 0: return 'DIEZ'; case 1: return 'ONCE'; case 2: return 'DOCE'; case 3: return 'TRECE'; case 4: return 'CATORCE'; case 5: return 'QUINCE'; default: return 'DIECI' + unidades(unidad); }
          case 2: return unidad === 0 ? 'VEINTE' : 'VEINTI' + unidades(unidad);
          case 3: return unidades(unidad) === '' ? 'TREINTA' : 'TREINTA Y ' + unidades(unidad);
          case 4: return unidades(unidad) === '' ? 'CUARENTA' : 'CUARENTA Y ' + unidades(unidad);
          case 5: return unidades(unidad) === '' ? 'CINCUENTA' : 'CINCUENTA Y ' + unidades(unidad);
          case 6: return unidades(unidad) === '' ? 'SESENTA' : 'SESENTA Y ' + unidades(unidad);
          case 7: return unidades(unidad) === '' ? 'SETENTA' : 'SETENTA Y ' + unidades(unidad);
          case 8: return unidades(unidad) === '' ? 'OCHENTA' : 'OCHENTA Y ' + unidades(unidad);
          case 9: return unidades(unidad) === '' ? 'NOVENTA' : 'NOVENTA Y ' + unidades(unidad);
          case 0: return unidades(unidad);
      }
  };
  const centenas = (num) => {
      const centena = Math.floor(num / 100); const decena = num - (centena * 100);
      switch(centena) {
          case 1: return decena === 0 ? 'CIEN' : 'CIENTO ' + decenas(decena);
          case 2: return 'DOSCIENTOS ' + decenas(decena); case 3: return 'TRESCIENTOS ' + decenas(decena); case 4: return 'CUATROCIENTOS ' + decenas(decena);
          case 5: return 'QUINIENTOS ' + decenas(decena); case 6: return 'SEISCIENTOS ' + decenas(decena); case 7: return 'SETECIENTOS ' + decenas(decena);
          case 8: return 'OCHOCIENTOS ' + decenas(decena); case 9: return 'NOVECIENTOS ' + decenas(decena); default: return decenas(decena);
      }
  };
  const miles = (num) => {
      const divisor = 1000; const cientos = Math.floor(num / divisor); const resto = num - (cientos * divisor);
      const strMiles = centenas(cientos); const strCentenas = centenas(resto);
      if (cientos === 0) return strCentenas;
      if (cientos === 1) return 'MIL ' + strCentenas;
      return strMiles + ' MIL ' + strCentenas;
  };
  const millones = (num) => {
      const divisor = 1000000; const mill = Math.floor(num / divisor); const resto = num - (mill * divisor);
      const strMillones = centenas(mill); const strMiles = miles(resto);
      if (mill === 0) return strMiles;
      if (mill === 1) return 'UN MILLON ' + strMiles;
      return strMillones + ' MILLONES ' + strMiles;
  };

  const strEnteros = enteros === 0 ? 'CERO' : millones(enteros).trim();
  return `${strEnteros} PESOS CON ${centavos.toString().padStart(2, '0')}/100 CENTAVOS`;
};

const PAGINA_CATALOGO_ITEMS = 9;
const construirPaginasCatalogo = (grupos = []) => {
  const paginas = [];
  grupos.forEach((grupo) => {
    const itemsGrupo = Array.isArray(grupo?.items) ? grupo.items : [];
    if (!itemsGrupo.length) return;

    const totalBloques = Math.ceil(itemsGrupo.length / PAGINA_CATALOGO_ITEMS);
    for (let i = 0; i < itemsGrupo.length; i += PAGINA_CATALOGO_ITEMS) {
      paginas.push({
        categoria: grupo?.categoria || 'Sin categoría',
        items: itemsGrupo.slice(i, i + PAGINA_CATALOGO_ITEMS),
        bloque: Math.floor(i / PAGINA_CATALOGO_ITEMS) + 1,
        totalBloques
      });
    }
  });
  return paginas;
};

const PAGINA_OFERTA_ITEMS = 6;
const construirPaginasOferta = (items = []) => {
  const paginas = [];
  for (let i = 0; i < items.length; i += PAGINA_OFERTA_ITEMS) {
    paginas.push({
      items: items.slice(i, i + PAGINA_OFERTA_ITEMS),
      pagina: Math.floor(i / PAGINA_OFERTA_ITEMS) + 1,
      totalPaginas: Math.ceil(items.length / PAGINA_OFERTA_ITEMS)
    });
  }
  return paginas;
};

const PAGINA_OFERTA_FLYER_ITEMS = 4;
const construirPaginasOfertaFlyer = (items = []) => {
  const lista = Array.isArray(items) ? items : [];
  if (!lista.length) return [{ items: [] }];
  if (lista.length === 1) return [{ items: [lista[0]] }];
  const paginas = [];
  for (let i = 0; i < lista.length; i += PAGINA_OFERTA_FLYER_ITEMS) {
    paginas.push({ items: lista.slice(i, i + PAGINA_OFERTA_FLYER_ITEMS) });
  }
  return paginas;
};

const PAGINA_COMBO_ITEMS = 8;
const construirPaginasCombo = (items = []) => {
  const lista = Array.isArray(items) ? items : [];
  if (!lista.length) {
    return [{ items: [], esPrimera: true, esFinal: true, pagina: 1, totalPaginas: 1 }];
  }

  if (lista.length === 1) {
    return [{ items: lista, esPrimera: true, esFinal: true, pagina: 1, totalPaginas: 1 }];
  }

  const capacidadUnaPagina = PAGINA_COMBO_ITEMS;
  const capacidadPrimeraSinTotales = PAGINA_COMBO_ITEMS;
  const capacidadIntermedia = 11;
  const capacidadFinal = 9;

  if (lista.length <= capacidadUnaPagina) {
    return [{ items: lista, esPrimera: true, esFinal: true, pagina: 1, totalPaginas: 1 }];
  }

  const paginas = [];
  let cursor = 0;
  const cantidadPrimera = Math.min(capacidadPrimeraSinTotales, Math.max(1, lista.length - 1));
  paginas.push({ items: lista.slice(cursor, cursor + cantidadPrimera), esPrimera: true, esFinal: false });
  cursor += cantidadPrimera;

  let restantes = Math.max(0, lista.length - cursor);
  while (restantes > capacidadFinal) {
    const cantidadIntermedia = Math.min(capacidadIntermedia, Math.max(1, restantes - capacidadFinal));
    paginas.push({ items: lista.slice(cursor, cursor + cantidadIntermedia), esPrimera: false, esFinal: false });
    cursor += cantidadIntermedia;
    restantes = Math.max(0, lista.length - cursor);
  }

  paginas.push({ items: lista.slice(cursor), esPrimera: false, esFinal: true });
  const totalPaginas = paginas.length;
  return paginas.map((pagina, idx) => ({
    ...pagina,
    esPrimera: idx === 0,
    esFinal: idx === totalPaginas - 1,
    pagina: idx + 1,
    totalPaginas
  }));
};

const construirPaginasPresupuesto = (items = [], incluirImagenes = false, notas = '') => {
  const lista = Array.isArray(items) ? items : [];
  const notasTexto = (notas || '').toString();
  const capacidadUnaPagina = incluirImagenes ? 6 : 11;
  const capacidadPrimeraSinTotales = incluirImagenes ? 10 : 19;
  const capacidadIntermedia = incluirImagenes ? 13 : 30;
  const capacidadFinalBase = incluirImagenes ? 6 : 10;
  const lineasNotasEstimadas = notasTexto ? Math.ceil(notasTexto.length / 95) : 0;
  const ajusteNotas = Math.min(3, Math.max(0, Math.ceil(lineasNotasEstimadas / 3)));
  const capacidadFinal = Math.max(3, capacidadFinalBase - ajusteNotas);

  if (!lista.length) {
    return [{ items: [], esPrimera: true, esFinal: true, pagina: 1, totalPaginas: 1 }];
  }

  if (lista.length <= capacidadUnaPagina) {
    return [{ items: lista, esPrimera: true, esFinal: true, pagina: 1, totalPaginas: 1 }];
  }

  const paginas = [];

  let cursor = 0;
  const cantidadPrimera = Math.min(capacidadPrimeraSinTotales, Math.max(1, lista.length - 1));
  paginas.push({ items: lista.slice(cursor, cursor + cantidadPrimera), esPrimera: true, esFinal: false });
  cursor += cantidadPrimera;

  let restantes = Math.max(0, lista.length - cursor);
  while (restantes > capacidadFinal) {
    const cantidadIntermedia = Math.min(capacidadIntermedia, Math.max(1, restantes - capacidadFinal));
    paginas.push({ items: lista.slice(cursor, cursor + cantidadIntermedia), esPrimera: false, esFinal: false });
    cursor += cantidadIntermedia;
    restantes = Math.max(0, lista.length - cursor);
  }

  paginas.push({ items: lista.slice(cursor), esPrimera: false, esFinal: true });
  const totalPaginas = paginas.length;
  return paginas.map((pagina, idx) => ({ ...pagina, esPrimera: idx === 0, esFinal: idx === totalPaginas - 1, pagina: idx + 1, totalPaginas }));
};

const crearFormularioPresupuestoVacio = () => ({
  id: null,
  esNuevoCliente: false,
  clienteId: '',
  busquedaCliente: '',
  clienteNombre: '',
  whatsapp: '',
  items: [],
  notas: '',
  estado: 'borrador',
  descuentoGeneral: '',
  numero: null,
  aplicaFleteCosto: false,
  fletePorcentaje: ''
});

const obtenerFechaInputLocal = (fecha = new Date()) => {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const ajuste = d.getTime() - (d.getTimezoneOffset() * 60000);
  return new Date(ajuste).toISOString().slice(0, 10);
};

const esFechaInputValida = (valor = '') => /^\d{4}-\d{2}-\d{2}$/.test((valor || '').toString().trim());

const sumarDiasFechaInputLocal = (fechaInput = '', dias = 0) => {
  const base = esFechaInputValida(fechaInput)
    ? new Date(`${fechaInput}T12:00:00`)
    : new Date();
  if (Number.isNaN(base.getTime())) return obtenerFechaInputLocal();
  base.setDate(base.getDate() + (Number.isFinite(Number(dias)) ? Number(dias) : 0));
  return obtenerFechaInputLocal(base);
};

const obtenerRangoVigenciaOfertaDefault = () => {
  const desde = obtenerFechaInputLocal();
  return {
    desde,
    hasta: sumarDiasFechaInputLocal(desde, 7)
  };
};

const formatearFechaInputLocal = (fechaInput = '') => {
  if (!esFechaInputValida(fechaInput)) return '';
  return formatearFecha(new Date(`${fechaInput}T12:00:00`));
};

const crearFormularioCargaCuentaVacio = () => ({
  modoCliente: 'existente',
  clienteId: '',
  busquedaCliente: '',
  nombreClienteNuevo: '',
  whatsapp: '',
  documento: '',
  email: '',
  direccion: '',
  tipoComprobante: 'remito_x',
  numeroComprobante: '',
  monto: '',
  fechaComprobante: obtenerFechaInputLocal(),
  descripcion: ''
});

const crearFormularioRecargoVacio = (porcentajeDefault = 0) => ({
  cargoId: '',
  porcentaje: porcentajeDefault > 0 ? porcentajeDefault.toFixed(2) : ''
});

// --- COMPONENTES UI ---
const WidgetCard = ({ titulo, monto, icono: Icono, colorClase, subtitulo, onClick, activo, activeClass, printOculto, formato = 'dinero', sufijo = '' }) => (
  <div onClick={onClick} className={`bg-white p-4 rounded-2xl shadow-sm border flex items-center justify-between transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''} ${activo ? (activeClass || 'ring-2 ring-blue-500 border-transparent') : 'border-gray-100'} ${printOculto ? 'print:hidden' : 'print:border-gray-300 print:shadow-none print:p-2'}`}>
    <div className="min-w-0 pr-2">
      <p className="text-sm font-medium text-gray-500 mb-1 leading-tight print:text-black">{titulo}</p>
      <h3 className={`text-xl sm:text-2xl font-bold leading-tight ${colorClase} print:text-black`}>
        {formato === 'numero' ? formatearCantidad(monto) : formatearDinero(monto)}
        {formato === 'numero' && sufijo ? <span className="text-sm sm:text-base font-bold text-gray-500 ml-1">{sufijo}</span> : null}
      </h3>
      {subtitulo && <p className="text-xs text-gray-400 mt-1 leading-tight print:text-black">{subtitulo}</p>}
    </div>
    <div className={`p-3 rounded-full shrink-0 print:hidden ${colorClase.replace('text-', 'bg-').replace('600', '100').replace('900', '100')}`}>
      <Icono size={24} className={colorClase} />
    </div>
  </div>
);

const Modal = ({ titulo, children, onClose, customWidth = 'max-w-md', extraClases = '' }) => (
  <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden ${extraClases}`}>
    <div className={`bg-white rounded-2xl shadow-xl w-full ${customWidth} overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]`}>
      <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0 bg-white">
        <h2 className="text-lg font-bold text-gray-800">{titulo}</h2>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
        )}
      </div>
      <div className="p-5 overflow-y-auto custom-scrollbar">{children}</div>
    </div>
  </div>
);

export default function App() {
  // --- ESTADOS DE FIREBASE ---
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isDBReady, setIsDBReady] = useState(false);

  // --- ESTADOS DE LA APP ---
  const [configuracion, setConfiguracion] = useState(CONFIG_DEFAULT);
  const [usuarios, setUsuarios] = useState([]);
  const [caja, setCaja] = useState({ estado: 'cerrada', efectivoInicial: 0, chequesInicial: 0, fechaApertura: null });
  const [movimientos, setMovimientos] = useState([]);
  const [clientes, setClientes] = useState([]); 
  const [presupuestos, setPresupuestos] = useState([]); 
  const [productos, setProductos] = useState([]); 
  
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '', error: '' });
  const [vista, setVista] = useState('caja'); 
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null); 
  const [modalActivo, setModalActivo] = useState(null); 
  const [movimientoAEditar, setMovimientoAEditar] = useState(null); 
  const [movimientoAEliminar, setMovimientoAEliminar] = useState(null); 
  const [reciboCobroSeleccionado, setReciboCobroSeleccionado] = useState(null);

  const [formData, setFormData] = useState({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} });
  const [montoCierreReal, setMontoCierreReal] = useState('');
  
  const [formUsuario, setFormUsuario] = useState(FORM_USUARIO_VACIO);
  const [usuarioAEditar, setUsuarioAEditar] = useState(null);
  const formularioClienteVacio = { nombre: '', whatsapp: '', documento: '', email: '', direccion: '', notas: '', esEspecial: false };
  const [formCliente, setFormCliente] = useState(formularioClienteVacio);
  const [clienteAEditar, setClienteAEditar] = useState(null);
  const [formCargaCuenta, setFormCargaCuenta] = useState(() => crearFormularioCargaCuentaVacio());
  const [formRecargoCliente, setFormRecargoCliente] = useState(() => crearFormularioRecargoVacio(CONFIG_DEFAULT.recargoMoraPorcentajeGlobal));
  
  const [formProducto, setFormProducto] = useState(crearFormularioProducto());
  const [productoAEditar, setProductoAEditar] = useState(null);
  const [cotizacionDolarBna, setCotizacionDolarBna] = useState(null);
  const [cotizacionDolarBnaEstado, setCotizacionDolarBnaEstado] = useState('');
  const [cotizacionDolarBnaCargando, setCotizacionDolarBnaCargando] = useState(false);
  const [catalogoAImprimir, setCatalogoAImprimir] = useState(null);
  const [configExportInventario, setConfigExportInventario] = useState({ tipo: 'catalogo_pdf', alcance: 'general', categoria: '', incluirLogoMarca: true });
  const [archivoImportacionInventario, setArchivoImportacionInventario] = useState(null);
  const [importandoInventario, setImportandoInventario] = useState(false);
  const [resumenImportacionInventario, setResumenImportacionInventario] = useState(null);
  const [gestionTaxonomiaBusy, setGestionTaxonomiaBusy] = useState('');
  const [categoriaEnEdicion, setCategoriaEnEdicion] = useState('');
  const [categoriaEditValor, setCategoriaEditValor] = useState('');
  const [marcaEnEdicion, setMarcaEnEdicion] = useState('');
  const [marcaEditValor, setMarcaEditValor] = useState('');

  const [filtroTipo, setFiltroTipo] = useState('todos'); 
  const [fechaDesde, setFechaDesde] = useState(() => obtenerFechaInputLocal());
  const [fechaHasta, setFechaHasta] = useState(() => obtenerFechaInputLocal());
  const [reporteTipo, setReporteTipo] = useState('general'); 
  const [reporteTiempo, setReporteTiempo] = useState('todo'); 
  const [reporteMesSeleccionado, setReporteMesSeleccionado] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reporteFechaDesdeReporte, setReporteFechaDesdeReporte] = useState('');
  const [reporteFechaHastaReporte, setReporteFechaHastaReporte] = useState('');

  const [busquedaDirectorio, setBusquedaDirectorio] = useState('');
  const [mostrarSoloConSaldoPendiente, setMostrarSoloConSaldoPendiente] = useState(false);
  const [busquedaPresupuestos, setBusquedaPresupuestos] = useState('');
  const [busquedaInventario, setBusquedaInventario] = useState('');
  const [busquedaOfertas, setBusquedaOfertas] = useState('');
  const [busquedaStockModal, setBusquedaStockModal] = useState('');
  const [ofertaTitulo, setOfertaTitulo] = useState('Ofertas Especiales');
  const [ofertaAclaraciones, setOfertaAclaraciones] = useState('');
  const [ofertaVigenciaDesde, setOfertaVigenciaDesde] = useState(() => obtenerRangoVigenciaOfertaDefault().desde);
  const [ofertaVigenciaHasta, setOfertaVigenciaHasta] = useState(() => obtenerRangoVigenciaOfertaDefault().hasta);
  const [ofertaEditorActivo, setOfertaEditorActivo] = useState(false);
  const [ofertaSeleccionIds, setOfertaSeleccionIds] = useState([]);
  const [ofertaPrecios, setOfertaPrecios] = useState({});
  const [ofertaAImprimir, setOfertaAImprimir] = useState(null);
  const [ofertaPreviewImagenes, setOfertaPreviewImagenes] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [ofertaEditandoId, setOfertaEditandoId] = useState(null);
  const [busquedaOfertasGuardadas, setBusquedaOfertasGuardadas] = useState('');
  const [combos, setCombos] = useState([]);
  const [comboTitulo, setComboTitulo] = useState('Combo Especial');
  const [comboAclaraciones, setComboAclaraciones] = useState('');
  const [comboEditorActivo, setComboEditorActivo] = useState(false);
  const [comboSeleccionIds, setComboSeleccionIds] = useState([]);
  const [comboPrecios, setComboPrecios] = useState({});
  const [comboCantidades, setComboCantidades] = useState({});
  const [comboMostrarPrecioItem, setComboMostrarPrecioItem] = useState(true);
  const [comboMostrarLogoMarca, setComboMostrarLogoMarca] = useState(true);
  const [comboAImprimir, setComboAImprimir] = useState(null);
  const [comboEditandoId, setComboEditandoId] = useState(null);
  const [busquedaCombosProductos, setBusquedaCombosProductos] = useState('');
  const [busquedaCombosGuardados, setBusquedaCombosGuardados] = useState('');
  const [presupuestosGananciaVisible, setPresupuestosGananciaVisible] = useState({});
  const [combosGananciaVisible, setCombosGananciaVisible] = useState({});

  const [formPresupuesto, setFormPresupuesto] = useState(() => crearFormularioPresupuestoVacio());
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState(null);
  const [presupuestoAImprimir, setPresupuestoAImprimir] = useState(null);
  const [incluirImagenesPdf, setIncluirImagenesPdf] = useState(false);
  const [incluirLogoMarcaPresupuestoPdf, setIncluirLogoMarcaPresupuestoPdf] = useState(true);
  const [soloPreciosPorItemPresupuestoPdf, setSoloPreciosPorItemPresupuestoPdf] = useState(false);
  const [logoEmpresaRender, setLogoEmpresaRender] = useState('');
  const [itemIndexParaStock, setItemIndexParaStock] = useState(null);
  const [dialogoSistema, setDialogoSistema] = useState(null);
  const [descargandoPdfVistaImpresion, setDescargandoPdfVistaImpresion] = useState(false);
  const [descargandoImagenReciboCobro, setDescargandoImagenReciboCobro] = useState(false);

  const html5QrCodeScannerRef = useRef(null);
  const migrandoNumerosPresupuestoRef = useRef(false);
  const migrandoNumerosClienteRef = useRef(false);
  const dialogoSistemaResolverRef = useRef(null);
  const cacheRecorteImagenRef = useRef(new Map());
  const ofertaRenderCacheRef = useRef(new Map());
  const sincronizandoRecargosRef = useRef(false);
  const ultimoSyncRecargosRef = useRef(0);
  const reciboCobroPreviewRef = useRef(null);
  const cotizacionDolarBnaPromiseRef = useRef(null);

  const resolverDialogoSistema = (resultado = false) => {
    const resolver = dialogoSistemaResolverRef.current;
    dialogoSistemaResolverRef.current = null;
    setDialogoSistema(null);
    if (resolver) resolver(resultado);
  };

  const abrirDialogoSistema = ({
    tipo = 'info',
    titulo = 'Aviso',
    mensaje = '',
    confirmar = false,
    textoAceptar = 'Aceptar',
    textoCancelar = 'Cancelar',
    prompt = false,
    inputLabel = '',
    inputPlaceholder = '',
    inputValue = '',
    inputType = 'text'
  }) => new Promise((resolve) => {
    dialogoSistemaResolverRef.current = resolve;
    setDialogoSistema({
      tipo,
      titulo,
      mensaje: (mensaje || '').toString(),
      confirmar,
      textoAceptar,
      textoCancelar,
      prompt,
      inputLabel: (inputLabel || '').toString(),
      inputPlaceholder: (inputPlaceholder || '').toString(),
      inputValue: inputValue == null ? '' : String(inputValue),
      inputType
    });
  });

  const notificarSistema = (mensaje, opciones = {}) => abrirDialogoSistema({
    tipo: opciones.tipo || 'info',
    titulo: opciones.titulo || 'Notificación',
    mensaje,
    confirmar: false,
    textoAceptar: opciones.textoAceptar || 'Aceptar'
  });

  const confirmarSistema = (mensaje, opciones = {}) => abrirDialogoSistema({
    tipo: opciones.tipo || 'warning',
    titulo: opciones.titulo || 'Confirmación',
    mensaje,
    confirmar: true,
    textoAceptar: opciones.textoAceptar || 'Continuar',
    textoCancelar: opciones.textoCancelar || 'Cancelar'
  });

  const promptSistema = (mensaje, opciones = {}) => abrirDialogoSistema({
    tipo: opciones.tipo || 'warning',
    titulo: opciones.titulo || 'Editar valor',
    mensaje,
    confirmar: true,
    prompt: true,
    textoAceptar: opciones.textoAceptar || 'Guardar',
    textoCancelar: opciones.textoCancelar || 'Cancelar',
    inputLabel: opciones.inputLabel || 'Valor',
    inputPlaceholder: opciones.inputPlaceholder || '',
    inputValue: opciones.inputValue || '',
    inputType: opciones.inputType || 'text'
  });

  useEffect(() => {
    if (vista === 'ofertas') setVista('caja');
    if (vista === 'combos') setComboEditorActivo(false);
  }, [vista]);

  useEffect(() => {
    document.body?.setAttribute('data-current-view', vista || '');
  }, [vista]);

  useEffect(() => {
    if (modalActivo !== 'preview_oferta_flyer' && ofertaPreviewImagenes.length > 0) {
      limpiarPreviewOferta();
    }
  }, [modalActivo, ofertaPreviewImagenes.length]);

  useEffect(() => {
    cacheRecorteImagenRef.current.clear();
  }, [configuracion?.recorteIaApiKey]);

  useEffect(() => {
    ofertaRenderCacheRef.current.clear();
  }, [configuracion?.ofertaIaEndpoint, configuracion?.ofertaIaToken, configuracion?.logo, configuracion?.nombre]);

  useEffect(() => {
    setFormRecargoCliente((prev) => {
      if ((prev?.porcentaje || '').trim()) return prev;
      const porDefecto = obtenerPorcentajeRecargoConfigurado(configuracion);
      return crearFormularioRecargoVacio(porDefecto);
    });
  }, [configuracion?.recargoMoraPorcentajeGlobal, configuracion?.recargoMoraPorcentaje]);

  // --- INICIALIZACIÓN DE FIREBASE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { await signInWithCustomToken(auth, __initial_auth_token); } 
        else { await signInAnonymously(auth); }
      } catch(e) { console.error("Auth error", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const unsubConfig = onSnapshot(doc(db, 'sistema', 'configuracion'), (d) => {
        if (d.exists()) setConfiguracion({ ...CONFIG_DEFAULT, ...d.data() });
        else setDoc(d.ref, CONFIG_DEFAULT);
    }, (err) => console.error(err));

    const unsubCaja = onSnapshot(doc(db, 'sistema', 'caja'), (d) => {
        if(d.exists()) setCaja(d.data());
        else setDoc(d.ref, { estado: 'cerrada', efectivoInicial: 0, chequesInicial: 0, fechaApertura: null });
    }, (err) => console.error(err));

    const unsubUsuarios = onSnapshot(collection(db, 'usuarios'), (snapshot) => {
        if (snapshot.empty) {
            addDoc(collection(db, 'usuarios'), { nombre: 'Admin Principal', username: 'admin', password: '123', rol: 'admin' });
        } else {
            const loaded = []; snapshot.forEach(doc => loaded.push({ id: doc.id, ...doc.data() })); setUsuarios(loaded);
        }
    }, (err) => console.error(err));

    const unsubMovs = onSnapshot(collection(db, 'movimientos'), (snapshot) => {
        const loaded = []; snapshot.forEach(doc => loaded.push({ id: doc.id, ...doc.data() }));
        loaded.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); 
        setMovimientos(loaded);
    }, (err) => console.error(err));

    const unsubClientes = onSnapshot(collection(db, 'clientes'), (snapshot) => {
        const loaded = []; snapshot.forEach(doc => loaded.push({ id: doc.id, ...doc.data() })); setClientes(loaded);
    }, (err) => console.error(err));

    const unsubPresupuestos = onSnapshot(collection(db, 'presupuestos'), (snapshot) => {
        const loaded = []; snapshot.forEach(doc => loaded.push({ id: doc.id, ...doc.data() })); 
        loaded.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setPresupuestos(loaded);
    }, (err) => console.error(err));

    const unsubOfertas = onSnapshot(collection(db, 'ofertas'), (snapshot) => {
        const loaded = []; snapshot.forEach(doc => loaded.push({ id: doc.id, ...doc.data() }));
        loaded.sort((a, b) => new Date(b.fechaActualizacion || b.fechaCreacion || 0) - new Date(a.fechaActualizacion || a.fechaCreacion || 0));
        setOfertas(loaded);
    }, (err) => console.error(err));

    const unsubCombos = onSnapshot(collection(db, 'combos'), (snapshot) => {
        const loaded = []; snapshot.forEach(doc => loaded.push({ id: doc.id, ...doc.data() }));
        loaded.sort((a, b) => new Date(b.fechaActualizacion || b.fechaCreacion || 0) - new Date(a.fechaActualizacion || a.fechaCreacion || 0));
        setCombos(loaded);
    }, (err) => console.error(err));

    const unsubProductos = onSnapshot(collection(db, 'productos'), (snapshot) => {
        const loaded = []; snapshot.forEach(doc => loaded.push({ id: doc.id, ...doc.data() })); 
        loaded.sort((a, b) => a.descripcion.localeCompare(b.descripcion));
        setProductos(loaded);
        setIsDBReady(true); 
    }, (err) => { console.error(err); setIsDBReady(true); });

    return () => { unsubConfig(); unsubCaja(); unsubUsuarios(); unsubMovs(); unsubClientes(); unsubPresupuestos(); unsubOfertas(); unsubCombos(); unsubProductos(); };
  }, [firebaseUser]);

  useEffect(() => {
    let desmontado = false;

    const limpiarScanner = async () => {
      const scanner = html5QrCodeScannerRef.current;
      html5QrCodeScannerRef.current = null;
      if (!scanner) return;

      try { await scanner.stop(); } catch (e) {}
      try {
        const clearResult = scanner.clear?.();
        if (clearResult && typeof clearResult.then === 'function') await clearResult;
      } catch (e) {}
    };

    const iniciarScanner = async () => {
      if (!window.Html5Qrcode) return;

      await limpiarScanner();
      if (desmontado) return;

      const scanner = new window.Html5Qrcode("reader");
      html5QrCodeScannerRef.current = scanner;
      const formatos = window.Html5QrcodeSupportedFormats || {};
      const formatosSoportados = [
        formatos.QR_CODE, formatos.AZTEC, formatos.CODABAR, formatos.CODE_39,
        formatos.CODE_93, formatos.CODE_128, formatos.DATA_MATRIX, formatos.EAN_8,
        formatos.EAN_13, formatos.ITF, formatos.MAXICODE, formatos.PDF_417,
        formatos.RSS_14, formatos.RSS_EXPANDED, formatos.UPC_A, formatos.UPC_E,
        formatos.UPC_EAN_EXTENSION
      ].filter((f) => typeof f === 'number');
      const config = {
        fps: 14,
        qrbox: { width: 300, height: 180 },
        aspectRatio: 1.777778,
        disableFlip: false,
        rememberLastUsedCamera: true,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        formatsToSupport: formatosSoportados.length ? formatosSoportados : undefined
      };

      const onScanSuccess = async (decodedText) => {
        const codigoLeido = (decodedText || '').trim();
        if (!codigoLeido) return;
        setFormProducto((prev) => ({ ...prev, codigo: codigoLeido }));
        await limpiarScanner();
        if (!desmontado) setModalActivo('nuevo_producto');
      };
      const onScanFailure = () => { /* Silenciar errores */ };

      try {
        await scanner.start({ facingMode: { exact: 'environment' } }, config, onScanSuccess, onScanFailure);
        return;
      } catch (e) {}

      try {
        await scanner.start({ facingMode: 'environment' }, config, onScanSuccess, onScanFailure);
        return;
      } catch (e) {}

      try {
        const cameras = await window.Html5Qrcode.getCameras();
        const backCamera = cameras.find((cam) =>
          /back|rear|environment|trasera|traseira/i.test((cam.label || '').toLowerCase())
        ) || cameras[0];
        if (!backCamera) throw new Error('No cameras available');
        await scanner.start(backCamera.id, config, onScanSuccess, onScanFailure);
      } catch (error) {
        console.error('Error iniciando escáner de código', error);
        await notificarSistema('No se pudo abrir la cámara trasera. Verifica permisos de cámara y que el sitio esté en HTTPS.', {
          tipo: 'error',
          titulo: 'Error de cámara'
        });
        await limpiarScanner();
        if (!desmontado) setModalActivo('nuevo_producto');
      }
    };

    const cargarScriptEIniciar = () => {
      if (window.Html5Qrcode) {
        iniciarScanner();
        return;
      }

      const scriptId = 'html5-qrcode-lib';
      let script = document.getElementById(scriptId);

      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://unpkg.com/html5-qrcode';
        script.async = true;
        document.body.appendChild(script);
      }

      script.addEventListener('load', () => {
        if (!desmontado && modalActivo === 'scanner_codigo') iniciarScanner();
      }, { once: true });
    };

    if (modalActivo === 'scanner_codigo') cargarScriptEIniciar();

    return () => {
      desmontado = true;
      limpiarScanner();
    };
  }, [modalActivo]);


  // --- CÁLCULOS Y FILTROS ---
  const movimientosDelTurno = useMemo(() => {
    if (caja.estado === 'cerrada' || !caja.fechaApertura) return [];
    return movimientos.filter((m) => !m?.noImpactaCaja && new Date(m.fecha) >= new Date(caja.fechaApertura));
  }, [movimientos, caja]);

  const movimientosHistoricos = useMemo(
    () => movimientos.filter((m) => !m?.noImpactaCaja),
    [movimientos]
  );

  const totales = useMemo(() => {
    let ventas = 0; let gastos = 0; let otrosIngresos = 0; let ingresosEfectivo = 0; let egresosEfectivo = 0; let retirosEfectivo = 0;
    movimientosDelTurno.forEach(m => {
      if (m.tipo === 'venta') ventas += m.monto;
      if (m.tipo === 'gasto') gastos += m.monto;
      if (m.tipo === 'ingreso_extra') otrosIngresos += m.monto;
      
      if (m.metodoPago === 'efectivo') {
        if (m.tipo === 'venta' || m.tipo === 'cobro' || m.tipo === 'ingreso_extra') ingresosEfectivo += m.monto;
        if (m.tipo === 'gasto') egresosEfectivo += m.monto;
        if (m.tipo === 'retiro_caja') retirosEfectivo += m.monto; // Solo afecta a la caja física
      }
    });
    return { ventas, gastos, otrosIngresos, balanceEfectivo: ingresosEfectivo - egresosEfectivo - retirosEfectivo, ingresosEfectivo, egresosEfectivo, retirosEfectivo };
  }, [movimientosDelTurno]);

  const saldoActual = caja.efectivoInicial + totales.balanceEfectivo;

  const movimientosVisualizados = useMemo(() => {
    return movimientosHistoricos.filter(m => {
      const matchTipo = filtroTipo === 'todos' || m.tipo === filtroTipo;
      let matchFecha = true;
      if (fechaDesde || fechaHasta) {
        const mDate = new Date(m.fecha); mDate.setHours(0,0,0,0);
        if (fechaDesde) { const d = new Date(fechaDesde + 'T00:00:00'); if (mDate < d) matchFecha = false; }
        if (fechaHasta) { const h = new Date(fechaHasta + 'T23:59:59.999'); if (mDate > h) matchFecha = false; }
      }
      return matchTipo && matchFecha;
    });
  }, [movimientosHistoricos, filtroTipo, fechaDesde, fechaHasta]);

  const datosReporte = useMemo(() => {
    const ahora = new Date(); ahora.setHours(23,59,59,999);
    let inicio = new Date(0);
    let fin = new Date(ahora);

    if (reporteTiempo === 'hoy') {
      inicio = new Date(); inicio.setHours(0,0,0,0);
      fin = new Date(); fin.setHours(23,59,59,999);
    } else if (reporteTiempo === 'semana') {
      inicio = new Date();
      inicio.setDate(inicio.getDate() - inicio.getDay() + (inicio.getDay() === 0 ? -6 : 1));
      inicio.setHours(0,0,0,0);
    } else if (reporteTiempo === 'mes') {
      const [anioStr, mesStr] = (reporteMesSeleccionado || '').split('-');
      const anio = parseInt(anioStr, 10);
      const mes = parseInt(mesStr, 10);
      if (Number.isFinite(anio) && Number.isFinite(mes) && mes >= 1 && mes <= 12) {
        inicio = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
        fin = new Date(anio, mes, 0, 23, 59, 59, 999);
      } else {
        inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
      }
    }

    if (reporteFechaDesdeReporte) {
      const inicioManual = new Date(`${reporteFechaDesdeReporte}T00:00:00`);
      if (!Number.isNaN(inicioManual.getTime())) inicio = inicioManual;
    }
    if (reporteFechaHastaReporte) {
      const finManual = new Date(`${reporteFechaHastaReporte}T23:59:59.999`);
      if (!Number.isNaN(finManual.getTime())) fin = finManual;
    }
    if (inicio > fin) [inicio, fin] = [fin, inicio];

    const movsFiltrados = movimientos.filter(m => {
      if (m?.noImpactaCaja) return false;
      const mDate = new Date(m.fecha);
      return mDate >= inicio && mDate <= fin;
    });
    
    let ingr = 0; let egr = 0; let cobros = 0; let retirosCaja = 0;
    let flujoEfectivo = 0; let flujoTransferencia = 0; let flujoTarjeta = 0; let flujoCheque = 0;

    movsFiltrados.forEach(m => {
      // Para balances generales (Ganancias / Pérdidas del negocio)
      if (m.tipo === 'venta' || m.tipo === 'ingreso_extra') ingr += m.monto;
      if (m.tipo === 'gasto') egr += m.monto; // Retiros NO son gastos, no afectan el neto general.
      if (m.tipo === 'cobro') cobros += m.monto;
      if (m.tipo === 'retiro_caja') retirosCaja += m.monto;

      // Para el balance real desglosado por medios de pago
      let factor = (m.tipo === 'gasto' || m.tipo === 'retiro_caja') ? -1 : 1;
      const metodo = normalizarMetodoPago(m.metodoPago);
      if (metodo === 'efectivo') flujoEfectivo += m.monto * factor;
      if (metodo.includes('transfer')) flujoTransferencia += m.monto * factor;
      if (metodo === 'tarjeta') flujoTarjeta += m.monto * factor;
      if (metodo === 'cheque') flujoCheque += m.monto * factor;
    });

    return { 
      movimientos: movsFiltrados, 
      ingresos: ingr, egresos: egr, cobros, retiros: retirosCaja, 
      neto: (ingr + cobros) - egr, // El retiro no resta de la ganancia neta
      flujoEfectivo, flujoTransferencia, flujoTarjeta, flujoCheque,
      inicio, fin 
    };
  }, [movimientos, reporteTiempo, reporteMesSeleccionado, reporteFechaDesdeReporte, reporteFechaHastaReporte]);

  const mostrarDetalleIndicadorReporte = async (clave) => {
    const periodo = `Período: ${formatearFecha(datosReporte.inicio)} al ${formatearFecha(datosReporte.fin)}.`;
    const detalles = {
      ingresos: {
        titulo: 'Detalle de Ingresos Totales',
        mensaje: `${periodo}\nIncluye ventas e ingresos extra.\nTotal: ${formatearDinero(datosReporte.ingresos)}`
      },
      cobros: {
        titulo: 'Detalle de Cobros (Cuentas)',
        mensaje: `${periodo}\nIncluye cobros registrados de cuenta corriente.\nTotal: ${formatearDinero(datosReporte.cobros)}`
      },
      egresos: {
        titulo: 'Detalle de Egresos Totales',
        mensaje: `${periodo}\nIncluye gastos operativos.\nTotal: ${formatearDinero(datosReporte.egresos)}`
      },
      transferencias: {
        titulo: 'Detalle de Transferencias Netas',
        mensaje: `${periodo}\nFlujo neto por transferencias (ingresos - egresos).\nTotal: ${formatearDinero(datosReporte.flujoTransferencia)}`
      },
      retiros: {
        titulo: 'Detalle de Retiros de Efectivo',
        mensaje: `${periodo}\nIncluye retiros de caja registrados.\nTotal: ${formatearDinero(datosReporte.retiros)}`
      },
      ganancia: {
        titulo: 'Detalle de Ganancia Neta',
        mensaje: `${periodo}\nCálculo: (Ingresos + Cobros) - Egresos.\nResultado: ${formatearDinero(datosReporte.neto)}`
      }
    };
    const detalle = detalles[clave];
    if (!detalle) return;
    await notificarSistema(detalle.mensaje, {
      tipo: 'info',
      titulo: detalle.titulo
    });
  };

  const puedeVerClienteEnCuentas = (cliente) => {
    if (!cliente) return false;
    const rol = (usuarioActual?.rol || '').toLowerCase();
    if (rol !== 'cajero') return true;
    if (usuarioActual?.puedeVerClientesEspeciales || usuarioActual?.puedeVerCuentasInstitucionales) return true;
    return !esClienteEspecial(cliente);
  };

  const usuarioPuedeCargarCuentaHistorica = () => {
    const rol = (usuarioActual?.rol || '').toLowerCase();
    if (rol === 'admin') return true;
    if (rol === 'cajero') return Boolean(usuarioActual?.puedeCargarCuentaHistorica);
    return false;
  };

  const clientesVisiblesSegunAcceso = useMemo(() => {
    if (!usuarioActual) return [];
    return clientes.filter((cliente) => puedeVerClienteEnCuentas(cliente));
  }, [clientes, usuarioActual]);

  const calcularEstadoCuentaCliente = (cliente) => {
    if (!cliente) {
      return { movimientosDesc: [], cargosProcesados: [], ticketsPendientes: [], diasDeuda: null };
    }

    const nombreCliente = normalizarTextoBusqueda(cliente.nombre);
    const movimientosCuentaAsc = movimientos
      .filter((mov) => {
        if (mov.tipo === 'cobro') {
          if (mov.detallesPago?.clienteId) return mov.detallesPago.clienteId === cliente.id;
          const referenciaCobro = normalizarTextoBusqueda(mov.detallesPago?.cliente || mov.descripcion || '');
          return referenciaCobro.includes(nombreCliente);
        }

        if (esMovimientoCargoCuentaCorriente(mov)) {
          if (mov.detallesPago?.clienteId) return mov.detallesPago.clienteId === cliente.id;
          return normalizarTextoBusqueda(mov.detallesPago?.cliente) === nombreCliente;
        }

        return false;
      })
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const parseMonto = (valor) => {
      const n = parseFloat((valor ?? '').toString().replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };

    const cargosProcesados = movimientosCuentaAsc
      .filter((mov) => esMovimientoCargoCuentaCorriente(mov))
      .map((mov) => {
        const montoOriginal = parseMonto(mov.monto);
        const fechaCargo = new Date(mov.fecha);
        const diasImpago = Number.isNaN(fechaCargo.getTime())
          ? 0
          : Math.max(0, Math.floor((Date.now() - fechaCargo.getTime()) / MS_POR_DIA));
        const esRecargo = esRecargoMoraMovimiento(mov);
        return {
          ...mov,
          montoOriginal,
          recargoMora: esRecargo ? montoOriginal : 0,
          diasImpago,
          tramosRecargoMora: Number(mov?.detallesPago?.tramoIndice || mov?.detallesPago?.tramos || 0),
          porcentajeRecargoMora: Number(mov?.detallesPago?.porcentaje || 0),
          pendiente: montoOriginal
        };
      });

    const cargosPorId = Object.fromEntries(cargosProcesados.map((cargo) => [cargo.id, cargo]));
    const cobros = movimientosCuentaAsc.filter((mov) => mov.tipo === 'cobro');

    cobros.forEach((cobro) => {
      let restante = parseMonto(cobro.monto);
      if (restante <= 0) return;

      const movimientoRelacionadoId = cobro.detallesPago?.movimientoRelacionadoId;
      if (movimientoRelacionadoId && cargosPorId[movimientoRelacionadoId] && cargosPorId[movimientoRelacionadoId].pendiente > 0) {
        const aplicado = Math.min(restante, cargosPorId[movimientoRelacionadoId].pendiente);
        cargosPorId[movimientoRelacionadoId].pendiente -= aplicado;
        restante -= aplicado;
      }

      if (restante > 0) {
        for (const cargo of cargosProcesados) {
          if (restante <= 0) break;
          if (cargo.pendiente <= 0) continue;
          const aplicado = Math.min(restante, cargo.pendiente);
          cargo.pendiente -= aplicado;
          restante -= aplicado;
        }
      }
    });

    const ticketsPendientes = cargosProcesados.filter((cargo) => cargo.pendiente > 0.009);
    const ticketsBasePendientes = ticketsPendientes.filter((cargo) => !esRecargoMoraMovimiento(cargo));
    const universoDias = ticketsBasePendientes.length ? ticketsBasePendientes : ticketsPendientes;
    const recargosMovimientos = cargosProcesados.filter((cargo) => esRecargoMoraMovimiento(cargo));
    const operacionesRecargo = new Set();
    recargosMovimientos.forEach((cargo) => {
      const detalles = cargo?.detallesPago || {};
      const operacionIdExplicito = textoSeguroTrim(detalles?.operacionRecargoId, '');
      if (operacionIdExplicito) {
        operacionesRecargo.add(operacionIdExplicito);
        return;
      }
      const fechaRefTexto = textoSeguroTrim(detalles?.aplicadoEn, textoSeguroTrim(cargo?.fecha, ''));
      const fechaRef = new Date(fechaRefTexto);
      const marcaTiempo = Number.isNaN(fechaRef.getTime())
        ? 'sin-fecha'
        : `${fechaRef.getFullYear()}-${String(fechaRef.getMonth() + 1).padStart(2, '0')}-${String(fechaRef.getDate()).padStart(2, '0')}`;
      operacionesRecargo.add(marcaTiempo);
    });
    const recargosAplicados = operacionesRecargo.size;
    const ultimaFechaRecargo = recargosMovimientos.reduce((ultima, cargo) => {
      const fechaCargo = new Date(cargo.fecha);
      if (Number.isNaN(fechaCargo.getTime())) return ultima;
      if (!ultima) return fechaCargo;
      return fechaCargo > ultima ? fechaCargo : ultima;
    }, null);
    const ultimoRecargo = recargosMovimientos.reduce((actual, cargo) => {
      const fechaCargo = new Date(cargo.fecha);
      if (Number.isNaN(fechaCargo.getTime())) return actual;
      if (!actual) return cargo;
      const fechaActual = new Date(actual.fecha);
      if (Number.isNaN(fechaActual.getTime())) return cargo;
      return fechaCargo > fechaActual ? cargo : actual;
    }, null);
    const fechaTicketMasAntiguo = universoDias.reduce((minFecha, cargo) => {
      const fecha = new Date(cargo.fecha);
      if (Number.isNaN(fecha.getTime())) return minFecha;
      return !minFecha || fecha < minFecha ? fecha : minFecha;
    }, null);

    const diasDeuda = fechaTicketMasAntiguo
      ? Math.max(0, Math.floor((Date.now() - fechaTicketMasAntiguo.getTime()) / MS_POR_DIA))
      : null;
    const diasDesdeUltimoRecargo = ultimaFechaRecargo
      ? Math.max(0, Math.floor((Date.now() - ultimaFechaRecargo.getTime()) / MS_POR_DIA))
      : null;
    const ultimoPorcentajeRecargo = Math.max(0, Number(ultimoRecargo?.detallesPago?.porcentaje || 0));
    const porcentajeBaseSugerido = ultimoPorcentajeRecargo > 0
      ? ultimoPorcentajeRecargo
      : obtenerPorcentajeRecargoConfigurado(configuracion);
    const diasReferenciaSugerencia = diasDesdeUltimoRecargo !== null ? diasDesdeUltimoRecargo : diasDeuda;
    const tramosSugeridosRecargo = (diasReferenciaSugerencia !== null && diasReferenciaSugerencia >= 30)
      ? Math.floor(diasReferenciaSugerencia / 30)
      : 0;
    const porcentajeSugeridoRecargo = porcentajeBaseSugerido > 0 && tramosSugeridosRecargo > 0
      ? Math.round((porcentajeBaseSugerido * tramosSugeridosRecargo) * 100) / 100
      : 0;

    return {
      movimientosDesc: [...movimientosCuentaAsc]
        .map((mov) => cargosPorId[mov.id] ? cargosPorId[mov.id] : mov)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
      cargosProcesados,
      ticketsPendientes,
      diasDeuda,
      recargosAplicados,
      ultimaFechaRecargo,
      diasDesdeUltimoRecargo,
      ultimoPorcentajeRecargo,
      tramosSugeridosRecargo,
      porcentajeSugeridoRecargo
    };
  };

  const estadoCuentaClienteSeleccionado = useMemo(
    () => calcularEstadoCuentaCliente(clienteSeleccionado),
    [clienteSeleccionado, movimientos, configuracion?.recargoMoraPorcentajeGlobal, configuracion?.recargoMoraPorcentaje]
  );

  const movimientosClienteSeleccionado = useMemo(
    () => estadoCuentaClienteSeleccionado.movimientosDesc,
    [estadoCuentaClienteSeleccionado]
  );

  const movimientosClienteSeleccionadoVisibles = useMemo(() => {
    const esAdmin = (usuarioActual?.rol || '').toLowerCase() === 'admin';
    if (esAdmin) return movimientosClienteSeleccionado;
    return movimientosClienteSeleccionado.filter((mov) => !esRecargoMoraMovimiento(mov));
  }, [movimientosClienteSeleccionado, usuarioActual?.rol]);

  const ticketsPendientesClienteSeleccionado = useMemo(
    () => estadoCuentaClienteSeleccionado.ticketsPendientes,
    [estadoCuentaClienteSeleccionado]
  );

  const ticketsPendientesParaCobroClienteSeleccionado = useMemo(() => {
    const esAdmin = (usuarioActual?.rol || '').toLowerCase() === 'admin';
    if (esAdmin) return ticketsPendientesClienteSeleccionado;
    return (ticketsPendientesClienteSeleccionado || []).filter((ticket) => !esRecargoMoraMovimiento(ticket));
  }, [ticketsPendientesClienteSeleccionado, usuarioActual?.rol]);

  const pendientePorCargoIdSeleccionado = useMemo(
    () => Object.fromEntries((estadoCuentaClienteSeleccionado.cargosProcesados || []).map((cargo) => [cargo.id, cargo.pendiente])),
    [estadoCuentaClienteSeleccionado]
  );

  const cargoProcesadoPorIdSeleccionado = useMemo(
    () => Object.fromEntries((estadoCuentaClienteSeleccionado.cargosProcesados || []).map((cargo) => [cargo.id, cargo])),
    [estadoCuentaClienteSeleccionado]
  );

  const recargosClienteSeleccionado = useMemo(
    () => (estadoCuentaClienteSeleccionado.cargosProcesados || [])
      .filter((cargo) => esRecargoMoraMovimiento(cargo))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    [estadoCuentaClienteSeleccionado]
  );

  const ticketsBasePendientesClienteSeleccionado = useMemo(
    () => (estadoCuentaClienteSeleccionado.ticketsPendientes || []).filter((cargo) => !esRecargoMoraMovimiento(cargo)),
    [estadoCuentaClienteSeleccionado]
  );

  const ticketsVencidosParaRecargoClienteSeleccionado = useMemo(
    () => ticketsBasePendientesClienteSeleccionado.filter((ticket) => {
      const fechaTicket = new Date(ticket.fecha);
      if (Number.isNaN(fechaTicket.getTime())) return false;
      const dias = Math.max(0, Math.floor((Date.now() - fechaTicket.getTime()) / MS_POR_DIA));
      return dias >= 30 && Number(ticket.pendiente || 0) > 0.009;
    }),
    [ticketsBasePendientesClienteSeleccionado]
  );

  const saldoPendienteClienteSeleccionado = useMemo(() => {
    const saldoPendienteTickets = (estadoCuentaClienteSeleccionado.ticketsPendientes || [])
      .reduce((acc, ticket) => acc + Number(ticket.pendiente || 0), 0);
    return Math.max(0, Number(clienteSeleccionado?.saldo || 0), saldoPendienteTickets);
  }, [estadoCuentaClienteSeleccionado, clienteSeleccionado]);

  const estadoCuentaClientes = useMemo(() => {
    const estadoPorId = {};
    clientes.forEach((cliente) => {
      const estado = calcularEstadoCuentaCliente(cliente);
      const saldoPendienteTickets = (estado.ticketsPendientes || []).reduce((acc, ticket) => acc + Number(ticket.pendiente || 0), 0);
      const saldoPendiente = Math.max(Number(cliente.saldo || 0), saldoPendienteTickets, 0);
      const tieneDeuda = (cliente.saldo || 0) > 0 || (estado.ticketsPendientes || []).length > 0;
      const diasDeuda = tieneDeuda ? estado.diasDeuda : null;
      const vencido30 = Boolean(tieneDeuda && diasDeuda !== null && diasDeuda > 30);
      const recargosAplicados = Number(estado?.recargosAplicados || 0);
      const ultimaFechaRecargo = estado?.ultimaFechaRecargo || null;
      const diasDesdeUltimoRecargo = Number.isFinite(Number(estado?.diasDesdeUltimoRecargo))
        ? Number(estado.diasDesdeUltimoRecargo)
        : null;
      const ultimoPorcentajeRecargo = Math.max(0, Number(estado?.ultimoPorcentajeRecargo || 0));
      const tramosSugeridosRecargo = Math.max(0, Number(estado?.tramosSugeridosRecargo || 0));
      const porcentajeSugeridoRecargo = Math.max(0, Number(estado?.porcentajeSugeridoRecargo || 0));
      estadoPorId[cliente.id] = {
        tieneDeuda,
        vencido30,
        diasDeuda,
        saldoPendiente,
        recargosAplicados,
        ultimaFechaRecargo,
        diasDesdeUltimoRecargo,
        ultimoPorcentajeRecargo,
        tramosSugeridosRecargo,
        porcentajeSugeridoRecargo
      };
    });
    return estadoPorId;
  }, [clientes, movimientos, configuracion?.recargoMoraPorcentajeGlobal, configuracion?.recargoMoraPorcentaje]);

  useEffect(() => {
    const esAdmin = (usuarioActual?.rol || '').toLowerCase() === 'admin';
    const activo = Boolean(configuracion?.recargosAutomaticosActivos);
    const porcentaje = obtenerPorcentajeRecargoConfigurado(configuracion);
    if (!esAdmin || !activo || porcentaje <= 0) return;
    if (!clientes.length || !movimientos.length) return;
    if (sincronizandoRecargosRef.current) return;

    const ahora = Date.now();
    if (ahora - ultimoSyncRecargosRef.current < 1500) return;

    let cancelado = false;

    const sincronizarRecargosAutomaticos = async () => {
      sincronizandoRecargosRef.current = true;
      ultimoSyncRecargosRef.current = Date.now();
      try {
        const recargosAutomaticosPorCargo = new Map();
        movimientos
          .filter((mov) => esRecargoMoraMovimiento(mov) && mov?.detallesPago?.origenRecargo === 'automatico')
          .forEach((mov) => {
            const cargoId = (mov?.detallesPago?.cargoOrigenId || '').toString();
            const tramo = Number(mov?.detallesPago?.tramoIndice || 0);
            if (!cargoId || tramo <= 0) return;
            if (!recargosAutomaticosPorCargo.has(cargoId)) recargosAutomaticosPorCargo.set(cargoId, new Set());
            recargosAutomaticosPorCargo.get(cargoId).add(tramo);
          });

        const nuevosRecargos = [];
        const incrementoPorCliente = {};

        clientes.forEach((cliente) => {
          const estado = calcularEstadoCuentaCliente(cliente);
          const pendientesBase = (estado.ticketsPendientes || []).filter((ticket) => !esRecargoMoraMovimiento(ticket));
          const operacionRecargoId = `RCA-${cliente.id}-${Date.now()}`;
          const aplicadoEnOperacion = new Date().toISOString();
          pendientesBase.forEach((ticket) => {
            const fechaTicket = new Date(ticket.fecha);
            if (Number.isNaN(fechaTicket.getTime())) return;
            if (Number(ticket.pendiente || 0) <= 0.009) return;
            const dias = Math.max(0, Math.floor((Date.now() - fechaTicket.getTime()) / MS_POR_DIA));
            const tramosCalculados = Math.floor(dias / 30);
            if (tramosCalculados <= 0) return;
            const montoBase = Math.max(0, Number(ticket.montoOriginal || ticket.monto || 0));
            if (montoBase <= 0) return;

            const tramosYaAplicados = recargosAutomaticosPorCargo.get(ticket.id) || new Set();
            for (let tramo = 1; tramo <= tramosCalculados; tramo += 1) {
              if (tramosYaAplicados.has(tramo)) continue;
              const montoRecargo = Math.round((montoBase * (porcentaje / 100)) * 100) / 100;
              if (montoRecargo <= 0) continue;
              const descripcionBase = (ticket.descripcion || '').trim() || 'Ticket sin descripción';
              nuevosRecargos.push({
                tipo: 'recargo_mora',
                monto: montoRecargo,
                descripcion: `Recargo automático ${porcentaje}% (tramo ${tramo}) • ${descripcionBase}`,
                metodoPago: 'cuenta_corriente',
                noImpactaCaja: true,
                detallesPago: {
                  clienteId: cliente.id,
                  cliente: cliente.nombre || '',
                  cargoOrigenId: ticket.id,
                  porcentaje,
                  tramoIndice: tramo,
                  diasImpago: dias,
                  baseMonto: montoBase,
                  aplicadoEn: aplicadoEnOperacion,
                  operacionRecargoId,
                  origenRecargo: 'automatico',
                  esRecargoMora: true,
                  visibleSoloAdmin: true,
                  cargoDescripcion: descripcionBase
                },
                fecha: aplicadoEnOperacion,
                usuario: usuarioActual?.nombre || 'Sistema'
              });
              tramosYaAplicados.add(tramo);
              incrementoPorCliente[cliente.id] = Number(incrementoPorCliente[cliente.id] || 0) + montoRecargo;
            }
            recargosAutomaticosPorCargo.set(ticket.id, tramosYaAplicados);
          });
        });

        if (!nuevosRecargos.length || cancelado) return;

        for (const payload of nuevosRecargos) {
          if (cancelado) break;
          await addDoc(collection(db, 'movimientos'), payload);
        }

        for (const [clienteId, incremento] of Object.entries(incrementoPorCliente)) {
          if (cancelado || incremento <= 0) continue;
          const cliente = clientes.find((c) => c.id === clienteId);
          if (!cliente) continue;
          await updateDoc(doc(db, 'clientes', cliente.id), {
            saldo: Number(cliente.saldo || 0) + incremento
          });
        }
      } catch (error) {
        console.error('Error al sincronizar recargos automáticos', error);
      } finally {
        sincronizandoRecargosRef.current = false;
      }
    };

    sincronizarRecargosAutomaticos();
    return () => { cancelado = true; };
  }, [clientes, movimientos, configuracion?.recargosAutomaticosActivos, configuracion?.recargoMoraPorcentajeGlobal, configuracion?.recargoMoraPorcentaje, usuarioActual?.rol, usuarioActual?.nombre]);

  const clientesVisualizados = useMemo(() => {
    const termino = normalizarTextoBusqueda(busquedaDirectorio);
    const baseFiltrada = clientesVisiblesSegunAcceso.filter((c) => {
      if (!termino) return true;
      const campos = [c.nombre, c.whatsapp, c.documento, c.email, c.direccion, c.numero];
      return campos.some((campo) => normalizarTextoBusqueda(campo).includes(termino));
    });

    const enriquecidos = baseFiltrada
      .map((cliente) => ({ cliente, estado: estadoCuentaClientes[cliente.id] || { tieneDeuda: false, diasDeuda: null } }))
      .filter(({ cliente, estado }) => {
        if (!mostrarSoloConSaldoPendiente) return true;
        return Boolean(estado.tieneDeuda || Number(cliente.saldo || 0) > 0);
      });

    enriquecidos.sort((a, b) => {
      if (mostrarSoloConSaldoPendiente) {
        const diasA = Number.isFinite(a.estado?.diasDeuda) ? a.estado.diasDeuda : -1;
        const diasB = Number.isFinite(b.estado?.diasDeuda) ? b.estado.diasDeuda : -1;
        if (diasB !== diasA) return diasB - diasA;

        const saldoA = Number(a.estado?.saldoPendiente || a.cliente?.saldo || 0);
        const saldoB = Number(b.estado?.saldoPendiente || b.cliente?.saldo || 0);
        if (saldoB !== saldoA) return saldoB - saldoA;
      }

      return (a.cliente?.nombre || '').localeCompare((b.cliente?.nombre || ''), 'es', { sensitivity: 'base' });
    });

    return enriquecidos.map(({ cliente }) => cliente);
  }, [clientesVisiblesSegunAcceso, busquedaDirectorio, estadoCuentaClientes, mostrarSoloConSaldoPendiente]);

  const presupuestosVisualizados = useMemo(() => {
    const termino = normalizarTextoBusqueda(busquedaPresupuestos);
    if (!termino) return presupuestos;

    return presupuestos.filter((p) => {
      const numero = Number.isFinite(parseInt(p?.numero, 10)) ? parseInt(p?.numero, 10) : 0;
      const numeroPlano = numero > 0 ? String(numero) : '';
      const numeroCompleto = numero > 0 ? String(numero).padStart(6, '0') : '';
      const textoNumero = numero > 0 ? normalizarTextoBusqueda(`n° ${numeroCompleto}`) : '';
      const cliente = normalizarTextoBusqueda(p?.clienteNombre);
      return [numeroPlano, numeroCompleto, textoNumero, cliente].some((campo) => campo.includes(termino));
    });
  }, [presupuestos, busquedaPresupuestos]);

  const productosVisualizados = useMemo(() => {
    const termino = normalizarTextoBusqueda(busquedaInventario);
    if (!termino) return productos;
    return productos.filter((p) => {
      const campos = [p?.descripcion, p?.codigo, p?.categoria, p?.marca];
      return campos.some((campo) => normalizarTextoBusqueda(campo).includes(termino));
    });
  }, [productos, busquedaInventario]);

  const productosOfertaVisualizados = useMemo(() => {
    if (!busquedaOfertas.trim()) {
      return productos || [];
    }
    const termino = normalizarTextoBusqueda(busquedaOfertas);
    return (productos || []).filter((p) => {
      const campos = [p.descripcion, p.categoria, p.marca, p.codigo];
      return campos.some((campo) => normalizarTextoBusqueda(campo).includes(termino));
    });
  }, [productos, busquedaOfertas]);

  const productosOfertaSeleccionados = useMemo(
    () => productos
      .filter((p) => ofertaSeleccionIds.includes(p.id))
      .map((p) => ({
        ...p,
        precioOferta: ofertaPrecios[p.id] ?? (p.precio ?? '')
      })),
    [productos, ofertaSeleccionIds, ofertaPrecios]
  );

  const productosComboVisualizados = useMemo(() => {
    if (!busquedaCombosProductos.trim()) return productos;
    const termino = normalizarTextoBusqueda(busquedaCombosProductos);
    return productos.filter((p) => {
      const campos = [p.descripcion, p.categoria, p.marca, p.codigo];
      return campos.some((campo) => normalizarTextoBusqueda(campo).includes(termino));
    });
  }, [productos, busquedaCombosProductos]);

  const productosComboSeleccionados = useMemo(
    () => productos
      .filter((p) => comboSeleccionIds.includes(p.id))
      .map((p) => ({
        ...p,
        precioCombo: comboPrecios[p.id] ?? (p.precio ?? ''),
        cantidadCombo: parseNumeroBasico(comboCantidades[p.id] ?? 1) || 1
      })),
    [productos, comboSeleccionIds, comboPrecios, comboCantidades]
  );

  const ofertasVisualizadas = useMemo(() => {
    const termino = normalizarTextoBusqueda(busquedaOfertasGuardadas);
    if (!termino) return ofertas;
    return ofertas.filter((oferta) => {
      const campos = [oferta.titulo, oferta.numero, oferta.usuario, oferta.aclaraciones];
      return campos.some((campo) => normalizarTextoBusqueda(campo).includes(termino));
    });
  }, [ofertas, busquedaOfertasGuardadas]);

  const combosVisualizados = useMemo(() => {
    const termino = normalizarTextoBusqueda(busquedaCombosGuardados);
    if (!termino) return combos;
    return combos.filter((combo) => {
      const campos = [combo.titulo, combo.numero, combo.usuario];
      return campos.some((campo) => normalizarTextoBusqueda(campo).includes(termino));
    });
  }, [combos, busquedaCombosGuardados]);

  const obtenerCostoProductoPorItem = (item) => {
    if (!item) return 0;
    const costoDirecto = parseNumeroBasico(item?.costoBase);
    if (costoDirecto > 0) return costoDirecto;

    const codigoNormalizado = (item?.codigo || '').trim().toLowerCase();
    if (codigoNormalizado) {
      const porCodigo = productos.find((p) => ((p?.codigo || '').trim().toLowerCase() === codigoNormalizado));
      if (porCodigo) return parseNumeroBasico(porCodigo?.costo);
    }

    const descripcionNormalizada = (item?.descripcion || '').trim().toLowerCase();
    if (descripcionNormalizada) {
      const porDescripcion = productos.find((p) => ((p?.descripcion || '').trim().toLowerCase() === descripcionNormalizada));
      if (porDescripcion) return parseNumeroBasico(porDescripcion?.costo);
    }
    return 0;
  };

  const calcularResumenGananciaPresupuesto = (items = [], descuentoGeneral = 0, aplicaFleteCosto = false, fletePorcentaje = 0) => {
    const subtotalBruto = (items || []).reduce((acc, item) => acc + (parseNumeroBasico(item?.cantidad) * parseNumeroBasico(item?.precio)), 0);
    const descuentoItems = (items || []).reduce((acc, item) => {
      const subtotal = parseNumeroBasico(item?.cantidad) * parseNumeroBasico(item?.precio);
      return acc + (subtotal * (Math.max(0, parseNumeroBasico(item?.descuento)) / 100));
    }, 0);
    const subtotalConDescuentos = Math.max(0, subtotalBruto - descuentoItems);
    const descuentoGeneralMonto = subtotalConDescuentos * (Math.max(0, parseNumeroBasico(descuentoGeneral)) / 100);
    const total = Math.max(0, subtotalConDescuentos - descuentoGeneralMonto);
    const costoTotal = (items || []).reduce((acc, item) => {
      const cantidad = parseNumeroBasico(item?.cantidad);
      const costoUnitario = obtenerCostoProductoPorItem(item);
      return acc + (cantidad * costoUnitario);
    }, 0);
    const fletePctAplicado = aplicaFleteCosto ? Math.max(0, parseNumeroBasico(fletePorcentaje)) : 0;
    const fleteMonto = costoTotal * (fletePctAplicado / 100);
    const costoTotalConFlete = costoTotal + fleteMonto;
    const ganancia = total - costoTotalConFlete;
    const margen = total > 0 ? (ganancia / total) * 100 : 0;
    return { costoTotal, fletePctAplicado, fleteMonto, costoTotalConFlete, ganancia, margen };
  };

  const resumenGananciaPresupuestoActual = useMemo(
    () => calcularResumenGananciaPresupuesto(
      formPresupuesto.items,
      formPresupuesto.descuentoGeneral,
      formPresupuesto.aplicaFleteCosto,
      formPresupuesto.fletePorcentaje
    ),
    [formPresupuesto.items, formPresupuesto.descuentoGeneral, formPresupuesto.aplicaFleteCosto, formPresupuesto.fletePorcentaje, productos]
  );

  const resumenGananciaPresupuestosMap = useMemo(() => {
    const mapa = {};
    (presupuestos || []).forEach((p) => {
      const items = p?.items || [];
      const resumenGuardadoValido = Number.isFinite(Number(p?.gananciaEstimada)) && Number.isFinite(Number(p?.costoTotalEstimado));
      if (resumenGuardadoValido) {
        const ganancia = Number(p.gananciaEstimada || 0);
        const costoTotal = Number(p.costoTotalEstimado || 0);
        const total = Number(p.total || 0);
        mapa[p.id] = { ganancia, costoTotal, fletePctAplicado: Number(p.fletePorcentaje || 0), fleteMonto: Number(p.fleteMontoEstimado || 0), costoTotalConFlete: costoTotal, margen: total > 0 ? (ganancia / total) * 100 : 0 };
      } else {
        mapa[p.id] = calcularResumenGananciaPresupuesto(items, p?.descuentoGeneral || 0, p?.aplicaFleteCosto, p?.fletePorcentaje || 0);
      }
    });
    return mapa;
  }, [presupuestos, productos]);

  const calcularResumenGananciaCombo = (combo = null) => {
    const items = Array.isArray(combo?.items) ? combo.items : [];
    const total = Number(combo?.total || 0) || items.reduce((acc, item) => acc + ((parseNumeroBasico(item?.precio) || 0) * (parseNumeroBasico(item?.cantidad) || 1)), 0);
    const costoTotal = items.reduce((acc, item) => {
      const costoItem = parseNumeroBasico(item?.costoBase);
      if (costoItem > 0) return acc + (costoItem * (parseNumeroBasico(item?.cantidad) || 1));

      const porId = item?.id ? productos.find((p) => p.id === item.id) : null;
      if (porId) return acc + (parseNumeroBasico(porId?.costo) * (parseNumeroBasico(item?.cantidad) || 1));

      const codigoNormalizado = (item?.codigo || '').trim().toLowerCase();
      if (codigoNormalizado) {
        const porCodigo = productos.find((p) => ((p?.codigo || '').trim().toLowerCase() === codigoNormalizado));
        if (porCodigo) return acc + (parseNumeroBasico(porCodigo?.costo) * (parseNumeroBasico(item?.cantidad) || 1));
      }

      const descripcionNormalizada = (item?.descripcion || '').trim().toLowerCase();
      if (descripcionNormalizada) {
        const porDescripcion = productos.find((p) => ((p?.descripcion || '').trim().toLowerCase() === descripcionNormalizada));
        if (porDescripcion) return acc + (parseNumeroBasico(porDescripcion?.costo) * (parseNumeroBasico(item?.cantidad) || 1));
      }
      return acc;
    }, 0);
    const ganancia = total - costoTotal;
    const margen = total > 0 ? (ganancia / total) * 100 : 0;
    return { total, costoTotal, ganancia, margen };
  };

  const resumenGananciaCombosMap = useMemo(() => {
    const mapa = {};
    (combos || []).forEach((combo) => {
      const resumenGuardadoValido = Number.isFinite(Number(combo?.gananciaEstimada)) && Number.isFinite(Number(combo?.costoTotalEstimado));
      if (resumenGuardadoValido) {
        const total = Number(combo?.total || 0) || 0;
        const costoTotal = Number(combo?.costoTotalEstimado || 0);
        const ganancia = Number(combo?.gananciaEstimada || 0);
        mapa[combo.id] = { total, costoTotal, ganancia, margen: total > 0 ? (ganancia / total) * 100 : 0 };
      } else {
        mapa[combo.id] = calcularResumenGananciaCombo(combo);
      }
    });
    return mapa;
  }, [combos, productos]);

  const resumenGananciaComboActual = useMemo(() => {
    const total = productosComboSeleccionados.reduce((acc, p) => acc + (parseNumeroBasico(p.precioCombo) * (parseNumeroBasico(p.cantidadCombo) || 1)), 0);
    const costoTotal = productosComboSeleccionados.reduce((acc, p) => acc + (parseNumeroBasico(p.costo) * (parseNumeroBasico(p.cantidadCombo) || 1)), 0);
    const ganancia = total - costoTotal;
    const margen = total > 0 ? (ganancia / total) * 100 : 0;
    return { total, costoTotal, ganancia, margen };
  }, [productosComboSeleccionados]);

  const categoriasInventario = useMemo(() => {
    const cats = Array.from(new Set(productos.map((p) => (p.categoria || '').trim()).filter(Boolean)));
    return cats.sort((a, b) => a.localeCompare(b, 'es'));
  }, [productos]);

  const marcasInventario = useMemo(() => {
    const marcas = Array.from(new Set(productos.map((p) => (p.marca || '').trim()).filter(Boolean)));
    return marcas.sort((a, b) => a.localeCompare(b, 'es'));
  }, [productos]);


  // --- MANEJADORES DE BASE DE DATOS (FIREBASE) ---
  const manejarLogin = (e) => {
    e.preventDefault();
    const user = usuarios.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (user) { setUsuarioActual(user); setLoginForm({ username: '', password: '', error: '' }); setVista('caja'); } 
    else { setLoginForm({ ...loginForm, error: 'Usuario o contraseña incorrectos.' }); }
  };

  const cerrarSesion = async () => {
    const confirmar = await confirmarSistema('¿Estás seguro de que quieres cerrar sesión?', {
      tipo: 'warning',
      titulo: 'Cerrar sesión',
      textoAceptar: 'Cerrar sesión'
    });
    if (confirmar) setUsuarioActual(null);
  };

  useEffect(() => {
    if (!usuarioActual?.id) return;
    const usuarioActualizado = usuarios.find((u) => u.id === usuarioActual.id);
    if (usuarioActualizado) setUsuarioActual(usuarioActualizado);
  }, [usuarios, usuarioActual?.id]);

  const parseMontoCaja = (valor) => {
    const textoOriginal = (valor ?? '').toString().trim();
    if (!textoOriginal) return 0;

    const textoAnalisis = textoOriginal
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const multiplicador = textoAnalisis.includes('millon')
      ? 1000000
      : textoAnalisis.includes('mil')
        ? 1000
        : 1;

    // Limpia símbolos comunes y espacios.
    const texto = textoOriginal
      .replace(/\s+/g, '')
      .replace(/\$/g, '')
      .replace(/[^\d.,-]/g, '');
    const tieneComa = texto.includes(',');
    const tienePunto = texto.includes('.');
    let normalizado = texto;

    if (tieneComa && tienePunto) {
      // Formato es-AR típico: 150.000,50
      if (texto.lastIndexOf(',') > texto.lastIndexOf('.')) {
        normalizado = texto.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato tipo 150,000.50
        normalizado = texto.replace(/,/g, '');
      }
    } else if (tieneComa) {
      const partes = texto.split(',');
      if (partes.length > 2) {
        normalizado = texto.replace(/,/g, '');
      } else {
        const decimales = partes[1] || '';
        normalizado = decimales.length === 3 ? texto.replace(/,/g, '') : texto.replace(',', '.');
      }
    } else if (tienePunto) {
      const partes = texto.split('.');
      if (partes.length > 2) {
        normalizado = texto.replace(/\./g, '');
      } else {
        const decimales = partes[1] || '';
        normalizado = decimales.length === 3 ? texto.replace(/\./g, '') : texto;
      }
    }

    const n = parseFloat(normalizado);
    return Number.isFinite(n) ? (n * multiplicador) : 0;
  };

  const parseEnteroCliente = (valor) => {
    const n = parseInt(valor, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const obtenerSiguienteNumeroCliente = () => {
    const maxNumero = clientes.reduce((max, c) => Math.max(max, parseEnteroCliente(c?.numero)), 0);
    return maxNumero + 1;
  };

  const formatearNumeroCliente = (numero) => `CLI-${String(numero).padStart(6, '0')}`;

  const obtenerNumeroClienteTexto = (cliente) => {
    const numero = parseEnteroCliente(cliente?.numero);
    if (numero > 0) return formatearNumeroCliente(numero);
    const digitosId = (cliente?.id || '').replace(/\D/g, '');
    if (digitosId) {
      const fallbackNumero = parseEnteroCliente(digitosId.slice(-6));
      if (fallbackNumero > 0) return formatearNumeroCliente(fallbackNumero);
    }
    return 'CLI-000000';
  };

  const clientesSugeridosCuentaCorriente = useMemo(() => {
    if (formData.metodoPago !== 'cuenta_corriente') return [];
    const termino = normalizarTextoBusqueda(formData.detallesPago?.busquedaCliente || '');
    const base = termino
      ? clientes.filter((c) => {
          const campos = [c?.nombre, c?.whatsapp, c?.documento, obtenerNumeroClienteTexto(c)];
          return campos.some((campo) => normalizarTextoBusqueda(campo).includes(termino));
        })
      : clientes;
    return base.slice(0, 8);
  }, [clientes, formData.metodoPago, formData.detallesPago?.busquedaCliente]);

  const clientesSugeridosCargaCuenta = useMemo(() => {
    if (formCargaCuenta.modoCliente !== 'existente') return [];
    const termino = normalizarTextoBusqueda(formCargaCuenta.busquedaCliente || '');
    const base = termino
      ? clientes.filter((c) => {
          const campos = [c?.nombre, c?.whatsapp, c?.documento, c?.email, obtenerNumeroClienteTexto(c)];
          return campos.some((campo) => normalizarTextoBusqueda(campo).includes(termino));
        })
      : clientes;
    return base.slice(0, 8);
  }, [clientes, formCargaCuenta.modoCliente, formCargaCuenta.busquedaCliente]);

  const clientesSugeridosPresupuesto = useMemo(() => {
    if (formPresupuesto.esNuevoCliente) return [];
    const termino = normalizarTextoBusqueda(formPresupuesto.busquedaCliente || '');
    if (!termino) return [];
    return clientes
      .filter((c) => {
        const campos = [c?.nombre, c?.whatsapp, c?.documento, c?.email, obtenerNumeroClienteTexto(c)];
        return campos.some((campo) => normalizarTextoBusqueda(campo).includes(termino));
      })
      .slice(0, 8);
  }, [clientes, formPresupuesto.esNuevoCliente, formPresupuesto.busquedaCliente]);

  const seleccionarClienteCuentaCorriente = (cliente) => {
    if (!cliente) return;
    setFormData((prev) => ({
      ...prev,
      detallesPago: {
        ...prev.detallesPago,
        clienteId: cliente.id,
        cliente: cliente.nombre || '',
        whatsapp: cliente.whatsapp || '',
        documento: cliente.documento || '',
        busquedaCliente: cliente.nombre || '',
        nuevoClienteManual: false
      }
    }));
  };

  const seleccionarClientePresupuesto = (cliente) => {
    if (!cliente) return;
    setFormPresupuesto((prev) => ({
      ...prev,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre || '',
      whatsapp: cliente.whatsapp || '',
      busquedaCliente: cliente.nombre || ''
    }));
  };

  const activarNuevoClienteCuentaCorriente = () => {
    setFormData((prev) => ({
      ...prev,
      detallesPago: {
        ...prev.detallesPago,
        clienteId: '',
        cliente: '',
        whatsapp: '',
        documento: '',
        busquedaCliente: '',
        nuevoClienteManual: true
      }
    }));
  };

  const volverBusquedaClienteCuentaCorriente = () => {
    setFormData((prev) => ({
      ...prev,
      detallesPago: {
        ...prev.detallesPago,
        clienteId: '',
        cliente: '',
        whatsapp: '',
        busquedaCliente: '',
        nuevoClienteManual: false
      }
    }));
  };

  const abrirCargaCuentaCliente = () => {
    if (!usuarioPuedeCargarCuentaHistorica()) {
      notificarSistema('No tienes permiso para cargar cuentas históricas.', {
        tipo: 'warning',
        titulo: 'Acceso restringido'
      });
      return;
    }
    setFormCargaCuenta(crearFormularioCargaCuentaVacio());
    setModalActivo('cargar_cuenta_cliente');
  };

  const seleccionarClienteCargaCuenta = (cliente) => {
    if (!cliente) return;
    setFormCargaCuenta((prev) => ({
      ...prev,
      clienteId: cliente.id,
      busquedaCliente: cliente.nombre || '',
      whatsapp: cliente.whatsapp || '',
      documento: cliente.documento || '',
      email: cliente.email || '',
      direccion: cliente.direccion || ''
    }));
  };

  const activarNuevoClienteCargaCuenta = () => {
    setFormCargaCuenta((prev) => ({
      ...prev,
      modoCliente: 'nuevo',
      clienteId: '',
      busquedaCliente: '',
      nombreClienteNuevo: '',
      whatsapp: '',
      documento: '',
      email: '',
      direccion: ''
    }));
  };

  const volverBusquedaClienteCargaCuenta = () => {
    setFormCargaCuenta((prev) => ({
      ...prev,
      modoCliente: 'existente',
      clienteId: '',
      busquedaCliente: '',
      nombreClienteNuevo: '',
      whatsapp: '',
      documento: '',
      email: '',
      direccion: ''
    }));
  };

  const guardarCargaCuentaCliente = async (e) => {
    e.preventDefault();
    if (!usuarioPuedeCargarCuentaHistorica()) return;

    const monto = parseMontoCaja(formCargaCuenta.monto);
    if (!monto || monto <= 0) {
      await notificarSistema('Ingresa un saldo válido mayor a cero.', {
        tipo: 'warning',
        titulo: 'Saldo inválido'
      });
      return;
    }

    let clienteDestino = null;
    const modoNuevo = formCargaCuenta.modoCliente === 'nuevo';

    if (!modoNuevo) {
      if (!formCargaCuenta.clienteId) {
        await notificarSistema('Selecciona un cliente existente o cambia a "Cliente nuevo".', {
          tipo: 'warning',
          titulo: 'Cliente requerido'
        });
        return;
      }
      clienteDestino = clientes.find((c) => c.id === formCargaCuenta.clienteId) || null;
      if (!clienteDestino) {
        await notificarSistema('El cliente seleccionado ya no existe. Vuelve a buscarlo.', {
          tipo: 'warning',
          titulo: 'Cliente no disponible'
        });
        return;
      }
    } else {
      const nombreNuevo = (formCargaCuenta.nombreClienteNuevo || '').trim();
      if (!nombreNuevo) {
        await notificarSistema('Completa el nombre del cliente nuevo.', {
          tipo: 'warning',
          titulo: 'Nombre requerido'
        });
        return;
      }

      const documentoNuevo = (formCargaCuenta.documento || '').trim();
      const whatsappNuevo = (formCargaCuenta.whatsapp || '').trim();

      const existentePorDocumento = documentoNuevo
        ? clientes.find((c) => normalizarTextoBusqueda(c.documento) === normalizarTextoBusqueda(documentoNuevo))
        : null;
      const existentePorNombre = clientes.find((c) => normalizarTextoBusqueda(c.nombre) === normalizarTextoBusqueda(nombreNuevo));
      const existentePorWhatsapp = whatsappNuevo
        ? clientes.find((c) => normalizarTextoBusqueda(c.whatsapp) === normalizarTextoBusqueda(whatsappNuevo))
        : null;

      clienteDestino = existentePorDocumento || existentePorWhatsapp || existentePorNombre || null;

      if (clienteDestino) {
        await updateDoc(doc(db, 'clientes', clienteDestino.id), {
          saldo: Number(clienteDestino.saldo || 0) + monto,
          whatsapp: whatsappNuevo || clienteDestino.whatsapp || '',
          documento: documentoNuevo || clienteDestino.documento || '',
          email: (formCargaCuenta.email || '').trim() || clienteDestino.email || '',
          direccion: (formCargaCuenta.direccion || '').trim() || clienteDestino.direccion || ''
        });
      } else {
        const nuevoClientePayload = {
          numero: obtenerSiguienteNumeroCliente(),
          nombre: nombreNuevo,
          whatsapp: whatsappNuevo,
          documento: documentoNuevo,
          email: (formCargaCuenta.email || '').trim(),
          direccion: (formCargaCuenta.direccion || '').trim(),
          notas: 'Alta histórica de cuenta corriente',
          saldo: monto,
          esEspecial: esNombreClienteInstitucional(nombreNuevo),
          recordatoriosWhatsappEnviados: 0
        };
        const nuevoRef = await addDoc(collection(db, 'clientes'), nuevoClientePayload);
        clienteDestino = { id: nuevoRef.id, ...nuevoClientePayload };
      }
    }

    if (!modoNuevo && clienteDestino) {
      await updateDoc(doc(db, 'clientes', clienteDestino.id), {
        saldo: Number(clienteDestino.saldo || 0) + monto
      });
    }

    const fechaComprobante = formCargaCuenta.fechaComprobante
      ? new Date(`${formCargaCuenta.fechaComprobante}T12:00:00`)
      : new Date();
    const fechaMovimiento = Number.isNaN(fechaComprobante.getTime()) ? new Date().toISOString() : fechaComprobante.toISOString();
    const tipoComprobanteNormalizado = normalizarTipoComprobanteHistorico(formCargaCuenta.tipoComprobante);
    const tipoComprobante = obtenerEtiquetaTipoComprobanteHistorico(tipoComprobanteNormalizado);
    const numeroComprobante = (formCargaCuenta.numeroComprobante || '').trim();

    await addDoc(collection(db, 'movimientos'), {
      tipo: 'saldo_inicial_cc',
      monto,
      descripcion: (formCargaCuenta.descripcion || '').trim() || `Carga histórica ${tipoComprobante}${numeroComprobante ? ` Nº ${numeroComprobante}` : ''}`,
      metodoPago: 'cuenta_corriente',
      noImpactaCaja: true,
      detallesPago: {
        clienteId: clienteDestino?.id || '',
        cliente: clienteDestino?.nombre || '',
        whatsapp: clienteDestino?.whatsapp || '',
        documento: clienteDestino?.documento || '',
        tipoComprobante: tipoComprobanteNormalizado,
        numeroComprobante,
        fechaComprobante: formCargaCuenta.fechaComprobante || obtenerFechaInputLocal(),
        origen: 'historico_cc'
      },
      fecha: fechaMovimiento,
      usuario: usuarioActual.nombre
    });

    setFormCargaCuenta(crearFormularioCargaCuentaVacio());
    setModalActivo(null);
    await notificarSistema('Cuenta histórica cargada correctamente. Se reflejó en Cuentas Corrientes sin impactar la caja actual.', {
      tipo: 'success',
      titulo: 'Carga realizada'
    });
  };

  const manejarBusquedaClienteCuentaCorriente = (valor) => {
    const valorLimpio = valor || '';
    const valorNormalizado = normalizarTextoBusqueda(valorLimpio);
    const encontrado = clientes.find((c) => {
      const idTexto = normalizarTextoBusqueda(obtenerNumeroClienteTexto(c));
      return (
        normalizarTextoBusqueda(c?.nombre) === valorNormalizado ||
        normalizarTextoBusqueda(c?.whatsapp) === valorNormalizado ||
        normalizarTextoBusqueda(c?.documento) === valorNormalizado ||
        idTexto === valorNormalizado
      );
    });

    if (encontrado) {
      seleccionarClienteCuentaCorriente(encontrado);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      detallesPago: {
        ...prev.detallesPago,
        busquedaCliente: valorLimpio,
        clienteId: ''
      }
    }));
  };

  const obtenerSemaforoEstadoCuenta = (estado = {}) => {
    const tieneDeuda = Boolean(estado?.tieneDeuda);
    const dias = Math.max(0, Number.isFinite(estado?.diasDeuda) ? Number(estado.diasDeuda) : 0);

    if (!tieneDeuda) {
      return {
        estadoTexto: 'Al día',
        saldoClass: 'text-green-600',
        badgeClass: 'text-green-700 bg-green-50 border-green-200'
      };
    }

    if (dias <= 10) {
      return {
        estadoTexto: formatearTextoDias(dias),
        saldoClass: 'text-green-600',
        badgeClass: 'text-green-700 bg-green-50 border-green-200'
      };
    }

    if (dias <= 20) {
      return {
        estadoTexto: formatearTextoDias(dias),
        saldoClass: 'text-amber-600',
        badgeClass: 'text-amber-700 bg-amber-50 border-amber-200'
      };
    }

    if (dias <= 30) {
      return {
        estadoTexto: formatearTextoDias(dias),
        saldoClass: 'text-orange-600',
        badgeClass: 'text-orange-700 bg-orange-50 border-orange-200'
      };
    }

    return {
      estadoTexto: formatearTextoDias(dias),
      saldoClass: 'text-red-600',
      badgeClass: 'text-red-700 bg-red-50 border-red-200'
    };
  };

  const obtenerSemaforoDiasTicket = (dias = null) => {
    const n = Number.isFinite(dias) ? Number(dias) : null;
    if (n === null) {
      return {
        texto: 'Sin fecha',
        badgeClass: 'text-gray-500 bg-gray-100 border-gray-200',
        textoClass: 'text-gray-500'
      };
    }
    if (n <= 10) {
      return {
        texto: formatearTextoDias(n),
        badgeClass: 'text-green-700 bg-green-50 border-green-200',
        textoClass: 'text-green-600'
      };
    }
    if (n <= 20) {
      return {
        texto: formatearTextoDias(n),
        badgeClass: 'text-amber-700 bg-amber-50 border-amber-200',
        textoClass: 'text-amber-600'
      };
    }
    if (n <= 30) {
      return {
        texto: formatearTextoDias(n),
        badgeClass: 'text-orange-700 bg-orange-50 border-orange-200',
        textoClass: 'text-orange-600'
      };
    }
    return {
      texto: formatearTextoDias(n),
      badgeClass: 'text-red-700 bg-red-50 border-red-200',
      textoClass: 'text-red-600'
    };
  };

  const abrirCaja = async (e) => {
    e.preventDefault();
    try {
      const docRef = doc(db, 'sistema', 'caja');
      await setDoc(docRef, {
        estado: 'abierta',
        efectivoInicial: parseMontoCaja(formData.efectivo),
        chequesInicial: formData.tieneCheques ? parseMontoCaja(formData.cheques) : 0,
        fechaApertura: new Date().toISOString()
      }, { merge: true });
      setFormData({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} });
      setModalActivo(null);
    } catch (error) {
      console.error('Error al abrir caja', error);
      await notificarSistema('No se pudo abrir la caja. Revisa tu conexión e intenta nuevamente.', {
        tipo: 'error',
        titulo: 'Error al abrir caja'
      });
    }
  };

  const editarApertura = async (e) => {
    e.preventDefault();
    try {
      const docRef = doc(db, 'sistema', 'caja');
      await setDoc(docRef, {
        efectivoInicial: parseMontoCaja(formData.efectivo),
        chequesInicial: formData.tieneCheques ? parseMontoCaja(formData.cheques) : 0
      }, { merge: true });
      setFormData({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} });
      setModalActivo(null);
    } catch (error) {
      console.error('Error al editar apertura', error);
      await notificarSistema('No se pudo guardar la apertura. Intenta nuevamente.', {
        tipo: 'error',
        titulo: 'Error al guardar apertura'
      });
    }
  };

  const cerrarCaja = async (e) => { 
    e.preventDefault(); 
    const docRef = doc(db, 'sistema', 'caja');
    await updateDoc(docRef, { estado: 'cerrada', fechaApertura: null });
    setMontoCierreReal(''); setModalActivo(null); setVista('caja'); 
  };

  const guardarConfiguracion = async (e) => {
    e.preventDefault();
    const porcentajeRecargo = obtenerPorcentajeRecargoConfigurado(configuracion);
    const payloadConfiguracion = {
      ...CONFIG_DEFAULT,
      ...configuracion,
      recargosAutomaticosActivos: Boolean(configuracion?.recargosAutomaticosActivos),
      recargoMoraPorcentajeGlobal: porcentajeRecargo,
      // Compatibilidad con versiones anteriores
      recargoMoraPorcentaje: porcentajeRecargo
    };
    await setDoc(doc(db, 'sistema', 'configuracion'), payloadConfiguracion);
    await notificarSistema('Configuración guardada exitosamente.', {
      tipo: 'success',
      titulo: 'Cambios guardados'
    });
  };

  const procesarLogoNegocio = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notificarSistema('Selecciona un archivo de imagen válido (PNG o JPG).', {
        tipo: 'warning',
        titulo: 'Archivo inválido'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 360;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/png');
        setConfiguracion((prev) => ({ ...prev, logo: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const registrarMovimiento = async (e, tipo) => {
    e.preventDefault();
    const monto = parseFloat(formData.monto); if (!monto || monto <= 0) return;
    const esCuentaCorriente = formData.metodoPago === 'cuenta_corriente' && (tipo === 'venta' || tipo === 'ingreso_extra');
    
    let defaultDesc = 'Movimiento general';
    if (tipo === 'venta') defaultDesc = 'Venta general';
    if (tipo === 'gasto') defaultDesc = 'Gasto general';
    if (tipo === 'ingreso_extra') defaultDesc = 'Ingreso / Aporte extra';
    if (tipo === 'retiro_caja') defaultDesc = 'Retiro de caja';
    
    let nombreClienteCuenta = '';
    let clienteCuentaCorrienteId = '';

    if (esCuentaCorriente) {
      const clienteIdSeleccionado = (formData.detallesPago?.clienteId || '').trim();
      const modoNuevoCliente = Boolean(formData.detallesPago?.nuevoClienteManual);

      if (!clienteIdSeleccionado && !modoNuevoCliente) {
        await notificarSistema('Para cuenta corriente, selecciona un cliente existente o presiona "+" para crear uno nuevo.', {
          tipo: 'warning',
          titulo: 'Falta seleccionar cliente'
        });
        return;
      }

      if (clienteIdSeleccionado) {
        const clienteSeleccionadoCC = clientes.find((c) => c.id === clienteIdSeleccionado);
        if (!clienteSeleccionadoCC) {
          await notificarSistema('El cliente seleccionado ya no existe. Vuelve a seleccionarlo.', {
            tipo: 'warning',
            titulo: 'Cliente no disponible'
          });
          return;
        }
        await updateDoc(doc(db, 'clientes', clienteSeleccionadoCC.id), {
          saldo: Number(clienteSeleccionadoCC.saldo || 0) + monto,
          whatsapp: formData.detallesPago.whatsapp || clienteSeleccionadoCC.whatsapp || ''
        });
        clienteCuentaCorrienteId = clienteSeleccionadoCC.id;
        nombreClienteCuenta = clienteSeleccionadoCC.nombre || formData.detallesPago.cliente || 'Cliente sin nombre';
      } else {
        const nombreCliente = (formData.detallesPago?.cliente || '').trim();
        if (!nombreCliente) {
          await notificarSistema('Ingresa el nombre del nuevo cliente.', {
            tipo: 'warning',
            titulo: 'Nombre requerido'
          });
          return;
        }

        const clienteExistentePorNombre = clientes.find(
          (c) => normalizarTextoBusqueda(c.nombre) === normalizarTextoBusqueda(nombreCliente)
        );

        if (clienteExistentePorNombre) {
          await updateDoc(doc(db, 'clientes', clienteExistentePorNombre.id), {
            saldo: Number(clienteExistentePorNombre.saldo || 0) + monto,
            whatsapp: formData.detallesPago.whatsapp || clienteExistentePorNombre.whatsapp || ''
          });
          clienteCuentaCorrienteId = clienteExistentePorNombre.id;
          nombreClienteCuenta = clienteExistentePorNombre.nombre || nombreCliente;
        } else {
          const nuevoClienteRef = await addDoc(collection(db, 'clientes'), {
            numero: obtenerSiguienteNumeroCliente(),
            nombre: nombreCliente,
            whatsapp: formData.detallesPago.whatsapp || '',
            saldo: monto,
            esEspecial: false
          });
          clienteCuentaCorrienteId = nuevoClienteRef.id;
          nombreClienteCuenta = nombreCliente;
        }
      }
    }
    
    await addDoc(collection(db, 'movimientos'), {
      tipo,
      monto,
      descripcion: formData.descripcion || defaultDesc,
      metodoPago: formData.metodoPago,
      detallesPago: esCuentaCorriente
        ? { ...formData.detallesPago, cliente: nombreClienteCuenta, clienteId: clienteCuentaCorrienteId || formData.detallesPago?.clienteId || '' }
        : formData.detallesPago,
      fecha: new Date().toISOString(),
      usuario: usuarioActual.nombre
    });
    setFormData({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} }); setModalActivo(null);
  };

  const registrarCobro = async (e) => {
    e.preventDefault();
    const monto = parseFloat(formData.monto); if (!monto || monto <= 0) return;
    const tipoAbono = formData.detallesPago?.tipoAbono === 'ticket' ? 'ticket' : 'general';
    let movimientoRelacionadoId = '';
    let descripcionDefault = `Cobro de deuda a: ${clienteSeleccionado.nombre}`;

    if (tipoAbono === 'ticket') {
      movimientoRelacionadoId = formData.detallesPago?.movimientoRelacionadoId || '';
      const ticket = ticketsPendientesParaCobroClienteSeleccionado.find((t) => t.id === movimientoRelacionadoId);
      if (!ticket) {
        await notificarSistema('Selecciona un ticket impago para aplicar el cobro.', {
          tipo: 'warning',
          titulo: 'Ticket requerido'
        });
        return;
      }
      if (monto > (ticket.pendiente + 0.001)) {
        await notificarSistema(`El monto supera el pendiente del ticket seleccionado (${formatearDinero(ticket.pendiente)}).`, {
          tipo: 'warning',
          titulo: 'Monto excedido'
        });
        return;
      }
      descripcionDefault = `Cobro de ticket (${formatearFecha(ticket.fecha)}): ${ticket.descripcion || 'Venta a crédito'}`;
    }

    const fechaCobroIso = new Date().toISOString();
    const saldoAntesCliente = Math.max(0, Number(clienteSeleccionado.saldo || 0));
    const saldoDespuesCliente = Math.max(0, saldoAntesCliente - monto);
    const numeroRecibo = generarNumeroReciboCobro(fechaCobroIso);
    let restanteRecibo = monto;
    const itemsAplicadosRecibo = [];
    const ticketsOrdenados = (ticketsPendientesParaCobroClienteSeleccionado || [])
      .map((ticket) => ({
        id: ticket.id,
        fecha: ticket.fecha,
        descripcion: ticket.descripcion || 'Remito pendiente',
        pendiente: Math.max(0, Number(ticket.pendiente || 0))
      }))
      .filter((ticket) => ticket.pendiente > 0.009)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const aplicarCobroATicket = (ticket) => {
      if (!ticket || restanteRecibo <= 0) return;
      const pendienteAntes = Math.max(0, Number(ticket.pendiente || 0));
      if (pendienteAntes <= 0) return;
      const aplicado = Math.min(restanteRecibo, pendienteAntes);
      if (aplicado <= 0) return;
      const numeroRemito = textoSeguroTrim(
        ticket?.detallesPago?.numeroComprobante,
        textoSeguroTrim(ticket?.detallesPago?.comprobanteNumero, '')
      );
      restanteRecibo -= aplicado;
      itemsAplicadosRecibo.push({
        cargoId: ticket.id,
        fechaRemito: ticket.fecha || null,
        descripcion: ticket.descripcion || 'Remito pendiente',
        numeroRemito,
        pendienteAntes,
        aplicado,
        pendienteDespues: Math.max(0, pendienteAntes - aplicado)
      });
    };

    if (tipoAbono === 'ticket' && movimientoRelacionadoId) {
      const ticketPrincipal = ticketsOrdenados.find((ticket) => ticket.id === movimientoRelacionadoId);
      aplicarCobroATicket(ticketPrincipal);
    }
    if (restanteRecibo > 0) {
      ticketsOrdenados.forEach((ticket) => {
        if (restanteRecibo <= 0) return;
        if (tipoAbono === 'ticket' && ticket.id === movimientoRelacionadoId) return;
        aplicarCobroATicket(ticket);
      });
    }

    await updateDoc(doc(db, 'clientes', clienteSeleccionado.id), {
      saldo: saldoDespuesCliente
    });
    await addDoc(collection(db, 'movimientos'), {
      tipo: 'cobro',
      monto,
      descripcion: (formData.descripcion || '').trim() || descripcionDefault,
      metodoPago: formData.metodoPago,
      detallesPago: {
        ...formData.detallesPago,
        clienteId: clienteSeleccionado.id,
        cliente: clienteSeleccionado.nombre,
        tipoAbono,
        movimientoRelacionadoId,
        recibo: {
          numero: numeroRecibo,
          fechaPago: fechaCobroIso,
          clienteId: clienteSeleccionado.id,
          clienteNombre: clienteSeleccionado.nombre || '',
          clienteWhatsapp: clienteSeleccionado.whatsapp || '',
          metodoPago: formData.metodoPago,
          tipoAbono,
          movimientoRelacionadoId,
          cobroTotal: monto,
          saldoAntes: saldoAntesCliente,
          saldoDespues: saldoDespuesCliente,
          itemsAplicados: itemsAplicadosRecibo,
          generadoAutomaticamente: true
        }
      },
      fecha: fechaCobroIso,
      usuario: usuarioActual.nombre
    });
    setFormData({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} }); setModalActivo(null); setClienteSeleccionado(null);
  };

  const confirmarEliminacion = (id) => {
    setMovimientoAEliminar(movimientos.find(m => m.id === id));
    setModalActivo('confirmar_eliminacion');
  };

  const ejecutarEliminacion = async () => {
    if (!movimientoAEliminar) return;
    const mov = movimientoAEliminar;
    
    if (mov.tipo === 'cobro' && mov.detallesPago?.clienteId) {
      const cliente = clientes.find(c => c.id === mov.detallesPago.clienteId);
      if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: cliente.saldo + mov.monto });
    }
    if (esMovimientoCargoCuentaCorriente(mov)) {
      const idCliente = mov.detallesPago?.clienteId || '';
      const nombreCliente = mov.detallesPago?.cliente?.trim();
      const cliente = (idCliente ? clientes.find((c) => c.id === idCliente) : null)
        || clientes.find(c => c.nombre.toLowerCase() === nombreCliente?.toLowerCase());
      if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: cliente.saldo - mov.monto });
    }
    
    await deleteDoc(doc(db, 'movimientos', mov.id));
    setModalActivo(null); setMovimientoAEliminar(null);
  };

  const iniciarEdicionMovimiento = (mov) => {
    setMovimientoAEditar(mov);
    setFormData({
      monto: mov.monto.toString(),
      descripcion: mov.descripcion,
      metodoPago: mov.metodoPago || 'efectivo',
      detallesPago: { ...(mov.detallesPago || {}) }
    });
    setModalActivo('editar_movimiento');
  };

  const recalcularSaldoClienteCuentaCorriente = async (clienteReferencia = null, movimientosOverride = null) => {
    const clienteId = clienteReferencia?.id || clienteReferencia?.clienteId || '';
    const clienteNombre = normalizarTextoBusqueda(clienteReferencia?.nombre || clienteReferencia?.cliente || '');
    if (!clienteId && !clienteNombre) return;

    const listaMovimientos = Array.isArray(movimientosOverride) ? movimientosOverride : movimientos;
    const saldoCalculado = listaMovimientos.reduce((acc, mov) => {
      const detalles = mov?.detallesPago || {};
      const movClienteId = detalles.clienteId || '';
      const movClienteNombre = normalizarTextoBusqueda(detalles.cliente || detalles.clienteNombre || '');
      const perteneceAlCliente = clienteId
        ? movClienteId === clienteId
        : Boolean(clienteNombre && movClienteNombre === clienteNombre);

      if (!perteneceAlCliente) return acc;

      const monto = Math.max(0, Number(mov?.monto || 0));
      if (mov?.tipo === 'cobro') return acc - monto;
      if (esMovimientoCargoCuentaCorriente(mov)) return acc + monto;
      return acc;
    }, 0);

    const clienteDestino = clienteId
      ? clientes.find((c) => c.id === clienteId)
      : clientes.find((c) => normalizarTextoBusqueda(c.nombre) === clienteNombre);

    if (clienteDestino?.id) {
      await updateDoc(doc(db, 'clientes', clienteDestino.id), {
        saldo: Math.max(0, saldoCalculado)
      });
    }
  };

  const guardarEdicionMovimiento = async (e) => {
    e.preventDefault();
    const montoEditado = parseFloat(formData.monto);
    if (!montoEditado || montoEditado <= 0) return;

    const movOriginal = movimientos.find(m => m.id === movimientoAEditar.id);
    const esCargaHistoricaEditada = movOriginal?.tipo === 'saldo_inicial_cc';

    if (esCargaHistoricaEditada) {
      const detallesEditados = { ...(formData.detallesPago || {}) };
      detallesEditados.numeroComprobante = (detallesEditados.numeroComprobante || '').trim();

      const movimientoActualizado = {
        ...movOriginal,
        monto: montoEditado,
        descripcion: formData.descripcion,
        metodoPago: 'cuenta_corriente',
        detallesPago: detallesEditados
      };

      await updateDoc(doc(db, 'movimientos', movimientoAEditar.id), {
        monto: montoEditado,
        descripcion: formData.descripcion,
        metodoPago: 'cuenta_corriente',
        detallesPago: detallesEditados
      });

      const movimientosRecalculados = movimientos.map((mov) => mov.id === movimientoAEditar.id ? movimientoActualizado : mov);
      await recalcularSaldoClienteCuentaCorriente(
        {
          id: movOriginal?.detallesPago?.clienteId || '',
          nombre: movOriginal?.detallesPago?.cliente || movOriginal?.detallesPago?.clienteNombre || ''
        },
        movimientosRecalculados
      );

      setModalActivo(null);
      setMovimientoAEditar(null);
      setFormData({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} });
      return;
    }

    if (movOriginal.tipo === 'cobro' && movOriginal.detallesPago?.clienteId) {
        const cliente = clientes.find(c => c.id === movOriginal.detallesPago.clienteId);
        if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: cliente.saldo + movOriginal.monto });
    }
    if (!esCargaHistoricaEditada && esMovimientoCargoCuentaCorriente(movOriginal)) {
        const idCliente = movOriginal.detallesPago?.clienteId || '';
        const nombreCliente = movOriginal.detallesPago?.cliente?.trim();
        if (idCliente || nombreCliente) {
            const cliente = (idCliente ? clientes.find((c) => c.id === idCliente) : null)
              || clientes.find(c => c.nombre.toLowerCase() === nombreCliente.toLowerCase());
            if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: cliente.saldo - movOriginal.monto });
        }
    }

    if (movOriginal.tipo === 'cobro' && movOriginal.detallesPago?.clienteId) {
        const cliente = clientes.find(c => c.id === movOriginal.detallesPago.clienteId);
        if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: Math.max(0, Number(cliente.saldo || 0) - montoEditado) });
    } else if (!esCargaHistoricaEditada && esMovimientoCargoCuentaCorriente(movOriginal) && formData.metodoPago === 'cuenta_corriente') {
        const clienteIdNuevo = formData.detallesPago?.clienteId || '';
        const nombreNuevo = formData.detallesPago?.cliente?.trim() || 'Cliente sin nombre';
        const cliente = (clienteIdNuevo ? clientes.find((c) => c.id === clienteIdNuevo) : null)
          || clientes.find(c => c.nombre.toLowerCase() === nombreNuevo.toLowerCase());
        if (cliente) {
            await updateDoc(doc(db, 'clientes', cliente.id), { saldo: cliente.saldo + montoEditado });
        } else {
            await addDoc(collection(db, 'clientes'), { numero: obtenerSiguienteNumeroCliente(), nombre: nombreNuevo, whatsapp: formData.detallesPago?.whatsapp || '', saldo: montoEditado, esEspecial: false });
        }
    }

    const detallesEditados = { ...(formData.detallesPago || {}) };
    if (movOriginal.tipo === 'saldo_inicial_cc') {
      detallesEditados.numeroComprobante = (detallesEditados.numeroComprobante || '').trim();
    }
    if (esRecargoMoraMovimiento(movOriginal)) {
      const porcentaje = Math.max(0, parseNumeroBasico(detallesEditados.porcentaje));
      const baseMonto = Math.max(0, parseNumeroBasico(detallesEditados.baseMonto || movOriginal?.detallesPago?.baseMonto || 0));
      detallesEditados.porcentaje = porcentaje;
      detallesEditados.baseMonto = baseMonto;
      detallesEditados.esRecargoMora = true;
    }

    await updateDoc(doc(db, 'movimientos', movimientoAEditar.id), {
        monto: montoEditado,
        descripcion: formData.descripcion,
        metodoPago: esCargaHistoricaEditada ? 'cuenta_corriente' : formData.metodoPago,
        detallesPago: detallesEditados
    });

    setModalActivo(null); setMovimientoAEditar(null); 
    setFormData({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} });
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    const esCajero = formUsuario.rol === 'cajero';
    const permisoEspecial = esCajero ? Boolean(formUsuario.puedeVerClientesEspeciales) : false;
    const permisoCombos = esCajero ? Boolean(formUsuario.puedeUsarCombos) : false;
    const permisoCargaHistorica = esCajero ? Boolean(formUsuario.puedeCargarCuentaHistorica) : false;
    const payloadUsuario = {
      ...formUsuario,
      puedeVerClientesEspeciales: permisoEspecial,
      puedeUsarCombos: permisoCombos,
      puedeCargarCuentaHistorica: permisoCargaHistorica,
      // Compatibilidad con versiones previas
      puedeVerCuentasInstitucionales: permisoEspecial
    };
    if (usuarioAEditar) {
      await updateDoc(doc(db, 'usuarios', usuarioAEditar.id), payloadUsuario);
    } else {
      await addDoc(collection(db, 'usuarios'), payloadUsuario);
    }
    setModalActivo(null); setFormUsuario(FORM_USUARIO_VACIO); setUsuarioAEditar(null);
  };

  const abrirFormularioCliente = (cliente = null) => {
    setClienteAEditar(cliente);
    setFormCliente({
      nombre: cliente?.nombre || '',
      whatsapp: cliente?.whatsapp || '',
      documento: cliente?.documento || '',
      email: cliente?.email || '',
      direccion: cliente?.direccion || '',
      notas: cliente?.notas || '',
      esEspecial: Boolean(cliente?.esEspecial)
    });
    setModalActivo('cliente_form');
  };

  const guardarCliente = async (e) => {
    e.preventDefault();
    const nombre = formCliente.nombre.trim();
    if (!nombre) {
      await notificarSistema('El nombre del cliente es obligatorio.', {
        tipo: 'warning',
        titulo: 'Nombre requerido'
      });
      return;
    }
    const usuarioEsAdmin = (usuarioActual?.rol || '').toLowerCase() === 'admin';
    const esEspecial = usuarioEsAdmin ? Boolean(formCliente.esEspecial) : Boolean(clienteAEditar?.esEspecial);

    const data = {
      nombre,
      whatsapp: (formCliente.whatsapp || '').trim(),
      documento: (formCliente.documento || '').trim(),
      email: (formCliente.email || '').trim(),
      direccion: (formCliente.direccion || '').trim(),
      notas: (formCliente.notas || '').trim(),
      esEspecial
    };

    if (clienteAEditar) {
      await updateDoc(doc(db, 'clientes', clienteAEditar.id), data);
    } else {
      await addDoc(collection(db, 'clientes'), { ...data, numero: obtenerSiguienteNumeroCliente(), saldo: 0 });
    }

    setModalActivo(null);
    setClienteAEditar(null);
    setFormCliente(formularioClienteVacio);
  };

  const abrirDetalleCliente = (cliente) => {
    if (!puedeVerClienteEnCuentas(cliente)) {
      notificarSistema('No tienes permiso para ver cuentas corrientes de clientes especiales.', {
        tipo: 'warning',
        titulo: 'Acceso restringido'
      });
      return;
    }
    setClienteSeleccionado(cliente);
    setModalActivo('cliente_detalle');
  };

  const esMovimientoRelacionadoACliente = (movimiento = {}, cliente = null) => {
    if (!movimiento || !cliente) return false;
    const detalles = movimiento.detallesPago || {};
    if (detalles.clienteId && detalles.clienteId === cliente.id) return true;

    const metodoNormalizado = normalizarMetodoPago(movimiento.metodoPago || '');
    if (metodoNormalizado !== 'cuenta_corriente') return false;

    const nombreMovimiento = normalizarTextoBusqueda(detalles.cliente || '');
    const nombreCliente = normalizarTextoBusqueda(cliente.nombre || '');
    return Boolean(nombreMovimiento && nombreCliente && nombreMovimiento === nombreCliente);
  };

  const limpiarCuentaCliente = async (cliente) => {
    if ((usuarioActual?.rol || '').toLowerCase() !== 'admin') return;
    const estado = estadoCuentaClientes[cliente?.id] || {};
    const saldoPendiente = Math.max(0, Number(estado.saldoPendiente || cliente?.saldo || 0));
    const relacionados = movimientos.filter((mov) => esMovimientoRelacionadoACliente(mov, cliente));
    const mensaje = `Se limpiará la cuenta corriente de "${cliente?.nombre || 'cliente'}".\n\nSe eliminarán ${relacionados.length} movimiento(s) asociado(s) y el saldo quedará en $0,00.\n\n¿Continuar?`;
    const confirmar = await confirmarSistema(mensaje, {
      tipo: 'warning',
      titulo: 'Limpiar cuenta corriente',
      textoAceptar: 'Sí, limpiar'
    });
    if (!confirmar) return;

    try {
      for (const mov of relacionados) {
        await deleteDoc(doc(db, 'movimientos', mov.id));
      }
      await updateDoc(doc(db, 'clientes', cliente.id), { saldo: 0 });
      if (clienteSeleccionado?.id === cliente.id) {
        setClienteSeleccionado((prev) => prev ? { ...prev, saldo: 0 } : prev);
      }
      await notificarSistema(`Cuenta limpia correctamente. Saldo previo: ${formatearDinero(saldoPendiente)}.`, {
        tipo: 'success',
        titulo: 'Cuenta limpiada'
      });
    } catch (error) {
      console.error('Error al limpiar cuenta del cliente', error);
      await notificarSistema('No se pudo limpiar la cuenta del cliente.', {
        tipo: 'error',
        titulo: 'Error'
      });
    }
  };

  const eliminarClienteDirectorio = async (cliente) => {
    if ((usuarioActual?.rol || '').toLowerCase() !== 'admin') return;
    const relacionados = movimientos.filter((mov) => esMovimientoRelacionadoACliente(mov, cliente));
    const mensaje = `Vas a eliminar al cliente "${cliente?.nombre || 'cliente'}".\n\nTambién se eliminarán ${relacionados.length} movimiento(s) de su cuenta corriente.\n\nEsta acción no se puede deshacer. ¿Continuar?`;
    const confirmar = await confirmarSistema(mensaje, {
      tipo: 'danger',
      titulo: 'Eliminar cliente',
      textoAceptar: 'Sí, eliminar'
    });
    if (!confirmar) return;

    try {
      for (const mov of relacionados) {
        await deleteDoc(doc(db, 'movimientos', mov.id));
      }
      await deleteDoc(doc(db, 'clientes', cliente.id));
      if (clienteSeleccionado?.id === cliente.id) {
        setClienteSeleccionado(null);
        if (modalActivo === 'cliente_detalle' || modalActivo === 'cobro') setModalActivo(null);
      }
      await notificarSistema('Cliente eliminado correctamente.', {
        tipo: 'success',
        titulo: 'Cliente eliminado'
      });
    } catch (error) {
      console.error('Error al eliminar cliente', error);
      await notificarSistema('No se pudo eliminar el cliente.', {
        tipo: 'error',
        titulo: 'Error'
      });
    }
  };

  const abrirCobroCliente = (cliente) => {
    if (!puedeVerClienteEnCuentas(cliente)) {
      notificarSistema('No tienes permiso para registrar cobros en clientes especiales.', {
        tipo: 'warning',
        titulo: 'Acceso restringido'
      });
      return;
    }
    const estadoCliente = calcularEstadoCuentaCliente(cliente);
    const esAdmin = (usuarioActual?.rol || '').toLowerCase() === 'admin';
    const ticketsPendientesCobro = esAdmin
      ? (estadoCliente.ticketsPendientes || [])
      : (estadoCliente.ticketsPendientes || []).filter((ticket) => !esRecargoMoraMovimiento(ticket));
    const primerTicketPendiente = ticketsPendientesCobro[0] || null;
    const saldoNumerico = Number(cliente.saldo || 0);
    const saldoPendienteTickets = ticketsPendientesCobro
      .reduce((acc, ticket) => acc + Number(ticket.pendiente || 0), 0);
    const saldoPendienteTotal = Math.max(0, saldoNumerico, saldoPendienteTickets);
    const usarModoTicket = saldoNumerico <= 0 && !!primerTicketPendiente;
    const montoBase = usarModoTicket
      ? Number(primerTicketPendiente.pendiente || 0)
      : saldoPendienteTotal;

    setClienteSeleccionado(cliente);
    setFormData({
      monto: montoBase > 0 ? montoBase.toFixed(2) : '',
      descripcion: '',
      metodoPago: 'efectivo',
      detallesPago: {
        clienteId: cliente.id,
        tipoAbono: usarModoTicket ? 'ticket' : 'general',
        movimientoRelacionadoId: usarModoTicket ? primerTicketPendiente.id : ''
      }
    });
    setModalActivo('cobro');
  };

  const abrirRecargosCliente = (cliente) => {
    if ((usuarioActual?.rol || '').toLowerCase() !== 'admin') return;
    if (!cliente) return;
    setClienteSeleccionado(cliente);
    setFormRecargoCliente(crearFormularioRecargoVacio(obtenerPorcentajeRecargoConfigurado(configuracion)));
    setModalActivo('recargos_cliente');
  };

  const aplicarRecargoManualCliente = async (e) => {
    e.preventDefault();
    if ((usuarioActual?.rol || '').toLowerCase() !== 'admin') return;
    if (!clienteSeleccionado) return;

    const porcentaje = Math.max(0, parseNumeroBasico(formRecargoCliente?.porcentaje));
    if (porcentaje <= 0) {
      await notificarSistema('Ingresa un porcentaje válido mayor a cero.', {
        tipo: 'warning',
        titulo: 'Porcentaje inválido'
      });
      return;
    }

    const cargosObjetivo = formRecargoCliente?.cargoId
      ? ticketsVencidosParaRecargoClienteSeleccionado.filter((ticket) => ticket.id === formRecargoCliente.cargoId)
      : ticketsVencidosParaRecargoClienteSeleccionado;

    if (!cargosObjetivo.length) {
      await notificarSistema('No hay remitos impagos con más de 30 días para aplicar recargo.', {
        tipo: 'info',
        titulo: 'Sin remitos vencidos'
      });
      return;
    }

    const operacionRecargoId = `RCM-${clienteSeleccionado.id}-${Date.now()}`;
    const aplicadoEnOperacion = new Date().toISOString();
    let totalRecargo = 0;
    for (const cargo of cargosObjetivo) {
      const basePendiente = Math.max(0, Number(cargo.pendiente || 0));
      if (basePendiente <= 0) continue;
      const montoRecargo = Math.round((basePendiente * (porcentaje / 100)) * 100) / 100;
      if (montoRecargo <= 0) continue;
      totalRecargo += montoRecargo;
      await addDoc(collection(db, 'movimientos'), {
        tipo: 'recargo_mora',
        monto: montoRecargo,
        descripcion: `Recargo manual ${porcentaje}% • ${cargo.descripcion || 'Remito impago'}`,
        metodoPago: 'cuenta_corriente',
        noImpactaCaja: true,
        detallesPago: {
          clienteId: clienteSeleccionado.id,
          cliente: clienteSeleccionado.nombre || '',
          cargoOrigenId: cargo.id,
          porcentaje,
          tramoIndice: 0,
          diasImpago: Number(cargo.diasImpago || 0),
          baseMonto: basePendiente,
          aplicadoEn: aplicadoEnOperacion,
          operacionRecargoId,
          origenRecargo: 'manual',
          esRecargoMora: true,
          visibleSoloAdmin: true,
          cargoDescripcion: cargo.descripcion || 'Remito impago'
        },
        fecha: aplicadoEnOperacion,
        usuario: usuarioActual?.nombre || 'Sistema'
      });
    }

    if (totalRecargo > 0) {
      await updateDoc(doc(db, 'clientes', clienteSeleccionado.id), {
        saldo: Number(clienteSeleccionado.saldo || 0) + totalRecargo
      });
    }

    setFormRecargoCliente(crearFormularioRecargoVacio(porcentaje));
    await notificarSistema(`Recargo aplicado: ${formatearDinero(totalRecargo)} en ${cargosObjetivo.length} remito(s).`, {
      tipo: 'success',
      titulo: 'Recargo guardado'
    });
  };

  const eliminarRecargoCliente = async (movRecargo) => {
    if ((usuarioActual?.rol || '').toLowerCase() !== 'admin') return;
    if (!clienteSeleccionado || !movRecargo || !esRecargoMoraMovimiento(movRecargo)) return;

    const pendienteRecargo = Math.max(0, Number(pendientePorCargoIdSeleccionado[movRecargo.id] ?? movRecargo.monto ?? 0));
    const confirmar = await confirmarSistema(
      `Se eliminará este recargo de ${formatearDinero(Number(movRecargo.monto || 0))}.${pendienteRecargo > 0 ? `\nSe descontará del saldo pendiente ${formatearDinero(pendienteRecargo)}.` : ''}`,
      {
        tipo: 'warning',
        titulo: 'Eliminar recargo',
        textoAceptar: 'Sí, eliminar'
      }
    );
    if (!confirmar) return;

    await deleteDoc(doc(db, 'movimientos', movRecargo.id));
    await updateDoc(doc(db, 'clientes', clienteSeleccionado.id), {
      saldo: Math.max(0, Number(clienteSeleccionado.saldo || 0) - pendienteRecargo)
    });
  };

  const ajustarPorcentajeRecargoCliente = async (movRecargo) => {
    if ((usuarioActual?.rol || '').toLowerCase() !== 'admin') return;
    if (!clienteSeleccionado || !movRecargo || !esRecargoMoraMovimiento(movRecargo)) return;
    const porcentajeActual = Number(movRecargo?.detallesPago?.porcentaje || 0);
    const entrada = await promptSistema('Ingresa el nuevo porcentaje para este recargo.', {
      tipo: 'warning',
      titulo: 'Editar recargo',
      textoAceptar: 'Guardar',
      inputLabel: 'Nuevo porcentaje',
      inputPlaceholder: 'Ej: 10',
      inputValue: String(porcentajeActual || '').replace('.', ','),
      inputType: 'text'
    });
    if (entrada === null) return;
    const porcentajeNuevo = Math.max(0, parseNumeroBasico(entrada));
    if (porcentajeNuevo <= 0) {
      await eliminarRecargoCliente(movRecargo);
      return;
    }

    const baseMonto = Math.max(
      0,
      Number(movRecargo?.detallesPago?.baseMonto || 0)
      || (porcentajeActual > 0 ? Number(movRecargo.monto || 0) / (porcentajeActual / 100) : 0)
    );
    if (baseMonto <= 0) {
      await notificarSistema('No se pudo recalcular la base del recargo.', {
        tipo: 'warning',
        titulo: 'Base inválida'
      });
      return;
    }

    const nuevoMonto = Math.round((baseMonto * (porcentajeNuevo / 100)) * 100) / 100;
    const diferencia = nuevoMonto - Number(movRecargo.monto || 0);
    await updateDoc(doc(db, 'movimientos', movRecargo.id), {
      monto: nuevoMonto,
      descripcion: `Recargo ${(movRecargo?.detallesPago?.origenRecargo || 'manual') === 'automatico' ? 'automático' : 'manual'} ${porcentajeNuevo}% • ${movRecargo?.detallesPago?.cargoDescripcion || movRecargo.descripcion || 'Cuenta corriente'}`,
      detallesPago: {
        ...(movRecargo.detallesPago || {}),
        porcentaje: porcentajeNuevo,
        baseMonto
      }
    });
    await updateDoc(doc(db, 'clientes', clienteSeleccionado.id), {
      saldo: Math.max(0, Number(clienteSeleccionado.saldo || 0) + diferencia)
    });
  };

  const quitarTodosRecargosCliente = async () => {
    if ((usuarioActual?.rol || '').toLowerCase() !== 'admin') return;
    if (!clienteSeleccionado) return;
    const recargos = movimientosClienteSeleccionado.filter((mov) => esRecargoMoraMovimiento(mov));
    if (!recargos.length) {
      await notificarSistema('Este cliente no tiene recargos aplicados.', {
        tipo: 'info',
        titulo: 'Sin recargos'
      });
      return;
    }

    const pendienteTotal = recargos.reduce((acc, mov) => acc + Math.max(0, Number(pendientePorCargoIdSeleccionado[mov.id] ?? mov.monto ?? 0)), 0);
    const confirmar = await confirmarSistema(
      `Se quitarán ${recargos.length} recargo(s) del cliente.\nSaldo a descontar: ${formatearDinero(pendienteTotal)}.`,
      {
        tipo: 'warning',
        titulo: 'Quitar recargos',
        textoAceptar: 'Sí, quitar'
      }
    );
    if (!confirmar) return;

    for (const mov of recargos) {
      await deleteDoc(doc(db, 'movimientos', mov.id));
    }
    await updateDoc(doc(db, 'clientes', clienteSeleccionado.id), {
      saldo: Math.max(0, Number(clienteSeleccionado.saldo || 0) - pendienteTotal)
    });
    await notificarSistema('Recargos eliminados. La cuenta volvió a su saldo base pendiente.', {
      tipo: 'success',
      titulo: 'Recargos quitados'
    });
  };

  const abrirFormularioUsuario = (usuario = null) => {
    setUsuarioAEditar(usuario);
    setFormUsuario({
      nombre: usuario?.nombre || '',
      username: usuario?.username || '',
      password: (usuario?.password ?? '').toString(),
      rol: usuario?.rol === 'admin' ? 'admin' : (usuario?.rol === 'vendedor' ? 'vendedor' : 'cajero'),
      puedeVerClientesEspeciales: Boolean(usuario?.puedeVerClientesEspeciales || usuario?.puedeVerCuentasInstitucionales),
      puedeUsarCombos: Boolean(usuario?.puedeUsarCombos),
      puedeCargarCuentaHistorica: Boolean(usuario?.puedeCargarCuentaHistorica)
    });
    setModalActivo('usuario_form');
  };

  const eliminarUsuario = async (id) => {
    if (id === usuarioActual.id) {
      await notificarSistema('No puedes eliminar tu propio usuario mientras estás conectado.', {
        tipo: 'warning',
        titulo: 'Acción no permitida'
      });
      return;
    }
    const confirmar = await confirmarSistema('¿Estás seguro de que deseas eliminar este usuario?', {
      tipo: 'danger',
      titulo: 'Eliminar usuario',
      textoAceptar: 'Sí, eliminar'
    });
    if (!confirmar) return;
    await deleteDoc(doc(db, 'usuarios', id));
  };

  const imprimirReporte = () => { window.print(); };

  const esperarFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const esperarMs = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

  const obtenerNombreArchivoOferta = (oferta, conExtension = true) => {
    const fecha = new Date(oferta?.fecha || Date.now()).toISOString().slice(0, 10).replace(/-/g, '');
    const base = `oferta_${normalizarTextoArchivo(oferta?.titulo || 'ofertas')}_${fecha}`;
    return conExtension ? `${base}.pdf` : base;
  };

  const obtenerNombreArchivoCombo = (combo, conExtension = true) => {
    const fecha = new Date(combo?.fecha || Date.now()).toISOString().slice(0, 10).replace(/-/g, '');
    const base = `combo_${normalizarTextoArchivo(combo?.titulo || 'combo')}_${fecha}`;
    return conExtension ? `${base}.pdf` : base;
  };

  const obtenerNombreArchivoCatalogo = (catalogo, conExtension = true) => {
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const alcance = normalizarTextoArchivo(catalogo?.alcanceLabel || 'catalogo');
    const base = `catalogo_${alcance}_${fecha}`;
    return conExtension ? `${base}.pdf` : base;
  };

  const obtenerNombreArchivoVistaImpresion = () => {
    if (modalActivo === 'imprimir_presupuesto' && presupuestoAImprimir) {
      return obtenerNombreArchivoPresupuesto(presupuestoAImprimir, true);
    }
    if (modalActivo === 'imprimir_combo' && comboAImprimir) {
      return obtenerNombreArchivoCombo(comboAImprimir, true);
    }
    if (modalActivo === 'imprimir_oferta' && ofertaAImprimir) {
      return obtenerNombreArchivoOferta(ofertaAImprimir, true);
    }
    if (modalActivo === 'imprimir_catalogo' && catalogoAImprimir) {
      return obtenerNombreArchivoCatalogo(catalogoAImprimir, true);
    }
    return `documento_${obtenerFechaInputLocal().replace(/-/g, '')}.pdf`;
  };

  const descargarPdfVistaImpresion = async () => {
    if (typeof window === 'undefined') return;
    const htmlToImageApi = window.htmlToImage;
    if (!htmlToImageApi?.toCanvas) {
      await notificarSistema('No se pudo iniciar la descarga PDF porque falta la librería de captura.', {
        tipo: 'warning',
        titulo: 'Descarga no disponible'
      });
      return;
    }

    const modalRoot = document.querySelector('.print-modal-root');
    const paginas = modalRoot ? Array.from(modalRoot.querySelectorAll('.print-a4-sheet')) : [];
    if (!paginas.length) {
      await notificarSistema('No hay páginas visibles para exportar.', {
        tipo: 'warning',
        titulo: 'Sin contenido'
      });
      return;
    }

    setDescargandoPdfVistaImpresion(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (let index = 0; index < paginas.length; index += 1) {
        const pagina = paginas[index];
        await esperarFrame();
        const canvas = await htmlToImageApi.toCanvas(pagina, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (index > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }
      pdf.save(obtenerNombreArchivoVistaImpresion());
    } catch (error) {
      console.error('No se pudo generar PDF desde vista previa', error);
      if (modalActivo === 'imprimir_presupuesto' && presupuestoAImprimir) {
        try {
          const archivo = await generarPdfPresupuestoFile(presupuestoAImprimir);
          descargarArchivoTemporal(archivo);
          await notificarSistema('Se descargó el PDF con el generador interno como respaldo.', {
            tipo: 'warning',
            titulo: 'Descarga alternativa aplicada'
          });
          return;
        } catch (fallbackError) {
          console.error('También falló la generación alternativa del PDF', fallbackError);
        }
      }
      await notificarSistema('No se pudo descargar el PDF. Probá de nuevo o usá Imprimir.', {
        tipo: 'danger',
        titulo: 'Error de descarga'
      });
    } finally {
      setDescargandoPdfVistaImpresion(false);
    }
  };

  const toggleProductoOferta = (productoId) => {
    const producto = productos.find((p) => p.id === productoId);
    setOfertaSeleccionIds((prev) => {
      if (prev.includes(productoId)) {
        setOfertaPrecios((prevPrecios) => {
          const copia = { ...prevPrecios };
          delete copia[productoId];
          return copia;
        });
        return prev.filter((id) => id !== productoId);
      }
      setOfertaPrecios((prevPrecios) => ({
        ...prevPrecios,
        [productoId]: prevPrecios[productoId] ?? (producto?.precio ?? '')
      }));
      return [...prev, productoId];
    });
  };

  const actualizarPrecioOferta = (productoId, valor) => {
    setOfertaPrecios((prev) => ({ ...prev, [productoId]: valor }));
  };

  const limpiarEditorOferta = () => {
    const rangoDefault = obtenerRangoVigenciaOfertaDefault();
    setOfertaEditandoId(null);
    setOfertaTitulo('Ofertas Especiales');
    setOfertaAclaraciones('');
    setOfertaVigenciaDesde(rangoDefault.desde);
    setOfertaVigenciaHasta(rangoDefault.hasta);
    setOfertaSeleccionIds([]);
    setOfertaPrecios({});
  };

  const iniciarNuevaOferta = () => {
    limpiarEditorOferta();
    setOfertaEditorActivo(true);
  };

  const cancelarEdicionOferta = async () => {
    const vigenciaDefault = obtenerRangoVigenciaOfertaDefault();
    const hayCambios = (
      Boolean(ofertaEditandoId)
      || 
      (ofertaTitulo || '').trim() !== 'Ofertas Especiales'
      || Boolean((ofertaAclaraciones || '').trim())
      || ofertaVigenciaDesde !== vigenciaDefault.desde
      || ofertaVigenciaHasta !== vigenciaDefault.hasta
      || ofertaSeleccionIds.length > 0
      || Object.keys(ofertaPrecios || {}).length > 0
    );
    if (hayCambios) {
      const confirmar = await confirmarSistema('Se descartará la oferta en curso. ¿Deseas continuar?', {
        tipo: 'warning',
        titulo: 'Cancelar oferta',
        textoAceptar: 'Sí, cancelar'
      });
      if (!confirmar) return;
    }
    limpiarEditorOferta();
    setOfertaEditorActivo(false);
  };

  const construirItemsOfertaDesdeEditor = () => productosOfertaSeleccionados.map((p) => ({
    id: p.id,
    descripcion: textoSeguroTrim(p.descripcion, ''),
    detalles: textoSeguroTrim(p.detalles, ''),
    precio: parseNumeroPresupuesto(p.precioOferta),
    imagen: p.imagen || ''
  }));

  const construirPayloadOfertaDesdeEditor = () => {
    const items = construirItemsOfertaDesdeEditor();
    return {
      id: ofertaEditandoId || null,
      titulo: (ofertaTitulo || 'Ofertas Especiales').trim(),
      aclaraciones: (ofertaAclaraciones || '').trim(),
      vigenciaDesde: ofertaVigenciaDesde || '',
      vigenciaHasta: ofertaVigenciaHasta || '',
      fecha: new Date().toISOString(),
      items,
      totalReferencia: items.reduce((acc, item) => acc + parseNumeroPresupuesto(item.precio), 0)
    };
  };

  const construirPayloadOfertaDesdeGuardada = (oferta) => {
    const items = Array.isArray(oferta?.items) ? oferta.items : [];
    return {
      id: oferta?.id || null,
      titulo: textoSeguroTrim(oferta?.titulo, 'Ofertas Especiales'),
      aclaraciones: textoSeguroTrim(oferta?.aclaraciones, ''),
      vigenciaDesde: oferta?.vigenciaDesde || '',
      vigenciaHasta: oferta?.vigenciaHasta || '',
      fecha: oferta?.fechaActualizacion || oferta?.fechaCreacion || new Date().toISOString(),
      items: items.map((item) => ({
        id: item?.id || '',
        descripcion: textoSeguroTrim(item?.descripcion, ''),
        detalles: textoSeguroTrim(item?.detalles, ''),
        precio: parseNumeroPresupuesto(item?.precio),
        imagen: item?.imagen || ''
      })),
      totalReferencia: Number(oferta?.totalReferencia || 0)
    };
  };

  const construirClaveRenderOferta = (payload = {}) => {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const hashItems = items
      .map((item) => ([
        item?.id || '',
        textoSeguroTrim(item?.descripcion, ''),
        textoSeguroTrim(item?.detalles, ''),
        parseNumeroPresupuesto(item?.precio),
        item?.imagen || ''
      ].join('::')))
      .join('|');
    return [
      payload?.id || '',
      textoSeguroTrim(payload?.titulo, ''),
      textoSeguroTrim(payload?.aclaraciones, ''),
      payload?.vigenciaDesde || '',
      payload?.vigenciaHasta || '',
      payload?.fecha || '',
      hashItems
    ].join('||');
  };

  const obtenerArchivosOfertaConCache = async (payload = {}, opciones = {}) => {
    const forzar = Boolean(opciones?.forzar);
    const cacheKey = construirClaveRenderOferta(payload);
    if (!forzar && ofertaRenderCacheRef.current.has(cacheKey)) {
      return ofertaRenderCacheRef.current.get(cacheKey);
    }
    const archivos = await generarImagenesOfertaJpgFiles(payload);
    ofertaRenderCacheRef.current.set(cacheKey, archivos);
    return archivos;
  };

  const limpiarPreviewOferta = () => {
    setOfertaPreviewImagenes((prev) => {
      prev.forEach((item) => {
        if (item?.url) URL.revokeObjectURL(item.url);
      });
      return [];
    });
  };

  const cerrarPreviewOferta = () => {
    limpiarPreviewOferta();
    setModalActivo(null);
  };

  const previsualizarOfertaInterna = async () => {
    const payload = construirPayloadOfertaDesdeEditor();
    if (!payload.items.length) {
      await notificarSistema('Selecciona al menos un producto para previsualizar la oferta.', {
        tipo: 'warning',
        titulo: 'Sin productos seleccionados'
      });
      return;
    }
    try {
      const archivos = await generarImagenesOfertaJpgFiles(payload);
      if (!archivos.length) throw new Error('No se pudo construir la vista previa.');
      limpiarPreviewOferta();
      const imagenes = archivos.map((archivo) => ({ nombre: archivo.name, archivo, url: URL.createObjectURL(archivo) }));
      setOfertaPreviewImagenes(imagenes);
      setModalActivo('preview_oferta_flyer');
    } catch (error) {
      console.error('Error al previsualizar oferta', error);
      await notificarSistema('No se pudo generar la previsualización interna de la oferta.', {
        tipo: 'error',
        titulo: 'Error de previsualización'
      });
    }
  };

  const prepararOfertaJpg = async () => {
    const payload = construirPayloadOfertaDesdeEditor();
    if (!payload.items.length) {
      await notificarSistema('Selecciona al menos un producto para generar la oferta.', {
        tipo: 'warning',
        titulo: 'Sin productos seleccionados'
      });
      return;
    }
    await exportarOfertaComoJpg(payload);
  };

  const guardarOferta = async () => {
    const items = construirItemsOfertaDesdeEditor();
    if (!items.length) {
      await notificarSistema('Selecciona al menos un producto para guardar la oferta.', {
        tipo: 'warning',
        titulo: 'Sin productos seleccionados'
      });
      return;
    }

    const titulo = (ofertaTitulo || '').trim();
    if (!titulo) {
      await notificarSistema('Escribe un título para la oferta.', {
        tipo: 'warning',
        titulo: 'Título requerido'
      });
      return;
    }

    const payload = {
      titulo,
      aclaraciones: (ofertaAclaraciones || '').trim(),
      vigenciaDesde: esFechaInputValida(ofertaVigenciaDesde) ? ofertaVigenciaDesde : '',
      vigenciaHasta: esFechaInputValida(ofertaVigenciaHasta) ? ofertaVigenciaHasta : '',
      items,
      totalReferencia: items.reduce((acc, item) => acc + parseNumeroPresupuesto(item.precio), 0),
      usuario: usuarioActual?.nombre || 'Sistema',
      fechaActualizacion: new Date().toISOString()
    };

    if (ofertaEditandoId) {
      await updateDoc(doc(db, 'ofertas', ofertaEditandoId), payload);
      ofertaRenderCacheRef.current.clear();
      await notificarSistema('Oferta actualizada correctamente.', {
        tipo: 'success',
        titulo: 'Cambios guardados'
      });
      limpiarEditorOferta();
      setOfertaEditorActivo(false);
      return;
    }

    await addDoc(collection(db, 'ofertas'), {
      ...payload,
      fechaCreacion: new Date().toISOString()
    });
    ofertaRenderCacheRef.current.clear();
    await notificarSistema('Oferta guardada correctamente.', {
      tipo: 'success',
      titulo: 'Oferta guardada'
    });
    limpiarEditorOferta();
    setOfertaEditorActivo(false);
  };

  const abrirOfertaGuardadaEnEditor = (oferta) => {
    if (!oferta) return;
    const rangoDefault = obtenerRangoVigenciaOfertaDefault();
    const items = Array.isArray(oferta.items) ? oferta.items : [];
    const precios = {};
    const ids = [];
    items.forEach((item) => {
      if (!item?.id) return;
      ids.push(item.id);
      precios[item.id] = item?.precio ?? '';
    });
    setOfertaEditandoId(oferta.id || null);
    setOfertaTitulo(textoSeguroTrim(oferta?.titulo, 'Ofertas Especiales'));
    setOfertaAclaraciones(textoSeguroTrim(oferta?.aclaraciones, ''));
    setOfertaVigenciaDesde(esFechaInputValida(oferta.vigenciaDesde) ? oferta.vigenciaDesde : rangoDefault.desde);
    setOfertaVigenciaHasta(esFechaInputValida(oferta.vigenciaHasta) ? oferta.vigenciaHasta : (esFechaInputValida(oferta.vigenciaDesde) ? oferta.vigenciaDesde : rangoDefault.hasta));
    setOfertaSeleccionIds(ids);
    setOfertaPrecios(precios);
    setOfertaEditorActivo(true);
  };

  const abrirOfertaGuardadaParaJpg = async (oferta) => {
    if (!oferta) return;
    const payload = construirPayloadOfertaDesdeGuardada(oferta);
    const archivos = await obtenerArchivosOfertaConCache(payload);
    await exportarOfertaComoJpg(payload, { archivos });
  };

  const previsualizarOfertaGuardada = async (oferta) => {
    if (!oferta) return;
    const items = Array.isArray(oferta.items) ? oferta.items : [];
    if (!items.length) {
      await notificarSistema('La oferta no tiene productos para previsualizar.', {
        tipo: 'warning',
        titulo: 'Sin productos'
      });
      return;
    }
    try {
      const payload = construirPayloadOfertaDesdeGuardada(oferta);
      const archivos = await obtenerArchivosOfertaConCache(payload);
      if (!archivos.length) throw new Error('No se pudo construir la vista previa.');
      limpiarPreviewOferta();
      const imagenes = archivos.map((archivo) => ({ nombre: archivo.name, archivo, url: URL.createObjectURL(archivo) }));
      setOfertaPreviewImagenes(imagenes);
      setModalActivo('preview_oferta_flyer');
    } catch (error) {
      console.error('Error al previsualizar oferta guardada', error);
      await notificarSistema('No se pudo generar la previsualización de la oferta guardada.', {
        tipo: 'error',
        titulo: 'Error de previsualización'
      });
    }
  };

  const duplicarOferta = (oferta) => {
    if (!oferta) return;
    const rangoDefault = obtenerRangoVigenciaOfertaDefault();
    const items = Array.isArray(oferta.items) ? oferta.items : [];
    const ids = [];
    const precios = {};
    items.forEach((item) => {
      if (!item?.id) return;
      ids.push(item.id);
      precios[item.id] = item?.precio ?? '';
    });
    setOfertaEditandoId(null);
    setOfertaTitulo(`${textoSeguroTrim(oferta?.titulo, 'Ofertas Especiales')} (Copia)`);
    setOfertaAclaraciones(textoSeguroTrim(oferta?.aclaraciones, ''));
    setOfertaVigenciaDesde(esFechaInputValida(oferta.vigenciaDesde) ? oferta.vigenciaDesde : rangoDefault.desde);
    setOfertaVigenciaHasta(esFechaInputValida(oferta.vigenciaHasta) ? oferta.vigenciaHasta : (esFechaInputValida(oferta.vigenciaDesde) ? oferta.vigenciaDesde : rangoDefault.hasta));
    setOfertaSeleccionIds(ids);
    setOfertaPrecios(precios);
    setOfertaEditorActivo(true);
  };

  const eliminarOferta = async (ofertaId) => {
    if (!ofertaId) return;
    const confirmar = await confirmarSistema('¿Seguro que deseas eliminar esta oferta guardada?', {
      tipo: 'danger',
      titulo: 'Eliminar oferta',
      textoAceptar: 'Sí, eliminar'
    });
    if (!confirmar) return;
    await deleteDoc(doc(db, 'ofertas', ofertaId));
    ofertaRenderCacheRef.current.clear();
    if (ofertaEditandoId === ofertaId) {
      limpiarEditorOferta();
      setOfertaEditorActivo(false);
    }
  };

  const limpiarEditorCombo = () => {
    setComboEditandoId(null);
    setComboTitulo('Combo Especial');
    setComboAclaraciones('');
    setComboSeleccionIds([]);
    setComboPrecios({});
    setComboCantidades({});
    setComboMostrarPrecioItem(true);
    setComboMostrarLogoMarca(true);
  };

  const iniciarNuevoCombo = () => {
    limpiarEditorCombo();
    setComboEditorActivo(true);
  };

  const cancelarEdicionCombo = async () => {
    const hayCambios = (
      Boolean(comboEditandoId)
      || (comboTitulo || '').trim() !== 'Combo Especial'
      || Boolean((comboAclaraciones || '').trim())
      || comboSeleccionIds.length > 0
      || Object.keys(comboPrecios || {}).length > 0
      || Object.keys(comboCantidades || {}).length > 0
      || comboMostrarPrecioItem !== true
      || comboMostrarLogoMarca !== true
    );
    if (hayCambios) {
      const confirmar = await confirmarSistema('Se descartará el combo en edición. ¿Deseas continuar?', {
        tipo: 'warning',
        titulo: 'Cancelar combo',
        textoAceptar: 'Sí, cancelar'
      });
      if (!confirmar) return;
    }
    limpiarEditorCombo();
    setComboEditorActivo(false);
  };

  const limpiarItemsTildadosCombo = () => {
    setComboSeleccionIds([]);
    setComboPrecios({});
    setComboCantidades({});
  };

  const toggleProductoCombo = (productoId) => {
    const producto = productos.find((p) => p.id === productoId);
    setComboSeleccionIds((prev) => {
      if (prev.includes(productoId)) {
        setComboPrecios((prevPrecios) => {
          const copia = { ...prevPrecios };
          delete copia[productoId];
          return copia;
        });
        setComboCantidades((prevCantidades) => {
          const copia = { ...prevCantidades };
          delete copia[productoId];
          return copia;
        });
        return prev.filter((id) => id !== productoId);
      }
      setComboPrecios((prevPrecios) => ({
        ...prevPrecios,
        [productoId]: prevPrecios[productoId] ?? (producto?.precio ?? '')
      }));
      setComboCantidades((prevCantidades) => ({
        ...prevCantidades,
        [productoId]: prevCantidades[productoId] ?? 1
      }));
      return [...prev, productoId];
    });
  };

  const actualizarPrecioCombo = (productoId, valor) => {
    setComboPrecios((prev) => ({ ...prev, [productoId]: valor }));
  };

  const actualizarCantidadCombo = (productoId, valor) => {
    setComboCantidades((prev) => ({ ...prev, [productoId]: valor }));
  };

  const construirItemsComboDesdeEditor = () => productosComboSeleccionados.map((p) => ({
    id: p.id,
    codigo: p.codigo || '',
    descripcion: p.descripcion || '',
    detalles: (p.detalles || '').trim(),
    unidad: p.unidad || 'unid',
    cantidad: parseNumeroBasico(p.cantidadCombo) || 1,
    precio: parseNumeroPresupuesto(p.precioCombo),
    costoBase: parseNumeroBasico(p.costo),
    imagen: p.imagen || '',
    logoMarca: p.logoMarca || ''
  }));

  const prepararComboPdfDesdeEditor = () => {
    const items = construirItemsComboDesdeEditor();
    if (!items.length) {
      notificarSistema('Selecciona al menos un producto para generar el combo.', {
        tipo: 'warning',
        titulo: 'Sin productos seleccionados'
      });
      return;
    }
    const total = items.reduce((acc, item) => acc + (parseNumeroPresupuesto(item.precio) * (parseNumeroPresupuesto(item.cantidad) || 1)), 0);
    setComboAImprimir({
      id: comboEditandoId || null,
      titulo: (comboTitulo || 'Combo Especial').trim(),
      aclaraciones: (comboAclaraciones || '').trim(),
      fecha: new Date().toISOString(),
      items,
      mostrarPrecioPorItem: Boolean(comboMostrarPrecioItem),
      mostrarLogoMarca: Boolean(comboMostrarLogoMarca),
      total
    });
    setModalActivo('imprimir_combo');
  };

  const guardarCombo = async () => {
    const items = construirItemsComboDesdeEditor();
    if (!items.length) {
      await notificarSistema('Selecciona al menos un producto para guardar el combo.', {
        tipo: 'warning',
        titulo: 'Sin productos seleccionados'
      });
      return;
    }

    const titulo = (comboTitulo || '').trim();
    if (!titulo) {
      await notificarSistema('Escribe un título para el combo.', {
        tipo: 'warning',
        titulo: 'Título requerido'
      });
      return;
    }

    const total = items.reduce((acc, item) => acc + (parseNumeroPresupuesto(item.precio) * (parseNumeroPresupuesto(item.cantidad) || 1)), 0);
    const payload = {
      titulo,
      aclaraciones: (comboAclaraciones || '').trim(),
      items,
      mostrarPrecioPorItem: Boolean(comboMostrarPrecioItem),
      mostrarLogoMarca: Boolean(comboMostrarLogoMarca),
      total,
      costoTotalEstimado: resumenGananciaComboActual.costoTotal,
      gananciaEstimada: resumenGananciaComboActual.ganancia,
      usuario: usuarioActual?.nombre || 'Sistema',
      fechaActualizacion: new Date().toISOString()
    };

    if (comboEditandoId) {
      await updateDoc(doc(db, 'combos', comboEditandoId), payload);
      limpiarItemsTildadosCombo();
      limpiarEditorCombo();
      setComboEditorActivo(false);
      await notificarSistema('Combo actualizado correctamente.', {
        tipo: 'success',
        titulo: 'Cambios guardados'
      });
      return;
    }

    await addDoc(collection(db, 'combos'), {
      ...payload,
      fechaCreacion: new Date().toISOString()
    });
    limpiarItemsTildadosCombo();
    limpiarEditorCombo();
    setComboEditorActivo(false);
    await notificarSistema('Combo guardado correctamente.', {
      tipo: 'success',
      titulo: 'Combo guardado'
    });
  };

  const abrirComboGuardadoEnEditor = (combo) => {
    if (!combo) return;
    const items = Array.isArray(combo.items) ? combo.items : [];
    const precios = {};
    const cantidades = {};
    const ids = [];
    items.forEach((item) => {
      if (item?.id) {
        ids.push(item.id);
        precios[item.id] = item?.precio ?? '';
        cantidades[item.id] = item?.cantidad ?? 1;
      }
    });
    setComboEditandoId(combo.id || null);
    setComboTitulo(combo.titulo || 'Combo Especial');
    setComboAclaraciones(combo.aclaraciones || '');
    setComboMostrarPrecioItem(combo.mostrarPrecioPorItem !== false);
    setComboMostrarLogoMarca(combo.mostrarLogoMarca !== false);
    setComboSeleccionIds(ids);
    setComboPrecios(precios);
    setComboCantidades(cantidades);
    setComboEditorActivo(true);
  };

  const abrirComboGuardadoParaPdf = (combo) => {
    if (!combo) return;
    const items = Array.isArray(combo.items) ? combo.items : [];
    const total = Number(combo.total || 0) || items.reduce((acc, item) => acc + (parseNumeroPresupuesto(item?.precio) * (parseNumeroPresupuesto(item?.cantidad) || 1)), 0);
    setComboAImprimir({
      id: combo.id || null,
      titulo: combo.titulo || 'Combo Especial',
      aclaraciones: combo.aclaraciones || '',
      fecha: combo.fechaActualizacion || combo.fechaCreacion || new Date().toISOString(),
      items: items.map((item) => ({
        id: item.id || '',
        codigo: item.codigo || '',
        descripcion: item.descripcion || '',
        detalles: item.detalles || '',
        unidad: item.unidad || 'unid',
        cantidad: parseNumeroPresupuesto(item.cantidad) || 1,
        precio: parseNumeroPresupuesto(item.precio),
        imagen: item.imagen || '',
        logoMarca: item.logoMarca || ''
      })),
      mostrarPrecioPorItem: combo.mostrarPrecioPorItem !== false,
      mostrarLogoMarca: combo.mostrarLogoMarca !== false,
      total
    });
    setModalActivo('imprimir_combo');
  };

  const duplicarCombo = (combo) => {
    if (!combo) return;
    const items = Array.isArray(combo.items) ? combo.items : [];
    const ids = [];
    const precios = {};
    const cantidades = {};
    items.forEach((item) => {
      if (!item?.id) return;
      ids.push(item.id);
      precios[item.id] = item?.precio ?? '';
      cantidades[item.id] = item?.cantidad ?? 1;
    });
    setComboEditandoId(null);
    setComboTitulo(`${combo.titulo || 'Combo Especial'} (Copia)`);
    setComboAclaraciones(combo.aclaraciones || '');
    setComboMostrarPrecioItem(combo.mostrarPrecioPorItem !== false);
    setComboMostrarLogoMarca(combo.mostrarLogoMarca !== false);
    setComboSeleccionIds(ids);
    setComboPrecios(precios);
    setComboCantidades(cantidades);
    setComboEditorActivo(true);
  };

  const eliminarCombo = async (comboId) => {
    if (!comboId) return;
    const confirmar = await confirmarSistema('¿Seguro que deseas eliminar este combo guardado?', {
      tipo: 'danger',
      titulo: 'Eliminar combo',
      textoAceptar: 'Sí, eliminar'
    });
    if (!confirmar) return;
    await deleteDoc(doc(db, 'combos', comboId));
    if (comboEditandoId === comboId) limpiarEditorCombo();
  };

  const mostrarDetalleModoPrecioCombo = async (combo) => {
    const porItem = combo?.mostrarPrecioPorItem !== false;
    await notificarSistema(
      porItem
        ? 'Este combo está configurado para mostrar precio unitario y subtotal por ítem en el PDF.'
        : 'Este combo está configurado para ocultar precios unitarios y mostrar únicamente el total final en el PDF.',
      {
        tipo: 'info',
        titulo: 'Detalle de modo de precio'
      }
    );
  };

  const mostrarDetalleGananciaCombo = async (combo) => {
    const resumenGanancia = resumenGananciaCombosMap[combo?.id] || { ganancia: 0, margen: 0 };
    await notificarSistema(
      `Ganancia estimada: ${formatearDinero(resumenGanancia.ganancia)}\nMargen estimado: ${resumenGanancia.margen.toFixed(1)}%`,
      {
        tipo: 'info',
        titulo: 'Detalle de ganancia estimada'
      }
    );
  };

  // --- MANEJADORES DE INVENTARIO ---
  const limpiarEdicionTaxonomias = () => {
    setCategoriaEnEdicion('');
    setCategoriaEditValor('');
    setMarcaEnEdicion('');
    setMarcaEditValor('');
  };

  const obtenerFactorIvaProducto = (iva) => {
    if (iva === '10.5') return 0.105;
    if (iva === '21') return 0.21;
    return 0;
  };

  const obtenerTasaDolarProducto = (productoForm = formProducto) => (
    parseNumeroBasico(productoForm?.cotizacionDolarBna)
    || parseNumeroBasico(cotizacionDolarBna?.venta)
    || 0
  );

  const obtenerCostoProductoEnPesos = (costo, monedaCosto = 'ARS', cotizacion = 0) => {
    const costoNumero = parseNumeroBasico(costo);
    if (monedaCosto === 'USD_BNA') return costoNumero * (parseNumeroBasico(cotizacion) || 0);
    return costoNumero;
  };

  const calcularPrecioVenta = (costo, ganancia, iva, monedaCosto = 'ARS', cotizacion = 0) => {
    const costoPesos = obtenerCostoProductoEnPesos(costo, monedaCosto, cotizacion);
    const g = parseNumeroBasico(ganancia);
    const p = costoPesos * (1 + (g / 100)) * (1 + obtenerFactorIvaProducto(iva));
    return p > 0 ? p.toFixed(2) : '';
  };

  const calcularGananciaDesdePrecioVenta = (costo, precio, iva, monedaCosto = 'ARS', cotizacion = 0) => {
    const costoPesos = obtenerCostoProductoEnPesos(costo, monedaCosto, cotizacion);
    const precioNumero = parseNumeroBasico(precio);
    const baseConIva = costoPesos * (1 + obtenerFactorIvaProducto(iva));
    if (baseConIva <= 0 || precioNumero <= 0) return '';
    const ganancia = ((precioNumero / baseConIva) - 1) * 100;
    return Number.isFinite(ganancia) ? ganancia.toFixed(2) : '';
  };

  const recalcularFormularioProducto = (productoForm, campoPreferido = 'ganancia') => {
    const monedaCosto = productoForm?.monedaCosto === 'USD_BNA' ? 'USD_BNA' : 'ARS';
    const cotizacion = obtenerTasaDolarProducto(productoForm);
    const tieneGanancia = (productoForm?.ganancia ?? '').toString().trim() !== '';
    const tienePrecio = (productoForm?.precio ?? '').toString().trim() !== '';

    if (campoPreferido === 'precio' || (!tieneGanancia && tienePrecio)) {
      return {
        ...productoForm,
        ganancia: calcularGananciaDesdePrecioVenta(productoForm.costo, productoForm.precio, productoForm.iva, monedaCosto, cotizacion)
      };
    }

    if (tieneGanancia) {
      return {
        ...productoForm,
        precio: calcularPrecioVenta(productoForm.costo, productoForm.ganancia, productoForm.iva, monedaCosto, cotizacion)
      };
    }

    return productoForm;
  };

  const consultarCotizacionDolarBna = async ({ silencioso = false } = {}) => {
    if (cotizacionDolarBnaPromiseRef.current) return cotizacionDolarBnaPromiseRef.current;

    const promesa = (async () => {
      setCotizacionDolarBnaCargando(true);
      setCotizacionDolarBnaEstado('Consultando dólar oficial BNA...');
      try {
        for (const url of BNA_CORS_URLS) {
          try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            const datos = extraerCotizacionDolarBna(html);
            if (datos?.venta > 0) {
              setCotizacionDolarBna(datos);
              setCotizacionDolarBnaEstado(`BNA venta ${formatearDinero(datos.venta)}${datos.hora ? ` · ${datos.hora}` : ''}`);
              setFormProducto((prev) => {
                if (prev.monedaCosto !== 'USD_BNA') return prev;
                return recalcularFormularioProducto({
                  ...prev,
                  cotizacionDolarBna: datos.venta,
                  cotizacionDolarBnaFecha: datos.fecha || '',
                  cotizacionDolarBnaHora: datos.hora || ''
                }, (prev.precio ?? '').toString().trim() && !(prev.ganancia ?? '').toString().trim() ? 'precio' : 'ganancia');
              });
              return datos;
            }
          } catch (error) {
            console.warn('No se pudo leer cotización BNA desde', url, error);
          }
        }
        throw new Error('No se encontró la cotización de Dolar U.S.A venta en BNA.');
      } catch (error) {
        setCotizacionDolarBnaEstado('No se pudo obtener el dólar oficial BNA.');
        if (!silencioso) {
          await notificarSistema('No se pudo consultar automáticamente la cotización del Banco Nación. Probá nuevamente antes de guardar el producto en USD oficial.', {
            tipo: 'warning',
            titulo: 'Dólar BNA no disponible'
          });
        }
        return null;
      } finally {
        cotizacionDolarBnaPromiseRef.current = null;
        setCotizacionDolarBnaCargando(false);
      }
    })();

    cotizacionDolarBnaPromiseRef.current = promesa;
    return promesa;
  };

  const actualizarMonedaCostoProducto = async (moneda) => {
    const monedaCosto = moneda === 'USD_BNA' ? 'USD_BNA' : 'ARS';
    setFormProducto((prev) => recalcularFormularioProducto({ ...prev, monedaCosto }, (prev.precio ?? '').toString().trim() && !(prev.ganancia ?? '').toString().trim() ? 'precio' : 'ganancia'));
    if (monedaCosto === 'USD_BNA') {
      const datos = await consultarCotizacionDolarBna({ silencioso: false });
      if (datos?.venta > 0) {
        setFormProducto((prev) => recalcularFormularioProducto({
          ...prev,
          monedaCosto,
          cotizacionDolarBna: datos.venta,
          cotizacionDolarBnaFecha: datos.fecha || '',
          cotizacionDolarBnaHora: datos.hora || ''
        }, (prev.precio ?? '').toString().trim() && !(prev.ganancia ?? '').toString().trim() ? 'precio' : 'ganancia'));
      }
    }
  };

  useEffect(() => {
    if (modalActivo !== 'nuevo_producto') return;
    if (!productoAEditar || formProducto.monedaCosto === 'USD_BNA') {
      consultarCotizacionDolarBna({ silencioso: true });
    }
  }, [modalActivo, productoAEditar?.id, formProducto.monedaCosto]);

  const procesarImagenProducto = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event?.target?.result || '';
      if (!dataUrl) return;
      setFormProducto((prev) => ({ ...prev, imagen: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const procesarLogoMarcaProducto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event?.target?.result || '';
      if (!dataUrl) return;
      setFormProducto((prev) => ({ ...prev, logoMarca: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const obtenerCodigosInventarioUsados = (excluirId = null) => {
    const usados = new Set();
    (productos || []).forEach((p) => {
      if (!p) return;
      if (excluirId && p.id === excluirId) return;
      const codigo = normalizarCodigoParaComparar(p.codigo || '');
      if (codigo) usados.add(codigo);
    });
    return usados;
  };

  const generarCodigoBarrasAutomatico = (excluirId = null) => {
    const usados = obtenerCodigosInventarioUsados(excluirId);
    for (let intento = 0; intento < 500; intento += 1) {
      const semilla = `${Date.now()}${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}${intento}`;
      const candidato = semilla.replace(/\D/g, '').slice(-13);
      const clave = normalizarCodigoParaComparar(candidato);
      if (clave && !usados.has(clave)) return candidato;
    }
    const fallback = `779${Date.now().toString().slice(-10)}`.slice(-13);
    return fallback;
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    const codigoIngresado = (formProducto.codigo || '').toString().trim();
    const codigoAutomatico = (!codigoIngresado && Boolean(formProducto.generarCodigoAutomatico))
      ? generarCodigoBarrasAutomatico(productoAEditar?.id || null)
      : '';
    const codigoFinal = (codigoIngresado || codigoAutomatico || '').trim();

    if (!codigoFinal) {
      await notificarSistema('Ingresa un código de barras o activa "Generar código automático".', {
        tipo: 'warning',
        titulo: 'Código requerido'
      });
      return;
    }

    const codigoNormalizado = normalizarCodigoParaComparar(codigoFinal);
    const duplicado = (productos || []).find((p) =>
      p?.id !== productoAEditar?.id &&
      normalizarCodigoParaComparar(p?.codigo || '') === codigoNormalizado
    );
    if (duplicado) {
      await notificarSistema(`Ya existe un producto con ese código de barras (${codigoFinal}).`, {
        tipo: 'warning',
        titulo: 'Código duplicado'
      });
      return;
    }

    const monedaCosto = formProducto.monedaCosto === 'USD_BNA' ? 'USD_BNA' : 'ARS';
    const cotizacionDolar = monedaCosto === 'USD_BNA' ? obtenerTasaDolarProducto(formProducto) : 0;
    const costoOriginal = parseNumeroBasico(formProducto.costo);
    if (monedaCosto === 'USD_BNA' && cotizacionDolar <= 0) {
      await notificarSistema('Para guardar un producto en USD oficial hace falta obtener primero la cotización de venta del Banco Nación.', {
        tipo: 'warning',
        titulo: 'Cotización requerida'
      });
      return;
    }
    const costoPesos = obtenerCostoProductoEnPesos(formProducto.costo, monedaCosto, cotizacionDolar);
    const gananciaCalculada = calcularGananciaDesdePrecioVenta(formProducto.costo, formProducto.precio, formProducto.iva, monedaCosto, cotizacionDolar);

    const data = {
      codigo: codigoFinal,
      categoria: (formProducto.categoria || '').trim(),
      marca: (formProducto.marca || '').trim(),
      descripcion: formProducto.descripcion,
      detalles: (formProducto.detalles || '').trim(),
      costo: costoPesos,
      costoOriginal,
      monedaCosto,
      cotizacionDolarBna: cotizacionDolar,
      cotizacionDolarBnaFecha: formProducto.cotizacionDolarBnaFecha || cotizacionDolarBna?.fecha || '',
      cotizacionDolarBnaHora: formProducto.cotizacionDolarBnaHora || cotizacionDolarBna?.hora || '',
      ganancia: parseNumeroBasico(formProducto.ganancia) || parseNumeroBasico(gananciaCalculada),
      iva: formProducto.iva,
      precio: parseNumeroBasico(formProducto.precio),
      unidad: formProducto.unidad,
      cantidad: parseNumeroBasico(formProducto.cantidad),
      imagen: formProducto.imagen || '',
      logoMarca: formProducto.logoMarca || ''
    };

    if (productoAEditar) {
      await updateDoc(doc(db, 'productos', productoAEditar.id), data);
    } else {
      await addDoc(collection(db, 'productos'), data);
    }
    setModalActivo(null); setProductoAEditar(null); limpiarEdicionTaxonomias();
    setFormProducto(crearFormularioProducto());
  };

  const eliminarProducto = async (id) => {
    const confirmar = await confirmarSistema('¿Seguro que deseas eliminar este producto del inventario?', {
      tipo: 'danger',
      titulo: 'Eliminar producto',
      textoAceptar: 'Sí, eliminar'
    });
    if (!confirmar) return;
    await deleteDoc(doc(db, 'productos', id));
  };

  const clonarProducto = (producto) => {
    if (!producto) return;
    setProductoAEditar(null);
    setFormProducto(crearFormularioProducto({
      ...producto,
      codigo: '',
      generarCodigoAutomatico: true
    }));
    limpiarEdicionTaxonomias();
    setModalActivo('nuevo_producto');
  };

  const normalizarTaxonomia = (valor) => (valor || '').toString().trim().toLowerCase();

  const iniciarEdicionCategoria = (categoria) => {
    setCategoriaEnEdicion(categoria);
    setCategoriaEditValor(categoria);
  };

  const cancelarEdicionCategoria = () => {
    setCategoriaEnEdicion('');
    setCategoriaEditValor('');
  };

  const renombrarCategoriaInventario = async (categoria, nuevoNombreRaw) => {
    const categoriaNorm = normalizarTaxonomia(categoria);
    if (!categoriaNorm) return;
    const afectados = productos.filter((p) => normalizarTaxonomia(p.categoria) === categoriaNorm);
    if (!afectados.length) return;

    const nuevoNombre = (nuevoNombreRaw || '').toString().trim();
    if (!nuevoNombre) {
      await notificarSistema('El nombre no puede quedar vacío.', {
        tipo: 'warning',
        titulo: 'Nombre inválido'
      });
      return;
    }
    const nuevoNorm = normalizarTaxonomia(nuevoNombre);
    if (nuevoNombre === (categoria || '').toString().trim()) return;

    const keyBusy = `categoria:${categoriaNorm}`;
    setGestionTaxonomiaBusy(keyBusy);
    try {
      await Promise.all(
        afectados.map((p) => updateDoc(doc(db, 'productos', p.id), { categoria: nuevoNombre }))
      );
      setFormProducto((prev) => (normalizarTaxonomia(prev.categoria) === categoriaNorm ? { ...prev, categoria: nuevoNombre } : prev));
      if (normalizarTaxonomia(configExportInventario.categoria) === categoriaNorm) {
        setConfigExportInventario((prev) => ({ ...prev, categoria: nuevoNombre }));
      }
    } finally {
      setGestionTaxonomiaBusy('');
    }
  };

  const guardarEdicionCategoria = async () => {
    const original = categoriaEnEdicion;
    if (!original) return;
    await renombrarCategoriaInventario(original, categoriaEditValor);
    cancelarEdicionCategoria();
  };

  const eliminarCategoriaInventario = async (categoria) => {
    const categoriaNorm = normalizarTaxonomia(categoria);
    if (!categoriaNorm) return;
    const afectados = productos.filter((p) => normalizarTaxonomia(p.categoria) === categoriaNorm);
    if (!afectados.length) return;

    const confirmar = await confirmarSistema(`Se quitará la categoría "${categoria}" de ${afectados.length} producto(s). ¿Deseas continuar?`, {
      tipo: 'warning',
      titulo: 'Quitar categoría',
      textoAceptar: 'Sí, quitar'
    });
    if (!confirmar) return;

    const keyBusy = `categoria:${categoriaNorm}`;
    setGestionTaxonomiaBusy(keyBusy);
    try {
      await Promise.all(
        afectados.map((p) => updateDoc(doc(db, 'productos', p.id), { categoria: '' }))
      );
      setFormProducto((prev) => (normalizarTaxonomia(prev.categoria) === categoriaNorm ? { ...prev, categoria: '' } : prev));
      if (normalizarTaxonomia(configExportInventario.categoria) === categoriaNorm) {
        setConfigExportInventario((prev) => ({ ...prev, categoria: '' }));
      }
    } finally {
      setGestionTaxonomiaBusy('');
    }
  };

  const iniciarEdicionMarca = (marca) => {
    setMarcaEnEdicion(marca);
    setMarcaEditValor(marca);
  };

  const cancelarEdicionMarca = () => {
    setMarcaEnEdicion('');
    setMarcaEditValor('');
  };

  const renombrarMarcaInventario = async (marca, nuevoNombreRaw) => {
    const marcaNorm = normalizarTaxonomia(marca);
    if (!marcaNorm) return;
    const afectados = productos.filter((p) => normalizarTaxonomia(p.marca) === marcaNorm);
    if (!afectados.length) return;

    const nuevoNombre = (nuevoNombreRaw || '').toString().trim();
    if (!nuevoNombre) {
      await notificarSistema('El nombre no puede quedar vacío.', {
        tipo: 'warning',
        titulo: 'Nombre inválido'
      });
      return;
    }
    const nuevoNorm = normalizarTaxonomia(nuevoNombre);
    if (nuevoNombre === (marca || '').toString().trim()) return;

    const keyBusy = `marca:${marcaNorm}`;
    setGestionTaxonomiaBusy(keyBusy);
    try {
      await Promise.all(
        afectados.map((p) => updateDoc(doc(db, 'productos', p.id), { marca: nuevoNombre }))
      );
      setFormProducto((prev) => (normalizarTaxonomia(prev.marca) === marcaNorm ? { ...prev, marca: nuevoNombre } : prev));
    } finally {
      setGestionTaxonomiaBusy('');
    }
  };

  const guardarEdicionMarca = async () => {
    const original = marcaEnEdicion;
    if (!original) return;
    await renombrarMarcaInventario(original, marcaEditValor);
    cancelarEdicionMarca();
  };

  const eliminarMarcaInventario = async (marca) => {
    const marcaNorm = normalizarTaxonomia(marca);
    if (!marcaNorm) return;
    const afectados = productos.filter((p) => normalizarTaxonomia(p.marca) === marcaNorm);
    if (!afectados.length) return;

    const confirmar = await confirmarSistema(`Se quitará la marca "${marca}" de ${afectados.length} producto(s). ¿Deseas continuar?`, {
      tipo: 'warning',
      titulo: 'Quitar marca',
      textoAceptar: 'Sí, quitar'
    });
    if (!confirmar) return;

    const keyBusy = `marca:${marcaNorm}`;
    setGestionTaxonomiaBusy(keyBusy);
    try {
      await Promise.all(
        afectados.map((p) => updateDoc(doc(db, 'productos', p.id), { marca: '' }))
      );
      setFormProducto((prev) => (normalizarTaxonomia(prev.marca) === marcaNorm ? { ...prev, marca: '' } : prev));
    } finally {
      setGestionTaxonomiaBusy('');
    }
  };

const obtenerCategoriaProducto = (producto) => textoSeguroTrim(producto?.categoria, 'Sin categoría');

  const obtenerProductosExportacionInventario = () => {
    if (configExportInventario.alcance === 'categoria' && configExportInventario.categoria) {
      return productos.filter((p) => obtenerCategoriaProducto(p) === configExportInventario.categoria);
    }
    return productos;
  };

  const agruparProductosPorCategoria = (items) => {
    const mapa = {};
    items.forEach((p) => {
      const categoria = obtenerCategoriaProducto(p);
      if (!mapa[categoria]) mapa[categoria] = [];
      mapa[categoria].push(p);
    });
    return Object.keys(mapa).sort((a, b) => a.localeCompare(b, 'es')).map((categoria) => ({ categoria, items: mapa[categoria] }));
  };

  const escaparCSV = (valor) => {
    const texto = (valor ?? '').toString();
    if (/[;"\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
    return texto;
  };

  const descargarListaExcelInventario = (items, alcanceLabel) => {
    const encabezados = ['Codigo', 'Categoria', 'Marca', 'Descripcion', 'Unidad', 'Stock', 'Costo', 'GananciaPct', 'IVA', 'Precio'];
    const filas = items.map((p) => [
      p.codigo || '',
      obtenerCategoriaProducto(p),
      (p.marca || '').trim(),
      p.descripcion || '',
      p.unidad || '',
      p.cantidad ?? 0,
      p.costo ?? 0,
      p.ganancia ?? 0,
      p.iva || '',
      p.precio ?? 0
    ]);

    const contenido = [encabezados, ...filas].map((fila) => fila.map(escaparCSV).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8;' });
    const fecha = new Date().toISOString().slice(0, 10);
    const nombre = `lista_inventario_${alcanceLabel.toLowerCase().replace(/\s+/g, '_')}_${fecha}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const normalizarCodigoProducto = (valor) => (valor ?? '').toString().trim().toLowerCase();
  const normalizarCodigoNumerico = (valor) => normalizarCodigoProducto(valor).replace(/\D/g, '').replace(/^0+/, '');
  const parseNumeroImportacion = (valor) => {
    if (valor === null || valor === undefined) return null;
    const texto = valor.toString().trim().replace(/\s/g, '');
    if (!texto) return null;
    const normalizado = texto.includes(',') && texto.includes('.')
      ? texto.replace(/\./g, '').replace(',', '.')
      : texto.replace(',', '.');
    const n = parseFloat(normalizado);
    return Number.isFinite(n) ? n : null;
  };
  const parseCSVLine = (linea, delimitador) => {
    const resultado = [];
    let actual = '';
    let enComillas = false;
    for (let i = 0; i < linea.length; i += 1) {
      const c = linea[i];
      if (c === '"') {
        if (enComillas && linea[i + 1] === '"') {
          actual += '"';
          i += 1;
        } else {
          enComillas = !enComillas;
        }
      } else if (c === delimitador && !enComillas) {
        resultado.push(actual.trim());
        actual = '';
      } else {
        actual += c;
      }
    }
    resultado.push(actual.trim());
    return resultado;
  };
  const leerCSVInventario = async (file) => {
    const texto = await file.text();
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lineas.length) return [];
    const delimitador = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ';' : ',';
    const headers = parseCSVLine(lineas[0], delimitador).map((h) => h.toString().trim().toLowerCase());
    const rows = [];
    for (let i = 1; i < lineas.length; i += 1) {
      const values = parseCSVLine(lineas[i], delimitador);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });
      rows.push(row);
    }
    return rows;
  };
  const cargarSheetJs = () => new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const scriptId = 'sheetjs-xlsx-lib';
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener('load', () => resolve(window.XLSX), { once: true });
    script.addEventListener('error', () => reject(new Error('No se pudo cargar la librería XLSX')), { once: true });
  });
  const leerExcelInventario = async (file) => {
    const XLSX = await cargarSheetJs();
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    return rows.map((row) => {
      const normalizado = {};
      Object.keys(row || {}).forEach((key) => {
        normalizado[key.toString().trim().toLowerCase()] = row[key];
      });
      return normalizado;
    });
  };
  const obtenerValorFilaImport = (fila, claves) => {
    for (const k of claves) {
      if (Object.prototype.hasOwnProperty.call(fila, k) && fila[k] !== '') return fila[k];
    }
    return '';
  };
  const procesarImportacionInventario = async () => {
    if (!archivoImportacionInventario) {
      await notificarSistema('Selecciona primero un archivo Excel o CSV.', {
        tipo: 'warning',
        titulo: 'Archivo requerido'
      });
      return;
    }
    setImportandoInventario(true);
    setResumenImportacionInventario(null);
    try {
      const nombre = archivoImportacionInventario.name.toLowerCase();
      const esCsv = nombre.endsWith('.csv') || nombre.endsWith('.txt');
      const filas = esCsv
        ? await leerCSVInventario(archivoImportacionInventario)
        : await leerExcelInventario(archivoImportacionInventario);

      if (!filas.length) {
        await notificarSistema('El archivo no contiene filas para importar.', {
          tipo: 'warning',
          titulo: 'Archivo sin datos'
        });
        return;
      }

      const porCodigo = new Map();
      const porCodigoNumerico = new Map();
      productos.forEach((p) => {
        const codigo = normalizarCodigoProducto(p.codigo);
        if (codigo) porCodigo.set(codigo, p);
        const codigoNum = normalizarCodigoNumerico(p.codigo);
        if (codigoNum) porCodigoNumerico.set(codigoNum, p);
      });

      let actualizados = 0;
      let sinCoincidencia = 0;
      let sinCodigo = 0;
      let sinCambios = 0;

      for (const fila of filas) {
        const codigoRaw = obtenerValorFilaImport(fila, ['codigo', 'código', 'cod', 'barcode', 'ean', 'sku']);
        const codigo = normalizarCodigoProducto(codigoRaw);
        if (!codigo) { sinCodigo += 1; continue; }

        const codigoNumerico = normalizarCodigoNumerico(codigoRaw);
        const producto = porCodigo.get(codigo) || (codigoNumerico ? porCodigoNumerico.get(codigoNumerico) : null);
        if (!producto) { sinCoincidencia += 1; continue; }

        const precio = parseNumeroImportacion(obtenerValorFilaImport(fila, ['precio', 'precio u.', 'precio venta', 'pvp']));
        const costo = parseNumeroImportacion(obtenerValorFilaImport(fila, ['costo', 'coste']));
        const ganancia = parseNumeroImportacion(obtenerValorFilaImport(fila, ['gananciapct', 'ganancia', 'ganancia %', 'margen']));
        const cantidad = parseNumeroImportacion(obtenerValorFilaImport(fila, ['stock', 'cantidad', 'existencia']));
        const categoria = (obtenerValorFilaImport(fila, ['categoria', 'categoría']) || '').toString().trim();
        const marca = (obtenerValorFilaImport(fila, ['marca']) || '').toString().trim();
        const descripcion = (obtenerValorFilaImport(fila, ['descripcion', 'descripción']) || '').toString().trim();
        const unidad = (obtenerValorFilaImport(fila, ['unidad']) || '').toString().trim();
        const ivaRaw = (obtenerValorFilaImport(fila, ['iva']) || '').toString().trim();

        const updates = {};
        if (precio !== null && precio >= 0) updates.precio = precio;
        if (costo !== null && costo >= 0) updates.costo = costo;
        if (ganancia !== null && ganancia >= 0) updates.ganancia = ganancia;
        if (cantidad !== null && cantidad >= 0) updates.cantidad = cantidad;
        if (categoria) updates.categoria = categoria;
        if (marca) updates.marca = marca;
        if (descripcion) updates.descripcion = descripcion;
        if (unidad) updates.unidad = unidad;
        if (ivaRaw) updates.iva = ivaRaw;

        if (Object.keys(updates).length === 0) {
          sinCambios += 1;
          continue;
        }

        // Conserva siempre la imagen guardada en BD.
        updates.imagen = producto.imagen || '';

        await updateDoc(doc(db, 'productos', producto.id), updates);
        actualizados += 1;
      }

      setResumenImportacionInventario({ total: filas.length, actualizados, sinCoincidencia, sinCodigo, sinCambios });
    } catch (error) {
      console.error('Error importando inventario', error);
      await notificarSistema('No se pudo procesar el archivo. Revisa el formato y vuelve a intentar.', {
        tipo: 'error',
        titulo: 'Error de importación'
      });
    } finally {
      setImportandoInventario(false);
    }
  };

  const generarExportacionInventario = () => {
    const items = obtenerProductosExportacionInventario();
    if (!items.length) {
      notificarSistema('No hay productos para exportar con ese filtro.', {
        tipo: 'warning',
        titulo: 'Sin resultados'
      });
      return;
    }

    const alcanceLabel = configExportInventario.alcance === 'categoria' ? configExportInventario.categoria : 'general';

    if (configExportInventario.tipo === 'lista_excel') {
      descargarListaExcelInventario(items, alcanceLabel);
      setModalActivo(null);
      return;
    }

    setCatalogoAImprimir({
      alcanceLabel,
      items,
      grupos: agruparProductosPorCategoria(items),
      mostrarLogoMarca: configExportInventario.incluirLogoMarca !== false
    });
    setModalActivo('imprimir_catalogo');
  };


  // --- MANEJADORES DE PRESUPUESTOS ---
  const parseNumeroPresupuesto = (valor) => parseFloat((valor ?? '').toString().replace(',', '.')) || 0;
  const parseEnteroPresupuesto = (valor) => {
    const n = parseInt(valor, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const obtenerSiguienteNumeroPresupuesto = () => {
    const maxNumero = presupuestos.reduce((max, p) => Math.max(max, parseEnteroPresupuesto(p?.numero)), 0);
    return maxNumero + 1;
  };

  const formatearNumeroPresupuesto = (numero) => `N° ${String(numero).padStart(6, '0')}`;

  const obtenerNumeroPresupuestoTexto = (presupuesto) => {
    const numero = parseEnteroPresupuesto(presupuesto?.numero);
    if (numero > 0) return formatearNumeroPresupuesto(numero);
    const digitosId = (presupuesto?.id || '').replace(/\D/g, '');
    if (digitosId) {
      const fallbackNumero = parseEnteroPresupuesto(digitosId.slice(-6));
      if (fallbackNumero > 0) return formatearNumeroPresupuesto(fallbackNumero);
    }
    return 'N° -';
  };

  useEffect(() => {
    if (!firebaseUser || migrandoNumerosPresupuestoRef.current || presupuestos.length === 0) return;

    const presupuestosSinNumero = presupuestos.filter((p) => parseEnteroPresupuesto(p?.numero) <= 0);
    if (!presupuestosSinNumero.length) return;

    migrandoNumerosPresupuestoRef.current = true;
    (async () => {
      try {
        let siguienteNumero = presupuestos.reduce((max, p) => Math.max(max, parseEnteroPresupuesto(p?.numero)), 0) + 1;
        const faltantesOrdenados = [...presupuestosSinNumero].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        for (const presupuesto of faltantesOrdenados) {
          await updateDoc(doc(db, 'presupuestos', presupuesto.id), { numero: siguienteNumero });
          siguienteNumero += 1;
        }
      } catch (error) {
        console.error('Error migrando numeración de presupuestos', error);
      } finally {
        migrandoNumerosPresupuestoRef.current = false;
      }
    })();
  }, [firebaseUser, presupuestos]);

  useEffect(() => {
    if (!firebaseUser || migrandoNumerosClienteRef.current || clientes.length === 0) return;

    const clientesSinNumero = clientes.filter((c) => parseEnteroCliente(c?.numero) <= 0);
    if (!clientesSinNumero.length) return;

    migrandoNumerosClienteRef.current = true;
    (async () => {
      try {
        let siguienteNumero = clientes.reduce((max, c) => Math.max(max, parseEnteroCliente(c?.numero)), 0) + 1;
        const faltantesOrdenados = [...clientesSinNumero].sort((a, b) => (a?.nombre || '').localeCompare((b?.nombre || ''), 'es'));

        for (const cliente of faltantesOrdenados) {
          await updateDoc(doc(db, 'clientes', cliente.id), { numero: siguienteNumero });
          siguienteNumero += 1;
        }
      } catch (error) {
        console.error('Error migrando numeración de clientes', error);
      } finally {
        migrandoNumerosClienteRef.current = false;
      }
    })();
  }, [firebaseUser, clientes]);

  const calcularTotalItemPresupuesto = (item) => {
    const cantidad = parseNumeroPresupuesto(item?.cantidad);
    const precio = parseNumeroPresupuesto(item?.precio);
    const descuento = Math.max(0, parseNumeroPresupuesto(item?.descuento));
    const subtotal = cantidad * precio;
    const montoDescuento = subtotal * (descuento / 100);
    return Math.max(0, subtotal - montoDescuento);
  };

  const calcularResumenPresupuesto = (items = [], descuentoGeneral = 0) => {
    const subtotalBruto = items.reduce((acc, item) => acc + (parseNumeroPresupuesto(item?.cantidad) * parseNumeroPresupuesto(item?.precio)), 0);
    const descuentoItems = items.reduce((acc, item) => {
      const subtotal = parseNumeroPresupuesto(item?.cantidad) * parseNumeroPresupuesto(item?.precio);
      return acc + (subtotal * (Math.max(0, parseNumeroPresupuesto(item?.descuento)) / 100));
    }, 0);
    const subtotalConDescuentos = Math.max(0, subtotalBruto - descuentoItems);
    const descuentoGeneralPct = Math.max(0, parseNumeroPresupuesto(descuentoGeneral));
    const descuentoGeneralMonto = subtotalConDescuentos * (descuentoGeneralPct / 100);
    const total = Math.max(0, subtotalConDescuentos - descuentoGeneralMonto);

    return { subtotalBruto, descuentoItems, subtotalConDescuentos, descuentoGeneralPct, descuentoGeneralMonto, total };
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formPresupuesto.items];
    newItems[index][field] = value;
    setFormPresupuesto({ ...formPresupuesto, items: newItems });
  };

  const agregarItemPresupuesto = () => {
    setFormPresupuesto({
      ...formPresupuesto,
      items: [...formPresupuesto.items, { id: Date.now(), codigo: '', descripcion: '', unidad: 'unid', precio: '', cantidad: 1, descuento: 0, costoBase: '', logoMarca: '' }]
    });
  };

  const eliminarItemPresupuesto = (index) => {
    const newItems = formPresupuesto.items.filter((_, i) => i !== index);
    setFormPresupuesto({ ...formPresupuesto, items: newItems });
  };

  const seleccionarProductoParaStock = (prod) => {
    if (itemIndexParaStock !== null) {
      const newItems = [...formPresupuesto.items];
      newItems[itemIndexParaStock] = {
        ...newItems[itemIndexParaStock],
        codigo: prod.codigo || '',
        descripcion: prod.descripcion,
        precio: prod.precio,
        unidad: prod.unidad || 'unid',
        descuento: newItems[itemIndexParaStock]?.descuento ?? 0,
        costoBase: parseNumeroBasico(prod.costo || 0),
        imagen: prod.imagen || '',
        logoMarca: prod.logoMarca || ''
      };
      setFormPresupuesto({ ...formPresupuesto, items: newItems });
      setModalActivo('nuevo_presupuesto'); 
      setItemIndexParaStock(null);
    }
  };

  const guardarPresupuesto = async (e) => {
    e.preventDefault();
    if (formPresupuesto.items.length === 0) {
      await notificarSistema('Agrega al menos un producto al presupuesto.', {
        tipo: 'warning',
        titulo: 'Presupuesto vacío'
      });
      return;
    }
    const itemsNormalizados = (formPresupuesto.items || []).map((item) => ({ ...item, descuento: parseNumeroPresupuesto(item?.descuento) }));
    const resumen = calcularResumenPresupuesto(itemsNormalizados, formPresupuesto.descuentoGeneral);
    const numeroPresupuesto = formPresupuesto.id
      ? (parseEnteroPresupuesto(formPresupuesto.numero) || parseEnteroPresupuesto(presupuestos.find((p) => p.id === formPresupuesto.id)?.numero) || obtenerSiguienteNumeroPresupuesto())
      : obtenerSiguienteNumeroPresupuesto();
    
    let cId = formPresupuesto.clienteId;
    let cNombre = formPresupuesto.clienteNombre;
    let cWpp = formPresupuesto.whatsapp;

    if (formPresupuesto.esNuevoCliente) {
      if (!cNombre.trim()) {
        await notificarSistema('Ingresa el nombre del nuevo cliente.', {
          tipo: 'warning',
          titulo: 'Nombre requerido'
        });
        return;
      }
      const docRef = await addDoc(collection(db, 'clientes'), { numero: obtenerSiguienteNumeroCliente(), nombre: cNombre, whatsapp: cWpp, saldo: 0, esEspecial: false });
      cId = docRef.id;
    } else {
      if (!cId) {
        await notificarSistema('Busca y selecciona un cliente existente para continuar.', {
          tipo: 'warning',
          titulo: 'Cliente requerido'
        });
        return;
      }
      const clienteSeleccionado = clientes.find(c => c.id === cId);
      if (clienteSeleccionado) {
        cNombre = clienteSeleccionado.nombre;
        cWpp = clienteSeleccionado.whatsapp || cWpp;
      } else {
        await notificarSistema('El cliente seleccionado ya no está disponible. Vuelve a buscarlo.', {
          tipo: 'warning',
          titulo: 'Cliente no disponible'
        });
        return;
      }
    }

    const empresaNombrePresupuesto = textoSeguroTrim(
      formPresupuesto?.empresaNombre,
      textoSeguroTrim(configuracion?.nombre, NOMBRE_EMPRESA_FALLBACK)
    );
    const empresaLogoPresupuesto = textoSeguroTrim(
      formPresupuesto?.empresaLogoDataUrl,
      textoSeguroTrim(
        formPresupuesto?.empresaLogo,
        textoSeguroTrim(logoEmpresaRender, textoSeguroTrim(configuracion?.logo, ''))
      )
    );

    const data = {
      clienteId: cId, clienteNombre: cNombre, whatsapp: cWpp, items: itemsNormalizados, 
      empresaNombre: empresaNombrePresupuesto,
      empresaLogo: empresaLogoPresupuesto,
      descuentoGeneral: parseNumeroPresupuesto(formPresupuesto.descuentoGeneral),
      numero: numeroPresupuesto,
      aplicaFleteCosto: Boolean(formPresupuesto.aplicaFleteCosto),
      fletePorcentaje: Boolean(formPresupuesto.aplicaFleteCosto) ? Math.max(0, parseNumeroPresupuesto(formPresupuesto.fletePorcentaje)) : 0,
      fleteMontoEstimado: resumenGananciaPresupuestoActual.fleteMonto,
      costoTotalEstimado: resumenGananciaPresupuestoActual.costoTotalConFlete,
      gananciaEstimada: resumenGananciaPresupuestoActual.ganancia,
      total: resumen.total, estado: formPresupuesto.estado, notas: formPresupuesto.notas,
      fecha: formPresupuesto.id ? formPresupuesto.fecha : new Date().toISOString(), usuario: usuarioActual.nombre
    };

    if (formPresupuesto.id) {
      await updateDoc(doc(db, 'presupuestos', formPresupuesto.id), data);
    } else {
      await addDoc(collection(db, 'presupuestos'), data);
    }

    setModalActivo(null);
    setFormPresupuesto(crearFormularioPresupuestoVacio());
  };

  const cancelarEdicionPresupuesto = async () => {
    const hayCambios = (
      Boolean(formPresupuesto.id)
      || Boolean(formPresupuesto.esNuevoCliente)
      || Boolean((formPresupuesto.clienteId || '').trim())
      || Boolean((formPresupuesto.clienteNombre || '').trim())
      || Boolean((formPresupuesto.whatsapp || '').trim())
      || (Array.isArray(formPresupuesto.items) && formPresupuesto.items.length > 0)
      || Boolean((formPresupuesto.notas || '').trim())
      || Boolean(parseNumeroPresupuesto(formPresupuesto.descuentoGeneral))
      || Boolean(formPresupuesto.aplicaFleteCosto)
      || Boolean(parseNumeroPresupuesto(formPresupuesto.fletePorcentaje))
    );
    if (hayCambios) {
      const confirmar = await confirmarSistema('Se descartará el presupuesto en curso. ¿Deseas continuar?', {
        tipo: 'warning',
        titulo: 'Cancelar presupuesto',
        textoAceptar: 'Sí, cancelar'
      });
      if (!confirmar) return;
    }
    setModalActivo(null);
    setFormPresupuesto(crearFormularioPresupuestoVacio());
  };

  const eliminarPresupuesto = async (id) => {
    const confirmar = await confirmarSistema('¿Seguro que deseas eliminar este presupuesto permanentemente?', {
      tipo: 'danger',
      titulo: 'Eliminar presupuesto',
      textoAceptar: 'Sí, eliminar'
    });
    if (!confirmar) return;
    await deleteDoc(doc(db, 'presupuestos', id));
    setModalActivo(null);
    setPresupuestoSeleccionado(null);
  };

  const normalizarTextoArchivo = (texto = '') =>
    (texto || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'archivo';

  const obtenerNombreArchivoPresupuesto = (presupuesto, conExtension = true) => {
    const numeroArchivo = parseEnteroPresupuesto(presupuesto?.numero);
    const numeroTexto = numeroArchivo > 0
      ? String(numeroArchivo).padStart(6, '0')
      : normalizarTextoArchivo(obtenerNumeroPresupuestoTexto(presupuesto).replace(/^N°\s*/i, ''));
    const clienteTexto = normalizarTextoArchivo(presupuesto?.clienteNombre || 'cliente');
    const base = `presupuesto_${numeroTexto}_${clienteTexto}`;
    return conExtension ? `${base}.pdf` : base;
  };

  const obtenerNombreEmpresaPresupuesto = (presupuesto = null) => (
    textoSeguroTrim(
      presupuesto?.empresaNombre,
      textoSeguroTrim(configuracion?.nombre, NOMBRE_EMPRESA_FALLBACK)
    )
  );

  const obtenerLogoEmpresaPresupuesto = (presupuesto = null) => (
    textoSeguroTrim(
      presupuesto?.empresaLogoDataUrl,
      textoSeguroTrim(
        presupuesto?.empresaLogo,
        textoSeguroTrim(logoEmpresaRender, textoSeguroTrim(configuracion?.logo, LOGO_EMPRESA_FALLBACK_URL))
      )
    )
  );

  const descargarArchivoTemporal = (file) => {
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(file);
    link.href = objectUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  };

  const abrirPreviewImagenTemporal = (file) => {
    if (!file || typeof window === 'undefined') return false;
    try {
      const objectUrl = URL.createObjectURL(file);
      const win = window.open(objectUrl, '_blank');
      if (!win) return false;
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return true;
    } catch (error) {
      return false;
    }
  };

  const copiarImagenAlPortapapeles = async (file) => {
    try {
      if (!file) return false;
      if (typeof navigator === 'undefined' || !navigator.clipboard?.write) return false;
      if (typeof window === 'undefined' || typeof window.ClipboardItem === 'undefined') return false;
      const blob = file instanceof Blob ? file : new Blob([file], { type: 'image/jpeg' });
      const tipo = blob.type || 'image/jpeg';
      await navigator.clipboard.write([new window.ClipboardItem({ [tipo]: blob })]);
      return true;
    } catch (error) {
      console.error('No se pudo copiar la imagen al portapapeles', error);
      return false;
    }
  };

  const copiarTextoAlPortapapeles = async (texto = '') => {
    try {
      if (!texto) return false;
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (error) {
      return false;
    }
  };

  const extraerPrimerTelefono = (numero = '') => {
    const numeroRaw = textoSeguroTrim(numero, '');
    if (!numeroRaw) return '';
    const candidatos = numeroRaw
      .split(/[\n,;|/]+/)
      .map((parte) => parte.trim())
      .filter(Boolean);
    return candidatos[0] || numeroRaw;
  };

  const normalizarNumeroWhatsApp = (numero = '') => {
    const numeroRaw = extraerPrimerTelefono(numero);
    if (!numeroRaw) return '';

    let digitos = numeroRaw.replace(/\D/g, '');
    if (!digitos) return '';

    while (digitos.startsWith('00')) {
      digitos = digitos.slice(2);
    }

    const convertirArgentina = (valor = '') => {
      let local = (valor || '').replace(/\D/g, '');
      if (!local) return '';

      local = local.replace(/^0+/, '');
      if (!local) return '';

      if (local.startsWith('9') && local.length >= 11 && local.length <= 12) {
        return `54${local}`;
      }

      for (let areaLen = 2; areaLen <= 4; areaLen += 1) {
        if (local.length <= areaLen + 2) continue;
        const area = local.slice(0, areaLen);
        const marcadorMovil = local.slice(areaLen, areaLen + 2);
        const abonado = local.slice(areaLen + 2);
        if (marcadorMovil !== '15') continue;
        if (abonado.length < 5 || abonado.length > 8) continue;
        return `549${area}${abonado}`;
      }

      if (local.length === 10) return `549${local}`;
      if (local.length === 11 && local.startsWith('9')) return `54${local}`;
      return '';
    };

    if (digitos.startsWith('549') && digitos.length >= 12 && digitos.length <= 14) {
      return digitos;
    }

    if (digitos.startsWith('54')) {
      const convertido = convertirArgentina(digitos.slice(2));
      if (convertido) return convertido;
      return digitos.length >= 11 && digitos.length <= 15 ? digitos : '';
    }

    const puedeSerLocalArgentina = (
      digitos.startsWith('0') ||
      digitos.length === 10 ||
      (digitos.length >= 11 && digitos.length <= 13 && digitos.includes('15'))
    );

    if (puedeSerLocalArgentina) {
      const convertidoLocal = convertirArgentina(digitos);
      if (convertidoLocal) return convertidoLocal;
    }

    if (digitos.length >= 10 && digitos.length <= 15) {
      return digitos;
    }

    return '';
  };

  const construirUrlWhatsApp = (numero = '', texto = '') => {
    const numeroNormalizado = normalizarNumeroWhatsApp(numero);
    if (!numeroNormalizado) return '';
    if (!texto) {
      return `https://wa.me/${numeroNormalizado}`;
    }
    return `https://wa.me/${numeroNormalizado}?text=${encodeURIComponent(texto)}`;
  };

  const abrirWhatsAppChat = (numero = '') => {
    try {
      const numeroLimpio = normalizarNumeroWhatsApp(numero);
      const esMovil = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
      const url = numeroLimpio
        ? `https://wa.me/${numeroLimpio}`
        : (esMovil ? 'https://wa.me/' : 'https://web.whatsapp.com/');
      return window.open(url, '_blank');
    } catch (error) {
      return null;
    }
  };

  const construirResumenReciboCobro = (mov = null) => {
    if (!mov || mov.tipo !== 'cobro') return null;
    const detalles = mov.detallesPago || {};
    const recibo = detalles.recibo || {};
    const clienteId = detalles.clienteId || recibo.clienteId || '';
    const clienteDoc = clienteId ? clientes.find((c) => c.id === clienteId) : null;
    const clienteNombre = textoSeguroTrim(recibo.clienteNombre, textoSeguroTrim(detalles.cliente, textoSeguroTrim(clienteDoc?.nombre, 'Cliente')));
    const clienteWhatsapp = textoSeguroTrim(recibo.clienteWhatsapp, textoSeguroTrim(clienteDoc?.whatsapp, ''));
    const clienteDocumento = textoSeguroTrim(clienteDoc?.documento, '');
    const fechaPago = recibo.fechaPago || mov.fecha;
    const numeroRecibo = textoSeguroTrim(recibo.numero, generarNumeroReciboCobro(fechaPago));
    let saldoAntes = Math.max(0, Number(recibo.saldoAntes ?? 0) || 0);
    const saldoDespues = Math.max(0, Number(recibo.saldoDespues ?? 0) || 0);
    const montoCobro = Math.max(0, Number(mov.monto || recibo.cobroTotal || 0));
    const metodoPago = textoSeguroTrim(mov.metodoPago, textoSeguroTrim(recibo.metodoPago, 'efectivo'));

    let itemsAplicados = Array.isArray(recibo.itemsAplicados) ? recibo.itemsAplicados : [];
    if (!itemsAplicados.length && detalles.movimientoRelacionadoId) {
      const ticket = movimientos.find((m) => m.id === detalles.movimientoRelacionadoId);
      if (ticket) {
        const pendienteAntes = Math.max(0, Number(recibo?.ticketPendienteAntes || ticket?.monto || 0));
        const aplicado = Math.min(montoCobro, pendienteAntes || montoCobro);
        const numeroRemito = textoSeguroTrim(
          ticket?.detallesPago?.numeroComprobante,
          textoSeguroTrim(ticket?.detallesPago?.comprobanteNumero, '')
        );
        itemsAplicados = [{
          cargoId: ticket.id,
          fechaRemito: ticket.fecha,
          descripcion: ticket.descripcion || 'Remito',
          numeroRemito,
          pendienteAntes,
          aplicado,
          pendienteDespues: Math.max(0, pendienteAntes - aplicado)
        }];
      }
    }

    const itemsNormalizados = itemsAplicados.map((item, index) => ({
      cargoOrigen: item?.cargoId ? movimientos.find((m) => m.id === item.cargoId) : null,
      cargoId: item?.cargoId || `item-${index}`,
      fechaRemito: item?.fechaRemito || null,
      descripcion: textoSeguroTrim(item?.descripcion, 'Remito pendiente'),
      numeroRemito: '',
      pendienteAntes: Math.max(0, Number(item?.pendienteAntes || 0)),
      aplicado: Math.max(0, Number(item?.aplicado || 0)),
      pendienteDespues: Math.max(0, Number(item?.pendienteDespues || 0))
    })).map((item) => {
      const numeroRemito = textoSeguroTrim(
        item?.numeroRemito,
        textoSeguroTrim(item?.cargoOrigen?.detallesPago?.numeroComprobante, textoSeguroTrim(item?.cargoOrigen?.detallesPago?.comprobanteNumero, ''))
      );
      return {
        cargoId: item.cargoId,
        fechaRemito: item.fechaRemito,
        descripcion: item.descripcion,
        numeroRemito,
        pendienteAntes: item.pendienteAntes,
        aplicado: item.aplicado,
        pendienteDespues: item.pendienteDespues
      };
    });
    const totalAplicadoRemitos = itemsNormalizados.reduce((acc, item) => acc + item.aplicado, 0);
    if (saldoAntes <= 0.009 && montoCobro > 0) {
      const saldoAntesDesdeItems = itemsNormalizados.reduce((acc, item) => acc + Math.max(0, Number(item?.pendienteAntes || 0)), 0);
      saldoAntes = Math.max(0, saldoAntesDesdeItems, saldoDespues + montoCobro);
    }
    const pendienteActualCliente = Math.max(0, Number(clienteDoc?.saldo || saldoDespues || 0));

    return {
      numeroRecibo,
      fechaPago,
      clienteId,
      clienteNombre,
      clienteWhatsapp,
      clienteDocumento,
      saldoAntes,
      saldoDespues,
      montoCobro,
      metodoPago,
      tipoAbono: detalles.tipoAbono === 'ticket' ? 'ticket' : 'general',
      itemsAplicados: itemsNormalizados,
      totalAplicadoRemitos,
      pendienteActualCliente
    };
  };

  const obtenerNombreArchivoReciboCobro = (resumen = null, conExtension = true) => {
    const numero = normalizarTextoArchivo((resumen?.numeroRecibo || 'recibo').replace(/^RC-/i, 'RC_'));
    const cliente = normalizarTextoArchivo(resumen?.clienteNombre || 'cliente');
    const base = `recibo_${numero}_${cliente}`;
    return conExtension ? `${base}.pdf` : base;
  };

  const obtenerNombreArchivoReciboCobroImagen = (resumen = null, conExtension = true) => {
    const numero = normalizarTextoArchivo((resumen?.numeroRecibo || 'recibo').replace(/^RC-/i, 'RC_'));
    const cliente = normalizarTextoArchivo(resumen?.clienteNombre || 'cliente');
    const base = `estado_whatsapp_recibo_${numero}_${cliente}`;
    return conExtension ? `${base}.png` : base;
  };

  const asegurarVistaReciboCobroDisponible = async (mov = null) => {
    const movimientoId = mov?.id || '';
    const vistaActualLista = Boolean(
      reciboCobroPreviewRef.current
      && (!movimientoId || reciboCobroSeleccionado?.movimientoId === movimientoId)
    );
    if (vistaActualLista) return true;

    const resumen = construirResumenReciboCobro(mov);
    if (!resumen) return false;

    setReciboCobroSeleccionado({
      movimientoId,
      movimiento: mov || null,
      resumen
    });
    setModalActivo('recibo_cobro');

    for (let intento = 0; intento < 10; intento += 1) {
      await esperarMs(120);
      await esperarFrame();
      const lista = Boolean(
        reciboCobroPreviewRef.current
        && (!movimientoId || reciboCobroSeleccionado?.movimientoId === movimientoId || reciboCobroPreviewRef.current)
      );
      if (lista) return true;
    }
    return false;
  };

  const generarPdfReciboCobroFile = async (mov = null) => {
    const resumen = construirResumenReciboCobro(mov);
    if (!resumen) throw new Error('Recibo no disponible');

    const docPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const nombreEmpresaBase = obtenerNombreEmpresaPresupuesto();
    const nombreEmpresaDoc = /^mi negocio$/i.test(textoSeguroTrim(nombreEmpresaBase))
      ? NOMBRE_EMPRESA_FALLBACK
      : textoSeguroTrim(nombreEmpresaBase, NOMBRE_EMPRESA_FALLBACK);
    const contactoNegocioDoc = obtenerContactoNegocio(configuracion);
    const logoDocumento = await srcADataUrl(LOGO_RECIBO_PREMIUM_URL);
    const metodoLabel = obtenerEtiquetaMetodoPago(resumen.metodoPago);
    const estadoPago = resumen.saldoDespues <= 0.009 ? 'Cuenta saldada' : 'Pago parcial';
    const aplicacionLabel = resumen.tipoAbono === 'ticket' ? 'Ticket específico' : 'Abono general';
    const emisorRecibo = textoSeguroTrim(mov?.usuario, usuarioActual?.nombre || 'Sistema');
    const metodoPagoKey = normalizarMetodoPago(resumen.metodoPago);
    const iconoMetodoAbono = (() => {
      if (metodoPagoKey === 'transferencia') return 'TR';
      if (metodoPagoKey === 'cheque') return 'CH';
      if (metodoPagoKey === 'tarjeta') return 'TC';
      if (metodoPagoKey === 'cuenta_corriente') return 'CC';
      return '$';
    })();

    const azulOscuro = [8, 23, 47];
    const azulOscuroProfundo = [7, 27, 53];
    const gris = [100, 116, 139];
    const grisClaro = [245, 247, 250];
    const borde = [226, 232, 240];
    const verde = [16, 185, 129];
    const rojo = [220, 38, 38];
    const verdeSuave = [236, 253, 245];
    const blancoSuave = [226, 232, 240];

    const dibujarBadgeCirculo = ({ x, y, radio = 5.4, fill = verdeSuave, texto = '', colorTexto = azulOscuroProfundo, fontSize = 8.5, bordeColor = null, bordeWidth = 0.25 }) => {
      if (bordeColor) {
        docPdf.setDrawColor(...bordeColor);
        docPdf.setLineWidth(bordeWidth);
      } else {
        docPdf.setDrawColor(255, 255, 255);
        docPdf.setLineWidth(0);
      }
      docPdf.setFillColor(...fill);
      docPdf.circle(x, y, radio, bordeColor ? 'FD' : 'F');
      if (texto) {
        docPdf.setFont('helvetica', 'bold');
        docPdf.setFontSize(fontSize);
        docPdf.setTextColor(...colorTexto);
        docPdf.text(texto, x, y + (fontSize >= 9 ? 1.3 : 1), { align: 'center' });
      }
    };

    docPdf.setFillColor(...grisClaro);
    docPdf.rect(0, 0, 210, 297, 'F');

    docPdf.setFillColor(255, 255, 255);
    docPdf.roundedRect(8, 8, 194, 281, 7, 7, 'F');
    docPdf.setFillColor(...azulOscuro);
    docPdf.roundedRect(8, 8, 194, 52, 7, 7, 'F');
    docPdf.setFillColor(...verde);
    docPdf.rect(8, 58.3, 194, 1.8, 'F');
    if (logoDocumento) {
      try {
        const propsLogo = docPdf.getImageProperties(logoDocumento);
        const ratioLogo = (propsLogo?.width || 1) / Math.max(propsLogo?.height || 1, 1);
        const boxLogo = { x: 14, y: 12, w: 80, h: 23 };
        let drawW = boxLogo.w;
        let drawH = drawW / Math.max(ratioLogo, 0.01);
        if (drawH > boxLogo.h) {
          drawH = boxLogo.h;
          drawW = drawH * ratioLogo;
        }
        const drawX = boxLogo.x + (boxLogo.w - drawW) / 2;
        const drawY = boxLogo.y + (boxLogo.h - drawH) / 2;
        const formatoLogo = /image\/jpe?g/i.test(logoDocumento) ? 'JPEG' : 'PNG';
        docPdf.addImage(logoDocumento, formatoLogo, drawX, drawY, drawW, drawH);
      } catch (error) {}
    }

    const contactosCabecera = [
      { icono: 'D', valor: contactoNegocioDoc.direccion, x: 19, y: 39.5 },
      { icono: 'W', valor: contactoNegocioDoc.web, x: 76, y: 39.5 },
      { icono: 'T', valor: contactoNegocioDoc.whatsapp, x: 19, y: 47.2 },
      { icono: '@', valor: contactoNegocioDoc.correo, x: 76, y: 47.2 }
    ].filter((item) => item.valor);
    docPdf.setFontSize(8.4);
    docPdf.setTextColor(...blancoSuave);
    contactosCabecera.forEach(({ icono, valor, x, y }) => {
      dibujarBadgeCirculo({
        x,
        y: y - 0.3,
        radio: 4.5,
        fill: [255, 255, 255],
        texto: icono,
        colorTexto: azulOscuroProfundo,
        fontSize: icono === '@' ? 7.6 : 7.9,
        bordeColor: [255, 255, 255],
        bordeWidth: 0.18
      });
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(recortarTexto(valor, 31), x + 7.3, y);
    });

    docPdf.setFont('helvetica', 'bold');
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(9);
    docPdf.text('RECIBO DE PAGO', 188, 18, { align: 'right' });
    docPdf.setTextColor(...verde);
    docPdf.setFontSize(17);
    docPdf.text(resumen.numeroRecibo, 188, 28, { align: 'right' });
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8.7);
    docPdf.setTextColor(226, 232, 240);
    docPdf.text(`${formatearFecha(resumen.fechaPago)} ${formatearHora(resumen.fechaPago)}`, 188, 39, { align: 'right' });
    docPdf.text(`Emitido por: ${emisorRecibo}`, 188, 47, { align: 'right' });

    docPdf.setFillColor(255, 255, 255);
    docPdf.setDrawColor(...borde);
    docPdf.roundedRect(14, 68, 88, 34, 5, 5, 'FD');
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(...verde);
    docPdf.text('CLIENTE', 20, 78);
    docPdf.setTextColor(...azulOscuro);
    docPdf.setFontSize(14);
    docPdf.text(docPdf.splitTextToSize(recortarTexto(resumen.clienteNombre, 44), 76).slice(0, 2), 20, 88);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8);
    docPdf.setTextColor(...gris);
    docPdf.text(`WhatsApp: ${textoSeguroTrim(resumen.clienteWhatsapp, 'Sin teléfono')}`, 20, 98);

    docPdf.setFillColor(...verde);
    docPdf.roundedRect(108, 68, 88, 34, 5, 5, 'F');
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(8.2);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text('TOTAL COBRADO', 118, 80);
    docPdf.setFontSize(21);
    docPdf.text(formatearDinero(resumen.montoCobro), 118, 94);
    dibujarBadgeCirculo({
      x: 186,
      y: 82,
      radio: 7.5,
      fill: verde,
      texto: '✓',
      colorTexto: [255, 255, 255],
      fontSize: 12,
      bordeColor: [255, 255, 255],
      bordeWidth: 0.22
    });

    docPdf.setFillColor(255, 255, 255);
    docPdf.setDrawColor(...borde);
    docPdf.roundedRect(108, 95, 88, 18, 0, 0, 'FD');
    dibujarBadgeCirculo({
      x: 118,
      y: 104,
      radio: 5.2,
      fill: verde,
      texto: '✓',
      colorTexto: [255, 255, 255],
      fontSize: 10.5
    });
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(15);
    docPdf.setTextColor(...azulOscuroProfundo);
    docPdf.text(estadoPago, 128, 106);

    docPdf.setFillColor(255, 255, 255);
    docPdf.setDrawColor(...borde);
    docPdf.roundedRect(14, 119, 182, 30, 5, 5, 'FD');
    docPdf.setDrawColor(...borde);
    docPdf.line(75, 119, 75, 138);
    docPdf.line(136, 119, 136, 138);
    const colX = [42, 103, 164];
    const metricIconX = [27, 88, 149];
    const metricLabels = ['SALDO ANTERIOR', 'ABONADO', 'SALDO ACTUAL'];
    const metricValues = [
      formatearDinero(resumen.saldoAntes),
      `- ${formatearDinero(resumen.montoCobro)}`,
      formatearDinero(resumen.saldoDespues)
    ];
    const metricIcons = ['$', iconoMetodoAbono, '✓'];
    metricIconX.forEach((x, index) => {
      dibujarBadgeCirculo({
        x,
        y: 129,
        radio: 6.4,
        fill: verdeSuave,
        texto: metricIcons[index],
        colorTexto: index === 1 ? verde : azulOscuroProfundo,
        fontSize: index === 1 ? 7.2 : 9
      });
    });
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(7.7);
    docPdf.setTextColor(...gris);
    metricLabels.forEach((label, index) => {
      docPdf.text(label, colX[index], 126.8);
    });
    docPdf.setFontSize(13);
    docPdf.setTextColor(...azulOscuroProfundo);
    docPdf.text(metricValues[0], colX[0], 135.4);
    docPdf.setTextColor(...verde);
    docPdf.text(metricValues[1], colX[1], 135.4);
    docPdf.setTextColor(resumen.saldoDespues <= 0.009 ? verde[0] : rojo[0], resumen.saldoDespues <= 0.009 ? verde[1] : rojo[1], resumen.saldoDespues <= 0.009 ? verde[2] : rojo[2]);
    docPdf.text(metricValues[2], colX[2], 135.4);

    docPdf.setFillColor(246, 251, 249);
    docPdf.roundedRect(14, 139, 182, 11, 0, 0, 'F');
    docPdf.setTextColor(...azulOscuroProfundo);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(7.8);
    docPdf.text(`Método: ${metodoLabel}`, 18, 146.2);
    docPdf.text(`Aplicación: ${aplicacionLabel}`, 81, 146.2);
    docPdf.text(`Estado: ${estadoPago}`, 146, 146.2);

    const filasAplicadas = resumen.itemsAplicados.map((item) => ([
      formatearFecha(item.fechaRemito || resumen.fechaPago),
      textoSeguroTrim(item.numeroRemito, '-'),
      recortarTexto(item.descripcion || 'Remito', 56),
      formatearDinero(item.pendienteAntes),
      formatearDinero(item.aplicado),
      formatearDinero(item.pendienteDespues)
    ]));
    if (!filasAplicadas.length) {
      filasAplicadas.push([
        formatearFecha(resumen.fechaPago),
        '-',
        resumen.tipoAbono === 'general' ? 'Abono general de cuenta corriente' : 'Abono de cuenta corriente',
        formatearDinero(resumen.saldoAntes),
        formatearDinero(resumen.montoCobro),
        formatearDinero(resumen.saldoDespues)
      ]);
    }
    autoTable(docPdf, {
      startY: 157,
      head: [['Fecha', 'Remito N°', 'Detalle abonado', 'Pendiente antes', 'Abonado', 'Pendiente ahora']],
      body: filasAplicadas,
      theme: 'grid',
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.15 },
      headStyles: { fillColor: [8, 23, 47], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [8, 23, 47], lineWidth: 0.15 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 24 },
        2: { cellWidth: 54 },
        3: { cellWidth: 29, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 31, halign: 'right' }
      }
    });

    let y = (docPdf.lastAutoTable?.finalY || 150) + 10;
    if (y > 255) {
      docPdf.addPage();
      y = 20;
    }

    docPdf.setFillColor(255, 255, 255);
    docPdf.setDrawColor(...borde);
    docPdf.roundedRect(14, y, 182, 22, 5, 5, 'FD');
    docPdf.setDrawColor(203, 213, 225);
    docPdf.line(108, y + 4, 108, y + 18);
    docPdf.setTextColor(...gris);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8.6);
    docPdf.text(['Recibo válido como constancia del pago', 'registrado en cuenta corriente.'], 20, y + 9);
    docPdf.setFont('times', 'italic');
    docPdf.setFontSize(22);
    docPdf.setTextColor(...azulOscuroProfundo);
    docPdf.text('Gracias por confiar', 150, y + 13.5, { align: 'center' });

    const fileName = obtenerNombreArchivoReciboCobro(resumen, true);
    const blob = docPdf.output('blob');
    return new File([blob], fileName, { type: 'application/pdf' });
  };

  const descargarReciboCobro = async (mov = null) => {
    try {
      const archivo = await generarPdfReciboCobroFile(mov);
      descargarArchivoTemporal(archivo);
    } catch (error) {
      console.error('No se pudo generar el recibo PDF', error);
      await notificarSistema('No se pudo generar el PDF del recibo.', {
        tipo: 'error',
        titulo: 'Error de recibo'
      });
    }
  };

  const generarImagenReciboCobroFile = async (mov = null, opciones = {}) => {
    const resumen = construirResumenReciboCobro(mov);
    if (!resumen) throw new Error('Recibo no disponible');
    if (typeof window === 'undefined') throw new Error('Captura no disponible');
    const htmlToImageApi = window.htmlToImage;
    if (!htmlToImageApi?.toCanvas) throw new Error('Falta librería de captura');

    let nodo = opciones?.nodo || reciboCobroPreviewRef.current;
    if (!nodo) {
      const disponible = await asegurarVistaReciboCobroDisponible(mov);
      if (disponible) {
        nodo = reciboCobroPreviewRef.current;
      }
    }
    if (!nodo) throw new Error('La vista previa del recibo no está disponible para capturar.');

    await esperarFrame();
    await esperarFrame();

    const width = Math.max(1, nodo.offsetWidth || 0, nodo.scrollWidth || 0, 860);
    const height = Math.max(1, nodo.offsetHeight || 0, nodo.scrollHeight || 0, Math.round(width * 1.28));
    const canvasWidth = Math.min(2200, Math.round(width * 2));
    const canvasHeight = Math.round(canvasWidth * (height / width));
    const capturaCanvas = await htmlToImageApi.toCanvas(nodo, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#ffffff',
      width,
      height,
      canvasWidth,
      canvasHeight
    });

    const canvas = document.createElement('canvas');
    canvas.width = 2160;
    canvas.height = 3840;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar el lienzo de estado.');

    // Fondo de cobertura para evitar franjas y overlay principal sin cortes.
    const escalaFondo = Math.max(
      canvas.width / Math.max(capturaCanvas.width, 1),
      canvas.height / Math.max(capturaCanvas.height, 1)
    );
    const fondoW = Math.round(capturaCanvas.width * escalaFondo);
    const fondoH = Math.round(capturaCanvas.height * escalaFondo);
    const fondoX = Math.round((canvas.width - fondoW) / 2);
    const fondoY = Math.round((canvas.height - fondoH) / 2);

    const escalaContenido = Math.min(
      canvas.width / Math.max(capturaCanvas.width, 1),
      canvas.height / Math.max(capturaCanvas.height, 1)
    );
    const drawW = Math.round(capturaCanvas.width * escalaContenido);
    const drawH = Math.round(capturaCanvas.height * escalaContenido);
    const drawX = Math.round((canvas.width - drawW) / 2);
    const drawY = Math.round((canvas.height - drawH) / 2);

    ctx.save();
    ctx.filter = 'blur(18px) brightness(0.75)';
    ctx.drawImage(capturaCanvas, fondoX, fondoY, fondoW, fondoH);
    ctx.restore();

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, 'rgba(7, 27, 53, 0.30)');
    grad.addColorStop(1, 'rgba(7, 27, 53, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(capturaCanvas, drawX, drawY, drawW, drawH);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar la imagen del recibo.');
    return new File([blob], obtenerNombreArchivoReciboCobroImagen(resumen, true), { type: 'image/png' });
  };

  const descargarImagenReciboCobro = async (mov = null) => {
    setDescargandoImagenReciboCobro(true);
    try {
      const archivo = await generarImagenReciboCobroFile(mov);
      descargarArchivoTemporal(archivo);
    } catch (error) {
      console.error('No se pudo generar la imagen del recibo', error);
      await notificarSistema('Abrí la vista del recibo para descargar la imagen en alta calidad.', {
        tipo: 'warning',
        titulo: 'Imagen no disponible'
      });
    } finally {
      setDescargandoImagenReciboCobro(false);
    }
  };

  const enviarWhatsAppReciboCobro = async (mov = null) => {
    const resumen = construirResumenReciboCobro(mov);
    if (!resumen) return;
    const numeroDestino = normalizarNumeroWhatsApp(resumen.clienteWhatsapp || '');
    if (!numeroDestino) {
      await notificarSistema('El cliente no tiene número de WhatsApp registrado para enviar el recibo.', {
        tipo: 'warning',
        titulo: 'WhatsApp no disponible'
      });
      return;
    }

    let archivoImagen = null;
    try {
      archivoImagen = await generarImagenReciboCobroFile(mov);
    } catch (error) {
      console.error('No se pudo generar la imagen del recibo para compartir', error);
    }

    const puedeCompartirImagen = Boolean(
      archivoImagen &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (!navigator.canShare || navigator.canShare({ files: [archivoImagen] }))
    );

    if (puedeCompartirImagen) {
      try {
        await navigator.share({
          files: [archivoImagen]
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    if (archivoImagen) {
      descargarArchivoTemporal(archivoImagen);
      await notificarSistema('Se descargó la imagen vertical del recibo para adjuntarla manualmente en WhatsApp.', {
        tipo: 'warning',
        titulo: 'Adjunto manual requerido'
      });
      return;
    }
    await notificarSistema('No se pudo generar la imagen del recibo para compartir por WhatsApp.', {
      tipo: 'error',
      titulo: 'Error al compartir'
    });
  };

  const abrirReciboCobro = async (mov = null) => {
    const resumen = construirResumenReciboCobro(mov);
    if (!resumen) {
      await notificarSistema('No se pudo construir el recibo para este cobro.', {
        tipo: 'warning',
        titulo: 'Recibo no disponible'
      });
      return;
    }
    setReciboCobroSeleccionado({
      movimientoId: mov?.id || '',
      movimiento: mov || null,
      resumen
    });
    setModalActivo('recibo_cobro');
  };

  const blobADataUrl = (blob) => new Promise((resolve) => {
    if (!blob) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result || '').toString());
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });

  const srcADataUrl = async (src = '') => {
    const origen = (src || '').toString().trim();
    if (!origen) return '';
    try {
      if (origen.startsWith('data:')) return origen;
      const response = await fetch(origen);
      if (!response.ok) return '';
      const blob = await response.blob();
      return blobADataUrl(blob);
    } catch (error) {
      return '';
    }
  };

  useEffect(() => {
    let activo = true;
    srcADataUrl(configuracion?.logo || '').then((dataUrl) => {
      if (activo) setLogoEmpresaRender(dataUrl || '');
    });
    return () => {
      activo = false;
    };
  }, [configuracion?.logo]);

  const parsearRespuestaImagenIa = async (response) => {
    const tipo = (response.headers.get('content-type') || '').toLowerCase();
    if (tipo.startsWith('image/')) return response.blob();

    const data = await response.json().catch(() => ({}));
    const candidato = (
      data?.imageDataUrl
      || data?.imageBase64
      || data?.dataUrl
      || data?.output
      || data?.result
      || data?.imagen
      || ''
    ).toString();
    if (!candidato) return null;

    if (candidato.startsWith('data:image/')) {
      const partes = candidato.split(',');
      const mime = (partes[0].match(/data:(.*?);base64/) || [])[1] || 'image/jpeg';
      const bin = atob(partes[1] || '');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }

    const bin = atob(candidato.replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'image/jpeg' });
  };

  const canvasADataUrl = (fuente, mime = 'image/png', quality = 0.95) => {
    if (!fuente) return '';
    if (typeof fuente.toDataURL === 'function') {
      try {
        return fuente.toDataURL(mime, quality);
      } catch (error) {
        return '';
      }
    }
    const width = Math.max(1, fuente.width || 0);
    const height = Math.max(1, fuente.height || 0);
    if (!width || !height) return '';
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(fuente, 0, 0, width, height);
    return canvas.toDataURL(mime, quality);
  };

  const obtenerDataUrlProductoRecortado = async (src = '') => {
    const origen = (src || '').toString().trim();
    if (!origen) return '';
    const imagenRecortada = await obtenerImagenProductoRecortadaInteligente(origen, { usarIa: true });
    if (imagenRecortada) {
      const dataUrl = canvasADataUrl(imagenRecortada, 'image/png', 0.95);
      if (dataUrl) return dataUrl;
    }
    return srcADataUrl(origen);
  };

  const renderizarOfertaConIaExterna = async ({
    item,
    tituloOferta,
    vigenciaTexto,
    aclaraciones,
    fechaArchivo,
    plantillaDataUrl
  }) => {
    const endpoint = (configuracion?.ofertaIaEndpoint || '').toString().trim();
    if (!endpoint) return null;

    const productoDataUrl = await obtenerDataUrlProductoRecortado(item?.imagen || '');
    if (!productoDataUrl) return null;

    const payload = {
      style: 'mundo_led_template_v1',
      title: tituloOferta,
      validity: vigenciaTexto,
      notes: aclaraciones || '',
      businessName: configuracion?.nombre || 'Mi Negocio',
      businessLogoDataUrl: (configuracion?.logo || '').toString().trim() || '',
      templateDataUrl: plantillaDataUrl || '',
      product: {
        description: item?.descripcion || 'Producto',
        details: item?.detalles || '',
        priceFormatted: formatearDinero(parseNumeroPresupuesto(item?.precio)),
        imageDataUrl: productoDataUrl
      },
      output: {
        format: 'jpg',
        width: 2160,
        height: 3840,
        quality: 0.95
      }
    };

    const headers = { 'Content-Type': 'application/json' };
    const token = (configuracion?.ofertaIaToken || '').toString().trim();
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OFERTA_IA_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detalle = await response.text().catch(() => '');
      throw new Error(`Render IA externo falló (${response.status}) ${detalle || ''}`.trim());
    }

    const blob = await parsearRespuestaImagenIa(response);
    if (!blob) return null;
    const base = `oferta_${normalizarTextoArchivo(tituloOferta)}_${normalizarTextoArchivo(item?.descripcion || 'item')}_${fechaArchivo}`;
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  };

  const cargarImagenParaCanvas = (src) => new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  const dividirTextoCanvas = (ctx, texto, maxWidth, maxLineas = 0) => {
    const palabras = (texto || '').toString().split(/\s+/).filter(Boolean);
    const lineas = [];
    let actual = '';

    palabras.forEach((palabra) => {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (ctx.measureText(prueba).width <= maxWidth) {
        actual = prueba;
      } else {
        if (actual) lineas.push(actual);
        actual = palabra;
      }
    });
    if (actual) lineas.push(actual);

    if (maxLineas > 0 && lineas.length > maxLineas) {
      const recortadas = lineas.slice(0, maxLineas);
      let ultima = recortadas[maxLineas - 1];
      while (ctx.measureText(`${ultima}...`).width > maxWidth && ultima.length > 0) {
        ultima = ultima.slice(0, -1);
      }
      recortadas[maxLineas - 1] = `${ultima}...`;
      return recortadas;
    }
    return lineas;
  };

  const dibujarRectRedondeado = (ctx, x, y, w, h, radio) => {
    const r = Math.min(radio, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const distanciaColor = (r1, g1, b1, r2, g2, b2) => {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return Math.sqrt((dr * dr) + (dg * dg) + (db * db));
  };

  const recortarFondoImagenProducto = (img) => {
    if (!img) return null;

    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const pixels = width * height;
    const borderSamples = [];
    const step = Math.max(1, Math.floor(Math.min(width, height) / 24));

    const pushSample = (x, y) => {
      const idx = ((y * width) + x) * 4;
      const a = data[idx + 3];
      if (a < 18) return;
      borderSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
    };

    for (let x = 0; x < width; x += step) {
      pushSample(x, 0);
      pushSample(x, height - 1);
    }
    for (let y = 0; y < height; y += step) {
      pushSample(0, y);
      pushSample(width - 1, y);
    }
    pushSample(0, 0);
    pushSample(width - 1, 0);
    pushSample(0, height - 1);
    pushSample(width - 1, height - 1);

    if (borderSamples.length < 6) return canvas;

    const avg = borderSamples.reduce((acc, c) => {
      acc[0] += c[0];
      acc[1] += c[1];
      acc[2] += c[2];
      return acc;
    }, [0, 0, 0]).map((v) => v / borderSamples.length);

    const dispersion = borderSamples.reduce((acc, c) => acc + distanciaColor(c[0], c[1], c[2], avg[0], avg[1], avg[2]), 0) / borderSamples.length;
    const brilloPromedio = (avg[0] + avg[1] + avg[2]) / 3;
    const esFondoSimple = dispersion < 45 || brilloPromedio > 220 || brilloPromedio < 36;
    if (!esFondoSimple) return canvas;

    let tolerancia = 46;
    if (dispersion > 20) tolerancia += 8;
    if (brilloPromedio > 220 || brilloPromedio < 36) tolerancia += 14;
    tolerancia = Math.min(78, tolerancia);

    const visitado = new Uint8Array(pixels);
    const cola = [];

    const esPixelFondo = (pos) => {
      const offset = pos * 4;
      const alpha = data[offset + 3];
      if (alpha < 16) return true;
      return distanciaColor(
        data[offset],
        data[offset + 1],
        data[offset + 2],
        avg[0],
        avg[1],
        avg[2]
      ) <= tolerancia;
    };

    const encolar = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const pos = (y * width) + x;
      if (visitado[pos]) return;
      if (!esPixelFondo(pos)) return;
      visitado[pos] = 1;
      cola.push(pos);
    };

    for (let x = 0; x < width; x += 1) {
      encolar(x, 0);
      encolar(x, height - 1);
    }
    for (let y = 0; y < height; y += 1) {
      encolar(0, y);
      encolar(width - 1, y);
    }

    for (let head = 0; head < cola.length; head += 1) {
      const pos = cola[head];
      const x = pos % width;
      const y = Math.floor(pos / width);
      encolar(x + 1, y);
      encolar(x - 1, y);
      encolar(x, y + 1);
      encolar(x, y - 1);
    }

    for (let pos = 0; pos < pixels; pos += 1) {
      if (!visitado[pos]) continue;
      data[(pos * 4) + 3] = 0;
    }

    ctx.putImageData(imageData, 0, 0);

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[((y * width) + x) * 4 + 3];
        if (alpha < 24) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < minX || maxY < minY) return canvas;

    const padding = Math.max(6, Math.round(Math.max(width, height) * 0.02));
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(width - cropX, (maxX - minX + 1) + (padding * 2));
    const cropH = Math.min(height - cropY, (maxY - minY + 1) + (padding * 2));

    const out = document.createElement('canvas');
    out.width = cropW;
    out.height = cropH;
    const outCtx = out.getContext('2d');
    if (!outCtx) return canvas;
    outCtx.clearRect(0, 0, cropW, cropH);
    outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return out;
  };

  const normalizarApiKeyRecorteIa = (valor = '') => (valor || '').toString().trim();

  const obtenerBlobDesdeSrcParaRecorte = async (src = '') => {
    const origen = (src || '').toString().trim();
    if (!origen) return null;
    const response = await fetch(origen);
    if (!response.ok) return null;
    return response.blob();
  };

  const recortarPorCanalAlpha = (fuente, paddingRatio = 0.02) => {
    if (!fuente) return null;
    const width = Math.max(1, fuente.width || 0);
    const height = Math.max(1, fuente.height || 0);
    if (!width || !height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(fuente, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[((y * width) + x) * 4 + 3];
        if (alpha < 16) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < minX || maxY < minY) return null;
    const padding = Math.max(8, Math.round(Math.max(width, height) * paddingRatio));
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(width - cropX, (maxX - minX + 1) + (padding * 2));
    const cropH = Math.min(height - cropY, (maxY - minY + 1) + (padding * 2));

    const out = document.createElement('canvas');
    out.width = cropW;
    out.height = cropH;
    const outCtx = out.getContext('2d');
    if (!outCtx) return canvas;
    outCtx.clearRect(0, 0, cropW, cropH);
    outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return out;
  };

  const removerFondoImagenConIa = async (src = '', apiKey = '') => {
    const clave = normalizarApiKeyRecorteIa(apiKey);
    if (!clave) return null;

    const sourceBlob = await obtenerBlobDesdeSrcParaRecorte(src);
    if (!sourceBlob) return null;

    const formData = new FormData();
    formData.append('image_file', sourceBlob, `producto-${Date.now()}.png`);
    formData.append('size', 'auto');
    formData.append('format', 'png');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RECORTE_IA_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(RECORTE_IA_ENDPOINT, {
        method: 'POST',
        headers: { 'X-Api-Key': clave },
        body: formData,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detalle = await response.text().catch(() => '');
      throw new Error(`Recorte IA no disponible (${response.status}). ${detalle || 'Sin detalle.'}`);
    }

    const salidaBlob = await response.blob();
    const objectUrl = URL.createObjectURL(salidaBlob);
    try {
      const imagen = await cargarImagenParaCanvas(objectUrl);
      if (!imagen) return null;
      return recortarPorCanalAlpha(imagen, 0.018) || imagen;
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  };

  const obtenerImagenProductoRecortadaInteligente = async (src = '', opciones = {}) => {
    const origen = (src || '').toString().trim();
    if (!origen) return null;

    const usarIa = opciones?.usarIa !== false;
    const apiKey = normalizarApiKeyRecorteIa(configuracion?.recorteIaApiKey);
    const claveSrc = origen.length > 160 ? `${origen.slice(0, 160)}::${origen.length}` : origen;
    const cacheKey = `${usarIa ? 'ia' : 'local'}|${apiKey ? 'con-key' : 'sin-key'}|${claveSrc}`;
    const cache = cacheRecorteImagenRef.current;

    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const imagenOriginal = await cargarImagenParaCanvas(origen);
    if (!imagenOriginal) {
      cache.set(cacheKey, null);
      return null;
    }

    let imagenFinal = null;

    if (usarIa && apiKey) {
      try {
        imagenFinal = await removerFondoImagenConIa(origen, apiKey);
      } catch (error) {
        console.warn('No se pudo aplicar recorte IA, se usará recorte local.', error);
      }
    }

    if (!imagenFinal) {
      imagenFinal = recortarFondoImagenProducto(imagenOriginal) || imagenOriginal;
    }

    cache.set(cacheKey, imagenFinal);
    return imagenFinal;
  };

  const generarImagenRecordatorioFile = async ({ cliente, saldoPendiente, dias }) => {
    const width = 2160;
    const height = 3840;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el contexto de imagen.');

    const fondoGrad = ctx.createLinearGradient(0, 0, 0, height);
    fondoGrad.addColorStop(0, '#eef3ff');
    fondoGrad.addColorStop(1, '#e9effd');
    ctx.fillStyle = fondoGrad;
    ctx.fillRect(0, 0, width, height);

    const acento = ctx.createLinearGradient(0, 0, width, 0);
    acento.addColorStop(0, '#4f46e5');
    acento.addColorStop(1, '#06b6d4');
    ctx.fillStyle = acento;
    ctx.fillRect(0, 0, width, 26);

    dibujarRectRedondeado(ctx, 104, 164, width - 208, height - 328, 58);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#dbe3f3';
    ctx.lineWidth = 4;
    ctx.stroke();

    let y = 300;
    const logo = await cargarImagenParaCanvas(configuracion.logo);
    if (logo) {
      const logoMaxW = 1320;
      const logoMaxH = 500;
      const escalaBase = Math.min(logoMaxW / logo.width, logoMaxH / logo.height);
      const escalaLogo = Math.min(escalaBase, 1.55);
      const logoW = Math.round(logo.width * escalaLogo);
      const logoH = Math.round(logo.height * escalaLogo);
      ctx.drawImage(logo, Math.round((width - logoW) / 2), y, logoW, logoH);
      y += logoH + 58;
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#111827';
      ctx.font = '800 80px Manrope, system-ui, sans-serif';
      ctx.fillText((configuracion.nombre || 'MI NEGOCIO').toUpperCase(), width / 2, y + 60);
      y += 152;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#4b5563';
    ctx.font = '700 64px Manrope, system-ui, sans-serif';
    ctx.fillText('Recordatorio de Pago', width / 2, y);
    y += 130;

    ctx.fillStyle = '#111827';
    ctx.font = '900 102px Manrope, system-ui, sans-serif';
    const lineasCliente = dividirTextoCanvas(ctx, cliente?.nombre || 'Cliente', width - 420, 2);
    lineasCliente.forEach((linea) => {
      ctx.fillText(linea, width / 2, y);
      y += 108;
    });
    y += 34;

    dibujarRectRedondeado(ctx, 222, y, width - 444, 540, 50);
    const saldoGrad = ctx.createLinearGradient(222, y, width - 222, y + 540);
    saldoGrad.addColorStop(0, '#fff6f6');
    saldoGrad.addColorStop(1, '#fff0f2');
    ctx.fillStyle = saldoGrad;
    ctx.fill();
    ctx.strokeStyle = '#fbcfe8';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.fillStyle = '#9d174d';
    ctx.font = '800 56px Manrope, system-ui, sans-serif';
    ctx.fillText('Saldo pendiente', width / 2, y + 118);
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 134px Manrope, system-ui, sans-serif';
    ctx.fillText(formatearDinero(saldoPendiente), width / 2, y + 305);
    ctx.fillStyle = '#475569';
    ctx.font = '700 46px Manrope, system-ui, sans-serif';
    ctx.fillText(`${dias} día(s) desde la venta más antigua pendiente`, width / 2, y + 430);

    y += 680;
    ctx.fillStyle = '#334155';
    ctx.font = '600 50px Manrope, system-ui, sans-serif';
    const texto1 = dividirTextoCanvas(ctx, 'Hola, esperamos que estés muy bien.', width - 400, 2);
    texto1.forEach((linea) => {
      ctx.fillText(linea, width / 2, y);
      y += 70;
    });
    y += 30;
    const texto2 = dividirTextoCanvas(ctx, 'Cuando quieras, podemos ayudarte a regularizar el saldo por el medio de pago que te quede más cómodo.', width - 400, 4);
    texto2.forEach((linea) => {
      ctx.fillText(linea, width / 2, y);
      y += 66;
    });
    y += 30;
    ctx.fillStyle = '#1f2937';
    ctx.font = '800 56px Manrope, system-ui, sans-serif';
    ctx.fillText('Muchas gracias.', width / 2, y);

    y = height - 338;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 42px Manrope, system-ui, sans-serif';
    ctx.fillText(`Emitido: ${new Date().toLocaleDateString('es-AR')}`, width / 2, y);
    y += 68;
    ctx.fillStyle = '#1f2937';
    ctx.font = '800 54px Manrope, system-ui, sans-serif';
    ctx.fillText(configuracion.nombre || 'Mi Negocio', width / 2, y);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo exportar la imagen de recordatorio.');
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const base = `recordatorio_${normalizarTextoArchivo(cliente?.nombre || 'cliente')}_${fecha}`;
    return new File([blob], `${base}.png`, { type: 'image/png' });
  };

  const dibujarImagenContainCanvas = (ctx, img, x, y, w, h, padding = 0) => {
    if (!ctx || !img || w <= 0 || h <= 0) return false;
    const areaX = x + padding;
    const areaY = y + padding;
    const areaW = Math.max(1, w - (padding * 2));
    const areaH = Math.max(1, h - (padding * 2));
    const escala = Math.min(areaW / img.width, areaH / img.height);
    const drawW = Math.max(1, Math.round(img.width * escala));
    const drawH = Math.max(1, Math.round(img.height * escala));
    const drawX = areaX + ((areaW - drawW) / 2);
    const drawY = areaY + ((areaH - drawH) / 2);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    return true;
  };

  const generarImagenesOfertaJpgFiles = async (oferta = {}) => {
    const itemsTotales = Array.isArray(oferta?.items) ? oferta.items : [];
    if (!itemsTotales.length) throw new Error('La oferta no tiene productos seleccionados.');

    const width = 2160;
    const height = 3840;
    const fechaRef = new Date(oferta?.fecha || Date.now());
    const fechaArchivo = fechaRef.toISOString().slice(0, 10).replace(/-/g, '');
    const tituloOferta = (oferta?.titulo || 'Ofertas Especiales').toString().trim();
    const aclaraciones = (oferta?.aclaraciones || '').toString().trim();
    const vigenciaDesdeRaw = (oferta?.vigenciaDesde || '').toString().trim();
    const vigenciaHastaRaw = (oferta?.vigenciaHasta || '').toString().trim();
    const vigenciaDesdeInput = esFechaInputValida(vigenciaDesdeRaw) ? vigenciaDesdeRaw : obtenerFechaInputLocal(fechaRef);
    const vigenciaHastaInput = esFechaInputValida(vigenciaHastaRaw) ? vigenciaHastaRaw : vigenciaDesdeInput;
    const vigenciaDesdeDate = new Date(`${vigenciaDesdeInput}T12:00:00`);
    const vigenciaHastaDate = new Date(`${vigenciaHastaInput}T12:00:00`);
    const vigenciaInicio = vigenciaHastaDate < vigenciaDesdeDate ? vigenciaHastaDate : vigenciaDesdeDate;
    const vigenciaFin = vigenciaHastaDate < vigenciaDesdeDate ? vigenciaDesdeDate : vigenciaHastaDate;
    const vigenciaTexto = `Vigencia: ${formatearFecha(vigenciaInicio)} al ${formatearFecha(vigenciaFin)}`;
    const plantillaDataUrl = await srcADataUrl(OFERTA_TEMPLATE_BASE_URL);

    const imagenesMap = new Map();
    const imagenesUnicas = Array.from(new Set(itemsTotales.map((item) => item?.imagen).filter(Boolean)));
    await Promise.all(imagenesUnicas.map(async (src) => {
      const recortada = await obtenerImagenProductoRecortadaInteligente(src, { usarIa: true });
      if (recortada) {
        imagenesMap.set(src, recortada);
        return;
      }
      const base = await cargarImagenParaCanvas(src);
      imagenesMap.set(src, base || null);
    }));

    const archivos = [];
    for (let itemIndex = 0; itemIndex < itemsTotales.length; itemIndex += 1) {
      const item = itemsTotales[itemIndex];

      try {
        const archivoIa = await renderizarOfertaConIaExterna({
          item,
          tituloOferta,
          vigenciaTexto,
          aclaraciones,
          fechaArchivo,
          plantillaDataUrl
        });
        if (archivoIa) {
          archivos.push(archivoIa);
          continue;
        }
      } catch (error) {
        console.warn('No se pudo renderizar la oferta por IA externa. Se usa render local.', error);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const fondo = ctx.createLinearGradient(0, 0, 0, height);
      fondo.addColorStop(0, '#0b1324');
      fondo.addColorStop(1, '#05080f');
      ctx.fillStyle = fondo;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = '#22324f';
      ctx.lineWidth = 4;
      for (let i = 0; i < 14; i += 1) {
        const yLinea = 420 + (i * 210);
        ctx.beginPath();
        ctx.moveTo(0, yLinea);
        ctx.lineTo(width, yLinea - 70);
        ctx.stroke();
      }
      ctx.restore();

      const logoOferta = await cargarImagenParaCanvas(configuracion.logo || '');
      if (logoOferta) {
        const logoMaxW = 720;
        const logoMaxH = 280;
        const esc = Math.min(logoMaxW / logoOferta.width, logoMaxH / logoOferta.height, 1);
        const logoW = Math.round(logoOferta.width * esc);
        const logoH = Math.round(logoOferta.height * esc);
        ctx.drawImage(logoOferta, Math.round((width - logoW) / 2), 80, logoW, logoH);
      }

      dibujarRectRedondeado(ctx, 180, 610, 1800, 390, 40);
      ctx.fillStyle = 'rgba(5, 10, 20, 0.78)';
      ctx.fill();

      dibujarRectRedondeado(ctx, 170, 1015, 1820, 1440, 48);
      ctx.fillStyle = 'rgba(7, 12, 22, 0.56)';
      ctx.fill();

      dibujarRectRedondeado(ctx, 150, 2490, 1860, 590, 38);
      ctx.fillStyle = 'rgba(8, 13, 24, 0.76)';
      ctx.fill();

      dibujarRectRedondeado(ctx, 300, 3155, 1560, 380, 34);
      ctx.fillStyle = 'rgba(17, 24, 39, 0.86)';
      ctx.fill();

      ctx.textAlign = 'center';
      let y = 790;

      const tituloGrad = ctx.createLinearGradient(340, 0, width - 340, 0);
      tituloGrad.addColorStop(0, '#33e1ff');
      tituloGrad.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = tituloGrad;
      ctx.font = '900 142px Manrope, system-ui, sans-serif';
      const lineasTitulo = dividirTextoCanvas(ctx, tituloOferta.toUpperCase(), 1700, 2);
      lineasTitulo.forEach((linea) => {
        ctx.fillText(linea, width / 2, y);
        y += 152;
      });

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 56px Manrope, system-ui, sans-serif';
      ctx.fillText(vigenciaTexto, width / 2, y + 4);
      y += 90;

      const img = imagenesMap.get(item?.imagen) || null;
      if (img) {
        ctx.save();
        ctx.shadowColor = 'rgba(79, 70, 229, 0.38)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 8;
        dibujarImagenContainCanvas(ctx, img, 220, 1060, 1720, 1340, 24);
        ctx.restore();
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 62px Manrope, system-ui, sans-serif';
        ctx.fillText('Sin imagen de producto', width / 2, 1620);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 104px Manrope, system-ui, sans-serif';
      const lineasDescripcion = dividirTextoCanvas(ctx, (item?.descripcion || 'Producto').toUpperCase(), 1700, 2);
      let descY = 2740;
      lineasDescripcion.forEach((linea) => {
        ctx.fillText(linea, width / 2, descY);
        descY += 108;
      });

      if ((item?.detalles || '').trim()) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '700 52px Manrope, system-ui, sans-serif';
        const lineasDetalle = dividirTextoCanvas(ctx, item.detalles, 1760, 2);
        lineasDetalle.forEach((linea) => {
          ctx.fillText(linea, width / 2, descY + 18);
          descY += 78;
        });
      }

      const gradPrecioBorde = ctx.createLinearGradient(300, 3155, 1860, 3535);
      gradPrecioBorde.addColorStop(0, '#34dfff');
      gradPrecioBorde.addColorStop(1, '#8b5cf6');
      ctx.strokeStyle = gradPrecioBorde;
      ctx.lineWidth = 8;
      dibujarRectRedondeado(ctx, 300, 3155, 1560, 380, 34);
      ctx.stroke();

      ctx.fillStyle = '#8b5cf6';
      ctx.font = '900 58px Manrope, system-ui, sans-serif';
      ctx.fillText('PRECIO OFERTA', width / 2, 3310);
      ctx.font = '900 148px Manrope, system-ui, sans-serif';
      ctx.fillText(formatearDinero(parseNumeroPresupuesto(item?.precio)), width / 2, 3478);

      if (aclaraciones) {
        ctx.fillStyle = '#fca5a5';
        ctx.font = '700 42px Manrope, system-ui, sans-serif';
        const lineaAcl = dividirTextoCanvas(ctx, aclaraciones, 1700, 1)[0] || '';
        if (lineaAcl) ctx.fillText(lineaAcl, width / 2, 3650);
      }

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) continue;
      const base = `oferta_${normalizarTextoArchivo(tituloOferta)}_${normalizarTextoArchivo(item?.descripcion || `item_${itemIndex + 1}`)}_${fechaArchivo}`;
      archivos.push(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
    }

    return archivos;
  };

  const exportarOfertaComoJpg = async (ofertaData, opciones = {}) => {
    try {
      const archivos = (Array.isArray(opciones?.archivos) && opciones.archivos.length)
        ? opciones.archivos
        : await generarImagenesOfertaJpgFiles(ofertaData);
      if (!archivos.length) {
        throw new Error('No se pudo generar la imagen de oferta.');
      }

      let compartido = false;
      const puedeCompartir = Boolean(
        archivos.length === 1
        && typeof navigator !== 'undefined'
        && typeof navigator.share === 'function'
        && (!navigator.canShare || navigator.canShare({ files: [archivos[0]] }))
      );

      if (puedeCompartir) {
        try {
          await navigator.share({
            title: ofertaData?.titulo || 'Oferta Comercial',
            text: `¡Hola! Te compartimos una oferta de ${configuracion.nombre || 'Mi negocio'}.`,
            files: [archivos[0]]
          });
          compartido = true;
        } catch (error) {
          if (error?.name !== 'AbortError') {
            console.error('No se pudo compartir la imagen de oferta', error);
          }
        }
      }

      let copiada = false;
      if (!compartido) {
        copiada = archivos.length === 1 ? await copiarImagenAlPortapapeles(archivos[0]) : false;
        if (archivos.length === 1) {
          descargarArchivoTemporal(archivos[0]);
        } else {
          archivos.forEach((archivo, index) => {
            if (index === 0) {
              descargarArchivoTemporal(archivo);
              return;
            }
            setTimeout(() => descargarArchivoTemporal(archivo), index * 180);
          });
        }
      }
      if (!compartido) abrirWhatsAppChat();
      await notificarSistema(
        `${compartido ? 'Imagen de oferta compartida correctamente.' : `Imagen JPG generada (${archivos.length} archivo${archivos.length === 1 ? '' : 's'}).`} ${!compartido ? 'Se abrió WhatsApp. ' : ''}${copiada ? 'La imagen también se copió al portapapeles para pegarla directo en el chat.' : ''}`,
        { tipo: 'success', titulo: 'Oferta exportada en imagen' }
      );
    } catch (error) {
      console.error('Error al exportar oferta en JPG', error);
      await notificarSistema('No se pudo generar la imagen JPG de la oferta.', {
        tipo: 'error',
        titulo: 'Error al exportar'
      });
    }
  };

  const generarPdfPresupuestoFile = async (p) => {
    const resumen = calcularResumenPresupuesto(p.items || [], p.descuentoGeneral || 0);
    const soloPreciosPorItem = Boolean(p?.soloPreciosPorItem);
    const mostrarDesc = !soloPreciosPorItem && (p.items || []).some((item) => parseNumeroPresupuesto(item?.descuento) > 0);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const numeroPresupuesto = obtenerNumeroPresupuestoTexto(p);
    const nombreEmpresaPdf = obtenerNombreEmpresaPresupuesto(p);
    const logoFuentePdf = obtenerLogoEmpresaPresupuesto(p);
    const logoPdf = logoFuentePdf ? (logoFuentePdf.startsWith('data:') ? logoFuentePdf : await srcADataUrl(logoFuentePdf)) : '';
    const contactoCabeceraPdf = construirContactoNegocioPdf(configuracion, { incluirDireccion: true }).join(' • ');

    if (logoPdf) {
      try {
        const propsLogo = doc.getImageProperties(logoPdf);
        const ratioLogo = (propsLogo?.width || 1) / Math.max(propsLogo?.height || 1, 1);
        const boxLogo = { x: 14, y: 9, w: 48, h: 18 };
        let drawW = boxLogo.w;
        let drawH = drawW / Math.max(ratioLogo, 0.01);
        if (drawH > boxLogo.h) {
          drawH = boxLogo.h;
          drawW = drawH * ratioLogo;
        }
        const drawY = boxLogo.y + ((boxLogo.h - drawH) / 2);
        const formatoLogo = /image\/jpe?g/i.test(logoPdf) ? 'JPEG' : 'PNG';
        doc.addImage(logoPdf, formatoLogo, boxLogo.x, drawY, drawW, drawH);
      } catch (error) {
        console.warn('No se pudo insertar el logo en el PDF del presupuesto.', error);
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text((nombreEmpresaPdf || 'MI NEGOCIO').toUpperCase(), logoPdf ? 66 : 14, 14);
    if (contactoCabeceraPdf) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(107, 114, 128);
      const lineasCabeceraPdf = doc.splitTextToSize(contactoCabeceraPdf, logoPdf ? 104 : 132).slice(0, 2);
      doc.text(lineasCabeceraPdf, logoPdf ? 66 : 14, 18.2);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(140, 145, 155);
    doc.text('PRESUPUESTO', 196, 14, { align: 'right' });
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.text(numeroPresupuesto, 196, 20, { align: 'right' });
    doc.text(`FECHA: ${formatearFecha(p.fecha)}`, 196, 25, { align: 'right' });

    doc.setDrawColor(31, 41, 55);
    doc.setLineWidth(0.5);
    doc.line(14, 28.5, 196, 28.5);

    doc.setDrawColor(220, 223, 229);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 32, 182, 18, 2.5, 2.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8.5);
    doc.text('PRESUPUESTADO A NOMBRE DE:', 17, 38);
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11.5);
    doc.text((p.clienteNombre || 'CLIENTE').toUpperCase(), 17, 44);
    if (p.whatsapp) {
      doc.setTextColor(75, 85, 99);
      doc.setFontSize(8.8);
      doc.text(`Tel/WhatsApp: ${p.whatsapp}`, 17, 48);
    }

    const columnas = soloPreciosPorItem
      ? ['Cód.', 'Descripción', 'Precio U.']
      : ['Cód.', 'Descripción', 'Cant.', 'Unid.', 'Precio U.'];
    if (mostrarDesc) columnas.push('Desc.%');
    if (!soloPreciosPorItem) columnas.push('Subtotal');

    const idxSubtotal = mostrarDesc ? 6 : 5;
    const estilosColumnas = soloPreciosPorItem
      ? {
          0: { cellWidth: 22, halign: 'left' },
          1: { cellWidth: 112, halign: 'left' },
          2: { cellWidth: 42, halign: 'right', fontStyle: 'bold' }
        }
      : {
          0: { cellWidth: 18, halign: 'left' },
          1: { cellWidth: 68, halign: 'left' },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 24, halign: 'right' },
          [idxSubtotal]: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
        };
    if (mostrarDesc) estilosColumnas[5] = { cellWidth: 13, halign: 'center' };

    const body = (p.items || []).map((item) => {
      const fila = soloPreciosPorItem
        ? [
            item.codigo || '-',
            item.descripcion || '-',
            formatearDinero(parseNumeroPresupuesto(item.precio))
          ]
        : [
            item.codigo || '-',
            item.descripcion || '-',
            `${item.cantidad ?? '-'}`,
            (item.unidad || '').toUpperCase() || '-',
            formatearDinero(parseNumeroPresupuesto(item.precio))
          ];
      if (mostrarDesc) {
        fila.push(parseNumeroPresupuesto(item?.descuento) > 0 ? `${parseNumeroPresupuesto(item?.descuento)}%` : '-');
      }
      if (!soloPreciosPorItem) fila.push(formatearDinero(calcularTotalItemPresupuesto(item)));
      return fila;
    });

    autoTable(doc, {
      startY: 54,
      head: [columnas],
      body,
      theme: 'grid',
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 1.4, valign: 'top', textColor: [20, 20, 20], lineColor: [230, 230, 230] },
      headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold', lineColor: [31, 41, 55] },
      columnStyles: estilosColumnas
    });

    let y = (doc.lastAutoTable?.finalY || 54) + 6;
    if (y > 250) {
      doc.addPage();
      y = 18;
    }

    if (p.notas) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 106, 116);
      doc.setFontSize(8.5);
      doc.text('OBSERVACIONES / DETALLES:', 14, y);
      const lineasNota = doc.splitTextToSize(p.notas, 106);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(65, 70, 80);
      doc.setFontSize(8.3);
      doc.text(lineasNota, 14, y + 4.5);
    }

    if (soloPreciosPorItem) {
      doc.setFontSize(7);
      doc.setTextColor(155, 161, 170);
      doc.text(`Emitido por: ${usuarioActual.nombre}`, 14, 289.5);
      const contactoPiePdf = contactoCabeceraPdf || nombreEmpresaPdf;
      if (contactoPiePdf) {
        doc.setFontSize(6.5);
        doc.text(contactoPiePdf, 14, 293);
      }

      const nombreArchivo = obtenerNombreArchivoPresupuesto(p, true);
      const blob = doc.output('blob');
      return new File([blob], nombreArchivo, { type: 'application/pdf' });
    }

    const yCaja = Math.max(y, 244);
    if (yCaja > 260) {
      doc.addPage();
    }
    const yResumen = yCaja > 260 ? 18 : yCaja;
    const totalEnLetras = doc.splitTextToSize(numeroALetras(resumen.total), 70);
    const altoCaja = 24 + (totalEnLetras.length * 3.6);

    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(31, 41, 55);
    doc.setLineWidth(0.7);
    doc.roundedRect(120, yResumen, 76, altoCaja, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    let yCursor = yResumen + 5;
    if (resumen.descuentoItems > 0) {
      doc.text(`Descuento por ítems: -${formatearDinero(resumen.descuentoItems)}`, 192, yCursor, { align: 'right' });
      yCursor += 4;
    }
    if (resumen.descuentoGeneralMonto > 0) {
      doc.text(`Desc. general (${resumen.descuentoGeneralPct}%): -${formatearDinero(resumen.descuentoGeneralMonto)}`, 192, yCursor, { align: 'right' });
      yCursor += 4;
    }
    doc.setFontSize(10.5);
    doc.text('TOTAL PRESUPUESTO', 192, yCursor + 2, { align: 'right' });
    doc.setFontSize(19);
    doc.setTextColor(17, 24, 39);
    doc.text(formatearDinero(resumen.total), 192, yCursor + 10, { align: 'right' });
    doc.setFontSize(7.2);
    doc.setTextColor(107, 114, 128);
    doc.text(totalEnLetras, 192, yCursor + 15, { align: 'right' });

    doc.setFontSize(7);
    doc.setTextColor(155, 161, 170);
    doc.text(`Emitido por: ${usuarioActual.nombre}`, 14, 289.5);
    const contactoPiePdf = contactoCabeceraPdf || nombreEmpresaPdf;
    if (contactoPiePdf) {
      doc.setFontSize(6.5);
      doc.text(contactoPiePdf, 14, 293);
    }

    const nombreArchivo = obtenerNombreArchivoPresupuesto(p, true);
    const blob = doc.output('blob');
    return new File([blob], nombreArchivo, { type: 'application/pdf' });
  };

  const enviarWhatsAppPresupuesto = async (p) => {
    if (!p?.whatsapp) {
      await notificarSistema('Este cliente no tiene un número de WhatsApp registrado.', {
        tipo: 'warning',
        titulo: 'WhatsApp no disponible'
      });
      return;
    }

    const numeroDestino = normalizarNumeroWhatsApp(p.whatsapp);
    if (!numeroDestino) {
      await notificarSistema('El número de WhatsApp del cliente no es válido.', {
        tipo: 'warning',
        titulo: 'Número inválido'
      });
      return;
    }
    const texto = `Hola ${p.clienteNombre},\nTe envío el presupuesto solicitado por un total de *${formatearDinero(p.total)}*.\n\nTe adjunto el documento PDF con todos los detalles y condiciones.\n\nQuedamos a tu disposición.\n${configuracion.nombre}`;
    let archivoPdf = null;

    try {
      archivoPdf = await generarPdfPresupuestoFile(p);
    } catch (error) {
      console.error('No se pudo generar el PDF del presupuesto', error);
    }

    const puedeCompartirArchivo = Boolean(
      archivoPdf &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (!navigator.canShare || navigator.canShare({ files: [archivoPdf] }))
    );

    if (puedeCompartirArchivo) {
      try {
        await navigator.share({
          title: `Presupuesto ${obtenerNumeroPresupuestoTexto(p)}`,
          text: texto,
          files: [archivoPdf]
        });
        setModalActivo(null);
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('No se pudo compartir el PDF por Web Share API', error);
      }
    }

    if (archivoPdf) {
      descargarArchivoTemporal(archivoPdf);
      await notificarSistema('Tu navegador no permite adjuntar PDF directo en WhatsApp Web. Se descargó el PDF para adjuntarlo manualmente en el chat.', {
        tipo: 'warning',
        titulo: 'Adjunto manual requerido'
      });
    } else {
      await notificarSistema('No se pudo generar el PDF automáticamente. Se enviará el texto por WhatsApp.', {
        tipo: 'warning',
        titulo: 'PDF no disponible'
      });
    }

    const url = construirUrlWhatsApp(numeroDestino, texto);
    if (url) window.open(url, '_blank');
    setModalActivo(null);
  };

  const enviarRecordatorioCliente = async (cliente, estadoInput = null) => {
    if (!cliente) return;
    if (!cliente.whatsapp) {
      await notificarSistema('Este cliente no tiene un número de WhatsApp registrado.', {
        tipo: 'warning',
        titulo: 'WhatsApp no disponible'
      });
      return;
    }

    const estado = estadoInput || estadoCuentaClientes[cliente.id] || {};
    const tieneDeuda = Boolean(estado.tieneDeuda || Number(cliente.saldo || 0) > 0);
    if (!tieneDeuda) {
      await notificarSistema('El cliente está al día, no hay saldo pendiente para recordar.', {
        tipo: 'info',
        titulo: 'Sin deuda pendiente'
      });
      return;
    }

    const numeroWhatsappRaw = textoSeguroTrim(cliente?.whatsapp, '');
    const numeroDestino = normalizarNumeroWhatsApp(numeroWhatsappRaw);
    if (!numeroDestino) {
      await notificarSistema('El número de WhatsApp del cliente no es válido.', {
        tipo: 'warning',
        titulo: 'Número inválido'
      });
      return;
    }

    const estadoDetallado = calcularEstadoCuentaCliente(cliente);
    const saldoPendienteTickets = (estadoDetallado.ticketsPendientes || []).reduce((acc, ticket) => acc + Number(ticket.pendiente || 0), 0);
    const dias = Number.isFinite(estado?.diasDeuda) ? estado.diasDeuda : (estadoDetallado?.diasDeuda ?? 0);
    const saldoPendiente = Math.max(0, Number(estado?.saldoPendiente || cliente.saldo || 0), saldoPendienteTickets);
    const nombreCliente = textoSeguroTrim(cliente?.nombre, 'Cliente');
    const aliasPago = textoSeguroTrim(configuracion?.pagoAlias, 'mundoled1');
    const cbuPago = textoSeguroTrim(configuracion?.pagoCbu, '');
    const titularPago = textoSeguroTrim(configuracion?.pagoTitular, 'POLINI MAURO MAXIMILIANO');
    const bancoPago = textoSeguroTrim(configuracion?.pagoBanco, 'Mercado Pago');
    const detallePago = textoSeguroTrim(configuracion?.pagoDetalle, '');
    const lineasPago = [
      `*Banco / Billetera:* ${bancoPago}`,
      aliasPago ? `*Alias:* ${aliasPago}` : '',
      cbuPago ? `*CBU:* ${cbuPago}` : '',
      titularPago ? `*Titular:* ${titularPago}` : '',
      detallePago || ''
    ].filter(Boolean);
    const lineasMensaje = [
      `Hola *${nombreCliente}*, ¿cómo estás?`,
      '',
      `Te escribimos desde *${configuracion.nombre || 'MundoLED'}* para acompañarte con tu cuenta.`,
      `Tu saldo pendiente actual es de *${formatearDinero(saldoPendiente)}*.`,
      dias > 0 ? `Ya pasaron *${formatearTextoDias(dias)}* desde la venta pendiente más antigua.` : '',
      '',
      `Si te resulta cómodo, podés abonarlo por ${bancoPago}:`,
      ...lineasPago,
      '',
      'Si necesitás ayuda, te asistimos en todo momento.',
      '¡Muchas gracias!'
    ].filter(Boolean);
    const texto = lineasMensaje.join('\n');
    const urlWhatsApp = construirUrlWhatsApp(numeroDestino, texto);
    if (!urlWhatsApp) {
      await notificarSistema('No se pudo construir el enlace de WhatsApp para este cliente.', {
        tipo: 'error',
        titulo: 'Error en número de WhatsApp'
      });
      return;
    }
    const ventanaWhatsApp = window.open(urlWhatsApp, '_blank');
    if (!ventanaWhatsApp) {
      await notificarSistema('No se pudo abrir WhatsApp automáticamente. Habilitá ventanas emergentes e intentá nuevamente.', {
        tipo: 'error',
        titulo: 'No se pudo abrir WhatsApp'
      });
      return;
    }

    const ahoraRecordatorio = new Date().toISOString();
    const contadorAnterior = Number(cliente.recordatoriosWhatsappEnviados || 0);
    const contadorNuevo = contadorAnterior + 1;

    try {
      await updateDoc(doc(db, 'clientes', cliente.id), {
        recordatoriosWhatsappEnviados: increment(1),
        ultimoRecordatorioWhatsapp: ahoraRecordatorio
      });
      setClientes((prev) => prev.map((c) => c.id === cliente.id
        ? { ...c, recordatoriosWhatsappEnviados: contadorNuevo, ultimoRecordatorioWhatsapp: ahoraRecordatorio }
        : c
      ));
      if (clienteSeleccionado?.id === cliente.id) {
        setClienteSeleccionado((prev) => prev
          ? { ...prev, recordatoriosWhatsappEnviados: contadorNuevo, ultimoRecordatorioWhatsapp: ahoraRecordatorio }
          : prev
        );
      }
    } catch (error) {
      console.error('No se pudo actualizar el contador de recordatorios', error);
      await notificarSistema('WhatsApp se abrió, pero no se pudo guardar el contador del recordatorio. Revisá permisos o conexión de Firebase.', {
        tipo: 'error',
        titulo: 'Contador no actualizado'
      });
      return;
    }

    const textoCopiado = await copiarTextoAlPortapapeles(texto);
    await notificarSistema(
      `Se abrió WhatsApp con el mensaje listo para enviar. ${textoCopiado ? 'También copiamos el texto al portapapeles.' : ''} Recordatorios enviados: ${contadorNuevo}.`,
      { tipo: 'success', titulo: 'Recordatorio listo' }
    );
  };

  const calcularTotalPresupuesto = (items) => {
    return calcularResumenPresupuesto(items, formPresupuesto.descuentoGeneral).total;
  };

  const resumenPresupuestoActual = useMemo(
    () => calcularResumenPresupuesto(formPresupuesto.items, formPresupuesto.descuentoGeneral),
    [formPresupuesto.items, formPresupuesto.descuentoGeneral]
  );

  const cambiarEstadoPresupuesto = async (id, nuevoEstado) => {
    await updateDoc(doc(db, 'presupuestos', id), { estado: nuevoEstado });
    setModalActivo(null);
    setPresupuestoSeleccionado(null);
  };

  const obtenerImagenItemPresupuesto = (item) => {
    if (item?.imagen) return item.imagen;

    const codigoNormalizado = (item?.codigo || '').trim().toLowerCase();
    const descripcionNormalizada = (item?.descripcion || '').trim().toLowerCase();

    const porCodigo = codigoNormalizado
      ? productos.find((p) => (p.codigo || '').trim().toLowerCase() === codigoNormalizado)
      : null;
    if (porCodigo?.imagen) return porCodigo.imagen;

    const porDescripcion = descripcionNormalizada
      ? productos.find((p) => (p.descripcion || '').trim().toLowerCase() === descripcionNormalizada)
      : null;
    if (porDescripcion?.imagen) return porDescripcion.imagen;

    return '';
  };

  const obtenerLogoMarcaItem = (item) => {
    if (item?.logoMarca) return item.logoMarca;

    const idNormalizado = (item?.id || '').toString().trim();
    if (idNormalizado) {
      const porId = productos.find((p) => (p.id || '').toString().trim() === idNormalizado);
      if (porId?.logoMarca) return porId.logoMarca;
    }

    const codigoNormalizado = normalizarTextoBusqueda(item?.codigo || '');
    const descripcionNormalizada = normalizarTextoBusqueda(item?.descripcion || '');

    const porCodigo = codigoNormalizado
      ? productos.find((p) => normalizarTextoBusqueda(p.codigo || '') === codigoNormalizado)
      : null;
    if (porCodigo?.logoMarca) return porCodigo.logoMarca;

    const porDescripcion = descripcionNormalizada
      ? productos.find((p) => normalizarTextoBusqueda(p.descripcion || '') === descripcionNormalizada)
      : null;
    if (porDescripcion?.logoMarca) return porDescripcion.logoMarca;

    if (descripcionNormalizada) {
      const porDescripcionParcial = productos.find((p) => {
        const descripcionProducto = normalizarTextoBusqueda(p.descripcion || '');
        return (
          descripcionProducto.includes(descripcionNormalizada) ||
          descripcionNormalizada.includes(descripcionProducto)
        );
      });
      if (porDescripcionParcial?.logoMarca) return porDescripcionParcial.logoMarca;
    }

    return '';
  };

  const obtenerUnidadItem = (item) => {
    const unidadDirecta = (item?.unidad || '').toString().trim();
    if (unidadDirecta) return unidadDirecta;

    const idNormalizado = (item?.id || '').toString().trim();
    if (idNormalizado) {
      const porId = productos.find((p) => (p.id || '').toString().trim() === idNormalizado);
      if (porId?.unidad) return porId.unidad;
    }

    const codigoNormalizado = normalizarTextoBusqueda(item?.codigo || '');
    const descripcionNormalizada = normalizarTextoBusqueda(item?.descripcion || '');

    const porCodigo = codigoNormalizado
      ? productos.find((p) => normalizarTextoBusqueda(p.codigo || '') === codigoNormalizado)
      : null;
    if (porCodigo?.unidad) return porCodigo.unidad;

    const porDescripcion = descripcionNormalizada
      ? productos.find((p) => normalizarTextoBusqueda(p.descripcion || '') === descripcionNormalizada)
      : null;
    if (porDescripcion?.unidad) return porDescripcion.unidad;

    if (descripcionNormalizada) {
      const porDescripcionParcial = productos.find((p) => {
        const descripcionProducto = normalizarTextoBusqueda(p.descripcion || '');
        return (
          descripcionProducto.includes(descripcionNormalizada) ||
          descripcionNormalizada.includes(descripcionProducto)
        );
      });
      if (porDescripcionParcial?.unidad) return porDescripcionParcial.unidad;
    }

    return 'unid';
  };

  const abreviarUnidadPdf = (unidad) => {
    const textoOriginal = (unidad || '').toString().trim();
    if (!textoOriginal) return 'UNID';

    const normalizada = normalizarTextoBusqueda(textoOriginal).replace(/\./g, '');
    if (['u', 'ud', 'uds', 'uni', 'unid', 'unidad', 'unidades'].includes(normalizada)) return 'UNID';
    if (['m', 'mt', 'mts', 'metro', 'metros'].includes(normalizada)) return 'MTS';
    if (['l', 'lt', 'lts', 'litro', 'litros'].includes(normalizada)) return 'LTS';
    if (['kg', 'kgs', 'kilo', 'kilos'].includes(normalizada)) return 'KG';
    if (['g', 'gr', 'gramo', 'gramos'].includes(normalizada)) return 'GR';
    return textoOriginal.toUpperCase().replace(/\./g, '').slice(0, 6);
  };

  const resumenPresupuestoImpresion = useMemo(() => {
    if (!presupuestoAImprimir) {
      return { subtotalBruto: 0, descuentoItems: 0, subtotalConDescuentos: 0, descuentoGeneralPct: 0, descuentoGeneralMonto: 0, total: 0 };
    }
    return calcularResumenPresupuesto(presupuestoAImprimir.items || [], presupuestoAImprimir.descuentoGeneral || 0);
  }, [presupuestoAImprimir]);

  const soloPreciosPorItemPresupuestoImpresion = Boolean(presupuestoAImprimir?.soloPreciosPorItem);

  const mostrarDescuentoItemEnPdf = useMemo(
    () => !soloPreciosPorItemPresupuestoImpresion && (presupuestoAImprimir?.items || []).some((item) => parseNumeroPresupuesto(item?.descuento) > 0),
    [presupuestoAImprimir, soloPreciosPorItemPresupuestoImpresion]
  );

  const paginasCatalogoImpresion = useMemo(
    () => construirPaginasCatalogo(catalogoAImprimir?.grupos || []),
    [catalogoAImprimir]
  );
  const paginasOfertaImpresion = useMemo(
    () => construirPaginasOferta(ofertaAImprimir?.items || []),
    [ofertaAImprimir]
  );
  const paginasComboImpresion = useMemo(
    () => construirPaginasCombo(comboAImprimir?.items || []),
    [comboAImprimir]
  );
  const paginasPresupuestoImpresion = useMemo(
    () => construirPaginasPresupuesto(presupuestoAImprimir?.items || [], incluirImagenesPdf, presupuestoAImprimir?.notas || ''),
    [presupuestoAImprimir, incluirImagenesPdf]
  );
  const contactoNegocioPdf = useMemo(
    () => construirContactoNegocioPdf(configuracion),
    [configuracion]
  );
  const contactoNegocioCompletoPdf = useMemo(
    () => construirContactoNegocioPdf(configuracion, { incluirDireccion: true }),
    [configuracion]
  );
  const contactoNegocioCabeceraPresupuesto = useMemo(() => {
    const contacto = obtenerContactoNegocio(configuracion);
    return [
      { etiqueta: '', valor: contacto.direccion },
      { etiqueta: 'Web', valor: contacto.web },
      { etiqueta: 'WhatsApp', valor: contacto.whatsapp },
      { etiqueta: 'Correo', valor: contacto.correo }
    ].filter((item) => item.valor);
  }, [configuracion]);
  const lineasContactoNegocioPdf = contactoNegocioCompletoPdf.length > 0
    ? contactoNegocioCompletoPdf
    : [obtenerNombreEmpresaPresupuesto(presupuestoAImprimir)].filter(Boolean);
  const pieEmpresaPresupuestoPdf = contactoNegocioCompletoPdf.length > 0
    ? contactoNegocioCompletoPdf.join(' • ')
    : obtenerNombreEmpresaPresupuesto(presupuestoAImprimir);
  const diagnosticoConfiguracion = useMemo(() => {
    const logoActual = textoSeguroTrim(configuracion?.logo, '');
    const nombreActual = textoSeguroTrim(configuracion?.nombre, '');
    const logoRenderActual = textoSeguroTrim(logoEmpresaRender, '');
    return {
      projectId: db?.app?.options?.projectId || auth?.app?.options?.projectId || '(sin projectId)',
      nombre: nombreActual || '(vacío)',
      usaNombreDefault: nombreActual === CONFIG_DEFAULT.nombre,
      logoGuardado: Boolean(logoActual),
      logoRenderizado: Boolean(logoRenderActual),
      tipoLogo: logoActual
        ? (logoActual.startsWith('data:') ? 'data-url' : 'url')
        : 'sin-logo',
      vistaLogo: logoActual ? recortarTexto(logoActual, 80) : '(vacío)'
    };
  }, [configuracion, logoEmpresaRender]);

  useEffect(() => {
    if (modalActivo !== 'imprimir_presupuesto' || !presupuestoAImprimir) return;
    const tituloOriginal = document.title;
    document.title = obtenerNombreArchivoPresupuesto(presupuestoAImprimir, false);
    return () => {
      document.title = tituloOriginal;
    };
  }, [modalActivo, presupuestoAImprimir]);

  useEffect(() => {
    if (modalActivo !== 'imprimir_oferta' || !ofertaAImprimir) return;
    const tituloOriginal = document.title;
    const fecha = new Date(ofertaAImprimir.fecha || Date.now()).toISOString().slice(0, 10).replace(/-/g, '');
    document.title = `oferta_${normalizarTextoArchivo(ofertaAImprimir.titulo || 'ofertas')}_${fecha}`;
    return () => {
      document.title = tituloOriginal;
    };
  }, [modalActivo, ofertaAImprimir]);

  useEffect(() => {
    if (modalActivo !== 'imprimir_combo' || !comboAImprimir) return;
    const tituloOriginal = document.title;
    const fecha = new Date(comboAImprimir.fecha || Date.now()).toISOString().slice(0, 10).replace(/-/g, '');
    document.title = `combo_${normalizarTextoArchivo(comboAImprimir.titulo || 'combo')}_${fecha}`;
    return () => {
      document.title = tituloOriginal;
    };
  }, [modalActivo, comboAImprimir]);


  // --- RENDER DE COMPONENTES DE FORMULARIO REUTILIZABLES ---
  const renderBloqueTarjeta = () => (
    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 mt-2">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Tarjeta (Ej: Visa)</label><input type="text" value={formData.detallesPago.marca || ''} onChange={(e) => setFormData({...formData, detallesPago: {...formData.detallesPago, marca: e.target.value}})} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"/></div>
        <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Últimos 4 Nros</label><input type="text" maxLength="4" value={formData.detallesPago.ultimos4 || ''} onChange={(e) => setFormData({...formData, detallesPago: {...formData.detallesPago, ultimos4: e.target.value}})} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"/></div>
      </div>
    </div>
  );

  const renderBloqueCheque = () => (
    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Emisor / Razón Social</label><input type="text" value={formData.detallesPago.emisor || ''} onChange={(e) => setFormData({...formData, detallesPago: {...formData.detallesPago, emisor: e.target.value}})} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-500"/></div>
        <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Banco</label><input type="text" value={formData.detallesPago.banco || ''} onChange={(e) => setFormData({...formData, detallesPago: {...formData.detallesPago, banco: e.target.value}})} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-500"/></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Fecha Emisión</label><input type="date" value={formData.detallesPago.fechaEmision || ''} onChange={(e) => setFormData({...formData, detallesPago: {...formData.detallesPago, fechaEmision: e.target.value}})} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-500"/></div>
        <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Fecha Cobro</label><input type="date" value={formData.detallesPago.fechaCobro || ''} onChange={(e) => setFormData({...formData, detallesPago: {...formData.detallesPago, fechaCobro: e.target.value}})} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-500"/></div>
      </div>
    </div>
  );


  // --- PANTALLAS DE CARGA Y LOGIN ---
  if (!isDBReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
        <Store size={48} className="text-blue-600 mb-4 animate-bounce" />
        <p className="font-bold text-gray-500 animate-pulse text-lg">Conectando al servidor seguro...</p>
        <p className="text-sm text-gray-400 mt-2">Sincronizando base de datos en la nube</p>
      </div>
    );
  }

  if (!usuarioActual) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col items-center mb-8 text-center">
            {configuracion.logo ? (
              <img src={configuracion.logo} alt="Logo" className="w-20 h-20 object-contain rounded-2xl mb-4 shadow-sm" onError={(e) => { e.target.onerror = null; e.target.src = ''; e.target.className='hidden'; }} />
            ) : (
              <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200 mb-4"><Store size={40} className="text-white" /></div>
            )}
            <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">{configuracion.nombre || 'Mi Negocio'}</h1>
            <p className="text-gray-500 mt-1 font-medium">Control de Caja y Gestión</p>
          </div>

          <form onSubmit={manejarLogin} className="space-y-4">
            {loginForm.error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100"><AlertCircle size={16} /> {loginForm.error}</div>}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Usuario</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><User size={18} /></span><input type="text" required value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm" placeholder="Ingresa tu usuario" autoComplete="username" /></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Contraseña</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={18} /></span><input type="password" required value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold tracking-widest text-sm" placeholder="••••••••" autoComplete="current-password" /></div>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-transform active:scale-95 mt-2 text-sm uppercase tracking-wider">INGRESAR AL SISTEMA</button>
          </form>
        </div>
      </div>
    );
  }

  const puedeVerSistema = caja.estado === 'abierta' || usuarioActual.rol === 'admin';
  const puedeVerClientes = ['admin', 'cajero', 'vendedor'].includes((usuarioActual?.rol || '').toLowerCase());
  const esAdminActual = (usuarioActual?.rol || '').toLowerCase() === 'admin';
  const puedeUsarCombos = ((usuarioActual?.rol || '').toLowerCase() === 'admin') || (((usuarioActual?.rol || '').toLowerCase() === 'cajero') && Boolean(usuarioActual?.puedeUsarCombos));
  const puedeCargarCuentaHistorica = usuarioPuedeCargarCuentaHistorica();
  const mostrarNavegacion = puedeVerSistema || puedeVerClientes;

  // --- RENDER PRINCIPAL ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-28 md:pb-8 print:bg-white print:pb-0">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-white shadow-sm sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
             {configuracion.logo ? (
              <img src={configuracion.logo} alt="Logo" className="w-12 h-12 object-contain rounded-xl shadow-sm border border-gray-100 bg-white" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
            ) : (
              <div className="bg-blue-600 p-2.5 rounded-xl shadow-sm"><Store size={24} className="text-white" /></div>
            )}
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight leading-tight">{configuracion.nombre || 'Mi Negocio'}</h1>
              <p className="text-sm font-medium text-gray-500">{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end bg-gray-50 md:bg-transparent p-2 md:p-0 rounded-2xl">
            <div className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-black shadow-sm ${caja.estado === 'abierta' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
              {caja.estado === 'abierta' ? <Unlock size={16} /> : <Lock size={16} />}
              <span>CAJA {caja.estado.toUpperCase()}</span>
            </div>
            
            <div className="flex items-center gap-3 md:border-l border-gray-200 pl-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800 leading-tight">{usuarioActual.nombre}</p>
                <p className={`text-[10px] uppercase font-black tracking-wider ${usuarioActual.rol === 'admin' ? 'text-blue-600' : (usuarioActual.rol === 'vendedor' ? 'text-purple-600' : 'text-gray-500')}`}>{usuarioActual.rol}</p>
              </div>
              <button onClick={cerrarSesion} className="bg-white md:bg-gray-100 hover:bg-gray-200 text-gray-600 p-2.5 rounded-xl shadow-sm md:shadow-none transition-colors" title="Cerrar Sesión"><LogOut size={18} /></button>
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN (Pestañas) */}
        {mostrarNavegacion && (
          <div className="max-w-6xl mx-auto px-4 pb-0 flex gap-2 sm:gap-6 overflow-x-auto border-t border-gray-100 mt-2 scrollbar-hide">
            <button onClick={() => setVista('caja')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'caja' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Wallet size={18}/> Caja Diaria</button>
            <button onClick={() => setVista('clientes')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'clientes' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Users size={18}/> Cuentas Corrientes</button>
            {puedeUsarCombos && (
              <button onClick={() => setVista('combos')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'combos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><FileText size={18}/> Presupuesto Combo</button>
            )}
            {usuarioActual.rol === 'admin' && (
              <>
                <button onClick={() => setVista('inventario')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'inventario' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Package size={18}/> Inventario</button>
                <button onClick={() => setVista('presupuestos')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'presupuestos' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><ClipboardList size={18}/> Presupuestos</button>
                <button onClick={() => setVista('reportes')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'reportes' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><BarChart2 size={18}/> Reportes</button>
                <div className="flex-1"></div> 
                <button onClick={() => setVista('ajustes')} title="Ajustes" aria-label="Ajustes" className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${(vista === 'ajustes' || vista === 'usuarios' || vista === 'configuracion') ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Settings size={18}/> Ajustes</button>
              </>
            )}
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6 print:p-0 print:m-0 print:max-w-none">
        
        {/* MENSAJE CAJA CERRADA */}
        {caja.estado === 'cerrada' && vista === 'caja' && (
          <div className="bg-blue-50 border border-blue-200 rounded-3xl p-8 text-center shadow-sm print:hidden animate-in fade-in zoom-in duration-300 max-w-2xl mx-auto mt-10">
            <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md"><Lock size={40} className="text-blue-600" /></div>
            <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">El turno está cerrado</h2>
            <p className="text-gray-600 mb-8 font-medium">Hola, <b className="text-blue-700">{usuarioActual.nombre}</b>. Para comenzar a registrar movimientos en la caja diaria, debes realizar la apertura indicando con cuánto dinero inicias.</p>
            <button onClick={() => setModalActivo('abrir')} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-10 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95 w-full sm:w-auto text-lg">
              ABRIR CAJA AHORA
            </button>
          </div>
        )}

        {caja.estado === 'cerrada' && vista !== 'caja' && usuarioActual.rol === 'admin' && vista !== 'ajustes' && (
           <div className="bg-amber-50 text-amber-800 p-4 rounded-2xl text-sm font-bold flex items-center gap-3 border border-amber-200 print:hidden shadow-sm animate-in fade-in">
             <AlertCircle size={24} className="shrink-0" /> Has ingresado al modo de gestión de Administrador. Tienes acceso libre al historial, pero la caja se encuentra CERRADA.
           </div>
        )}

        {/* --- VISTA: CAJA DIARIA --- */}
        {caja.estado === 'abierta' && vista === 'caja' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div onClick={() => setFiltroTipo('todos')} className={`bg-white p-4 rounded-2xl shadow-sm border flex items-center justify-between relative group cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${filtroTipo === 'todos' ? 'ring-2 ring-blue-500 border-transparent' : 'border-gray-100'}`}>
                 <div className="min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-500 mb-1">Efectivo en Caja</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-blue-600 truncate">{formatearDinero(saldoActual)}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs font-bold text-gray-400">Inició con {formatearDinero(caja.efectivoInicial)}</p>
                    {caja.chequesInicial > 0 && <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md truncate">+{formatearDinero(caja.chequesInicial)} cheques</span>}
                    <button onClick={(e) => { e.stopPropagation(); setFormData({...formData, efectivo: caja.efectivoInicial.toString(), cheques: caja.chequesInicial.toString(), tieneCheques: caja.chequesInicial > 0}); setModalActivo('editar_apertura'); }} className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="Editar apertura"><Edit2 size={12} /></button>
                  </div>
                </div>
                <div className="p-3 rounded-full shrink-0 bg-blue-100"><Wallet size={24} className="text-blue-600" /></div>
              </div>

              <WidgetCard titulo="Ventas Totales" monto={totales.ventas} icono={TrendingUp} colorClase="text-green-600" onClick={() => setFiltroTipo('venta')} activo={filtroTipo === 'venta'} activeClass="ring-2 ring-green-500 border-transparent"/>
              <WidgetCard titulo="Otros Ingresos" monto={totales.otrosIngresos} icono={PlusCircle} colorClase="text-teal-600" onClick={() => setFiltroTipo('ingreso_extra')} activo={filtroTipo === 'ingreso_extra'} activeClass="ring-2 ring-teal-500 border-transparent"/>
              <WidgetCard titulo="Gastos Totales" monto={totales.gastos} icono={TrendingDown} colorClase="text-red-600" onClick={() => setFiltroTipo('gasto')} activo={filtroTipo === 'gasto'} activeClass="ring-2 ring-red-500 border-transparent"/>
            </div>

            {/* BOTONERA DE ACCIÓN PRINCIPAL */}
            <div className="hidden md:flex gap-3 lg:gap-4 pt-2">
              <button onClick={() => setModalActivo('venta')} className="flex-1 bg-green-600 hover:bg-green-700 text-white p-3 lg:p-4 rounded-xl font-bold text-sm lg:text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95"><Plus size={20} /> Venta</button>
              <button onClick={() => setModalActivo('ingreso_extra')} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white p-3 lg:p-4 rounded-xl font-bold text-sm lg:text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95"><PlusCircle size={20} /> Ingreso</button>
              <button onClick={() => setModalActivo('gasto')} className="flex-1 bg-red-600 hover:bg-red-700 text-white p-3 lg:p-4 rounded-xl font-bold text-sm lg:text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95"><Minus size={20} /> Gasto</button>
              <button onClick={() => {setModalActivo('retiro_caja'); setFormData({...formData, metodoPago: 'efectivo', descripcion: 'Retiro de caja'});}} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white p-3 lg:p-4 rounded-xl font-bold text-sm lg:text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95"><ArrowDownCircle size={20} /> Retiro</button>
              <button onClick={() => setModalActivo('cerrar')} className="flex-1 bg-gray-900 hover:bg-black text-white p-3 lg:p-4 rounded-xl font-bold text-sm lg:text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95 border border-gray-900"><Lock size={18} /> Cerrar</button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${filtroTipo !== 'todos' ? 'bg-blue-100' : 'bg-gray-200'}`}><Filter size={20} className={filtroTipo !== 'todos' ? 'text-blue-700' : 'text-gray-600'} /></div>
                  <h3 className="font-bold text-gray-800 text-base uppercase tracking-tight">{filtroTipo === 'todos' ? 'Todos los Movimientos' : `Filtrando: ${filtroTipo.replace('_', ' ')}`}</h3>
                  <span className="text-xs font-bold text-white bg-slate-800 px-2.5 py-1 rounded-full shadow-sm">{movimientosVisualizados.length}</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-sm w-full md:w-auto">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all flex-1 md:flex-none">
                    <Calendar size={14} className="text-gray-400 shrink-0" /><span className="text-gray-500 font-bold hidden sm:inline text-xs uppercase">Desde</span>
                    <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="outline-none bg-transparent text-gray-800 font-bold w-full text-xs"/>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all flex-1 md:flex-none">
                    <Calendar size={14} className="text-gray-400 shrink-0" /><span className="text-gray-500 font-bold hidden sm:inline text-xs uppercase">Hasta</span>
                    <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="outline-none bg-transparent text-gray-800 font-bold w-full text-xs"/>
                  </div>
                  {(fechaDesde || fechaHasta || filtroTipo !== 'todos') && (
                    <button onClick={() => { const hoy = obtenerFechaInputLocal(); setFechaDesde(hoy); setFechaHasta(hoy); setFiltroTipo('todos'); }} className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-1 w-full md:w-auto text-xs uppercase"><X size={14} /> Limpiar</button>
                  )}
                </div>
              </div>
              
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {movimientosVisualizados.length === 0 ? (
                  <div className="p-16 text-center text-gray-400 flex flex-col items-center bg-gray-50/30"><Clock size={48} className="mb-4 opacity-30 text-gray-500" /><p className="font-bold text-lg text-gray-500">No hay movimientos registrados.</p><p className="text-sm mt-1">Realiza una venta o gasto para comenzar.</p></div>
                ) : (
                  movimientosVisualizados.map((mov) => {
                    const isRetiro = mov.tipo === 'retiro_caja';
                    const esCuentaCorriente = normalizarMetodoPago(mov.metodoPago) === 'cuenta_corriente';
                    const clienteMovimiento = esCuentaCorriente
                      ? textoSeguroTrim(
                        mov?.detallesPago?.cliente,
                        textoSeguroTrim(
                          clientes.find((c) => c.id === mov?.detallesPago?.clienteId)?.nombre,
                          textoSeguroTrim(mov?.detallesPago?.clienteNombre, '')
                        )
                      )
                      : '';
                    return (
                    <div key={mov.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-blue-50/30 transition-colors group">
                      <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                        <div className={`p-3 rounded-xl shrink-0 shadow-sm ${mov.tipo === 'gasto' ? 'bg-red-100 text-red-600' : (mov.tipo === 'cobro' ? 'bg-purple-100 text-purple-600' : (mov.tipo === 'ingreso_extra' ? 'bg-teal-100 text-teal-600' : (isRetiro ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600')))}`}>
                          {mov.tipo === 'gasto' ? <TrendingDown size={20} /> : (mov.tipo === 'cobro' ? <Users size={20} /> : (mov.tipo === 'ingreso_extra' ? <PlusCircle size={20} /> : (isRetiro ? <ArrowDownCircle size={20} /> : <TrendingUp size={20} />)))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 text-base truncate">{mov.descripcion}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                            <span className="flex items-center gap-1 text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded-md"><Clock size={10} /> {formatearFecha(mov.fecha)} {formatearHora(mov.fecha)}</span>
                            <span className="bg-gray-100 px-2 py-0.5 rounded-md text-gray-700 capitalize font-bold">{mov.metodoPago?.replace('_', ' ')}</span>
                            {clienteMovimiento && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="text-gray-600 font-bold">{clienteMovimiento}</span>
                              </>
                            )}
                            <span className="text-gray-300">•</span>
                            <span className="text-gray-500 font-medium">{mov.usuario}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-0 pt-3 sm:pt-0 border-gray-100">
                        <div className={`font-black text-xl whitespace-nowrap tracking-tight ${mov.tipo === 'gasto' || isRetiro ? 'text-red-600' : (mov.tipo === 'cobro' ? 'text-purple-600' : (mov.tipo === 'ingreso_extra' ? 'text-teal-600' : 'text-green-600'))}`}>
                          {mov.tipo === 'gasto' || isRetiro ? '-' : '+'}{formatearDinero(mov.monto)}
                        </div>
                        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1">
                          <button onClick={() => iniciarEdicionMovimiento(mov)} className="p-2 bg-white border shadow-sm text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-lg transition-all" title="Editar"><Edit2 size={16} /></button>
                          <button onClick={() => confirmarEliminacion(mov.id)} className="p-2 bg-white border shadow-sm text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg transition-all" title="Eliminar"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </div>
                  )})
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- VISTA: CLIENTES --- */}
        {puedeVerClientes && vista === 'clientes' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
            <WidgetCard titulo="Total Adeudado General" monto={clientesVisiblesSegunAcceso.reduce((acc, c) => acc + c.saldo, 0)} icono={Users} colorClase="text-purple-600" subtitulo={`${clientesVisiblesSegunAcceso.filter(c => c.saldo > 0).length} clientes activos con deuda pendiente`} />
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2 tracking-tight">
                  <div className="bg-purple-600 p-1.5 rounded-lg"><Users size={16} className="text-white" /></div> Directorio de Clientes
                </h3>
                <div className="w-full lg:flex-1 flex flex-col sm:flex-row gap-2 sm:items-center lg:justify-end">
                  <div className="w-full sm:flex-1 lg:max-w-md h-11 flex items-center gap-2 px-3 bg-white border border-gray-200 rounded-xl">
                    <Search size={16} className="text-gray-400 shrink-0" />
                    <input 
                      type="text" placeholder="Buscar por nombre, teléfono, doc o email..." value={busquedaDirectorio} onChange={(e) => setBusquedaDirectorio(e.target.value)}
                      className="w-full bg-transparent text-sm font-bold text-gray-700 placeholder:text-gray-400 outline-none"
                    />
                  </div>
                  <label className="h-11 inline-flex items-center gap-2 px-3 rounded-xl border border-purple-200 bg-purple-50/50 text-xs font-bold text-purple-700 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={mostrarSoloConSaldoPendiente}
                      onChange={(e) => setMostrarSoloConSaldoPendiente(e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-purple-300 rounded focus:ring-purple-500"
                    />
                    Mostrar clientes con saldo pendiente
                  </label>
                  <button
                    onClick={() => setModalActivo('acciones_clientes')}
                    aria-label="Acciones de clientes"
                    title="Acciones de clientes"
                    className="h-11 w-11 shrink-0 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {clientesVisiblesSegunAcceso.length === 0 ? (
                   <div className="p-16 text-center text-gray-400 flex flex-col items-center bg-gray-50/30">
                    <Users size={48} className="mb-4 opacity-30 text-gray-500" />
                    <p className="font-bold text-lg text-gray-500">
                      {clientes.length === 0
                        ? 'No hay clientes cargados todavía.'
                        : 'No tienes permisos para ver clientes especiales.'}
                    </p>
                   </div>
                ) : clientesVisualizados.length === 0 ? (
                   <div className="p-10 text-center text-gray-400 flex flex-col items-center bg-gray-50/30">
                    <Search size={32} className="mb-3 opacity-30 text-gray-500" />
                    <p className="font-bold text-base text-gray-500">
                      {mostrarSoloConSaldoPendiente
                        ? 'No hay clientes con saldo pendiente para mostrar.'
                        : `No se encontraron clientes con "${busquedaDirectorio}".`}
                    </p>
                   </div>
                ) : (
                  clientesVisualizados.map((cliente) => (
                    <div key={cliente.id} onClick={() => abrirDetalleCliente(cliente)} className="group p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-purple-50/30 transition-colors cursor-pointer">
                      {(() => {
                        const estado = estadoCuentaClientes[cliente.id] || {};
                        const semaforo = obtenerSemaforoEstadoCuenta(estado);
                        const saldoClass = semaforo.saldoClass;
                        const estadoTexto = semaforo.estadoTexto;
                        const estadoClass = semaforo.badgeClass;
                        const puedeAbonar = Boolean(estado.tieneDeuda || (cliente.saldo || 0) > 0);
                        const saldoPendiente = Math.max(0, Number(estado.saldoPendiente || cliente.saldo || 0));
                        const mostrarIndicadoresDeudaCliente = Boolean(estado.tieneDeuda && saldoPendiente > 0.009);
                        const recordatorios = Number(cliente.recordatoriosWhatsappEnviados || 0);
                        const recargosAplicados = mostrarIndicadoresDeudaCliente ? Math.max(0, Number(estado.recargosAplicados || 0)) : 0;
                        const diasDeudaCliente = Number.isFinite(Number(estado?.diasDeuda)) ? Number(estado.diasDeuda) : null;
                        const diasDesdeUltimoRecargoCliente = Number.isFinite(Number(estado?.diasDesdeUltimoRecargo))
                          ? Number(estado.diasDesdeUltimoRecargo)
                          : null;
                        const porcentajeSugeridoRecargoCliente = Math.max(0, Number(estado?.porcentajeSugeridoRecargo || 0));
                        const tramosSugeridosRecargoCliente = Math.max(0, Number(estado?.tramosSugeridosRecargo || 0));
                        const porcentajeBaseRecargoCliente = Math.max(0, Number(estado?.ultimoPorcentajeRecargo || obtenerPorcentajeRecargoConfigurado(configuracion)));
                        const ultimaFechaRecargoCliente = estado?.ultimaFechaRecargo ? new Date(estado.ultimaFechaRecargo) : null;
                        const ultimaFechaRecargoValida = ultimaFechaRecargoCliente && !Number.isNaN(ultimaFechaRecargoCliente.getTime());
                        const whatsappClienteUrl = construirUrlWhatsApp(cliente?.whatsapp || '');
                        const esAdmin = (usuarioActual?.rol || '').toLowerCase() === 'admin';
                        return (
                        <>
                      <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <p className="font-bold text-gray-900 text-lg">{cliente.nombre}</p>
                          {esAdmin && (
                            <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); limpiarCuentaCliente(cliente); }}
                                className="p-1.5 rounded-md border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                                title="Limpiar cuenta corriente"
                              >
                                <XCircle size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); eliminarClienteDirectorio(cliente); }}
                                className="p-1.5 rounded-md border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                                title="Eliminar cliente"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-nowrap gap-2 items-center overflow-x-auto pb-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); enviarRecordatorioCliente(cliente, estado); }}
                            disabled={!estado.tieneDeuda}
                            className="text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-max shrink-0"
                            title={estado.tieneDeuda ? 'Enviar recordatorio por WhatsApp' : 'Cliente al día'}
                          >
                            <Send size={12} /> Enviar recordatorio ({recordatorios})
                          </button>
                          <span className="text-[10px] font-black text-purple-700 bg-purple-100 border border-purple-200 px-2 py-1 rounded-md tracking-wider uppercase shrink-0">
                            {obtenerNumeroClienteTexto(cliente)}
                          </span>
                          {cliente.whatsapp && whatsappClienteUrl ? (
                            <a onClick={(e) => e.stopPropagation()} href={whatsappClienteUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-md flex items-center gap-1.5 hover:bg-green-100 transition-colors w-max shrink-0"><Phone size={12} /> {cliente.whatsapp}</a>
                          ) : (
                            <span className="text-xs font-bold text-gray-400 bg-gray-50 border px-2.5 py-1 rounded-md flex items-center gap-1.5 w-max shrink-0"><Phone size={12}/> Sin número guardado</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {esAdmin && mostrarIndicadoresDeudaCliente && recargosAplicados > 0 && (
                            <span
                              className="text-[10px] font-black text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded-md tracking-wider uppercase"
                              title={ultimaFechaRecargoValida ? `Último recargo: ${formatearFecha(ultimaFechaRecargoCliente)}` : 'Recargos aplicados'}
                            >
                              R {recargosAplicados}
                            </span>
                          )}
                          {esAdmin && mostrarIndicadoresDeudaCliente && recargosAplicados > 0 && ultimaFechaRecargoValida && (
                            <span
                              className="text-[10px] font-black text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded-md tracking-wider uppercase"
                              title={diasDesdeUltimoRecargoCliente !== null ? `${diasDesdeUltimoRecargoCliente} días desde el último recargo` : 'Último recargo aplicado'}
                            >
                              Últ. recargo {formatearFecha(ultimaFechaRecargoCliente)}{diasDesdeUltimoRecargoCliente !== null ? ` • ${diasDesdeUltimoRecargoCliente} días` : ''}
                            </span>
                          )}
                          {esAdmin && estado.tieneDeuda && porcentajeSugeridoRecargoCliente > 0 && (
                            <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md tracking-wider uppercase">
                              Sug. aplicar +{formatearPorcentaje(porcentajeSugeridoRecargoCliente)}% ({tramosSugeridosRecargoCliente} tramo{tramosSugeridosRecargoCliente === 1 ? '' : 's'} x {formatearPorcentaje(porcentajeBaseRecargoCliente)}%)
                            </span>
                          )}
                          {esAdmin && mostrarIndicadoresDeudaCliente && recargosAplicados === 0 && porcentajeSugeridoRecargoCliente <= 0 && diasDeudaCliente !== null && diasDeudaCliente > 30 && (
                            <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md tracking-wider uppercase">
                              Hace {diasDeudaCliente} días que no se aplican recargos
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {cliente.email && (
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md flex items-center gap-1.5 w-max"><Mail size={12}/> {cliente.email}</span>
                          )}
                          {cliente.direccion && (
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-md flex items-center gap-1.5 w-max"><MapPin size={12}/> {cliente.direccion}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-0 pt-3 sm:pt-0 border-gray-100">
                        <div className="text-left sm:text-right bg-gray-50 px-3 py-1.5 rounded-lg border">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">{estado.tieneDeuda ? 'Saldo pendiente' : 'Estado de cuenta'}</p>
                          {!estado.tieneDeuda ? (
                            <p className="font-black text-sm tracking-tight text-green-700">Al día sin saldo</p>
                          ) : (
                            <>
                              <p className={`font-black text-xl tracking-tight ${saldoClass}`}>{formatearDinero(saldoPendiente)}</p>
                              <p className={`mt-1 inline-flex px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${estadoClass}`}>{estadoTexto}</p>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button disabled={!puedeAbonar} onClick={(e) => { e.stopPropagation(); abrirCobroCliente(cliente); }} className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95 uppercase tracking-wider">
                            ABONAR <ArrowRight size={16} />
                          </button>
                        </div>
                      </div>
                        </>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- VISTA: INVENTARIO (NUEVO DISEÑO CORPORATIVO Y LIMPIO) --- */}
        {puedeVerSistema && vista === 'inventario' && usuarioActual.rol === 'admin' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2.5 rounded-xl shadow-sm"><Package size={20} className="text-white"/></div>
                <div><h2 className="text-lg font-bold text-gray-900 tracking-tight">Inventario de Productos</h2></div>
              </div>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                <button onClick={() => { setConfigExportInventario({ tipo: 'catalogo_pdf', alcance: 'general', categoria: '', incluirLogoMarca: true }); setModalActivo('exportar_inventario'); }} className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto text-sm uppercase tracking-wider"><FileSpreadsheet size={16} /> Exportar</button>
                <button onClick={() => { setArchivoImportacionInventario(null); setResumenImportacionInventario(null); setModalActivo('importar_inventario'); }} className="bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto text-sm uppercase tracking-wider"><ArrowDownCircle size={16} /> Importar</button>
                <button onClick={() => { setFormProducto(crearFormularioProducto()); setProductoAEditar(null); limpiarEdicionTaxonomias(); setModalActivo('nuevo_producto'); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto text-sm uppercase tracking-wider"><Plus size={16} /> Nuevo Producto</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-gray-800 text-base uppercase tracking-tight hidden sm:block">Listado de Precios</h3>
                <div className="relative w-full sm:w-auto">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></span>
                  <input 
                    type="text" placeholder="Buscar producto, código o categoría..." value={busquedaInventario} onChange={(e) => setBusquedaInventario(e.target.value)}
                    className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              {productos.length === 0 ? (
                  <div className="p-16 text-center text-gray-400 flex flex-col items-center bg-gray-50/30"><Package size={48} className="mb-4 opacity-30 text-gray-500" /><p className="font-bold text-lg text-gray-500">El inventario está vacío.</p><p className="text-sm mt-1">Carga tus productos para agilizar presupuestos.</p></div>
              ) : productosVisualizados.length === 0 ? (
                 <div className="p-10 text-center text-gray-400 flex flex-col items-center bg-gray-50/30"><Search size={32} className="mb-3 opacity-30 text-gray-500" /><p className="font-bold text-base text-gray-500">No se encontraron productos.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-700">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 font-bold border-b border-gray-200">
                      <tr>
                        <th className="px-5 py-3 w-16">Foto</th>
                        <th className="px-5 py-3 w-24">Cód.</th>
                        <th className="px-5 py-3">Descripción</th>
                        <th className="px-5 py-3">Categoría</th>
                        <th className="px-5 py-3 text-center">Unidad</th>
                        <th className="px-5 py-3 text-center">Stock Disp.</th>
                        <th className="px-5 py-3 text-right">Precio Venta</th>
                        <th className="px-5 py-3 w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {productosVisualizados.map((p) => (
                        <tr key={p.id} className="hover:bg-indigo-50/50 transition-colors group">
                          <td className="px-5 py-3">
                            <div className="w-10 h-10 rounded-lg border border-gray-200 bg-white overflow-hidden relative">
                              {p.imagen ? <img src={p.imagen} alt="prod" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200"><ImageIcon size={16} className="text-gray-300"/></div>}
                              {p.logoMarca && (
                                <div className="absolute top-0.5 left-0.5 bg-white/95 rounded-[4px] border border-gray-200 p-[1px] shadow-sm">
                                  <img src={p.logoMarca} alt="Logo marca" className="w-3.5 h-3.5 object-contain" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 font-medium text-gray-500">{p.codigo || '-'}</td>
                          <td className="px-5 py-3">
                            <p className="font-bold text-gray-900">{p.descripcion}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-0.5">
                              {(p.categoria || 'Sin categoría')}{p.marca ? ` • ${p.marca}` : ''}
                            </p>
                          </td>
                          <td className="px-5 py-3"><span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md">{obtenerCategoriaProducto(p)}</span></td>
                          <td className="px-5 py-3 text-center text-xs uppercase font-bold text-gray-500">{p.unidad}</td>
                          <td className="px-5 py-3 text-center font-bold">
                            <span className={`px-2 py-1 rounded-md ${p.cantidad <= 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{p.cantidad}</span>
                          </td>
                          <td className="px-5 py-3 text-right font-black text-indigo-700 text-base">{formatearDinero(p.precio)}</td>
                          <td className="px-5 py-3 text-right">
                             <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1 justify-end">
                                <button onClick={() => { setProductoAEditar(p); setFormProducto(crearFormularioProducto({ ...p, generarCodigoAutomatico: false })); limpiarEdicionTaxonomias(); setModalActivo('nuevo_producto'); }} className="p-2 bg-white border shadow-sm text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-lg transition-all" title="Editar"><Edit2 size={16} /></button>
                                <button onClick={() => clonarProducto(p)} className="p-2 bg-white border shadow-sm text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 rounded-lg transition-all" title="Clonar"><Copy size={16} /></button>
                                <button onClick={() => eliminarProducto(p.id)} className="p-2 bg-white border shadow-sm text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg transition-all" title="Eliminar"><Trash2 size={16} /></button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- VISTA: PRESUPUESTOS (Solo Admin) --- */}
        {puedeVerSistema && vista === 'presupuestos' && usuarioActual.rol === 'admin' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-teal-600 p-2.5 rounded-xl shadow-sm"><ClipboardList size={20} className="text-white"/></div>
                <div><h2 className="text-lg font-bold text-gray-900 tracking-tight">Presupuestos / Cotizaciones</h2></div>
              </div>
              <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">
                <div className="relative w-full sm:w-auto">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></span>
                  <input
                    type="text"
                    placeholder="Buscar por número o cliente..."
                    value={busquedaPresupuestos}
                    onChange={(e) => setBusquedaPresupuestos(e.target.value)}
                    className="w-full sm:w-80 pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  />
                </div>
                <button onClick={() => { setFormPresupuesto(crearFormularioPresupuestoVacio()); setModalActivo('nuevo_presupuesto'); }} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto text-sm uppercase tracking-wider"><FilePlus2 size={16} /> Crear Presupuesto</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {presupuestos.length === 0 ? (
                  <div className="p-16 text-center text-gray-400 flex flex-col items-center bg-gray-50/30"><ClipboardList size={48} className="mb-4 opacity-30 text-gray-500" /><p className="font-bold text-lg text-gray-500">No hay presupuestos.</p></div>
              ) : presupuestosVisualizados.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 flex flex-col items-center bg-gray-50/30"><Search size={32} className="mb-3 opacity-30 text-gray-500" /><p className="font-bold text-base text-gray-500">No se encontraron presupuestos con "{busquedaPresupuestos}".</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-700">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 font-bold border-b border-gray-200">
                      <tr>
                        <th className="px-5 py-3">Cliente / Empresa</th>
                        <th className="px-5 py-3">Fecha</th>
                        <th className="px-5 py-3 text-center">Estado</th>
                        <th className="px-5 py-3 text-right">Total</th>
                        <th className="px-5 py-3 text-right">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {presupuestosVisualizados.map((p) => (
                        <tr key={p.id} onClick={() => { setPresupuestoSeleccionado(p); setIncluirImagenesPdf(false); setIncluirLogoMarcaPresupuestoPdf(true); setSoloPreciosPorItemPresupuestoPdf(false); setModalActivo('opciones_presupuesto'); }} className="hover:bg-teal-50/50 transition-colors cursor-pointer group">
                          <td className="px-5 py-4 text-gray-900">
                            <div className="flex items-center gap-2 font-bold">
                              <FileText size={16} className="text-gray-400 group-hover:text-teal-500 transition-colors" />
                              {p.clienteNombre}
                            </div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mt-1">{obtenerNumeroPresupuestoTexto(p)}</p>
                          </td>
                          <td className="px-5 py-4 font-medium text-gray-600">{formatearFecha(p.fecha)}</td>
                          <td className="px-5 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${p.estado === 'aprobado' ? 'bg-green-50 text-green-700 border-green-200' : (p.estado === 'enviado' ? 'bg-blue-50 text-blue-700 border-blue-200' : (p.estado === 'rechazado' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'))}`}>
                              {p.estado}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right font-black text-teal-700 text-base">{formatearDinero(p.total)}</td>
                          <td className="px-5 py-4 text-right">
                            {(() => {
                              const resumenGanancia = resumenGananciaPresupuestosMap[p.id] || { ganancia: 0, margen: 0 };
                              const visible = Boolean(presupuestosGananciaVisible[p.id]);
                              return (
                                <div className="flex justify-end items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPresupuestosGananciaVisible((prev) => ({ ...prev, [p.id]: !prev[p.id] }));
                                    }}
                                    className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-teal-700 hover:border-teal-200 transition-colors"
                                    title={visible ? 'Ocultar ganancia' : 'Mostrar ganancia'}
                                  >
                                    {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                  <div className={`text-xs font-black ${resumenGanancia.ganancia >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {visible ? `${formatearDinero(resumenGanancia.ganancia)} (${resumenGanancia.margen.toFixed(1)}%)` : '••••'}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- VISTA: COMBOS (Admin + Cajero con permiso) --- */}
        {vista === 'combos' && puedeUsarCombos && (
          <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2.5 rounded-xl shadow-sm"><FileText size={20} className="text-white"/></div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">Presupuesto Combo</h2>
                </div>
              </div>
              {!comboEditorActivo ? (
                <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">
                  <div className="relative w-full sm:w-[360px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><Search size={18} /></span>
                    <input
                      type="text"
                      placeholder="Buscar combo por título..."
                      value={busquedaCombosGuardados}
                      onChange={(e) => setBusquedaCombosGuardados(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <button
                    onClick={iniciarNuevoCombo}
                    className="h-12 min-w-[180px] whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto text-sm uppercase tracking-wider"
                  >
                    <FilePlus2 size={16} /> Crear Combo
                  </button>
                </div>
              ) : (
                <div className="w-full lg:w-auto flex flex-wrap lg:flex-nowrap items-center gap-2">
                  <input
                    type="text"
                    value={comboTitulo}
                    onChange={(e) => setComboTitulo(e.target.value)}
                    className="w-full sm:w-64 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Título del combo"
                  />
                  <label className="bg-white border border-gray-200 text-gray-700 px-2.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-2">
                    <input type="checkbox" checked={comboMostrarPrecioItem} onChange={(e) => setComboMostrarPrecioItem(e.target.checked)} className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500" />
                    Precio ítem
                  </label>
                  <label className="bg-white border border-amber-200 text-amber-700 px-2.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-2">
                    <input type="checkbox" checked={comboMostrarLogoMarca} onChange={(e) => setComboMostrarLogoMarca(e.target.checked)} className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500" />
                    Logo marca
                  </label>
                  {comboEditandoId && (
                    <button
                      onClick={limpiarEditorCombo}
                      className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-2 px-3 rounded-xl shadow-sm transition-all active:scale-95 text-xs uppercase tracking-wider"
                      title="Nuevo combo"
                    >
                      Nuevo
                    </button>
                  )}
                  <button
                    onClick={cancelarEdicionCombo}
                    className="bg-white border border-red-200 text-red-700 hover:bg-red-50 font-bold py-2 px-3 rounded-xl shadow-sm transition-all active:scale-95 text-xs uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarCombo}
                    className="h-10 w-10 inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all active:scale-95"
                    title={comboEditandoId ? 'Actualizar combo' : 'Guardar combo'}
                  >
                    <Save size={16} />
                  </button>
                  <button
                    onClick={prepararComboPdfDesdeEditor}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-all active:scale-95 text-xs uppercase tracking-wider"
                  >
                    PDF
                  </button>
                </div>
              )}
            </div>
            {comboEditorActivo && (
              <>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <label className="block text-[11px] font-black text-indigo-700 uppercase tracking-wider mb-1.5">Aclaraciones para el PDF (se verán en rojo)</label>
              <textarea
                value={comboAclaraciones}
                onChange={(e) => setComboAclaraciones(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-y"
                placeholder="Ej.: El combo no incluye instalación. Vigencia comercial: 7 días."
              />
            </div>

            {comboEditandoId && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Editando combo guardado</p>
                </div>
                <div className="inline-flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-[11px] font-bold text-indigo-800">
                    <input
                      type="checkbox"
                      checked={comboMostrarPrecioItem}
                      onChange={(e) => setComboMostrarPrecioItem(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500"
                    />
                    Mostrar precios unitarios en PDF
                  </label>
                  <label className="inline-flex items-center gap-2 text-[11px] font-bold text-amber-800">
                    <input
                      type="checkbox"
                      checked={comboMostrarLogoMarca}
                      onChange={(e) => setComboMostrarLogoMarca(e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                    />
                    Incluir logo de marca en PDF
                  </label>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/60">
                  <div className="relative w-full sm:w-96">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></span>
                    <input
                      type="text"
                      placeholder="Buscar producto para el combo..."
                      value={busquedaCombosProductos}
                      onChange={(e) => setBusquedaCombosProductos(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="max-h-[58vh] overflow-y-auto divide-y divide-gray-100">
                  {productosComboVisualizados.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 flex flex-col items-center bg-gray-50/30">
                      <Search size={32} className="mb-3 opacity-30 text-gray-500" />
                      <p className="font-bold text-base text-gray-500">No se encontraron productos para el combo.</p>
                    </div>
                  ) : (
                    productosComboVisualizados.map((p) => {
                      const estaSeleccionado = comboSeleccionIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProductoCombo(p.id)}
                          className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${estaSeleccionado ? 'bg-indigo-50/60' : 'hover:bg-gray-50/60'}`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${estaSeleccionado ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                            <CheckCircle size={12} />
                          </div>
                          <div className="w-14 h-14 rounded-xl border border-gray-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                            {p.imagen ? (
                              <img src={p.imagen} alt={p.descripcion || 'Producto'} className="w-full h-full object-contain" />
                            ) : (
                              <ImageIcon size={18} className="text-gray-300" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 truncate">{p.descripcion}</p>
                            {p.detalles && (
                              <p className="text-[11px] font-semibold text-gray-500 truncate mt-0.5">{p.detalles}</p>
                            )}
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-0.5">
                              {obtenerCategoriaProducto(p)}{p.marca ? ` • ${p.marca}` : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Precio U.</p>
                            <p className="font-black text-indigo-700 text-sm">{formatearDinero(parseNumeroPresupuesto(comboPrecios[p.id] ?? p.precio))}</p>
                            {estaSeleccionado && (
                              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600 mt-0.5">Cant: {parseNumeroBasico(comboCantidades[p.id] ?? 1) || 1}</p>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-indigo-50/60">
                  <p className="text-xs font-black text-indigo-700 uppercase tracking-wider">Combo seleccionado</p>
                  <p className="text-2xl font-black text-gray-900 leading-tight">{productosComboSeleccionados.length}</p>
                  <p className="text-xs font-bold text-gray-500 mt-1">Total final: {formatearDinero(resumenGananciaComboActual.total)}</p>
                  {esAdminActual && (
                    <>
                      <p className="text-xs font-bold text-gray-500">Costo total: {formatearDinero(resumenGananciaComboActual.costoTotal)}</p>
                      <p className={`text-xs font-black ${resumenGananciaComboActual.ganancia >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        Ganancia estimada: {formatearDinero(resumenGananciaComboActual.ganancia)} ({resumenGananciaComboActual.margen.toFixed(1)}%)
                      </p>
                    </>
                  )}
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mt-1">{comboMostrarPrecioItem ? 'PDF mostrando precios por ítem' : 'PDF mostrando solo total del combo'}</p>
                </div>
                <div className="max-h-[58vh] overflow-y-auto divide-y divide-gray-100">
                  {productosComboSeleccionados.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <ClipboardList size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="font-bold text-sm text-gray-500">Todavía no seleccionaste productos.</p>
                    </div>
                  ) : (
                    productosComboSeleccionados.map((p) => (
                      <div key={p.id} className="p-3 flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg border border-gray-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                          {p.imagen ? <img src={p.imagen} alt={p.descripcion || 'Producto'} className="w-full h-full object-contain"/> : <ImageIcon size={14} className="text-gray-300" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-800 truncate">{p.descripcion}</p>
                          {p.detalles && (
                            <p className="text-[10px] font-semibold text-gray-500 truncate mt-0.5">{p.detalles}</p>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Cant.</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={comboCantidades[p.id] ?? p.cantidadCombo}
                              onChange={(e) => actualizarCantidadCombo(p.id, e.target.value.replace(',', '.'))}
                              className="w-14 px-2 py-1 text-[11px] font-black text-indigo-700 bg-white border border-indigo-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-400 text-center"
                            />
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Precio</span>
                            <div className="relative w-28">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-black">$</span>
                              <input
                                type="text"
                                value={comboPrecios[p.id] ?? p.precioCombo}
                                onChange={(e) => actualizarPrecioCombo(p.id, e.target.value)}
                                className="w-full pl-5 pr-2 py-1 text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-400"
                              />
                            </div>
                          </div>
                          <p className="mt-1 text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                            Subtotal: {formatearDinero((parseNumeroPresupuesto(comboPrecios[p.id] ?? p.precioCombo)) * (parseNumeroBasico(comboCantidades[p.id] ?? p.cantidadCombo) || 1))}
                          </p>
                        </div>
                        <button onClick={() => toggleProductoCombo(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Quitar">
                          <X size={14}/>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
              </>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Combos guardados</p>
                  <p className="text-sm font-bold text-gray-800">Puedes abrir, modificar y reutilizar tus combos.</p>
                </div>
                {comboEditorActivo && (
                  <div className="relative w-full sm:w-80">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></span>
                    <input
                      type="text"
                      placeholder="Buscar combo por título..."
                      value={busquedaCombosGuardados}
                      onChange={(e) => setBusquedaCombosGuardados(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                )}
              </div>
              {combosVisualizados.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <FileText size={30} className="mx-auto mb-2 opacity-30" />
                  <p className="font-bold text-sm text-gray-500">{combos.length ? 'No hay coincidencias para esa búsqueda.' : 'Aún no hay combos guardados.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-700">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 font-bold border-b border-gray-200">
                      <tr>
                        <th className="px-5 py-3">Título</th>
                        <th className="px-5 py-3 text-center">Items</th>
                        <th className="px-5 py-3 text-center">Modo precio</th>
                        <th className="px-5 py-3 text-right">Total</th>
                        {esAdminActual && <th className="px-5 py-3 text-right">Ganancia</th>}
                        <th className="px-5 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {combosVisualizados.map((combo) => (
                        <tr key={combo.id} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-bold text-gray-900">{combo.titulo || 'Combo Especial'}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                              Actualizado: {formatearFecha(combo.fechaActualizacion || combo.fechaCreacion || Date.now())}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-center font-bold">{Array.isArray(combo.items) ? combo.items.length : 0}</td>
                          <td className="px-5 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => mostrarDetalleModoPrecioCombo(combo)}
                              className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border transition-colors ${combo.mostrarPrecioPorItem !== false ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}
                              title="Ver detalle del modo de precio"
                            >
                              {combo.mostrarPrecioPorItem !== false ? 'Por ítem' : 'Solo total'}
                            </button>
                          </td>
                          <td className="px-5 py-3 text-right font-black text-indigo-700 whitespace-nowrap text-base">
                            {formatearDinero(Number(combo.total || 0) || (Array.isArray(combo.items) ? combo.items.reduce((acc, item) => acc + ((parseNumeroPresupuesto(item?.precio) || 0) * (parseNumeroPresupuesto(item?.cantidad) || 1)), 0) : 0))}
                          </td>
                          {esAdminActual && (
                            <td className="px-5 py-3 text-right">
                              {(() => {
                                const resumenGanancia = resumenGananciaCombosMap[combo.id] || { ganancia: 0, margen: 0 };
                                const visible = Boolean(combosGananciaVisible[combo.id]);
                                return (
                                  <div className="flex justify-end items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setCombosGananciaVisible((prev) => ({ ...prev, [combo.id]: !prev[combo.id] }))}
                                      className="px-2.5 py-1 rounded-md border border-gray-200 bg-white text-gray-600 hover:text-indigo-700 hover:border-indigo-200 transition-colors flex items-center gap-1"
                                      title={visible ? 'Ocultar ganancia' : 'Mostrar ganancia'}
                                    >
                                      {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                                      <span className="text-[10px] font-black uppercase tracking-wider">{visible ? 'OCULTAR' : 'VER'}</span>
                                    </button>
                                    {visible && (
                                      <div className={`text-xs font-black whitespace-nowrap ${resumenGanancia.ganancia >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {`${formatearDinero(resumenGanancia.ganancia)} (${resumenGanancia.margen.toFixed(1)}%)`}
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => mostrarDetalleGananciaCombo(combo)}
                                      className="p-1 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                                      title="Ver detalle de la ganancia"
                                    >
                                      <AlertCircle size={13} />
                                    </button>
                                  </div>
                                );
                              })()}
                            </td>
                          )}
                          <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => abrirComboGuardadoEnEditor(combo)} className="h-8 w-8 inline-flex items-center justify-center text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" title="Editar combo"><Edit2 size={14}/></button>
                              <button type="button" onClick={() => duplicarCombo(combo)} className="h-8 w-8 inline-flex items-center justify-center text-violet-700 border border-violet-200 bg-violet-50 hover:bg-violet-100 rounded-md transition-colors" title="Duplicar combo"><Copy size={13}/></button>
                              <button type="button" onClick={() => abrirComboGuardadoParaPdf(combo)} className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors">PDF</button>
                              <button type="button" onClick={() => eliminarCombo(combo.id)} className="h-8 w-8 inline-flex items-center justify-center text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md transition-colors" title="Eliminar combo"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- VISTA: REPORTES (Solo Admin) --- */}
        {puedeVerSistema && vista === 'reportes' && usuarioActual.rol === 'admin' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
              <div className="flex flex-col gap-3 w-full md:w-auto">
                <div className="flex gap-2 bg-slate-100 p-1 rounded-lg self-start">
                  <button onClick={() => setReporteTipo('general')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${reporteTipo === 'general' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-800'}`}>BALANCE DE CAJA</button>
                  <button onClick={() => setReporteTipo('clientes')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${reporteTipo === 'clientes' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-800'}`}>CTAS CORRIENTES</button>
                </div>
                {reporteTipo === 'general' && (
                  <div className="flex flex-wrap gap-2 items-end">
                    <button onClick={() => setReporteTiempo('hoy')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reporteTiempo === 'hoy' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Hoy</button>
                    <button onClick={() => setReporteTiempo('mes')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reporteTiempo === 'mes' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Mes</button>
                    <button onClick={() => setReporteTiempo('todo')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reporteTiempo === 'todo' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Todo el Histórico</button>
                    {reporteTiempo === 'mes' && (
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                        <Calendar size={14} className="text-gray-400 shrink-0" />
                        <span className="text-gray-500 font-bold text-xs uppercase">Mes</span>
                        <input type="month" value={reporteMesSeleccionado} onChange={(e) => setReporteMesSeleccionado(e.target.value)} className="outline-none bg-transparent text-gray-800 font-bold text-xs"/>
                      </div>
                    )}
                    <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all cursor-pointer">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      <span className="text-gray-500 font-bold text-xs uppercase">Desde</span>
                      <input type="date" value={reporteFechaDesdeReporte} onChange={(e) => setReporteFechaDesdeReporte(e.target.value)} className="outline-none bg-transparent text-gray-900 font-black text-xs w-full min-w-[9.5rem] cursor-pointer"/>
                    </label>
                    <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all cursor-pointer">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      <span className="text-gray-500 font-bold text-xs uppercase">Hasta</span>
                      <input type="date" value={reporteFechaHastaReporte} onChange={(e) => setReporteFechaHastaReporte(e.target.value)} className="outline-none bg-transparent text-gray-900 font-black text-xs w-full min-w-[9.5rem] cursor-pointer"/>
                    </label>
                    {(reporteFechaDesdeReporte || reporteFechaHastaReporte) && (
                      <button onClick={() => { setReporteFechaDesdeReporte(''); setReporteFechaHastaReporte(''); }} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-all">Limpiar Fechas</button>
                    )}
                  </div>
                )}
              </div>
              <button onClick={imprimirReporte} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center gap-2 shadow-sm transition-transform active:scale-95 w-full md:w-auto justify-center shrink-0">
                <Printer size={18} /> Imprimir Reporte
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 print:border-none print:shadow-none print:p-3 print:rounded-none print:text-[11px]">
              <div className="hidden print:flex justify-between items-end mb-8 border-b-4 border-gray-900 pb-6 print:mb-4 print:pb-3">
                <div className="flex items-center gap-4">
                  {configuracion.logo && <img src={configuracion.logo} alt="Logo" className="w-16 h-16 object-contain" />}
                  <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">{configuracion.nombre || 'MI NEGOCIO'}</h1>
                    <p className="text-gray-600 font-bold">REPORTE FINANCIERO OFICIAL</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800 text-sm">FECHA: {new Date().toLocaleDateString('es-AR')}</p>
                  <p className="text-xs font-bold text-gray-500 uppercase mt-0.5">EMITIDO POR: {usuarioActual.nombre}</p>
                </div>
              </div>

              {reporteTipo === 'general' && (
                <>
                  <div className={`mb-5 border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:mb-3 print:p-3 ${caja.estado === 'abierta' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2">
                      {caja.estado === 'abierta' ? <Unlock size={18} className="text-green-700" /> : <Lock size={18} className="text-red-700" />}
                      <p className={`text-sm font-black uppercase tracking-wider ${caja.estado === 'abierta' ? 'text-green-800' : 'text-red-800'}`}>
                        Estado de Caja: {caja.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                      </p>
                    </div>
                    <p className={`text-xs font-bold ${caja.estado === 'abierta' ? 'text-green-700' : 'text-red-700'}`}>
                      {caja.fechaApertura ? `Apertura activa: ${formatearFecha(caja.fechaApertura)} ${formatearHora(caja.fechaApertura)}` : 'No hay una apertura activa en este momento.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6 print:gap-2 print:mb-4">
                    <WidgetCard titulo="Ingresos Totales" monto={datosReporte.ingresos} icono={TrendingUp} colorClase="text-green-600" printOculto={false} onClick={() => mostrarDetalleIndicadorReporte('ingresos')} subtitulo="Toca para ver detalle" />
                    <WidgetCard titulo="Cobros (Cuentas)" monto={datosReporte.cobros} icono={Users} colorClase="text-purple-600" printOculto={false} onClick={() => mostrarDetalleIndicadorReporte('cobros')} subtitulo="Toca para ver detalle" />
                    <WidgetCard titulo="Egresos Totales" monto={datosReporte.egresos} icono={TrendingDown} colorClase="text-red-600" printOculto={false} onClick={() => mostrarDetalleIndicadorReporte('egresos')} subtitulo="Toca para ver detalle" />
                    <WidgetCard titulo="Transferencias Netas" monto={datosReporte.flujoTransferencia} icono={CreditCard} colorClase={datosReporte.flujoTransferencia >= 0 ? "text-blue-600" : "text-red-600"} printOculto={false} onClick={() => mostrarDetalleIndicadorReporte('transferencias')} subtitulo="Toca para ver detalle" />
                    <WidgetCard titulo="Retiros Efectivo" monto={datosReporte.retiros} icono={ArrowDownCircle} colorClase="text-orange-600" printOculto={false} onClick={() => mostrarDetalleIndicadorReporte('retiros')} subtitulo="Toca para ver detalle" />
                    <WidgetCard titulo="Ganancia (Neto)" monto={datosReporte.neto} icono={Wallet} colorClase={datosReporte.neto >= 0 ? "text-blue-600" : "text-red-600"} printOculto={false} onClick={() => mostrarDetalleIndicadorReporte('ganancia')} subtitulo="Toca para ver detalle" />
                  </div>

                  <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2 mt-8 print:mt-4 print:mb-2">Balance Real por Medios de Pago</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 print:grid-cols-4 print:gap-2 print:mb-4">
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center print:bg-white print:border-gray-400">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 print:text-gray-800">Efectivo Neto</p>
                          <p className={`text-2xl font-black tracking-tight ${datosReporte.flujoEfectivo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatearDinero(datosReporte.flujoEfectivo)}</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center print:bg-white print:border-gray-400">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 print:text-gray-800">Transf. Netas</p>
                          <p className={`text-2xl font-black tracking-tight ${datosReporte.flujoTransferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatearDinero(datosReporte.flujoTransferencia)}</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center print:bg-white print:border-gray-400">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 print:text-gray-800">Tarjetas Netas</p>
                          <p className={`text-2xl font-black tracking-tight ${datosReporte.flujoTarjeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatearDinero(datosReporte.flujoTarjeta)}</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center print:bg-white print:border-gray-400">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 print:text-gray-800">Cheques Netos</p>
                          <p className={`text-2xl font-black tracking-tight ${datosReporte.flujoCheque >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatearDinero(datosReporte.flujoCheque)}</p>
                      </div>
                  </div>

                  <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2 mt-8 print:mt-4 print:mb-2">Desglose de Movimientos</h3>
                  {datosReporte.movimientos.length === 0 ? (
                    <p className="text-gray-500 text-center py-6 font-medium text-sm">No hay registros en este período.</p>
                  ) : (
                    <div className="overflow-x-auto print:overflow-visible">
                      <table className="w-full text-left text-sm text-gray-600 print:text-[10.5px]">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 print:bg-transparent font-bold">
                          <tr><th className="px-4 py-3">Fecha/Hora</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Descripción</th><th className="px-4 py-3">Medio</th><th className="px-4 py-3">Cajero</th><th className="px-4 py-3 text-right">Monto</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-medium">
                          {datosReporte.movimientos.map(m => {
                            const isRetiro = m.tipo === 'retiro_caja';
                            return (
                            <tr key={m.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                              <td className="px-4 py-3 whitespace-nowrap print:px-2 print:py-2">{formatearFecha(m.fecha)} {formatearHora(m.fecha)}</td>
                              <td className="px-4 py-3 font-bold print:px-2 print:py-2"><span className={`text-[10px] uppercase tracking-wider ${m.tipo === 'gasto' ? 'text-red-600' : (m.tipo === 'cobro' ? 'text-purple-600' : (isRetiro ? 'text-orange-600' : 'text-green-600'))}`}>{m.tipo.replace('_', ' ')}</span></td>
                              <td className="px-4 py-3 font-bold text-gray-800 print:px-2 print:py-2">{m.descripcion}</td>
                              <td className="px-4 py-3 capitalize print:px-2 print:py-2">{m.metodoPago?.replace('_', ' ')}</td>
                              <td className="px-4 py-3 text-gray-500 print:px-2 print:py-2">{m.usuario || '-'}</td>
                              <td className={`px-4 py-3 text-right font-black whitespace-nowrap print:px-2 print:py-2 ${m.tipo === 'gasto' || isRetiro ? 'text-red-600' : 'text-green-600'}`}>{m.tipo === 'gasto' || isRetiro ? '-' : '+'}{formatearDinero(m.monto)}</td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {reporteTipo === 'clientes' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <WidgetCard titulo="Total Deuda" monto={clientes.reduce((acc, c) => acc + c.saldo, 0)} icono={Users} colorClase="text-purple-600" printOculto={false} />
                    <WidgetCard titulo="Clientes con Deuda" monto={clientes.filter(c => c.saldo > 0).length} icono={AlertCircle} colorClase="text-orange-600" formato="numero" sufijo="clientes" subtitulo="Con saldo pendiente" printOculto={false} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">Estado de Cuentas</h3>
                  {clientes.length === 0 ? (
                    <p className="text-gray-500 text-center py-6 font-medium text-sm">Base vacía.</p>
                  ) : (
                    <div className="overflow-x-auto print:overflow-visible">
                      <table className="w-full text-left text-sm text-gray-600">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 print:bg-transparent font-bold">
                          <tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Contacto</th><th className="px-4 py-3 text-right">Estado</th><th className="px-4 py-3 text-right">Deuda</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {clientes.map(c => {
                            const estado = estadoCuentaClientes[c.id] || {};
                            const semaforo = obtenerSemaforoEstadoCuenta(estado);
                            const estadoClass = semaforo.saldoClass;
                            const estadoTexto = estado.tieneDeuda ? semaforo.estadoTexto : 'Al día';
                            return (
                            <tr key={c.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                              <td className="px-4 py-3"><span className="text-[10px] font-black text-purple-700 bg-purple-100 border border-purple-200 px-2 py-1 rounded-md tracking-wider">{obtenerNumeroClienteTexto(c)}</span></td>
                              <td className="px-4 py-3 font-bold text-gray-900">{c.nombre}</td>
                              <td className="px-4 py-3">{c.whatsapp || '-'}</td>
                              <td className={`px-4 py-3 text-right font-bold text-xs uppercase tracking-wider ${estadoClass}`}>{estadoTexto}</td>
                              <td className={`px-4 py-3 text-right font-black text-base whitespace-nowrap ${estadoClass}`}>{formatearDinero(c.saldo)}</td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* --- VISTA: AJUSTES (Solo Admin) --- */}
        {(vista === 'ajustes' || vista === 'configuracion' || vista === 'usuarios') && usuarioActual.rol === 'admin' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="bg-slate-800 p-3 rounded-xl shadow-sm"><Settings size={22} className="text-white"/></div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Ajustes del Sistema</h2>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Datos del negocio y gestión de accesos</p>
              </div>
            </div>

            <div className="max-w-xl mx-auto w-full">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                <div className="bg-slate-800 p-3 rounded-xl shadow-sm"><Settings size={24} className="text-white"/></div>
                <div><h2 className="text-xl font-bold text-gray-900 tracking-tight">Datos del Negocio</h2></div>
              </div>

              <form onSubmit={guardarConfiguracion} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Nombre de Fantasía o Razón Social</label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Store size={18} /></span><input type="text" required value={configuracion.nombre} onChange={(e) => setConfiguracion({...configuracion, nombre: e.target.value})} className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none font-bold text-sm text-gray-900" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Sitio Web</label>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Globe size={18} /></span><input type="text" value={configuracion.web || ''} onChange={(e) => setConfiguracion({...configuracion, web: e.target.value})} className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none font-bold text-sm text-gray-900" placeholder="Ej: www.tunegocio.com" /></div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">WhatsApp del Negocio</label>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Phone size={18} /></span><input type="text" value={configuracion.whatsapp || ''} onChange={(e) => setConfiguracion({...configuracion, whatsapp: e.target.value})} className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none font-bold text-sm text-gray-900" placeholder="Ej: +54 9 3624..." /></div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Correo del Negocio</label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={18} /></span><input type="email" value={configuracion.correo || ''} onChange={(e) => setConfiguracion({...configuracion, correo: e.target.value})} className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none font-bold text-sm text-gray-900" placeholder="Ej: ventas@tunegocio.com" /></div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2.5">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Datos de cobro para recordatorios</p>
                  <p className="text-[11px] font-bold text-emerald-700">Estos datos se usan automáticamente en el mensaje de WhatsApp de cuenta corriente.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-800 mb-1 uppercase tracking-wider">Alias</label>
                      <input
                        type="text"
                        value={configuracion.pagoAlias || ''}
                        onChange={(e) => setConfiguracion({ ...configuracion, pagoAlias: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm text-gray-900"
                        placeholder="Ej: mi.alias.cobro"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-800 mb-1 uppercase tracking-wider">CBU</label>
                      <input
                        type="text"
                        value={configuracion.pagoCbu || ''}
                        onChange={(e) => setConfiguracion({ ...configuracion, pagoCbu: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm text-gray-900"
                        placeholder="22 dígitos"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-800 mb-1 uppercase tracking-wider">Titular</label>
                      <input
                        type="text"
                        value={configuracion.pagoTitular || ''}
                        onChange={(e) => setConfiguracion({ ...configuracion, pagoTitular: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm text-gray-900"
                        placeholder="Nombre del titular"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-800 mb-1 uppercase tracking-wider">Banco / Billetera</label>
                      <input
                        type="text"
                        value={configuracion.pagoBanco || ''}
                        onChange={(e) => setConfiguracion({ ...configuracion, pagoBanco: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm text-gray-900"
                        placeholder="Ej: Mercado Pago / Banco Nación"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800 mb-1 uppercase tracking-wider">Detalle extra (opcional)</label>
                    <input
                      type="text"
                      value={configuracion.pagoDetalle || ''}
                      onChange={(e) => setConfiguracion({ ...configuracion, pagoDetalle: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm text-gray-900"
                      placeholder="Ej: enviar comprobante por WhatsApp"
                    />
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2.5">
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div>
                      <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Recargos automáticos por mora</p>
                      <p className="text-[11px] font-bold text-amber-700 mt-0.5">Se aplican cada 30 días sobre remitos impagos.</p>
                    </div>
                    <span className="relative inline-flex items-center shrink-0">
                      <input
                        type="checkbox"
                        checked={Boolean(configuracion.recargosAutomaticosActivos)}
                        onChange={(e) => setConfiguracion({
                          ...configuracion,
                          recargosAutomaticosActivos: e.target.checked
                        })}
                        className="sr-only peer"
                      />
                      <span className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></span>
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={configuracion.recargoMoraPorcentajeGlobal ?? configuracion.recargoMoraPorcentaje ?? 0}
                      onChange={(e) => {
                        const valor = Math.max(0, parseNumeroBasico(e.target.value));
                        setConfiguracion({
                          ...configuracion,
                          recargoMoraPorcentajeGlobal: valor,
                          recargoMoraPorcentaje: valor
                        });
                      }}
                      className="w-full pl-4 pr-9 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-black text-sm text-amber-900"
                      placeholder="Ej: 10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 font-black text-sm">%</span>
                  </div>
                  <p className="text-[11px] font-bold text-amber-700">
                    El sistema crea un registro administrativo por cada tramo de 30 días impagos. Luego puedes editarlo o quitarlo desde el cliente.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Logotipo Corporativo (PNG o JPG)</label>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer">
                      <span className="w-full flex items-center gap-2 pl-3 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors text-sm font-bold text-gray-700">
                        <ImageIcon size={18} className="text-gray-400" />
                        Seleccionar archivo
                      </span>
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                        onChange={procesarLogoNegocio}
                        className="hidden"
                      />
                    </label>
                    {configuracion.logo && (
                      <button
                        type="button"
                        onClick={() => setConfiguracion((prev) => ({ ...prev, logo: '' }))}
                        className="px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wider hover:bg-red-100 transition-colors"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-gray-500 mt-1">El logo se guarda en la nube al aplicar cambios.</p>
                </div>
                {configuracion.logo && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center gap-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vista Previa</p><img src={configuracion.logo} alt="Logo" className="max-w-[120px] max-h-[120px] object-contain rounded-lg shadow-sm bg-white p-1 border" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}/></div>
                )}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
                  <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Diagnóstico Firebase</p>
                  <p className="text-[11px] font-bold text-blue-900">Proyecto: {diagnosticoConfiguracion.projectId}</p>
                  <p className="text-[11px] font-bold text-blue-900">Nombre cargado: {diagnosticoConfiguracion.nombre}</p>
                  <p className={`text-[11px] font-bold ${diagnosticoConfiguracion.usaNombreDefault ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {diagnosticoConfiguracion.usaNombreDefault ? 'Usando valor por defecto "Mi Negocio"' : 'Nombre de empresa cargado desde base'}
                  </p>
                  <p className="text-[11px] font-bold text-blue-900">Logo guardado: {diagnosticoConfiguracion.logoGuardado ? 'Sí' : 'No'}</p>
                  <p className="text-[11px] font-bold text-blue-900">Logo listo para PDF: {diagnosticoConfiguracion.logoRenderizado ? 'Sí' : 'No'}</p>
                  <p className="text-[11px] font-bold text-blue-900">Tipo logo: {diagnosticoConfiguracion.tipoLogo}</p>
                  <p className="text-[10px] font-medium text-blue-700 break-all">{diagnosticoConfiguracion.vistaLogo}</p>
                </div>
                <button type="submit" className="w-full bg-slate-800 hover:bg-black text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-wider mt-2"><Save size={18} /> APLICAR CAMBIOS</button>
              </form>
            </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-3 rounded-xl shadow-sm"><ShieldCheck size={24} className="text-white"/></div>
                <div><h2 className="text-lg font-bold text-gray-900 tracking-tight">Gestión de Accesos</h2></div>
              </div>
              <button onClick={() => abrirFormularioUsuario(null)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto text-sm uppercase tracking-wider"><UserPlus size={16} /> NUEVO USUARIO</button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 font-bold border-b border-gray-200">
                    <tr><th className="px-5 py-3">Nombre</th><th className="px-5 py-3">Usuario</th><th className="px-5 py-3">Contraseña</th><th className="px-5 py-3">Nivel</th><th className="px-5 py-3 text-right">Ajustes</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {usuarios.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-bold text-gray-900">{u.nombre}</td>
                        <td className="px-5 py-3"><code className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded-md text-xs">{u.username}</code></td>
                        <td className="px-5 py-3"><span className="text-gray-400 font-mono tracking-widest bg-gray-50 px-2 py-1 rounded-md border text-xs">{((u.password ?? '').toString().replace(/./g, '•')) || '—'}</span></td>
                        <td className="px-5 py-3">
	                          <div className="flex flex-col gap-1">
	                            <span className={`w-max px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${u.rol === 'admin' ? 'bg-orange-100 text-orange-800' : (u.rol === 'vendedor' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600')}`}>{u.rol === 'admin' ? 'ADMINISTRADOR' : (u.rol === 'vendedor' ? 'VENDEDOR' : 'CAJERO')}</span>
	                          </div>
                        </td>
                        <td className="px-5 py-3 text-right flex justify-end gap-2">
                          <button type="button" onClick={() => abrirFormularioUsuario(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-all" title="Editar"><Edit2 size={16} /></button>
                          <button onClick={() => eliminarUsuario(u.id)} disabled={u.id === usuarioActual.id} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-all disabled:opacity-30 disabled:bg-transparent" title="Eliminar"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* --- BOTONES FLOTANTES MOBILE --- */}
      {caja.estado === 'abierta' && vista === 'caja' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 pb-safe flex gap-1 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)] z-40 print:hidden">
           <button onClick={() => setModalActivo('venta')} className="flex-1 bg-green-600 text-white p-2 rounded-xl font-bold flex flex-col items-center gap-1 shadow-sm"><Plus size={18} /> <span className="text-[8px] uppercase tracking-wider">Venta</span></button>
           <button onClick={() => setModalActivo('ingreso_extra')} className="flex-1 bg-teal-600 text-white p-2 rounded-xl font-bold flex flex-col items-center gap-1 shadow-sm"><PlusCircle size={18} /> <span className="text-[8px] uppercase tracking-wider">Ingreso</span></button>
           <button onClick={() => setModalActivo('gasto')} className="flex-1 bg-red-600 text-white p-2 rounded-xl font-bold flex flex-col items-center gap-1 shadow-sm"><Minus size={18} /> <span className="text-[8px] uppercase tracking-wider">Gasto</span></button>
           <button onClick={() => {setModalActivo('retiro_caja'); setFormData({...formData, metodoPago: 'efectivo', descripcion: 'Retiro de caja'});}} className="flex-1 bg-orange-500 text-white p-2 rounded-xl font-bold flex flex-col items-center gap-1 shadow-sm"><ArrowDownCircle size={18} /> <span className="text-[8px] uppercase tracking-wider">Retiro</span></button>
           <button onClick={() => setModalActivo('cerrar')} className="flex-1 bg-gray-900 text-white p-2 rounded-xl font-bold flex flex-col items-center gap-1 shadow-sm"><Lock size={18} /> <span className="text-[8px] uppercase tracking-wider">Cerrar</span></button>
        </div>
      )}

      {/* --- MODALES COMPACTOS --- */}

      {modalActivo === 'acciones_clientes' && (
        <Modal
          titulo="Acciones de Clientes"
          onClose={() => setModalActivo(null)}
          customWidth="max-w-md"
        >
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => { setModalActivo(null); abrirFormularioCliente(null); }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl text-sm uppercase tracking-wider transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Nuevo cliente
            </button>
            <button
              type="button"
              disabled={!puedeCargarCuentaHistorica}
              onClick={() => { setModalActivo(null); abrirCargaCuentaCliente(); }}
              className="w-full bg-amber-100 border border-amber-200 text-amber-800 hover:bg-amber-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed font-bold py-3 px-4 rounded-xl text-sm uppercase tracking-wider transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <History size={16} /> Cargar cuenta histórica
            </button>
            {!puedeCargarCuentaHistorica && (
              <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Este usuario no tiene permiso para cargas históricas. Actívalo en Gestión de Acceso.
              </p>
            )}
          </div>
        </Modal>
      )}

      {modalActivo === 'preview_oferta_flyer' && ofertaPreviewImagenes.length > 0 && (
        <Modal
          titulo="Previsualizar Oferta"
          onClose={cerrarPreviewOferta}
          customWidth="max-w-5xl"
        >
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Vista interna de la imagen final
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[72vh] overflow-y-auto pr-1">
              {ofertaPreviewImagenes.map((imagen, idx) => (
                <div key={`preview-oferta-${idx}`} className="bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">
                  <img
                    src={imagen.url}
                    alt={`Previsualización oferta ${idx + 1}`}
                    className="w-full h-auto rounded-xl border border-gray-100 bg-slate-50"
                  />
                  <div className="mt-2 flex justify-between items-center gap-2">
                    <p className="text-[10px] font-bold text-gray-500 truncate">{imagen.nombre}</p>
                    <button
                      type="button"
                      onClick={() => descargarArchivoTemporal(imagen.archivo)}
                      className="px-2.5 py-1 rounded-md border border-fuchsia-200 text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 text-[10px] font-bold uppercase tracking-wider"
                    >
                      Descargar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={cerrarPreviewOferta}
                className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs uppercase tracking-wider"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modalActivo === 'abrir' && (
        <Modal titulo="Abrir Caja" onClose={() => setModalActivo(null)}>
          <form onSubmit={abrirCaja} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Fondo inicial en efectivo</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xl">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.efectivo}
                  onChange={(e) => setFormData({ ...formData, efectivo: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-white border-2 border-blue-200 rounded-xl text-2xl font-black text-blue-700 outline-none focus:border-blue-600"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.tieneCheques}
                  onChange={(e) => setFormData({ ...formData, tieneCheques: e.target.checked, cheques: e.target.checked ? formData.cheques : '' })}
                  className="w-4 h-4"
                />
                <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">Incluye cheques al abrir</span>
              </label>
              {formData.tieneCheques && (
                <div className="mt-3 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400 font-black">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cheques}
                    onChange={(e) => setFormData({ ...formData, cheques: e.target.value })}
                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-orange-200 rounded-lg font-bold text-sm outline-none focus:border-orange-500"
                    placeholder="Monto total en cheques"
                  />
                </div>
              )}
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm uppercase tracking-wider">
              Confirmar Apertura
            </button>
          </form>
        </Modal>
      )}

      {modalActivo === 'editar_apertura' && (
        <Modal titulo="Editar Apertura de Caja" onClose={() => setModalActivo(null)}>
          <form onSubmit={editarApertura} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Efectivo inicial</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xl">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.efectivo}
                  onChange={(e) => setFormData({ ...formData, efectivo: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-2xl font-black text-gray-800 outline-none focus:border-blue-600"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.tieneCheques}
                  onChange={(e) => setFormData({ ...formData, tieneCheques: e.target.checked, cheques: e.target.checked ? formData.cheques : '' })}
                  className="w-4 h-4"
                />
                <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">Incluye cheques</span>
              </label>
              {formData.tieneCheques && (
                <div className="mt-3 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400 font-black">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cheques}
                    onChange={(e) => setFormData({ ...formData, cheques: e.target.value })}
                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-orange-200 rounded-lg font-bold text-sm outline-none focus:border-orange-500"
                    placeholder="Monto total en cheques"
                  />
                </div>
              )}
            </div>

            <button type="submit" className="w-full bg-slate-800 hover:bg-black text-white font-bold py-3 rounded-xl text-sm uppercase tracking-wider">
              Guardar Cambios
            </button>
          </form>
        </Modal>
      )}

      {/* Modal Exportar Inventario */}
      {modalActivo === 'exportar_inventario' && (
        <Modal titulo="Exportar Inventario" onClose={() => setModalActivo(null)} customWidth="max-w-lg">
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-2">Tipo de archivo</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfigExportInventario((prev) => ({ ...prev, tipo: 'catalogo_pdf' }))} className={`px-3 py-2.5 rounded-lg border text-sm font-bold transition-colors ${configExportInventario.tipo === 'catalogo_pdf' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}`}>
                  Catálogo PDF (con foto)
                </button>
                <button type="button" onClick={() => setConfigExportInventario((prev) => ({ ...prev, tipo: 'lista_excel' }))} className={`px-3 py-2.5 rounded-lg border text-sm font-bold transition-colors ${configExportInventario.tipo === 'lista_excel' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}`}>
                  Lista Excel (sin foto)
                </button>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
              <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Alcance de exportación</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfigExportInventario((prev) => ({ ...prev, alcance: 'general', categoria: '' }))} className={`px-3 py-2.5 rounded-lg border text-sm font-bold transition-colors ${configExportInventario.alcance === 'general' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
                  General
                </button>
                <button type="button" onClick={() => setConfigExportInventario((prev) => ({ ...prev, alcance: 'categoria', categoria: prev.categoria || categoriasInventario[0] || '' }))} className={`px-3 py-2.5 rounded-lg border text-sm font-bold transition-colors ${configExportInventario.alcance === 'categoria' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
                  Por categoría
                </button>
              </div>

              {configExportInventario.alcance === 'categoria' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Categoría</label>
                  <select value={configExportInventario.categoria} onChange={(e) => setConfigExportInventario((prev) => ({ ...prev, categoria: e.target.value }))} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                    {categoriasInventario.length === 0 ? (
                      <option value="">Sin categorías cargadas</option>
                    ) : (
                      categoriasInventario.map((cat) => <option key={cat} value={cat}>{cat}</option>)
                    )}
                  </select>
                </div>
              )}
            </div>

            {configExportInventario.tipo === 'catalogo_pdf' && (
              <label className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configExportInventario.incluirLogoMarca !== false}
                  onChange={(e) => setConfigExportInventario((prev) => ({ ...prev, incluirLogoMarca: e.target.checked }))}
                  className="w-4 h-4 text-amber-600 rounded border-amber-300"
                />
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Incluir logo de marca en las fotos</span>
              </label>
            )}

            <button type="button" onClick={generarExportacionInventario} disabled={configExportInventario.alcance === 'categoria' && !configExportInventario.categoria} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black py-3.5 rounded-xl text-sm uppercase tracking-wider transition-colors">
              {configExportInventario.tipo === 'catalogo_pdf' ? 'Generar Catálogo PDF' : 'Descargar Lista Excel'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Importar Inventario */}
      {modalActivo === 'importar_inventario' && (
        <Modal titulo="Importar Inventario" onClose={() => setModalActivo(null)} customWidth="max-w-lg">
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Actualización por código de barras</p>
              <p className="text-xs font-medium text-emerald-900">Se actualizarán productos existentes buscando por <b>código</b>. Las imágenes guardadas se conservan automáticamente.</p>
              <p className="text-[11px] text-emerald-800 font-medium">Columnas recomendadas: <code>codigo</code>, <code>precio</code> (opcionales: <code>costo</code>, <code>ganancia</code>, <code>stock</code>, <code>categoria</code>, <code>marca</code>).</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Archivo Excel o CSV</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={(e) => setArchivoImportacionInventario(e.target.files?.[0] || null)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {archivoImportacionInventario && <p className="text-[11px] font-bold text-gray-600 mt-1">Seleccionado: {archivoImportacionInventario.name}</p>}
            </div>

            {resumenImportacionInventario && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Resultado importación</p>
                <p className="text-xs font-bold text-gray-800">Filas leídas: {resumenImportacionInventario.total}</p>
                <p className="text-xs font-bold text-green-700">Actualizados: {resumenImportacionInventario.actualizados}</p>
                <p className="text-xs font-bold text-orange-700">Sin coincidencia por código: {resumenImportacionInventario.sinCoincidencia}</p>
                <p className="text-xs font-bold text-red-700">Sin código: {resumenImportacionInventario.sinCodigo}</p>
                <p className="text-xs font-bold text-gray-600">Sin cambios aplicables: {resumenImportacionInventario.sinCambios}</p>
              </div>
            )}

            <button
              type="button"
              onClick={procesarImportacionInventario}
              disabled={importandoInventario || !archivoImportacionInventario}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black py-3.5 rounded-xl text-sm uppercase tracking-wider transition-colors"
            >
              {importandoInventario ? 'Importando...' : 'Importar y Actualizar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Imprimir Catálogo */}
      {modalActivo === 'imprimir_catalogo' && catalogoAImprimir && (
        <div className="print-modal-root fixed inset-0 bg-gray-100 z-50 overflow-y-auto flex justify-center py-10 print:p-0 print:bg-white custom-scrollbar">
          <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
            <button onClick={imprimirReporte} className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2"><Printer size={20}/> Imprimir</button>
            <button onClick={descargarPdfVistaImpresion} disabled={descargandoPdfVistaImpresion} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2"><Download size={20}/>{descargandoPdfVistaImpresion ? 'Generando...' : 'Descargar PDF'}</button>
            <button onClick={() => { setModalActivo(null); setCatalogoAImprimir(null); }} className="bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 p-3 rounded-full shadow-lg"><X size={24}/></button>
          </div>

          <div className="print-modal-pages w-full max-w-[210mm] space-y-6 print:space-y-0">
            {(paginasCatalogoImpresion.length ? paginasCatalogoImpresion : [{ categoria: 'Sin productos', items: [], bloque: 1, totalBloques: 1 }]).map((pagina, paginaIndex) => (
              <div key={`${pagina.categoria}-${paginaIndex}`} className="print-a4-sheet box-border bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none p-6 sm:p-8 text-black font-sans">
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
                  <div className="flex gap-4 items-center">
                    {obtenerLogoEmpresaPresupuesto() && <img src={obtenerLogoEmpresaPresupuesto()} alt="Logo" className="w-16 h-16 object-contain" />}
                    <div>
                      <h1 className="text-2xl font-black uppercase tracking-tight leading-none">{obtenerNombreEmpresaPresupuesto()}</h1>
                      <p className="text-xs font-bold text-gray-500 mt-0.5 uppercase">Catálogo Comercial</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-black text-gray-300 tracking-widest mb-0.5">CATÁLOGO</h2>
                    <p className="font-bold text-xs">FECHA: {new Date().toLocaleDateString('es-AR')}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">Alcance: {catalogoAImprimir.alcanceLabel}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">Pág.: {paginaIndex + 1}/{Math.max(1, paginasCatalogoImpresion.length)}</p>
                  </div>
                </div>

                <div className="bg-slate-800 text-white px-4 py-1.5 rounded-lg mb-2 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider">{pagina.categoria}</p>
                  {pagina.totalBloques > 1 && <p className="text-[10px] font-bold uppercase opacity-90">Bloque {pagina.bloque}/{pagina.totalBloques}</p>}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 print:grid-cols-3">
                  {pagina.items.map((p) => (
                    <div key={p.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white print-no-break">
                      <div className="h-28 bg-gray-50 border-b border-gray-200 flex items-center justify-center p-2 relative">
                        {p.imagen ? <img src={p.imagen} alt={p.descripcion} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={28} /></div>}
                        {catalogoAImprimir.mostrarLogoMarca !== false && p.logoMarca && (
                          <div className="absolute top-1.5 left-1.5 bg-white/95 border border-gray-200 rounded-md p-1 shadow-sm">
                            <img src={p.logoMarca} alt="Logo marca" className="w-8 h-8 object-contain" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Cód: {p.codigo || '-'}</p>
                        <p className="font-bold text-gray-900 text-[10px] leading-snug min-h-[30px]">{p.descripcion}</p>
                        <div className="mt-1.5 flex justify-between items-end gap-2">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Stock: {p.cantidad} {p.unidad}</span>
                          <span className="text-[15px] font-black text-indigo-700">{formatearDinero(p.precio)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-gray-300 pt-3 text-center print-no-break">
                  <p className="text-xs font-bold text-gray-400">Documento generado automáticamente desde Inventario.</p>
                  <p className="text-[10px] text-gray-400 mt-1">Emitido por: {usuarioActual.nombre} • {obtenerNombreEmpresaPresupuesto()}</p>
                  {contactoNegocioPdf.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{contactoNegocioPdf.join(' • ')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Imprimir Ofertas */}
      {modalActivo === 'imprimir_oferta' && ofertaAImprimir && (
        <div className="print-modal-root fixed inset-0 bg-gray-100 z-50 overflow-y-auto flex justify-center py-10 print:p-0 print:bg-white custom-scrollbar">
          <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
            <button onClick={imprimirReporte} className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2"><Printer size={20}/> Imprimir</button>
            <button onClick={descargarPdfVistaImpresion} disabled={descargandoPdfVistaImpresion} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2"><Download size={20}/>{descargandoPdfVistaImpresion ? 'Generando...' : 'Descargar PDF'}</button>
            <button onClick={() => { setModalActivo(null); setOfertaAImprimir(null); }} className="bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 p-3 rounded-full shadow-lg"><X size={24}/></button>
          </div>

          <div className="print-modal-pages w-full max-w-[210mm] space-y-6 print:space-y-0">
            {(paginasOfertaImpresion.length ? paginasOfertaImpresion : [{ items: [], pagina: 1, totalPaginas: 1 }]).map((pagina) => (
              <div key={`oferta-${pagina.pagina}`} className="print-a4-sheet box-border bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none p-6 sm:p-8 text-black font-sans">
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-5 mb-5">
                  <div className="flex items-center gap-4 min-h-[56px]">
                    {obtenerLogoEmpresaPresupuesto() && <img src={obtenerLogoEmpresaPresupuesto()} alt="Logo" className="w-20 max-h-20 object-contain" />}
                    <div>
                      <h1 className="text-2xl font-black uppercase tracking-tight leading-none">{obtenerNombreEmpresaPresupuesto()}</h1>
                      <p className="text-xs font-bold text-gray-500 mt-1 uppercase">Oferta Comercial</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-black text-gray-300 tracking-widest mb-1">OFERTAS</h2>
                    <p className="font-bold text-xs">FECHA: {new Date(ofertaAImprimir.fecha || Date.now()).toLocaleDateString('es-AR')}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Pág.: {pagina.pagina}/{pagina.totalPaginas}</p>
                  </div>
                </div>

                <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Título de la oferta</p>
                  <p className="text-lg font-black text-gray-900 leading-tight">{(ofertaAImprimir.titulo || 'Ofertas Especiales').toUpperCase()}</p>
                </div>
                {pagina.pagina === 1 && (ofertaAImprimir.aclaraciones || '').trim() && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-black text-red-700 uppercase tracking-wider">Aclaraciones</p>
                    <p className="text-sm font-bold text-red-700 leading-relaxed whitespace-pre-wrap">{(ofertaAImprimir.aclaraciones || '').trim()}</p>
                  </div>
                )}

                {pagina.items.length === 1 && (ofertaAImprimir.items || []).length === 1 ? (
                  <div className="border border-gray-200 rounded-2xl p-4 sm:p-5 bg-white print-no-break">
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-5 items-start">
                      <div className="sm:col-span-3">
                        <div className="w-full h-[340px] sm:h-[430px] print:h-[140mm] border border-gray-200 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center">
                          {pagina.items[0]?.imagen ? (
                            <img src={pagina.items[0].imagen} alt={pagina.items[0]?.descripcion || 'Producto'} className="w-full h-full object-contain p-3" />
                          ) : (
                            <div className="text-gray-300 flex items-center justify-center w-full h-full"><ImageIcon size={60} /></div>
                          )}
                        </div>
                      </div>
                      <div className="sm:col-span-2 border border-fuchsia-100 bg-fuchsia-50/30 rounded-2xl p-4">
                        <p className="text-[10px] font-black text-fuchsia-700 uppercase tracking-wider">Producto destacado</p>
                        <p className="mt-2 text-xl font-black text-gray-900 leading-tight break-words">{pagina.items[0]?.descripcion || '-'}</p>
                        {pagina.items[0]?.detalles && (
                          <p className="mt-3 text-sm font-semibold text-gray-500 leading-relaxed whitespace-pre-wrap break-words">{pagina.items[0].detalles}</p>
                        )}
                        <div className="mt-6 border-t border-fuchsia-100 pt-3">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Precio unitario</p>
                          <p className="text-3xl font-black text-fuchsia-700 tracking-tight">{formatearDinero(parseNumeroPresupuesto(pagina.items[0]?.precio))}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-800 text-white uppercase text-[10px] tracking-wider">
                        <th className="text-left py-2.5 px-3 w-[28%]">Imagen</th>
                        <th className="text-left py-2.5 px-3">Descripción</th>
                        <th className="text-right py-2.5 px-3 w-[22%]">Precio Unitario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagina.items.map((item, index) => (
                        <tr key={`${item.id || index}-${pagina.pagina}`} className="border-b border-gray-200 print-no-break">
                          <td className="py-2.5 px-3 align-top">
                            <div className="w-24 h-24 border border-gray-200 rounded-xl bg-white overflow-hidden flex items-center justify-center">
                              {item.imagen ? (
                                <img src={item.imagen} alt={item.descripcion || 'Producto'} className="w-full h-full object-contain" />
                              ) : (
                                <div className="text-gray-300 flex items-center justify-center w-full h-full"><ImageIcon size={26} /></div>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 align-top">
                            <p className="font-bold text-gray-900 text-sm leading-snug">{item.descripcion || '-'}</p>
                            {item.detalles && (
                              <p className="text-[11px] font-semibold text-gray-500 leading-snug mt-1">{item.detalles}</p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 align-top text-right">
                            <p className="text-lg font-black text-fuchsia-700">{formatearDinero(parseNumeroPresupuesto(item.precio))}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="mt-6 border-t border-gray-300 pt-3 text-center">
                  <p className="text-xs font-bold text-gray-400">Documento generado automáticamente desde el apartado Ofertas.</p>
                  <p className="text-[10px] text-gray-400 mt-1">Emitido por: {usuarioActual.nombre} • {obtenerNombreEmpresaPresupuesto()}</p>
                  {contactoNegocioPdf.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{contactoNegocioPdf.join(' • ')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Imprimir Combo */}
      {modalActivo === 'imprimir_combo' && comboAImprimir && (
        <div className="print-modal-root fixed inset-0 bg-gray-100 z-50 overflow-y-auto flex justify-center py-10 print:p-0 print:bg-white custom-scrollbar">
          <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
            <button onClick={imprimirReporte} className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2"><Printer size={20}/> Imprimir</button>
            <button onClick={descargarPdfVistaImpresion} disabled={descargandoPdfVistaImpresion} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2"><Download size={20}/>{descargandoPdfVistaImpresion ? 'Generando...' : 'Descargar PDF'}</button>
            <button onClick={() => { setModalActivo(null); setComboAImprimir(null); }} className="bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 p-3 rounded-full shadow-lg"><X size={24}/></button>
          </div>

          <div className="print-modal-pages w-full max-w-[210mm] space-y-6 print:space-y-0">
            {(paginasComboImpresion.length ? paginasComboImpresion : [{ items: [], esPrimera: true, esFinal: true, pagina: 1, totalPaginas: 1 }]).map((pagina) => (
              <div key={`combo-${pagina.pagina}`} className="print-a4-sheet box-border bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none p-6 sm:p-8 text-black font-sans">
                {pagina.esPrimera ? (
                  <>
                    <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
                      <div className="flex flex-col items-start justify-center min-h-[56px] max-w-[60%]">
                        {obtenerLogoEmpresaPresupuesto() ? (
                          <img src={obtenerLogoEmpresaPresupuesto()} alt="Logo" className="w-52 max-h-20 object-contain" />
                        ) : (
                          <p className="text-lg font-black text-gray-900 uppercase leading-tight">{obtenerNombreEmpresaPresupuesto()}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] font-semibold text-gray-500 leading-tight">
                          {contactoNegocioCabeceraPresupuesto.map((item, index) => (
                            <span key={`contacto-combo-${index}`} className="whitespace-nowrap">
                              {item.etiqueta ? <span className="font-black text-gray-700">{item.etiqueta}:</span> : null}
                              {item.etiqueta ? ' ' : ''}
                              {item.valor}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <h2 className="text-2xl font-black text-gray-300 tracking-widest mb-0.5">PRESUPUESTO</h2>
                        <p className="font-black text-sm">COMBO</p>
                        <p className="font-bold text-xs">FECHA: {new Date(comboAImprimir.fecha || Date.now()).toLocaleDateString('es-AR')}</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Pág.: {pagina.pagina}/{pagina.totalPaginas}</p>
                      </div>
                    </div>

                    <div className="mb-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Título del combo</p>
                      <p className="text-lg font-black text-gray-900 leading-tight">{(comboAImprimir.titulo || 'Combo Especial').toUpperCase()}</p>
                    </div>
                    {(comboAImprimir.aclaraciones || '').trim() && (
                      <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] font-black text-red-700 uppercase tracking-wider">Aclaraciones</p>
                        <p className="text-sm font-bold text-red-700 leading-relaxed whitespace-pre-wrap">{(comboAImprimir.aclaraciones || '').trim()}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mb-2 text-right">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Pág.: {pagina.pagina}/{pagina.totalPaginas}</p>
                  </div>
                )}

                {pagina.items.length === 1 && (comboAImprimir.items || []).length === 1 ? (
                  <div className="border border-gray-200 rounded-2xl p-4 sm:p-5 bg-white print-no-break">
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-5 items-start">
                      <div className="sm:col-span-3">
                        <div className="w-full h-[340px] sm:h-[430px] print:h-[126mm] border border-gray-200 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center relative">
                          {pagina.items[0]?.imagen ? (
                            <img src={pagina.items[0].imagen} alt={pagina.items[0]?.descripcion || 'Producto'} className="w-full h-full object-contain p-3" />
                          ) : (
                            <div className="text-gray-300 flex items-center justify-center w-full h-full"><ImageIcon size={60} /></div>
                          )}
                          {comboAImprimir.mostrarLogoMarca !== false && obtenerLogoMarcaItem(pagina.items[0]) && (
                            <div className="absolute top-3 left-3 w-16 h-16 flex items-center justify-center pointer-events-none">
                              <img src={obtenerLogoMarcaItem(pagina.items[0])} alt="Logo marca" className="w-full h-full object-contain" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="sm:col-span-2 border border-indigo-100 bg-indigo-50/30 rounded-2xl p-4">
                        <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Producto</p>
                        <p className="mt-2 text-xl font-black text-gray-900 leading-tight break-words">{pagina.items[0]?.descripcion || '-'}</p>
                        {pagina.items[0]?.detalles && (
                          <p className="mt-3 text-sm font-semibold text-gray-500 leading-relaxed whitespace-pre-wrap break-words">{pagina.items[0].detalles}</p>
                        )}
                        <p className="mt-3 text-xs font-black text-indigo-700 uppercase tracking-wider">
                          Cantidad: {parseNumeroPresupuesto(pagina.items[0]?.cantidad) || 1} {abreviarUnidadPdf(obtenerUnidadItem(pagina.items[0]))}
                        </p>
                        {comboAImprimir.mostrarPrecioPorItem !== false && (
                          <div className="mt-6 border-t border-indigo-100 pt-3">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Precio unitario</p>
                            <p className="text-3xl font-black text-indigo-700 tracking-tight">{formatearDinero(parseNumeroPresupuesto(pagina.items[0]?.precio))}</p>
                            <p className="text-[11px] font-black text-indigo-800 mt-1">Subtotal: {formatearDinero((parseNumeroPresupuesto(pagina.items[0]?.precio) || 0) * (parseNumeroPresupuesto(pagina.items[0]?.cantidad) || 1))}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-800 text-white uppercase text-[10px] tracking-wider">
                        <th className="text-left py-2 px-3 w-[25%]">Imagen</th>
                        <th className="text-left py-2 px-3">Descripción</th>
                        <th className="text-center py-2 px-3 w-[11%]">Cant.</th>
                        {comboAImprimir.mostrarPrecioPorItem !== false && (
                          <>
                            <th className="text-right py-2 px-3 w-[18%]">Precio Unit.</th>
                            <th className="text-right py-2 px-3 w-[18%]">Subtotal</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pagina.items.map((item, index) => {
                        const logoMarcaItem = comboAImprimir.mostrarLogoMarca !== false ? obtenerLogoMarcaItem(item) : '';
                        const mostrarLogoMarcaEnImagen = Boolean(logoMarcaItem && (comboAImprimir.items || []).length > 1);
                        const cantidadItem = parseNumeroPresupuesto(item.cantidad) || 1;
                        const unidadAbreviadaItem = abreviarUnidadPdf(
                          obtenerUnidadItem(item) ||
                          item?.unidad ||
                          item?.unidadMedida ||
                          item?.unidad_abreviada ||
                          'unid'
                        );
                        return (
                          <tr key={`${item.id || index}-${pagina.pagina}`} className="border-b border-gray-200 print-no-break">
                            <td className="py-2 px-3 align-top">
                              <div className="relative w-20 h-20">
                                <div className="w-20 h-20 border border-gray-200 rounded-xl bg-white overflow-hidden flex items-center justify-center">
                                  {item.imagen ? (
                                    <img src={item.imagen} alt={item.descripcion || 'Producto'} className="w-full h-full object-contain" />
                                  ) : (
                                    <div className="text-gray-300 flex items-center justify-center w-full h-full"><ImageIcon size={26} /></div>
                                  )}
                                </div>
                                {mostrarLogoMarcaEnImagen && (
                                  <div className="absolute top-1 left-1 w-7 h-7 flex items-center justify-center pointer-events-none">
                                    <img src={logoMarcaItem} alt="Logo marca" className="w-full h-full object-contain" />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 align-top">
                              <p className="font-bold text-gray-900 text-sm leading-snug">{recortarTexto(item.descripcion || '-', 90)}</p>
                              {item.detalles && (
                                <p className="text-[11px] font-semibold text-gray-500 leading-snug mt-1">{recortarTexto(item.detalles, 100)}</p>
                              )}
                            </td>
                            <td className="py-2 px-3 align-top text-center">
                              <p className="text-sm font-black text-indigo-700">{cantidadItem}</p>
                              <p className="mt-0.5 text-[9px] font-black text-gray-500 uppercase leading-none">{unidadAbreviadaItem}</p>
                            </td>
                            {comboAImprimir.mostrarPrecioPorItem !== false && (
                              <>
                                <td className="py-2 px-3 align-top text-right">
                                  <p className="text-base font-black text-indigo-700">{formatearDinero(parseNumeroPresupuesto(item.precio))}</p>
                                </td>
                                <td className="py-2 px-3 align-top text-right">
                                  <p className="text-base font-black text-indigo-800">{formatearDinero((parseNumeroPresupuesto(item.precio) || 0) * (parseNumeroPresupuesto(item.cantidad) || 1))}</p>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {!pagina.esFinal ? (
                  <div className="mt-3 text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Continúa en la siguiente página</p>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 flex justify-end">
                      <div className="w-full max-w-[340px] bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-right">
                        <p className="text-[11px] font-black text-indigo-700 uppercase tracking-wider">Total Final del Combo</p>
                        <p className="text-3xl font-black text-indigo-800 tracking-tight">{formatearDinero(parseNumeroPresupuesto(comboAImprimir.total))}</p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-gray-300 pt-2 text-center">
                      <p className="text-[10px] text-gray-400 mt-1">Emitido por: {usuarioActual.nombre}</p>
                      {contactoNegocioPdf.length > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{contactoNegocioPdf.join(' • ')}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lector de Códigos de Barras Modal */}
      {modalActivo === 'scanner_codigo' && (
        <Modal titulo="Escanear Código de Barras" onClose={() => setModalActivo('nuevo_producto')}>
          <div className="flex flex-col items-center justify-center p-4">
             <div id="reader" className="w-full max-w-sm rounded-xl overflow-hidden border-2 border-indigo-200 shadow-inner bg-black"></div>
             <p className="text-xs text-gray-500 font-bold uppercase mt-4 text-center">Apunta la cámara de tu dispositivo hacia el código de barras o código QR del producto.</p>
          </div>
        </Modal>
      )}

      {/* Modal Nuevo Producto de Inventario */}
      {modalActivo === 'nuevo_producto' && (
        <Modal
          titulo={productoAEditar ? 'Editar Producto' : 'Nuevo Producto'}
          onClose={() => { setModalActivo(null); setProductoAEditar(null); limpiarEdicionTaxonomias(); }}
          customWidth="max-w-4xl"
        >
          <form onSubmit={guardarProducto} className="space-y-3">
            
            {/* Foto + Logo de Marca */}
            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Previsualización producto</p>
                  <div className="w-full h-24 rounded-xl border border-indigo-200 bg-white overflow-hidden relative shadow-sm">
                    {formProducto.imagen ? (
                      <img src={formProducto.imagen} alt="Producto" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-indigo-200"><ImageIcon size={30} /></div>
                    )}
                    {formProducto.imagen && (
                      <button type="button" onClick={() => setFormProducto((prev) => ({ ...prev, imagen: '' }))} className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
                        <X size={12}/>
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Previsualización marca</p>
                  <div className="w-full h-24 rounded-xl border border-amber-200 bg-white overflow-hidden relative shadow-sm flex items-center justify-center p-2">
                    {formProducto.logoMarca ? (
                      <img src={formProducto.logoMarca} alt="Logo de marca" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-amber-200"><ImageIcon size={30} /></div>
                    )}
                    {formProducto.logoMarca && (
                      <button type="button" onClick={() => setFormProducto((prev) => ({ ...prev, logoMarca: '' }))} className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
                        <X size={12}/>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100 transition-colors">
                  <Camera size={16}/>
                  <span className="text-[11px] font-black uppercase tracking-wider">Imagen del producto</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={procesarImagenProducto} />
                </label>
                <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-white text-amber-700 hover:bg-amber-100 transition-colors">
                  <ImageIcon size={16}/>
                  <span className="text-[11px] font-black uppercase tracking-wider">Logo de la marca</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={procesarLogoMarcaProducto} />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <span className="hidden sm:block" />
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide sm:text-left text-center">Subí PNG transparente (sticker)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-start">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Código de Barras</label>
                <div className="flex gap-2">
                   <input type="text" value={formProducto.codigo} onChange={(e) => setFormProducto({...formProducto, codigo: e.target.value})} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold" placeholder="Escribe o escanea..." />
                   <button type="button" onClick={() => setModalActivo('scanner_codigo')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-lg shadow-sm transition-colors flex items-center justify-center" title="Escanear Código">
                     <ScanBarcode size={20} />
                   </button>
                </div>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Stock Inicial</label>
                <input type="text" inputMode="decimal" required value={formProducto.cantidad} onChange={(e) => setFormProducto({...formProducto, cantidad: e.target.value.replace(',', '.')})} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-center" placeholder="0"/>
              </div>
              {!productoAEditar && (
                <div className="sm:col-span-3">
                  <label className="inline-flex items-start gap-2 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(formProducto.generarCodigoAutomatico)}
                      onChange={(e) => setFormProducto((prev) => ({ ...prev, generarCodigoAutomatico: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500 mt-0.5"
                    />
                    <span className="leading-tight">
                      Generar código automático al guardar
                      <span className="block text-[10px] text-indigo-500 font-semibold mt-0.5">
                        Solo si el campo de código queda vacío.
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </div>
            
            <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Descripción del Producto</label><input type="text" required value={formProducto.descripcion} onChange={(e) => setFormProducto({...formProducto, descripcion: e.target.value})} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold" placeholder="Ej: Pintura Latex Blanca 20L"/></div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Detalles (solo para ofertas)</label>
              <textarea
                rows={2}
                value={formProducto.detalles || ''}
                onChange={(e) => setFormProducto({...formProducto, detalles: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-xs font-semibold text-gray-600 resize-none"
                placeholder="Ej: Línea premium, garantía 2 años, ideal exterior. Este texto no sale en presupuestos."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Categoría</label>
                <input
                  type="text"
                  value={formProducto.categoria}
                  onChange={(e) => setFormProducto({...formProducto, categoria: e.target.value})}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  placeholder="Elegir o escribir categoría"
                />
                <div className="mt-1.5 border border-indigo-100 bg-indigo-50/40 rounded-lg max-h-24 overflow-y-auto">
                  {(() => {
                    if (!categoriasInventario.length) {
                      return <p className="px-3 py-2 text-[11px] font-bold text-gray-400">Sin categorías cargadas.</p>;
                    }
                    const filtro = normalizarTaxonomia(formProducto.categoria);
                    const visibles = categoriasInventario.filter((cat) => normalizarTaxonomia(cat).includes(filtro) || cat === categoriaEnEdicion);
                    if (!visibles.length) {
                      return <p className="px-3 py-2 text-[11px] font-bold text-gray-400">Sin coincidencias para ese texto.</p>;
                    }
                    return visibles.map((cat, idx) => {
                      const busyKey = `categoria:${normalizarTaxonomia(cat)}`;
                      const isBusy = gestionTaxonomiaBusy === busyKey;
                      return (
                        <div key={cat} className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 ${idx < visibles.length - 1 ? 'border-b border-indigo-100' : ''}`}>
                          {categoriaEnEdicion === cat ? (
                            <div className="w-full flex items-center gap-2">
                              <input
                                type="text"
                                value={categoriaEditValor}
                                onChange={(e) => setCategoriaEditValor(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    guardarEdicionCategoria();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelarEdicionCategoria();
                                  }
                                }}
                                className="flex-1 min-w-0 px-2 py-1 bg-white border border-indigo-200 rounded-md text-xs font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={guardarEdicionCategoria}
                                disabled={isBusy || Boolean(gestionTaxonomiaBusy)}
                                className="text-[10px] font-black text-indigo-700 hover:text-indigo-900 disabled:opacity-40"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={cancelarEdicionCategoria}
                                className="text-[10px] font-black text-gray-500 hover:text-gray-700"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setFormProducto((prev) => ({ ...prev, categoria: cat }))}
                                className="text-left text-xs font-bold text-indigo-800 hover:text-indigo-900 truncate"
                                title="Usar esta categoría"
                              >
                                {cat}
                              </button>
                              <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => iniciarEdicionCategoria(cat)}
                                  disabled={isBusy || Boolean(gestionTaxonomiaBusy)}
                                  className="w-6 h-6 rounded-md border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                  title="Editar categoría"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => eliminarCategoriaInventario(cat)}
                                  disabled={isBusy || Boolean(gestionTaxonomiaBusy)}
                                  className="w-6 h-6 rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                  title="Eliminar categoría"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Marca</label>
                <input
                  type="text"
                  value={formProducto.marca}
                  onChange={(e) => setFormProducto({...formProducto, marca: e.target.value})}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  placeholder="Ej: Philips / Osram / Genérica"
                />
                <div className="mt-1.5 border border-purple-100 bg-purple-50/40 rounded-lg max-h-24 overflow-y-auto">
                  {(() => {
                    if (!marcasInventario.length) {
                      return <p className="px-3 py-2 text-[11px] font-bold text-gray-400">Sin marcas cargadas.</p>;
                    }
                    const filtro = normalizarTaxonomia(formProducto.marca);
                    const visibles = marcasInventario.filter((marca) => normalizarTaxonomia(marca).includes(filtro) || marca === marcaEnEdicion);
                    if (!visibles.length) {
                      return <p className="px-3 py-2 text-[11px] font-bold text-gray-400">Sin coincidencias para ese texto.</p>;
                    }
                    return visibles.map((marca, idx) => {
                      const busyKey = `marca:${normalizarTaxonomia(marca)}`;
                      const isBusy = gestionTaxonomiaBusy === busyKey;
                      return (
                        <div key={marca} className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 ${idx < visibles.length - 1 ? 'border-b border-purple-100' : ''}`}>
                          {marcaEnEdicion === marca ? (
                            <div className="w-full flex items-center gap-2">
                              <input
                                type="text"
                                value={marcaEditValor}
                                onChange={(e) => setMarcaEditValor(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    guardarEdicionMarca();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelarEdicionMarca();
                                  }
                                }}
                                className="flex-1 min-w-0 px-2 py-1 bg-white border border-purple-200 rounded-md text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-500"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={guardarEdicionMarca}
                                disabled={isBusy || Boolean(gestionTaxonomiaBusy)}
                                className="text-[10px] font-black text-purple-700 hover:text-purple-900 disabled:opacity-40"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={cancelarEdicionMarca}
                                className="text-[10px] font-black text-gray-500 hover:text-gray-700"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setFormProducto((prev) => ({ ...prev, marca }))}
                                className="text-left text-xs font-bold text-purple-800 hover:text-purple-900 truncate"
                                title="Usar esta marca"
                              >
                                {marca}
                              </button>
                              <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => iniciarEdicionMarca(marca)}
                                  disabled={isBusy || Boolean(gestionTaxonomiaBusy)}
                                  className="w-6 h-6 rounded-md border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                  title="Editar marca"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => eliminarMarcaInventario(marca)}
                                  disabled={isBusy || Boolean(gestionTaxonomiaBusy)}
                                  className="w-6 h-6 rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                  title="Eliminar marca"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Moneda costo</label>
                <select
                  value={formProducto.monedaCosto || 'ARS'}
                  onChange={(e) => actualizarMonedaCostoProducto(e.target.value)}
                  className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-xs font-bold uppercase"
                >
                  <option value="ARS">Pesos</option>
                  <option value="USD_BNA">USD oficial BNA</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{formProducto.monedaCosto === 'USD_BNA' ? 'Costo USD' : 'Costo Neto'}</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{formProducto.monedaCosto === 'USD_BNA' ? 'US$' : '$'}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={formProducto.costo}
                    onChange={(e) => {
                      const val = e.target.value.replace(',', '.');
                      setFormProducto((prev) => recalcularFormularioProducto({ ...prev, costo: val, costoOriginal: val }, (prev.precio ?? '').toString().trim() && !(prev.ganancia ?? '').toString().trim() ? 'precio' : 'ganancia'));
                    }}
                    className={`w-full ${formProducto.monedaCosto === 'USD_BNA' ? 'pl-9' : 'pl-6'} pr-2 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-right`}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Ganancia %</label>
                <div className="relative"><input type="text" inputMode="decimal" value={formProducto.ganancia} onChange={(e) => { const val = e.target.value.replace(',', '.'); setFormProducto((prev) => recalcularFormularioProducto({ ...prev, ganancia: val }, 'ganancia')); }} className="w-full pr-6 pl-2 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-right" placeholder="0"/><span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span></div>
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">IVA</label>
                <select value={formProducto.iva} onChange={(e) => { const val = e.target.value; setFormProducto((prev) => recalcularFormularioProducto({ ...prev, iva: val }, (prev.precio ?? '').toString().trim() && !(prev.ganancia ?? '').toString().trim() ? 'precio' : 'ganancia')); }} className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-xs font-bold uppercase">
                  <option value="sin_iva">Sin IVA</option><option value="10.5">10.5%</option><option value="21">21%</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Unidad</label>
                <select value={formProducto.unidad} onChange={(e) => setFormProducto({...formProducto, unidad: e.target.value})} className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-xs font-bold uppercase">
                  <option value="unid">Unid.</option><option value="mts">Metros</option><option value="lts">Litros</option><option value="kg">Kilos</option><option value="cm">Cm</option>
                </select>
              </div>
            </div>
            
            <div className="text-[9px] text-indigo-600 font-bold mt-0.5 uppercase tracking-wider min-h-3">
              {formProducto.monedaCosto === 'USD_BNA' ? (
                <span>
                  {cotizacionDolarBnaCargando ? 'Consultando BNA...' : (cotizacionDolarBnaEstado || 'Se usa Dolar U.S.A venta de Banco Nación.')}
                  {formProducto.costo && obtenerTasaDolarProducto(formProducto) > 0 ? ` · Costo en pesos: ${formatearDinero(obtenerCostoProductoEnPesos(formProducto.costo, 'USD_BNA', obtenerTasaDolarProducto(formProducto)))}` : ''}
                </span>
              ) : (
                formProducto.costo ? numeroALetras(parseFloat(formProducto.costo) || 0) : ''
              )}
            </div>

            <div className="mt-1.5">
               <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Precio Final de Venta</label>
               <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">$</span><input type="text" inputMode="decimal" required value={formProducto.precio} onChange={(e) => { const val = e.target.value.replace(',', '.'); setFormProducto((prev) => recalcularFormularioProducto({ ...prev, precio: val }, 'precio')); }} className="w-full pl-8 pr-4 py-2.5 bg-indigo-50/50 border-2 border-indigo-200 rounded-xl focus:border-indigo-600 outline-none text-2xl font-black text-indigo-800" placeholder="0.00"/></div>
               <div className="text-[9px] text-indigo-700 font-bold mt-1 uppercase tracking-wider h-3">{formProducto.precio ? numeroALetras(parseFloat(formProducto.precio) || 0) : ''}</div>
            </div>

            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-4 rounded-xl mt-2 shadow-md text-sm uppercase tracking-wider transition-transform active:scale-95">{productoAEditar ? 'Guardar Cambios' : 'Agregar al Inventario'}</button>
          </form>
        </Modal>
      )}

      {/* Modal Seleccionar Producto desde Stock */}
      {modalActivo === 'seleccionar_stock' && (
        <Modal titulo="Buscar en Inventario" onClose={() => setModalActivo('nuevo_presupuesto')}>
          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={18} /></span>
              <input type="text" placeholder="Buscar por nombre o código..." autoFocus value={busquedaStockModal || ''} onChange={(e) => setBusquedaStockModal(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl">
              {productos.filter(p => !busquedaStockModal || p.descripcion.toLowerCase().includes(busquedaStockModal.toLowerCase()) || (p.codigo && p.codigo.toLowerCase().includes(busquedaStockModal.toLowerCase()))).length === 0 ? (
                <p className="text-center text-gray-500 py-4 text-sm font-bold">No se encontraron productos.</p>
              ) : (
                productos.filter(p => !busquedaStockModal || p.descripcion.toLowerCase().includes(busquedaStockModal.toLowerCase()) || (p.codigo && p.codigo.toLowerCase().includes(busquedaStockModal.toLowerCase()))).map(p => (
                  <div key={p.id} onClick={() => seleccionarProductoParaStock(p)} className="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors gap-3">
                    <div className="w-10 h-10 rounded-lg border border-gray-200 bg-white overflow-hidden shrink-0 relative">
                      {p.imagen ? <img src={p.imagen} alt="prod" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center"><Package size={16} className="text-gray-300"/></div>}
                      {p.logoMarca && (
                        <div className="absolute top-0.5 left-0.5 bg-white/95 rounded-[4px] border border-gray-200 p-[1px] shadow-sm">
                          <img src={p.logoMarca} alt="Logo marca" className="w-3.5 h-3.5 object-contain" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{p.descripcion}</p>
                      <p className="text-[10px] uppercase font-bold text-gray-500 mt-0.5">Cód: {p.codigo || '-'} | Stock: {p.cantidad} {p.unidad}</p>
                    </div>
                    <span className="font-black text-indigo-700">{formatearDinero(p.precio)}</span>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setModalActivo('nuevo_presupuesto')} className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl text-xs tracking-wider uppercase mt-2 hover:bg-gray-200 transition-colors">Cancelar Búsqueda</button>
          </div>
        </Modal>
      )}

      {/* MODAL: OPCIONES DE PRESUPUESTO (AL HACER CLIC EN LA LISTA) */}
      {modalActivo === 'opciones_presupuesto' && presupuestoSeleccionado && (
        <Modal titulo="Opciones de Presupuesto" onClose={() => { setModalActivo(null); setPresupuestoSeleccionado(null); setIncluirImagenesPdf(false); setIncluirLogoMarcaPresupuestoPdf(true); setSoloPreciosPorItemPresupuestoPdf(false); }} customWidth="max-w-sm">
           <div className="text-center mb-6">
              <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">Cliente / Empresa</p>
              <p className="text-xl font-black text-gray-900 leading-tight">{presupuestoSeleccionado.clienteNombre}</p>
              <p className="text-2xl font-black text-teal-600 mt-2">{formatearDinero(presupuestoSeleccionado.total)}</p>
           </div>

           <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Cambiar Estado</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => cambiarEstadoPresupuesto(presupuestoSeleccionado.id, 'aprobado')} className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-bold py-2 rounded-lg flex justify-center items-center gap-1 text-sm transition-colors"><CheckCircle size={16}/> Aprobado</button>
                  <button onClick={() => cambiarEstadoPresupuesto(presupuestoSeleccionado.id, 'rechazado')} className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold py-2 rounded-lg flex justify-center items-center gap-1 text-sm transition-colors"><XCircle size={16}/> Rechazado</button>
                  <button onClick={() => cambiarEstadoPresupuesto(presupuestoSeleccionado.id, 'enviado')} className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold py-2 rounded-lg text-sm transition-colors col-span-2">Marcar como Enviado</button>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                <button onClick={() => enviarWhatsAppPresupuesto(presupuestoSeleccionado)} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 rounded-lg flex justify-center items-center gap-2 transition-colors text-sm shadow-sm"><Send size={16}/> Enviar por WhatsApp</button>
                <label className="w-full flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={incluirImagenesPdf} onChange={(e) => setIncluirImagenesPdf(e.target.checked)} className="w-4 h-4 text-gray-800 rounded border-gray-300" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Incluir imágenes de productos en PDF</span>
                </label>
                {incluirImagenesPdf && (
                  <label className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 cursor-pointer">
                    <input type="checkbox" checked={incluirLogoMarcaPresupuestoPdf} onChange={(e) => setIncluirLogoMarcaPresupuestoPdf(e.target.checked)} className="w-4 h-4 text-amber-600 rounded border-amber-300" />
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Incluir logo de marca sobre la foto</span>
                  </label>
                )}
                <label className="w-full flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={soloPreciosPorItemPresupuestoPdf} onChange={(e) => setSoloPreciosPorItemPresupuestoPdf(e.target.checked)} className="w-4 h-4 text-teal-600 rounded border-teal-300" />
                  <span className="text-xs font-bold text-teal-800 uppercase tracking-wide">Mostrar solo precios por item</span>
                </label>
                <button onClick={() => {
                  setPresupuestoAImprimir({
                    ...presupuestoSeleccionado,
                    empresaNombre: textoSeguroTrim(presupuestoSeleccionado?.empresaNombre, textoSeguroTrim(configuracion?.nombre, NOMBRE_EMPRESA_FALLBACK)),
                    empresaLogo: textoSeguroTrim(presupuestoSeleccionado?.empresaLogo, textoSeguroTrim(logoEmpresaRender, textoSeguroTrim(configuracion?.logo, ''))),
                    soloPreciosPorItem: Boolean(soloPreciosPorItemPresupuestoPdf)
                  });
                  setModalActivo('imprimir_presupuesto');
                }} className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 rounded-lg flex justify-center items-center gap-2 transition-colors text-sm shadow-sm"><Printer size={16}/> Ver PDF / Imprimir</button>
              </div>

              <div className="border-t border-gray-100 pt-4 flex gap-2">
                <button onClick={() => { 
                  setFormPresupuesto({
                    ...presupuestoSeleccionado,
                    esNuevoCliente: false,
                    busquedaCliente: presupuestoSeleccionado.clienteNombre || '',
                    descuentoGeneral: presupuestoSeleccionado.descuentoGeneral ?? '',
                    aplicaFleteCosto: Boolean(presupuestoSeleccionado.aplicaFleteCosto),
                    fletePorcentaje: presupuestoSeleccionado.fletePorcentaje ?? '',
                    items: (presupuestoSeleccionado.items || []).map((item) => ({ ...item, descuento: item?.descuento ?? 0 }))
                  }); 
                  setModalActivo('nuevo_presupuesto'); 
                }} className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-2 rounded-lg text-sm transition-colors flex justify-center items-center gap-1"><Edit2 size={16}/> Editar</button>
                <button onClick={() => eliminarPresupuesto(presupuestoSeleccionado.id)} className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold py-2 rounded-lg text-sm transition-colors flex justify-center items-center gap-1"><Trash2 size={16}/> Borrar</button>
              </div>
           </div>
        </Modal>
      )}

      {/* Modal Creación/Edición PRESUPUESTO (Estilo Lista / Spreadsheet) */}
      {modalActivo === 'nuevo_presupuesto' && (
        <Modal titulo={formPresupuesto.id ? 'Editar Presupuesto' : 'Crear Presupuesto'} onClose={cancelarEdicionPresupuesto} customWidth="max-w-5xl" extraClases="p-2 sm:p-4">
          <form onSubmit={guardarPresupuesto} className="space-y-4">
            
            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px] lg:items-start">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-gray-600 uppercase">Cliente</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={formPresupuesto.esNuevoCliente} onChange={(e) => setFormPresupuesto({...formPresupuesto, esNuevoCliente: e.target.checked, clienteId: '', clienteNombre: '', whatsapp: '', busquedaCliente: ''})} className="w-3 h-3 text-teal-600"/><span className="text-[10px] font-bold text-teal-700 uppercase">Nuevo</span></label>
                  </div>
                  {!formPresupuesto.esNuevoCliente ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        required
                        placeholder="Buscar por nombre, WhatsApp, documento o N° de cliente..."
                        value={formPresupuesto.busquedaCliente || ''}
                        onChange={(e) => setFormPresupuesto({
                          ...formPresupuesto,
                          busquedaCliente: e.target.value,
                          clienteId: '',
                          clienteNombre: '',
                          whatsapp: ''
                        })}
                        className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm font-bold outline-none"
                      />
                      {clientesSugeridosPresupuesto.length > 0 && (
                        <div className="max-h-24 overflow-y-auto bg-white border border-teal-100 rounded-xl divide-y divide-teal-100">
                          {clientesSugeridosPresupuesto.map((c) => (
                            <button
                              key={`pres-cliente-${c.id}`}
                              type="button"
                              onClick={() => seleccionarClientePresupuesto(c)}
                              className={`w-full text-left px-3 py-2 transition-colors ${formPresupuesto.clienteId === c.id ? 'bg-teal-50' : 'hover:bg-teal-50/60'}`}
                            >
                              <p className="font-bold text-sm text-gray-800">{c.nombre}</p>
                              <p className="text-[10px] font-bold text-gray-500">{obtenerNumeroClienteTexto(c)} {c.documento ? `• ${c.documento}` : ''} {c.whatsapp ? `• ${c.whatsapp}` : ''}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      {formPresupuesto.clienteId && (
                        <p className="text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 w-max">
                          Cliente seleccionado: {formPresupuesto.clienteNombre || clientes.find((c) => c.id === formPresupuesto.clienteId)?.nombre || ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" required placeholder="Nombre" value={formPresupuesto.clienteNombre} onChange={(e) => setFormPresupuesto({...formPresupuesto, clienteNombre: e.target.value})} className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm font-bold outline-none" />
                      <input type="text" placeholder="WhatsApp" value={formPresupuesto.whatsapp} onChange={(e) => setFormPresupuesto({...formPresupuesto, whatsapp: e.target.value})} className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm font-bold outline-none max-w-[120px]" />
                    </div>
                  )}
                </div>
                <div className="bg-teal-50 px-3 py-2.5 rounded-xl border border-teal-200">
                  <p className="text-[10px] font-bold text-teal-800 uppercase mb-1">Desc. General (%)</p>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formPresupuesto.descuentoGeneral || ''}
                    onChange={(e) => setFormPresupuesto({ ...formPresupuesto, descuentoGeneral: e.target.value.replace(',', '.') })}
                    className="w-full px-2 py-1.5 text-sm font-black text-right text-teal-800 bg-white border border-teal-200 rounded-md outline-none focus:border-teal-500"
                    placeholder="0"
                  />
                  <p className="mt-1.5 text-[10px] font-bold text-teal-700">Descuento actual: -{formatearDinero(resumenPresupuestoActual.descuentoGeneralMonto)}</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="flex-1">
                  <details className="group">
                    <summary className="list-none cursor-pointer flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Flete interno al costo</p>
                        <p className="text-[10px] font-bold text-slate-500">Queda plegado para darle m&aacute;s lugar a la carga de productos.</p>
                      </div>
                      <span className="text-[10px] font-black uppercase text-teal-700">{Boolean(formPresupuesto.aplicaFleteCosto) ? 'Configurado' : 'Configurar'}</span>
                    </summary>
                    <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(formPresupuesto.aplicaFleteCosto)}
                          onChange={(e) => setFormPresupuesto({ ...formPresupuesto, aplicaFleteCosto: e.target.checked })}
                          className="w-3.5 h-3.5 text-teal-600 border-teal-300 rounded"
                        />
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Aplicar flete</span>
                      </label>
                      <p className="text-[10px] font-bold text-slate-500 flex-1">Solo impacta en tu costo y ganancia. No cambia el precio visible para el cliente.</p>
                      {formPresupuesto.aplicaFleteCosto && (
                        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-2 py-1">
                          <span className="text-[10px] font-bold text-teal-700 uppercase">Flete %</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formPresupuesto.fletePorcentaje || ''}
                            onChange={(e) => setFormPresupuesto({ ...formPresupuesto, fletePorcentaje: e.target.value.replace(',', '.') })}
                            className="w-16 px-1.5 py-1 text-[11px] font-black text-right text-teal-800 bg-white border border-teal-200 rounded outline-none focus:border-teal-500"
                            placeholder="0"
                          />
                        </div>
                      )}
                    </div>
                  </details>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end lg:max-w-[420px]">
                  <div className="bg-white border border-teal-100 rounded-lg px-3 py-2 min-w-[120px]">
                    <p className="text-[10px] font-bold text-teal-700 uppercase">Total</p>
                    <p className="text-sm font-black text-teal-800">{formatearDinero(resumenPresupuestoActual.total)}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 min-w-[120px]">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Costo</p>
                    <p className="text-sm font-black text-slate-700">{formatearDinero(resumenGananciaPresupuestoActual.costoTotalConFlete)}</p>
                  </div>
                  <div className={`border rounded-lg px-3 py-2 min-w-[120px] ${resumenGananciaPresupuestoActual.ganancia >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <p className={`text-[10px] font-bold uppercase ${resumenGananciaPresupuestoActual.ganancia >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Ganancia</p>
                    <p className={`text-sm font-black ${resumenGananciaPresupuestoActual.ganancia >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>{formatearDinero(resumenGananciaPresupuestoActual.ganancia)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* TABLA DE PRODUCTOS - ESTILO CLEAN */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
               {/* Vista Desktop Table */}
               <div className="hidden md:block overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-800 text-white text-[10px] uppercase font-bold tracking-wider">
                     <tr>
                       <th className="px-3 py-2 w-10"></th>
                       <th className="px-3 py-2 w-20">Cód.</th>
                       <th className="px-3 py-2">Descripción</th>
                       <th className="px-3 py-2 w-20 text-center">Cant.</th>
                       <th className="px-3 py-2 w-24">Unid.</th>
                       <th className="px-3 py-2 w-28 text-right">Precio</th>
                       <th className="px-3 py-2 w-20 text-center">Desc. %</th>
                       <th className="px-3 py-2 w-28 text-right">Total</th>
                       <th className="px-2 py-2 w-10"></th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {formPresupuesto.items.map((item, index) => (
                       <tr key={index} className="hover:bg-slate-50 transition-colors group">
                         <td className="p-1 text-center"><button type="button" onClick={() => { setItemIndexParaStock(index); setBusquedaStockModal(''); setModalActivo('seleccionar_stock'); }} className="text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-lg transition-colors" title="Buscar en Stock"><Search size={16}/></button></td>
                         <td className="p-1"><input type="text" placeholder="Cod" value={item.codigo} onChange={(e) => handleItemChange(index, 'codigo', e.target.value)} className="w-full px-2 py-1.5 bg-transparent focus:bg-white border border-transparent focus:border-gray-300 rounded outline-none text-xs transition-all"/></td>
                         <td className="p-1"><input type="text" required placeholder="Detalle producto" value={item.descripcion} onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)} className="w-full px-2 py-1.5 bg-transparent focus:bg-white border border-transparent focus:border-gray-300 rounded outline-none font-bold text-sm transition-all"/></td>
                         <td className="p-1"><input type="text" inputMode="decimal" required value={item.cantidad} onChange={(e) => handleItemChange(index, 'cantidad', e.target.value.replace(',', '.'))} className="w-full px-2 py-1.5 bg-transparent focus:bg-white border border-transparent focus:border-gray-300 rounded outline-none font-bold text-sm text-center transition-all"/></td>
                         <td className="p-1">
                           <select value={item.unidad} onChange={(e) => handleItemChange(index, 'unidad', e.target.value)} className="w-full px-1 py-1.5 bg-transparent focus:bg-white border border-transparent focus:border-gray-300 rounded outline-none text-xs cursor-pointer">
                             <option value="unid">Unid.</option><option value="mts">Metros</option><option value="lts">Litros</option><option value="kg">Kilos</option><option value="cm">Cm</option>
                           </select>
                         </td>
                         <td className="p-1"><input type="text" inputMode="decimal" required value={item.precio} onChange={(e) => handleItemChange(index, 'precio', e.target.value.replace(',', '.'))} className="w-full px-2 py-1.5 bg-transparent focus:bg-white border border-transparent focus:border-gray-300 rounded outline-none font-bold text-sm text-right transition-all"/></td>
                         <td className="p-1"><input type="text" inputMode="decimal" value={item.descuento ?? 0} onChange={(e) => handleItemChange(index, 'descuento', e.target.value.replace(',', '.'))} className="w-full px-2 py-1.5 bg-transparent focus:bg-white border border-transparent focus:border-gray-300 rounded outline-none font-bold text-sm text-center transition-all" placeholder="0"/></td>
                         <td className="p-2 text-right font-black text-sm text-teal-700 bg-teal-50/30">{formatearDinero(calcularTotalItemPresupuesto(item))}</td>
                         <td className="p-1 text-center"><button type="button" onClick={() => eliminarItemPresupuesto(index)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 size={14}/></button></td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>

               {/* Vista Mobile List Items */}
               <div className="block md:hidden divide-y divide-gray-100">
                 {formPresupuesto.items.map((item, index) => (
                    <div key={index} className="p-3 bg-white relative space-y-2">
                      <button type="button" onClick={() => eliminarItemPresupuesto(index)} className="absolute top-3 right-3 text-red-400 p-1"><X size={16}/></button>
                      <div className="flex items-center gap-2 pr-8">
                         <button type="button" onClick={() => { setItemIndexParaStock(index); setBusquedaStockModal(''); setModalActivo('seleccionar_stock'); }} className="text-white bg-indigo-600 p-2 rounded-lg shadow-sm"><Search size={16}/></button>
                         <input type="text" required placeholder="Descripción del Producto" value={item.descripcion} onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)} className="w-full text-sm font-bold outline-none placeholder-gray-300"/>
                      </div>
                      <div className="flex gap-2 text-xs">
                         <input type="text" placeholder="Cód." value={item.codigo} onChange={(e) => handleItemChange(index, 'codigo', e.target.value)} className="w-24 border rounded px-2 py-1 outline-none"/>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                        <input type="text" inputMode="decimal" required value={item.cantidad} onChange={(e) => handleItemChange(index, 'cantidad', e.target.value.replace(',', '.'))} className="w-16 p-1 border rounded text-center font-bold text-sm outline-none"/>
                        <select value={item.unidad} onChange={(e) => handleItemChange(index, 'unidad', e.target.value)} className="p-1 border rounded text-xs outline-none bg-white"><option value="unid">Unid.</option><option value="mts">Mts</option><option value="lts">Lts</option><option value="kg">Kg</option></select>
                        <span className="text-gray-400 text-xs">x</span>
                        <input type="text" inputMode="decimal" required value={item.precio} onChange={(e) => handleItemChange(index, 'precio', e.target.value.replace(',', '.'))} className="flex-1 p-1 border rounded font-bold text-sm text-right outline-none" placeholder="Precio"/>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                        <span className="text-[10px] font-bold uppercase text-gray-500">Desc. %</span>
                        <input type="text" inputMode="decimal" value={item.descuento ?? 0} onChange={(e) => handleItemChange(index, 'descuento', e.target.value.replace(',', '.'))} className="w-16 p-1 border rounded text-center font-bold text-sm outline-none" placeholder="0"/>
                        <span className="text-[10px] font-bold uppercase text-gray-500">Total</span>
                        <span className="flex-1 text-right font-black text-sm text-teal-700">{formatearDinero(calcularTotalItemPresupuesto(item))}</span>
                      </div>
                    </div>
                 ))}
               </div>

               <div className="p-2 bg-slate-50 border-t border-gray-200">
                 <button type="button" onClick={agregarItemPresupuesto} className="w-full bg-white text-teal-600 font-bold border border-teal-200 border-dashed py-2 rounded-lg text-sm flex items-center justify-center gap-1 hover:bg-teal-50 transition-colors">
                   <Plus size={16}/> Agregar Línea Manual
                 </button>
               </div>
            </div>
            <div className="bg-teal-50/60 border border-teal-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 text-xs font-bold text-teal-900">
              <span>Subtotal: {formatearDinero(resumenPresupuestoActual.subtotalConDescuentos)}</span>
              <span className="hidden sm:inline text-teal-300">|</span>
              <span>Desc. General: -{formatearDinero(resumenPresupuestoActual.descuentoGeneralMonto)}</span>
              {resumenGananciaPresupuestoActual.fletePctAplicado > 0 && (
                <>
                  <span className="hidden sm:inline text-teal-300">|</span>
                  <span>Flete interno costo {resumenGananciaPresupuestoActual.fletePctAplicado}%: +{formatearDinero(resumenGananciaPresupuestoActual.fleteMonto)}</span>
                </>
              )}
              <span className="hidden sm:inline text-teal-300">|</span>
              <span className="text-sm">Final: {formatearDinero(resumenPresupuestoActual.total)}</span>
              <span className="hidden sm:inline text-teal-300">|</span>
              <span className={resumenGananciaPresupuestoActual.ganancia >= 0 ? 'text-emerald-700' : 'text-red-700'}>Ganancia: {formatearDinero(resumenGananciaPresupuestoActual.ganancia)} ({resumenGananciaPresupuestoActual.margen.toFixed(1)}%)</span>
            </div>
            
            <div className="pt-2">
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Observaciones / Detalles adicionales</label>
              <textarea placeholder="Ej: Válido por 10 días. Entregas a domicilio..." value={formPresupuesto.notas} onChange={(e) => setFormPresupuesto({...formPresupuesto, notas: e.target.value})} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-500 h-16 resize-none"/>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={cancelarEdicionPresupuesto}
                className="w-full bg-white border border-red-200 text-red-700 hover:bg-red-50 font-black text-sm py-3.5 rounded-xl shadow-sm transition-transform active:scale-95 uppercase tracking-wide"
              >
                Cancelar
              </button>
              <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black text-sm py-3.5 rounded-xl shadow-sm transition-transform active:scale-95 uppercase tracking-wide">
                {formPresupuesto.id ? 'ACTUALIZAR PRESUPUESTO' : 'GUARDAR PRESUPUESTO'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal IMPRIMIR PRESUPUESTO (Ocupa toda la pantalla al imprimir) */}
      {modalActivo === 'imprimir_presupuesto' && presupuestoAImprimir && (
        <div className="print-modal-root fixed inset-0 bg-gray-100 z-50 overflow-y-auto flex justify-center py-10 print:p-0 print:bg-white custom-scrollbar">
          
          <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
            <button onClick={imprimirReporte} className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2"><Printer size={20}/> Imprimir</button>
            <button onClick={descargarPdfVistaImpresion} disabled={descargandoPdfVistaImpresion} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2"><Download size={20}/>{descargandoPdfVistaImpresion ? 'Generando...' : 'Descargar PDF'}</button>
            <button onClick={() => { setModalActivo(null); setPresupuestoAImprimir(null); setIncluirImagenesPdf(false); setIncluirLogoMarcaPresupuestoPdf(true); setSoloPreciosPorItemPresupuestoPdf(false); }} className="bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 p-3 rounded-full shadow-lg"><X size={24}/></button>
          </div>

          <div className="print-modal-pages w-full max-w-[210mm] space-y-6 print:space-y-0">
            {(paginasPresupuestoImpresion.length ? paginasPresupuestoImpresion : [{ items: [], esPrimera: true, esFinal: true, pagina: 1, totalPaginas: 1 }]).map((pagina) => (
              <div key={`presupuesto-${pagina.pagina}`} className="print-a4-sheet box-border bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none p-6 sm:p-8 text-black font-sans relative">
                {pagina.esPrimera && (
                  <>
                    <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
                      <div className="flex flex-col items-start justify-center min-h-[56px] max-w-[60%]">
                        {obtenerLogoEmpresaPresupuesto(presupuestoAImprimir) ? (
                          <img src={obtenerLogoEmpresaPresupuesto(presupuestoAImprimir)} alt="Logo" className="w-52 max-h-20 object-contain" />
                        ) : (
                          <p className="text-lg font-black text-gray-900 uppercase leading-tight">{obtenerNombreEmpresaPresupuesto(presupuestoAImprimir)}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] font-semibold text-gray-500 leading-tight">
                          {contactoNegocioCabeceraPresupuesto.map((item, index) => (
                            <span key={`contacto-presupuesto-${index}`} className="whitespace-nowrap">
                              {item.etiqueta ? <span className="font-black text-gray-700">{item.etiqueta}:</span> : null}
                              {item.etiqueta ? ' ' : ''}
                              {item.valor}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <h2 className="text-2xl font-black text-gray-300 tracking-widest mb-0.5">PRESUPUESTO</h2>
                        <p className="font-black text-sm">{obtenerNumeroPresupuestoTexto(presupuestoAImprimir)}</p>
                        <p className="font-bold text-sm">FECHA: {formatearFecha(presupuestoAImprimir.fecha)}</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Pág.: {pagina.pagina}/{pagina.totalPaginas}</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg mb-4">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Presupuestado a nombre de:</p>
                      <p className="text-lg font-black text-gray-900 uppercase">{presupuestoAImprimir.clienteNombre}</p>
                      {presupuestoAImprimir.whatsapp && <p className="text-xs font-bold text-gray-600 mt-0.5">Tel/WhatsApp: {presupuestoAImprimir.whatsapp}</p>}
                    </div>
                  </>
                )}

                <table className={`w-full text-[12px] ${pagina.esFinal ? 'mb-4' : 'mb-2'} border-collapse table-fixed`}>
                  <thead className="bg-gray-800 text-white font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-1.5 px-1.5 text-left w-[9%]">Cód.</th>
                      {incluirImagenesPdf && <th className="py-1.5 px-1.5 text-center w-[12%]">Imagen</th>}
                      <th className="py-1.5 px-1.5 text-left">Descripción del Producto/Servicio</th>
                      {!soloPreciosPorItemPresupuestoImpresion && <th className="py-1.5 px-1.5 text-center w-[8%]">Cant.</th>}
                      {!soloPreciosPorItemPresupuestoImpresion && <th className="py-1.5 px-1.5 text-center w-[8%]">Unid.</th>}
                      <th className="py-1.5 px-1.5 text-right w-[11%]">Precio U.</th>
                      {mostrarDescuentoItemEnPdf && <th className="py-1.5 px-1.5 text-center w-[7%]">Desc.%</th>}
                      {!soloPreciosPorItemPresupuestoImpresion && <th className="py-1.5 px-1.5 text-right w-[13%]">Subtotal</th>}
                    </tr>
                  </thead>
                  <tbody className="border-b-2 border-gray-800">
                    {pagina.items.map((item, i) => {
                      const imagenItem = incluirImagenesPdf ? obtenerImagenItemPresupuesto(item) : '';
                      const logoMarcaItem = incluirLogoMarcaPresupuestoPdf ? obtenerLogoMarcaItem(item) : '';
                      return (
                        <tr key={`${pagina.pagina}-${i}`} className="border-b border-gray-200 print-no-break">
                          <td className="py-1.5 px-1.5 text-gray-500 text-[10px] align-top break-words">{item.codigo || '-'}</td>
                          {incluirImagenesPdf && (
                            <td className="py-1 px-1.5 align-top">
                              <div className="w-16 h-16 border border-gray-300 rounded-lg bg-white overflow-hidden flex items-center justify-center mx-auto relative">
                                {imagenItem ? (
                                  <img src={imagenItem} alt={item.descripcion || 'Producto'} className="w-full h-full object-contain" />
                                ) : (
                                  <span className="text-[9px] font-bold text-gray-400 uppercase">Sin foto</span>
                                )}
                                {logoMarcaItem && (
                                  <div className="absolute top-1 left-1 w-9 h-9 pointer-events-none">
                                    <img src={logoMarcaItem} alt="Logo marca" className="w-full h-full object-contain" />
                                  </div>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="py-1.5 px-1.5 font-bold text-[10px] whitespace-normal break-words align-top leading-tight">
                            {item.descripcion}
                          </td>
                          {!soloPreciosPorItemPresupuestoImpresion && <td className="py-1.5 px-1.5 text-center font-bold text-[10px] align-top">{item.cantidad}</td>}
                          {!soloPreciosPorItemPresupuestoImpresion && <td className="py-1.5 px-1.5 text-center text-[10px] uppercase align-top">{item.unidad}</td>}
                          <td className="py-1.5 px-1.5 text-right text-[10px] align-top">{formatearDinero(item.precio)}</td>
                          {mostrarDescuentoItemEnPdf && <td className="py-1.5 px-1.5 text-center font-bold text-[10px] align-top">{parseNumeroPresupuesto(item?.descuento) > 0 ? `${parseNumeroPresupuesto(item?.descuento)}%` : '-'}</td>}
                          {!soloPreciosPorItemPresupuestoImpresion && <td className="py-1.5 px-1.5 text-right font-black text-[10px] align-top">{formatearDinero(calcularTotalItemPresupuesto(item))}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {!pagina.esFinal ? (
                  <div className="mt-3 text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Continúa en la siguiente página</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mt-4 print:block">
                      <div className="w-full sm:w-1/2 sm:pr-6 print:w-full print:pr-0 print:mb-3">
                        {presupuestoAImprimir.notas && (
                          <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Observaciones / Detalles:</p><p className="text-[10px] text-gray-700 whitespace-pre-wrap border-l-4 border-gray-200 pl-3">{presupuestoAImprimir.notas}</p></div>
                        )}
                      </div>
                      {!soloPreciosPorItemPresupuestoImpresion && <div className="w-full sm:w-1/2 flex sm:justify-end print:w-full print:justify-start">
                        <div className="bg-gray-100 p-4 rounded-xl border-2 border-gray-800 w-full max-w-[330px] text-right print-no-break">
                          {resumenPresupuestoImpresion.descuentoItems > 0 && (
                            <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Descuento por Ítems: -{formatearDinero(resumenPresupuestoImpresion.descuentoItems)}</p>
                          )}
                          {resumenPresupuestoImpresion.descuentoGeneralMonto > 0 && (
                            <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Desc. General ({resumenPresupuestoImpresion.descuentoGeneralPct}%): -{formatearDinero(resumenPresupuestoImpresion.descuentoGeneralMonto)}</p>
                          )}
                          <p className="text-sm font-bold text-gray-600 uppercase tracking-widest mb-1">TOTAL PRESUPUESTO</p>
                          <p className="text-3xl font-black text-gray-900 tracking-tight">{formatearDinero(resumenPresupuestoImpresion.total)}</p>
                          <p className="text-[9px] font-bold text-gray-500 uppercase mt-1.5">{numeroALetras(resumenPresupuestoImpresion.total)}</p>
                        </div>
                      </div>}
                    </div>

                    <div className="mt-4 border-t border-gray-300 pt-3 text-center print-no-break">
                      <p className="text-[10px] text-gray-400">Emitido por: {usuarioActual.nombre}</p>
                      {pieEmpresaPresupuestoPdf && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{pieEmpresaPresupuestoPdf}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(modalActivo === 'venta' || modalActivo === 'gasto' || modalActivo === 'ingreso_extra' || modalActivo === 'retiro_caja') && (
        <Modal titulo={modalActivo === 'venta' ? 'Registrar Venta (Ingreso)' : (modalActivo === 'gasto' ? 'Registrar Gasto (Egreso)' : (modalActivo === 'retiro_caja' ? 'Retiro de Efectivo (Solo afecta caja física)' : 'Otro Ingreso'))} onClose={() => setModalActivo(null)}>
          <form onSubmit={(e) => registrarMovimiento(e, modalActivo)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Monto de la Operación</label>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl ${modalActivo === 'venta' ? 'text-green-500' : (modalActivo === 'ingreso_extra' ? 'text-teal-500' : (modalActivo === 'retiro_caja' ? 'text-orange-500' : 'text-red-500'))}`}>$</span>
                <input type="number" step="0.01" min="0.01" required value={formData.monto} onChange={(e) => setFormData({...formData, monto: e.target.value})} className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-0 outline-none text-3xl font-black tracking-tight ${modalActivo === 'venta' ? 'bg-green-50/50 border-green-200 text-green-700 focus:border-green-600' : (modalActivo === 'ingreso_extra' ? 'bg-teal-50/50 border-teal-200 text-teal-700 focus:border-teal-600' : (modalActivo === 'retiro_caja' ? 'bg-orange-50/50 border-orange-200 text-orange-700 focus:border-orange-600' : 'bg-red-50/50 border-red-200 text-red-700 focus:border-red-600'))}`} autoFocus/>
              </div>
              <div className={`text-[10px] font-bold mt-1 uppercase ${modalActivo === 'venta' ? 'text-green-700' : (modalActivo === 'ingreso_extra' ? 'text-teal-700' : (modalActivo === 'retiro_caja' ? 'text-orange-700' : 'text-red-700'))}`}>{numeroALetras(parseFloat(formData.monto) || 0)}</div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Descripción / Detalle</label>
              <input
                type="text"
                required
                list={modalActivo === 'venta' ? 'sf-descripciones-venta' : undefined}
                value={formData.descripcion}
                onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none font-bold text-sm"
                placeholder="Ej: Venta mercadería / Pago luz"
              />
              {modalActivo === 'venta' && (
                <>
                  <datalist id="sf-descripciones-venta">
                    {DESCRIPCIONES_VENTA_PREESTABLECIDAS.map((opcion) => (
                      <option key={`desc-venta-${opcion}`} value={opcion} />
                    ))}
                  </datalist>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DESCRIPCIONES_VENTA_PREESTABLECIDAS.map((opcion) => (
                      <button
                        key={`btn-desc-venta-${opcion}`}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, descripcion: opcion }))}
                        className={`px-3 py-1.5 rounded-lg border text-[11px] font-black uppercase tracking-wider transition-colors ${formData.descripcion === opcion ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {opcion}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Forma de Pago</label>
              {modalActivo !== 'retiro_caja' ? (
                <select value={formData.metodoPago} onChange={(e) => setFormData({...formData, metodoPago: e.target.value, detallesPago: {}})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:border-blue-600 outline-none font-bold text-sm text-gray-800 shadow-sm cursor-pointer hover:bg-gray-50">
                  <option value="efectivo">💵 Efectivo</option><option value="transferencia">🏦 Transferencia</option><option value="tarjeta">💳 Tarjeta</option><option value="cheque">📝 Cheque</option><option value="cuenta_corriente">📓 Cuenta Corriente (Fiado)</option>
                </select>
              ) : (
                <p className="font-bold text-gray-700 bg-gray-100 p-3 rounded-xl border border-gray-200">💵 Retiro exclusivo de EFECTIVO</p>
              )}
            </div>
            
            {formData.metodoPago === 'tarjeta' && renderBloqueTarjeta()}
            {formData.metodoPago === 'cheque' && renderBloqueCheque()}
            {formData.metodoPago === 'cuenta_corriente' && (
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                <p className="text-xs font-bold text-purple-800 uppercase flex items-center gap-1"><Users size={14}/> Datos del Cliente</p>
                {(() => {
                  const modoNuevoCliente = Boolean(formData.detallesPago?.nuevoClienteManual);
                  const clienteVinculado = formData.detallesPago?.clienteId
                    ? clientes.find((c) => c.id === formData.detallesPago.clienteId)
                    : null;
                  return (
                    <>
                      {!modoNuevoCliente ? (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">Buscar cliente registrado</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Nombre, ID, WhatsApp o documento"
                                value={formData.detallesPago.busquedaCliente || ''}
                                onChange={(e) => manejarBusquedaClienteCuentaCorriente(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"
                              />
                              <button
                                type="button"
                                onClick={activarNuevoClienteCuentaCorriente}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-3 rounded-lg flex items-center justify-center shadow-sm transition-colors"
                                title="Agregar cliente nuevo"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>

                          {clientesSugeridosCuentaCorriente.length > 0 && (
                            <div className="max-h-36 overflow-y-auto bg-white border border-purple-100 rounded-lg divide-y divide-purple-100">
                              {clientesSugeridosCuentaCorriente.map((c) => (
                                <button
                                  type="button"
                                  key={`cc-sugerencia-${c.id}`}
                                  onClick={() => seleccionarClienteCuentaCorriente(c)}
                                  className="w-full text-left px-3 py-2 hover:bg-purple-50 transition-colors"
                                >
                                  <p className="text-sm font-bold text-gray-900">{c.nombre}</p>
                                  <p className="text-[10px] font-bold text-gray-500">{obtenerNumeroClienteTexto(c)} {c.whatsapp ? `• ${c.whatsapp}` : ''}</p>
                                </button>
                              ))}
                            </div>
                          )}

                          {clienteVinculado ? (
                            <div className="bg-white border border-purple-200 rounded-lg px-3 py-2">
                              <p className="text-[10px] font-black text-purple-700 uppercase tracking-wider">Cliente seleccionado</p>
                              <p className="text-sm font-bold text-gray-900">{clienteVinculado.nombre}</p>
                              <p className="text-[11px] font-bold text-gray-500">{clienteVinculado.whatsapp || 'Sin WhatsApp'}</p>
                            </div>
                          ) : (
                            <p className="text-[11px] font-bold text-purple-700">Selecciona un cliente para evitar duplicados.</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-black text-purple-700 uppercase tracking-wider">Nuevo cliente</p>
                            <button
                              type="button"
                              onClick={volverBusquedaClienteCuentaCorriente}
                              className="text-[10px] font-bold uppercase tracking-wider text-purple-700 border border-purple-200 bg-white px-2.5 py-1 rounded-md hover:bg-purple-100 transition-colors"
                            >
                              Usar cliente existente
                            </button>
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="Nombre completo"
                            value={formData.detallesPago.cliente || ''}
                            onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, cliente: e.target.value } })}
                            className="w-full px-3 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"
                          />
                          <input
                            type="text"
                            placeholder="WhatsApp (Opcional)"
                            value={formData.detallesPago.whatsapp || ''}
                            onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, whatsapp: e.target.value } })}
                            className="w-full px-3 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            <button type="submit" className={`w-full font-bold text-base py-3 px-4 rounded-xl mt-6 text-white shadow-sm transition-transform active:scale-95 uppercase tracking-wide ${modalActivo === 'venta' ? 'bg-green-600 hover:bg-green-700' : (modalActivo === 'ingreso_extra' ? 'bg-teal-600 hover:bg-teal-700' : (modalActivo === 'retiro_caja' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'))}`}>GUARDAR OPERACIÓN</button>
          </form>
        </Modal>
      )}

      {modalActivo === 'editar_movimiento' && movimientoAEditar && (
        <Modal titulo="Corrección de Movimiento" onClose={() => { setModalActivo(null); setMovimientoAEditar(null); }}>
          <form onSubmit={guardarEdicionMovimiento} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Monto</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xl">$</span><input type="number" step="0.01" min="0.01" required value={formData.monto} onChange={(e) => setFormData({...formData, monto: e.target.value})} className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 outline-none text-2xl font-black" autoFocus/></div>
            </div>
            <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Descripción</label><input type="text" required value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-blue-600" /></div>
            
            {movimientoAEditar.tipo !== 'cobro' && movimientoAEditar.tipo !== 'retiro_caja' && (
              <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Método de Pago</label><select value={formData.metodoPago} onChange={(e) => setFormData({...formData, metodoPago: e.target.value, detallesPago: {}})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-blue-600 capitalize"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="cheque">Cheque</option><option value="cuenta_corriente">Cuenta Corriente</option></select></div>
            )}
            
            {formData.metodoPago === 'tarjeta' && renderBloqueTarjeta()}
            {formData.metodoPago === 'cheque' && renderBloqueCheque()}
            {formData.metodoPago === 'cuenta_corriente' && movimientoAEditar.tipo !== 'cobro' && (
               <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 space-y-2"><input type="text" placeholder="Nombre Cliente" required value={formData.detallesPago.cliente || ''} onChange={(e) => setFormData({...formData, detallesPago: {...formData.detallesPago, cliente: e.target.value}})} className="w-full px-3 py-2 bg-white rounded-lg text-sm font-bold border border-purple-100 outline-none"/></div>
            )}
            {movimientoAEditar.tipo === 'saldo_inicial_cc' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider leading-snug">Carga histórica: al guardar esta corrección no se vuelve a sumar ni restar el saldo del cliente.</p>
                <label className="block text-[10px] font-black text-amber-800 uppercase tracking-wider">Número de remito / comprobante</label>
                <input
                  type="text"
                  value={formData.detallesPago?.numeroComprobante || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    detallesPago: { ...formData.detallesPago, numeroComprobante: e.target.value }
                  })}
                  className="w-full px-3 py-2 bg-white rounded-lg text-sm font-bold border border-amber-200 outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Ej: 00012345"
                />
              </div>
            )}
            {esRecargoMoraMovimiento(movimientoAEditar) && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
                <label className="block text-[10px] font-black text-orange-800 uppercase tracking-wider">Porcentaje aplicado</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.detallesPago?.porcentaje ?? ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      detallesPago: { ...formData.detallesPago, porcentaje: e.target.value }
                    })}
                    className="w-full px-3 pr-8 py-2 bg-white rounded-lg text-sm font-bold border border-orange-200 outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ej: 10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-600 text-xs font-black">%</span>
                </div>
                <p className="text-[10px] font-bold text-orange-700">Puedes ajustar monto y porcentaje según corresponda.</p>
              </div>
            )}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 px-4 rounded-xl mt-4 flex justify-center items-center gap-2 uppercase tracking-wide"><Save size={18} /> GUARDAR CORRECCIÓN</button>
          </form>
        </Modal>
      )}

      {modalActivo === 'cerrar' && (
        <Modal titulo="Resumen de Turno" onClose={() => setModalActivo(null)}>
          <form onSubmit={cerrarCaja} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
              <div className="flex justify-between items-center"><span className="text-gray-600 font-bold text-xs uppercase">Fondo Inicial Billetes:</span><span className="font-black text-gray-900 text-sm">{formatearDinero(caja.efectivoInicial)}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-600 font-bold text-xs uppercase">Ingresos EFECTIVO (+):</span><span className="font-black text-green-600 text-sm">+{formatearDinero(totales.ingresosEfectivo)}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-600 font-bold text-xs uppercase">Egresos EFECTIVO (-):</span><span className="font-black text-red-600 text-sm">-{formatearDinero(totales.egresosEfectivo)}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-600 font-bold text-xs uppercase">Retiros EFECTIVO (-):</span><span className="font-black text-orange-600 text-sm">-{formatearDinero(totales.retirosEfectivo)}</span></div>
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-center"><span className="font-black text-gray-800 text-xs uppercase">Efectivo Esperado:</span><span className="text-xl font-black text-blue-600">{formatearDinero(saldoActual)}</span></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1 uppercase">Recuento de Billetes Real</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xl">$</span><input type="number" step="0.01" required value={montoCierreReal} onChange={(e) => setMontoCierreReal(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-2xl font-black outline-none focus:border-blue-600" placeholder="0.00" /></div>
            </div>
            {montoCierreReal !== '' && (
              <div className={`p-3 rounded-xl flex items-center gap-3 border ${parseFloat(montoCierreReal) === saldoActual ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <AlertCircle size={20} className="shrink-0" />
                <div>
                  {parseFloat(montoCierreReal) === saldoActual ? <p className="font-black text-sm">¡CIERRE PERFECTO!</p> : <><p className="font-black text-sm">DIFERENCIA: {formatearDinero(Math.abs(parseFloat(montoCierreReal) - saldoActual))}</p></>}
                </div>
              </div>
            )}
            <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 px-4 rounded-xl mt-4 flex justify-center items-center gap-2 text-sm uppercase tracking-wide"><Lock size={18} /> FINALIZAR TURNO AHORA</button>
          </form>
        </Modal>
      )}

      {modalActivo === 'usuario_form' && (
        <Modal
          titulo={usuarioAEditar ? 'Editar Usuario' : 'Nuevo Usuario'}
          onClose={() => {
            setModalActivo(null);
            setUsuarioAEditar(null);
            setFormUsuario(FORM_USUARIO_VACIO);
          }}
        >
          <form onSubmit={guardarUsuario} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Nombre completo</label>
              <input
                type="text"
                required
                value={formUsuario.nombre}
                onChange={(e) => setFormUsuario({ ...formUsuario, nombre: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-600"
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Usuario</label>
              <input
                type="text"
                required
                autoCapitalize="off"
                autoCorrect="off"
                value={formUsuario.username}
                onChange={(e) => setFormUsuario({ ...formUsuario, username: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-600"
                placeholder="Ej: admin"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Contraseña</label>
              <input
                type="text"
                required
                value={formUsuario.password}
                onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-600"
                placeholder="Contraseña de acceso"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Nivel de acceso</label>
              <select
                value={formUsuario.rol}
                onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-600"
              >
                <option value="cajero">Cajero</option>
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            {formUsuario.rol === 'cajero' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formUsuario.puedeVerClientesEspeciales)}
                    onChange={(e) => setFormUsuario({ ...formUsuario, puedeVerClientesEspeciales: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-amber-800 leading-relaxed">
                    Permitir ver cuentas corrientes y saldos de clientes marcados como "Cliente Especial".
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formUsuario.puedeUsarCombos)}
                    onChange={(e) => setFormUsuario({ ...formUsuario, puedeUsarCombos: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-indigo-800 leading-relaxed">
                    Permitir acceso a "Presupuesto Combo".
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formUsuario.puedeCargarCuentaHistorica)}
                    onChange={(e) => setFormUsuario({ ...formUsuario, puedeCargarCuentaHistorica: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-amber-800 leading-relaxed">
                    Permitir cargar cuenta corriente histórica (clientes existentes o nuevos).
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-slate-800 hover:bg-black text-white font-bold py-3 rounded-xl text-sm uppercase tracking-wider transition-all active:scale-95"
            >
              {usuarioAEditar ? 'Guardar Cambios' : 'Crear Usuario'}
            </button>
          </form>
        </Modal>
      )}

      {modalActivo === 'cliente_form' && (
        <Modal
          titulo={clienteAEditar ? 'Editar Cliente' : 'Nuevo Cliente'}
          onClose={() => {
            setModalActivo(null);
            setClienteAEditar(null);
            setFormCliente(formularioClienteVacio);
          }}
          customWidth="max-w-2xl"
        >
          <form onSubmit={guardarCliente} className="space-y-4">
            {clienteAEditar && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Identificador de cliente</span>
                <span className="text-xs font-black text-purple-800 tracking-widest">{obtenerNumeroClienteTexto(clienteAEditar)}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Nombre completo</label>
              <input
                type="text"
                required
                value={formCliente.nombre}
                onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600"
                placeholder="Ej: Juan Pérez / Empresa XYZ"
              />
            </div>

            {(usuarioActual?.rol || '').toLowerCase() === 'admin' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formCliente.esEspecial)}
                    onChange={(e) => setFormCliente({ ...formCliente, esEspecial: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                    Cliente Especial
                  </span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">WhatsApp</label>
                <input
                  type="text"
                  value={formCliente.whatsapp}
                  onChange={(e) => setFormCliente({ ...formCliente, whatsapp: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="Ej: +54 9 3624..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">DNI / CUIT / CUIL</label>
                <input
                  type="text"
                  value={formCliente.documento}
                  onChange={(e) => setFormCliente({ ...formCliente, documento: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="Ej: 30-12345678-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={formCliente.email}
                  onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="Ej: compras@cliente.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Dirección</label>
                <input
                  type="text"
                  value={formCliente.direccion}
                  onChange={(e) => setFormCliente({ ...formCliente, direccion: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="Ej: Av. Sarmiento 123"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Notas</label>
              <textarea
                rows={3}
                value={formCliente.notas}
                onChange={(e) => setFormCliente({ ...formCliente, notas: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 resize-none"
                placeholder="Observaciones internas del cliente (opcional)"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl text-sm uppercase tracking-wider transition-all active:scale-95"
            >
              {clienteAEditar ? 'Guardar Cambios del Cliente' : 'Crear Cliente'}
            </button>
          </form>
        </Modal>
      )}

      {modalActivo === 'cliente_detalle' && clienteSeleccionado && puedeVerClienteEnCuentas(clienteSeleccionado) && (
        <Modal
          titulo="Cuenta Corriente del Cliente"
          onClose={() => { setReciboCobroSeleccionado(null); setModalActivo(null); setClienteSeleccionado(null); }}
          customWidth="max-w-3xl"
        >
          <div className="space-y-4">
            {(() => {
              const estado = estadoCuentaClientes[clienteSeleccionado.id] || {};
              const semaforo = obtenerSemaforoEstadoCuenta(estado);
              const saldoClass = semaforo.saldoClass;
              const estadoTexto = semaforo.estadoTexto;
              const estadoBadgeClass = semaforo.badgeClass;
              const puedeAbonar = Boolean(estado.tieneDeuda || (clienteSeleccionado.saldo || 0) > 0);
              const saldoPendiente = Math.max(0, Number(estado.saldoPendiente || saldoPendienteClienteSeleccionado || 0));
              const recordatorios = Number(clienteSeleccionado.recordatoriosWhatsappEnviados || 0);
              return (
              <>
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black text-purple-700 uppercase tracking-wider">{obtenerNumeroClienteTexto(clienteSeleccionado)}</p>
                  <p className="text-xl font-black text-gray-900 leading-tight">{clienteSeleccionado.nombre}</p>
                  <p className="text-xs font-bold text-gray-600 mt-1">{clienteSeleccionado.whatsapp || 'Sin WhatsApp registrado'}</p>
                </div>
                <div className="text-left sm:text-right bg-white border border-purple-200 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{estado.tieneDeuda ? 'Saldo actual' : 'Estado de cuenta'}</p>
                  {!estado.tieneDeuda ? (
                    <p className="text-base font-black tracking-tight text-green-700">Al día sin saldo</p>
                  ) : (
                    <>
                      <p className={`text-2xl font-black tracking-tight ${saldoClass}`}>{formatearDinero(saldoPendiente)}</p>
                      <p className={`mt-1 inline-flex px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${estadoBadgeClass}`}>{estadoTexto}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => abrirFormularioCliente(clienteSeleccionado)}
                  className="bg-white border border-purple-200 text-purple-700 hover:bg-purple-100 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all"
                >
                  <Edit2 size={14} /> Editar Cliente
                </button>
                <button
                  onClick={() => enviarRecordatorioCliente(clienteSeleccionado, estado)}
                  disabled={!estado.tieneDeuda}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-500 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all"
                >
                  <Send size={14} /> Recordatorio ({recordatorios})
                </button>
                <button
                  disabled={!puedeAbonar}
                  onClick={() => abrirCobroCliente(clienteSeleccionado)}
                  className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all"
                >
                  <ArrowRight size={14} /> Registrar Cobro
                </button>
                {(usuarioActual?.rol || '').toLowerCase() === 'admin' && (
                  <button
                    onClick={() => abrirRecargosCliente(clienteSeleccionado)}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all"
                  >
                    <AlertCircle size={14} /> Recargos
                  </button>
                )}
              </div>
            </div>
              </>
              );
            })()}

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Historial de la Cuenta</h4>
              </div>
              {movimientosClienteSeleccionadoVisibles.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Clock size={30} className="mx-auto mb-2 opacity-40" />
                  <p className="font-bold text-sm text-gray-500">Este cliente todavía no tiene movimientos en cuenta corriente.</p>
                </div>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100">
                  {movimientosClienteSeleccionadoVisibles.map((mov) => {
                    const esCobro = mov.tipo === 'cobro';
                    const esCargo = esMovimientoCargoCuentaCorriente(mov);
                    const esCargaHistorica = mov.tipo === 'saldo_inicial_cc';
                    const esRecargo = esRecargoMoraMovimiento(mov);
                    const pendienteTicket = esCargo ? (pendientePorCargoIdSeleccionado[mov.id] ?? 0) : 0;
                    const cargoProcesado = esCargo ? (cargoProcesadoPorIdSeleccionado[mov.id] || null) : null;
                    const recargoTicket = Number(cargoProcesado?.recargoMora || 0);
                    const tipoAbonoCobro = esCobro && mov.detallesPago?.tipoAbono === 'ticket' ? 'ticket' : 'general';
                    const ticketRelacionado = esCobro && mov.detallesPago?.movimientoRelacionadoId
                      ? (estadoCuentaClienteSeleccionado.cargosProcesados || []).find((cargo) => cargo.id === mov.detallesPago.movimientoRelacionadoId)
                      : null;
                    const fechaMovimiento = new Date(mov.fecha);
                    const diasDesdeMovimiento = Number.isNaN(fechaMovimiento.getTime())
                      ? null
                      : Math.max(0, Math.floor((Date.now() - fechaMovimiento.getTime()) / MS_POR_DIA));
                    const semaforoTicket = obtenerSemaforoDiasTicket(diasDesdeMovimiento);
                    const pendienteClase = pendienteTicket > 0 ? semaforoTicket.textoClass : 'text-green-600';
                    const resumenReciboCobro = esCobro ? construirResumenReciboCobro(mov) : null;
                    const esAdminHistorial = (usuarioActual?.rol || '').toLowerCase() === 'admin';
                    const etiquetaEdicionCargo = esRecargo ? 'Editar recargo' : 'Editar remito';
                    const etiquetaEliminacionCargo = esRecargo ? 'Eliminar recargo' : 'Eliminar remito';
                    return (
                      <div key={mov.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${esCobro ? 'bg-purple-50 text-purple-700 border-purple-200' : (esRecargo ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-amber-50 text-amber-700 border-amber-200')}`}>
                              {esCobro ? 'Pago recibido' : (esRecargo ? 'Recargo de mora' : (esCargaHistorica ? 'Carga histórica' : (esCargo ? 'Venta a crédito' : mov.tipo)))}
                            </span>
                            <span className="text-[10px] font-bold text-gray-500">{esCobro ? 'Fecha de cobro registrado:' : (esCargaHistorica ? 'Fecha del comprobante:' : 'Fecha de la venta:')} {formatearFecha(mov.fecha)} {formatearHora(mov.fecha)}</span>
                            {esCargo && pendienteTicket > 0.009 && diasDesdeMovimiento !== null && (
                              <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-md ${semaforoTicket.badgeClass}`}>
                                {semaforoTicket.texto}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-gray-900 mt-1">{mov.descripcion || 'Movimiento de cuenta corriente'}</p>
                          {esCargaHistorica && (
                            <p className="text-[11px] font-bold text-amber-700 mt-0.5">
                              {obtenerEtiquetaTipoComprobanteHistorico(mov.detallesPago?.tipoComprobante)}
                              {mov.detallesPago?.numeroComprobante ? ` Nº ${mov.detallesPago.numeroComprobante}` : ''} • Origen histórico
                            </p>
                          )}
                          {esCargo && !esRecargo && recargoTicket > 0 && (
                            <p className="text-[11px] font-bold text-orange-700 mt-0.5">
                              Recargo por mora aplicado: +{formatearDinero(recargoTicket)}
                            </p>
                          )}
                          {esRecargo && (
                            <p className="text-[11px] font-bold text-orange-700 mt-0.5">
                              {mov.detallesPago?.origenRecargo === 'automatico' ? 'Automático' : 'Manual'} • {Number(mov.detallesPago?.porcentaje || 0)}%
                            </p>
                          )}
                          <p className="text-[11px] font-bold text-gray-500 capitalize mt-0.5">Medio: {(mov.metodoPago || 'sin dato').replace('_', ' ')}</p>
                          {esCobro && (
                            <p className="text-[11px] font-bold text-gray-500 mt-0.5">
                              {tipoAbonoCobro === 'ticket'
                                ? `Aplicado a ticket: ${ticketRelacionado?.descripcion || formatearFecha(ticketRelacionado?.fecha || mov.fecha)}`
                                : 'Aplicado como abono general a la deuda'}
                            </p>
                          )}
                          {esCobro && resumenReciboCobro && (
                            <p className="text-[11px] font-bold text-purple-700 mt-0.5">
                              Recibo: {resumenReciboCobro.numeroRecibo}
                            </p>
                          )}
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{esCobro ? 'Monto cobrado' : 'Pendiente de este ticket'}</p>
                          <p className={`text-base font-black ${esCobro ? 'text-green-600' : pendienteClase}`}>
                            {esCobro ? `-${formatearDinero(Math.abs(mov.monto || 0))}` : formatearDinero(Math.max(0, pendienteTicket))}
                          </p>
                          {esCargo && (
                            <p className={`text-[10px] font-black uppercase tracking-wider ${pendienteTicket > 0 ? pendienteClase : 'text-green-600'}`}>
                              {pendienteTicket > 0 ? `Impago (${semaforoTicket.texto})` : 'Saldado'}
                            </p>
                          )}
                          {esCobro && (
                            <div className="mt-2 flex items-center justify-start sm:justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => abrirReciboCobro(mov)}
                                className="px-2 py-1 rounded-md border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                                title="Ver recibo"
                              >
                                <FileText size={11} /> Recibo
                              </button>
                              <button
                                type="button"
                                onClick={() => descargarImagenReciboCobro(mov)}
                                className="p-1.5 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                                title="Descargar imagen del recibo"
                              >
                                <ImageIcon size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => enviarWhatsAppReciboCobro(mov)}
                                className="p-1.5 rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                                title="Enviar recibo por WhatsApp"
                              >
                                <Send size={12} />
                              </button>
                              {esAdminHistorial && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => iniciarEdicionMovimiento(mov)}
                                    className="p-1.5 rounded-md border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                                    title="Editar cobro"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => confirmarEliminacion(mov.id)}
                                    className="p-1.5 rounded-md border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                                    title="Eliminar cobro"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                          {esAdminHistorial && esCargo && !esCobro && !esCargaHistorica && (
                            <div className="mt-2 flex items-center justify-start sm:justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => iniciarEdicionMovimiento(mov)}
                                className="p-1.5 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                                title={etiquetaEdicionCargo}
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => confirmarEliminacion(mov.id)}
                                className="p-1.5 rounded-md border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                                title={etiquetaEliminacionCargo}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                          {esCargaHistorica && (
                            <div className="mt-2 flex items-center justify-start sm:justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => iniciarEdicionMovimiento(mov)}
                                className="p-1.5 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                                title="Editar carga histórica"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => confirmarEliminacion(mov.id)}
                                className="p-1.5 rounded-md border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                                title="Eliminar carga histórica"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {modalActivo === 'recibo_cobro' && reciboCobroSeleccionado?.resumen && (
        <Modal
          titulo="Recibo de Cobro"
          onClose={() => {
            setReciboCobroSeleccionado(null);
            setModalActivo(clienteSeleccionado ? 'cliente_detalle' : null);
          }}
          customWidth="max-w-5xl"
        >
          {(() => {
            const resumen = reciboCobroSeleccionado.resumen;
            const esAdmin = (usuarioActual?.rol || '').toLowerCase() === 'admin';
            const logoRecibo = LOGO_RECIBO_PREMIUM_URL;
            const contactoNegocioRecibo = obtenerContactoNegocio(configuracion);
            const estadoRecibo = resumen.saldoDespues > 0.009 ? 'Pago parcial' : 'Cuenta saldada';
            const metodoLabel = obtenerEtiquetaMetodoPago(resumen.metodoPago);
            const movimientoRecibo = reciboCobroSeleccionado.movimiento
              || (reciboCobroSeleccionado.movimientoId ? movimientos.find((mov) => mov.id === reciboCobroSeleccionado.movimientoId) : null);
            const usuarioEmisorRecibo = textoSeguroTrim(movimientoRecibo?.usuario, usuarioActual?.nombre || 'Sistema');
            const filasRecibo = Array.isArray(resumen.itemsAplicados) && resumen.itemsAplicados.length
              ? resumen.itemsAplicados
              : [{
                  cargoId: 'general',
                  fechaRemito: resumen.fechaPago,
                  numeroRemito: '-',
                  descripcion: 'Abono general de cuenta corriente',
                  pendienteAntes: resumen.saldoAntes,
                  aplicado: resumen.montoCobro,
                  pendienteDespues: resumen.saldoDespues
                }];
            const iconoMetodoAbonoRecibo = (() => {
              const key = normalizarMetodoPago(resumen.metodoPago);
              if (key === 'transferencia') return ArrowRight;
              if (key === 'cheque') return ClipboardList;
              if (key === 'tarjeta') return CreditCard;
              if (key === 'cuenta_corriente') return History;
              return Wallet;
            })();
            const metricasRecibo = [
              { titulo: 'Saldo anterior', valor: formatearDinero(resumen.saldoAntes), icono: Wallet, color: 'text-slate-900', bg: 'bg-emerald-50', iconoColor: 'text-slate-700' },
              { titulo: 'Abonado', valor: `- ${formatearDinero(resumen.montoCobro)}`, icono: iconoMetodoAbonoRecibo, color: 'text-emerald-600', bg: 'bg-emerald-50', iconoColor: 'text-emerald-600' },
              { titulo: 'Saldo actual', valor: formatearDinero(resumen.saldoDespues), icono: CheckCircle, color: resumen.saldoDespues > 0.009 ? 'text-orange-600' : 'text-emerald-600', bg: 'bg-emerald-50', iconoColor: resumen.saldoDespues > 0.009 ? 'text-orange-600' : 'text-slate-700' }
            ];
            const metadatosRecibo = [
              { icono: Wallet, label: 'Método', valor: metodoLabel },
              { icono: FileText, label: 'Aplicación', valor: resumen.tipoAbono === 'ticket' ? 'Ticket específico' : 'Abono general' },
              { icono: CheckCircle, label: 'Estado', valor: estadoRecibo }
            ];
            return (
              <div className="bg-[#f4f6f9] -m-4 sm:-m-5 p-4 sm:p-6 rounded-[28px] space-y-5">
                <div ref={reciboCobroPreviewRef} className="bg-white rounded-[28px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] overflow-hidden border border-slate-200/80">
                  <div className="bg-gradient-to-br from-[#071b35] via-[#0a2342] to-[#0b1f3c] px-5 sm:px-7 py-6 text-white relative">
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-300"></div>
                    <div className="grid grid-cols-1 xl:grid-cols-[1.22fr_0.78fr] gap-6 items-start">
                      <div className="space-y-4">
                        <div className="w-[320px] max-w-full h-[96px] sm:h-[112px] flex items-center justify-start">
                          <img src={logoRecibo} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.25)]" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-x-5 gap-y-3 max-w-3xl">
                          {[
                            { icono: MapPin, valor: contactoNegocioRecibo.direccion },
                            { icono: Globe, valor: contactoNegocioRecibo.web },
                            { icono: Phone, valor: contactoNegocioRecibo.whatsapp },
                            { icono: Mail, valor: contactoNegocioRecibo.correo }
                          ].filter((item) => item.valor).map(({ icono: Icono, valor }, index) => (
                            <div key={`header-contacto-${index}`} className="flex items-center gap-3 text-[13px] sm:text-[14px] text-slate-200 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-white/8 border border-white/15 flex items-center justify-center shrink-0">
                                <Icono size={16} className="text-white" />
                              </div>
                              <span className="font-medium tracking-[0.01em] leading-tight whitespace-nowrap truncate" title={valor}>{valor}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col items-end text-right xl:pl-8 min-w-0">
                        <p className="text-[11px] sm:text-[12px] font-black tracking-[0.14em] uppercase text-slate-200 whitespace-nowrap">Recibo de pago</p>
                        <p className="mt-1 text-[20px] sm:text-[24px] leading-none font-black text-emerald-400 whitespace-nowrap max-w-full">{resumen.numeroRecibo}</p>
                        <div className="mt-4 w-full max-w-[280px] space-y-2 text-[13px] sm:text-[14px] text-slate-200">
                          <div className="flex items-center justify-end gap-3">
                            <div className="w-9 h-9 rounded-full bg-white/8 border border-white/15 flex items-center justify-center shrink-0">
                              <Calendar size={16} className="text-white" />
                            </div>
                            <span className="leading-tight whitespace-nowrap">{formatearFecha(resumen.fechaPago)} {formatearHora(resumen.fechaPago)}</span>
                          </div>
                          <div className="flex items-center justify-end gap-3">
                            <div className="w-9 h-9 rounded-full bg-white/8 border border-white/15 flex items-center justify-center shrink-0">
                              <User size={16} className="text-white" />
                            </div>
                            <span className="leading-tight whitespace-nowrap">Emitido por: {usuarioEmisorRecibo}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 sm:p-7 space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.95fr] gap-5">
                      <div className="bg-white border border-slate-200 rounded-[24px] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                        <p className="text-emerald-600 text-[14px] font-black uppercase tracking-[0.16em]">Cliente</p>
                        <div className="mt-5 min-w-0">
                          <p className="text-[30px] leading-[1.05] font-black text-slate-900 break-words">{resumen.clienteNombre}</p>
                          <div className="mt-5 text-[18px] text-slate-700">
                            <span>WhatsApp: {resumen.clienteWhatsapp || 'Sin teléfono'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-6 text-white relative">
                          <div className="absolute right-5 top-5 w-16 h-16 rounded-full border border-white/15 bg-white/5 flex items-center justify-center">
                            <CheckCircle size={28} className="text-white/85" />
                          </div>
                          <p className="text-[15px] font-black uppercase tracking-[0.16em]">Total cobrado</p>
                          <p className="mt-4 text-[44px] leading-none font-black tracking-tight">{formatearDinero(resumen.montoCobro)}</p>
                        </div>
                        <div className="px-6 py-5 bg-white border-t border-slate-100">
                          <span className="inline-flex items-center gap-3 text-[28px] font-bold text-slate-800">
                            <span className="w-11 h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                              <CheckCircle size={24} />
                            </span>
                            {estadoRecibo}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                        {metricasRecibo.map(({ titulo, valor, icono: Icono, color, bg, iconoColor }, index) => (
                          <div key={`metrica-recibo-${index}`} className="px-5 py-4 flex items-center gap-4">
                            <div className={`w-16 h-16 rounded-full ${bg} flex items-center justify-center shrink-0`}>
                              <Icono size={index === 1 ? 26 : 28} className={iconoColor} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[12px] font-black uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">{titulo}</p>
                              <p className={`mt-1 text-[22px] md:text-[24px] leading-none font-black ${color} whitespace-nowrap`}>{valor}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="bg-gradient-to-r from-emerald-50 to-slate-50 px-5 py-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-[0.92fr_1.08fr_1fr] gap-2 md:gap-3 md:divide-x divide-slate-200">
                        {metadatosRecibo.map(({ icono: Icono, label, valor }, index) => (
                          <div key={`meta-recibo-${index}`} className="flex items-start gap-3 md:px-4 first:md:pl-0 last:md:pr-0 min-w-0">
                            <Icono size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                            <p className="text-[13px] md:text-[14px] leading-tight text-slate-800"><span className="font-black">{label}:</span> {valor}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-sm">
                          <thead className="bg-[#08172d] text-white">
                            <tr>
                              <th className="px-5 py-4 text-left font-black">Fecha</th>
                              <th className="px-5 py-4 text-left font-black">Remito N°</th>
                              <th className="px-5 py-4 text-left font-black">Detalle abonado</th>
                              <th className="px-5 py-4 text-right font-black">Pendiente antes</th>
                              <th className="px-5 py-4 text-right font-black">Abonado</th>
                              <th className="px-5 py-4 text-right font-black">Pendiente ahora</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {filasRecibo.map((item, index) => (
                              <tr key={`${item.cargoId || 'fila'}-${index}`} className="font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-4 whitespace-nowrap">{formatearFecha(item.fechaRemito || resumen.fechaPago)}</td>
                                <td className="px-5 py-4 whitespace-nowrap">{textoSeguroTrim(item.numeroRemito, '-')}</td>
                                <td className="px-5 py-4">{item.descripcion || 'Remito pendiente'}</td>
                                <td className="px-5 py-4 text-right whitespace-nowrap">{formatearDinero(Number(item.pendienteAntes || 0))}</td>
                                <td className="px-5 py-4 text-right whitespace-nowrap text-emerald-600 font-black">{formatearDinero(Number(item.aplicado || 0))}</td>
                                <td className={`px-5 py-4 text-right whitespace-nowrap font-black ${Number(item.pendienteDespues || 0) > 0.009 ? 'text-orange-600' : 'text-emerald-600'}`}>{formatearDinero(Number(item.pendienteDespues || 0))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[24px] shadow-[0_12px_30px_rgba(15,23,42,0.05)] grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] overflow-hidden">
                      <div className="px-6 py-6 flex items-center">
                        <p className="text-[20px] leading-snug text-slate-500">Recibo válido como constancia del pago registrado en cuenta corriente.</p>
                      </div>
                      <div className="px-6 py-6 border-t lg:border-t-0 lg:border-l border-slate-200 flex items-center justify-center">
                        <p className="text-center text-[54px] leading-none text-slate-800" style={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive' }}>Gracias por confiar</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={imprimirReporte}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5"
                  >
                    <Printer size={14} /> Imprimir previsualización
                  </button>
                  <button
                    type="button"
                    onClick={() => descargarImagenReciboCobro(movimientoRecibo)}
                    disabled={descargandoImagenReciboCobro}
                    className="bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5"
                  >
                    <ImageIcon size={14} /> {descargandoImagenReciboCobro ? 'Generando imagen' : 'Descargar imagen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => enviarWhatsAppReciboCobro(movimientoRecibo)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5"
                  >
                    <Send size={14} /> Enviar WhatsApp
                  </button>
                  {esAdmin && movimientoRecibo && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setReciboCobroSeleccionado(null); iniciarEdicionMovimiento(movimientoRecibo); }}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5"
                      >
                        <Edit2 size={14} /> Editar Cobro
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReciboCobroSeleccionado(null); confirmarEliminacion(movimientoRecibo.id); }}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5"
                      >
                        <Trash2 size={14} /> Eliminar Cobro
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {modalActivo === 'recargos_cliente' && clienteSeleccionado && (usuarioActual?.rol || '').toLowerCase() === 'admin' && (
        <Modal
          titulo="Recargos de Cuenta Corriente"
          onClose={() => { setModalActivo('cliente_detalle'); }}
          customWidth="max-w-3xl"
        >
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-black uppercase tracking-wider text-amber-800">Cliente</p>
              <p className="text-lg font-black text-gray-900">{clienteSeleccionado.nombre}</p>
              <p className="text-xs font-bold text-amber-700 mt-1">
                Automático: {Boolean(configuracion.recargosAutomaticosActivos) ? 'Activo' : 'Inactivo'} • {obtenerPorcentajeRecargoConfigurado(configuracion)}% cada 30 días
              </p>
              <p className="text-xs font-bold text-amber-700">
                Remitos vencidos (+30 días): {ticketsVencidosParaRecargoClienteSeleccionado.length}
              </p>
            </div>

            <form onSubmit={aplicarRecargoManualCliente} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Aplicar recargo manual</h4>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Remito objetivo</label>
                <select
                  value={formRecargoCliente.cargoId}
                  onChange={(e) => setFormRecargoCliente((prev) => ({ ...prev, cargoId: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Aplicar a todos los remitos vencidos</option>
                  {ticketsVencidosParaRecargoClienteSeleccionado.map((ticket) => (
                    <option key={`ticket-recargo-${ticket.id}`} value={ticket.id}>
                      {`${formatearFecha(ticket.fecha)} • ${ticket.descripcion || 'Remito'} • Pendiente ${formatearDinero(ticket.pendiente)}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Porcentaje</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formRecargoCliente.porcentaje}
                      onChange={(e) => setFormRecargoCliente((prev) => ({ ...prev, porcentaje: e.target.value }))}
                      className="w-full px-3 pr-8 py-2.5 bg-white border border-amber-300 rounded-xl text-sm font-black text-amber-800 outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Ej: 10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 font-black text-xs">%</span>
                  </div>
                </div>
                <button
                  type="submit"
                  className="h-11 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Aplicar
                </button>
                <button
                  type="button"
                  onClick={quitarTodosRecargosCliente}
                  className="h-11 px-4 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Quitar todos
                </button>
              </div>
            </form>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Registros de recargos (solo admin)</h4>
              </div>
              {recargosClienteSeleccionado.length === 0 ? (
                <div className="p-6 text-sm font-bold text-gray-500 text-center">Sin recargos aplicados.</div>
              ) : (
                <div className="max-h-[42vh] overflow-y-auto divide-y divide-gray-100">
                  {recargosClienteSeleccionado.map((recargo) => {
                    const pendienteRecargo = Math.max(0, Number(pendientePorCargoIdSeleccionado[recargo.id] ?? recargo.monto ?? 0));
                    const porcentaje = Number(recargo?.detallesPago?.porcentaje || 0);
                    const origen = recargo?.detallesPago?.origenRecargo === 'automatico' ? 'Automático' : 'Manual';
                    return (
                      <div key={`recargo-admin-${recargo.id}`} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-orange-700 uppercase tracking-wider">
                            {origen} • {porcentaje}%
                          </p>
                          <p className="text-sm font-bold text-gray-900">{recargo.descripcion || 'Recargo de mora'}</p>
                          <p className="text-[10px] font-bold text-gray-500">
                            {formatearFecha(recargo.fecha)} {formatearHora(recargo.fecha)} • Pendiente {formatearDinero(pendienteRecargo)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => ajustarPorcentajeRecargoCliente(recargo)}
                            className="p-1.5 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                            title="Editar porcentaje del recargo"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarRecargoCliente(recargo)}
                            className="p-1.5 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                            title="Eliminar recargo"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {modalActivo === 'cargar_cuenta_cliente' && puedeCargarCuentaHistorica && (
        <Modal
          titulo="Cargar Cuenta y Cliente (Histórico)"
          onClose={() => { setModalActivo(null); setFormCargaCuenta(crearFormularioCargaCuentaVacio()); }}
          customWidth="max-w-2xl"
        >
          <form onSubmit={guardarCargaCuentaCliente} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Importación histórica</p>
              <p className="text-xs font-bold text-amber-800 mt-1">
                Esta carga suma deuda en Cuentas Corrientes y reportes de clientes, pero no impacta la caja diaria ni el balance del turno.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
              <button
                type="button"
                onClick={volverBusquedaClienteCargaCuenta}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${formCargaCuenta.modoCliente === 'existente' ? 'bg-white text-purple-700 shadow-sm border border-purple-200' : 'text-gray-600 hover:text-gray-800'}`}
              >
                Cliente existente
              </button>
              <button
                type="button"
                onClick={activarNuevoClienteCargaCuenta}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${formCargaCuenta.modoCliente === 'nuevo' ? 'bg-white text-purple-700 shadow-sm border border-purple-200' : 'text-gray-600 hover:text-gray-800'}`}
              >
                Cliente nuevo
              </button>
            </div>

            {formCargaCuenta.modoCliente === 'existente' ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Buscar cliente</label>
                <input
                  type="text"
                  value={formCargaCuenta.busquedaCliente}
                  onChange={(e) => setFormCargaCuenta((prev) => ({ ...prev, busquedaCliente: e.target.value, clienteId: '' }))}
                  placeholder="Nombre, ID, teléfono, DNI o email"
                  className="w-full px-4 py-2.5 bg-white border border-purple-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                />
                {clientesSugeridosCargaCuenta.length > 0 && (
                  <div className="max-h-40 overflow-y-auto bg-white border border-purple-100 rounded-xl divide-y divide-purple-100">
                    {clientesSugeridosCargaCuenta.map((c) => (
                      <button
                        type="button"
                        key={`hist-cliente-${c.id}`}
                        onClick={() => seleccionarClienteCargaCuenta(c)}
                        className={`w-full text-left px-3 py-2 transition-colors ${formCargaCuenta.clienteId === c.id ? 'bg-purple-50' : 'hover:bg-purple-50/60'}`}
                      >
                        <p className="text-sm font-bold text-gray-900">{c.nombre}</p>
                        <p className="text-[10px] font-bold text-gray-500">{obtenerNumeroClienteTexto(c)} {c.documento ? `• ${c.documento}` : ''} {c.whatsapp ? `• ${c.whatsapp}` : ''}</p>
                      </button>
                    ))}
                  </div>
                )}
                {formCargaCuenta.clienteId && (
                  <p className="text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 w-max">
                    Cliente seleccionado: {clientes.find((c) => c.id === formCargaCuenta.clienteId)?.nombre || ''}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Nombre del cliente</label>
                  <input
                    type="text"
                    required
                    value={formCargaCuenta.nombreClienteNuevo}
                    onChange={(e) => setFormCargaCuenta((prev) => ({ ...prev, nombreClienteNuevo: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-purple-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ej: Empresa XYZ"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={formCargaCuenta.whatsapp}
                    onChange={(e) => setFormCargaCuenta((prev) => ({ ...prev, whatsapp: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="+54..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">DNI / CUIT / CUIL</label>
                  <input
                    type="text"
                    value={formCargaCuenta.documento}
                    onChange={(e) => setFormCargaCuenta((prev) => ({ ...prev, documento: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Opcional"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Comprobante</label>
                <select
                  value={formCargaCuenta.tipoComprobante}
                  onChange={(e) => setFormCargaCuenta((prev) => ({ ...prev, tipoComprobante: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {OPCIONES_COMPROBANTE_HISTORICO.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Número de comprobante</label>
                <input
                  type="text"
                  value={formCargaCuenta.numeroComprobante}
                  onChange={(e) => setFormCargaCuenta((prev) => ({ ...prev, numeroComprobante: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Saldo pendiente</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg">$</span>
                  <input
                    type="text"
                    required
                    value={formCargaCuenta.monto}
                    onChange={(e) => setFormCargaCuenta((prev) => ({ ...prev, monto: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ej: 150000 o 150.000,00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Fecha original</label>
                <input
                  type="date"
                  required
                  value={formCargaCuenta.fechaComprobante}
                  onChange={(e) => setFormCargaCuenta((prev) => ({ ...prev, fechaComprobante: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Detalle interno (opcional)</label>
              <input
                type="text"
                value={formCargaCuenta.descripcion}
                onChange={(e) => setFormCargaCuenta((prev) => ({ ...prev, descripcion: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ej: Saldo migrado desde sistema anterior"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setModalActivo(null); setFormCargaCuenta(crearFormularioCargaCuentaVacio()); }}
                className="w-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                Guardar carga histórica
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* COMPONENTES DE USUARIOS Y CONFIRMACIONES MANTENIDOS */}
      {modalActivo === 'cobro' && clienteSeleccionado && puedeVerClienteEnCuentas(clienteSeleccionado) && (
        <Modal titulo="Registrar Pago de Cliente" onClose={() => { setModalActivo(null); setClienteSeleccionado(null); }}>
          <form onSubmit={registrarCobro} className="space-y-4">
            <div className="bg-purple-600 p-4 rounded-2xl text-center text-white">
              <p className="text-purple-200 font-bold uppercase text-[10px] mb-0.5">Cobranza a:</p>
              <p className="text-xl font-black tracking-tight">{clienteSeleccionado.nombre}</p>
              <div className="inline-block bg-white/20 px-3 py-1 rounded-lg border border-white/30 mt-1.5"><p className="text-[10px] font-black uppercase tracking-wider">Deuda: {formatearDinero(saldoPendienteClienteSeleccionado)}</p></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1 uppercase">Tipo de Abono</label>
              <select
                value={formData.detallesPago?.tipoAbono || 'general'}
                onChange={(e) => {
                  const tipoAbono = e.target.value;
                  const primerTicket = ticketsPendientesParaCobroClienteSeleccionado[0];
                  const ticketActual = ticketsPendientesParaCobroClienteSeleccionado.find((t) => t.id === (formData.detallesPago?.movimientoRelacionadoId || ''));
                  const ticketParaMonto = tipoAbono === 'ticket' ? (ticketActual || primerTicket) : null;
                  setFormData({
                    ...formData,
                    monto: ticketParaMonto ? ticketParaMonto.pendiente.toFixed(2) : formData.monto,
                    detallesPago: {
                      ...formData.detallesPago,
                      tipoAbono,
                      movimientoRelacionadoId: tipoAbono === 'ticket' ? (ticketActual?.id || primerTicket?.id || '') : ''
                    }
                  });
                }}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="general">Abono General (a la deuda total)</option>
                <option value="ticket" disabled={ticketsPendientesParaCobroClienteSeleccionado.length === 0}>Abonar Ticket Impago</option>
              </select>
              {(formData.detallesPago?.tipoAbono || 'general') === 'ticket' && (
                <div className="mt-2">
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Ticket pendiente</label>
                  <select
                    value={formData.detallesPago?.movimientoRelacionadoId || ''}
                    onChange={(e) => {
                      const ticket = ticketsPendientesParaCobroClienteSeleccionado.find((t) => t.id === e.target.value);
                      setFormData({
                        ...formData,
                        monto: ticket ? ticket.pendiente.toFixed(2) : formData.monto,
                        detallesPago: { ...formData.detallesPago, movimientoRelacionadoId: e.target.value }
                      });
                    }}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {ticketsPendientesParaCobroClienteSeleccionado.map((ticket) => (
                      <option key={ticket.id} value={ticket.id}>
                        {`${formatearFecha(ticket.fecha)} • ${ticket.descripcion || 'Venta a crédito'} • Pendiente ${formatearDinero(ticket.pendiente)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1 uppercase">Monto que paga ahora</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xl">$</span><input type="number" step="0.01" min="0.01" max={(formData.detallesPago?.tipoAbono || 'general') === 'ticket' ? (ticketsPendientesParaCobroClienteSeleccionado.find((t) => t.id === formData.detallesPago?.movimientoRelacionadoId)?.pendiente || saldoPendienteClienteSeleccionado) : saldoPendienteClienteSeleccionado} required value={formData.monto} onChange={(e) => setFormData({...formData, monto: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-white border-2 border-purple-200 rounded-xl text-2xl font-black text-purple-700 outline-none focus:border-purple-600" autoFocus/></div>
              {(formData.detallesPago?.tipoAbono || 'general') === 'ticket' && (
                <p className="text-[10px] font-bold text-gray-500 mt-1">
                  Este pago se aplicará al ticket seleccionado. Puedes cobrar parcial o total.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1 uppercase">Forma de Pago del Cliente</label>
              <select value={formData.metodoPago} onChange={(e) => setFormData({...formData, metodoPago: e.target.value, detallesPago: { ...formData.detallesPago }})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-600">
                <option value="efectivo">💵 Efectivo Físico</option><option value="transferencia">🏦 Transferencia</option><option value="tarjeta">💳 Tarjeta</option><option value="cheque">📝 Cheque</option>
              </select>
            </div>
            
            {formData.metodoPago === 'tarjeta' && renderBloqueTarjeta()}
            {formData.metodoPago === 'cheque' && renderBloqueCheque()}
            
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm py-3 px-4 rounded-xl mt-4 flex items-center justify-center gap-2 uppercase tracking-wide"><ArrowRight size={18}/> CONFIRMAR COBRO</button>
          </form>
        </Modal>
      )}

      {dialogoSistema && (
        <Modal
          titulo={dialogoSistema.titulo || (dialogoSistema.confirmar ? 'Confirmación' : 'Notificación')}
          onClose={() => resolverDialogoSistema(dialogoSistema.prompt ? null : !dialogoSistema.confirmar)}
          customWidth="max-w-md"
        >
          {(() => {
            const tipo = dialogoSistema.tipo || 'info';
            const tipoVisual = tipo === 'danger' ? 'error' : tipo;
            const mapa = {
              info: {
                icono: <FileText size={20} />,
                caja: 'bg-blue-50 border-blue-200',
                iconoCaja: 'bg-blue-100 text-blue-700',
                texto: 'text-blue-900',
                aceptar: 'bg-blue-600 hover:bg-blue-700'
              },
              success: {
                icono: <CheckCircle size={20} />,
                caja: 'bg-emerald-50 border-emerald-200',
                iconoCaja: 'bg-emerald-100 text-emerald-700',
                texto: 'text-emerald-900',
                aceptar: 'bg-emerald-600 hover:bg-emerald-700'
              },
              warning: {
                icono: <AlertCircle size={20} />,
                caja: 'bg-amber-50 border-amber-200',
                iconoCaja: 'bg-amber-100 text-amber-700',
                texto: 'text-amber-900',
                aceptar: 'bg-amber-600 hover:bg-amber-700'
              },
              error: {
                icono: <XCircle size={20} />,
                caja: 'bg-red-50 border-red-200',
                iconoCaja: 'bg-red-100 text-red-700',
                texto: 'text-red-900',
                aceptar: 'bg-red-600 hover:bg-red-700'
              }
            };
            const visual = mapa[tipoVisual] || mapa.info;
            return (
              <div className="space-y-4">
                <div className={`border rounded-2xl p-4 flex items-start gap-3 ${visual.caja}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${visual.iconoCaja}`}>
                    {visual.icono}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold leading-relaxed whitespace-pre-line ${visual.texto}`}>
                      {dialogoSistema.mensaje || ''}
                    </p>
                    {dialogoSistema.prompt && (
                      <div className="mt-3 space-y-1.5">
                        {dialogoSistema.inputLabel && (
                          <label className={`block text-[10px] font-black uppercase tracking-wider ${visual.texto}`}>
                            {dialogoSistema.inputLabel}
                          </label>
                        )}
                        <input
                          type={dialogoSistema.inputType || 'text'}
                          value={dialogoSistema.inputValue || ''}
                          autoFocus
                          onChange={(e) => setDialogoSistema((prev) => (
                            prev ? { ...prev, inputValue: e.target.value } : prev
                          ))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') resolverDialogoSistema(dialogoSistema.inputValue || '');
                          }}
                          placeholder={dialogoSistema.inputPlaceholder || ''}
                          className="w-full px-3 py-2.5 rounded-xl border border-white/70 bg-white text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {(dialogoSistema.confirmar || dialogoSistema.prompt) && (
                    <button
                      type="button"
                      onClick={() => resolverDialogoSistema(dialogoSistema.prompt ? null : false)}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 font-bold text-sm transition-colors"
                    >
                      {dialogoSistema.textoCancelar || 'Cancelar'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => resolverDialogoSistema(dialogoSistema.prompt ? (dialogoSistema.inputValue || '') : true)}
                    className={`px-4 py-2 rounded-xl text-white font-bold text-sm transition-colors ${visual.aceptar}`}
                  >
                    {dialogoSistema.textoAceptar || 'Aceptar'}
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {modalActivo === 'confirmar_eliminacion' && movimientoAEliminar && (
        <Modal titulo="Eliminar Registro" onClose={() => { setModalActivo(null); setMovimientoAEliminar(null); }}>
          <div className="space-y-4">
            <div className="bg-red-50 p-4 rounded-2xl border border-red-200 text-center"><Trash2 size={32} className="text-red-500 mx-auto mb-2" /><p className="text-red-800 font-bold text-sm">¿Borrar este movimiento permanentemente?</p></div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center"><p className="font-bold text-gray-600 text-sm">{movimientoAEliminar.descripcion}</p><p className="text-xl font-black mt-1 text-red-600">{formatearDinero(movimientoAEliminar.monto)}</p></div>
            <div className="flex gap-2">
              <button onClick={() => { setModalActivo(null); setMovimientoAEliminar(null); }} className="flex-1 bg-gray-100 font-bold py-3 rounded-xl text-sm uppercase">CANCELAR</button>
              <button onClick={ejecutarEliminacion} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl text-sm uppercase">SÍ, BORRAR</button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

const mountNode = (() => {
  const existing = document.getElementById('root');
  if (existing) return existing;

  const fallback = document.createElement('div');
  fallback.id = 'root';
  document.body.innerHTML = '';
  document.body.appendChild(fallback);
  return fallback;
})();

createRoot(mountNode).render(<App />);
