import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  limit
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const state = {
  currentUser: null,
  role: null,
  unsubscribers: []
};

const views = ['dashboard', 'caja', 'ventas', 'gastos', 'stock', 'cuentas', 'usuarios', 'config'];
const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const loginView = document.getElementById('loginView');
const appView = document.getElementById('appView');
const sectionTitle = document.getElementById('sectionTitle');
const todayLabel = document.getElementById('todayLabel');
const userNameEl = document.getElementById('userName');
const userRoleEl = document.getElementById('userRole');
const seedHelp = document.getElementById('seedHelp');

const installBtn = document.getElementById('installBtn');
const installToast = document.getElementById('installToast');
let deferredPrompt = null;

const isFirebaseConfigured = !Object.values(firebaseConfig).some(v => !v || v === 'PEGAR_AQUI');

let app, auth, db;
if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  document.getElementById('showSeedHelp').classList.remove('hidden');
}

document.getElementById('showSeedHelp').addEventListener('click', () => seedHelp.classList.toggle('hidden'));

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isFirebaseConfigured) return alert('Primero completá firebase-config.js');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert('No se pudo iniciar sesión: ' + friendlyError(error));
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (auth) await signOut(auth);
});

document.getElementById('menuNav').addEventListener('click', (e) => {
  const btn = e.target.closest('.menu-item');
  if (!btn) return;
  document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
  btn.classList.add('active');
  showView(btn.dataset.view);
});

function showView(name) {
  views.forEach(view => document.getElementById(view + 'View').classList.add('hidden'));
  document.getElementById(name + 'View').classList.remove('hidden');
  const labels = {
    dashboard: 'Inicio', caja: 'Caja', ventas: 'Ventas', gastos: 'Gastos', stock: 'Stock', cuentas: 'Cuentas corrientes', usuarios: 'Usuarios', config: 'Configuración'
  };
  sectionTitle.textContent = labels[name];
}

todayLabel.textContent = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

function clearListeners() {
  state.unsubscribers.forEach(fn => fn && fn());
  state.unsubscribers = [];
}

if (isFirebaseConfigured) {
  onAuthStateChanged(auth, async (user) => {
    clearListeners();
    if (!user) {
      loginView.classList.remove('hidden');
      appView.classList.add('hidden');
      state.currentUser = null;
      return;
    }

    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (!userSnap.exists() || userSnap.data().active === false) {
      await signOut(auth);
      alert('Tu usuario no tiene permisos o está inactivo.');
      return;
    }

    const profile = userSnap.data();
    state.currentUser = { uid: user.uid, email: user.email, ...profile };
    state.role = profile.role || 'usuario';
    userNameEl.textContent = profile.name || user.email;
    userRoleEl.textContent = state.role;

    loginView.classList.add('hidden');
    appView.classList.remove('hidden');

    setupForms();
    subscribeDashboard();
    subscribeCaja();
    subscribeVentas();
    subscribeGastos();
    subscribeStock();
    subscribeCuentas();
    subscribeUsers();
  });
}

