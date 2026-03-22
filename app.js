
import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const ADMIN_EMAILS = ["admin@mundoled.com", "mundoledstasylvina@gmail.com"];

const state = {
  currentUser: null,
  role: "consulta",
  ventas: [],
  gastos: [],
  stock: [],
  cuentas: [],
  movimientos: [],
  usuarios: []
};

const els = {
  loginScreen: document.getElementById("loginScreen"),
  appScreen: document.getElementById("appScreen"),
  loginForm: document.getElementById("loginForm"),
  loginError: document.getElementById("loginError"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  logoutBtn: document.getElementById("logoutBtn"),
  viewTitle: document.getElementById("viewTitle"),
  userEmailText: document.getElementById("userEmailText"),
  userRoleText: document.getElementById("userRoleText"),
  todayText: document.getElementById("todayText"),
  installBanner: document.getElementById("installBanner"),
  installBtnTop: document.getElementById("installBtnTop"),
  installBtnLogin: document.getElementById("installBtnLogin")
};

const fmtMoney = (value) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));

const todayISO = () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now - tzOffset).toISOString().slice(0, 10);
};

const todayText = () =>
  new Date().toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

function setDefaultDates() {
  ["ventaForm", "gastoForm", "movimientoForm"].forEach((id) => {
    const form = document.getElementById(id);
    if (form && form.fecha) form.fecha.value = todayISO();
  });
}

function initNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      const section = document.getElementById(`${view}View`);
      if (section) section.classList.add("active");
      const titles = {
        dashboard: "Dashboard",
        ventas: "Ventas",
        gastos: "Gastos",
        stock: "Stock",
        cuentas: "Cuentas corrientes",
        movimientos: "Caja",
        usuarios: "Usuarios"
      };
      els.viewTitle.textContent = titles[view] || "Panel";
    });
  });
}

function updateRoleUI() {
  const role = state.role;
  els.userRoleText.textContent = `Rol: ${role}`;
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", role !== "admin");
  });

  const hideViews = {
    consulta: ["ventas", "gastos", "stock", "cuentas", "movimientos", "usuarios"],
    ventas: ["stock", "usuarios"],
    stock: ["ventas", "gastos", "movimientos", "usuarios"]
  };

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const view = btn.dataset.view;
    const shouldHide = (hideViews[role] || []).includes(view);
    btn.classList.toggle("hidden", shouldHide);
  });

  const currentActive = document.querySelector(".nav-btn.active");
  if (currentActive?.classList.contains("hidden")) {
    const firstVisible = [...document.querySelectorAll(".nav-btn")].find((btn) => !btn.classList.contains("hidden"));
    firstVisible?.click();
  }
}

async function resolveUserRole(user) {
  const email = user.email?.toLowerCase() || "";
  if (ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
    state.role = "admin";
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      role: "admin",
      updatedAt: serverTimestamp()
    }, { merge: true });
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    state.role = snap.data().role || "consulta";
    return;
  }

  const usersByEmail = await getDocs(query(collection(db, "users")));
  let matched = null;
  usersByEmail.forEach((d) => {
    const data = d.data();
    if ((data.email || "").toLowerCase() === email) matched = data;
  });

  if (matched) {
    state.role = matched.role || "consulta";
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      role: state.role,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } else {
    state.role = "consulta";
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      role: "consulta",
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

function renderSimpleList(containerId, items, builder, emptyText) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }
  el.innerHTML = items.map(builder).join("");
}

function renderTable(containerId, columns, rows, emptyText, deleteCollection = null) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}${state.role === "admin" ? "<th>Acción</th>" : ""}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${columns.map((c) => `<td>${row[c.key] ?? ""}</td>`).join("")}
            ${state.role === "admin" && deleteCollection ? `<td><button class="delete-btn" data-collection="${deleteCollection}" data-id="${row.id}">Eliminar</button></td>` : ""}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  el.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este registro?")) return;
      try {
        await deleteDoc(doc(db, btn.dataset.collection, btn.dataset.id));
      } catch (error) {
        alert("No se pudo eliminar: " + error.message);
      }
    });
  });
}

