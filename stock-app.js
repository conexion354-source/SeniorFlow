import { auth, db } from './firebase-config.js?v=seniorflow-react-20260711-stock-app-05';
import { signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { collection, doc, onSnapshot, updateDoc } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const els = {
  loginScreen: $('loginScreen'),
  appScreen: $('appScreen'),
  loginForm: $('loginForm'),
  username: $('username'),
  password: $('password'),
  loginStatus: $('loginStatus'),
  syncStatus: $('syncStatus'),
  installBtn: $('installBtn'),
  logoutBtn: $('logoutBtn'),
  searchInput: $('searchInput'),
  scanBtn: $('scanBtn'),
  providerSelect: $('providerSelect'),
  cameraPanel: $('cameraPanel'),
  video: $('video'),
  cameraStatus: $('cameraStatus'),
  stopScanBtn: $('stopScanBtn'),
  results: $('results'),
  selectedCard: $('selectedCard'),
  productImage: $('productImage'),
  productTitle: $('productTitle'),
  productMeta: $('productMeta'),
  productStock: $('productStock'),
  stockForm: $('stockForm'),
  qtyInput: $('qtyInput'),
  codigoNuevo: $('codigoNuevo'),
  codigoProveedorNuevo: $('codigoProveedorNuevo'),
  nota: $('nota'),
  saveBtn: $('saveBtn'),
  changeProductBtn: $('changeProductBtn'),
  status: $('status')
};

let productos = [];
let usuarios = [];
let proveedores = [];
let usuarioActual = null;
let productoSeleccionado = null;
let deferredPrompt = null;
let scannerCodigo = null;

const normalizarTexto = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const normalizarCodigo = (value) => String(value || '').replace(/[\s\-_.]/g, '').toUpperCase().trim();
const numero = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value || '0').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const ahoraIso = () => new Date().toISOString();
const escapar = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

const obtenerCostos = (producto) => {
  if (Array.isArray(producto?.proveedoresCostos)) return producto.proveedoresCostos;
  if (Array.isArray(producto?.costosProveedores)) return producto.costosProveedores;
  return [];
};

const obtenerImagen = (producto) => {
  if (producto?.imagen) return producto.imagen;
  if (Array.isArray(producto?.imagenes) && producto.imagenes[0]) return producto.imagenes[0];
  if (producto?.imagenPrincipal) return producto.imagenPrincipal;
  return '';
};

const nombreProveedor = (item) => item?.proveedor || item?.nombre || item?.proveedorNombre || '';

const leerCodigoProveedor = (producto, proveedorElegido = '') => {
  const costos = obtenerCostos(producto);
  const proveedorNorm = normalizarTexto(proveedorElegido);
  const costo = proveedorNorm
    ? costos.find((c) => normalizarTexto(nombreProveedor(c)) === proveedorNorm)
    : costos.find((c) => c?.codigoProveedor);
  return costo?.codigoProveedor || producto?.codigoProveedor || '';
};

const camposProducto = (producto) => {
  const costos = obtenerCostos(producto);
  return [
    producto?.descripcion,
    producto?.detalle,
    producto?.codigo,
    producto?.codigoInterno,
    producto?.codigoBarras,
    producto?.codigoProveedor,
    producto?.marca,
    producto?.categoria,
    ...costos.flatMap((c) => [nombreProveedor(c), c?.codigoProveedor])
  ];
};

const tokensBusqueda = (query) => normalizarTexto(query).split(/\s+/).filter(Boolean);

const productoCoincide = (producto, query, proveedorElegido) => {
  const texto = normalizarTexto(query);
  const codigo = normalizarCodigo(query);
  if (!texto && !codigo) return false;
  const tokens = tokensBusqueda(query);
  const campos = camposProducto(producto);
  const textoCompuesto = normalizarTexto(campos.join(' '));

  if (proveedorElegido) {
    const proveedorNorm = normalizarTexto(proveedorElegido);
    const costosProveedor = obtenerCostos(producto).filter((c) => normalizarTexto(nombreProveedor(c)) === proveedorNorm);
    if (costosProveedor.length === 0) return false;
    return costosProveedor.some((c) => {
      const codigoProv = normalizarCodigo(c?.codigoProveedor);
      return codigoProv && codigoProv.includes(codigo);
    }) || tokens.every((token) => textoCompuesto.includes(token));
  }

  return tokens.every((token) => textoCompuesto.includes(token)) || campos.some((campo) => {
    const textField = normalizarTexto(campo);
    const codeField = normalizarCodigo(campo);
    return textField.includes(texto) || (!!codigo && codeField.includes(codigo));
  });
};