function setupForms() {
  bindSubmit('cajaForm', async () => {
    await addDoc(collection(db, 'cash_movements'), {
      type: val('cajaTipo'),
      amount: numberVal('cajaMonto'),
      detail: val('cajaDetalle'),
      userName: state.currentUser.name || state.currentUser.email,
      createdAt: serverTimestamp(),
      dateKey: dayKey()
    });
    resetForm('cajaForm');
  });

  bindSubmit('ventasForm', async () => {
    await addDoc(collection(db, 'sales'), {
      amount: numberVal('ventaMonto'),
      paymentMethod: val('ventaMedio'),
      client: val('ventaCliente'),
      reference: val('ventaRef'),
      userName: state.currentUser.name || state.currentUser.email,
      createdAt: serverTimestamp(),
      dateKey: dayKey()
    });
    resetForm('ventasForm');
  });

  bindSubmit('gastosForm', async () => {
    await addDoc(collection(db, 'expenses'), {
      amount: numberVal('gastoMonto'),
      category: val('gastoCategoria'),
      paymentMethod: val('gastoMedio'),
      detail: val('gastoDetalle'),
      userName: state.currentUser.name || state.currentUser.email,
      createdAt: serverTimestamp(),
      dateKey: dayKey()
    });
    resetForm('gastosForm');
  });

  bindSubmit('stockForm', async () => {
    const id = val('stockCodigo');
    await setDoc(doc(db, 'products', id), {
      code: id,
      name: val('stockNombre'),
      category: val('stockCategoria'),
      quantity: numberVal('stockCantidad'),
      minStock: numberVal('stockMinimo'),
      cost: numberVal('stockCosto'),
      updatedAt: serverTimestamp(),
      updatedBy: state.currentUser.name || state.currentUser.email
    }, { merge: true });
    resetForm('stockForm');
  });

  bindSubmit('ctasForm', async () => {
    await addDoc(collection(db, 'account_movements'), {
      client: val('ctaCliente'),
      type: val('ctaTipo'),
      amount: numberVal('ctaMonto'),
      detail: val('ctaDetalle'),
      userName: state.currentUser.name || state.currentUser.email,
      createdAt: serverTimestamp(),
      dateKey: dayKey()
    });
    resetForm('ctasForm');
  });
}

function bindSubmit(formId, handler) {
  const form = document.getElementById(formId);
  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await handler();
    } catch (error) {
      alert('No se pudo guardar: ' + friendlyError(error));
    }
  };
}

function subscribeDashboard() {
  const qSales = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(50));
  const qExpenses = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(50));
  const qCash = query(collection(db, 'cash_movements'), orderBy('createdAt', 'desc'), limit(50));
  const qProducts = query(collection(db, 'products'), orderBy('updatedAt', 'desc'), limit(100));
  const qAccounts = query(collection(db, 'account_movements'), orderBy('createdAt', 'desc'), limit(200));

  const buffer = { sales: [], expenses: [], cash: [], products: [], accounts: [] };
  const refresh = () => renderDashboard(buffer);

  state.unsubscribers.push(onSnapshot(qSales, snap => { buffer.sales = snap.docs.map(mapDoc); refresh(); }));
  state.unsubscribers.push(onSnapshot(qExpenses, snap => { buffer.expenses = snap.docs.map(mapDoc); refresh(); }));
  state.unsubscribers.push(onSnapshot(qCash, snap => { buffer.cash = snap.docs.map(mapDoc); refresh(); }));
  state.unsubscribers.push(onSnapshot(qProducts, snap => { buffer.products = snap.docs.map(mapDoc); refresh(); }));
  state.unsubscribers.push(onSnapshot(qAccounts, snap => { buffer.accounts = snap.docs.map(mapDoc); refresh(); }));
}

