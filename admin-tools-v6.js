import { db } from './firebase-config.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const money = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(v || 0));
const clean = (v) => String(v || '').trim().toLowerCase();
const sanitizeId = (v) => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const toNumber = (value) => {
  const text = String(value ?? '').trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
};
async function sha256(text) {
  const data = new TextEncoder().encode(String(text || ''));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
async function findRelatedCargoDocs(sale) {
  if (!sale?.customerId) return [];
  const snap = await getDocs(query(collection(db, 'account_movements'), where('customerId', '==', sale.customerId), where('type', '==', 'cargo')));
  const wantedDetail = `${sale.documentType || ''} ${sale.documentNumber || ''}`.trim();
  return snap.docs.filter((d) => {
    const x = d.data();
    const detail = String(x.detail || '').trim();
    return detail === wantedDetail || (x.date === sale.date && Number(x.amount || 0) === Number(sale.amount || 0));
  });
}
async function syncSaleMovement(oldSale, newSale) {
  const related = await findRelatedCargoDocs(oldSale);
  if (newSale.operationType === 'cuenta_corriente' && newSale.customerId) {
    const payload = {
      customerId: newSale.customerId,
      date: newSale.date,
      type: 'cargo',
      amount: Number(newSale.amount || 0),
      method: newSale.paymentMethod || 'cuenta corriente',
      detail: `${newSale.documentType || ''} ${newSale.documentNumber || ''}`.trim(),
      updatedAt: serverTimestamp()
    };
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
async function deleteSaleAndMovement(saleId) {
  const snap = await getDoc(doc(db, 'sales', saleId));
  if (!snap.exists()) return;
  const sale = { id: snap.id, ...snap.data() };
  const related = await findRelatedCargoDocs(sale);
  await deleteDoc(doc(db, 'sales', saleId));
  for (const rel of related) await deleteDoc(doc(db, 'account_movements', rel.id));
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
  const updated = {
    ...sale,
    date,
    amount: toNumber(amount),
    paymentMethod: clean(paymentMethod) || 'efectivo',
    operationType: clean(operationType) === 'cuenta_corriente' ? 'cuenta_corriente' : 'contado',
    documentType,
    documentNumber,
    details,
    updatedAt: serverTimestamp()
  };
  await updateDoc(doc(db, 'sales', saleId), {
    date: updated.date,
    amount: updated.amount,
    paymentMethod: updated.paymentMethod,
    operationType: updated.operationType,
    documentType: updated.documentType,
    documentNumber: updated.documentNumber,
    details: updated.details,
    updatedAt: serverTimestamp()
  });
  if (updated.operationType === 'cuenta_corriente' && !updated.customerId) {
    alert('La venta se editó, pero no se pudo asociar movimiento de cuenta corriente porque no tiene cliente guardado.');
    return;
  }
  await syncSaleMovement(sale, updated);
}
async function editUser(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return;
  const data = snap.data();
  const name = prompt('Nombre del usuario', data.name || ''); if (name === null) return;
  const usernameRaw = prompt('Usuario', data.username || ''); if (usernameRaw === null) return;
  const roleRaw = prompt('Rol: administrador o vendedor', data.role || 'vendedor'); if (roleRaw === null) return;
  const password = prompt('Nueva contraseña (dejá vacío para conservar la actual)', ''); if (password === null) return;
  const username = clean(usernameRaw);
  const role = clean(roleRaw) === 'administrador' ? 'administrador' : 'vendedor';
  const payload = { ...data, name, username, role, updatedAt: serverTimestamp() };
  if (password.trim()) payload.passwordHash = await sha256(password.trim());
  const newId = sanitizeId(username);
  if (!newId) return alert('El usuario no es válido.');
  if (newId !== userId) {
    await setDoc(doc(db, 'users', newId), payload, { merge: true });
    await deleteDoc(doc(db, 'users', userId));
  } else {
    await updateDoc(doc(db, 'users', userId), payload);
  }
}
async function deleteUserSafe(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.role === 'administrador') {
    const admins = await getDocs(query(collection(db, 'users'), where('role', '==', 'administrador')));
    if (admins.size <= 1) return alert('No se puede eliminar el último administrador.');
  }
  await deleteDoc(doc(db, 'users', userId));
}
function setupUsersList() {
  const box = document.getElementById('usersList');
  if (!box) return;
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    box.innerHTML = rows.length ? rows.map((row) => `
      <div class="list-item" style="grid-template-columns:1fr auto">
        <div>
          <strong>${escapeHtml(row.name || row.username || 'Usuario')}</strong>
          <small>${escapeHtml(row.username || '')} · ${escapeHtml(row.role || '')}</small>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn secondary" type="button" data-edit-user="${row.id}">Editar</button>
          <button class="btn ghost" type="button" data-delete-user="${row.id}">Eliminar</button>
        </div>
      </div>`).join('') : '<p class="muted">No hay usuarios.</p>';
    box.querySelectorAll('[data-edit-user]').forEach((btn) => btn.addEventListener('click', () => editUser(btn.dataset.editUser)));
    box.querySelectorAll('[data-delete-user]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este usuario?')) return;
      await deleteUserSafe(btn.dataset.deleteUser);
    }));
  });
}
function setupSalesList() {
  const box = document.getElementById('salesList');
  if (!box) return;
  const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
  onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).slice(0, 60);
    box.innerHTML = rows.length ? rows.map((row) => `
      <div class="list-item" style="grid-template-columns:1fr auto">
        <div>
          <strong>${escapeHtml(row.documentNumber || 'Sin número')}</strong>
          <small>${escapeHtml(row.date || '')} · ${escapeHtml(row.paymentMethod || '-')} · ${escapeHtml(row.operationType || '-')}</small>
          <small>${escapeHtml(row.documentType || '')} ${escapeHtml(row.details || '')}</small>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center">
          <strong>${escapeHtml(money(row.amount || 0))}</strong>
          <button class="btn secondary" type="button" data-edit-sale="${row.id}">Editar</button>
          <button class="btn ghost" type="button" data-delete-sale="${row.id}">Eliminar</button>
        </div>
      </div>`).join('') : '<p class="muted">No hay ventas cargadas.</p>';
    box.querySelectorAll('[data-edit-sale]').forEach((btn) => btn.addEventListener('click', () => editSale(btn.dataset.editSale)));
    box.querySelectorAll('[data-delete-sale]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta venta?')) return;
      await deleteSaleAndMovement(btn.dataset.deleteSale);
    }));
  });
}
function setupSellerRestrictions() {
  const apply = () => {
    const meta = document.getElementById('sessionMeta');
    const isSeller = /vendedor/i.test(meta?.textContent || '');
    const hideViews = ['inicio', 'presupuestos'];
    hideViews.forEach((name) => {
      document.querySelector(`.nav-btn[data-view="${name}"]`)?.classList.toggle('hidden', isSeller);
      document.getElementById(`${name}View`)?.classList.toggle('hidden', isSeller);
    });
    const active = document.querySelector('.nav-btn.active');
    if (isSeller && ['inicio', 'presupuestos'].includes(active?.dataset.view || '')) {
      document.querySelector('.nav-btn[data-view="ventas"]')?.click();
    }
  };
  const obs = new MutationObserver(apply);
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(apply, 1000);
  apply();
}
function setupLoginCleanupAndInstall() {
  const title = document.querySelector('.login-card h2');
  const subtitle = document.querySelector('.login-card .muted');
  const loginCard = document.querySelector('.login-card');
  const installBtn = document.getElementById('installBtn');
  if (title) title.textContent = 'Mundo Led · Gestión Pro';
  if (subtitle) subtitle.textContent = 'Ingresá con tu usuario para continuar.';
  document.querySelector('.login-brand')?.classList.add('hidden');
  if (loginCard) {
    loginCard.style.maxWidth = '520px';
    loginCard.style.margin = '40px auto';
  }
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) installBtn?.classList.add('hidden');
  window.addEventListener('appinstalled', () => installBtn?.classList.add('hidden'));
}
function setupBudgetStatusColors() {
  const style = document.createElement('style');
  style.textContent = `.btn-state-sent{background:#86efac!important;border-color:#86efac!important;color:#0f172a!important}.btn-state-approved{background:#22c55e!important;border-color:#22c55e!important;color:#ffffff!important}`;
  document.head.appendChild(style);
  const apply = () => {
    document.querySelectorAll('[data-budget-send]').forEach((btn) => {
      const row = btn.closest('.list-item');
      const text = row?.textContent || '';
      if (/Enviado|Aprobado/i.test(text)) btn.classList.add('btn-state-sent');
    });
    document.querySelectorAll('[data-budget-approve]').forEach((btn) => {
      const row = btn.closest('.list-item');
      const text = row?.textContent || '';
      if (/Aprobado/i.test(text)) btn.classList.add('btn-state-approved');
    });
  };
  const obs = new MutationObserver(apply);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  apply();
}
setupUsersList();
setupSalesList();
setupSellerRestrictions();
setupLoginCleanupAndInstall();
setupBudgetStatusColors();