const renderStatus = (message, tone = 'slate') => {
  els.status.textContent = message || '';
  els.status.className = `min-h-6 text-center text-sm font-black ${tone === 'ok' ? 'text-emerald-700' : tone === 'error' ? 'text-rose-600' : 'text-slate-600'}`;
};

const renderProviders = () => {
  const selected = els.providerSelect.value;
  const nombres = new Set(proveedores.map((p) => p?.nombre || p).filter(Boolean));
  productos.forEach((producto) => obtenerCostos(producto).forEach((c) => {
    const nombre = nombreProveedor(c);
    if (nombre) nombres.add(nombre);
  }));
  els.providerSelect.innerHTML = '<option value="">Cualquier proveedor</option>';
  [...nombres].sort((a, b) => a.localeCompare(b, 'es')).forEach((nombre) => {
    const option = document.createElement('option');
    option.value = nombre;
    option.textContent = nombre;
    els.providerSelect.appendChild(option);
  });
  els.providerSelect.value = [...nombres].includes(selected) ? selected : '';
};

const renderResults = () => {
  const query = els.searchInput.value.trim();
  const proveedor = els.providerSelect.value;
  els.results.innerHTML = '';
  els.results.classList.remove('hidden');
  if (query.length < 2) {
    els.results.innerHTML = '<div class="glass rounded-3xl border border-white/70 p-4 text-sm font-bold text-slate-500">Escribi al menos 2 letras o numeros para buscar. No se muestra la lista completa para que sea rapido en el telefono.</div>';
    return;
  }
  const matches = productos
    .filter((producto) => productoCoincide(producto, query, proveedor))
    .sort((a, b) => String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es'))
    .slice(0, 12);

  if (matches.length === 0) {
    els.results.innerHTML = '<div class="glass rounded-3xl border border-white/70 p-4 text-sm font-bold text-slate-500">No encontre productos con esa busqueda.</div>';
    return;
  }

  matches.forEach((producto) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tap w-full glass rounded-3xl border border-white/70 shadow-sm p-3 text-left flex items-center gap-3 active:scale-[.99]';
    button.innerHTML = `
      <div class="h-16 w-16 rounded-2xl bg-white border border-slate-200 grid place-items-center overflow-hidden shrink-0">
        ${obtenerImagen(producto) ? `<img src="${escapar(obtenerImagen(producto))}" alt="" class="max-h-full max-w-full object-contain">` : '<span class="text-xs font-black text-slate-300">IMG</span>'}
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-black text-slate-950 leading-tight">${escapar(producto.descripcion || 'Producto sin nombre')}</p>
        <p class="text-xs font-bold text-slate-500 mt-1">Cod. ${escapar(producto.codigo || '-')} · Stock ${escapar(producto.cantidad ?? producto.stock ?? 0)} ${escapar(producto.unidad || 'unid.')}</p>
        <p class="text-[11px] font-bold text-cyan-700 mt-1 truncate">${leerCodigoProveedor(producto, proveedor) ? `Cod. prov. ${escapar(leerCodigoProveedor(producto, proveedor))}` : 'Sin codigo proveedor seleccionado'}</p>
      </div>
      <span class="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-1">Abrir</span>
    `;
    button.addEventListener('click', () => seleccionarProducto(producto));
    els.results.appendChild(button);
  });
};

