import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Wallet, TrendingUp, TrendingDown, Store, Plus, Minus, X, Lock, Unlock,
  Clock, AlertCircle, CreditCard, Users, Phone, ArrowRight, Edit2,
  Trash2, Save, PlusCircle, Calendar, Filter, Printer, BarChart2,
  LogOut, User, UserCog, UserPlus, ShieldCheck, Settings, Image as ImageIcon,
  Search
} from 'lucide-react';

import { auth, db } from './firebase-config.js';
import { signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  addDoc,
  getDocs,
  getDoc,
  query,
  limit
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const refs = {
  configuracion: doc(db, 'sistema', 'configuracion'),
  caja: doc(db, 'sistema', 'caja'),
  migracion: doc(db, 'sistema', 'migracion'),
  usuarios: collection(db, 'usuarios'),
  movimientos: collection(db, 'movimientos'),
  clientes: collection(db, 'clientes'),
};

const formatearDinero = (monto) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(Number(monto || 0));
const formatearHora = (fecha) => new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(fecha));
const formatearFecha = (fecha) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(fecha));

const numeroALetras = (numero) => {
  if (!numero || Number.isNaN(numero) || numero < 0) return '';
  const enteros = Math.floor(numero);
  const centavos = Math.round((numero - enteros) * 100);

  const unidades = (num) => {
    switch(num) {
      case 1: return 'UN'; case 2: return 'DOS'; case 3: return 'TRES'; case 4: return 'CUATRO'; case 5: return 'CINCO';
      case 6: return 'SEIS'; case 7: return 'SIETE'; case 8: return 'OCHO'; case 9: return 'NUEVE'; default: return '';
    }
  };
  const decenas = (num) => {
    const decena = Math.floor(num / 10);
    const unidad = num - (decena * 10);
    switch(decena) {
      case 1:
        switch(unidad) {
          case 0: return 'DIEZ'; case 1: return 'ONCE'; case 2: return 'DOCE'; case 3: return 'TRECE'; case 4: return 'CATORCE'; case 5: return 'QUINCE';
          default: return `DIECI${unidades(unidad)}`;
        }
      case 2: return unidad === 0 ? 'VEINTE' : `VEINTI${unidades(unidad)}`;
      case 3: return unidades(unidad) === '' ? 'TREINTA' : `TREINTA Y ${unidades(unidad)}`;
      case 4: return unidades(unidad) === '' ? 'CUARENTA' : `CUARENTA Y ${unidades(unidad)}`;
      case 5: return unidades(unidad) === '' ? 'CINCUENTA' : `CINCUENTA Y ${unidades(unidad)}`;
      case 6: return unidades(unidad) === '' ? 'SESENTA' : `SESENTA Y ${unidades(unidad)}`;
      case 7: return unidades(unidad) === '' ? 'SETENTA' : `SETENTA Y ${unidades(unidad)}`;
      case 8: return unidades(unidad) === '' ? 'OCHENTA' : `OCHENTA Y ${unidades(unidad)}`;
      case 9: return unidades(unidad) === '' ? 'NOVENTA' : `NOVENTA Y ${unidades(unidad)}`;
      case 0: return unidades(unidad);
      default: return '';
    }
  };
  const centenas = (num) => {
    const centena = Math.floor(num / 100);
    const decena = num - (centena * 100);
    switch(centena) {
      case 1: return decena === 0 ? 'CIEN' : `CIENTO ${decenas(decena)}`;
      case 2: return `DOSCIENTOS ${decenas(decena)}`;
      case 3: return `TRESCIENTOS ${decenas(decena)}`;
      case 4: return `CUATROCIENTOS ${decenas(decena)}`;
      case 5: return `QUINIENTOS ${decenas(decena)}`;
      case 6: return `SEISCIENTOS ${decenas(decena)}`;
      case 7: return `SETECIENTOS ${decenas(decena)}`;
      case 8: return `OCHOCIENTOS ${decenas(decena)}`;
      case 9: return `NOVECIENTOS ${decenas(decena)}`;
      default: return decenas(decena);
    }
  };
  const miles = (num) => {
    const divisor = 1000;
    const cientos = Math.floor(num / divisor);
    const resto = num - (cientos * divisor);
    const strMiles = centenas(cientos);
    const strCentenas = centenas(resto);
    if (cientos === 0) return strCentenas;
    if (cientos === 1) return `MIL ${strCentenas}`;
    return `${strMiles} MIL ${strCentenas}`;
  };
  const millones = (num) => {
    const divisor = 1000000;
    const mill = Math.floor(num / divisor);
    const resto = num - (mill * divisor);
    const strMillones = centenas(mill);
    const strMiles = miles(resto);
    if (mill === 0) return strMiles;
    if (mill === 1) return `UN MILLON ${strMiles}`;
    return `${strMillones} MILLONES ${strMiles}`;
  };

  const strEnteros = enteros === 0 ? 'CERO' : millones(enteros).trim();
  return `${strEnteros} PESOS CON ${centavos.toString().padStart(2, '0')}/100 CENTAVOS`;
};

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

const Modal = ({ titulo, children, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
        <h2 className="text-lg font-bold text-gray-800">{titulo}</h2>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
        )}
      </div>
      <div className="p-5 overflow-y-auto custom-scrollbar">{children}</div>
    </div>
  </div>
);

const legacyPaymentToNewMethod = (method) => {
  if (method === 'tarjeta_debito' || method === 'tarjeta_credito') return 'tarjeta';
  if (method === 'transferencia') return 'transferencia';
  if (method === 'cheque') return 'cheque';
  if (method === 'cuenta_corriente') return 'cuenta_corriente';
  return 'efectivo';
};

const legacyTargetToMethod = (target) => {
  if (target === 'cheque') return 'cheque';
  if (target === 'transferencia') return 'transferencia';
  return 'efectivo';
};