function renderAll() {
  const hoy = todayISO();
  const month = hoy.slice(0, 7);

  const ventasHoy = state.ventas.filter((v) => v.fecha === hoy);
  const gastosHoy = state.gastos.filter((g) => g.fecha === hoy);
  const movimientosHoy = state.movimientos.filter((m) => m.fecha === hoy);

  const totalVentasHoy = ventasHoy.reduce((sum, v) => sum + Number(v.monto || 0), 0);
  const totalGastosHoy = gastosHoy.reduce((sum, g) => sum + Number(g.monto || 0), 0);

  const ingresosHoy = movimientosHoy.filter((m) => m.tipo === "ingreso").reduce((sum, m) => sum + Number(m.monto || 0), 0) + totalVentasHoy;
  const egresosHoy = movimientosHoy.filter((m) => m.tipo === "egreso").reduce((sum, m) => sum + Number(m.monto || 0), 0) + totalGastosHoy;
  const saldoHoy = ingresosHoy - egresosHoy;

  const totalVentasMes = state.ventas.filter((v) => (v.fecha || "").startsWith(month)).reduce((sum, v) => sum + Number(v.monto || 0), 0);
  const cuentasPorCobrar = state.cuentas.reduce((sum, c) => sum + Number(c.saldo || 0), 0);
  const stockBajo = state.stock.filter((p) => Number(p.stockActual || 0) <= Number(p.stockMinimo || 0));

  document.getElementById("statVentasDia").textContent = fmtMoney(totalVentasHoy);
  document.getElementById("statGastosDia").textContent = fmtMoney(totalGastosHoy);
  document.getElementById("statCaja").textContent = fmtMoney(saldoHoy);
  document.getElementById("statCuentas").textContent = fmtMoney(cuentasPorCobrar);
  document.getElementById("statStockBajo").textContent = stockBajo.length;
  document.getElementById("statVentasMes").textContent = fmtMoney(totalVentasMes);

  const porMetodo = { efectivo: 0, transferencia: 0, tarjeta: 0, otros: 0 };
  ventasHoy.forEach((v) => { porMetodo[v.metodo] = (porMetodo[v.metodo] || 0) + Number(v.monto || 0); });

  document.getElementById("sumEfectivo").textContent = fmtMoney(porMetodo.efectivo);
  document.getElementById("sumTransferencia").textContent = fmtMoney(porMetodo.transferencia);
  document.getElementById("sumTarjeta").textContent = fmtMoney(porMetodo.tarjeta);
  document.getElementById("sumOtros").textContent = fmtMoney(porMetodo.otros);

  document.getElementById("sumIngresosHoy").textContent = fmtMoney(ingresosHoy);
  document.getElementById("sumEgresosHoy").textContent = fmtMoney(egresosHoy);
  document.getElementById("sumSaldoHoy").textContent = fmtMoney(saldoHoy);
  document.getElementById("ultimaActualizacion").textContent = new Date().toLocaleTimeString("es-AR");

  renderSimpleList("ultimasVentas",
    state.ventas.slice(0, 6),
    (v) => `<div class="simple-item"><strong>${fmtMoney(v.monto)}</strong><span>${v.metodo} · ${v.fecha}</span><div class="muted">${v.detalle || "Sin detalle"}</div></div>`,
    "Todavía no hay ventas cargadas."
  );

  renderSimpleList("stockBajoLista",
    stockBajo.slice(0, 8),
    (p) => `<div class="simple-item"><strong>${p.nombre}</strong><span>Código ${p.codigo || "-"}</span><div class="muted">Actual: ${p.stockActual} · Mínimo: ${p.stockMinimo}</div></div>`,
    "No hay productos con stock bajo."
  );

  renderTable("ventasList",
    [
      { key: "fecha", label: "Fecha" },
      { key: "montoFmt", label: "Monto" },
      { key: "metodo", label: "Cobro" },
      { key: "detalle", label: "Detalle" }
    ],
    state.ventas.map((v) => ({ ...v, montoFmt: fmtMoney(v.monto) })),
    "No hay ventas cargadas.",
    "ventas"
  );

  renderTable("gastosList",
    [
      { key: "fecha", label: "Fecha" },
      { key: "montoFmt", label: "Monto" },
      { key: "categoria", label: "Categoría" },
      { key: "detalle", label: "Detalle" }
    ],
    state.gastos.map((g) => ({ ...g, montoFmt: fmtMoney(g.monto) })),
    "No hay gastos cargados.",
    "gastos"
  );

  renderTable("stockList",
    [
      { key: "codigo", label: "Código" },
      { key: "nombre", label: "Producto" },
      { key: "categoria", label: "Categoría" },
      { key: "stockActual", label: "Actual" },
      { key: "stockMinimo", label: "Mínimo" },
      { key: "costoFmt", label: "Costo" }
    ],
    state.stock.map((p) => ({ ...p, costoFmt: fmtMoney(p.costo || 0) })),
    "No hay productos cargados.",
    "stock"
  );

  renderTable("cuentasList",
    [
      { key: "cliente", label: "Cliente" },
      { key: "saldoFmt", label: "Saldo" },
      { key: "estadoBadge", label: "Estado" },
      { key: "detalle", label: "Observación" }
    ],
    state.cuentas.map((c) => ({
      ...c,
      saldoFmt: fmtMoney(c.saldo || 0),
      estadoBadge:
        c.estado === "vencido"
          ? `<span class="badge danger">Vencido</span>`
          : c.estado === "pendiente"
          ? `<span class="badge warn">Pendiente</span>`
          : `<span class="badge">Al día</span>`
    })),
    "No hay cuentas cargadas.",
    "cuentas_corrientes"
  );

  renderTable("movimientosList",
    [
      { key: "fecha", label: "Fecha" },
      { key: "tipoBadge", label: "Tipo" },
      { key: "montoFmt", label: "Monto" },
      { key: "detalle", label: "Detalle" }
    ],
    state.movimientos.map((m) => ({
      ...m,
      montoFmt: fmtMoney(m.monto || 0),
      tipoBadge: m.tipo === "ingreso" ? `<span class="badge">Ingreso</span>` : `<span class="badge warn">Egreso</span>`
    })),
    "No hay movimientos cargados.",
    "movimientos_caja"
  );

  renderTable("usuariosList",
    [
      { key: "email", label: "Email" },
      { key: "role", label: "Rol" }
    ],
    state.usuarios,
    "No hay usuarios con rol cargados.",
    "users"
  );
}