const seleccionarProducto = (producto) => {
  productoSeleccionado = producto;
  const stock = numero(producto.cantidad ?? producto.stock ?? 0);
  const proveedor = els.providerSelect.value;
  els.productImage.src = obtenerImagen(producto) || '';
  els.productImage.style.display = obtenerImagen(producto) ? 'block' : 'none';
  els.productTitle.textContent = producto.descripcion || 'Producto sin nombre';
  els.productMeta.textContent = `Codigo ${producto.codigo || '-'} · ${producto.categoria || 'Sin categoria'}`;
  els.productStock.textContent = `Stock actual: ${stock} ${producto.unidad || 'unid.'}`;
  els.codigoNuevo.value = producto.codigo || producto.codigoInterno || producto.codigoBarras || '';
  els.codigoProveedorNuevo.value = leerCodigoProveedor(producto, proveedor);
  els.codigoProveedorNuevo.disabled = !proveedor;
  els.results.classList.add('hidden');
  els.selectedCard.classList.remove('hidden');
  renderStatus('');
  els.selectedCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const volverAlBuscadorStock = (mensaje = '') => {
  productoSeleccionado = null;
  els.selectedCard.classList.add('hidden');
  els.results.classList.remove('hidden');
  els.searchInput.value = '';
  els.qtyInput.value = '1';
  els.codigoNuevo.value = '';
  els.codigoProveedorNuevo.value = '';
  els.nota.value = '';
  renderResults();
  renderStatus(mensaje, mensaje ? 'ok' : 'slate');
  els.searchInput.focus();
};

const actualizarProductoSeleccionado = async (event) => {
  event.preventDefault();
  if (!productoSeleccionado?.id) return;
  const cantidadIngreso = numero(els.qtyInput.value);
  if (cantidadIngreso <= 0) {
    renderStatus('Ingresa una cantidad mayor a cero.', 'error');
    return;
  }

  const codigoNuevo = els.codigoNuevo.value.trim();
  const codigoNuevoNorm = normalizarCodigo(codigoNuevo);
  const codigosActualesProducto = [
    productoSeleccionado.codigo,
    productoSeleccionado.codigoInterno,
    productoSeleccionado.codigoBarras
  ].map((codigo) => normalizarCodigo(codigo)).filter(Boolean);
  const codigoNuevoYaEsDelProducto = codigoNuevoNorm && codigosActualesProducto.includes(codigoNuevoNorm);
  if (codigoNuevoNorm && !codigoNuevoYaEsDelProducto) {
    const duplicado = productos.find((producto) => producto.id !== productoSeleccionado.id && [
      producto.codigo,
      producto.codigoInterno,
      producto.codigoBarras
    ].some((codigo) => normalizarCodigo(codigo) === codigoNuevoNorm));
    if (duplicado) {
      renderStatus(`Ese codigo ya esta usado por: ${duplicado.descripcion || duplicado.codigo}`, 'error');
      return;
    }
  }

  const proveedor = els.providerSelect.value;
  const codigoProveedorNuevo = els.codigoProveedorNuevo.value.trim();
  let proveedoresCostos = obtenerCostos(productoSeleccionado).map((c) => ({ ...c }));
  if (proveedor && codigoProveedorNuevo) {
    const proveedorNorm = normalizarTexto(proveedor);
    const index = proveedoresCostos.findIndex((c) => normalizarTexto(nombreProveedor(c)) === proveedorNorm);
    if (index >= 0) {
      proveedoresCostos[index] = { ...proveedoresCostos[index], proveedor, codigoProveedor: codigoProveedorNuevo };
    } else {
      proveedoresCostos.push({ proveedor, codigoProveedor: codigoProveedorNuevo, costo: 0, moneda: 'ARS' });
    }
  }

  const stockActual = numero(productoSeleccionado.cantidad ?? productoSeleccionado.stock ?? 0);
  const nuevoStock = stockActual + cantidadIngreso;
  const fecha = ahoraIso();
  const payload = {
    cantidad: nuevoStock,
    stock: nuevoStock,
    fechaActualizacionStock: fecha,
    fechaActualizacion: fecha,
    ultimaModificacion: fecha,
    ultimoIngresoStockRapido: {
      fecha,
      cantidad: cantidadIngreso,
      usuario: usuarioActual?.nombre || usuarioActual?.usuario || '',
      nota: els.nota.value.trim(),
      proveedor: proveedor || ''
    },
    ultimoControlStock: {
      fecha,
      cantidad: nuevoStock,
      ingreso: cantidadIngreso,
      usuario: usuarioActual?.nombre || usuarioActual?.usuario || '',
      nota: els.nota.value.trim(),
      proveedor: proveedor || '',
      origen: 'stock_app'
    }
  };
  if (codigoNuevo && !codigoNuevoYaEsDelProducto) {
    payload.codigo = codigoNuevo;
    payload.codigoInterno = codigoNuevo;
  }
  if (proveedoresCostos.length > 0) payload.proveedoresCostos = proveedoresCostos;

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = 'Actualizando...';
  try {
    await updateDoc(doc(db, 'productos', productoSeleccionado.id), payload);
    volverAlBuscadorStock(`Listo. Nuevo stock: ${nuevoStock} ${productoSeleccionado.unidad || 'unid.'}`);
  } catch (error) {
    console.error(error);
    renderStatus(`No se pudo actualizar: ${error.message || error}`, 'error');
  } finally {
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = 'Actualizar inventario';
  }
};

const iniciarSesion = (event) => {
  event.preventDefault();
  const usuario = normalizarTexto(els.username.value);
  const password = String(els.password.value || '').trim();
  const encontrado = usuarios.find((item) => {
    const userOk = normalizarTexto(item.usuario || item.username || item.nombre) === usuario;
    const passOk = String(item.password || item.contrasena || item.clave || '').trim() === password;
    return userOk && passOk;
  });
  if (!encontrado) {
    els.loginStatus.textContent = 'Usuario o contraseña incorrectos.';
    return;
  }
  usuarioActual = encontrado;
  sessionStorage.setItem('stockAppUser', JSON.stringify({ id: encontrado.id, usuario: encontrado.usuario || encontrado.nombre }));
  els.loginScreen.classList.add('hidden');
  els.appScreen.classList.remove('hidden');
  els.searchInput.focus();
};

const cerrarSesion = () => {
  sessionStorage.removeItem('stockAppUser');
  usuarioActual = null;
  els.appScreen.classList.add('hidden');
  els.loginScreen.classList.remove('hidden');
  els.password.value = '';
};

const restaurarSesion = () => {
  const raw = sessionStorage.getItem('stockAppUser');
  if (!raw) return;
  try {
    const sesion = JSON.parse(raw);
    usuarioActual = sesion;
    els.loginScreen.classList.add('hidden');
    els.appScreen.classList.remove('hidden');
  } catch {}
};

const cargarLectorCodigos = () => new Promise((resolve, reject) => {
  if (window.Html5Qrcode) {
    resolve();
    return;
  }
  const scriptId = 'html5-qrcode-lib';
  let script = document.getElementById(scriptId);
  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://unpkg.com/html5-qrcode';
    script.async = true;
    document.body.appendChild(script);
  }
  script.addEventListener('load', () => resolve(), { once: true });
  script.addEventListener('error', () => reject(new Error('No se pudo cargar el lector de codigos.')), { once: true });
});

