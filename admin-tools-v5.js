import { db } from './firebase-config.js';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const COMPANY = {
  name: 'Mundo Led',
  email: 'info@mundoled.com',
  web: 'https://www.mundoledchaco.com',
  whatsapp: '+54 3735506858',
  logoWide: './img/mundoled-logo-wide.svg'
};

const budgetMap = new Map();
const productMap = new Map();

const money = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(v || 0));
const sanitizeId = (v) => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
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

function enrichItems(items = []) {
  return items.map((item) => {
    const product = item.productId ? productMap.get(item.productId) : null;
    return {
      ...item,
      code: item.code || product?.code || '-'
    };
  });
}

function budgetMarkup(budget) {
  const items = enrichItems(budget.items || []);
  const rows = items.map((item) => `<tr><td style="padding:10px;border-bottom:1px solid #d6e0ef">${escapeHtml(item.code || '-')}</td><td style="padding:10px;border-bottom:1px solid #d6e0ef">${escapeHtml(item.name)}</td><td style="padding:10px;border-bottom:1px solid #d6e0ef;text-align:center">${escapeHtml(String(item.qty))}</td><td style="padding:10px;border-bottom:1px solid #d6e0ef;text-align:center">${escapeHtml(item.unit)}</td><td style="padding:10px;border-bottom:1px solid #d6e0ef;text-align:right">${escapeHtml(money(item.price))}</td><td style="padding:10px;border-bottom:1px solid #d6e0ef;text-align:right">${escapeHtml(money(item.total))}</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Presupuesto ${escapeHtml(budget.code || '')}</title></head><body style="font-family:Inter,Arial,sans-serif;color:#0f172a;margin:0;background:#f6f8fb"><div style="max-width:980px;margin:0 auto;padding:28px"><div style="background:#fff;border:1px solid #dbe4f0;border-radius:20px;overflow:hidden"><div style="padding:24px 28px;background:#ffffff;color:#0f172a;border-bottom:1px solid #dbe4f0"><img src="${COMPANY.logoWide}" alt="${COMPANY.name}" style="max-width:360px;width:100%;height:auto;display:block;margin-bottom:16px"><div style="font-size:14px;color:#475569">${COMPANY.email} · ${COMPANY.web} · ${COMPANY.whatsapp}</div></div><div style="padding:28px"><div style="display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap"><div><div style="font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700">Presupuesto</div><div style="font-size:30px;font-weight:900">${escapeHtml(budget.code || '—')}</div><div style="margin-top:10px;color:#334155">Fecha: ${escapeHtml(budget.date || '')} · Estado: ${escapeHtml((budget.status || 'borrador').replace(/^./, m => m.toUpperCase()))}</div><div style="margin-top:8px;color:#334155">Cliente: ${escapeHtml(budget.customerName || '')}</div></div><div><div style="font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700">Validez</div><div style="font-size:18px;font-weight:700">${escapeHtml(budget.validity || '')}</div><div style="margin-top:8px;color:#334155">${escapeHtml(budget.customerDocType || '')} ${escapeHtml(budget.customerDocNumber || '')}</div></div></div><div style="margin-top:24px;border:1px solid #dbe4f0;border-radius:16px;overflow:hidden"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fbff"><th style="padding:12px;text-align:left">Código</th><th style="padding:12px;text-align:left">Detalle</th><th style="padding:12px">Cant.</th><th style="padding:12px">Unidad</th><th style="padding:12px;text-align:right">Precio</th><th style="padding:12px;text-align:right">Subtotal</th></tr></thead><tbody>${rows}</tbody></table></div><div style="margin-top:24px;display:flex;justify-content:space-between;gap:20px;align-items:flex-end;flex-wrap:wrap"><div style="color:#475569">${escapeHtml(numberToWordsEs(budget.total || 0))}</div><div style="min-width:320px;background:#f8fbff;border:1px solid #dbe4f0;border-radius:16px;padding:18px"><div style="font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700">Total</div><div style="font-size:30px;font-weight:900;margin-top:6px">${money(budget.total || 0)}</div></div></div>${budget.note ? `<div style="margin-top:24px"><div style="font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700">Observaciones</div><div style="margin-top:8px;color:#334155">${escapeHtml(budget.note)}</div></div>` : ''}</div></div></div></body></html>`;
}

function openBudgetForPrint(budget) {
  const win = window.open('', '_blank', 'width=980,height=900');
  if (!win) return;
  win.document.open();
  win.document.write(budgetMarkup(budget));
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 250);
}

