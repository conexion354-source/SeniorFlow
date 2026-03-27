import { auth, db } from './firebase-config.js';
import { signInAnonymously, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const state = {
  authReady: false,
  authUser: null,
  sessionUser: null,
  mode: 'administrador',
  users: [],
  sales: [],
  expenses: [],
  products: [],
  customers: [],
  movements: [],
  budgets: [],
  cashSessions: [],
  cashAdjustments: []
};

const views = {
  inicio: { title: 'Inicio', subtitle: 'Resumen del negocio' },
  caja: { title: 'Caja', subtitle: 'Apertura, ingresos y control de caja' },
  ventas: { title: 'Ventas', subtitle: 'Ventas contado y cuenta corriente' },
  gastos: { title: 'Gastos', subtitle: 'Registro de egresos' },
  stock: { title: 'Stock', subtitle: 'Productos, código y precios' },
  cuentas: { title: 'Cuentas corrientes', subtitle: 'Clientes, saldos y cobros' },
  presupuestos: { title: 'Presupuestos', subtitle: 'Propuestas y seguimiento' },
  usuarios: { title: 'Usuarios', subtitle: 'Administradores y vendedores' }
};

const $ = (id) => document.getElementById(id);
const els = {
  loginScreen: $('loginScreen'), appScreen: $('appScreen'), loginForm: $('loginForm'), username: $('username'), password: $('password'), loginError: $('loginError'),
  adminTab: $('adminTab'), sellerTab: $('sellerTab'), loginTitle: $('loginTitle'), loginSubtitle: $('loginSubtitle'), installBtn: $('installBtn'),
  sessionMeta: $('sessionMeta'), logoutBtn: $('logoutBtn'), todayLabel: $('todayLabel'), viewTitle: $('viewTitle'), viewSubtitle: $('viewSubtitle'),
  operationType: $('operationType'), customerFields: $('customerFields'), checkFields: $('checkFields'), productSearch: $('productSearch'),
  productForm: $('productForm'), toggleProductFormBtn: $('toggleProductFormBtn'), paymentCustomerId: $('paymentCustomerId')
};

let unsubs = [];
let deferredPrompt = null;

const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const todayLong = () => new Date().toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const money = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(v || 0));
const toNumber = (value) => {
  const text = String(value ?? '').trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
};
const clean = (v) => String(v || '').trim().toLowerCase();
const sanitizeId = (v) => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function sha256(text) {
  const data = new TextEncoder().encode(String(text || ''));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function formatMoneyInput(input) {
  const num = toNumber(input.value);
  input.value = num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setDates() {
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (!input.value) input.value = todayIso();
  });
}

function bindMoneyInputs() {
  document.querySelectorAll('[data-money]').forEach((input) => {
    input.addEventListener('blur', () => formatMoneyInput(input));
  });
}

function setMode(mode) {
  state.mode = mode;
  els.adminTab.classList.toggle('active', mode === 'administrador');
  els.sellerTab.classList.toggle('active', mode === 'vendedor');
  els.loginTitle.textContent = mode === 'administrador' ? 'Ingresar como administrador' : 'Ingresar como vendedor';
  els.loginSubtitle.textContent = mode === 'administrador'
    ? 'Si no existe ningún administrador, el primer ingreso lo crea automáticamente.'
    : 'El vendedor entra con el usuario creado desde administración.';
}

function showLogin() { els.loginScreen.classList.remove('hidden'); els.appScreen.classList.add('hidden'); }
function showApp() { els.loginScreen.classList.add('hidden'); els.appScreen.classList.remove('hidden'); }
function isAdmin() { return state.sessionUser?.role === 'administrador'; }
function viewEl(name) { return document.getElementById(`${name}View`); }

function switchView(name) {
  document.querySelectorAll('.view').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((el) => el.classList.toggle('active', el.dataset.view === name));
  viewEl(name)?.classList.add('active');
  els.viewTitle.textContent = views[name]?.title || 'Panel';
  els.viewSubtitle.textContent = views[name]?.subtitle || '';
}

