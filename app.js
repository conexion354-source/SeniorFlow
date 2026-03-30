import { auth, db } from './firebase-config.js';
import { signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const state = {
  sales: [],
  expenses: [],
  cashSessions: [],
  cashMovements: [],
  currentSession: null,
  reportHtml: '',
  reportTitle: '',
};

const els = {
  body: document.body,
  todayText: document.getElementById('todayText'),
  cajaBanner: document.getElementById('cajaBanner'),
  cajaWarning: document.getElementById('cajaWarning'),
  installBtn: document.getElementById('installBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  themeSelect: document.getElementById('themeSelect'),
  backupBtn: document.getElementById('backupBtn'),
  clearSystemBtn: document.getElementById('clearSystemBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  settingsMsg: document.getElementById('settingsMsg'),
  reportModal: document.getElementById('reportModal'),
  reportPreview: document.getElementById('reportPreview'),
  printReportBtn: document.getElementById('printReportBtn'),
  closeReportBtn: document.getElementById('closeReportBtn'),
  weeklyReportBtn: document.getElementById('weeklyReportBtn'),
  monthlyReportBtn: document.getElementById('monthlyReportBtn'),
  weekChart: document.getElementById('weekChart'),
  statSalesDay: document.getElementById('statSalesDay'),
  statSalesDayWords: document.getElementById('statSalesDayWords'),
  statCash: document.getElementById('statCash'),
  statCashBreakdown: document.getElementById('statCashBreakdown'),
  statSalesWeek: document.getElementById('statSalesWeek'),
  statSalesMonth: document.getElementById('statSalesMonth'),
  statCashEfectivo: document.getElementById('statCashEfectivo'),
  statCashCheque: document.getElementById('statCashCheque'),
  statCashTransfer: document.getElementById('statCashTransfer'),
  statExpensesDay: document.getElementById('statExpensesDay'),
  statExtraIncomeDay: document.getElementById('statExtraIncomeDay'),
  openCajaForm: document.getElementById('openCajaForm'),
  cancelCajaEdit: document.getElementById('cancelCajaEdit'),
  closeCajaForm: document.getElementById('closeCajaForm'),
  closeCajaTotal: document.getElementById('closeCajaTotal'),
  openCajaMsg: document.getElementById('openCajaMsg'),
  closeCajaMsg: document.getElementById('closeCajaMsg'),
  cashSessionsList: document.getElementById('cashSessionsList'),
  cashMovementForm: document.getElementById('cashMovementForm'),
  cashMovementMsg: document.getElementById('cashMovementMsg'),
  cashMovementsList: document.getElementById('cashMovementsList'),
  cancelCashMovementEdit: document.getElementById('cancelCashMovementEdit'),
  saleForm: document.getElementById('saleForm'),
  saleMsg: document.getElementById('saleMsg'),
  salePaymentMethod: document.getElementById('salePaymentMethod'),
  saleCustomerWrap: document.getElementById('saleCustomerWrap'),
  saleBankWrap: document.getElementById('saleBankWrap'),
  cancelSaleEdit: document.getElementById('cancelSaleEdit'),
  salesList: document.getElementById('salesList'),
  expenseForm: document.getElementById('expenseForm'),
  expenseMsg: document.getElementById('expenseMsg'),
  cancelExpenseEdit: document.getElementById('cancelExpenseEdit'),
  expensesList: document.getElementById('expensesList'),
  navBtns: [...document.querySelectorAll('.nav-btn')],
  views: {
    inicio: document.getElementById('inicioView'),
    caja: document.getElementById('cajaView'),
    ventas: document.getElementById('ventasView'),
    gastos: document.getElementById('gastosView'),
  }
};

let deferredPrompt = null;

const currency = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(value || 0));
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const dateLabel = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function parseMoneyValue(input) {
  let raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return 0;
  raw = raw.replace(/\s+/g, ' ');
  const hasMilWord = /\bmil\b/.test(raw);
  raw = raw.replace(/\$|ars|pesos?/g, '').trim();

  if (raw.includes('.') && raw.includes(',')) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (raw.includes(',')) {
    const parts = raw.split(',');
    if (parts.length === 2 && parts[1].length <= 2) raw = parts[0].replace(/\./g, '') + '.' + parts[1];
    else raw = raw.replace(/,/g, '');
  } else if (raw.includes('.')) {
    const parts = raw.split('.');
    if (!(parts.length === 2 && parts[1].length <= 2)) raw = raw.replace(/\./g, '');
  }

  raw = raw.replace(/mil/g, '').replace(/[^0-9.-]/g, '');
  let value = Number(raw || 0);
  if (!Number.isFinite(value)) value = 0;
  if (hasMilWord) value *= 1000;
  return value;
}

function formatMoneyInputValue(value) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function numberToWordsUnder100(num) {
  const u = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const teens = { 10: 'diez', 11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince', 16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve' };
  const tens = { 20: 'veinte', 30: 'treinta', 40: 'cuarenta', 50: 'cincuenta', 60: 'sesenta', 70: 'setenta', 80: 'ochenta', 90: 'noventa' };
  if (num < 10) return u[num];
  if (teens[num]) return teens[num];
  if (num < 30) return num === 20 ? 'veinte' : `veinti${u[num - 20]}`;
  const ten = Math.floor(num / 10) * 10;
  const unit = num % 10;
  return unit ? `${tens[ten]} y ${u[unit]}` : tens[ten];
}
function numberToWordsUnder1000(num) {
  const hundreds = { 100: 'cien', 200: 'doscientos', 300: 'trescientos', 400: 'cuatrocientos', 500: 'quinientos', 600: 'seiscientos', 700: 'setecientos', 800: 'ochocientos', 900: 'novecientos' };
  if (num < 100) return numberToWordsUnder100(num);
  if (hundreds[num]) return hundreds[num];
  const hundred = Math.floor(num / 100) * 100;
  const rest = num % 100;
  const prefix = num < 200 ? 'ciento' : hundreds[hundred];
  return `${prefix} ${numberToWordsUnder100(rest)}`;
}
function numberToWordsEs(num) {
  num = Math.floor(Number(num || 0));
  if (num === 0) return 'cero';
  if (num < 1000) return numberToWordsUnder1000(num);
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const rest = num % 1000;
    const thousandText = thousands === 1 ? 'mil' : `${numberToWordsUnder1000(thousands)} mil`;
    return `${thousandText}${rest ? ` ${numberToWordsUnder1000(rest)}` : ''}`;
  }
  const millions = Math.floor(num / 1000000);
  const rest = num % 1000000;
  const millionText = millions === 1 ? 'un millón' : `${numberToWordsEs(millions)} millones`;
  return `${millionText}${rest ? ` ${numberToWordsEs(rest)}` : ''}`;
}
function moneyToWords(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);
  const integer = Math.floor(abs);
  const cents = Math.round((abs - integer) * 100);
  const sign = amount < 0 ? 'menos ' : '';
  const base = `${sign}${numberToWordsEs(integer)} peso${integer === 1 ? '' : 's'}`;
  if (!cents) return base.charAt(0).toUpperCase() + base.slice(1);
  const centsText = `${numberToWordsEs(cents)} centavo${cents === 1 ? '' : 's'}`;
  const full = `${base} con ${centsText}`;
  return full.charAt(0).toUpperCase() + full.slice(1);
}

