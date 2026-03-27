import { db } from './firebase-config.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const COMPANY = {
  name: 'Mundo Led',
  email: 'info@mundoled.com',
  web: 'https://www.mundoledchaco.com',
  whatsapp: '+54 3735506858',
  logo: './img/mundoled-logo-wide.svg'
};
const money = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(v || 0));
const clean = (v) => String(v || '').trim().toLowerCase();
const sanitizeId = (v) => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const toNumber = (value) => {
  const text = String(value ?? '').trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
};
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
async function sha256(text) { const data = new TextEncoder().encode(String(text || '')); const hash = await crypto.subtle.digest('SHA-256', data); return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function numberToWordsEs(value) {
  const n = Math.floor(Math.abs(Number(value || 0)));
  const units = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  function underHundred(x) { if (x < 10) return units[x]; if (x < 20) return teens[x - 10]; if (x < 30) return x === 20 ? 'veinte' : 'veinti' + units[x - 20]; const t = Math.floor(x / 10), u = x % 10; return u ? `${tens[t]} y ${units[u]}` : tens[t]; }
  function underThousand(x) { if (x === 0) return ''; if (x === 100) return 'cien'; const h = Math.floor(x / 100), r = x % 100; return [hundreds[h], underHundred(r)].filter(Boolean).join(' '); }
  function convert(x) { if (x === 0) return 'cero'; let words = []; let rem = x; const millions = Math.floor(rem / 1000000); rem %= 1000000; const thousands = Math.floor(rem / 1000); rem %= 1000; if (millions) words.push(millions === 1 ? 'un millón' : `${convert(millions)} millones`); if (thousands) words.push(thousands === 1 ? 'mil' : `${convert(thousands)} mil`); if (rem) words.push(underThousand(rem)); return words.join(' ').replace(/\s+/g, ' ').trim(); }
  const cents = Math.round((Math.abs(Number(value || 0)) - n) * 100);
  return `${Number(value || 0) < 0 ? 'menos ' : ''}${convert(n)} pesos${cents ? ` con ${String(cents).padStart(2, '0')}/100` : ''}`;
}

const state = { products: new Map(), budgets: new Map() };

function setupLoginAndInstall() {
  const installBtn = document.getElementById('installBtn');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) installBtn?.classList.add('hidden');
  window.addEventListener('appinstalled', () => installBtn?.classList.add('hidden'));
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn?.classList.remove('hidden');
  });
  installBtn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      return;
    }
    alert('En Chrome o Edge: menú del navegador > Instalar app. En iPhone: Compartir > Agregar a pantalla de inicio.');
  });
}

function setupStockModal() {
  const form = document.getElementById('productForm');
  const btn = document.getElementById('toggleProductFormBtn');
  if (!form || !btn) return;
  const style = document.createElement('style');
  style.textContent = `.stock-modal-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.68);backdrop-filter:blur(4px);z-index:60;display:none}.stock-modal-backdrop.show{display:block}#productForm.stock-floating{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:61;width:min(92vw,860px);max-height:86vh;overflow:auto;background:#0f172a;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.45)}`;
  document.head.appendChild(style);
  const backdrop = document.createElement('div');
  backdrop.className = 'stock-modal-backdrop';
  document.body.appendChild(backdrop);
  const open = () => { form.classList.remove('hidden'); form.classList.add('stock-floating'); backdrop.classList.add('show'); };
  const close = () => { form.classList.add('hidden'); form.classList.remove('stock-floating'); backdrop.classList.remove('show'); };
  btn.addEventListener('click', (e) => { e.preventDefault(); open(); });
  backdrop.addEventListener('click', close);
  form.addEventListener('submit', () => setTimeout(close, 350));
}