async function ensureAnonymousSession() { if (!state.authUser) await signInAnonymously(auth); }
async function adminCount() { const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'administrador'))); return snap.size; }

async function createFirstAdmin(username, password) {
  const id = sanitizeId(username);
  const passwordHash = await sha256(password);
  const payload = { name: 'Administrador', username: clean(username), passwordHash, role: 'administrador', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await setDoc(doc(db, 'users', id), payload);
  return payload;
}

async function loginWithAppUser(username, password) {
  const id = sanitizeId(username);
  const snap = await getDoc(doc(db, 'users', id));
  if (!snap.exists()) throw new Error('Usuario no encontrado.');
  const data = snap.data();
  if (clean(data.username) !== clean(username)) throw new Error('Usuario incorrecto.');
  if (data.role !== state.mode) throw new Error(`Ese usuario no pertenece al acceso de ${state.mode}.`);
  const hash = await sha256(password);
  if (hash !== data.passwordHash) throw new Error('Usuario o contraseña incorrectos.');
  state.sessionUser = { id: snap.id, ...data };
}

function clearRealtime() { unsubs.forEach((fn) => { try { fn(); } catch (_) {} }); unsubs = []; }
function listenCollection(name, setter, sorterField = 'createdAt') { const ref = query(collection(db, name), orderBy(sorterField, 'desc')); unsubs.push(onSnapshot(ref, (snap) => setter(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))); }
function listenCollectionAsc(name, setter, sorterField = 'name') { const ref = query(collection(db, name), orderBy(sorterField, 'asc')); unsubs.push(onSnapshot(ref, (snap) => setter(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))); }

function startRealtime() {
  clearRealtime();
  listenCollection('users', (rows) => { state.users = rows; renderUsers(); });
  listenCollection('sales', (rows) => { state.sales = rows; renderAll(); });
  listenCollection('expenses', (rows) => { state.expenses = rows; renderAll(); });
  listenCollectionAsc('products', (rows) => { state.products = rows; renderProducts(); renderCustomerSelects(); });
  listenCollectionAsc('customers', (rows) => { state.customers = rows; renderCustomers(); renderCustomerSelects(); renderBalances(); });
  listenCollection('account_movements', (rows) => { state.movements = rows; renderCustomers(); renderBalances(); renderRecentMovements(); });
  listenCollection('budgets', (rows) => { state.budgets = rows; renderBudgets(); });
  listenCollection('cash_sessions', (rows) => { state.cashSessions = rows; renderCashHistory(); renderAll(); });
  listenCollection('cash_adjustments', (rows) => { state.cashAdjustments = rows; renderCashHistory(); renderAll(); renderRecentMovements(); });
}

function onlyDate(row) { return String(row.date || '').slice(0, 10); }
function amountByMethod(rows, method) { return rows.filter((row) => row.paymentMethod === method || row.method === method).reduce((sum, row) => sum + Number(row.amount || 0), 0); }

function currentCash() {
  const sessionCash = state.cashSessions.reduce((sum, row) => sum + Number(row.cashAmount || 0), 0);
  const sessionChecks = state.cashSessions.reduce((sum, row) => sum + Number(row.checkAmount || 0), 0);
  const salesCash = state.sales.filter((x) => x.operationType === 'contado').reduce((sum, row) => sum + (row.paymentMethod === 'efectivo' ? Number(row.amount || 0) : 0), 0);
  const salesChecks = state.sales.filter((x) => x.operationType === 'contado').reduce((sum, row) => sum + (row.paymentMethod === 'cheque' ? Number(row.amount || 0) : 0), 0);
  const extraCash = state.cashAdjustments.reduce((sum, row) => sum + (row.method === 'efectivo' ? (row.kind === 'ingreso' ? Number(row.amount || 0) : -Number(row.amount || 0)) : 0), 0);
  const extraChecks = state.cashAdjustments.reduce((sum, row) => sum + (row.method === 'cheque' ? (row.kind === 'ingreso' ? Number(row.amount || 0) : -Number(row.amount || 0)) : 0), 0);
  const expenseOut = state.expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return { efectivo: sessionCash + salesCash + extraCash - expenseOut, cheques: sessionChecks + salesChecks + extraChecks };
}

function accountBalance(customerId) { return state.movements.filter((m) => m.customerId === customerId).reduce((sum, row) => sum + (row.type === 'cargo' ? Number(row.amount || 0) : -Number(row.amount || 0)), 0); }
function weekBuckets() { const labels = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']; const values = labels.map(() => 0); state.sales.forEach((row) => { const d = new Date(`${onlyDate(row)}T12:00:00`); const day = (d.getDay() + 6) % 7; values[day] += Number(row.amount || 0); }); return labels.map((label, idx) => ({ label, value: values[idx] })); }
function monthBuckets() { const labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; const values = labels.map(() => 0); state.sales.forEach((row) => { const d = new Date(`${onlyDate(row)}T12:00:00`); values[d.getMonth()] += Number(row.amount || 0); }); return labels.map((label, idx) => ({ label, value: values[idx] })); }

function drawChart(targetId, data) {
  const target = $(targetId);
  const max = Math.max(...data.map((item) => item.value), 1);
  target.innerHTML = data.map((item) => `\n    <div class="chart-row">\n      <span>${item.label}</span>\n      <div class="bar"><span style="width:${Math.max(4, (item.value / max) * 100)}%"></span></div>\n      <strong>${money(item.value)}</strong>\n    </div>\n  `).join('');
}

function renderStats() {
  const today = todayIso();
  const todaySales = state.sales.filter((row) => onlyDate(row) === today);
  const todayExpenses = state.expenses.filter((row) => onlyDate(row) === today);
  const todayAdjustments = state.cashAdjustments.filter((row) => onlyDate(row) === today && row.kind === 'ingreso');
  const cash = currentCash();
  $('statCashTotal').textContent = money(cash.efectivo + cash.cheques);
  $('statCashBreakdown').textContent = `Efectivo ${money(cash.efectivo)} · Cheques ${money(cash.cheques)}`;
  $('statSalesToday').textContent = money(todaySales.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  $('statSalesBreakdown').textContent = `Efectivo ${money(amountByMethod(todaySales, 'efectivo'))} · Cheques ${money(amountByMethod(todaySales, 'cheque'))}`;
  $('statExtraToday').textContent = money(todayAdjustments.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  $('statExpensesToday').textContent = money(todayExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  $('statExpensesCount').textContent = `${todayExpenses.length} movimientos`;
  drawChart('weeklyChart', weekBuckets()); drawChart('monthlyChart', monthBuckets());
}

function card(title, subtitle, amount) { return `<div class="list-item"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle || '')}</small></div>${amount ? `<strong>${escapeHtml(amount)}</strong>` : ''}</div>`; }
function renderRecentMovements() { const rows = [...state.sales.map((row) => ({ kind: 'Venta', text: `${row.documentType || 'Venta'} · ${row.paymentMethod || '-'}`, amount: row.amount, createdAt: row.createdAt })), ...state.cashAdjustments.map((row) => ({ kind: row.kind === 'ingreso' ? 'Ingreso caja' : 'Egreso caja', text: `${row.method} · ${row.detail || ''}`, amount: row.amount, createdAt: row.createdAt })), ...state.expenses.map((row) => ({ kind: 'Gasto', text: row.detail, amount: row.amount, createdAt: row.createdAt }))].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 10); $('recentMovements').innerHTML = rows.length ? rows.map((row) => card(row.kind, row.text, money(row.amount))).join('') : '<p class="muted">Todavía no hay movimientos.</p>'; }
function renderBalances() { const rows = state.customers.map((customer) => ({ customer, balance: accountBalance(customer.id) })).filter((item) => item.balance > 0).sort((a, b) => b.balance - a.balance); $('balancesList').innerHTML = rows.length ? rows.map(({ customer, balance }) => card([customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.name || 'Cliente', customer.phone || 'Cuenta corriente', money(balance))).join('') : '<p class="muted">No hay saldos pendientes.</p>'; }
function renderSales() { $('salesList').innerHTML = state.sales.slice(0, 20).map((row) => card(row.documentNumber || 'Sin número', `${row.date || ''} · ${row.paymentMethod || '-'} · ${row.operationType || '-'}`, money(row.amount))).join('') || '<p class="muted">No hay ventas cargadas.</p>'; }
function renderExpenses() { $('expensesList').innerHTML = state.expenses.slice(0, 20).map((row) => card(row.category || 'Gasto', `${row.date || ''} · ${row.detail || ''}`, money(row.amount))).join('') || '<p class="muted">No hay gastos.</p>'; }
function renderProducts() { const q = clean(els.productSearch.value); const filtered = state.products.filter((row) => `${clean(row.code)} ${clean(row.name)} ${clean(row.category)}`.includes(q)); $('stockList').innerHTML = filtered.map((row) => `\n    <div class="list-item">\n      <div>\n        <strong>${escapeHtml(row.name || 'Producto')}</strong>\n        <small>${escapeHtml(row.code || 'Sin código')} · ${escapeHtml(row.category || 'Sin categoría')} · Stock ${Number(row.stock || 0)}</small>\n      </div>\n      <strong>${money(row.price || 0)}</strong>\n    </div>\n  `).join('') || '<p class="muted">No hay productos cargados.</p>'; }
function renderCustomers() { $('customersList').innerHTML = state.customers.map((row) => card([row.firstName, row.lastName].filter(Boolean).join(' ') || row.name || 'Cliente', row.phone || 'Sin teléfono', money(accountBalance(row.id)))).join('') || '<p class="muted">No hay clientes.</p>'; }
function renderCustomerSelects() { els.paymentCustomerId.innerHTML = '<option value="">Seleccionar cliente</option>' + state.customers.map((row) => `<option value="${row.id}">${escapeHtml([row.firstName, row.lastName].filter(Boolean).join(' ') || row.name || 'Cliente')}</option>`).join(''); }
function renderBudgets() { $('budgetsList').innerHTML = state.budgets.map((row) => card(row.customerName || 'Cliente', `${row.date || ''} · Validez ${row.validity || '-'}`, money(row.total))).join('') || '<p class="muted">No hay presupuestos.</p>'; }
function renderUsers() { $('usersList').innerHTML = state.users.map((row) => card(row.name || row.username, row.role || '-', row.username || '')).join('') || '<p class="muted">No hay usuarios.</p>'; }
function renderCashHistory() { const rows = [...state.cashSessions.map((row) => ({ title: 'Apertura de caja', subtitle: `${row.date} · ${row.note || ''}`, amount: money((row.cashAmount || 0) + (row.checkAmount || 0)) })), ...state.cashAdjustments.map((row) => ({ title: row.kind === 'ingreso' ? 'Ingreso de caja' : 'Egreso de caja', subtitle: `${row.date} · ${row.method} · ${row.detail || ''}`, amount: money(row.amount) }))]; $('cashHistory').innerHTML = rows.length ? rows.map((row) => card(row.title, row.subtitle, row.amount)).join('') : '<p class="muted">Todavía no hay historial de caja.</p>'; }
function renderAll() { renderStats(); renderSales(); renderExpenses(); renderRecentMovements(); renderBalances(); renderCashHistory(); }

async function getOrCreateCustomer(firstName, lastName, phone) {
  const fn = clean(firstName); const ln = clean(lastName);
  const existing = state.customers.find((row) => clean(row.firstName) === fn && clean(row.lastName) === ln && clean(row.phone) === clean(phone));
  if (existing) return existing.id;
  const ref = await addDoc(collection(db, 'customers'), { firstName: firstName || '', lastName: lastName || '', phone: phone || '', updatedAt: serverTimestamp(), createdAt: serverTimestamp() });
  return ref.id;
}

function requireAdminView() { document.querySelectorAll('.admin-only').forEach((el) => el.classList.toggle('hidden', !isAdmin())); if (!isAdmin() && document.querySelector('.nav-btn.active')?.dataset.view === 'usuarios') switchView('inicio'); }

async function handleLogin(event) {
  event.preventDefault(); els.loginError.textContent = '';
  try {
    await ensureAnonymousSession();
    const user = clean(els.username.value); const pass = els.password.value;
    if (!user || !pass) throw new Error('Completá usuario y contraseña.');
    if (state.mode === 'administrador' && (await adminCount()) === 0) await createFirstAdmin(user, pass);
    await loginWithAppUser(user, pass);
    showApp(); els.sessionMeta.textContent = `${state.sessionUser.name || state.sessionUser.username} · ${state.sessionUser.role}`;
    requireAdminView(); startRealtime(); switchView('inicio');
  } catch (error) {
    console.error(error); els.loginError.textContent = error.message || 'No se pudo ingresar.';
  }
}

async function submitOpenCash(event) { event.preventDefault(); const fd = new FormData(event.target); await addDoc(collection(db, 'cash_sessions'), { date: fd.get('date'), cashAmount: toNumber(fd.get('cashAmount')), checkAmount: toNumber(fd.get('checkAmount')), note: fd.get('note') || '', createdBy: state.sessionUser.username, createdAt: serverTimestamp() }); event.target.reset(); setDates(); }
async function submitAdjustment(event) { event.preventDefault(); const fd = new FormData(event.target); await addDoc(collection(db, 'cash_adjustments'), { date: fd.get('date'), kind: fd.get('kind'), method: fd.get('method'), amount: toNumber(fd.get('amount')), detail: fd.get('detail') || '', createdBy: state.sessionUser.username, createdAt: serverTimestamp() }); event.target.reset(); setDates(); }
async function submitSale(event) { event.preventDefault(); const fd = new FormData(event.target); const operationType = fd.get('operationType'); let customerId = ''; if (operationType === 'cuenta_corriente') customerId = await getOrCreateCustomer(fd.get('customerFirstName'), fd.get('customerLastName'), fd.get('customerPhone')); const amount = toNumber(fd.get('amount')); await addDoc(collection(db, 'sales'), { date: fd.get('date'), amount, paymentMethod: fd.get('paymentMethod'), operationType, documentType: fd.get('documentType'), documentNumber: fd.get('documentNumber'), details: fd.get('details') || '', customerId, checkBank: fd.get('checkBank') || '', checkNumber: fd.get('checkNumber') || '', checkHolder: fd.get('checkHolder') || '', checkDueDate: fd.get('checkDueDate') || '', createdBy: state.sessionUser.username, createdAt: serverTimestamp() }); if (customerId) await addDoc(collection(db, 'account_movements'), { customerId, date: fd.get('date'), type: 'cargo', amount, detail: `${fd.get('documentType')} ${fd.get('documentNumber')}`, createdBy: state.sessionUser.username, createdAt: serverTimestamp() }); event.target.reset(); setDates(); toggleSaleFields(); }
async function submitExpense(event) { event.preventDefault(); const fd = new FormData(event.target); await addDoc(collection(db, 'expenses'), { date: fd.get('date'), amount: toNumber(fd.get('amount')), category: fd.get('category'), detail: fd.get('detail'), createdBy: state.sessionUser.username, createdAt: serverTimestamp() }); event.target.reset(); setDates(); }
async function submitProduct(event) { event.preventDefault(); const fd = new FormData(event.target); await addDoc(collection(db, 'products'), { code: fd.get('code') || '', name: fd.get('name'), category: fd.get('category') || '', stock: Number(fd.get('stock') || 0), cost: toNumber(fd.get('cost')), price: toNumber(fd.get('price')), updatedAt: serverTimestamp(), createdAt: serverTimestamp() }); event.target.reset(); els.productForm.classList.add('hidden'); }
async function submitAccountPayment(event) { event.preventDefault(); const fd = new FormData(event.target); await addDoc(collection(db, 'account_movements'), { customerId: fd.get('customerId'), date: fd.get('date'), type: 'cobro', amount: toNumber(fd.get('amount')), method: fd.get('method'), detail: fd.get('detail') || '', createdBy: state.sessionUser.username, createdAt: serverTimestamp() }); event.target.reset(); setDates(); }
async function submitBudget(event) { event.preventDefault(); const fd = new FormData(event.target); await addDoc(collection(db, 'budgets'), { date: fd.get('date'), customerName: fd.get('customerName'), detail: fd.get('detail'), total: toNumber(fd.get('total')), validity: fd.get('validity') || '', createdBy: state.sessionUser.username, createdAt: serverTimestamp() }); event.target.reset(); setDates(); }
async function submitUser(event) { event.preventDefault(); if (!isAdmin()) return; const fd = new FormData(event.target); const username = clean(fd.get('username')); await setDoc(doc(db, 'users', sanitizeId(username)), { name: fd.get('name'), username, passwordHash: await sha256(fd.get('password')), role: 'vendedor', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }); event.target.reset(); }

function toggleSaleFields() { const paymentMethod = document.querySelector('[name="paymentMethod"]')?.value; const operationType = els.operationType.value; els.customerFields.classList.toggle('hidden', operationType !== 'cuenta_corriente'); els.checkFields.classList.toggle('hidden', paymentMethod !== 'cheque'); }

function initInstall() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone && els.installBtn) els.installBtn.classList.add('hidden');
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredPrompt = event; els.installBtn?.classList.remove('hidden'); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; els.installBtn?.classList.add('hidden'); });
  els.installBtn?.addEventListener('click', async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; return; }
    alert('En Android: menú del navegador > Instalar app. En iPhone: Compartir > Agregar a pantalla de inicio.');
  });
}