function updateMoneyText(input) {
  const root = input.closest('label') || document;
  const target = root.querySelector(`[data-money-text-for="${input.name}"]`) || document.querySelector(`[data-money-text-for="${input.name}"]`);
  if (target) target.textContent = moneyToWords(parseMoneyValue(input.value));
}

function enhanceMoneyInputs(root = document) {
  root.querySelectorAll('[data-money="true"]').forEach((input) => {
    if (input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    input.addEventListener('input', () => updateMoneyText(input));
    input.addEventListener('blur', () => {
      const value = parseMoneyValue(input.value);
      if (input.value.trim() !== '') input.value = formatMoneyInputValue(value);
      updateMoneyText(input);
    });
    updateMoneyText(input);
  });
}

function applyTheme(theme) {
  const value = theme === 'dark' ? 'dark' : 'light';
  localStorage.setItem('sf-theme', value);
  els.body.classList.toggle('dark', value === 'dark');
  els.themeSelect.value = value;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', value === 'dark' ? '#0d1620' : '#19b3d1');
}

function openModal(node) { node.classList.add('active'); }
function closeModal(node) { node.classList.remove('active'); }

function setView(view) {
  els.navBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  Object.entries(els.views).forEach(([name, node]) => node.classList.toggle('active', name === view));
}

function showMsg(node, text = '', type = '') {
  node.textContent = text;
  node.className = `msg ${type}`.trim();
}

function isCajaOpen() {
  return !!state.currentSession && !state.currentSession.closedAt;
}

function requireOpenCaja() {
  if (isCajaOpen()) return true;
  showMsg(els.saleMsg, 'Primero tenés que abrir caja.', 'error');
  showMsg(els.expenseMsg, 'Primero tenés que abrir caja.', 'error');
  showMsg(els.cashMovementMsg, 'Primero tenés que abrir caja.', 'error');
  setView('caja');
  return false;
}

function currentCajaBreakdown() {
  const current = state.currentSession;
  const breakdown = {
    efectivo: Number(current?.openingCash || 0),
    cheque: Number(current?.openingChecks || 0),
    transferencia: Number(current?.openingTransfers || 0),
  };

  if (!current) return breakdown;

  state.sales.filter((sale) => sale.cashSessionId === current.id).forEach((sale) => {
    if (sale.paymentMethod === 'efectivo') breakdown.efectivo += Number(sale.amount || 0);
    if (sale.paymentMethod === 'cheque') breakdown.cheque += Number(sale.amount || 0);
    if (sale.paymentMethod === 'transferencia') breakdown.transferencia += Number(sale.amount || 0);
  });

  state.cashMovements.filter((item) => item.cashSessionId === current.id).forEach((move) => {
    if (move.target === 'efectivo') breakdown.efectivo += Number(move.amount || 0);
    if (move.target === 'cheque') breakdown.cheque += Number(move.amount || 0);
    if (move.target === 'transferencia') breakdown.transferencia += Number(move.amount || 0);
  });

  state.expenses.filter((expense) => expense.cashSessionId === current.id).forEach((expense) => {
    breakdown.efectivo -= Number(expense.amount || 0);
  });

  return breakdown;
}

function renderDashboard() {
  const today = todayISO();
  const now = new Date(`${today}T12:00:00`);
  els.todayText.textContent = now.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const salesDay = state.sales.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expensesDay = state.expenses.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const extraIncomeDay = state.cashMovements.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const startOfMonth = `${today.slice(0, 7)}-01`;
  const salesMonth = state.sales.filter((item) => item.date >= startOfMonth && item.date <= today).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const last7 = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const amount = state.sales.filter((item) => item.date === iso).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    last7.push({
      iso,
      label: d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''),
      amount,
    });
  }
  const salesWeek = last7.reduce((sum, item) => sum + item.amount, 0);
  const box = currentCajaBreakdown();
  const boxTotal = box.efectivo + box.cheque + box.transferencia;

  els.statSalesDay.textContent = currency(salesDay);
  els.statSalesDayWords.textContent = moneyToWords(salesDay);
  els.statExpensesDay.textContent = currency(expensesDay);
  els.statSalesWeek.textContent = currency(salesWeek);
  els.statSalesMonth.textContent = currency(salesMonth);
  els.statCash.textContent = currency(boxTotal);
  els.statCashBreakdown.textContent = `Efectivo ${currency(box.efectivo)} · Cheques ${currency(box.cheque)} · Transferencias ${currency(box.transferencia)}`;
  els.statCashEfectivo.textContent = currency(box.efectivo);
  els.statCashCheque.textContent = currency(box.cheque);
  els.statCashTransfer.textContent = currency(box.transferencia);
  els.statExtraIncomeDay.textContent = currency(extraIncomeDay);
  els.closeCajaTotal.value = currency(boxTotal);

  if (isCajaOpen()) {
    els.cajaBanner.textContent = `Caja abierta el ${dateLabel(state.currentSession.date)}.`;
    els.cajaBanner.className = 'status-banner open';
    els.cajaWarning.classList.add('hidden');
  } else {
    els.cajaBanner.textContent = 'Caja cerrada. Abrí caja para empezar a operar.';
    els.cajaBanner.className = 'status-banner closed';
    els.cajaWarning.classList.remove('hidden');
  }

  const max = Math.max(...last7.map((item) => item.amount), 1);
  els.weekChart.innerHTML = last7.map((item) => `
    <div class="bar-row">
      <div>${escapeHtml(item.label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${item.amount ? Math.max(8, (item.amount / max) * 100) : 8}%"></div></div>
      <div>${currency(item.amount)}</div>
    </div>
  `).join('');
}

