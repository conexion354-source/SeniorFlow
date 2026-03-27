document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('productForm');
  const btn = document.getElementById('toggleProductFormBtn');
  if (!form || !btn) return;
  let backdrop = document.querySelector('.stock-modal-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'stock-modal-backdrop';
    document.body.appendChild(backdrop);
  }
  const open = () => {
    form.classList.remove('hidden');
    form.classList.add('stock-floating');
    backdrop.classList.add('show');
  };
  const close = () => {
    form.classList.add('hidden');
    form.classList.remove('stock-floating');
    backdrop.classList.remove('show');
  };
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    open();
  }, true);
  backdrop.addEventListener('click', close);
  form.addEventListener('submit', () => setTimeout(close, 350));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
});