function setupSellerRestrictions() {
  const apply = () => {
    const meta = document.getElementById('sessionMeta');
    const isSeller = /vendedor/i.test(meta?.textContent || '');
    ['inicio','presupuestos'].forEach((name) => {
      document.querySelector(`.nav-btn[data-view="${name}"]`)?.classList.toggle('hidden', isSeller);
      document.getElementById(`${name}View`)?.classList.toggle('hidden', isSeller);
    });
    const active = document.querySelector('.nav-btn.active');
    if (isSeller && ['inicio','presupuestos'].includes(active?.dataset.view || '')) {
      document.querySelector('.nav-btn[data-view="ventas"]')?.click();
    }
  };
  const obs = new MutationObserver(apply);
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(apply, 1000);
  apply();
}

async function findRelatedCargoDocs(sale) {
  if (!sale?.customerId) return [];
  const snap = await getDocs(query(collection(db, 'account_movements'), where('customerId', '==', sale.customerId), where('type', '==', 'cargo')));
  const wantedDetail = `${sale.documentType || ''} ${sale.documentNumber || ''}`.trim();
  return snap.docs.filter((d) => {
    const x = d.data();
    return String(x.detail || '').trim() === wantedDetail || (x.date === sale.date && Number(x.amount || 0) === Number(sale.amount || 0));
  });
}
async function syncSaleMovement(oldSale, newSale) {
  const related = await findRelatedCargoDocs(oldSale);
  if (newSale.operationType === 'cuenta_corriente' && newSale.customerId) {
    const payload = { customerId: newSale.customerId, date: newSale.date, type: 'cargo', amount: Number(newSale.amount || 0), method: newSale.paymentMethod || 'cuenta corriente', detail: `${newSale.documentType || ''} ${newSale.documentNumber || ''}`.trim(), updatedAt: serverTimestamp() };
    if (related.length) {
      await updateDoc(doc(db, 'account_movements', related[0].id), payload);
      for (const extra of related.slice(1)) await deleteDoc(doc(db, 'account_movements', extra.id));
    } else {
      await addDoc(collection(db, 'account_movements'), { ...payload, createdAt: serverTimestamp() });
    }
  } else {
    for (const rel of related) await deleteDoc(doc(db, 'account_movements', rel.id));
  }
}
async function editSale(saleId) {
  const snap = await getDoc(doc(db, 'sales', saleId));
  if (!snap.exists()) return;
  const sale = { id: snap.id, ...snap.data() };
  const date = prompt('Fecha de la venta', sale.date || ''); if (date === null) return;
  const amount = prompt('Monto', sale.amount || ''); if (amount === null) return;
  const paymentMethod = prompt('Medio de cobro: efectivo, cheque, transferencia, tarjeta u otro', sale.paymentMethod || ''); if (paymentMethod === null) return;
  const operationType = prompt('Operación: contado o cuenta_corriente', sale.operationType || ''); if (operationType === null) return;
  const documentType = prompt('Comprobante', sale.documentType || ''); if (documentType === null) return;
  const documentNumber = prompt('Número', sale.documentNumber || ''); if (documentNumber === null) return;
  const details = prompt('Detalle', sale.details || ''); if (details === null) return;
  const updated = { ...sale, date, amount: toNumber(amount), paymentMethod: clean(paymentMethod) || 'efectivo', operationType: clean(operationType) === 'cuenta_corriente' ? 'cuenta_corriente' : 'contado', documentType, documentNumber, details };
  await updateDoc(doc(db, 'sales', saleId), { date: updated.date, amount: updated.amount, paymentMethod: updated.paymentMethod, operationType: updated.operationType, documentType: updated.documentType, documentNumber: updated.documentNumber, details: updated.details, updatedAt: serverTimestamp() });
  await syncSaleMovement(sale, updated);
}
async function deleteSaleAndMovement(saleId) {
  const snap = await getDoc(doc(db, 'sales', saleId));
  if (!snap.exists()) return;
  const sale = { id: snap.id, ...snap.data() };
  const related = await findRelatedCargoDocs(sale);
  await deleteDoc(doc(db, 'sales', saleId));
  for (const rel of related) await deleteDoc(doc(db, 'account_movements', rel.id));
}
function setupSalesList() {
  const box = document.getElementById('salesList');
  if (!box) return;
  onSnapshot(query(collection(db, 'sales'), orderBy('createdAt', 'desc')), (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).slice(0, 80);
    box.innerHTML = rows.length ? rows.map((row) => `<div class="list-item" style="grid-template-columns:1fr auto"><div><strong>${escapeHtml(row.documentNumber || 'Sin número')}</strong><small>${escapeHtml(row.date || '')} · ${escapeHtml(row.paymentMethod || '-')} · ${escapeHtml(row.operationType || '-')}</small><small>${escapeHtml(row.documentType || '')} ${escapeHtml(row.details || '')}</small></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center"><strong>${escapeHtml(money(row.amount || 0))}</strong><button class="btn secondary" type="button" data-edit-sale="${row.id}">Editar</button><button class="btn ghost" type="button" data-delete-sale="${row.id}">Eliminar</button></div></div>`).join('') : '<p class="muted">No hay ventas cargadas.</p>';
    box.querySelectorAll('[data-edit-sale]').forEach((btn) => btn.addEventListener('click', () => editSale(btn.dataset.editSale)));
    box.querySelectorAll('[data-delete-sale]').forEach((btn) => btn.addEventListener('click', async () => { if (!confirm('¿Eliminar esta venta?')) return; await deleteSaleAndMovement(btn.dataset.deleteSale); }));
  });
}
async function editUser(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return;
  const data = snap.data();
  const name = prompt('Nombre del usuario', data.name || ''); if (name === null) return;
  const usernameRaw = prompt('Usuario', data.username || ''); if (usernameRaw === null) return;
  const roleRaw = prompt('Rol: administrador o vendedor', data.role || 'vendedor'); if (roleRaw === null) return;
  const password = prompt('Nueva contraseña (dejá vacío para conservar la actual)', ''); if (password === null) return;
  const username = clean(usernameRaw); const role = clean(roleRaw) === 'administrador' ? 'administrador' : 'vendedor';
  const payload = { ...data, name, username, role, updatedAt: serverTimestamp() };
  if (password.trim()) payload.passwordHash = await sha256(password.trim());
  const newId = sanitizeId(username);
  if (newId !== userId) { await setDoc(doc(db, 'users', newId), payload, { merge: true }); await deleteDoc(doc(db, 'users', userId)); } else { await updateDoc(doc(db, 'users', userId), payload); }
}
async function deleteUserSafe(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return;
  if (snap.data().role === 'administrador') {
    const admins = await getDocs(query(collection(db, 'users'), where('role', '==', 'administrador')));
    if (admins.size <= 1) return alert('No se puede eliminar el último administrador.');
  }
  await deleteDoc(doc(db, 'users', userId));
}
function setupUsersList() {
  const box = document.getElementById('usersList');
  if (!box) return;
  onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc')), (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    box.innerHTML = rows.length ? rows.map((row) => `<div class="list-item" style="grid-template-columns:1fr auto"><div><strong>${escapeHtml(row.name || row.username || 'Usuario')}</strong><small>${escapeHtml(row.username || '')} · ${escapeHtml(row.role || '')}</small></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn secondary" type="button" data-edit-user="${row.id}">Editar</button><button class="btn ghost" type="button" data-delete-user="${row.id}">Eliminar</button></div></div>`).join('') : '<p class="muted">No hay usuarios.</p>';
    box.querySelectorAll('[data-edit-user]').forEach((btn) => btn.addEventListener('click', () => editUser(btn.dataset.editUser)));
    box.querySelectorAll('[data-delete-user]').forEach((btn) => btn.addEventListener('click', async () => { if (!confirm('¿Eliminar este usuario?')) return; await deleteUserSafe(btn.dataset.deleteUser); }));
  });
}