function renderCashSessions() {
  if (!state.cashSessions.length) {
    els.cashSessionsList.innerHTML = '<div class="empty">Todavía no hay aperturas o cierres de caja.</div>';
    return;
  }
  els.cashSessionsList.innerHTML = state.cashSessions.map((item) => {
    const isOpen = !item.closedAt;
    const finalTotal = Number(item.closingTotal || 0);
    const openTotal = Number(item.openingCash || 0) + Number(item.openingChecks || 0) + Number(item.openingTransfers || 0);
    return `
      <article class="record-item">
        <div class="record-head">
          <div>
            <strong>Caja ${escapeHtml(dateLabel(item.date || todayISO()))}</strong>
            <div class="record-meta">
              <span class="pill ${isOpen ? 'success' : 'warning'}">${isOpen ? 'Abierta' : 'Cerrada'}</span>
              <span>Apertura ${currency(openTotal)}</span>
              ${isOpen ? '' : `<span>Cierre ${currency(finalTotal)}</span>`}
            </div>
          </div>
        </div>
        <div class="record-meta">
          <span>Efectivo ${currency(item.openingCash || 0)}</span>
          <span>Cheques ${currency(item.openingChecks || 0)}</span>
          <span>Transferencias ${currency(item.openingTransfers || 0)}</span>
          ${item.note ? `<span>Nota: ${escapeHtml(item.note)}</span>` : ''}
          ${item.closeNote ? `<span>Cierre: ${escapeHtml(item.closeNote)}</span>` : ''}
        </div>
        <div class="record-actions">
          <button class="btn btn-secondary caja-edit" data-id="${item.id}">Editar</button>
          <button class="btn btn-danger caja-delete" data-id="${item.id}">Eliminar</button>
        </div>
      </article>
    `;
  }).join('');

  els.cashSessionsList.querySelectorAll('.caja-edit').forEach((btn) => btn.addEventListener('click', () => loadCajaIntoForm(btn.dataset.id)));
  els.cashSessionsList.querySelectorAll('.caja-delete').forEach((btn) => btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    const relatedSales = state.sales.some((item) => item.cashSessionId === id);
    const relatedExpenses = state.expenses.some((item) => item.cashSessionId === id);
    const relatedMoves = state.cashMovements.some((item) => item.cashSessionId === id);
    if (relatedSales || relatedExpenses || relatedMoves) {
      alert('No podés eliminar esta caja porque tiene ventas, gastos o ingresos asociados.');
      return;
    }
    if (!confirm('¿Eliminar esta caja del historial?')) return;
    await deleteDoc(doc(db, 'cashSessions', id));
  }));
}

