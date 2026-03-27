import { db } from './firebase-config.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const BUSINESS_WHATSAPP = '543735506858';
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
function waitForElement(id, cb) {
  const el = document.getElementById(id);
  if (el) return cb(el);
  const obs = new MutationObserver(() => {
    const found = document.getElementById(id);
    if (found) { obs.disconnect(); cb(found); }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
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
  waitForElement('usersList', (box) => {
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
        </div>
      `).join('') : '<p class="muted">No hay usuarios.</p>';
      box.querySelectorAll('[data-edit-user]').forEach((btn) => btn.addEventListener('click', () => editUser(btn.dataset.editUser)));
      box.querySelectorAll('[data-delete-user]').forEach((btn) => btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este usuario?')) return;
        await deleteUserSafe(btn.dataset.deleteUser);
      }));
    });
  });
}
function setupSalesList() {
  waitForElement('salesList', (box) => {
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
        </div>
      `).join('') : '<p class="muted">No hay ventas cargadas.</p>';
      box.querySelectorAll('[data-edit-sale]').forEach((btn) => btn.addEventListener('click', () => editSale(btn.dataset.editSale)));
      box.querySelectorAll('[data-delete-sale]').forEach((btn) => btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar esta venta?')) return;
        await deleteSaleAndMovement(btn.dataset.deleteSale);
      }));
    });
  });
}
function setupSellerMenuRules() {
  const apply = () => {
    const meta = document.getElementById('sessionMeta');
    const inicioBtn = document.querySelector('.nav-btn[data-view="inicio"]');
    const inicioView = document.getElementById('inicioView');
    const active = document.querySelector('.nav-btn.active');
    const isSeller = /vendedor/i.test(meta?.textContent || '');
    if (inicioBtn) inicioBtn.classList.toggle('hidden', isSeller);
    if (inicioView) inicioView.classList.toggle('hidden', isSeller);
    if (isSeller && active?.dataset.view === 'inicio') {
      document.querySelector('.nav-btn[data-view="ventas"]')?.click();
    }
  };
  const obs = new MutationObserver(apply);
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(apply, 1200);
  apply();
}
function setupInstallButton() {
  const btn = document.getElementById('installBtn');
  if (!btn) return;
  let deferredPrompt = null;
  const showManual = () => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    btn.classList.remove('hidden');
    btn.textContent = 'Instalar app';
  };
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    btn.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    btn.classList.add('hidden');
  });
  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      return;
    }
    alert('En Chrome o Edge: abrí el menú del navegador y elegí Instalar app. En iPhone: Compartir > Agregar a pantalla de inicio.');
  });
  setTimeout(showManual, 3000);
}
function setupWhatsAppCustomerForward() {
  const btn = document.getElementById('saveBudgetCustomerBtn');
  if (!btn) return;
  let payload = null;
  btn.addEventListener('click', () => {
    payload = {
      name: document.getElementById('budgetNewCustomerName')?.value?.trim() || '',
      phone: document.getElementById('budgetNewCustomerPhone')?.value?.trim() || '',
      docType: document.getElementById('budgetNewCustomerDocType')?.value?.trim() || '',
      docNumber: document.getElementById('budgetNewCustomerDocNumber')?.value?.trim() || ''
    };
  }, true);
  btn.addEventListener('click', () => {
    setTimeout(() => {
      if (!payload?.name) return;
      const text = `Nuevo contacto guardado en SeniorFlow:%0A%0ANombre: ${encodeURIComponent(payload.name)}%0ATeléfono: ${encodeURIComponent(payload.phone || '-') }%0A${encodeURIComponent(payload.docType || 'Documento')}: ${encodeURIComponent(payload.docNumber || '-')}`;
      window.open(`https://wa.me/${BUSINESS_WHATSAPP}?text=${text}`, '_blank');
      payload = null;
    }, 700);
  });
}
setupUsersList();
setupSalesList();
setupSellerMenuRules();
setupInstallButton();
setupWhatsAppCustomerForward();