const iniciarCamara = async () => {
  try {
    if (!window.isSecureContext) {
      renderStatus('La camara solo funciona con HTTPS. Abrí la app desde el link https publicado y volvé a instalar el acceso.', 'error');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      renderStatus('Este navegador no permite usar la camara. Podés cargar el codigo manualmente en el buscador.', 'error');
      return;
    }
    try {
      const permiso = await navigator.permissions?.query?.({ name: 'camera' });
      if (permiso?.state === 'denied') {
        renderStatus('La camara está bloqueada. En Android: mantené apretado el icono de la app > Info > Permisos > Cámara > Permitir.', 'error');
        return;
      }
    } catch {}
    await cargarLectorCodigos();
    await detenerCamara();
    els.cameraPanel.classList.remove('hidden');
    const formatos = window.Html5QrcodeSupportedFormats || {};
    const formatosSoportados = [
      formatos.QR_CODE, formatos.AZTEC, formatos.CODABAR, formatos.CODE_39,
      formatos.CODE_93, formatos.CODE_128, formatos.DATA_MATRIX, formatos.EAN_8,
      formatos.EAN_13, formatos.ITF, formatos.PDF_417, formatos.UPC_A, formatos.UPC_E
    ].filter((formato) => typeof formato === 'number');
    const config = {
      fps: 14,
      qrbox: { width: 300, height: 180 },
      aspectRatio: 1.777778,
      rememberLastUsedCamera: true,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      formatsToSupport: formatosSoportados.length ? formatosSoportados : undefined
    };
    const onScanSuccess = async (decodedText) => {
      const codigo = String(decodedText || '').trim();
      if (!codigo) return;
      els.searchInput.value = codigo;
      await detenerCamara();
      renderResults();
      renderStatus('Codigo detectado. Elegi el producto para actualizar.', 'ok');
    };
    scannerCodigo = new window.Html5Qrcode('reader');
    try {
      await scannerCodigo.start({ facingMode: { exact: 'environment' } }, config, onScanSuccess, () => {});
    } catch {
      try {
        await scannerCodigo.start({ facingMode: 'environment' }, config, onScanSuccess, () => {});
      } catch {
        const cameras = await window.Html5Qrcode.getCameras();
        const backCamera = cameras.find((cam) => /back|rear|environment|trasera|traseira/i.test(cam.label || '')) || cameras[0];
        if (!backCamera) throw new Error('No hay camaras disponibles.');
        await scannerCodigo.start(backCamera.id, config, onScanSuccess, () => {});
      }
    }
  } catch (error) {
    console.error(error);
    await detenerCamara();
    const nombreError = String(error?.name || '');
    if (/notallowed|permission|security/i.test(nombreError)) {
      renderStatus('No pude abrir la camara porque el permiso está bloqueado. Revisá permisos de Cámara para esta app o reinstalá desde Chrome/HTTPS.', 'error');
    } else if (/notfound|overconstrained/i.test(nombreError)) {
      renderStatus('No encontré cámara disponible. Escribí el código manualmente o probá abrir desde Chrome actualizado.', 'error');
    } else {
      renderStatus('No pude abrir la camara. Si el permiso está activo, cerrá y abrí la app otra vez; mientras tanto podés buscar manualmente.', 'error');
    }
  }
};