function renderCashMovements() {
  const rows = [...state.cashMovements].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (!rows.length) {
    els.cashMovementsList.innerHTML = '<div class="empty">No hay ingresos de dinero cargados.</div>';
    return;
  }
  els.cashMovementsList.innerHTML = rows.map((item) => `
    <article class="record-item">
      <div class="record-head">
        <div>
          <strong>${currency(item.amount)}</strong>
          <div class="record-meta">
            <span>${escapeHtml(dateLabel(item.date))}</span>
            <span>Se agrega a ${escapeHtml(item.target || '-')}</span>
            <span>Origen ${escapeHtml(item.sourceTypeLabel || item.sourceType || '-')}</span>
          </div>
        </div>
        <span class="pill info">Ingreso</span>
      </div>
      <div class="record-meta">
        ${item.sourceName ? `<span>${escapeHtml(item.sourceName)}</span>` : ''}
        ${item.details ? `<span>${escapeHtml(item.details)}</span>` : '<span>Sin detalle</span>'}
      </div>
      <div class="record-actions">
        <button class="btn btn-secondary cash-movement-edit" data-id="${item.id}">Editar</button>
        <button class="btn btn-danger cash-movement-delete" data-id="${item.id}">Eliminar</button>
      </div>
    </article>
  `).join('');

  els.cashMovementsList.querySelectorAll('.cash-movement-edit').forEach((btn) => btn.addEventListener('click', () => loadCashMovementIntoForm(btn.dataset.id)));
  els.cashMovementsList.querySelectorAll('.cash-movement-delete').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('¿Eliminar este ingreso de dinero?')) return;
    await deleteDoc(doc(db, 'cashMovements', btn.dataset.id));
  }));
}

function renderSales() {
  const rows = [...state.sales].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (!rows.length) {
    els.salesList.innerHTML = '<div class="empty">No hay ventas cargadas.</div>';
    return;
  }
  els.salesList.innerHTML = rows.map((sale) => `
    <article class="record-item">
      <div class="record-head">
        <div>
          <strong>${currency(sale.amount)}</strong>
          <div class="record-meta">
            <span>${escapeHtml(dateLabel(sale.date))}</span>
            <span>${escapeHtml(sale.documentType || '-')}</span>
            <span>${escapeHtml(sale.paymentMethodLabel || sale.paymentMethod || '-')}</span>
            ${sale.paymentMethod === 'cuenta_corriente' ? `<span>${escapeHtml([sale.customerFirstName, sale.customerLastName].filter(Boolean).join(' ') || 'Cliente sin nombre')}</span>` : ''}
          </div>
        </div>
        <span class="pill ${sale.paymentMethod === 'cuenta_corriente' ? 'warning' : 'success'}">${escapeHtml(sale.documentNumber || 'Sin número')}</span>
      </div>
      <div class="record-meta">
        ${sale.bankInfo ? `<span>Referencia: ${escapeHtml(sale.bankInfo)}</span>` : ''}
        ${sale.details ? `<span>${escapeHtml(sale.details)}</span>` : ''}
      </div>
      <div class="record-actions">
        <button class="btn btn-secondary sale-edit" data-id="${sale.id}">Editar</button>
        <button class="btn btn-danger sale-delete" data-id="${sale.id}">Eliminar</button>
      </div>
    </article>
  `).join('');

  els.salesList.querySelectorAll('.sale-edit').forEach((btn) => btn.addEventListener('click', () => loadSaleIntoForm(btn.dataset.id)));
  els.salesList.querySelectorAll('.sale-delete').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('¿Eliminar esta venta?')) return;
    await deleteDoc(doc(db, 'sales', btn.dataset.id));
  }));
}

