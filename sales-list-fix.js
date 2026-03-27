import { db } from './firebase-config.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const money = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(v || 0));
const clean = (v) => String(v || '').trim().toLowerCase();
const toNumber = (value) => {
  const text = String(value ?? '').trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

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

async function editSale(saleId) {
  const snap = await getDoc(doc(db, 'sales', saleId));
  if (!snap.exists()) return;
  const sale = { id: snap.id, ...snap.data() };
  const date = prompt('Fecha de la venta', sale.date || ''); if (date === null) return;
  const amount = prompt('Monto', sale.amount || ''); if (amount === null) return;
  const paymentMethod = prompt('Medio de cobro', sale.paymentMethod || ''); if (paymentMethod === null) return;
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

document.addEventListener('DOMContentLoaded', () => {
  const box = document.getElementById('salesList');
  if (!box) return;
  let rowsCache = [];
  const render = () => {
    box.innerHTML = rowsCache.length ? rowsCache.map((row) => `<div class="list-item" style="grid-template-columns:1fr auto"><div><strong>${escapeHtml(row.documentNumber || 'Sin número')}</strong><small>${escapeHtml(row.date || '')} · ${escapeHtml(row.paymentMethod || '-')} · ${escapeHtml(row.operationType || '-')}</small><small>${escapeHtml(row.documentType || '')} ${escapeHtml(row.details || '')}</small></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center"><strong>${escapeHtml(money(row.amount || 0))}</strong><button class="btn secondary" type="button" data-edit-sale="${row.id}">Editar</button><button class="btn ghost" type="button" data-delete-sale="${row.id}">Eliminar</button></div></div>`).join('') : '<p class="muted">No hay ventas cargadas.</p>';
    box.querySelectorAll('[data-edit-sale]').forEach((btn) => btn.addEventListener('click', () => editSale(btn.dataset.editSale)));
    box.querySelectorAll('[data-delete-sale]').forEach((btn) => btn.addEventListener('click', async () => { if (!confirm('¿Eliminar esta venta?')) return; await deleteSaleAndMovement(btn.dataset.deleteSale); }));
  };
  onSnapshot(query(collection(db, 'sales'), orderBy('createdAt', 'desc')), (snap) => {
    rowsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() })).slice(0, 80);
    setTimeout(render, 60);
  });
  const observer = new MutationObserver(() => {
    if (rowsCache.length && !box.querySelector('[data-edit-sale]')) setTimeout(render, 30);
  });
  observer.observe(box, { childList: true, subtree: true });
});
