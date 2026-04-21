import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Wallet, TrendingUp, TrendingDown, Store, Plus, Minus, X, Lock, Unlock,
  Clock, FileText, AlertCircle, CreditCard, Users, Phone, ArrowRight, Edit2, 
  Trash2, Save, PlusCircle, Calendar, Filter, Printer, BarChart2, FileSpreadsheet, 
  LogOut, User, UserCog, UserPlus, ShieldCheck, Settings, Image as ImageIcon,
  Search, Loader2, ClipboardList, Send, FilePlus2, CheckCircle, XCircle, Package,
  Camera, ScanBarcode, ArrowDownCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- INTEGRACIÓN FIREBASE ---
import { auth, db } from './firebase-config.js';
import { signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { collection, doc, setDoc, onSnapshot, deleteDoc, updateDoc, addDoc } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

// --- FUNCIONES UTILITARIAS ---
const formatearDinero = (monto) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(monto);
const formatearHora = (fecha) => new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(fecha));
const formatearFecha = (fecha) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(fecha));

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

// --- COMPONENTES UI ---
const WidgetCard = ({ titulo, monto, icono: Icono, colorClase, subtitulo, onClick, activo, activeClass, printOculto }) => (
  <div onClick={onClick} className={`bg-white p-4 rounded-2xl shadow-sm border flex items-center justify-between transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''} ${activo ? (activeClass || 'ring-2 ring-blue-500 border-transparent') : 'border-gray-100'} ${printOculto ? 'print:hidden' : 'print:border-gray-300 print:shadow-none print:p-2'}`}>
    <div className="min-w-0 pr-2">
      <p className="text-sm font-medium text-gray-500 mb-1 truncate print:text-black">{titulo}</p>
      <h3 className={`text-xl sm:text-2xl font-bold truncate ${colorClase} print:text-black`}>{formatearDinero(monto)}</h3>
      {subtitulo && <p className="text-xs text-gray-400 mt-1 truncate print:text-black">{subtitulo}</p>}
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
  const [configuracion, setConfiguracion] = useState({ nombre: 'Mi Negocio', logo: '' });
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

  const [formData, setFormData] = useState({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} });
  const [montoCierreReal, setMontoCierreReal] = useState('');
  
  const [formUsuario, setFormUsuario] = useState({ nombre: '', username: '', password: '', rol: 'cajero' });
  const [usuarioAEditar, setUsuarioAEditar] = useState(null);
  
  const [formProducto, setFormProducto] = useState({ codigo: '', categoria: '', marca: '', descripcion: '', costo: '', ganancia: '', iva: '21', precio: '', unidad: 'unid', cantidad: '', imagen: '' });
  const [productoAEditar, setProductoAEditar] = useState(null);
  const [catalogoAImprimir, setCatalogoAImprimir] = useState(null);
  const [configExportInventario, setConfigExportInventario] = useState({ tipo: 'catalogo_pdf', alcance: 'general', categoria: '' });
  const [archivoImportacionInventario, setArchivoImportacionInventario] = useState(null);
  const [importandoInventario, setImportandoInventario] = useState(false);
  const [resumenImportacionInventario, setResumenImportacionInventario] = useState(null);

  const [filtroTipo, setFiltroTipo] = useState('todos'); 
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [reporteTipo, setReporteTipo] = useState('general'); 
  const [reporteTiempo, setReporteTiempo] = useState('todo'); 
  const [reporteMesSeleccionado, setReporteMesSeleccionado] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reporteFechaDesdeReporte, setReporteFechaDesdeReporte] = useState('');
  const [reporteFechaHastaReporte, setReporteFechaHastaReporte] = useState('');

  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [busquedaDirectorio, setBusquedaDirectorio] = useState('');
  const [busquedaInventario, setBusquedaInventario] = useState('');
  const [busquedaStockModal, setBusquedaStockModal] = useState('');

  const [formPresupuesto, setFormPresupuesto] = useState({
    id: null, esNuevoCliente: false, clienteId: '', clienteNombre: '', whatsapp: '', 
    items: [], notas: '', estado: 'borrador', descuentoGeneral: '', numero: null
  });
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState(null);
  const [presupuestoAImprimir, setPresupuestoAImprimir] = useState(null);
  const [incluirImagenesPdf, setIncluirImagenesPdf] = useState(false);
  const [itemIndexParaStock, setItemIndexParaStock] = useState(null);

  const html5QrCodeScannerRef = useRef(null);
  const migrandoNumerosPresupuestoRef = useRef(false);

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
        if(d.exists()) setConfiguracion(d.data());
        else setDoc(d.ref, { nombre: 'Mi Negocio', logo: '' });
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

    const unsubProductos = onSnapshot(collection(db, 'productos'), (snapshot) => {
        const loaded = []; snapshot.forEach(doc => loaded.push({ id: doc.id, ...doc.data() })); 
        loaded.sort((a, b) => a.descripcion.localeCompare(b.descripcion));
        setProductos(loaded);
        setIsDBReady(true); 
    }, (err) => { console.error(err); setIsDBReady(true); });

    return () => { unsubConfig(); unsubCaja(); unsubUsuarios(); unsubMovs(); unsubClientes(); unsubPresupuestos(); unsubProductos(); };
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
        alert('No se pudo abrir la cámara trasera. Verifica permisos de cámara y que el sitio esté en HTTPS.');
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
    return movimientos.filter(m => new Date(m.fecha) >= new Date(caja.fechaApertura));
  }, [movimientos, caja]);

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
    return movimientosDelTurno.filter(m => {
      const matchTipo = filtroTipo === 'todos' || m.tipo === filtroTipo;
      let matchFecha = true;
      if (fechaDesde || fechaHasta) {
        const mDate = new Date(m.fecha); mDate.setHours(0,0,0,0);
        if (fechaDesde) { const d = new Date(fechaDesde + 'T00:00:00'); if (mDate < d) matchFecha = false; }
        if (fechaHasta) { const h = new Date(fechaHasta + 'T00:00:00'); if (mDate > h) matchFecha = false; }
      }
      return matchTipo && matchFecha;
    });
  }, [movimientosDelTurno, filtroTipo, fechaDesde, fechaHasta]);

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

    const movsFiltrados = movimientos.filter(m => { const mDate = new Date(m.fecha); return mDate >= inicio && mDate <= fin; });
    
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
      if (m.metodoPago === 'efectivo') flujoEfectivo += m.monto * factor;
      if (m.metodoPago === 'transferencia') flujoTransferencia += m.monto * factor;
      if (m.metodoPago === 'tarjeta') flujoTarjeta += m.monto * factor;
      if (m.metodoPago === 'cheque') flujoCheque += m.monto * factor;
    });

    return { 
      movimientos: movsFiltrados, 
      ingresos: ingr, egresos: egr, cobros, retiros: retirosCaja, 
      neto: (ingr + cobros) - egr, // El retiro no resta de la ganancia neta
      flujoEfectivo, flujoTransferencia, flujoTarjeta, flujoCheque,
      inicio, fin 
    };
  }, [movimientos, reporteTiempo, reporteMesSeleccionado, reporteFechaDesdeReporte, reporteFechaHastaReporte]);

  const clientesVisualizados = useMemo(() => {
    if (!busquedaDirectorio.trim()) return clientes;
    const busquedaLower = busquedaDirectorio.toLowerCase();
    return clientes.filter(c => c.nombre.toLowerCase().includes(busquedaLower));
  }, [clientes, busquedaDirectorio]);

  const productosVisualizados = useMemo(() => {
    if (!busquedaInventario.trim()) return productos;
    const busquedaLower = busquedaInventario.toLowerCase();
    return productos.filter(
      p => p.descripcion.toLowerCase().includes(busquedaLower)
      || (p.codigo && p.codigo.toLowerCase().includes(busquedaLower))
      || (p.categoria && p.categoria.toLowerCase().includes(busquedaLower))
      || (p.marca && p.marca.toLowerCase().includes(busquedaLower))
    );
  }, [productos, busquedaInventario]);

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

  const cerrarSesion = () => { if (window.confirm("¿Estás seguro de que quieres cerrar sesión?")) setUsuarioActual(null); };

  const abrirCaja = async (e) => {
    e.preventDefault();
    const docRef = doc(db, 'sistema', 'caja');
    await updateDoc(docRef, { estado: 'abierta', efectivoInicial: parseFloat(formData.efectivo) || 0, chequesInicial: formData.tieneCheques ? (parseFloat(formData.cheques) || 0) : 0, fechaApertura: new Date().toISOString() });
    setFormData({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} }); setModalActivo(null);
  };

  const editarApertura = async (e) => {
    e.preventDefault();
    const docRef = doc(db, 'sistema', 'caja');
    await updateDoc(docRef, { efectivoInicial: parseFloat(formData.efectivo) || 0, chequesInicial: formData.tieneCheques ? (parseFloat(formData.cheques) || 0) : 0 });
    setFormData({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} }); setModalActivo(null);
  };

  const cerrarCaja = async (e) => { 
    e.preventDefault(); 
    const docRef = doc(db, 'sistema', 'caja');
    await updateDoc(docRef, { estado: 'cerrada', fechaApertura: null });
    setMontoCierreReal(''); setModalActivo(null); setVista('caja'); 
  };

  const guardarConfiguracion = async (e) => {
    e.preventDefault();
    await setDoc(doc(db, 'sistema', 'configuracion'), configuracion);
    alert("Configuración guardada exitosamente");
  };

  const procesarLogoNegocio = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecciona un archivo de imagen válido (PNG o JPG).');
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

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setConfiguracion((prev) => ({ ...prev, logo: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const registrarMovimiento = async (e, tipo) => {
    e.preventDefault();
    const monto = parseFloat(formData.monto); if (!monto || monto <= 0) return;
    
    let defaultDesc = 'Movimiento general';
    if (tipo === 'venta') defaultDesc = 'Venta general';
    if (tipo === 'gasto') defaultDesc = 'Gasto general';
    if (tipo === 'ingreso_extra') defaultDesc = 'Ingreso / Aporte extra';
    if (tipo === 'retiro_caja') defaultDesc = 'Retiro de caja';
    
    if (formData.metodoPago === 'cuenta_corriente' && (tipo === 'venta' || tipo === 'ingreso_extra')) {
      const nombreCliente = formData.detallesPago.cliente?.trim() || 'Cliente sin nombre';
      const clienteExistente = clientes.find(c => c.nombre.toLowerCase() === nombreCliente.toLowerCase());
      if (clienteExistente) {
        await updateDoc(doc(db, 'clientes', clienteExistente.id), { saldo: clienteExistente.saldo + monto, whatsapp: formData.detallesPago.whatsapp || clienteExistente.whatsapp });
      } else {
        await addDoc(collection(db, 'clientes'), { nombre: nombreCliente, whatsapp: formData.detallesPago.whatsapp || '', saldo: monto });
      }
    }
    
    await addDoc(collection(db, 'movimientos'), {
      tipo, monto, descripcion: formData.descripcion || defaultDesc, metodoPago: formData.metodoPago, detallesPago: formData.detallesPago, fecha: new Date().toISOString(), usuario: usuarioActual.nombre
    });
    setFormData({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} }); setModalActivo(null);
  };

  const registrarCobro = async (e) => {
    e.preventDefault();
    const monto = parseFloat(formData.monto); if (!monto || monto <= 0) return;
    
    await updateDoc(doc(db, 'clientes', clienteSeleccionado.id), { saldo: clienteSeleccionado.saldo - monto });
    await addDoc(collection(db, 'movimientos'), {
      tipo: 'cobro', monto, descripcion: `Cobro de deuda a: ${clienteSeleccionado.nombre}`, metodoPago: formData.metodoPago, detallesPago: { ...formData.detallesPago, clienteId: clienteSeleccionado.id }, fecha: new Date().toISOString(), usuario: usuarioActual.nombre
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
    if ((mov.tipo === 'venta' || mov.tipo === 'ingreso_extra') && mov.metodoPago === 'cuenta_corriente') {
      const nombreCliente = mov.detallesPago?.cliente?.trim();
      const cliente = clientes.find(c => c.nombre.toLowerCase() === nombreCliente?.toLowerCase());
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
      detallesPago: mov.detallesPago || {}
    });
    setModalActivo('editar_movimiento');
  };

  const guardarEdicionMovimiento = async (e) => {
    e.preventDefault();
    const montoEditado = parseFloat(formData.monto);
    if (!montoEditado || montoEditado <= 0) return;
    
    const movOriginal = movimientos.find(m => m.id === movimientoAEditar.id);
    
    if (movOriginal.tipo === 'cobro' && movOriginal.detallesPago?.clienteId) {
        const cliente = clientes.find(c => c.id === movOriginal.detallesPago.clienteId);
        if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: cliente.saldo + movOriginal.monto });
    }
    if ((movOriginal.tipo === 'venta' || movOriginal.tipo === 'ingreso_extra') && movOriginal.metodoPago === 'cuenta_corriente') {
        const nombreCliente = movOriginal.detallesPago?.cliente?.trim();
        if (nombreCliente) {
            const cliente = clientes.find(c => c.nombre.toLowerCase() === nombreCliente.toLowerCase());
            if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: cliente.saldo - movOriginal.monto });
        }
    }

    if (movOriginal.tipo === 'cobro' && movOriginal.detallesPago?.clienteId) {
        const cliente = clientes.find(c => c.id === movOriginal.detallesPago.clienteId);
        if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: cliente.saldo - montoEditado });
    } else if ((movOriginal.tipo === 'venta' || movOriginal.tipo === 'ingreso_extra') && formData.metodoPago === 'cuenta_corriente') {
        const nombreNuevo = formData.detallesPago?.cliente?.trim() || 'Cliente sin nombre';
        const cliente = clientes.find(c => c.nombre.toLowerCase() === nombreNuevo.toLowerCase());
        if (cliente) {
            await updateDoc(doc(db, 'clientes', cliente.id), { saldo: cliente.saldo + montoEditado });
        } else {
            await addDoc(collection(db, 'clientes'), { nombre: nombreNuevo, whatsapp: formData.detallesPago?.whatsapp || '', saldo: montoEditado });
        }
    }

    await updateDoc(doc(db, 'movimientos', movimientoAEditar.id), {
        monto: montoEditado,
        descripcion: formData.descripcion,
        metodoPago: formData.metodoPago,
        detallesPago: formData.detallesPago
    });

    setModalActivo(null); setMovimientoAEditar(null); 
    setFormData({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} });
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    if (usuarioAEditar) {
      await updateDoc(doc(db, 'usuarios', usuarioAEditar.id), { ...formUsuario });
    } else {
      await addDoc(collection(db, 'usuarios'), { ...formUsuario });
    }
    setModalActivo(null); setFormUsuario({ nombre: '', username: '', password: '', rol: 'cajero' }); setUsuarioAEditar(null);
  };

  const eliminarUsuario = async (id) => {
    if (id === usuarioActual.id) { alert("No puedes eliminar tu propio usuario mientras estás conectado."); return; }
    if (window.confirm("¿Estás seguro de que deseas eliminar este usuario?")) {
      await deleteDoc(doc(db, 'usuarios', id));
    }
  };

  const buscarDatosCliente = async (e) => {
    e.preventDefault();
    const doc = formData.detallesPago.documento;
    if (!doc) return;
    setBuscandoCliente(true);
    setTimeout(() => {
      setFormData({
        ...formData, 
        detallesPago: { ...formData.detallesPago, cliente: `Cliente Registrado (DNI/CUIT: ${doc})` }
      });
      setBuscandoCliente(false);
    }, 1500);
  };

  const imprimirReporte = () => { window.print(); };

  // --- MANEJADORES DE INVENTARIO ---
  const calcularPrecioVenta = (costo, ganancia, iva) => {
    let c = parseFloat((costo||'').toString().replace(',', '.')) || 0;
    let g = parseFloat((ganancia||'').toString().replace(',', '.')) || 0;
    let i_val = 0;
    if (iva === '10.5') i_val = 0.105;
    if (iva === '21') i_val = 0.21;
    let p = c * (1 + (g / 100)) * (1 + i_val);
    return p > 0 ? p.toFixed(2) : '';
  };

  const procesarImagenProducto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setFormProducto({ ...formProducto, imagen: dataUrl });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    const data = {
      codigo: formProducto.codigo,
      categoria: (formProducto.categoria || '').trim(),
      marca: (formProducto.marca || '').trim(),
      descripcion: formProducto.descripcion,
      costo: parseFloat(formProducto.costo.toString().replace(',', '.')) || 0,
      ganancia: parseFloat(formProducto.ganancia?.toString().replace(',', '.')) || 0,
      iva: formProducto.iva,
      precio: parseFloat(formProducto.precio.toString().replace(',', '.')) || 0,
      unidad: formProducto.unidad,
      cantidad: parseFloat(formProducto.cantidad.toString().replace(',', '.')) || 0,
      imagen: formProducto.imagen || ''
    };

    if (productoAEditar) {
      await updateDoc(doc(db, 'productos', productoAEditar.id), data);
    } else {
      await addDoc(collection(db, 'productos'), data);
    }
    setModalActivo(null); setProductoAEditar(null);
    setFormProducto({ codigo: '', categoria: '', marca: '', descripcion: '', costo: '', ganancia: '', iva: '21', precio: '', unidad: 'unid', cantidad: '', imagen: '' });
  };

  const eliminarProducto = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este producto del inventario?")) {
      await deleteDoc(doc(db, 'productos', id));
    }
  };

  const obtenerCategoriaProducto = (producto) => (producto?.categoria || '').trim() || 'Sin categoría';

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
      alert('Selecciona primero un archivo Excel o CSV.');
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
        alert('El archivo no contiene filas para importar.');
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
      alert('No se pudo procesar el archivo. Revisa el formato y vuelve a intentar.');
    } finally {
      setImportandoInventario(false);
    }
  };

  const generarExportacionInventario = () => {
    const items = obtenerProductosExportacionInventario();
    if (!items.length) {
      alert('No hay productos para exportar con ese filtro.');
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
      grupos: agruparProductosPorCategoria(items)
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
      items: [...formPresupuesto.items, { id: Date.now(), codigo: '', descripcion: '', unidad: 'unid', precio: '', cantidad: 1, descuento: 0 }]
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
        imagen: prod.imagen || ''
      };
      setFormPresupuesto({ ...formPresupuesto, items: newItems });
      setModalActivo('nuevo_presupuesto'); 
      setItemIndexParaStock(null);
    }
  };

  const guardarPresupuesto = async (e) => {
    e.preventDefault();
    if (formPresupuesto.items.length === 0) { alert("Agrega al menos un producto al presupuesto."); return; }
    const itemsNormalizados = (formPresupuesto.items || []).map((item) => ({ ...item, descuento: parseNumeroPresupuesto(item?.descuento) }));
    const resumen = calcularResumenPresupuesto(itemsNormalizados, formPresupuesto.descuentoGeneral);
    const numeroPresupuesto = formPresupuesto.id
      ? (parseEnteroPresupuesto(formPresupuesto.numero) || parseEnteroPresupuesto(presupuestos.find((p) => p.id === formPresupuesto.id)?.numero) || obtenerSiguienteNumeroPresupuesto())
      : obtenerSiguienteNumeroPresupuesto();
    
    let cId = formPresupuesto.clienteId;
    let cNombre = formPresupuesto.clienteNombre;
    let cWpp = formPresupuesto.whatsapp;

    if (formPresupuesto.esNuevoCliente) {
      if (!cNombre.trim()) { alert("Ingresa el nombre del nuevo cliente."); return; }
      const docRef = await addDoc(collection(db, 'clientes'), { nombre: cNombre, whatsapp: cWpp, saldo: 0 });
      cId = docRef.id;
    } else {
      const clienteSeleccionado = clientes.find(c => c.id === cId);
      if (clienteSeleccionado) {
        cNombre = clienteSeleccionado.nombre;
        cWpp = clienteSeleccionado.whatsapp || cWpp;
      }
    }

    const data = {
      clienteId: cId, clienteNombre: cNombre, whatsapp: cWpp, items: itemsNormalizados, 
      descuentoGeneral: parseNumeroPresupuesto(formPresupuesto.descuentoGeneral),
      numero: numeroPresupuesto,
      total: resumen.total, estado: formPresupuesto.estado, notas: formPresupuesto.notas,
      fecha: formPresupuesto.id ? formPresupuesto.fecha : new Date().toISOString(), usuario: usuarioActual.nombre
    };

    if (formPresupuesto.id) {
      await updateDoc(doc(db, 'presupuestos', formPresupuesto.id), data);
    } else {
      await addDoc(collection(db, 'presupuestos'), data);
    }

    setModalActivo(null);
  };

  const eliminarPresupuesto = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este presupuesto permanentemente?")) {
      await deleteDoc(doc(db, 'presupuestos', id));
      setModalActivo(null);
      setPresupuestoSeleccionado(null);
    }
  };

  const normalizarTextoArchivo = (texto = '') =>
    (texto || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'archivo';

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

  const generarPdfPresupuestoFile = (p) => {
    const resumen = calcularResumenPresupuesto(p.items || [], p.descuentoGeneral || 0);
    const mostrarDesc = (p.items || []).some((item) => parseNumeroPresupuesto(item?.descuento) > 0);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const numeroPresupuesto = obtenerNumeroPresupuestoTexto(p);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text((configuracion.nombre || 'MI NEGOCIO').toUpperCase(), 14, 14);
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

    const columnas = ['Cód.', 'Descripción', 'Cant.', 'Unid.', 'Precio U.'];
    if (mostrarDesc) columnas.push('Desc.%');
    columnas.push('Subtotal');

    const idxSubtotal = mostrarDesc ? 6 : 5;
    const estilosColumnas = {
      0: { cellWidth: 18, halign: 'left' },
      1: { cellWidth: 68, halign: 'left' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      [idxSubtotal]: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    };
    if (mostrarDesc) estilosColumnas[5] = { cellWidth: 13, halign: 'center' };

    const body = (p.items || []).map((item) => {
      const fila = [
        item.codigo || '-',
        item.descripcion || '-',
        `${item.cantidad ?? '-'}`,
        (item.unidad || '').toUpperCase() || '-',
        formatearDinero(parseNumeroPresupuesto(item.precio))
      ];
      if (mostrarDesc) {
        fila.push(parseNumeroPresupuesto(item?.descuento) > 0 ? `${parseNumeroPresupuesto(item?.descuento)}%` : '-');
      }
      fila.push(formatearDinero(calcularTotalItemPresupuesto(item)));
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
    doc.text(`Emitido por: ${usuarioActual.nombre} • ${configuracion.nombre}`, 14, 291);

    const nroArchivo = normalizarTextoArchivo(numeroPresupuesto.replace(/^N°\s*/i, ''));
    const clienteArchivo = normalizarTextoArchivo(p.clienteNombre || 'cliente');
    const nombreArchivo = `presupuesto_${nroArchivo}_${clienteArchivo}.pdf`;
    const blob = doc.output('blob');
    return new File([blob], nombreArchivo, { type: 'application/pdf' });
  };

  const enviarWhatsAppPresupuesto = async (p) => {
    if (!p?.whatsapp) { alert("Este cliente no tiene un número de WhatsApp registrado."); return; }

    const numeroDestino = p.whatsapp.replace(/\D/g, '');
    const texto = `Hola ${p.clienteNombre},\nTe envío el presupuesto solicitado por un total de *${formatearDinero(p.total)}*.\n\nTe adjunto el documento PDF con todos los detalles y condiciones.\n\nQuedamos a tu disposición.\n${configuracion.nombre}`;
    let archivoPdf = null;

    try {
      archivoPdf = generarPdfPresupuestoFile(p);
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
      alert('Tu navegador no permite adjuntar PDF directo en WhatsApp Web. Se descargó el PDF para adjuntarlo manualmente en el chat.');
    } else {
      alert('No se pudo generar el PDF automáticamente. Se enviará el texto por WhatsApp.');
    }

    const url = `https://wa.me/${numeroDestino}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
    setModalActivo(null);
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

  const resumenPresupuestoImpresion = useMemo(() => {
    if (!presupuestoAImprimir) {
      return { subtotalBruto: 0, descuentoItems: 0, subtotalConDescuentos: 0, descuentoGeneralPct: 0, descuentoGeneralMonto: 0, total: 0 };
    }
    return calcularResumenPresupuesto(presupuestoAImprimir.items || [], presupuestoAImprimir.descuentoGeneral || 0);
  }, [presupuestoAImprimir]);

  const mostrarDescuentoItemEnPdf = useMemo(
    () => (presupuestoAImprimir?.items || []).some((item) => parseNumeroPresupuesto(item?.descuento) > 0),
    [presupuestoAImprimir]
  );

  const paginasCatalogoImpresion = useMemo(
    () => construirPaginasCatalogo(catalogoAImprimir?.grupos || []),
    [catalogoAImprimir]
  );


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
                <p className={`text-[10px] uppercase font-black tracking-wider ${usuarioActual.rol === 'admin' ? 'text-blue-600' : 'text-gray-500'}`}>{usuarioActual.rol}</p>
              </div>
              <button onClick={cerrarSesion} className="bg-white md:bg-gray-100 hover:bg-gray-200 text-gray-600 p-2.5 rounded-xl shadow-sm md:shadow-none transition-colors" title="Cerrar Sesión"><LogOut size={18} /></button>
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN (Pestañas) */}
        {puedeVerSistema && (
          <div className="max-w-6xl mx-auto px-4 pb-0 flex gap-2 sm:gap-6 overflow-x-auto border-t border-gray-100 mt-2 scrollbar-hide">
            <button onClick={() => setVista('caja')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'caja' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Wallet size={18}/> Caja Diaria</button>
            <button onClick={() => setVista('clientes')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'clientes' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Users size={18}/> Cuentas Corrientes</button>
            
            {usuarioActual.rol === 'admin' && (
              <>
                <button onClick={() => setVista('inventario')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'inventario' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Package size={18}/> Inventario</button>
                <button onClick={() => setVista('presupuestos')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'presupuestos' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><ClipboardList size={18}/> Presupuestos</button>
                <button onClick={() => setVista('reportes')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'reportes' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><BarChart2 size={18}/> Reportes</button>
                <div className="flex-1"></div> 
                <button onClick={() => setVista('usuarios')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'usuarios' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><UserCog size={18}/> Usuarios</button>
                <button onClick={() => setVista('configuracion')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'configuracion' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Settings size={18}/> Configuración</button>
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

        {caja.estado === 'cerrada' && vista !== 'caja' && usuarioActual.rol === 'admin' && vista !== 'configuracion' && (
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
                    <Calendar size={14} className="text-gray-400 shrink-0" /><span className="text-gray-500 font-bold hidden sm:inline text-xs uppercase">De:</span>
                    <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="outline-none bg-transparent text-gray-800 font-bold w-full text-xs"/>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all flex-1 md:flex-none">
                    <Calendar size={14} className="text-gray-400 shrink-0" /><span className="text-gray-500 font-bold hidden sm:inline text-xs uppercase">A:</span>
                    <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="outline-none bg-transparent text-gray-800 font-bold w-full text-xs"/>
                  </div>
                  {(fechaDesde || fechaHasta || filtroTipo !== 'todos') && (
                    <button onClick={() => { setFechaDesde(''); setFechaHasta(''); setFiltroTipo('todos'); }} className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-1 w-full md:w-auto text-xs uppercase"><X size={14} /> Limpiar</button>
                  )}
                </div>
              </div>
              
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {movimientosVisualizados.length === 0 ? (
                  <div className="p-16 text-center text-gray-400 flex flex-col items-center bg-gray-50/30"><Clock size={48} className="mb-4 opacity-30 text-gray-500" /><p className="font-bold text-lg text-gray-500">No hay movimientos registrados.</p><p className="text-sm mt-1">Realiza una venta o gasto para comenzar.</p></div>
                ) : (
                  movimientosVisualizados.map((mov) => {
                    const isRetiro = mov.tipo === 'retiro_caja';
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
        {puedeVerSistema && vista === 'clientes' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
            <WidgetCard titulo="Total Adeudado General" monto={clientes.reduce((acc, c) => acc + c.saldo, 0)} icono={Users} colorClase="text-purple-600" subtitulo={`${clientes.filter(c => c.saldo > 0).length} clientes activos con deuda pendiente`} />
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2 tracking-tight">
                  <div className="bg-purple-600 p-1.5 rounded-lg"><Users size={16} className="text-white" /></div> Directorio de Clientes
                </h3>
                <div className="relative w-full sm:w-auto">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></span>
                  <input 
                    type="text" placeholder="Buscar por nombre..." value={busquedaDirectorio} onChange={(e) => setBusquedaDirectorio(e.target.value)}
                    className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  />
                </div>
              </div>
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {clientes.length === 0 ? (
                   <div className="p-16 text-center text-gray-400 flex flex-col items-center bg-gray-50/30"><Users size={48} className="mb-4 opacity-30 text-gray-500" /><p className="font-bold text-lg text-gray-500">No hay clientes con cuenta corriente.</p></div>
                ) : clientesVisualizados.length === 0 ? (
                   <div className="p-10 text-center text-gray-400 flex flex-col items-center bg-gray-50/30"><Search size={32} className="mb-3 opacity-30 text-gray-500" /><p className="font-bold text-base text-gray-500">No se encontraron clientes con "{busquedaDirectorio}".</p></div>
                ) : (
                  clientesVisualizados.map((cliente) => (
                    <div key={cliente.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-purple-50/30 transition-colors">
                      <div>
                        <p className="font-bold text-gray-900 text-lg mb-1">{cliente.nombre}</p>
                        {cliente.whatsapp ? (
                          <a href={`https://wa.me/${cliente.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-md flex items-center gap-1.5 hover:bg-green-100 transition-colors w-max"><Phone size={12} /> {cliente.whatsapp}</a>
                        ) : (
                          <span className="text-xs font-bold text-gray-400 bg-gray-50 border px-2.5 py-1 rounded-md flex items-center gap-1.5 w-max"><Phone size={12}/> Sin número guardado</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-0 pt-3 sm:pt-0 border-gray-100">
                        <div className="text-left sm:text-right bg-gray-50 px-3 py-1.5 rounded-lg border">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Saldo pendiente</p>
                          <p className={`font-black text-xl tracking-tight ${cliente.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatearDinero(cliente.saldo)}</p>
                        </div>
                        <button disabled={cliente.saldo <= 0 || caja.estado === 'cerrada'} onClick={() => { setClienteSeleccionado(cliente); setModalActivo('cobro'); setFormData({ monto: cliente.saldo.toString(), descripcion: '', metodoPago: 'efectivo', detallesPago: {} }); }} className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95 uppercase tracking-wider">
                          ABONAR <ArrowRight size={16} />
                        </button>
                      </div>
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
                <button onClick={() => { setConfigExportInventario({ tipo: 'catalogo_pdf', alcance: 'general', categoria: '' }); setModalActivo('exportar_inventario'); }} className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto text-sm uppercase tracking-wider"><FileSpreadsheet size={16} /> Exportar</button>
                <button onClick={() => { setArchivoImportacionInventario(null); setResumenImportacionInventario(null); setModalActivo('importar_inventario'); }} className="bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto text-sm uppercase tracking-wider"><ArrowDownCircle size={16} /> Importar</button>
                <button onClick={() => { setFormProducto({ codigo: '', categoria: '', marca: '', descripcion: '', costo: '', ganancia: '', iva: '21', precio: '', unidad: 'unid', cantidad: '', imagen: '' }); setProductoAEditar(null); setModalActivo('nuevo_producto'); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto text-sm uppercase tracking-wider"><Plus size={16} /> Nuevo Producto</button>
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
                            {p.imagen ? <img src={p.imagen} alt="prod" className="w-10 h-10 object-cover rounded-lg border border-gray-200 bg-white" /> : <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200"><ImageIcon size={16} className="text-gray-300"/></div>}
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
                                <button onClick={() => { setProductoAEditar(p); setFormProducto({ codigo: p.codigo || '', categoria: p.categoria || '', marca: p.marca || '', descripcion: p.descripcion, costo: p.costo || '', ganancia: p.ganancia || '', iva: p.iva || '21', precio: p.precio, unidad: p.unidad || 'unid', cantidad: p.cantidad || 0, imagen: p.imagen || '' }); setModalActivo('nuevo_producto'); }} className="p-2 bg-white border shadow-sm text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-lg transition-all" title="Editar"><Edit2 size={16} /></button>
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
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-teal-600 p-2.5 rounded-xl shadow-sm"><ClipboardList size={20} className="text-white"/></div>
                <div><h2 className="text-lg font-bold text-gray-900 tracking-tight">Presupuestos / Cotizaciones</h2></div>
              </div>
              <button onClick={() => { setFormPresupuesto({ id: null, esNuevoCliente: false, clienteId: '', clienteNombre: '', whatsapp: '', items: [], notas: '', estado: 'borrador', descuentoGeneral: '', numero: null }); setModalActivo('nuevo_presupuesto'); }} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto text-sm uppercase tracking-wider"><FilePlus2 size={16} /> Crear Presupuesto</button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {presupuestos.length === 0 ? (
                  <div className="p-16 text-center text-gray-400 flex flex-col items-center bg-gray-50/30"><ClipboardList size={48} className="mb-4 opacity-30 text-gray-500" /><p className="font-bold text-lg text-gray-500">No hay presupuestos.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-700">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 font-bold border-b border-gray-200">
                      <tr>
                        <th className="px-5 py-3">Cliente / Empresa</th>
                        <th className="px-5 py-3">Fecha</th>
                        <th className="px-5 py-3 text-center">Estado</th>
                        <th className="px-5 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {presupuestos.map((p) => (
                        <tr key={p.id} onClick={() => { setPresupuestoSeleccionado(p); setIncluirImagenesPdf(false); setModalActivo('opciones_presupuesto'); }} className="hover:bg-teal-50/50 transition-colors cursor-pointer group">
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
                    <button onClick={() => setReporteTiempo('semana')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reporteTiempo === 'semana' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Semana</button>
                    <button onClick={() => setReporteTiempo('mes')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reporteTiempo === 'mes' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Mes</button>
                    <button onClick={() => setReporteTiempo('rango')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reporteTiempo === 'rango' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Rango</button>
                    <button onClick={() => setReporteTiempo('todo')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reporteTiempo === 'todo' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Todo el Histórico</button>
                    {reporteTiempo === 'mes' && (
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                        <Calendar size={14} className="text-gray-400 shrink-0" />
                        <span className="text-gray-500 font-bold text-xs uppercase">Mes</span>
                        <input type="month" value={reporteMesSeleccionado} onChange={(e) => setReporteMesSeleccionado(e.target.value)} className="outline-none bg-transparent text-gray-800 font-bold text-xs"/>
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      <span className="text-gray-500 font-bold text-xs uppercase">De</span>
                      <input type="date" value={reporteFechaDesdeReporte} onChange={(e) => setReporteFechaDesdeReporte(e.target.value)} className="outline-none bg-transparent text-gray-800 font-bold text-xs"/>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      <span className="text-gray-500 font-bold text-xs uppercase">A</span>
                      <input type="date" value={reporteFechaHastaReporte} onChange={(e) => setReporteFechaHastaReporte(e.target.value)} className="outline-none bg-transparent text-gray-800 font-bold text-xs"/>
                    </div>
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

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 print:border-none print:shadow-none print:p-0">
              <div className="hidden print:flex justify-between items-end mb-8 border-b-4 border-gray-900 pb-6">
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
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <WidgetCard titulo="Ingresos Totales" monto={datosReporte.ingresos} icono={TrendingUp} colorClase="text-green-600" printOculto={false} />
                    <WidgetCard titulo="Cobros (Cuentas)" monto={datosReporte.cobros} icono={Users} colorClase="text-purple-600" printOculto={false} />
                    <WidgetCard titulo="Egresos Totales" monto={datosReporte.egresos} icono={TrendingDown} colorClase="text-red-600" printOculto={false} />
                    <WidgetCard titulo="Retiros Efectivo" monto={datosReporte.retiros} icono={ArrowDownCircle} colorClase="text-orange-600" printOculto={false} />
                    <WidgetCard titulo="Ganancia (Neto)" monto={datosReporte.neto} icono={Wallet} colorClase={datosReporte.neto >= 0 ? "text-blue-600" : "text-red-600"} printOculto={false} />
                  </div>

                  <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2 mt-8">Balance Real por Medios de Pago</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 print:grid-cols-4">
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

                  <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2 mt-8">Desglose de Movimientos</h3>
                  {datosReporte.movimientos.length === 0 ? (
                    <p className="text-gray-500 text-center py-6 font-medium text-sm">No hay registros en este período.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-600">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 print:bg-transparent font-bold">
                          <tr><th className="px-4 py-3">Fecha/Hora</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Descripción</th><th className="px-4 py-3">Medio</th><th className="px-4 py-3">Cajero</th><th className="px-4 py-3 text-right">Monto</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-medium">
                          {datosReporte.movimientos.map(m => {
                            const isRetiro = m.tipo === 'retiro_caja';
                            return (
                            <tr key={m.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                              <td className="px-4 py-3 whitespace-nowrap">{formatearFecha(m.fecha)} {formatearHora(m.fecha)}</td>
                              <td className="px-4 py-3 font-bold"><span className={`text-[10px] uppercase tracking-wider ${m.tipo === 'gasto' ? 'text-red-600' : (m.tipo === 'cobro' ? 'text-purple-600' : (isRetiro ? 'text-orange-600' : 'text-green-600'))}`}>{m.tipo.replace('_', ' ')}</span></td>
                              <td className="px-4 py-3 font-bold text-gray-800">{m.descripcion}</td>
                              <td className="px-4 py-3 capitalize">{m.metodoPago?.replace('_', ' ')}</td>
                              <td className="px-4 py-3 text-gray-500">{m.usuario || '-'}</td>
                              <td className={`px-4 py-3 text-right font-black whitespace-nowrap ${m.tipo === 'gasto' || isRetiro ? 'text-red-600' : 'text-green-600'}`}>{m.tipo === 'gasto' || isRetiro ? '-' : '+'}{formatearDinero(m.monto)}</td>
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
                    <WidgetCard titulo="Clientes con Deuda" monto={clientes.filter(c => c.saldo > 0).length} icono={AlertCircle} colorClase="text-orange-600" printOculto={false} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">Estado de Cuentas</h3>
                  {clientes.length === 0 ? (
                    <p className="text-gray-500 text-center py-6 font-medium text-sm">Base vacía.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-600">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 print:bg-transparent font-bold">
                          <tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Contacto</th><th className="px-4 py-3 text-right">Estado</th><th className="px-4 py-3 text-right">Deuda</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {clientes.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                              <td className="px-4 py-3 font-bold text-gray-900">{c.nombre}</td>
                              <td className="px-4 py-3">{c.whatsapp || '-'}</td>
                              <td className="px-4 py-3 text-right">{c.saldo > 0 ? <span className="text-red-600 font-bold text-xs uppercase tracking-wider">Mora</span> : <span className="text-green-600 font-bold text-xs uppercase tracking-wider">Al Día</span>}</td>
                              <td className={`px-4 py-3 text-right font-black text-base whitespace-nowrap ${c.saldo > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatearDinero(c.saldo)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* --- VISTA: CONFIGURACIÓN (Solo Admin) --- */}
        {puedeVerSistema && vista === 'configuracion' && usuarioActual.rol === 'admin' && (
          <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300 print:hidden">
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
                <button type="submit" className="w-full bg-slate-800 hover:bg-black text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-wider mt-2"><Save size={18} /> APLICAR CAMBIOS</button>
              </form>
            </div>
          </div>
        )}

        {/* --- VISTA: USUARIOS (Solo Admin) --- */}
        {puedeVerSistema && vista === 'usuarios' && usuarioActual.rol === 'admin' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-3 rounded-xl shadow-sm"><ShieldCheck size={24} className="text-white"/></div>
                <div><h2 className="text-lg font-bold text-gray-900 tracking-tight">Gestión de Accesos</h2></div>
              </div>
              <button onClick={() => { setFormUsuario({ nombre: '', username: '', password: '', rol: 'cajero' }); setUsuarioAEditar(null); setModalActivo('nuevo_usuario'); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto text-sm uppercase tracking-wider"><UserPlus size={16} /> NUEVO USUARIO</button>
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
                        <td className="px-5 py-3"><span className="text-gray-400 font-mono tracking-widest bg-gray-50 px-2 py-1 rounded-md border text-xs">{u.password.replace(/./g, '•')}</span></td>
                        <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${u.rol === 'admin' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>{u.rol === 'admin' ? 'ADMINISTRADOR' : 'CAJERO'}</span></td>
                        <td className="px-5 py-3 text-right flex justify-end gap-2">
                          <button onClick={() => { setUsuarioAEditar(u); setFormUsuario(u); setModalActivo('editar_usuario'); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-all" title="Editar"><Edit2 size={16} /></button>
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
        <div className="fixed inset-0 bg-gray-100 z-50 overflow-y-auto flex justify-center py-10 print:p-0 print:bg-white custom-scrollbar">
          <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
            <button onClick={imprimirReporte} className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2"><Printer size={20}/> Imprimir / PDF</button>
            <button onClick={() => { setModalActivo(null); setCatalogoAImprimir(null); }} className="bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 p-3 rounded-full shadow-lg"><X size={24}/></button>
          </div>

          <div className="w-full max-w-[210mm] space-y-6 print:space-y-0">
            {(paginasCatalogoImpresion.length ? paginasCatalogoImpresion : [{ categoria: 'Sin productos', items: [], bloque: 1, totalBloques: 1 }]).map((pagina, paginaIndex) => (
              <div key={`${pagina.categoria}-${paginaIndex}`} className="print-a4-sheet box-border bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none p-6 sm:p-8 text-black font-sans">
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
                  <div className="flex gap-4 items-center">
                    {configuracion.logo && <img src={configuracion.logo} alt="Logo" className="w-16 h-16 object-contain" />}
                    <div>
                      <h1 className="text-2xl font-black uppercase tracking-tight leading-none">{configuracion.nombre || 'MI NEGOCIO'}</h1>
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
                      <div className="h-28 bg-gray-50 border-b border-gray-200 flex items-center justify-center p-2">
                        {p.imagen ? <img src={p.imagen} alt={p.descripcion} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={28} /></div>}
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
                  <p className="text-[10px] text-gray-400 mt-1">Emitido por: {usuarioActual.nombre} • {configuracion.nombre}</p>
                </div>
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
        <Modal titulo={productoAEditar ? 'Editar Producto' : 'Nuevo Producto'} onClose={() => { setModalActivo(null); setProductoAEditar(null); }}>
          <form onSubmit={guardarProducto} className="space-y-4">
            
            {/* Foto Upload */}
            <div className="flex flex-col items-center justify-center bg-indigo-50 border border-indigo-100 p-4 rounded-xl relative group">
              {formProducto.imagen ? (
                <div className="relative">
                  <img src={formProducto.imagen} alt="Producto" className="w-24 h-24 object-cover rounded-lg shadow-sm border-2 border-white" />
                  <button type="button" onClick={() => setFormProducto({...formProducto, imagen: ''})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"><X size={14}/></button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2 text-indigo-500 hover:text-indigo-700 transition-colors">
                  <div className="bg-white p-3 rounded-full shadow-sm"><Camera size={24}/></div>
                  <span className="text-xs font-bold uppercase tracking-wider">Subir o Tomar Foto</span>
                  {/* El capture="environment" abre la cámara trasera en móviles */}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={procesarImagenProducto} />
                </label>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Código de Barras</label>
                <div className="flex gap-2">
                   <input type="text" value={formProducto.codigo} onChange={(e) => setFormProducto({...formProducto, codigo: e.target.value})} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold" placeholder="Escribe o escanea..." />
                   <button type="button" onClick={() => setModalActivo('scanner_codigo')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-lg shadow-sm transition-colors flex items-center justify-center" title="Escanear Código">
                     <ScanBarcode size={20} />
                   </button>
                </div>
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Stock Inicial</label>
                <input type="text" inputMode="decimal" required value={formProducto.cantidad} onChange={(e) => setFormProducto({...formProducto, cantidad: e.target.value.replace(',', '.')})} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-center" placeholder="0"/>
              </div>
            </div>
            
            <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Descripción del Producto</label><input type="text" required value={formProducto.descripcion} onChange={(e) => setFormProducto({...formProducto, descripcion: e.target.value})} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold" placeholder="Ej: Pintura Latex Blanca 20L"/></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Categoría</label>
                <input
                  type="text"
                  list="categorias-producto-list"
                  value={formProducto.categoria}
                  onChange={(e) => setFormProducto({...formProducto, categoria: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  placeholder="Elegir o escribir categoría"
                />
                <datalist id="categorias-producto-list">
                  {categoriasInventario.map((cat) => <option key={cat} value={cat} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Marca</label>
                <input
                  type="text"
                  list="marcas-producto-list"
                  value={formProducto.marca}
                  onChange={(e) => setFormProducto({...formProducto, marca: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  placeholder="Ej: Philips / Osram / Genérica"
                />
                <datalist id="marcas-producto-list">
                  {marcasInventario.map((marca) => <option key={marca} value={marca} />)}
                </datalist>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Costo Neto</label>
                <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span><input type="text" inputMode="decimal" required value={formProducto.costo} onChange={(e) => { const val = e.target.value.replace(',', '.'); setFormProducto({...formProducto, costo: val, precio: calcularPrecioVenta(val, formProducto.ganancia, formProducto.iva)}); }} className="w-full pl-6 pr-2 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-right" placeholder="0.00"/></div>
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Ganancia %</label>
                <div className="relative"><input type="text" inputMode="decimal" value={formProducto.ganancia} onChange={(e) => { const val = e.target.value.replace(',', '.'); setFormProducto({...formProducto, ganancia: val, precio: calcularPrecioVenta(formProducto.costo, val, formProducto.iva)}); }} className="w-full pr-6 pl-2 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-right" placeholder="0"/><span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span></div>
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">IVA</label>
                <select value={formProducto.iva} onChange={(e) => { const val = e.target.value; setFormProducto({...formProducto, iva: val, precio: calcularPrecioVenta(formProducto.costo, formProducto.ganancia, val)}); }} className="w-full px-2 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-xs font-bold uppercase">
                  <option value="sin_iva">Sin IVA</option><option value="10.5">10.5%</option><option value="21">21%</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Unidad</label>
                <select value={formProducto.unidad} onChange={(e) => setFormProducto({...formProducto, unidad: e.target.value})} className="w-full px-2 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-xs font-bold uppercase">
                  <option value="unid">Unid.</option><option value="mts">Metros</option><option value="lts">Litros</option><option value="kg">Kilos</option><option value="cm">Cm</option>
                </select>
              </div>
            </div>
            
            <div className="text-[9px] text-indigo-600 font-bold mt-0.5 uppercase tracking-wider h-3">
              {formProducto.costo ? numeroALetras(parseFloat(formProducto.costo) || 0) : ''}
            </div>

            <div className="mt-2">
               <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Precio Final de Venta</label>
               <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">$</span><input type="text" inputMode="decimal" required value={formProducto.precio} onChange={(e) => setFormProducto({...formProducto, precio: e.target.value.replace(',', '.')})} className="w-full pl-8 pr-4 py-3 bg-indigo-50/50 border-2 border-indigo-200 rounded-xl focus:border-indigo-600 outline-none text-2xl font-black text-indigo-800" placeholder="0.00"/></div>
               <div className="text-[9px] text-indigo-700 font-bold mt-1 uppercase tracking-wider h-3">{formProducto.precio ? numeroALetras(parseFloat(formProducto.precio) || 0) : ''}</div>
            </div>

            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-4 rounded-xl mt-4 shadow-md text-sm uppercase tracking-wider transition-transform active:scale-95">{productoAEditar ? 'Guardar Cambios' : 'Agregar al Inventario'}</button>
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
                    {p.imagen ? <img src={p.imagen} alt="prod" className="w-10 h-10 object-cover rounded-lg shrink-0 border border-gray-200" /> : <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0"><Package size={16} className="text-gray-300"/></div>}
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
        <Modal titulo="Opciones de Presupuesto" onClose={() => { setModalActivo(null); setPresupuestoSeleccionado(null); setIncluirImagenesPdf(false); }} customWidth="max-w-sm">
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
                <button onClick={() => { setPresupuestoAImprimir(presupuestoSeleccionado); setModalActivo('imprimir_presupuesto'); }} className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 rounded-lg flex justify-center items-center gap-2 transition-colors text-sm shadow-sm"><Printer size={16}/> Ver PDF / Imprimir</button>
              </div>

              <div className="border-t border-gray-100 pt-4 flex gap-2">
                <button onClick={() => { 
                  setFormPresupuesto({
                    ...presupuestoSeleccionado,
                    esNuevoCliente: false,
                    descuentoGeneral: presupuestoSeleccionado.descuentoGeneral ?? '',
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
        <Modal titulo={formPresupuesto.id ? 'Editar Presupuesto' : 'Crear Presupuesto'} onClose={() => setModalActivo(null)} customWidth="max-w-5xl" extraClases="p-2 sm:p-4">
          <form onSubmit={guardarPresupuesto} className="space-y-4">
            
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Cliente */}
              <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-600 uppercase">Cliente</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={formPresupuesto.esNuevoCliente} onChange={(e) => setFormPresupuesto({...formPresupuesto, esNuevoCliente: e.target.checked, clienteId: '', clienteNombre: '', whatsapp: ''})} className="w-3 h-3 text-teal-600"/><span className="text-[10px] font-bold text-teal-700 uppercase">Nuevo</span></label>
                </div>
                {!formPresupuesto.esNuevoCliente ? (
                  <select required value={formPresupuesto.clienteId} onChange={(e) => setFormPresupuesto({...formPresupuesto, clienteId: e.target.value})} className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm font-bold outline-none">
                    <option value="">Seleccionar de la base...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" required placeholder="Nombre" value={formPresupuesto.clienteNombre} onChange={(e) => setFormPresupuesto({...formPresupuesto, clienteNombre: e.target.value})} className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm font-bold outline-none" />
                    <input type="text" placeholder="WhatsApp" value={formPresupuesto.whatsapp} onChange={(e) => setFormPresupuesto({...formPresupuesto, whatsapp: e.target.value})} className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm font-bold outline-none max-w-[120px]" />
                  </div>
                )}
              </div>
              {/* Resumen Total Header */}
              <div className="bg-teal-50 p-3 rounded-xl border border-teal-200 flex flex-col justify-center items-end sm:w-48 shrink-0">
                 <p className="text-[10px] font-bold text-teal-800 uppercase mb-1">Desc. General (%)</p>
                 <input
                   type="text"
                   inputMode="decimal"
                   value={formPresupuesto.descuentoGeneral || ''}
                   onChange={(e) => setFormPresupuesto({ ...formPresupuesto, descuentoGeneral: e.target.value.replace(',', '.') })}
                   className="w-full max-w-[90px] px-2 py-1 text-sm font-black text-right text-teal-800 bg-white border border-teal-200 rounded-md outline-none focus:border-teal-500"
                   placeholder="0"
                 />
                 <p className="text-[10px] font-bold text-teal-800 uppercase mt-2 mb-0.5">Total Cotización</p>
                 <p className="text-2xl font-black text-teal-700 tracking-tight">{formatearDinero(resumenPresupuestoActual.total)}</p>
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
              <span className="hidden sm:inline text-teal-300">|</span>
              <span className="text-sm">Final: {formatearDinero(resumenPresupuestoActual.total)}</span>
            </div>
            
            <div className="pt-2">
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Observaciones / Detalles adicionales</label>
              <textarea placeholder="Ej: Válido por 10 días. Entregas a domicilio..." value={formPresupuesto.notas} onChange={(e) => setFormPresupuesto({...formPresupuesto, notas: e.target.value})} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-500 h-16 resize-none"/>
            </div>
            
            <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black text-sm py-3.5 rounded-xl shadow-sm transition-transform active:scale-95 uppercase tracking-wide">
              {formPresupuesto.id ? 'ACTUALIZAR PRESUPUESTO' : 'GUARDAR PRESUPUESTO'}
            </button>
          </form>
        </Modal>
      )}

      {/* Modal IMPRIMIR PRESUPUESTO (Ocupa toda la pantalla al imprimir) */}
      {modalActivo === 'imprimir_presupuesto' && presupuestoAImprimir && (
        <div className="fixed inset-0 bg-gray-100 z-50 overflow-y-auto flex justify-center py-10 print:p-0 print:bg-white custom-scrollbar">
          
          <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
            <button onClick={imprimirReporte} className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2"><Printer size={20}/> Imprimir / PDF</button>
            <button onClick={() => { setModalActivo(null); setPresupuestoAImprimir(null); setIncluirImagenesPdf(false); }} className="bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 p-3 rounded-full shadow-lg"><X size={24}/></button>
          </div>

          <div className="print-a4-sheet box-border bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none p-6 sm:p-8 text-black font-sans relative">
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-5 mb-5">
              <div className="flex items-center min-h-[56px]">
                 {configuracion.logo && <img src={configuracion.logo} alt="Logo" className="w-52 max-h-20 object-contain" />}
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-black text-gray-300 tracking-widest mb-0.5">PRESUPUESTO</h2>
                <p className="font-black text-sm">{obtenerNumeroPresupuestoTexto(presupuestoAImprimir)}</p>
                <p className="font-bold text-sm">FECHA: {formatearFecha(presupuestoAImprimir.fecha)}</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-5">
               <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Presupuestado a nombre de:</p>
               <p className="text-lg font-black text-gray-900 uppercase">{presupuestoAImprimir.clienteNombre}</p>
               {presupuestoAImprimir.whatsapp && <p className="text-xs font-bold text-gray-600 mt-0.5">Tel/WhatsApp: {presupuestoAImprimir.whatsapp}</p>}
            </div>

            <table className="w-full text-[12px] mb-5 border-collapse table-fixed">
              <thead className="bg-gray-800 text-white font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-1.5 px-1.5 text-left w-[9%]">Cód.</th>
                  {incluirImagenesPdf && <th className="py-1.5 px-1.5 text-center w-[12%]">Imagen</th>}
                  <th className="py-1.5 px-1.5 text-left">Descripción del Producto/Servicio</th>
                  <th className="py-1.5 px-1.5 text-center w-[8%]">Cant.</th>
                  <th className="py-1.5 px-1.5 text-center w-[8%]">Unid.</th>
                  <th className="py-1.5 px-1.5 text-right w-[11%]">Precio U.</th>
                  {mostrarDescuentoItemEnPdf && <th className="py-1.5 px-1.5 text-center w-[7%]">Desc.%</th>}
                  <th className="py-1.5 px-1.5 text-right w-[13%]">Subtotal</th>
                </tr>
              </thead>
              <tbody className="border-b-2 border-gray-800">
                {presupuestoAImprimir.items.map((item, i) => {
                  const imagenItem = incluirImagenesPdf ? obtenerImagenItemPresupuesto(item) : '';
                  return (
                    <tr key={i} className="border-b border-gray-200 print-no-break">
                      <td className="py-1.5 px-1.5 text-gray-500 text-[10px] align-top break-words">{item.codigo || '-'}</td>
                      {incluirImagenesPdf && (
                        <td className="py-1 px-1.5 align-top">
                          <div className="w-16 h-16 border border-gray-300 rounded-lg bg-white overflow-hidden flex items-center justify-center mx-auto">
                            {imagenItem ? (
                              <img src={imagenItem} alt={item.descripcion || 'Producto'} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-[9px] font-bold text-gray-400 uppercase">Sin foto</span>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="py-1.5 px-1.5 font-bold text-[10px] whitespace-normal break-words align-top leading-tight">{item.descripcion}</td>
                      <td className="py-1.5 px-1.5 text-center font-bold text-[10px] align-top">{item.cantidad}</td>
                      <td className="py-1.5 px-1.5 text-center text-[10px] uppercase align-top">{item.unidad}</td>
                      <td className="py-1.5 px-1.5 text-right text-[10px] align-top">{formatearDinero(item.precio)}</td>
                      {mostrarDescuentoItemEnPdf && <td className="py-1.5 px-1.5 text-center font-bold text-[10px] align-top">{parseNumeroPresupuesto(item?.descuento) > 0 ? `${parseNumeroPresupuesto(item?.descuento)}%` : '-'}</td>}
                      <td className="py-1.5 px-1.5 text-right font-black text-[10px] align-top">{formatearDinero(calcularTotalItemPresupuesto(item))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mt-5 print:block">
              <div className="w-full sm:w-1/2 sm:pr-6 print:w-full print:pr-0 print:mb-3">
                {presupuestoAImprimir.notas && (
                  <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Observaciones / Detalles:</p><p className="text-[10px] text-gray-700 whitespace-pre-wrap border-l-4 border-gray-200 pl-3">{presupuestoAImprimir.notas}</p></div>
                )}
              </div>
              <div className="w-full sm:w-1/2 flex sm:justify-end print:w-full print:justify-start">
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
              </div>
            </div>

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
            
            <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Descripción / Detalle</label><input type="text" required value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none font-bold text-sm" placeholder="Ej: Venta mercadería / Pago luz" /></div>
            
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
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">DNI/CUIT (Autocompletar)</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Sin guiones" value={formData.detallesPago.documento || ''} onChange={(e) => setFormData({...formData, detallesPago: {...formData.detallesPago, documento: e.target.value.replace(/\D/g, '')}})} className="w-full px-3 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"/>
                      <button type="button" onClick={buscarDatosCliente} disabled={buscandoCliente || !formData.detallesPago.documento} className="bg-purple-600 text-white px-4 rounded-lg flex justify-center items-center disabled:opacity-50"><Search size={16}/></button>
                    </div>
                  </div>
                  <input type="text" required placeholder="Nombre completo" value={formData.detallesPago.cliente || ''} onChange={(e) => setFormData({...formData, detallesPago: {...formData.detallesPago, cliente: e.target.value}})} className="w-full px-3 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"/>
                  <input type="text" placeholder="WhatsApp (Opcional)" value={formData.detallesPago.whatsapp || ''} onChange={(e) => setFormData({...formData, detallesPago: {...formData.detallesPago, whatsapp: e.target.value}})} className="w-full px-3 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"/>
                </div>
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

      {/* COMPONENTES DE USUARIOS Y CONFIRMACIONES MANTENIDOS */}
      {modalActivo === 'cobro' && clienteSeleccionado && (
        <Modal titulo="Registrar Pago de Cliente" onClose={() => { setModalActivo(null); setClienteSeleccionado(null); }}>
          <form onSubmit={registrarCobro} className="space-y-4">
            <div className="bg-purple-600 p-4 rounded-2xl text-center text-white">
              <p className="text-purple-200 font-bold uppercase text-[10px] mb-0.5">Cobranza a:</p>
              <p className="text-xl font-black tracking-tight">{clienteSeleccionado.nombre}</p>
              <div className="inline-block bg-white/20 px-3 py-1 rounded-lg border border-white/30 mt-1.5"><p className="text-[10px] font-black uppercase tracking-wider">Deuda: {formatearDinero(clienteSeleccionado.saldo)}</p></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1 uppercase">Monto que paga ahora</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xl">$</span><input type="number" step="0.01" min="0.01" max={clienteSeleccionado.saldo} required value={formData.monto} onChange={(e) => setFormData({...formData, monto: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-white border-2 border-purple-200 rounded-xl text-2xl font-black text-purple-700 outline-none focus:border-purple-600" autoFocus/></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1 uppercase">Forma de Pago del Cliente</label>
              <select value={formData.metodoPago} onChange={(e) => setFormData({...formData, metodoPago: e.target.value, detallesPago: {}})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-600">
                <option value="efectivo">💵 Efectivo Físico</option><option value="transferencia">🏦 Transferencia</option><option value="tarjeta">💳 Tarjeta</option><option value="cheque">📝 Cheque</option>
              </select>
            </div>
            
            {formData.metodoPago === 'tarjeta' && renderBloqueTarjeta()}
            {formData.metodoPago === 'cheque' && renderBloqueCheque()}
            
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm py-3 px-4 rounded-xl mt-4 flex items-center justify-center gap-2 uppercase tracking-wide"><ArrowRight size={18}/> CONFIRMAR COBRO</button>
          </form>
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