function renderExpenses() {
  const rows = [...state.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (!rows.length) {
    els.expensesList.innerHTML = '<div class="empty">No hay gastos cargados.</div>';
    return;
  }
  els.expensesList.innerHTML = rows.map((expense) => `
    <article class="record-item">
      <div class="record-head">
        <div>
          <strong>${currency(expense.amount)}</strong>
          <div class="record-meta">
            <span>${escapeHtml(dateLabel(expense.date))}</span>
            <span>${escapeHtml(expense.category || '-')}</span>
          </div>
        </div>
        <span class="pill danger">Gasto</span>
      </div>
      <div class="record-meta">${expense.details ? `<span>${escapeHtml(expense.details)}</span>` : '<span>Sin detalle</span>'}</div>
      <div class="record-actions">
        <button class="btn btn-secondary expense-edit" data-id="${expense.id}">Editar</button>
        <button class="btn btn-danger expense-delete" data-id="${expense.id}">Eliminar</button>
      </div>
    </article>
  `).join('');

  els.expensesList.querySelectorAll('.expense-edit').forEach((btn) => btn.addEventListener('click', () => loadExpenseIntoForm(btn.dataset.id)));
  els.expensesList.querySelectorAll('.expense-delete').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('¿Eliminar este gasto?')) return;
    await deleteDoc(doc(db, 'expenses', btn.dataset.id));
  }));
}

function refreshAll() {
  renderDashboard();
  renderCashSessions();
  renderCashMovements();
  renderSales();
  renderExpenses();
}

function updateSaleConditionalFields() {
  const method = els.salePaymentMethod.value;
  els.saleCustomerWrap.classList.toggle('hidden', method !== 'cuenta_corriente');
  els.saleBankWrap.classList.toggle('hidden', !['cheque', 'transferencia'].includes(method));
  const form = els.saleForm;
  form.customerFirstName.required = method === 'cuenta_corriente';
  form.customerLastName.required = method === 'cuenta_corriente';
}

function resetCajaForm() {
  els.openCajaForm.reset();
  els.openCajaForm.date.value = todayISO();
  els.openCajaForm.checks.value = '0';
  els.openCajaForm.transfers.value = '0';
  els.cancelCajaEdit.classList.add('hidden');
  showMsg(els.openCajaMsg, '');
  enhanceMoneyInputs(els.openCajaForm);
}

function resetSaleForm() {
  els.saleForm.reset();
  els.saleForm.date.value = todayISO();
  els.saleForm.paymentMethod.value = 'efectivo';
  updateSaleConditionalFields();
  els.cancelSaleEdit.classList.add('hidden');
  showMsg(els.saleMsg, '');
  enhanceMoneyInputs(els.saleForm);
}

function resetExpenseForm() {
  els.expenseForm.reset();
  els.expenseForm.date.value = todayISO();
  els.cancelExpenseEdit.classList.add('hidden');
  showMsg(els.expenseMsg, '');
  enhanceMoneyInputs(els.expenseForm);
}

function resetCashMovementForm() {
  els.cashMovementForm.reset();
  els.cashMovementForm.date.value = todayISO();
  els.cashMovementForm.target.value = 'efectivo';
  els.cashMovementForm.sourceType.value = 'cuenta_corriente';
  els.cancelCashMovementEdit.classList.add('hidden');
  showMsg(els.cashMovementMsg, '');
  enhanceMoneyInputs(els.cashMovementForm);
}

function loadCajaIntoForm(id) {
  const item = state.cashSessions.find((entry) => entry.id === id);
  if (!item) return;
  const form = els.openCajaForm;
  form.id.value = item.id;
  form.date.value = item.date || todayISO();
  form.cash.value = formatMoneyInputValue(item.openingCash || 0);
  form.checks.value = formatMoneyInputValue(item.openingChecks || 0);
  form.transfers.value = formatMoneyInputValue(item.openingTransfers || 0);
  form.note.value = item.note || '';
  els.cancelCajaEdit.classList.remove('hidden');
  enhanceMoneyInputs(form);
  setView('caja');
}