function bindForm(id, handler, msgId) {
  const form = document.getElementById(id);
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById(msgId);
    msg.textContent = "Guardando...";
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await handler(data);
      form.reset();
      if (form.fecha) form.fecha.value = todayISO();
      msg.textContent = "Guardado correctamente.";
    } catch (error) {
      msg.textContent = "Error: " + error.message;
    }
  });
}

function setupForms() {
  bindForm("ventaForm", async (data) => {
    await addDoc(collection(db, "ventas"), {
      ...data,
      monto: Number(data.monto || 0),
      userId: state.currentUser.uid,
      userEmail: state.currentUser.email,
      createdAt: serverTimestamp()
    });
  }, "ventaMsg");

  bindForm("gastoForm", async (data) => {
    await addDoc(collection(db, "gastos"), {
      ...data,
      monto: Number(data.monto || 0),
      userId: state.currentUser.uid,
      userEmail: state.currentUser.email,
      createdAt: serverTimestamp()
    });
  }, "gastoMsg");

  bindForm("stockForm", async (data) => {
    const id = data.codigo.trim();
    await setDoc(doc(db, "stock", id), {
      ...data,
      stockActual: Number(data.stockActual || 0),
      stockMinimo: Number(data.stockMinimo || 0),
      costo: Number(data.costo || 0),
      userId: state.currentUser.uid,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }, "stockMsg");

  bindForm("cuentaForm", async (data) => {
    await addDoc(collection(db, "cuentas_corrientes"), {
      ...data,
      saldo: Number(data.saldo || 0),
      userId: state.currentUser.uid,
      userEmail: state.currentUser.email,
      createdAt: serverTimestamp()
    });
  }, "cuentaMsg");

  bindForm("movimientoForm", async (data) => {
    await addDoc(collection(db, "movimientos_caja"), {
      ...data,
      monto: Number(data.monto || 0),
      userId: state.currentUser.uid,
      userEmail: state.currentUser.email,
      createdAt: serverTimestamp()
    });
  }, "movimientoMsg");

  bindForm("rolForm", async (data) => {
    const sanitizedId = data.email.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    await setDoc(doc(db, "users", sanitizedId), {
      email: data.email.trim().toLowerCase(),
      role: data.role,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }, "rolMsg");
}

function attachRealtime() {
  onSnapshot(query(collection(db, "ventas"), orderBy("createdAt", "desc")), (snap) => {
    state.ventas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  onSnapshot(query(collection(db, "gastos"), orderBy("createdAt", "desc")), (snap) => {
    state.gastos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  onSnapshot(query(collection(db, "stock"), orderBy("updatedAt", "desc")), (snap) => {
    state.stock = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  onSnapshot(query(collection(db, "cuentas_corrientes"), orderBy("createdAt", "desc")), (snap) => {
    state.cuentas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  onSnapshot(query(collection(db, "movimientos_caja"), orderBy("createdAt", "desc")), (snap) => {
    state.movimientos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  onSnapshot(query(collection(db, "users"), orderBy("updatedAt", "desc")), (snap) => {
    state.usuarios = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });
}

function initInstall() {
  let deferredPrompt = null;
  const show = () => {
    els.installBanner.classList.remove("hidden");
    els.installBtnLogin.classList.remove("hidden");
  };
  const hide = () => {
    els.installBanner.classList.add("hidden");
    els.installBtnLogin.classList.add("hidden");
  };

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    show();
  });

  window.addEventListener("appinstalled", hide);

  [els.installBtnTop, els.installBtnLogin].forEach((btn) => {
    btn?.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      hide();
    });
  });
}

async function handleLogin(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

function initAuth() {
  els.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.loginError.textContent = "";
    try {
      await handleLogin(els.emailInput.value.trim(), els.passwordInput.value);
    } catch (error) {
            const map = {
        "auth/invalid-credential": "Email o contraseña incorrectos.",
        "auth/invalid-email": "El email no tiene un formato válido.",
        "auth/network-request-failed": "No se pudo conectar a internet.",
        "auth/too-many-requests": "Demasiados intentos. Probá de nuevo en unos minutos.",
        "auth/operation-not-allowed": "El acceso por email/contraseña no está habilitado en Firebase.",
        "auth/user-disabled": "Este usuario fue deshabilitado.",
        "auth/unauthorized-domain": "Falta autorizar el dominio conexion354-source.github.io en Firebase Authentication."
      };
      els.loginError.textContent = map[error.code] || ("No se pudo iniciar sesión: " + error.message);
    }
  });

  els.logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      state.currentUser = user;
      await resolveUserRole(user);
      els.userEmailText.textContent = user.email || "Sin email";
      els.todayText.textContent = todayText();
      els.loginError.textContent = "";
      updateRoleUI();
      els.loginScreen.classList.add("hidden");
      els.appScreen.classList.remove("hidden");
      attachRealtime();
    } else {
      state.currentUser = null;
      els.loginScreen.classList.remove("hidden");
      els.appScreen.classList.add("hidden");
    }
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

setDefaultDates();
initNavigation();
setupForms();
initInstall();
initAuth();