function exportBudgetPng(budget) {
  const items = enrichItems(budget.items || []);
  const canvas = document.createElement('canvas');
  canvas.width = 1600; canvas.height = 2000;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f6f8fb'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(70, 70, 1460, 1860);
  ctx.strokeStyle = '#dbe4f0'; ctx.strokeRect(70, 70, 1460, 1860);
  const logo = new Image();
  logo.crossOrigin = 'anonymous';
  logo.onload = () => {
    ctx.drawImage(logo, 110, 110, 520, 150);
    ctx.fillStyle = '#334155'; ctx.font = '26px Arial'; ctx.fillText(`${COMPANY.email} · ${COMPANY.web} · ${COMPANY.whatsapp}`, 110, 300);
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 44px Arial'; ctx.fillText(`Presupuesto ${budget.code || ''}`, 110, 390);
    ctx.font = '28px Arial'; ctx.fillText(`Cliente: ${budget.customerName || ''}`, 110, 440);
    ctx.fillText(`Fecha: ${budget.date || ''} · Estado: ${(budget.status || 'borrador').replace(/^./, m => m.toUpperCase())}`, 110, 480);
    let y = 580;
    ctx.font = 'bold 22px Arial';
    ctx.fillText('Código', 110, y); ctx.fillText('Detalle', 280, y); ctx.fillText('Cant.', 980, y); ctx.fillText('Unidad', 1100, y); ctx.fillText('Subtotal', 1320, y);
    y += 25; ctx.strokeStyle = '#d6e0ef'; ctx.beginPath(); ctx.moveTo(110, y); ctx.lineTo(1480, y); ctx.stroke(); y += 42;
    ctx.font = '22px Arial';
    for (const item of items) {
      ctx.fillStyle = '#0f172a';
      ctx.fillText(String(item.code || '-').slice(0, 12), 110, y);
      ctx.fillText(String(item.name || '').slice(0, 48), 280, y);
      ctx.fillText(String(item.qty || ''), 990, y);
      ctx.fillText(String(item.unit || ''), 1100, y);
      ctx.fillText(money(item.total || 0), 1290, y);
      y += 42;
      if (y > 1600) break;
    }
    y += 60;
    ctx.font = '24px Arial'; ctx.fillStyle = '#475569'; ctx.fillText(numberToWordsEs(budget.total || 0), 110, y);
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 42px Arial'; ctx.fillText(`Total: ${money(budget.total || 0)}`, 1080, y);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${sanitizeId(budget.code || budget.customerName || 'presupuesto') || 'presupuesto'}.png`;
    link.click();
  };
  logo.src = COMPANY.logoWide;
}

function setupBudgetOverrides() {
  onSnapshot(query(collection(db, 'budgets'), orderBy('createdAt', 'desc')), (snap) => {
    budgetMap.clear();
    snap.docs.forEach((d) => budgetMap.set(d.id, { id: d.id, ...d.data() }));
  });
  onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')), (snap) => {
    productMap.clear();
    snap.docs.forEach((d) => productMap.set(d.id, { id: d.id, ...d.data() }));
  });
  document.addEventListener('click', (event) => {
    const printBtn = event.target.closest('[data-budget-print]');
    const pngBtn = event.target.closest('[data-budget-png]');
    if (printBtn) {
      event.preventDefault(); event.stopImmediatePropagation();
      const budget = budgetMap.get(printBtn.dataset.budgetPrint);
      if (budget) openBudgetForPrint(budget);
    }
    if (pngBtn) {
      event.preventDefault(); event.stopImmediatePropagation();
      const budget = budgetMap.get(pngBtn.dataset.budgetPng);
      if (budget) exportBudgetPng(budget);
    }
  }, true);
}

function setupStockModal() {
  const style = document.createElement('style');
  style.textContent = `
    .stock-modal-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.66);backdrop-filter:blur(4px);z-index:55;display:none}
    .stock-modal-backdrop.show{display:block}
    #productForm.stock-floating{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;width:min(92vw,840px);max-height:85vh;overflow:auto;background:#0f172a;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.45)}
  `;
  document.head.appendChild(style);
  const backdrop = document.createElement('div');
  backdrop.className = 'stock-modal-backdrop';
  document.body.appendChild(backdrop);
  const bind = () => {
    const form = document.getElementById('productForm');
    const btn = document.getElementById('toggleProductFormBtn');
    if (!form || !btn || form.dataset.v5Bound === '1') return;
    form.dataset.v5Bound = '1';
    const open = () => { form.classList.remove('hidden'); form.classList.add('stock-floating'); backdrop.classList.add('show'); };
    const close = () => { form.classList.add('hidden'); form.classList.remove('stock-floating'); backdrop.classList.remove('show'); };
    btn.addEventListener('click', (e) => { e.preventDefault(); if (form.classList.contains('hidden')) open(); else close(); });
    backdrop.addEventListener('click', close);
    form.addEventListener('submit', () => setTimeout(close, 300));
  };
  const obs = new MutationObserver(bind);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  bind();
}

setupBudgetOverrides();
setupStockModal();