function loadCashMovementIntoForm(id) {
  const item = state.cashMovements.find((entry) => entry.id === id);
  if (!item) return;
  const form = els.cashMovementForm;
  form.id.value = item.id;
  form.date.value = item.date || todayISO();
  form.amount.value = formatMoneyInputValue(item.amount || 0);
  form.target.value = item.target || 'efectivo';
  form.sourceType.value = item.sourceType || 'cuenta_corriente';
  form.sourceName.value = item.sourceName || '';
  form.details.value = item.details || '';
  els.cancelCashMovementEdit.classList.remove('hidden');
  enhanceMoneyInputs(form);
  setView('caja');
}

function loadSaleIntoForm(id) {
  const sale = state.sales.find((item) => item.id === id);
  if (!sale) return;
  const form = els.saleForm;
  form.id.value = sale.id;
  form.date.value = sale.date || todayISO();
  form.amount.value = formatMoneyInputValue(sale.amount || 0);
  form.documentType.value = sale.documentType || 'Remito X';
  form.documentNumber.value = sale.documentNumber || '';
  form.paymentMethod.value = sale.paymentMethod || 'efectivo';
  form.bankInfo.value = sale.bankInfo || '';
  form.customerFirstName.value = sale.customerFirstName || '';
  form.customerLastName.value = sale.customerLastName || '';
  form.details.value = sale.details || '';
  updateSaleConditionalFields();
  enhanceMoneyInputs(form);
  els.cancelSaleEdit.classList.remove('hidden');
  setView('ventas');
}

function loadExpenseIntoForm(id) {
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense) return;
  const form = els.expenseForm;
  form.id.value = expense.id;
  form.date.value = expense.date || todayISO();
  form.amount.value = formatMoneyInputValue(expense.amount || 0);
  form.category.value = expense.category || 'Alquiler';
  form.details.value = expense.details || '';
  enhanceMoneyInputs(form);
  els.cancelExpenseEdit.classList.remove('hidden');
  setView('gastos');
}

function attachRealtime() {
  onSnapshot(query(collection(db, 'sales'), orderBy('createdAt', 'desc')), (snap) => {
    state.sales = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    refreshAll();
  });
  onSnapshot(query(collection(db, 'expenses'), orderBy('createdAt', 'desc')), (snap) => {
    state.expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    refreshAll();
  });
  onSnapshot(query(collection(db, 'cashSessions'), orderBy('createdAt', 'desc')), (snap) => {
    state.cashSessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.currentSession = state.cashSessions.find((item) => !item.closedAt) || null;
    refreshAll();
  });
  onSnapshot(query(collection(db, 'cashMovements'), orderBy('createdAt', 'desc')), (snap) => {
    state.cashMovements = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    refreshAll();
  });
}

async function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try { await signInAnonymously(auth); } catch (error) { console.error(error); }
      return;
    }
    attachRealtime();
  });
}

function startOfWeek(dateString) {
  const d = new Date(`${dateString}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function endOfWeek(dateString) {
  const start = new Date(`${startOfWeek(dateString)}T12:00:00`);
  start.setDate(start.getDate() + 6);
  return new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function buildReport(period) {
  const today = todayISO();
  let from;
  let to;
  let title;
  if (period === 'week') {
    from = startOfWeek(today);
    to = endOfWeek(today);
    title = 'Reporte semanal de ventas';
  } else {
    from = `${today.slice(0, 7)}-01`;
    to = today;
    title = 'Reporte mensual de ventas';
  }
  const rows = state.sales
    .filter((item) => item.date >= from && item.date <= to)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const table = rows.length ? `
    <table style="width:100%; border-collapse:collapse; margin-top:12px; font-family:Arial, sans-serif;">
      <thead>
        <tr>
          <th style="text-align:left; padding:8px; border-bottom:1px solid #ccc;">Fecha</th>
          <th style="text-align:left; padding:8px; border-bottom:1px solid #ccc;">Comprobante</th>
          <th style="text-align:left; padding:8px; border-bottom:1px solid #ccc;">Cobro</th>
          <th style="text-align:right; padding:8px; border-bottom:1px solid #ccc;">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((sale) => `
          <tr>
            <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(dateLabel(sale.date))}</td>
            <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(sale.documentType || '-')} ${escapeHtml(sale.documentNumber || '')}</td>
            <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtml(sale.paymentMethodLabel || sale.paymentMethod || '-')}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${escapeHtml(currency(sale.amount))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<p>No hay ventas en el período seleccionado.</p>';

  const html = `
    <div class="print-area">
      <h1 style="margin:0 0 8px; font-family:Arial, sans-serif;">SF</h1>
      <h2 style="margin:0 0 8px; font-family:Arial, sans-serif;">${title}</h2>
      <p style="margin:0 0 16px; color:#555; font-family:Arial, sans-serif;">Desde ${dateLabel(from)} hasta ${dateLabel(to)}</p>
      <div style="padding:12px 14px; border-radius:12px; background:#f3f7fb; font-family:Arial, sans-serif; font-weight:700;">Total: ${currency(total)}</div>
      ${table}
    </div>
  `;
  state.reportHtml = html;
  state.reportTitle = title;
  els.reportPreview.innerHTML = html;
  openModal(els.reportModal);
}

function printCurrentReport() {
  if (!state.reportHtml) return;
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    alert('Tu navegador bloqueó la ventana de impresión. Permitila e intentá de nuevo.');
    return;
  }
  reportWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(state.reportTitle)}</title>
        <meta charset="utf-8" />
      </head>
      <body>${state.reportHtml}</body>
    </html>
  `);
  reportWindow.document.close();
  reportWindow.focus();
  setTimeout(() => reportWindow.print(), 250);
}

function downloadBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    app: 'SF',
    sales: state.sales,
    expenses: state.expenses,
    cashSessions: state.cashSessions,
    cashMovements: state.cashMovements,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sf-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showMsg(els.settingsMsg, 'Backup descargado correctamente.', 'success');
}