function renderDashboard(data) {
  const today = dayKey();
  const salesToday = data.sales.filter(x => x.dateKey === today);
  const expensesToday = data.expenses.filter(x => x.dateKey === today);
  const cashToday = data.cash.filter(x => x.dateKey === today);
  const transferToday = salesToday.filter(x => x.paymentMethod === 'transferencia').reduce(sumBy('amount'), 0);
  const stockLow = data.products.filter(x => Number(x.quantity || 0) <= Number(x.minStock || 0));

  const opening = cashToday.filter(x => x.type === 'apertura').reduce(sumBy('amount'), 0);
  const cashIn = cashToday.filter(x => ['ingreso'].includes(x.type)).reduce(sumBy('amount'), 0);
  const cashOut = cashToday.filter(x => ['egreso', 'retiro'].includes(x.type)).reduce(sumBy('amount'), 0);
  const salesTotal = salesToday.reduce(sumBy('amount'), 0);
  const expensesTotal = expensesToday.reduce(sumBy('amount'), 0);
  const expectedCash = opening + cashIn + salesToday.filter(x => x.paymentMethod === 'efectivo').reduce(sumBy('amount'), 0) - cashOut - expensesToday.filter(x => (x.paymentMethod || '').toLowerCase().includes('efectivo')).reduce(sumBy('amount'), 0);

  const accountBalances = groupAccountBalances(data.accounts);
  const totalToCollect = Object.values(accountBalances).reduce((acc, n) => acc + n, 0);

  text('metricVentas', currency.format(salesTotal));
  text('metricGastos', currency.format(expensesTotal));
  text('metricCaja', currency.format(expectedCash));
  text('metricCtas', currency.format(totalToCollect));
  text('metricStockBajo', String(stockLow.length));
  text('metricTransfer', currency.format(transferToday));

  const latestMoves = [...salesToday.slice(0, 3).map(x => ({ label: 'Venta', detail: x.reference || x.client || '-', amount: x.amount })), ...expensesToday.slice(0, 3).map(x => ({ label: 'Gasto', detail: x.detail, amount: -x.amount }))].slice(0, 6);
  renderSimpleList('movimientosResumen', latestMoves.map(item => ({
    title: `${item.label} · ${item.detail}`,
    meta: currency.format(item.amount)
  })), 'Sin movimientos hoy');

  const alerts = [];
  if (stockLow.length) alerts.push({ title: `${stockLow.length} producto(s) con stock bajo`, meta: 'Revisar mercadería' });
  const overdueClients = Object.entries(accountBalances).filter(([, balance]) => balance > 0);
  if (overdueClients.length) alerts.push({ title: `${overdueClients.length} cliente(s) con saldo pendiente`, meta: currency.format(totalToCollect) });
  if (!alerts.length) alerts.push({ title: 'Todo en orden', meta: 'Sin alertas críticas' });
  renderSimpleList('alertasResumen', alerts, 'Sin alertas');
}

function subscribeCaja() {
  const q = query(collection(db, 'cash_movements'), orderBy('createdAt', 'desc'), limit(100));
  state.unsubscribers.push(onSnapshot(q, snap => {
    const rows = snap.docs.map(mapDoc);
    const todayRows = rows.filter(x => x.dateKey === dayKey());
    const apertura = todayRows.filter(x => x.type === 'apertura').reduce(sumBy('amount'), 0);
    const ingresos = todayRows.filter(x => ['ingreso'].includes(x.type)).reduce(sumBy('amount'), 0);
    const egresos = todayRows.filter(x => ['egreso', 'retiro'].includes(x.type)).reduce(sumBy('amount'), 0);
    text('cajaApertura', currency.format(apertura));
    text('cajaIngresos', currency.format(ingresos));
    text('cajaEgresos', currency.format(egresos));
    text('cajaCierre', currency.format(apertura + ingresos - egresos));

    renderRichList('cajaList', rows, row => ({
      title: row.detail,
      meta: `${capitalize(row.type)} · ${formatDate(row.createdAt)}`,
      value: currency.format(row.amount)
    }), 'Sin movimientos de caja');
  }));
}

function subscribeVentas() {
  const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(100));
  state.unsubscribers.push(onSnapshot(q, snap => {
    const rows = snap.docs.map(mapDoc);
    renderRichList('ventasList', rows, row => ({
      title: row.client || 'Venta sin cliente',
      meta: `${capitalize(row.paymentMethod)} · ${row.reference || 'Sin referencia'} · ${formatDate(row.createdAt)}`,
      value: currency.format(row.amount)
    }), 'Sin ventas cargadas');
  }));
}

function subscribeGastos() {
  const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(100));
  state.unsubscribers.push(onSnapshot(q, snap => {
    const rows = snap.docs.map(mapDoc);
    renderRichList('gastosList', rows, row => ({
      title: row.detail,
      meta: `${row.category || 'Sin categoría'} · ${row.paymentMethod || 'Sin medio'} · ${formatDate(row.createdAt)}`,
      value: currency.format(row.amount)
    }), 'Sin gastos cargados');
  }));
}

