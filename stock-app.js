import { auth, db, storage } from './firebase-config.js?v=seniorflow-stock-mobile-20260807-07';
import { signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { collection as firestoreCollection, doc as firestoreDoc, onSnapshot, updateDoc } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';
import { ref as storageRef, uploadString, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js';

const collection = (database, ...path) => firestoreCollection(database, ...path);
const doc = (database, ...path) => firestoreDoc(database, ...path);

const $ = (id) => document.getElementById(id);
const els = {
  loginScreen: $('loginScreen'),
  appScreen: $('appScreen'),
  loginForm: $('loginForm'),
  loginBtn: $('loginBtn'),
  accessCode: $('accessCode'),
  loginStatus: $('loginStatus'),
  syncStatus: $('syncStatus'),
  installBtn: $('installBtn'),
  logoutBtn: $('logoutBtn'),
  searchInput: $('searchInput'),
  searchPanel: $('searchPanel'),
  scanBtn: $('scanBtn'),
  scanBarcodeBtn: $('scanBarcodeBtn'),
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
  photoInput: $('photoInput'),
  photoPreview: $('photoPreview'),
  stockForm: $('stockForm'),
  qtyInput: $('qtyInput'),
  codigoBarrasNuevo: $('codigoBarrasNuevo'),
  codigoProveedorLectura: $('codigoProveedorLectura'),
  saveBtn: $('saveBtn'),
  changeProductBtn: $('changeProductBtn'),
  status: $('status')
};

let productos = [];
let configuracion = null;
let configuracionLista = false;
let usuarioActual = { nombre: 'Control de stock' };
let productoSeleccionado = null;
let deferredPrompt = null;
let scannerCodigo = null;
let fotoNuevaDataUrl = '';
let destinoEscaner = 'buscar';

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

const obtenerImagen = (producto) => {
  if (producto?.imagen) return producto.imagen;
  if (Array.isArray(producto?.imagenes) && producto.imagenes[0]) return producto.imagenes[0];
  if (producto?.imagenPrincipal) return producto.imagenPrincipal;
  return '';
};

const obtenerCodigoProveedorLectura = (producto) => {
  if (producto?.codigoProveedor) return String(producto.codigoProveedor);
  const costos = Array.isArray(producto?.proveedoresCostos)
    ? producto.proveedoresCostos
    : (Array.isArray(producto?.costosProveedores) ? producto.costosProveedores : []);
  const encontrado = costos.find((item) => item?.codigoProveedor);
  return encontrado?.codigoProveedor ? String(encontrado.codigoProveedor) : '';
};

const camposProducto = (producto) => {
  return [
    producto?.descripcion,
    producto?.detalle,
    producto?.codigo,
    producto?.codigoInterno,
    producto?.codigoBarras,
    producto?.marca,
    producto?.categoria
  ];
};

const tokensBusqueda = (query) => normalizarTexto(query).split(/\s+/).filter(Boolean);

const productoCoincide = (producto, query) => {
  const texto = normalizarTexto(query);
  const codigo = normalizarCodigo(query);
  if (!texto && !codigo) return false;
  const tokens = tokensBusqueda(query);
  const campos = camposProducto(producto);
  const textoCompuesto = normalizarTexto(campos.join(' '));

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

const renderResults = () => {
  const query = els.searchInput.value.trim();
  els.results.innerHTML = '';
  els.results.classList.remove('hidden');
  if (query.length < 2) {
    els.results.innerHTML = '<div class="glass rounded-3xl border border-white/70 p-4 text-sm font-bold text-slate-500">Escribi al menos 2 letras o numeros para buscar. No se muestra la lista completa para que sea rapido en el telefono.</div>';
    return;
  }
  const matches = productos
    .filter((producto) => productoCoincide(producto, query))
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
  els.productImage.src = obtenerImagen(producto) || '';
  els.productImage.style.display = obtenerImagen(producto) ? 'block' : 'none';
  els.productTitle.textContent = producto.descripcion || 'Producto sin nombre';
  els.productMeta.textContent = `Codigo ${producto.codigo || '-'} · ${producto.categoria || 'Sin categoria'}`;
  els.productStock.textContent = `Stock actual: ${stock} ${producto.unidad || 'unid.'}`;
  els.codigoBarrasNuevo.value = producto.codigoBarras || '';
  els.codigoProveedorLectura.value = obtenerCodigoProveedorLectura(producto);
  els.qtyInput.value = String(stock);
  fotoNuevaDataUrl = '';
  els.photoInput.value = '';
  els.photoPreview.src = obtenerImagen(producto) || '';
  els.photoPreview.classList.toggle('hidden', !obtenerImagen(producto));
  els.results.classList.add('hidden');
  els.searchPanel.classList.add('hidden');
  els.selectedCard.classList.remove('hidden');
  renderStatus('');
};

const volverAlBuscadorStock = (mensaje = '') => {
  productoSeleccionado = null;
  els.selectedCard.classList.add('hidden');
  els.searchPanel.classList.remove('hidden');
  els.results.classList.remove('hidden');
  els.searchInput.value = '';
  els.qtyInput.value = '0';
  els.codigoBarrasNuevo.value = '';
  els.codigoProveedorLectura.value = '';
  fotoNuevaDataUrl = '';
  els.photoInput.value = '';
  els.photoPreview.src = '';
  els.photoPreview.classList.add('hidden');
  renderResults();
  renderStatus(mensaje, mensaje ? 'ok' : 'slate');
  els.searchInput.focus();
};

const actualizarProductoSeleccionado = async (event) => {
  event.preventDefault();
  if (!productoSeleccionado?.id) return;
  const nuevoStockIngresado = numero(els.qtyInput.value);
  if (nuevoStockIngresado < 0) {
    renderStatus('El stock final no puede ser negativo.', 'error');
    return;
  }

  const codigoBarrasNuevo = els.codigoBarrasNuevo.value.trim();
  const codigoProveedorNuevo = els.codigoProveedorLectura.value.trim();
  const codigoBarrasNuevoNorm = normalizarCodigo(codigoBarrasNuevo);
  const codigosActualesProducto = [
    productoSeleccionado.codigo,
    productoSeleccionado.codigoInterno,
    productoSeleccionado.codigoBarras
  ].map((codigo) => normalizarCodigo(codigo)).filter(Boolean);
  const codigoNuevoYaEsDelProducto = codigoBarrasNuevoNorm && codigosActualesProducto.includes(codigoBarrasNuevoNorm);
  if (codigoBarrasNuevoNorm && !codigoNuevoYaEsDelProducto) {
    const duplicado = productos.find((producto) => producto.id !== productoSeleccionado.id && [
      producto.codigo,
      producto.codigoInterno,
      producto.codigoBarras
    ].some((codigo) => normalizarCodigo(codigo) === codigoBarrasNuevoNorm));
    if (duplicado) {
      renderStatus(`Ese código de barras ya está usado por: ${duplicado.descripcion || duplicado.codigo}`, 'error');
      return;
    }
  }

  const stockActual = numero(productoSeleccionado.cantidad ?? productoSeleccionado.stock ?? 0);
  const nuevoStock = nuevoStockIngresado;
  const variacionStock = nuevoStock - stockActual;
  const fecha = ahoraIso();
  const payload = {
    cantidad: nuevoStock,
    stock: nuevoStock,
    fechaActualizacionStock: fecha,
    fechaActualizacion: fecha,
    ultimaModificacion: fecha,
    ultimoIngresoStockRapido: {
      fecha,
      cantidad: variacionStock,
      usuario: usuarioActual?.nombre || usuarioActual?.usuario || '',
      nota: '',
      proveedor: ''
    },
    ultimoControlStock: {
      fecha,
      cantidad: nuevoStock,
      ingreso: variacionStock,
      usuario: usuarioActual?.nombre || usuarioActual?.usuario || '',
      nota: '',
      proveedor: '',
      origen: 'stock_app'
    }
  };
  if (codigoBarrasNuevo && !codigoNuevoYaEsDelProducto) payload.codigoBarras = codigoBarrasNuevo;
  if (codigoProveedorNuevo !== obtenerCodigoProveedorLectura(productoSeleccionado)) {
    payload.codigoProveedor = codigoProveedorNuevo;
  }

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = 'Actualizando...';
  try {
    if (fotoNuevaDataUrl) {
      els.saveBtn.textContent = 'Subiendo foto...';
      const rutaFoto = `productos/${productoSeleccionado.id}/stock-app-${Date.now()}.jpg`;
      const referenciaFoto = storageRef(storage, rutaFoto);
      await uploadString(referenciaFoto, fotoNuevaDataUrl, 'data_url');
      const fotoUrl = await getDownloadURL(referenciaFoto);
      payload.imagen = fotoUrl;
      payload.imagenPrincipal = fotoUrl;
      payload.imagenes = [fotoUrl, ...(Array.isArray(productoSeleccionado.imagenes) ? productoSeleccionado.imagenes : []).filter((imagen) => imagen && imagen !== fotoUrl)].slice(0, 8);
      els.saveBtn.textContent = 'Actualizando...';
    }
    await updateDoc(doc(db, 'productos', productoSeleccionado.id), payload);
    volverAlBuscadorStock(`Listo. Nuevo stock: ${nuevoStock} ${productoSeleccionado.unidad || 'unid.'}`);
  } catch (error) {
    console.error(error);
    renderStatus(`No se pudo actualizar: ${error.message || error}`, 'error');
  } finally {
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = 'Guardar cambios';
  }
};

const iniciarSesion = (event) => {
  event.preventDefault();
  if (!configuracionLista) {
    els.loginStatus.textContent = 'Esperá un momento: todavía estamos sincronizando el acceso.';
    return;
  }
  const codigo = String(els.accessCode.value || '').trim();
  if (configuracion?.stockAppActiva === false) {
    els.loginStatus.textContent = 'La app móvil de stock está desactivada desde Ajustes.';
    return;
  }
  if (!configuracion?.codigoAccesoStock) {
    els.loginStatus.textContent = 'Todavía no se definió el código de acceso. Configuralo en Ajustes > Inventario.';
    return;
  }
  if (codigo !== String(configuracion.codigoAccesoStock)) {
    els.loginStatus.textContent = 'El código de acceso no es correcto.';
    return;
  }
  sessionStorage.setItem('stockAppAccessCode', codigo);
  els.loginScreen.classList.add('hidden');
  els.appScreen.classList.remove('hidden');
  els.searchInput.focus();
};

const cerrarSesion = () => {
  sessionStorage.removeItem('stockAppAccessCode');
  els.appScreen.classList.add('hidden');
  els.loginScreen.classList.remove('hidden');
  els.accessCode.value = '';
};

const restaurarSesion = () => {
  const codigo = sessionStorage.getItem('stockAppAccessCode');
  if (codigo && configuracion?.stockAppActiva !== false && codigo === String(configuracion?.codigoAccesoStock || '')) {
    els.loginScreen.classList.add('hidden');
    els.appScreen.classList.remove('hidden');
  }
};

const leerFotoNueva = (archivo) => {
  if (!archivo) return;
  if (!archivo.type.startsWith('image/')) { renderStatus('Elegí una imagen válida.', 'error'); return; }
  if (archivo.size > 8 * 1024 * 1024) { renderStatus('La foto es demasiado grande. Elegí una de hasta 8 MB.', 'error'); return; }
  const lector = new FileReader();
  lector.onload = () => {
    fotoNuevaDataUrl = String(lector.result || '');
    els.photoPreview.src = fotoNuevaDataUrl;
    els.photoPreview.classList.remove('hidden');
    renderStatus('Foto lista para guardar junto con el cambio.', 'ok');
  };
  lector.readAsDataURL(archivo);
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
    // Android puede rechazar una configuración de resolución concreta aunque
    // la cámara exista. Pedimos permiso con alternativas simples y usamos el
    // identificador real de la cámara que el propio teléfono abrió.
    let pruebaCamara;
    let errorPrueba;
    const intentosPermiso = [
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      { video: true, audio: false }
    ];
    for (const restricciones of intentosPermiso) {
      try {
        pruebaCamara = await navigator.mediaDevices.getUserMedia(restricciones);
        break;
      } catch (error) {
        errorPrueba = error;
      }
    }
    if (!pruebaCamara) throw errorPrueba || new Error('No se pudo abrir la cámara.');
    const idCamaraActiva = pruebaCamara.getVideoTracks?.()[0]?.getSettings?.().deviceId || '';
    pruebaCamara.getTracks().forEach((track) => track.stop());
    // Algunos equipos Android tardan un instante en liberar la cámara.
    await new Promise((resolve) => window.setTimeout(resolve, 180));
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
      rememberLastUsedCamera: false,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      formatsToSupport: formatosSoportados.length ? formatosSoportados : undefined
    };
    const onScanSuccess = async (decodedText) => {
      const codigo = String(decodedText || '').trim();
      if (!codigo) return;
      await detenerCamara();
      if (destinoEscaner === 'codigo_barras' && productoSeleccionado) {
        els.codigoBarrasNuevo.value = codigo;
        renderStatus('Código de barras leído. Guardá para aplicarlo al producto.', 'ok');
      } else {
        els.searchInput.value = codigo;
        renderResults();
        renderStatus('Código detectado. Elegí el producto para actualizar.', 'ok');
      }
    };
    scannerCodigo = new window.Html5Qrcode('reader');
    // No dependemos de getCameras(): en algunos Android devuelve una lista
    // vacía aun después de conceder el permiso. Probamos la cámara que acabamos
    // de abrir y, si hace falta, las alternativas estándar.
    const fuentes = [
      ...(idCamaraActiva ? [idCamaraActiva] : []),
      { facingMode: { ideal: 'environment' } },
      { facingMode: 'user' }
    ];
    let ultimoError;
    let iniciada = false;
    for (const fuente of fuentes) {
      try {
        await scannerCodigo.start(fuente, config, onScanSuccess, () => {});
        iniciada = true;
        break;
      } catch (error) {
        ultimoError = error;
      }
    }
    if (!iniciada) throw ultimoError || new Error('No se pudo iniciar el lector.');
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
    onSnapshot(doc(db, 'sistema', 'configuracion'), (snapshot) => {
      configuracion = snapshot.exists() ? snapshot.data() : {};
      configuracionLista = true;
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = 'Entrar';
      els.loginStatus.textContent = '';
      restaurarSesion();
    }, (error) => {
      console.error(error);
      configuracionLista = false;
      els.loginBtn.disabled = true;
      els.loginBtn.textContent = 'Sin conexión';
      els.loginStatus.textContent = 'No pude leer la configuración de acceso. Revisá Firebase.';
    });
    onSnapshot(collection(db, 'productos'), (snapshot) => {
      productos = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      els.syncStatus.textContent = `${productos.length} productos sincronizados`;
      renderResults();
    }, (error) => {
      console.error(error);
      els.syncStatus.textContent = 'Error leyendo inventario';
      renderStatus('No pude leer productos. Revisa reglas de Firebase.', 'error');
    });
  });
};

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw-stock-app.js?v=seniorflow-stock-mobile-20260807-07').catch(console.warn);
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
  els.searchPanel.classList.remove('hidden');
  els.results.classList.remove('hidden');
  renderResults();
});
els.scanBtn.addEventListener('click', () => { destinoEscaner = 'buscar'; iniciarCamara(); });
els.scanBarcodeBtn.addEventListener('click', () => { destinoEscaner = 'codigo_barras'; iniciarCamara(); });
els.stopScanBtn.addEventListener('click', detenerCamara);
els.stockForm.addEventListener('submit', actualizarProductoSeleccionado);
els.changeProductBtn.addEventListener('click', () => volverAlBuscadorStock(''));
els.photoInput.addEventListener('change', (event) => leerFotoNueva(event.target.files?.[0]));
els.installBtn.addEventListener('click', instalarApp);
renderInstallButton();
renderResults();
iniciarDatos();