async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  if (snap.empty) return;
  let batch = writeBatch(db);
  let count = 0;
  for (const row of snap.docs) {
    batch.delete(row.ref);
    count += 1;
    if (count === 400) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

async function clearSystem() {
  const wantsBackup = confirm('Antes de limpiar todo, ¿querés descargar un backup?');
  if (wantsBackup) downloadBackup();
  const sure = confirm('Esta acción eliminará ventas, gastos, cajas e ingresos de dinero. ¿Querés continuar?');
  if (!sure) return;
  try {
    await clearCollection('sales');
    await clearCollection('expenses');
    await clearCollection('cashMovements');
    await clearCollection('cashSessions');
    showMsg(els.settingsMsg, 'Sistema limpiado correctamente.', 'success');
  } catch (error) {
    console.error(error);
    showMsg(els.settingsMsg, 'No se pudo limpiar todo el sistema.', 'error');
  }
}

els.navBtns.forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));
els.salePaymentMethod.addEventListener('change', updateSaleConditionalFields);
els.cancelSaleEdit.addEventListener('click', resetSaleForm);
els.cancelExpenseEdit.addEventListener('click', resetExpenseForm);
els.cancelCajaEdit.addEventListener('click', resetCajaForm);
els.cancelCashMovementEdit.addEventListener('click', resetCashMovementForm);
els.settingsBtn.addEventListener('click', () => openModal(els.settingsModal));
els.closeSettingsBtn.addEventListener('click', () => closeModal(els.settingsModal));
els.closeReportBtn.addEventListener('click', () => closeModal(els.reportModal));
els.weeklyReportBtn.addEventListener('click', () => buildReport('week'));
els.monthlyReportBtn.addEventListener('click', () => buildReport('month'));
els.printReportBtn.addEventListener('click', printCurrentReport);
els.backupBtn.addEventListener('click', downloadBackup);
els.clearSystemBtn.addEventListener('click', clearSystem);
els.themeSelect.addEventListener('change', () => applyTheme(els.themeSelect.value));
[els.settingsModal, els.reportModal].forEach((modal) => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
});

els.openCajaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.openCajaMsg, '');
  const form = e.currentTarget;
  const payload = {
    date: form.date.value || todayISO(),
    openingCash: parseMoneyValue(form.cash.value),
    openingChecks: parseMoneyValue(form.checks.value),
    openingTransfers: parseMoneyValue(form.transfers.value),
    note: form.note.value.trim(),
  };

  if (form.id.value) {
    await updateDoc(doc(db, 'cashSessions', form.id.value), payload);
    showMsg(els.openCajaMsg, 'Caja editada correctamente.', 'success');
  } else {
    if (isCajaOpen()) {
      showMsg(els.openCajaMsg, 'Ya hay una caja abierta.', 'error');
      return;
    }
    await addDoc(collection(db, 'cashSessions'), { ...payload, createdAt: serverTimestamp() });
    showMsg(els.openCajaMsg, 'Caja abierta correctamente.', 'success');
  }
  resetCajaForm();
});