function subscribeStock() {
  const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'), limit(200));
  state.unsubscribers.push(onSnapshot(q, snap => {
    const rows = snap.docs.map(mapDoc);
    const list = document.getElementById('stockList');
    if (!rows.length) return list.innerHTML = '<div class="list-item"><div>Sin productos cargados</div></div>';
    list.innerHTML = rows.map(row => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(row.name || row.code)}</strong>
          <div class="meta">${escapeHtml(row.code || '')} · ${escapeHtml(row.category || 'Sin categoría')}</div>
        </div>
        <div>
          <span class="badge ${Number(row.quantity || 0) <= Number(row.minStock || 0) ? 'warn' : 'ok'}">Stock: ${Number(row.quantity || 0)}</span>
        </div>
      </div>
    `).join('');
  }));
}

function subscribeCuentas() {
  const q = query(collection(db, 'account_movements'), orderBy('createdAt', 'desc'), limit(300));
  state.unsubscribers.push(onSnapshot(q, snap => {
    const rows = snap.docs.map(mapDoc);
    const balances = groupAccountBalances(rows);
    const entries = Object.entries(balances).sort((a, b) => b[1] - a[1]);
    const list = document.getElementById('ctasList');
    if (!entries.length) return list.innerHTML = '<div class="list-item"><div>Sin movimientos de cuentas corrientes</div></div>';
    list.innerHTML = entries.map(([client, balance]) => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(client)}</strong>
          <div class="meta">Saldo actualizado automáticamente</div>
        </div>
        <div>${currency.format(balance)}</div>
      </div>
    `).join('');
  }));
}

function subscribeUsers() {
  if (state.role !== 'admin') {
    document.querySelector('[data-view="usuarios"]').classList.add('hidden');
    return;
  }
  const q = query(collection(db, 'users'));
  state.unsubscribers.push(onSnapshot(q, snap => {
    const rows = snap.docs.map(mapDoc);
    renderRichList('usersList', rows, row => ({
      title: row.name || row.email || row.id,
      meta: `${row.role || 'sin rol'} · ${row.active === false ? 'inactivo' : 'activo'}`,
      value: row.email || ''
    }), 'Sin usuarios');
  }));
}

function groupAccountBalances(rows) {
  return rows.reduce((acc, row) => {
    const key = row.client || 'Sin nombre';
    const sign = ['cargo', 'saldo-inicial'].includes(row.type) ? 1 : -1;
    acc[key] = (acc[key] || 0) + sign * Number(row.amount || 0);
    return acc;
  }, {});
}

function renderSimpleList(id, rows, emptyMsg) {
  const el = document.getElementById(id);
  if (!rows.length) return el.innerHTML = `<div class="list-item"><div>${emptyMsg}</div></div>`;
  el.innerHTML = rows.map(row => `
    <div class="list-item">
      <div>
        <strong>${escapeHtml(row.title)}</strong>
        <div class="meta">${escapeHtml(row.meta)}</div>
      </div>
    </div>
  `).join('');
}

function renderRichList(id, rows, mapper, emptyMsg) {
  const el = document.getElementById(id);
  if (!rows.length) return el.innerHTML = `<div class="list-item"><div>${emptyMsg}</div></div>`;
  el.innerHTML = rows.map(item => {
    const row = mapper(item);
    return `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(row.title)}</strong>
          <div class="meta">${escapeHtml(row.meta)}</div>
        </div>
        <div>${escapeHtml(row.value)}</div>
      </div>
    `;
  }).join('');
}

function mapDoc(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

function text(id, value) { document.getElementById(id).textContent = value; }
function val(id) { return document.getElementById(id).value.trim(); }
function numberVal(id) { return Number(document.getElementById(id).value || 0); }
function resetForm(id) { document.getElementById(id).reset(); }
function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
function sumBy(field) { return (acc, row) => acc + Number(row[field] || 0); }
function capitalize(str = '') { return str.charAt(0).toUpperCase() + str.slice(1); }
function formatDate(ts) {
  const date = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
  return date ? date.toLocaleString('es-AR') : 'recién';
}
function friendlyError(error) {
  const code = error?.code || '';
  if (code.includes('invalid-credential')) return 'credenciales inválidas';
  if (code.includes('permission-denied')) return 'sin permisos';
  return error?.message || 'error inesperado';
}
function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installToast.classList.remove('hidden');
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installToast.classList.add('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