function initPwa() {
  if (!('serviceWorker' in navigator)) return;
  const swPath = window.SENIORFLOW_SW_PATH || './sw.js';
  navigator.serviceWorker.register(swPath).catch(console.error);
}

function initEvents() {
  els.loginForm.addEventListener('submit', handleLogin);
  els.adminTab.addEventListener('click', () => setMode('administrador'));
  els.sellerTab.addEventListener('click', () => setMode('vendedor'));
  els.logoutBtn.addEventListener('click', async () => { state.sessionUser = null; clearRealtime(); await signOut(auth).catch(() => {}); showLogin(); await ensureAnonymousSession().catch(() => {}); });
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $('openCashForm').addEventListener('submit', submitOpenCash);
  $('cashAdjustmentForm').addEventListener('submit', submitAdjustment);
  $('saleForm').addEventListener('submit', submitSale);
  $('expenseForm').addEventListener('submit', submitExpense);
  $('productForm').addEventListener('submit', submitProduct);
  $('accountPaymentForm').addEventListener('submit', submitAccountPayment);
  $('budgetForm').addEventListener('submit', submitBudget);
  $('userForm').addEventListener('submit', submitUser);
  els.operationType.addEventListener('change', toggleSaleFields);
  document.querySelector('[name="paymentMethod"]').addEventListener('change', toggleSaleFields);
  els.productSearch.addEventListener('input', renderProducts);
  els.toggleProductFormBtn.addEventListener('click', () => els.productForm.classList.toggle('hidden'));
}

function initAuth() { onAuthStateChanged(auth, (user) => { state.authUser = user; state.authReady = true; }); }

async function boot() {
  els.todayLabel.textContent = todayLong();
  setDates(); bindMoneyInputs(); setMode('administrador'); initInstall(); initPwa(); initEvents(); initAuth(); showLogin();
  try { await ensureAnonymousSession(); } catch (error) { console.error(error); els.loginError.textContent = 'No se pudo conectar con Firebase. Revisá dominio autorizado, conexión y reglas.'; }
}

boot();