els.closeCajaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.closeCajaMsg, '');
  if (!isCajaOpen()) {
    showMsg(els.closeCajaMsg, 'No hay una caja abierta para cerrar.', 'error');
    return;
  }
  const box = currentCajaBreakdown();
  const total = box.efectivo + box.cheque + box.transferencia;
  await updateDoc(doc(db, 'cashSessions', state.currentSession.id), {
    closingCash: box.efectivo,
    closingChecks: box.cheque,
    closingTransfers: box.transferencia,
    closingTotal: total,
    closeNote: e.currentTarget.note.value.trim(),
    closedAt: serverTimestamp(),
  });
  e.currentTarget.reset();
  e.currentTarget.date.value = todayISO();
  showMsg(els.closeCajaMsg, 'Caja cerrada correctamente.', 'success');
});

els.cashMovementForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.cashMovementMsg, '');
  if (!requireOpenCaja()) return;
  const form = e.currentTarget;
  const payload = {
    date: form.date.value || todayISO(),
    amount: parseMoneyValue(form.amount.value),
    target: form.target.value,
    sourceType: form.sourceType.value,
    sourceTypeLabel: form.sourceType.value === 'cuenta_corriente' ? 'Cuenta corriente' : 'Otros',
    sourceName: form.sourceName.value.trim(),
    details: form.details.value.trim(),
    cashSessionId: state.currentSession.id,
  };
  if (form.id.value) {
    await updateDoc(doc(db, 'cashMovements', form.id.value), payload);
    showMsg(els.cashMovementMsg, 'Ingreso editado correctamente.', 'success');
  } else {
    await addDoc(collection(db, 'cashMovements'), { ...payload, createdAt: serverTimestamp() });
    showMsg(els.cashMovementMsg, 'Ingreso guardado correctamente.', 'success');
  }
  resetCashMovementForm();
});

els.saleForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.saleMsg, '');
  if (!requireOpenCaja()) return;
  const form = e.currentTarget;
  const method = form.paymentMethod.value;
  const payload = {
    date: form.date.value || todayISO(),
    amount: parseMoneyValue(form.amount.value),
    documentType: form.documentType.value,
    documentNumber: form.documentNumber.value.trim(),
    paymentMethod: method,
    paymentMethodLabel: ({ efectivo: 'Efectivo', cheque: 'Cheque', transferencia: 'Transferencia', cuenta_corriente: 'Cuenta corriente' })[method] || method,
    bankInfo: form.bankInfo.value.trim(),
    customerFirstName: form.customerFirstName.value.trim(),
    customerLastName: form.customerLastName.value.trim(),
    details: form.details.value.trim(),
    cashSessionId: state.currentSession.id,
  };
  if (method === 'cuenta_corriente' && (!payload.customerFirstName || !payload.customerLastName)) {
    showMsg(els.saleMsg, 'Completá nombre y apellido del cliente.', 'error');
    return;
  }
  if (form.id.value) {
    await updateDoc(doc(db, 'sales', form.id.value), payload);
    showMsg(els.saleMsg, 'Venta editada correctamente.', 'success');
  } else {
    await addDoc(collection(db, 'sales'), { ...payload, createdAt: serverTimestamp() });
    showMsg(els.saleMsg, 'Venta guardada correctamente.', 'success');
  }
  resetSaleForm();
});

els.expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.expenseMsg, '');
  if (!requireOpenCaja()) return;
  const form = e.currentTarget;
  const payload = {
    date: form.date.value || todayISO(),
    amount: parseMoneyValue(form.amount.value),
    category: form.category.value,
    details: form.details.value.trim(),
    cashSessionId: state.currentSession.id,
  };
  if (form.id.value) {
    await updateDoc(doc(db, 'expenses', form.id.value), payload);
    showMsg(els.expenseMsg, 'Gasto editado correctamente.', 'success');
  } else {
    await addDoc(collection(db, 'expenses'), { ...payload, createdAt: serverTimestamp() });
    showMsg(els.expenseMsg, 'Gasto guardado correctamente.', 'success');
  }
  resetExpenseForm();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.classList.remove('hidden');
});

els.installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.classList.add('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach((reg) => {
        if (!reg.active?.scriptURL?.includes('sf-final-20260330') && !reg.installing?.scriptURL?.includes('sf-final-20260330')) {
          reg.update();
        }
      });
      await navigator.serviceWorker.register('./sw.js?v=sf-final-20260330');
    } catch (error) {
      console.error(error);
    }
  });
}

function init() {
  applyTheme(localStorage.getItem('sf-theme') || 'light');
  els.openCajaForm.date.value = todayISO();
  els.closeCajaForm.date.value = todayISO();
  resetCajaForm();
  resetSaleForm();
  resetExpenseForm();
  resetCashMovementForm();
  enhanceMoneyInputs(document);
  initAuth();
}

init();