function enrichItems(items = []) { return items.map((item) => ({ ...item, code: item.code || (item.productId ? state.products.get(item.productId)?.code : '') || '-' })); }
function budgetMarkup(budget) {
  const items = enrichItems(budget.items || []);
  const rows = items.map((item) => `<tr><td style="padding:10px;border-bottom:1px solid #d6e0ef">${escapeHtml(item.code)}</td><td style="padding:10px;border-bottom:1px solid #d6e0ef">${escapeHtml(item.name)}</td><td style="padding:10px;border-bottom:1px solid #d6e0ef;text-align:center">${escapeHtml(String(item.qty))}</td><td style="padding:10px;border-bottom:1px solid #d6e0ef;text-align:center">${escapeHtml(item.unit)}</td><td style="padding:10px;border-bottom:1px solid #d6e0ef;text-align:right">${escapeHtml(money(item.price))}</td><td style="padding:10px;border-bottom:1px solid #d6e0ef;text-align:right">${escapeHtml(money(item.total))}</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Presupuesto ${escapeHtml(budget.code || '')}</title></head><body style="font-family:Inter,Arial,sans-serif;color:#0f172a;margin:0;background:#f6f8fb"><div style="max-width:980px;margin:0 auto;padding:28px"><div style="background:#fff;border:1px solid #dbe4f0;border-radius:20px;overflow:hidden"><div style="padding:24px 28px;background:#ffffff;color:#0f172a;border-bottom:1px solid #dbe4f0"><img src="${COMPANY.logo}" alt="${COMPANY.name}" style="max-width:360px;width:100%;height:auto;display:block;margin-bottom:16px"><div style="font-size:14px;color:#475569">${COMPANY.email} · ${COMPANY.web} · ${COMPANY.whatsapp}</div></div><div style="padding:28px"><div style="display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap"><div><div style="font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700">Presupuesto</div><div style="font-size:30px;font-weight:900">${escapeHtml(budget.code || '—')}</div><div style="margin-top:10px;color:#334155">Fecha: ${escapeHtml(budget.date || '')} · Estado: ${escapeHtml((budget.status || 'borrador').replace(/^./, m => m.toUpperCase()))}</div><div style="margin-top:8px;color:#334155">Cliente: ${escapeHtml(budget.customerName || '')}</div></div><div><div style="font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700">Validez</div><div style="font-size:18px;font-weight:700">${escapeHtml(budget.validity || '')}</div></div></div><div style="margin-top:24px;border:1px solid #dbe4f0;border-radius:16px;overflow:hidden"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fbff"><th style="padding:12px;text-align:left">Código</th><th style="padding:12px;text-align:left">Detalle</th><th style="padding:12px">Cant.</th><th style="padding:12px">Unidad</th><th style="padding:12px;text-align:right">Precio</th><th style="padding:12px;text-align:right">Subtotal</th></tr></thead><tbody>${rows}</tbody></table></div><div style="margin-top:24px;display:flex;justify-content:space-between;gap:20px;align-items:flex-end;flex-wrap:wrap"><div style="color:#475569">${escapeHtml(numberToWordsEs(budget.total || 0))}</div><div style="min-width:320px;background:#f8fbff;border:1px solid #dbe4f0;border-radius:16px;padding:18px"><div style="font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700">Total</div><div style="font-size:30px;font-weight:900;margin-top:6px">${money(budget.total || 0)}</div></div></div>${budget.note ? `<div style="margin-top:24px"><div style="font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700">Observaciones</div><div style="margin-top:8px;color:#334155">${escapeHtml(budget.note)}</div></div>` : ''}</div></div></div></body></html>`;
}
function openBudgetForPrint(budget) { const win = window.open('', '_blank', 'width=980,height=900'); if (!win) return; win.document.open(); win.document.write(budgetMarkup(budget)); win.document.close(); setTimeout(() => { win.focus(); win.print(); }, 250); }
function exportBudgetPng(budget) {
  const items = enrichItems(budget.items || []);
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 2000; const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f6f8fb'; ctx.fillRect(0,0,1600,2000); ctx.fillStyle = '#ffffff'; ctx.fillRect(70,70,1460,1860); ctx.strokeStyle = '#dbe4f0'; ctx.strokeRect(70,70,1460,1860);
  const logo = new Image(); logo.crossOrigin = 'anonymous'; logo.onload = () => { ctx.drawImage(logo, 110, 100, 520, 150); ctx.fillStyle = '#334155'; ctx.font = '26px Arial'; ctx.fillText(`${COMPANY.email} · ${COMPANY.web} · ${COMPANY.whatsapp}`, 110, 290); ctx.fillStyle = '#0f172a'; ctx.font = 'bold 44px Arial'; ctx.fillText(`Presupuesto ${budget.code || ''}`, 110, 380); ctx.font = '28px Arial'; ctx.fillText(`Cliente: ${budget.customerName || ''}`, 110, 430); ctx.fillText(`Fecha: ${budget.date || ''} · Estado: ${(budget.status || 'borrador').replace(/^./, m => m.toUpperCase())}`, 110, 470); let y = 570; ctx.font = 'bold 22px Arial'; ['Código','Detalle','Cant.','Unidad','Subtotal'].forEach((t,i)=>ctx.fillText(t,[110,280,980,1100,1320][i],y)); y+=24; ctx.beginPath(); ctx.moveTo(110,y); ctx.lineTo(1480,y); ctx.stroke(); y+=42; ctx.font = '22px Arial'; for (const item of items) { ctx.fillText(String(item.code||'-').slice(0,12),110,y); ctx.fillText(String(item.name||'').slice(0,48),280,y); ctx.fillText(String(item.qty||''),990,y); ctx.fillText(String(item.unit||''),1100,y); ctx.fillText(money(item.total||0),1290,y); y+=42; if (y>1600) break; } y+=60; ctx.fillStyle='#475569'; ctx.font='24px Arial'; ctx.fillText(numberToWordsEs(budget.total||0),110,y); ctx.fillStyle='#0f172a'; ctx.font='bold 42px Arial'; ctx.fillText(`Total: ${money(budget.total||0)}`,1080,y); const link=document.createElement('a'); link.href=canvas.toDataURL('image/png'); link.download=`${sanitizeId(budget.code||budget.customerName||'presupuesto')}.png`; link.click(); };
  logo.src = COMPANY.logo;
}
function setupBudgetActions() {
  onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')), (snap) => { state.products.clear(); snap.docs.forEach((d) => state.products.set(d.id, { id:d.id, ...d.data() })); });
  onSnapshot(query(collection(db, 'budgets'), orderBy('createdAt', 'desc')), (snap) => { state.budgets.clear(); snap.docs.forEach((d) => state.budgets.set(d.id, { id:d.id, ...d.data() })); });
  const style = document.createElement('style'); style.textContent = `.btn-state-sent{background:#86efac!important;border-color:#86efac!important;color:#0f172a!important}.btn-state-approved{background:#22c55e!important;border-color:#22c55e!important;color:#ffffff!important}`; document.head.appendChild(style);
  document.addEventListener('click', (event) => {
    const printBtn = event.target.closest('[data-budget-print]');
    const pngBtn = event.target.closest('[data-budget-png]');
    if (printBtn) { event.preventDefault(); event.stopImmediatePropagation(); const budget = state.budgets.get(printBtn.dataset.budgetPrint); if (budget) openBudgetForPrint(budget); }
    if (pngBtn) { event.preventDefault(); event.stopImmediatePropagation(); const budget = state.budgets.get(pngBtn.dataset.budgetPng); if (budget) exportBudgetPng(budget); }
  }, true);
  const paint = () => {
    document.querySelectorAll('[data-budget-send]').forEach((btn) => { const row = btn.closest('.list-item'); if (/Enviado|Aprobado/i.test(row?.textContent || '')) btn.classList.add('btn-state-sent'); });
    document.querySelectorAll('[data-budget-approve]').forEach((btn) => { const row = btn.closest('.list-item'); if (/Aprobado/i.test(row?.textContent || '')) btn.classList.add('btn-state-approved'); });
  };
  new MutationObserver(paint).observe(document.documentElement, { childList:true, subtree:true });
  paint();
}

document.addEventListener('DOMContentLoaded', () => {
  setupLoginAndInstall();
  setupStockModal();
  setupSellerRestrictions();
  setupSalesList();
  setupUsersList();
  setupBudgetActions();
});