const legacyDateToIso = (item) => {
  if (item?.createdAt?.toDate) {
    const d = item.createdAt.toDate();
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (item?.date) {
    const d = new Date(`${item.date}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
};

const nombreClienteLegacy = (sale) => {
  const nombre = [sale.customerFirstName || '', sale.customerLastName || ''].join(' ').trim();
  return nombre || sale.sourceName || 'Cliente sin nombre';
};

async function migrarDesdeLegacy() {
  const mig = await getDoc(refs.migracion);
  if (mig.exists() && mig.data()?.legacyToV2Done) return;

  const [nuevosMovs, nuevosUsuarios] = await Promise.all([
    getDocs(query(refs.movimientos, limit(1))),
    getDocs(query(refs.usuarios, limit(1))),
  ]);
  const cajaNueva = await getDoc(refs.caja);
  const tieneSistemaNuevo = !nuevosMovs.empty || !nuevosUsuarios.empty || cajaNueva.exists();

  if (tieneSistemaNuevo) {
    await setDoc(refs.migracion, {
      legacyToV2Done: true,
      skipped: true,
      skippedReason: 'new_data_already_exists',
      migratedAt: new Date().toISOString(),
    }, { merge: true });
    return;
  }

  const [salesSnap, expensesSnap, cashMovsSnap, sessionsSnap] = await Promise.all([
    getDocs(collection(db, 'sales')),
    getDocs(collection(db, 'expenses')),
    getDocs(collection(db, 'cashMovements')),
    getDocs(collection(db, 'cashSessions')),
  ]);

  const sales = salesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const cashMovs = cashMovsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const sessions = sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (!sales.length && !expenses.length && !cashMovs.length && !sessions.length) {
    await setDoc(refs.migracion, {
      legacyToV2Done: true,
      skipped: true,
      skippedReason: 'legacy_empty',
      migratedAt: new Date().toISOString(),
    }, { merge: true });
    return;
  }

  const sessionSorted = [...sessions].sort((a, b) => {
    const at = new Date(legacyDateToIso(a)).getTime();
    const bt = new Date(legacyDateToIso(b)).getTime();
    return bt - at;
  });
  const openSession = sessionSorted.find((s) => !s.closedAt);
  const mainSession = openSession || sessionSorted[0] || null;

  await setDoc(refs.caja, {
    estado: openSession ? 'abierta' : 'cerrada',
    efectivoInicial: Number(mainSession?.openingCash || 0),
    chequesInicial: Number(mainSession?.openingChecks || 0),
    fechaApertura: openSession ? legacyDateToIso(openSession) : null,
  }, { merge: true });

  const saldoClientes = new Map();
  const seenClientes = new Set();

  sales.forEach((sale) => {
    if (sale.paymentMethod === 'cuenta_corriente') {
      const nombre = nombreClienteLegacy(sale);
      seenClientes.add(nombre);
      saldoClientes.set(nombre, (saldoClientes.get(nombre) || 0) + Number(sale.amount || 0));
    }
  });

  cashMovs.forEach((move) => {
    if (move.sourceType === 'cuenta_corriente') {
      const nombre = (move.sourceName || 'Cliente sin nombre').trim() || 'Cliente sin nombre';
      seenClientes.add(nombre);
      saldoClientes.set(nombre, (saldoClientes.get(nombre) || 0) - Number(move.amount || 0));
    }
  });

  const clienteIdPorNombre = new Map();
  for (const nombre of seenClientes) {
    const saldo = saldoClientes.get(nombre) || 0;
    const ref = await addDoc(refs.clientes, { nombre, whatsapp: '', saldo });
    clienteIdPorNombre.set(nombre.toLowerCase(), ref.id);
  }

  for (const sale of sales) {
    const metodoPago = legacyPaymentToNewMethod(sale.paymentMethod);
    const clienteNombre = sale.paymentMethod === 'cuenta_corriente' ? nombreClienteLegacy(sale) : null;
    const descripcion = (sale.details || `${sale.documentType || 'Venta'} ${sale.documentNumber || ''}`).trim() || 'Venta general';
    const detallesPago = {};

    if (metodoPago === 'tarjeta') {
      detallesPago.marca = sale.paymentMethod === 'tarjeta_debito' ? 'Débito' : 'Crédito';
      if (sale.bankInfo) detallesPago.banco = sale.bankInfo;
    }
    if (metodoPago === 'cheque' && sale.bankInfo) detallesPago.banco = sale.bankInfo;
    if (metodoPago === 'transferencia' && sale.bankInfo) detallesPago.referencia = sale.bankInfo;
    if (metodoPago === 'cuenta_corriente') {
      detallesPago.cliente = clienteNombre;
      if (sale.documentNumber) detallesPago.documento = sale.documentNumber;
      const cid = clienteIdPorNombre.get(clienteNombre.toLowerCase());
      if (cid) detallesPago.clienteId = cid;
    }

    await addDoc(refs.movimientos, {
      tipo: 'venta',
      monto: Number(sale.amount || 0),
      descripcion,
      metodoPago,
      detallesPago,
      fecha: legacyDateToIso(sale),
      usuario: 'Migración automática',
      legacyId: sale.id,
      legacyCollection: 'sales',
    });
  }

  for (const expense of expenses) {
    const descripcion = `${expense.category || 'Gasto'}${expense.details ? ` - ${expense.details}` : ''}`;
    await addDoc(refs.movimientos, {
      tipo: 'gasto',
      monto: Number(expense.amount || 0),
      descripcion,
      metodoPago: 'efectivo',
      detallesPago: {},
      fecha: legacyDateToIso(expense),
      usuario: 'Migración automática',
      legacyId: expense.id,
      legacyCollection: 'expenses',
    });
  }

  for (const move of cashMovs) {
    const esCobro = move.sourceType === 'cuenta_corriente';
    const nombreCliente = (move.sourceName || 'Cliente sin nombre').trim() || 'Cliente sin nombre';
    const detallesPago = {};
    if (move.details) detallesPago.referencia = move.details;

    if (esCobro) {
      detallesPago.cliente = nombreCliente;
      const cid = clienteIdPorNombre.get(nombreCliente.toLowerCase());
      if (cid) detallesPago.clienteId = cid;
    }

    await addDoc(refs.movimientos, {
      tipo: esCobro ? 'cobro' : 'ingreso_extra',
      monto: Number(move.amount || 0),
      descripcion: esCobro
        ? `Cobro de deuda a: ${nombreCliente}`
        : (move.details || `Ingreso por ${move.sourceTypeLabel || 'otros'}`),
      metodoPago: legacyTargetToMethod(move.target),
      detallesPago,
      fecha: legacyDateToIso(move),
      usuario: 'Migración automática',
      legacyId: move.id,
      legacyCollection: 'cashMovements',
    });
  }

  await setDoc(refs.migracion, {
    legacyToV2Done: true,
    skipped: false,
    migratedAt: new Date().toISOString(),
    totals: {
      sales: sales.length,
      expenses: expenses.length,
      cashMovements: cashMovs.length,
      sessions: sessions.length,
      clients: seenClientes.size,
    },
  }, { merge: true });
}

function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isDBReady, setIsDBReady] = useState(false);

  const [configuracion, setConfiguracion] = useState({ nombre: 'SeniorFlow', logo: '' });
  const [usuarios, setUsuarios] = useState([]);
  const [caja, setCaja] = useState({ estado: 'cerrada', efectivoInicial: 0, chequesInicial: 0, fechaApertura: null });
  const [movimientos, setMovimientos] = useState([]);
  const [clientes, setClientes] = useState([]);

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
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [reporteTipo, setReporteTipo] = useState('general');
  const [reporteTiempo, setReporteTiempo] = useState('todo');

  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [busquedaDirectorio, setBusquedaDirectorio] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) {
        console.error('Auth error', e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    let cancelled = false;
    const start = async () => {
      try {
        await migrarDesdeLegacy();
      } catch (e) {
        console.error('Error al migrar datos legacy', e);
      }
      if (cancelled) return;

      const unsubConfig = onSnapshot(refs.configuracion, (d) => {
        if (d.exists()) setConfiguracion(d.data());
        else setDoc(refs.configuracion, { nombre: 'SeniorFlow', logo: '' });
      }, (err) => console.error(err));

      const unsubCaja = onSnapshot(refs.caja, (d) => {
        if (d.exists()) setCaja(d.data());
        else setDoc(refs.caja, { estado: 'cerrada', efectivoInicial: 0, chequesInicial: 0, fechaApertura: null });
      }, (err) => console.error(err));

      const unsubUsuarios = onSnapshot(refs.usuarios, (snapshot) => {
        if (snapshot.empty) {
          addDoc(refs.usuarios, { nombre: 'Admin Principal', username: 'admin', password: '1234', rol: 'admin' });
        } else {
          const loaded = [];
          snapshot.forEach((d) => loaded.push({ id: d.id, ...d.data() }));
          setUsuarios(loaded);
        }
      }, (err) => console.error(err));

      const unsubMovs = onSnapshot(refs.movimientos, (snapshot) => {
        const loaded = [];
        snapshot.forEach((d) => loaded.push({ id: d.id, ...d.data() }));
        loaded.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setMovimientos(loaded);
      }, (err) => console.error(err));

      const unsubClientes = onSnapshot(refs.clientes, (snapshot) => {
        const loaded = [];
        snapshot.forEach((d) => loaded.push({ id: d.id, ...d.data() }));
        setClientes(loaded);
        setIsDBReady(true);
      }, (err) => console.error(err));

      return () => {
        unsubConfig();
        unsubCaja();
        unsubUsuarios();
        unsubMovs();
        unsubClientes();
      };
    };

    let unsubscribeAll = null;
    start().then((unsub) => { unsubscribeAll = unsub; });

    return () => {
      cancelled = true;
      if (typeof unsubscribeAll === 'function') unsubscribeAll();
    };
  }, [firebaseUser]);

  const movimientosDelTurno = useMemo(() => {
    if (caja.estado === 'cerrada' || !caja.fechaApertura) return [];
    return movimientos.filter((m) => new Date(m.fecha) >= new Date(caja.fechaApertura));
  }, [movimientos, caja]);

  const totales = useMemo(() => {
    let ventas = 0;
    let gastos = 0;
    let otrosIngresos = 0;
    let ingresosEfectivo = 0;
    let egresosEfectivo = 0;

    movimientosDelTurno.forEach((m) => {
      if (m.tipo === 'venta') ventas += Number(m.monto || 0);
      if (m.tipo === 'gasto') gastos += Number(m.monto || 0);
      if (m.tipo === 'ingreso_extra') otrosIngresos += Number(m.monto || 0);
      if (m.metodoPago === 'efectivo') {
        if (m.tipo === 'venta' || m.tipo === 'cobro' || m.tipo === 'ingreso_extra') ingresosEfectivo += Number(m.monto || 0);
        if (m.tipo === 'gasto') egresosEfectivo += Number(m.monto || 0);
      }
    });

    return { ventas, gastos, otrosIngresos, balanceEfectivo: ingresosEfectivo - egresosEfectivo, ingresosEfectivo, egresosEfectivo };
  }, [movimientosDelTurno]);

  const saldoActual = Number(caja.efectivoInicial || 0) + totales.balanceEfectivo;

  const movimientosVisualizados = useMemo(() => {
    return movimientosDelTurno.filter((m) => {
      const matchTipo = filtroTipo === 'todos' || m.tipo === filtroTipo;
      let matchFecha = true;
      if (fechaDesde || fechaHasta) {
        const mDate = new Date(m.fecha);
        mDate.setHours(0, 0, 0, 0);
        if (fechaDesde) {
          const d = new Date(`${fechaDesde}T00:00:00`);
          if (mDate < d) matchFecha = false;
        }
        if (fechaHasta) {
          const h = new Date(`${fechaHasta}T00:00:00`);
          if (mDate > h) matchFecha = false;
        }
      }
      return matchTipo && matchFecha;
    });
  }, [movimientosDelTurno, filtroTipo, fechaDesde, fechaHasta]);

  const datosReporte = useMemo(() => {
    const ahora = new Date();
    ahora.setHours(23, 59, 59, 999);
    let inicio = new Date(0);

    if (reporteTiempo === 'hoy') {
      inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
    } else if (reporteTiempo === 'semana') {
      inicio = new Date();
      inicio.setDate(inicio.getDate() - inicio.getDay() + (inicio.getDay() === 0 ? -6 : 1));
      inicio.setHours(0, 0, 0, 0);
    } else if (reporteTiempo === 'mes') {
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      inicio.setHours(0, 0, 0, 0);
    }

    const movsFiltrados = movimientos.filter((m) => {
      const mDate = new Date(m.fecha);
      return mDate >= inicio && mDate <= ahora;
    });

    let ingr = 0;
    let egr = 0;
    let cobros = 0;
    movsFiltrados.forEach((m) => {
      if (m.tipo === 'venta' || m.tipo === 'ingreso_extra') ingr += Number(m.monto || 0);
      if (m.tipo === 'gasto') egr += Number(m.monto || 0);
      if (m.tipo === 'cobro') cobros += Number(m.monto || 0);
    });

    return { movimientos: movsFiltrados, ingresos: ingr, egresos: egr, cobros, neto: ingr + cobros - egr, inicio, fin: ahora };
  }, [movimientos, reporteTiempo]);

  const clientesVisualizados = useMemo(() => {
    if (!busquedaDirectorio.trim()) return clientes;
    const busquedaLower = busquedaDirectorio.toLowerCase();
    return clientes.filter((c) => (c.nombre || '').toLowerCase().includes(busquedaLower));
  }, [clientes, busquedaDirectorio]);

  const limpiarForm = () => setFormData({ monto: '', efectivo: '', cheques: '', tieneCheques: false, descripcion: '', metodoPago: 'efectivo', detallesPago: {} });

  const manejarLogin = (e) => {
    e.preventDefault();
    const user = usuarios.find((u) => u.username === loginForm.username && u.password === loginForm.password);
    if (user) {
      setUsuarioActual(user);
      setLoginForm({ username: '', password: '', error: '' });
      setVista('caja');
    } else {
      setLoginForm((prev) => ({ ...prev, error: 'Usuario o contraseña incorrectos.' }));
    }
  };

  const cerrarSesion = () => {
    if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) setUsuarioActual(null);
  };

  const abrirCaja = async (e) => {
    e.preventDefault();
    await setDoc(refs.caja, {
      estado: 'abierta',
      efectivoInicial: parseFloat(formData.efectivo) || 0,
      chequesInicial: formData.tieneCheques ? (parseFloat(formData.cheques) || 0) : 0,
      fechaApertura: new Date().toISOString(),
    }, { merge: true });
    limpiarForm();
    setModalActivo(null);
  };

  const editarApertura = async (e) => {
    e.preventDefault();
    await setDoc(refs.caja, {
      efectivoInicial: parseFloat(formData.efectivo) || 0,
      chequesInicial: formData.tieneCheques ? (parseFloat(formData.cheques) || 0) : 0,
    }, { merge: true });
    limpiarForm();
    setModalActivo(null);
  };

  const cerrarCaja = async (e) => {
    e.preventDefault();
    await setDoc(refs.caja, { estado: 'cerrada', fechaApertura: null }, { merge: true });
    setMontoCierreReal('');
    setModalActivo(null);
    setVista('caja');
  };

  const guardarConfiguracion = async (e) => {
    e.preventDefault();
    await setDoc(refs.configuracion, configuracion);
    window.alert('Configuración guardada exitosamente');
  };

  const registrarMovimiento = async (e, tipo) => {
    e.preventDefault();
    const monto = parseFloat(formData.monto);
    if (!monto || monto <= 0) return;

    const defaultDesc = tipo === 'venta' ? 'Venta general' : (tipo === 'gasto' ? 'Gasto general' : 'Ingreso / Aporte extra');

    if (formData.metodoPago === 'cuenta_corriente' && (tipo === 'venta' || tipo === 'ingreso_extra')) {
      const nombreCliente = formData.detallesPago.cliente?.trim() || 'Cliente sin nombre';
      const clienteExistente = clientes.find((c) => (c.nombre || '').toLowerCase() === nombreCliente.toLowerCase());
      if (clienteExistente) {
        await updateDoc(doc(db, 'clientes', clienteExistente.id), {
          saldo: Number(clienteExistente.saldo || 0) + monto,
          whatsapp: formData.detallesPago.whatsapp || clienteExistente.whatsapp || '',
        });
      } else {
        await addDoc(refs.clientes, { nombre: nombreCliente, whatsapp: formData.detallesPago.whatsapp || '', saldo: monto });
      }
    }

    await addDoc(refs.movimientos, {
      tipo,
      monto,
      descripcion: formData.descripcion || defaultDesc,
      metodoPago: formData.metodoPago,
      detallesPago: formData.detallesPago,
      fecha: new Date().toISOString(),
      usuario: usuarioActual?.nombre || 'Sistema',
    });

    limpiarForm();
    setModalActivo(null);
  };

  const registrarCobro = async (e) => {
    e.preventDefault();
    const monto = parseFloat(formData.monto);
    if (!monto || monto <= 0) return;

    await updateDoc(doc(db, 'clientes', clienteSeleccionado.id), { saldo: Number(clienteSeleccionado.saldo || 0) - monto });
    await addDoc(refs.movimientos, {
      tipo: 'cobro',
      monto,
      descripcion: `Cobro de deuda a: ${clienteSeleccionado.nombre}`,
      metodoPago: formData.metodoPago,
      detallesPago: { ...formData.detallesPago, clienteId: clienteSeleccionado.id },
      fecha: new Date().toISOString(),
      usuario: usuarioActual?.nombre || 'Sistema',
    });

    limpiarForm();
    setModalActivo(null);
    setClienteSeleccionado(null);
  };

  const confirmarEliminacion = (id) => {
    setMovimientoAEliminar(movimientos.find((m) => m.id === id) || null);
    setModalActivo('confirmar_eliminacion');
  };

  const ejecutarEliminacion = async () => {
    if (!movimientoAEliminar) return;
    const mov = movimientoAEliminar;

    if (mov.tipo === 'cobro' && mov.detallesPago?.clienteId) {
      const cliente = clientes.find((c) => c.id === mov.detallesPago.clienteId);
      if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: Number(cliente.saldo || 0) + Number(mov.monto || 0) });
    }

    if ((mov.tipo === 'venta' || mov.tipo === 'ingreso_extra') && mov.metodoPago === 'cuenta_corriente') {
      const nombreCliente = mov.detallesPago?.cliente?.trim();
      const cliente = clientes.find((c) => (c.nombre || '').toLowerCase() === (nombreCliente || '').toLowerCase());
      if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: Number(cliente.saldo || 0) - Number(mov.monto || 0) });
    }

    await deleteDoc(doc(db, 'movimientos', mov.id));
    setModalActivo(null);
    setMovimientoAEliminar(null);
  };

  const iniciarEdicionMovimiento = (mov) => {
    setMovimientoAEditar(mov);
    setFormData({
      monto: String(mov.monto || ''),
      descripcion: mov.descripcion || '',
      metodoPago: mov.metodoPago || 'efectivo',
      detallesPago: mov.detallesPago || {},
    });
    setModalActivo('editar_movimiento');
  };

  const guardarEdicionMovimiento = async (e) => {
    e.preventDefault();
    const montoEditado = parseFloat(formData.monto);
    if (!montoEditado || montoEditado <= 0 || !movimientoAEditar) return;

    const movOriginal = movimientos.find((m) => m.id === movimientoAEditar.id);
    if (!movOriginal) return;

    if (movOriginal.tipo === 'cobro' && movOriginal.detallesPago?.clienteId) {
      const cliente = clientes.find((c) => c.id === movOriginal.detallesPago.clienteId);
      if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: Number(cliente.saldo || 0) + Number(movOriginal.monto || 0) });
    }

    if ((movOriginal.tipo === 'venta' || movOriginal.tipo === 'ingreso_extra') && movOriginal.metodoPago === 'cuenta_corriente') {
      const nombreCliente = movOriginal.detallesPago?.cliente?.trim();
      const cliente = clientes.find((c) => (c.nombre || '').toLowerCase() === (nombreCliente || '').toLowerCase());
      if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: Number(cliente.saldo || 0) - Number(movOriginal.monto || 0) });
    }

    if (movOriginal.tipo === 'cobro' && movOriginal.detallesPago?.clienteId) {
      const cliente = clientes.find((c) => c.id === movOriginal.detallesPago.clienteId);
      if (cliente) await updateDoc(doc(db, 'clientes', cliente.id), { saldo: Number(cliente.saldo || 0) - montoEditado });
    } else if ((movOriginal.tipo === 'venta' || movOriginal.tipo === 'ingreso_extra') && formData.metodoPago === 'cuenta_corriente') {
      const nombreNuevo = formData.detallesPago?.cliente?.trim() || 'Cliente sin nombre';
      const cliente = clientes.find((c) => (c.nombre || '').toLowerCase() === nombreNuevo.toLowerCase());
      if (cliente) {
        await updateDoc(doc(db, 'clientes', cliente.id), { saldo: Number(cliente.saldo || 0) + montoEditado });
      } else {
        await addDoc(refs.clientes, { nombre: nombreNuevo, whatsapp: formData.detallesPago?.whatsapp || '', saldo: montoEditado });
      }
    }

    await updateDoc(doc(db, 'movimientos', movimientoAEditar.id), {
      monto: montoEditado,
      descripcion: formData.descripcion,
      metodoPago: formData.metodoPago,
      detallesPago: formData.detallesPago,
    });

    setModalActivo(null);
    setMovimientoAEditar(null);
    limpiarForm();
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    if (usuarioAEditar) {
      await updateDoc(doc(db, 'usuarios', usuarioAEditar.id), { ...formUsuario });
    } else {
      await addDoc(refs.usuarios, { ...formUsuario });
    }
    setModalActivo(null);
    setFormUsuario({ nombre: '', username: '', password: '', rol: 'cajero' });
    setUsuarioAEditar(null);
  };

  const eliminarUsuario = async (id) => {
    if (id === usuarioActual?.id) {
      window.alert('No puedes eliminar tu propio usuario mientras estás conectado.');
      return;
    }
    if (window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      await deleteDoc(doc(db, 'usuarios', id));
    }
  };

  const buscarDatosCliente = async (e) => {
    e.preventDefault();
    const documento = formData.detallesPago.documento;
    if (!documento) return;
    setBuscandoCliente(true);

    setTimeout(() => {
      setFormData((prev) => ({
        ...prev,
        detallesPago: { ...prev.detallesPago, cliente: `Cliente Registrado (DNI/CUIT: ${documento})` },
      }));
      setBuscandoCliente(false);
    }, 1200);
  };

  const imprimirReporte = () => {
    window.print();
  };

  const renderBloqueTarjeta = () => (
    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 space-y-3 animate-in fade-in slide-in-from-top-2">
      <p className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1"><CreditCard size={14}/> Datos de la Tarjeta</p>
      <div className="grid grid-cols-2 gap-3">
        <input type="text" placeholder="Ej: Visa / Master" value={formData.detallesPago.marca || ''} onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, marca: e.target.value } })} className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
        <input type="text" maxLength="4" placeholder="Últimos 4 nros." value={formData.detallesPago.ultimos4 || ''} onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, ultimos4: e.target.value } })} className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
      </div>
    </div>
  );

  const renderBloqueCheque = () => (
    <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 space-y-3 animate-in fade-in slide-in-from-top-2">
      <p className="text-xs font-bold text-orange-800 uppercase">Datos del Cheque</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input type="text" placeholder="Emisor / Empresa" value={formData.detallesPago.emisor || ''} onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, emisor: e.target.value } })} className="w-full px-3 py-2 bg-white border border-orange-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" />
        <input type="text" placeholder="Banco (Ej: Galicia)" value={formData.detallesPago.banco || ''} onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, banco: e.target.value } })} className="w-full px-3 py-2 bg-white border border-orange-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Fecha Emisión</label>
          <input type="date" value={formData.detallesPago.fechaEmision || ''} onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, fechaEmision: e.target.value } })} className="w-full px-3 py-2 bg-white border border-orange-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Fecha Cobro</label>
          <input type="date" value={formData.detallesPago.fechaCobro || ''} onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, fechaCobro: e.target.value } })} className="w-full px-3 py-2 bg-white border border-orange-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
      </div>
    </div>
  );

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
              <img src={configuracion.logo} alt="Logo" className="w-20 h-20 object-contain rounded-2xl mb-4 shadow-sm" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ''; e.currentTarget.className = 'hidden'; }} />
            ) : (
              <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200 mb-4"><Store size={40} className="text-white" /></div>
            )}
            <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">{configuracion.nombre || 'SeniorFlow'}</h1>
            <p className="text-gray-500 mt-1 font-medium">Control de Caja y Gestión</p>
          </div>

          <form onSubmit={manejarLogin} className="space-y-4">
            {loginForm.error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100"><AlertCircle size={16} /> {loginForm.error}</div>}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Usuario</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><User size={18} /></span><input type="text" required value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm" placeholder="Ingresa tu usuario" autoComplete="username" /></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Contraseña</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={18} /></span><input type="password" required value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold tracking-widest text-sm" placeholder="••••••••" autoComplete="current-password" /></div>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-transform active:scale-95 mt-2 text-sm uppercase tracking-wider">INGRESAR AL SISTEMA</button>
          </form>
        </div>
      </div>
    );
  }

  const puedeVerSistema = caja.estado === 'abierta' || usuarioActual.rol === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-28 md:pb-8 print:bg-white print:pb-0">
      <header className="bg-white shadow-sm sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            {configuracion.logo ? (
              <img src={configuracion.logo} alt="Logo" className="w-12 h-12 object-contain rounded-xl shadow-sm border border-gray-100 bg-white" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="bg-blue-600 p-2.5 rounded-xl shadow-sm"><Store size={24} className="text-white" /></div>
            )}
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight leading-tight">{configuracion.nombre || 'SeniorFlow'}</h1>
              <p className="text-sm font-medium text-gray-500">{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end bg-gray-50 md:bg-transparent p-2 md:p-0 rounded-2xl">
            <div className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-black shadow-sm ${caja.estado === 'abierta' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
              {caja.estado === 'abierta' ? <Unlock size={16} /> : <Lock size={16} />}
              <span>CAJA {String(caja.estado || '').toUpperCase()}</span>
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

        {puedeVerSistema && (
          <div className="max-w-6xl mx-auto px-4 pb-0 flex gap-2 sm:gap-6 overflow-x-auto border-t border-gray-100 mt-2 scrollbar-hide">
            <button onClick={() => setVista('caja')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'caja' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Wallet size={18}/> Caja Diaria</button>
            <button onClick={() => setVista('clientes')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'clientes' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Users size={18}/> Cuentas Corrientes</button>

            {usuarioActual.rol === 'admin' && (
              <>
                <button onClick={() => setVista('reportes')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'reportes' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><BarChart2 size={18}/> Reportes en la Nube</button>
                <div className="flex-1"></div>
                <button onClick={() => setVista('usuarios')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'usuarios' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><UserCog size={18}/> Usuarios</button>
                <button onClick={() => setVista('configuracion')} className={`py-4 px-2 font-bold text-sm border-b-[3px] transition-colors whitespace-nowrap flex items-center gap-2 ${vista === 'configuracion' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><Settings size={18}/> Configuración</button>
              </>
            )}
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6 print:p-0 print:m-0 print:max-w-none">
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
            <AlertCircle size={24} className="shrink-0" /> Has ingresado al modo de gestión de Administrador. Tienes acceso libre a todo el historial, pero la caja de ventas de hoy se encuentra CERRADA.
          </div>
        )}

        {caja.estado === 'abierta' && vista === 'caja' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div onClick={() => setFiltroTipo('todos')} className={`bg-white p-4 rounded-2xl shadow-sm border flex items-center justify-between relative group cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${filtroTipo === 'todos' ? 'ring-2 ring-blue-500 border-transparent' : 'border-gray-100'}`}>
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-500 mb-1">Efectivo en Caja</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-blue-600 truncate">{formatearDinero(saldoActual)}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs font-bold text-gray-400">Inició con {formatearDinero(caja.efectivoInicial)}</p>
                    {Number(caja.chequesInicial || 0) > 0 && <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md truncate">+{formatearDinero(caja.chequesInicial)} cheques</span>}
                    <button onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, efectivo: String(caja.efectivoInicial || ''), cheques: String(caja.chequesInicial || ''), tieneCheques: Number(caja.chequesInicial || 0) > 0 }); setModalActivo('editar_apertura'); }} className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="Editar apertura"><Edit2 size={12} /></button>
                  </div>
                </div>
                <div className="p-3 rounded-full shrink-0 bg-blue-100"><Wallet size={24} className="text-blue-600" /></div>
              </div>

              <WidgetCard titulo="Ventas Totales" monto={totales.ventas} icono={TrendingUp} colorClase="text-green-600" onClick={() => setFiltroTipo('venta')} activo={filtroTipo === 'venta'} activeClass="ring-2 ring-green-500 border-transparent"/>
              <WidgetCard titulo="Otros Ingresos" monto={totales.otrosIngresos} icono={PlusCircle} colorClase="text-teal-600" onClick={() => setFiltroTipo('ingreso_extra')} activo={filtroTipo === 'ingreso_extra'} activeClass="ring-2 ring-teal-500 border-transparent"/>
              <WidgetCard titulo="Gastos Totales" monto={totales.gastos} icono={TrendingDown} colorClase="text-red-600" onClick={() => setFiltroTipo('gasto')} activo={filtroTipo === 'gasto'} activeClass="ring-2 ring-red-500 border-transparent"/>
            </div>

            <div className="hidden md:flex gap-4 pt-2">
              <button onClick={() => setModalActivo('venta')} className="flex-1 bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95"><Plus size={20} /> Registrar Venta</button>
              <button onClick={() => setModalActivo('ingreso_extra')} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white p-4 rounded-xl font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95"><PlusCircle size={20} /> Otro Ingreso</button>
              <button onClick={() => setModalActivo('gasto')} className="flex-1 bg-red-600 hover:bg-red-700 text-white p-4 rounded-xl font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95"><Minus size={20} /> Registrar Gasto</button>
              <button onClick={() => setModalActivo('cerrar')} className="flex-1 bg-gray-900 hover:bg-black text-white p-4 rounded-xl font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95 border border-gray-900"><Lock size={18} /> Cerrar Caja</button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${filtroTipo !== 'todos' ? 'bg-blue-100' : 'bg-gray-200'}`}><Filter size={20} className={filtroTipo !== 'todos' ? 'text-blue-700' : 'text-gray-600'} /></div>
                  <h3 className="font-bold text-gray-800 text-base uppercase tracking-tight">{filtroTipo === 'todos' ? 'Todos los Movimientos' : `Filtrando: ${String(filtroTipo).replace('_', ' ')}`}</h3>
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
                  movimientosVisualizados.map((mov) => (
                    <div key={mov.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-blue-50/30 transition-colors group">
                      <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                        <div className={`p-3 rounded-xl shrink-0 shadow-sm ${mov.tipo === 'gasto' ? 'bg-red-100 text-red-600' : (mov.tipo === 'cobro' ? 'bg-purple-100 text-purple-600' : (mov.tipo === 'ingreso_extra' ? 'bg-teal-100 text-teal-600' : 'bg-green-100 text-green-600'))}`}>
                          {mov.tipo === 'gasto' ? <TrendingDown size={20} /> : (mov.tipo === 'cobro' ? <Users size={20} /> : (mov.tipo === 'ingreso_extra' ? <PlusCircle size={20} /> : <TrendingUp size={20} />))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 text-base truncate">{mov.descripcion}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                            <span className="flex items-center gap-1 text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded-md"><Clock size={10} /> {formatearHora(mov.fecha)}</span>
                            <span className="bg-gray-100 px-2 py-0.5 rounded-md text-gray-700 capitalize font-bold">{String(mov.metodoPago || '').replace('_', ' ')}</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-gray-500 font-medium">{mov.usuario}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-0 pt-3 sm:pt-0 border-gray-100">
                        <div className={`font-black text-xl whitespace-nowrap tracking-tight ${mov.tipo === 'gasto' ? 'text-red-600' : (mov.tipo === 'cobro' ? 'text-purple-600' : (mov.tipo === 'ingreso_extra' ? 'text-teal-600' : 'text-green-600'))}`}>
                          {mov.tipo === 'gasto' ? '-' : '+'}{formatearDinero(mov.monto)}
                        </div>
                        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1">
                          <button onClick={() => iniciarEdicionMovimiento(mov)} className="p-2 bg-white border shadow-sm text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-lg transition-all" title="Editar"><Edit2 size={16} /></button>
                          <button onClick={() => confirmarEliminacion(mov.id)} className="p-2 bg-white border shadow-sm text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg transition-all" title="Eliminar"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {puedeVerSistema && vista === 'clientes' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
            <WidgetCard titulo="Total Adeudado General" monto={clientes.reduce((acc, c) => acc + Number(c.saldo || 0), 0)} icono={Users} colorClase="text-purple-600" subtitulo={`${clientes.filter((c) => Number(c.saldo || 0) > 0).length} clientes activos con deuda pendiente`} />
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2 tracking-tight">
                  <div className="bg-purple-600 p-1.5 rounded-lg"><Users size={16} className="text-white" /></div> Directorio de Clientes
                </h3>
                <div className="relative w-full sm:w-auto">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></span>
                  <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={busquedaDirectorio}
                    onChange={(e) => setBusquedaDirectorio(e.target.value)}
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
                          <a href={`https://wa.me/${String(cliente.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-md flex items-center gap-1.5 hover:bg-green-100 transition-colors w-max"><Phone size={12} /> {cliente.whatsapp}</a>
                        ) : (
                          <span className="text-xs font-bold text-gray-400 bg-gray-50 border px-2.5 py-1 rounded-md flex items-center gap-1.5 w-max"><Phone size={12}/> Sin número guardado</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-0 pt-3 sm:pt-0 border-gray-100">
                        <div className="text-left sm:text-right bg-gray-50 px-3 py-1.5 rounded-lg border">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Saldo pendiente</p>
                          <p className={`font-black text-xl tracking-tight ${Number(cliente.saldo || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatearDinero(cliente.saldo)}</p>
                        </div>
                        <button disabled={Number(cliente.saldo || 0) <= 0 || caja.estado === 'cerrada'} onClick={() => { setClienteSeleccionado(cliente); setModalActivo('cobro'); setFormData({ monto: String(cliente.saldo || ''), descripcion: '', metodoPago: 'efectivo', detallesPago: {} }); }} className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95 uppercase tracking-wider">
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

        {puedeVerSistema && vista === 'reportes' && usuarioActual.rol === 'admin' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
              <div className="flex flex-col gap-3 w-full md:w-auto">
                <div className="flex gap-2 bg-slate-100 p-1 rounded-lg self-start">
                  <button onClick={() => setReporteTipo('general')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${reporteTipo === 'general' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-800'}`}>BALANCE DE CAJA</button>
                  <button onClick={() => setReporteTipo('clientes')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${reporteTipo === 'clientes' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-800'}`}>CTAS CORRIENTES</button>
                </div>
                {reporteTipo === 'general' && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setReporteTiempo('hoy')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reporteTiempo === 'hoy' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Hoy</button>
                    <button onClick={() => setReporteTiempo('semana')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reporteTiempo === 'semana' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Semana</button>
                    <button onClick={() => setReporteTiempo('mes')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reporteTiempo === 'mes' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Mes</button>
                    <button onClick={() => setReporteTiempo('todo')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reporteTiempo === 'todo' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Todo el Histórico</button>
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
                    <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">{configuracion.nombre || 'SENIORFLOW'}</h1>
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <WidgetCard titulo="Ingresos Totales" monto={datosReporte.ingresos} icono={TrendingUp} colorClase="text-green-600" printOculto={false} />
                    <WidgetCard titulo="Cobros (Cuentas)" monto={datosReporte.cobros} icono={Users} colorClase="text-purple-600" printOculto={false} />
                    <WidgetCard titulo="Egresos Totales" monto={datosReporte.egresos} icono={TrendingDown} colorClase="text-red-600" printOculto={false} />
                    <WidgetCard titulo="Balance Neto" monto={datosReporte.neto} icono={Wallet} colorClase={datosReporte.neto >= 0 ? 'text-blue-600' : 'text-red-600'} printOculto={false} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">Desglose de Movimientos</h3>
                  {datosReporte.movimientos.length === 0 ? (
                    <p className="text-gray-500 text-center py-6 font-medium text-sm">No hay registros en este período.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-600">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 print:bg-transparent font-bold">
                          <tr><th className="px-4 py-3">Fecha/Hora</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Descripción</th><th className="px-4 py-3">Medio</th><th className="px-4 py-3">Cajero</th><th className="px-4 py-3 text-right">Monto</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-medium">
                          {datosReporte.movimientos.map((m) => (
                            <tr key={m.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                              <td className="px-4 py-3 whitespace-nowrap">{formatearFecha(m.fecha)} {formatearHora(m.fecha)}</td>
                              <td className="px-4 py-3 font-bold"><span className={`text-[10px] uppercase tracking-wider ${m.tipo === 'gasto' ? 'text-red-600' : (m.tipo === 'cobro' ? 'text-purple-600' : 'text-green-600')}`}>{String(m.tipo).replace('_', ' ')}</span></td>
                              <td className="px-4 py-3 font-bold text-gray-800">{m.descripcion}</td>
                              <td className="px-4 py-3 capitalize">{String(m.metodoPago || '').replace('_', ' ')}</td>
                              <td className="px-4 py-3 text-gray-500">{m.usuario || '-'}</td>
                              <td className={`px-4 py-3 text-right font-black whitespace-nowrap ${m.tipo === 'gasto' ? 'text-red-600' : 'text-green-600'}`}>{m.tipo === 'gasto' ? '-' : '+'}{formatearDinero(m.monto)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {reporteTipo === 'clientes' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <WidgetCard titulo="Total Deuda" monto={clientes.reduce((acc, c) => acc + Number(c.saldo || 0), 0)} icono={Users} colorClase="text-purple-600" printOculto={false} />
                    <WidgetCard titulo="Clientes con Deuda" monto={clientes.filter((c) => Number(c.saldo || 0) > 0).length} icono={AlertCircle} colorClase="text-orange-600" printOculto={false} />
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
                          {clientes.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                              <td className="px-4 py-3 font-bold text-gray-900">{c.nombre}</td>
                              <td className="px-4 py-3">{c.whatsapp || '-'}</td>
                              <td className="px-4 py-3 text-right">{Number(c.saldo || 0) > 0 ? <span className="text-red-600 font-bold text-xs uppercase tracking-wider">Mora</span> : <span className="text-green-600 font-bold text-xs uppercase tracking-wider">Al Día</span>}</td>
                              <td className={`px-4 py-3 text-right font-black text-base whitespace-nowrap ${Number(c.saldo || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatearDinero(c.saldo)}</td>
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
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Store size={18} /></span><input type="text" required value={configuracion.nombre} onChange={(e) => setConfiguracion({ ...configuracion, nombre: e.target.value })} className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none font-bold text-sm text-gray-900" /></div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Logotipo Corporativo (URL)</label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><ImageIcon size={18} /></span><input type="url" value={configuracion.logo} onChange={(e) => setConfiguracion({ ...configuracion, logo: e.target.value })} className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none font-medium text-sm text-blue-600" placeholder="https://..." /></div>
                </div>
                {configuracion.logo && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center gap-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vista Previa</p><img src={configuracion.logo} alt="Logo" className="max-w-[120px] max-h-[120px] object-contain rounded-lg shadow-sm bg-white p-1 border" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.style.display = 'none'; }}/></div>
                )}
                <button type="submit" className="w-full bg-slate-800 hover:bg-black text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-wider mt-2"><Save size={18} /> APLICAR CAMBIOS</button>
              </form>
            </div>
          </div>
        )}

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
                    {usuarios.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-bold text-gray-900">{u.nombre}</td>
                        <td className="px-5 py-3"><code className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded-md text-xs">{u.username}</code></td>
                        <td className="px-5 py-3"><span className="text-gray-400 font-mono tracking-widest bg-gray-50 px-2 py-1 rounded-md border text-xs">{String(u.password || '').replace(/./g, '•')}</span></td>
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

      {caja.estado === 'abierta' && vista === 'caja' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 pb-safe flex gap-2 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)] z-40 print:hidden">
          <button onClick={() => setModalActivo('venta')} className="flex-1 bg-green-600 text-white p-2.5 rounded-xl font-bold flex flex-col items-center gap-1 shadow-sm"><Plus size={20} /> <span className="text-[9px] uppercase tracking-wider">Venta</span></button>
          <button onClick={() => setModalActivo('ingreso_extra')} className="flex-1 bg-teal-600 text-white p-2.5 rounded-xl font-bold flex flex-col items-center gap-1 shadow-sm"><PlusCircle size={20} /> <span className="text-[9px] uppercase tracking-wider">Ingreso</span></button>
          <button onClick={() => setModalActivo('gasto')} className="flex-1 bg-red-600 text-white p-2.5 rounded-xl font-bold flex flex-col items-center gap-1 shadow-sm"><Minus size={20} /> <span className="text-[9px] uppercase tracking-wider">Gasto</span></button>
          <button onClick={() => setModalActivo('cerrar')} className="flex-1 bg-gray-900 text-white p-2.5 rounded-xl font-bold flex flex-col items-center gap-1 shadow-sm"><Lock size={20} /> <span className="text-[9px] uppercase tracking-wider">Cerrar</span></button>
        </div>
      )}

      {(modalActivo === 'nuevo_usuario' || modalActivo === 'editar_usuario') && (
        <Modal titulo={modalActivo === 'nuevo_usuario' ? 'Crear Nuevo Usuario' : 'Editar Usuario'} onClose={() => { setModalActivo(null); setUsuarioAEditar(null); }}>
          <form onSubmit={guardarUsuario} className="space-y-4">
            <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nombre del Empleado</label><input type="text" required value={formUsuario.nombre} onChange={(e) => setFormUsuario({ ...formUsuario, nombre: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none font-bold text-sm" placeholder="Ej: Juan Pérez" autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Usuario (Login)</label><input type="text" required value={formUsuario.username} onChange={(e) => setFormUsuario({ ...formUsuario, username: e.target.value.toLowerCase().replace(/\s+/g, '') })} className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none font-bold text-blue-800 text-sm" placeholder="Ej: jperez" /></div>
              <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Contraseña / PIN</label><input type="text" required value={formUsuario.password} onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none font-bold tracking-widest text-sm" placeholder="1234" minLength="3"/></div>
            </div>
            <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nivel de Permisos</label><select value={formUsuario.rol} onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none font-bold text-gray-800 text-sm"><option value="cajero">Cajero (Solo opera caja)</option><option value="admin">Administrador (Acceso total)</option></select></div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg mt-4 shadow-sm text-sm uppercase">{modalActivo === 'nuevo_usuario' ? 'GUARDAR NUEVO USUARIO' : 'ACTUALIZAR USUARIO'}</button>
          </form>
        </Modal>
      )}

      {modalActivo === 'abrir' && (
        <Modal titulo="Apertura de Caja" onClose={() => setModalActivo(null)}>
          <form onSubmit={abrirCaja} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Efectivo en billetes</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">$</span><input type="number" step="0.01" min="0" required value={formData.efectivo} onChange={(e) => setFormData({ ...formData, efectivo: e.target.value })} className="w-full pl-10 pr-4 py-2.5 bg-blue-50/50 border border-blue-200 rounded-xl focus:ring-1 focus:border-blue-600 outline-none text-2xl font-bold text-blue-800" autoFocus /></div>
              <div className="text-[10px] text-blue-700 font-bold mt-1 uppercase">{numeroALetras(parseFloat(formData.efectivo) || 0)}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.tieneCheques} onChange={(e) => setFormData({ ...formData, tieneCheques: e.target.checked })} className="w-5 h-5 text-blue-600 border-gray-300 rounded-md focus:ring-blue-500"/><span className="text-sm font-bold text-gray-800">Tengo cheques en caja</span></label>
              {formData.tieneCheques && (
                <div className="mt-3 pt-3 border-t border-gray-200 animate-in fade-in"><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Total en cheques</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span><input type="number" step="0.01" min="0.01" required={formData.tieneCheques} value={formData.cheques} onChange={(e) => setFormData({ ...formData, cheques: e.target.value })} className="w-full pl-9 pr-3 py-2 bg-orange-50 border border-orange-200 rounded-lg focus:ring-1 focus:border-orange-500 outline-none text-lg font-bold text-orange-800" /></div></div>
              )}
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl mt-4 shadow-sm text-sm uppercase">CONFIRMAR APERTURA</button>
          </form>
        </Modal>
      )}

      {modalActivo === 'editar_apertura' && (
        <Modal titulo="Editar Fondo Inicial" onClose={() => setModalActivo(null)}>
          <form onSubmit={editarApertura} className="space-y-4">
            <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Efectivo inicial</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">$</span><input type="number" step="0.01" min="0" required value={formData.efectivo} onChange={(e) => setFormData({ ...formData, efectivo: e.target.value })} className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:border-blue-600 outline-none text-2xl font-bold text-gray-800" autoFocus /></div></div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.tieneCheques} onChange={(e) => setFormData({ ...formData, tieneCheques: e.target.checked })} className="w-5 h-5 text-blue-600 border-gray-300 rounded-md focus:ring-blue-500"/><span className="text-sm font-bold text-gray-800">Tengo cheques</span></label>
              {formData.tieneCheques && (
                <div className="mt-3 pt-3 border-t border-gray-200 animate-in fade-in"><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Total en cheques</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span><input type="number" step="0.01" min="0.01" required={formData.tieneCheques} value={formData.cheques} onChange={(e) => setFormData({ ...formData, cheques: e.target.value })} className="w-full pl-9 pr-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-lg font-bold text-orange-800" /></div></div>
              )}
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl mt-4 flex items-center justify-center gap-2 text-sm uppercase"><Save size={18} /> GUARDAR CAMBIOS</button>
          </form>
        </Modal>
      )}

      {(modalActivo === 'venta' || modalActivo === 'gasto' || modalActivo === 'ingreso_extra') && (
        <Modal titulo={modalActivo === 'venta' ? 'Registrar Venta (Ingreso)' : (modalActivo === 'gasto' ? 'Registrar Gasto (Egreso)' : 'Otro Ingreso')} onClose={() => setModalActivo(null)}>
          <form onSubmit={(e) => registrarMovimiento(e, modalActivo)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Monto de la Operación</label>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl ${modalActivo === 'venta' ? 'text-green-500' : (modalActivo === 'ingreso_extra' ? 'text-teal-500' : 'text-red-500')}`}>$</span>
                <input type="number" step="0.01" min="0.01" required value={formData.monto} onChange={(e) => setFormData({ ...formData, monto: e.target.value })} className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-0 outline-none text-3xl font-black tracking-tight ${modalActivo === 'venta' ? 'bg-green-50/50 border-green-200 text-green-700 focus:border-green-600' : (modalActivo === 'ingreso_extra' ? 'bg-teal-50/50 border-teal-200 text-teal-700 focus:border-teal-600' : 'bg-red-50/50 border-red-200 text-red-700 focus:border-red-600')}`} autoFocus/>
              </div>
              <div className={`text-[10px] font-bold mt-1 uppercase ${modalActivo === 'venta' ? 'text-green-700' : (modalActivo === 'ingreso_extra' ? 'text-teal-700' : 'text-red-700')}`}>{numeroALetras(parseFloat(formData.monto) || 0)}</div>
            </div>

            <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Descripción / Detalle</label><input type="text" required value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none font-bold text-sm" placeholder="Ej: Venta mercadería / Pago luz" /></div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Forma de Pago</label>
              <select value={formData.metodoPago} onChange={(e) => setFormData({ ...formData, metodoPago: e.target.value, detallesPago: {} })} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:border-blue-600 outline-none font-bold text-sm text-gray-800 shadow-sm cursor-pointer hover:bg-gray-50">
                <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="cheque">Cheque</option><option value="cuenta_corriente">Cuenta Corriente (Fiado)</option>
              </select>
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
                      <input type="text" placeholder="Sin guiones" value={formData.detallesPago.documento || ''} onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, documento: e.target.value.replace(/\D/g, '') } })} className="w-full px-3 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"/>
                      <button type="button" onClick={buscarDatosCliente} disabled={buscandoCliente || !formData.detallesPago.documento} className="bg-purple-600 text-white px-4 rounded-lg flex justify-center items-center disabled:opacity-50">{buscandoCliente ? <span className="text-xs">...</span> : <Search size={16}/>}</button>
                    </div>
                  </div>
                  <input type="text" required placeholder="Nombre completo" value={formData.detallesPago.cliente || ''} onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, cliente: e.target.value } })} className="w-full px-3 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"/>
                  <input type="text" placeholder="WhatsApp (Opcional)" value={formData.detallesPago.whatsapp || ''} onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, whatsapp: e.target.value } })} className="w-full px-3 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"/>
                </div>
              </div>
            )}
            <button type="submit" className={`w-full font-bold text-base py-3 px-4 rounded-xl mt-6 text-white shadow-sm transition-transform active:scale-95 uppercase tracking-wide ${modalActivo === 'venta' ? 'bg-green-600 hover:bg-green-700' : (modalActivo === 'ingreso_extra' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-red-600 hover:bg-red-700')}`}>GUARDAR OPERACIÓN</button>
          </form>
        </Modal>
      )}

      {modalActivo === 'editar_movimiento' && movimientoAEditar && (
        <Modal titulo="Corrección de Movimiento" onClose={() => { setModalActivo(null); setMovimientoAEditar(null); }}>
          <form onSubmit={guardarEdicionMovimiento} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Monto</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xl">$</span><input type="number" step="0.01" min="0.01" required value={formData.monto} onChange={(e) => setFormData({ ...formData, monto: e.target.value })} className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 outline-none text-2xl font-black" autoFocus/></div>
            </div>
            <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Descripción</label><input type="text" required value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-blue-600" /></div>

            {movimientoAEditar.tipo !== 'cobro' && (
              <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Método de Pago</label><select value={formData.metodoPago} onChange={(e) => setFormData({ ...formData, metodoPago: e.target.value, detallesPago: {} })} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-blue-600 capitalize"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="cheque">Cheque</option><option value="cuenta_corriente">Cuenta Corriente</option></select></div>
            )}

            {formData.metodoPago === 'tarjeta' && renderBloqueTarjeta()}
            {formData.metodoPago === 'cheque' && renderBloqueCheque()}
            {formData.metodoPago === 'cuenta_corriente' && movimientoAEditar.tipo !== 'cobro' && (
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 space-y-2"><input type="text" placeholder="Nombre Cliente" required value={formData.detallesPago.cliente || ''} onChange={(e) => setFormData({ ...formData, detallesPago: { ...formData.detallesPago, cliente: e.target.value } })} className="w-full px-3 py-2 bg-white rounded-lg text-sm font-bold border border-purple-100 outline-none"/></div>
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
                  {parseFloat(montoCierreReal) === saldoActual ? <p className="font-black text-sm">CIERRE PERFECTO</p> : <><p className="font-black text-sm">DIFERENCIA: {formatearDinero(Math.abs(parseFloat(montoCierreReal) - saldoActual))}</p></>}
                </div>
              </div>
            )}
            <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 px-4 rounded-xl mt-4 flex justify-center items-center gap-2 text-sm uppercase tracking-wide"><Lock size={18} /> FINALIZAR TURNO AHORA</button>
          </form>
        </Modal>
      )}

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
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xl">$</span><input type="number" step="0.01" min="0.01" max={clienteSeleccionado.saldo} required value={formData.monto} onChange={(e) => setFormData({ ...formData, monto: e.target.value })} className="w-full pl-10 pr-4 py-3 bg-white border-2 border-purple-200 rounded-xl text-2xl font-black text-purple-700 outline-none focus:border-purple-600" autoFocus/></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1 uppercase">Forma de Pago del Cliente</label>
              <select value={formData.metodoPago} onChange={(e) => setFormData({ ...formData, metodoPago: e.target.value, detallesPago: {} })} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-600">
                <option value="efectivo">Efectivo Físico</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="cheque">Cheque</option>
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

createRoot(document.getElementById('root')).render(<App />);