const detenerCamara = async () => {
  const scanner = scannerCodigo;
  scannerCodigo = null;
  if (scanner) {
    try { await scanner.stop(); } catch {}
    try {
      const clearResult = scanner.clear?.();
      if (clearResult && typeof clearResult.then === 'function') await clearResult;
    } catch {}
  }
  els.cameraPanel.classList.add('hidden');
};

const renderInstallButton = () => {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const installed = localStorage.getItem('stockAppInstalled') === '1' || window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS || installed) {
    els.installBtn.classList.add('hidden');
    return;
  }
  els.installBtn.classList.toggle('hidden', !deferredPrompt);
};

const instalarApp = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice.catch(() => null);
  if (choice?.outcome === 'accepted') localStorage.setItem('stockAppInstalled', '1');
  deferredPrompt = null;
  renderInstallButton();
};

const iniciarDatos = async () => {
  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.warn('Auth anonima no disponible, intento continuar con sesion existente.', error);
  }
  onAuthStateChanged(auth, () => {
    onSnapshot(collection(db, 'usuarios'), (snapshot) => {
      usuarios = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      restaurarSesion();
    }, (error) => {
      console.error(error);
      els.loginStatus.textContent = 'No pude leer usuarios. Revisa Firebase.';
    });
    onSnapshot(collection(db, 'productos'), (snapshot) => {
      productos = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      els.syncStatus.textContent = `${productos.length} productos sincronizados`;
      renderProviders();
      renderResults();
    }, (error) => {
      console.error(error);
      els.syncStatus.textContent = 'Error leyendo inventario';
      renderStatus('No pude leer productos. Revisa reglas de Firebase.', 'error');
    });
    onSnapshot(collection(db, 'proveedores'), (snapshot) => {
      proveedores = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderProviders();
    }, () => {});
  });
};

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw-stock-app.js?v=seniorflow-react-20260711-stock-app-05').catch(console.warn);
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  renderInstallButton();
});
window.addEventListener('appinstalled', () => {
  localStorage.setItem('stockAppInstalled', '1');
  deferredPrompt = null;
  renderInstallButton();
});

els.loginForm.addEventListener('submit', iniciarSesion);
els.logoutBtn.addEventListener('click', cerrarSesion);
els.searchInput.addEventListener('input', () => {
  productoSeleccionado = null;
  els.selectedCard.classList.add('hidden');
  els.results.classList.remove('hidden');
  renderResults();
});
els.providerSelect.addEventListener('change', () => {
  if (productoSeleccionado) seleccionarProducto(productoSeleccionado);
  renderResults();
});
els.scanBtn.addEventListener('click', iniciarCamara);
els.stopScanBtn.addEventListener('click', detenerCamara);
els.stockForm.addEventListener('submit', actualizarProductoSeleccionado);
els.changeProductBtn.addEventListener('click', () => volverAlBuscadorStock(''));
els.installBtn.addEventListener('click', instalarApp);
renderInstallButton();
renderResults();
iniciarDatos();
