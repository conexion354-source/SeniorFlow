
import { auth, db } from "./firebase-config.js";
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const state = {
  authUser: null,
  sessionUser: null,
  loginMode: "administrador",
  users: [],
  sales: [],
  expenses: [],
  products: [],
  categories: [],
  customers: [],
  accountMovements: [],
  messages: [],
  selectedCustomerId: ""
};

const els = {
  loginScreen: document.getElementById("loginScreen"),
  appScreen: document.getElementById("appScreen"),
  loginForm: document.getElementById("loginForm"),
  loginError: document.getElementById("loginError"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  tabAdmin: document.getElementById("tabAdmin"),
  tabVendor: document.getElementById("tabVendor"),
  loginTitle: document.getElementById("loginTitle"),
  loginSubtitle: document.getElementById("loginSubtitle"),
  logoutBtn: document.getElementById("logoutBtn"),
  sessionUserText: document.getElementById("sessionUserText"),
  userRoleText: document.getElementById("userRoleText"),
  todayText: document.getElementById("todayText"),
  viewTitle: document.getElementById("viewTitle"),
  viewSubtitle: document.getElementById("viewSubtitle"),
  saleOperationType: document.getElementById("saleOperationType"),
  saleCashFields: document.getElementById("saleCashFields"),
  saleAccountFields: document.getElementById("saleAccountFields"),
  paymentMethod: document.getElementById("paymentMethod"),
  checkFields: document.getElementById("checkFields"),
  expenseCategory: document.getElementById("expenseCategory"),
  freightLabel: document.getElementById("freightLabel"),
  customerSearchInput: document.getElementById("customerSearchInput"),
  paymentCustomerId: document.getElementById("paymentCustomerId"),
  captureAccountBtn: document.getElementById("captureAccountBtn"),
  productCategorySelect: document.getElementById("productCategorySelect"),
  installBtn: document.getElementById("installBtn")
};

let unsubscribers = [];
let deferredPrompt = null;

const currency = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const todayISO = () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now - tzOffset).toISOString().slice(0, 10);
};

const todayLongText = () =>
  new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

function sanitizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function sha256(text) {
  const data = new TextEncoder().encode(String(text || ""));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function setMode(mode) {
  state.loginMode = mode;
  els.tabAdmin.classList.toggle("active", mode === "administrador");
  els.tabVendor.classList.toggle("active", mode === "vendedor");

  if (mode === "administrador") {
    els.loginTitle.textContent = "Ingreso administración";
    els.loginSubtitle.textContent = "Usá usuario y contraseña. Si todavía no existe un administrador, el primer ingreso lo crea.";
  } else {
    els.loginTitle.textContent = "Ingreso vendedor";
    els.loginSubtitle.textContent = "El vendedor entra con el usuario creado por administración.";
  }
}

function setDefaultDates() {
  ["saleForm", "expenseForm", "paymentForm"].forEach((id) => {
    const form = document.getElementById(id);
    if (form?.date) form.date.value = todayISO();
  });
}

function clearRealtime() {
  unsubscribers.forEach((fn) => {
    try { fn(); } catch (_) {}
  });
  unsubscribers = [];
}

function showApp() {
  els.loginScreen.classList.add("hidden");
  els.appScreen.classList.remove("hidden");
}

function showLogin() {
  els.loginScreen.classList.remove("hidden");
  els.appScreen.classList.add("hidden");
}

function roleLabel(role) {
  return role === "administrador" ? "Administrador" : "Vendedor";
}

function isAdmin() {
  return state.sessionUser?.role === "administrador";
}

function getCustomerFullName(customer) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || "Cliente sin nombre";
}

function accountMovementsForCustomer(customerId) {
  return state.accountMovements
    .filter((m) => m.customerId === customerId)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

function accountBalance(customerId) {
  return accountMovementsForCustomer(customerId).reduce((sum, item) => {
    const amount = Number(item.amount || 0);
    return item.type === "cobro" ? sum - amount : sum + amount;
  }, 0);
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
        <tr>
          ${columns.map((col) => `<th>${col.label}</th>`).join("")}
          ${isAdmin() && deleteCollection ? "<th>Acción</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${columns.map((col) => `<td>${row[col.key] ?? ""}</td>`).join("")}
            ${isAdmin() && deleteCollection ? `<td><button class="btn btn-secondary delete-btn" data-collection="${deleteCollection}" data-id="${row.id}" type="button">Eliminar</button></td>` : ""}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  el.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este registro?")) return;
      await deleteDoc(doc(db, btn.dataset.collection, btn.dataset.id));
    });
  });
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

function fillCategoriesSelect() {
  const select = els.productCategorySelect;
  if (!select) return;

  const categories = state.categories.length
    ? state.categories.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    : [{ name: "General" }];

  select.innerHTML = categories.map((cat) => `<option value="${cat.name}">${cat.name}</option>`).join("");
}

function applyRoleUI() {
  document.getElementById("userRoleText").textContent = `Rol: ${roleLabel(state.sessionUser.role)}`;
  document.getElementById("sessionUserText").textContent = state.sessionUser.name || state.sessionUser.username;

  document.querySelectorAll(".admin-only-nav").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin());
  });
  document.querySelectorAll(".admin-only-block").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin());
  });

  const hideByRole = {
    vendedor: ["inicio", "usuarios"]
  };

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const hide = (hideByRole[state.sessionUser.role] || []).includes(btn.dataset.view);
    btn.classList.toggle("hidden", hide);
  });

  const activeBtn = document.querySelector(".nav-btn.active");
  if (!activeBtn || activeBtn.classList.contains("hidden")) {
    const firstVisible = [...document.querySelectorAll(".nav-btn")].find((btn) => !btn.classList.contains("hidden"));
    firstVisible?.click();
  }
}

function syncSaleFormVisibility() {
  const accountMode = els.saleOperationType.value === "cuenta_corriente";
  els.saleCashFields.classList.toggle("hidden", accountMode);
  els.saleAccountFields.classList.toggle("hidden", !accountMode);
}

function syncCheckFields() {
  const isCheck = els.paymentMethod.value === "cheque";
  els.checkFields.classList.toggle("hidden", !isCheck);
}

function syncExpenseVisibility() {
  els.freightLabel.classList.toggle("hidden", els.expenseCategory.value !== "Fletes");
}

function renderAccountDetail(customerId) {
  const card = document.getElementById("accountDetailCard");
  const customer = state.customers.find((item) => item.id === customerId);

  if (!customer) {
    card.innerHTML = `<div class="empty">Seleccioná un cliente para ver los movimientos.</div>`;
    els.paymentCustomerId.value = "";
    return;
  }

  const movements = accountMovementsForCustomer(customerId);
  const balance = accountBalance(customerId);
  els.paymentCustomerId.value = customerId;

  card.innerHTML = `
    <div class="account-header">
      <div>
        <strong>${getCustomerFullName(customer)}</strong>
        <div class="muted">Celular: ${customer.phone || "-"}</div>
      </div>
      <div class="account-balance">${currency(balance)}</div>
    </div>

    <div class="simple-list">
      ${movements.length ? movements.map((item) => `
        <div class="simple-item">
          <strong>${item.type === "cobro" ? "Cobro" : "Cargo"} · ${currency(item.amount)}</strong>
          <span>${item.date || "-"}</span>
          <div class="muted">${item.details || ""}</div>
        </div>
      `).join("") : `<div class="empty">No hay movimientos para este cliente.</div>`}
    </div>
  `;
}

function renderEverything() {
  fillCategoriesSelect();

  const today = todayISO();
  const allSalesTotal = state.sales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const salesDay = state.sales.filter((sale) => sale.date === today).reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const expensesDay = state.expenses.filter((exp) => exp.date === today).reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const expensesTotal = state.expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const cash = allSalesTotal - expensesTotal;

  const overdueCustomers = state.customers
    .map((customer) => {
      const movements = accountMovementsForCustomer(customer.id);
      const balance = accountBalance(customer.id);
      const lastCharge = movements.find((item) => item.type === "cargo");
      let overdue = false;

      if (lastCharge?.date) {
        const start = new Date(`${lastCharge.date}T00:00:00`);
        const now = new Date(`${today}T00:00:00`);
        const days = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        overdue = balance > 0 && days > 30;
      }

      return { ...customer, balance, overdue };
    })
    .filter((customer) => customer.overdue);

  document.getElementById("statCash").textContent = currency(cash);
  document.getElementById("statSalesDay").textContent = currency(salesDay);
  document.getElementById("statExpensesDay").textContent = currency(expensesDay);
  document.getElementById("statSalesTotal").textContent = currency(allSalesTotal);
  document.getElementById("statOverdueCount").textContent = overdueCustomers.length;
  els.todayText.textContent = todayLongText();

  renderSimpleList(
    "messagesList",
    state.messages.slice(0, 10),
    (msg) => `
      <div class="simple-item">
        <strong>${msg.text}</strong>
        <span>${msg.authorName || msg.authorUsername || "-"}</span>
      </div>
    `,
    "No hay mensajes rápidos."
  );

  renderSimpleList(
    "overdueList",
    overdueCustomers.slice(0, 20),
    (customer) => `
      <div class="simple-item">
        <strong>${getCustomerFullName(customer)}</strong>
        <span>${currency(customer.balance)}</span>
        <div class="muted">${customer.phone || ""}</div>
      </div>
    `,
    "No hay clientes morosos."
  );

  renderTable(
    "salesTableWrap",
    [
      { key: "date", label: "Fecha" },
      { key: "documentType", label: "Comprobante" },
      { key: "documentNumber", label: "Número" },
      { key: "operationBadge", label: "Tipo" },
      { key: "displayAmount", label: "Monto" }
    ],
    state.sales.map((sale) => ({
      ...sale,
      displayAmount: currency(sale.amount),
      operationBadge: sale.operationType === "cuenta_corriente" ? `<span class="tag">Cuenta corriente</span>` : `<span class="tag">Contado</span>`
    })),
    "No hay ventas registradas.",
    "sales"
  );

  renderTable(
    "expensesTableWrap",
    [
      { key: "date", label: "Fecha" },
      { key: "category", label: "Categoría" },
      { key: "displayAmount", label: "Monto" },
      { key: "extraInfo", label: "Detalle" }
    ],
    state.expenses.map((exp) => ({
      ...exp,
      displayAmount: currency(exp.amount),
      extraInfo: exp.category === "Fletes" ? (exp.freightData || exp.details || "-") : (exp.details || "-")
    })),
    "No hay gastos registrados.",
    "expenses"
  );

  const lowStock = state.products
    .slice()
    .sort((a, b) => (Number(a.currentStock || 0) - Number(a.minStock || 0)) - (Number(b.currentStock || 0) - Number(b.minStock || 0)))
    .filter((item) => Number(item.currentStock || 0) <= Number(item.minStock || 0));

  renderSimpleList(
    "stockRankingList",
    lowStock,
    (item) => `
      <div class="simple-item">
        <strong>${item.name}</strong>
        <span>${item.category || "General"}</span>
        <div class="muted">Actual: ${item.currentStock} · Mínimo: ${item.minStock}</div>
      </div>
    `,
    "No hay productos con stock bajo."
  );

  renderTable(
    "productsTableWrap",
    [
      { key: "code", label: "Código" },
      { key: "name", label: "Producto" },
      { key: "category", label: "Categoría" },
      { key: "currentStock", label: "Actual" },
      { key: "minStock", label: "Mínimo" },
      { key: "displayCost", label: "Costo" }
    ],
    state.products.map((item) => ({
      ...item,
      displayCost: currency(item.cost)
    })),
    "No hay productos cargados.",
    "products"
  );

  const filter = (els.customerSearchInput.value || "").trim().toLowerCase();
  const filteredCustomers = state.customers.filter((customer) => {
    const text = `${getCustomerFullName(customer)} ${customer.phone || ""}`.toLowerCase();
    return !filter || text.includes(filter);
  });

  renderSimpleList(
    "customersList",
    filteredCustomers,
    (customer) => `
      <button class="simple-item customer-btn" data-id="${customer.id}" type="button">
        <strong>${getCustomerFullName(customer)}</strong>
        <span>${currency(accountBalance(customer.id))}</span>
        <div class="muted">${customer.phone || ""}</div>
      </button>
    `,
    "No hay clientes con cuenta corriente."
  );

  document.querySelectorAll(".customer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedCustomerId = btn.dataset.id;
      renderAccountDetail(btn.dataset.id);
    });
  });

  renderAccountDetail(state.selectedCustomerId);

  renderTable(
    "usersTableWrap",
    [
      { key: "name", label: "Nombre" },
      { key: "username", label: "Usuario" },
      { key: "roleLabel", label: "Rol" }
    ],
    state.users.map((user) => ({
      ...user,
      roleLabel: roleLabel(user.role)
    })),
    "No hay usuarios cargados.",
    "users"
  );
}

async function ensureAnonymousSession() {
  if (state.authUser) return;
  await signInAnonymously(auth);
}

async function countAdminUsers() {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "administrador"), limit(1)));
  return snap.size;
}

async function findUserByCredentials(username, password, role) {
  const passwordHash = await sha256(password);
  const snap = await getDocs(
    query(
      collection(db, "users"),
      where("username", "==", username.trim().toLowerCase()),
      where("passwordHash", "==", passwordHash),
      where("role", "==", role)
    )
  );
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

async function createFirstAdmin(username, password) {
  const cleanUsername = username.trim().toLowerCase();
  const userId = sanitizeId(cleanUsername);
  const passwordHash = await sha256(password);

  const payload = {
    name: "Administrador",
    username: cleanUsername,
    passwordHash,
    role: "administrador",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, "users", userId), payload, { merge: true });
  return { id: userId, ...payload };
}

async function handleLogin(username, password) {
  await ensureAnonymousSession();

  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername || !password) {
    throw new Error("Completá usuario y contraseña.");
  }

  if (state.loginMode === "administrador") {
    const adminCount = await countAdminUsers();
    if (adminCount === 0) {
      return await createFirstAdmin(cleanUsername, password);
    }
    const user = await findUserByCredentials(cleanUsername, password, "administrador");
    if (!user) throw new Error("Usuario o contraseña de administración incorrectos.");
    return user;
  }

  const vendor = await findUserByCredentials(cleanUsername, password, "vendedor");
  if (!vendor) throw new Error("Usuario o contraseña de vendedor incorrectos.");
  return vendor;
}

async function saveCustomerForAccount(data) {
  const key = sanitizeId(`${data.customerFirstName}_${data.customerLastName}_${data.customerPhone}`);
  const payload = {
    firstName: data.customerFirstName || "",
    lastName: data.customerLastName || "",
    phone: data.customerPhone || "",
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, "customers", key), payload, { merge: true });
  return key;
}

function bindForm(id, handler, msgId) {
  const form = document.getElementById(id);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const msg = document.getElementById(msgId);
    if (msg) msg.textContent = "Guardando...";

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      await handler(data, formData);
      form.reset();
      if (form.date) form.date.value = todayISO();
      syncSaleFormVisibility();
      syncCheckFields();
      syncExpenseVisibility();
      if (msg) msg.textContent = "Guardado correctamente.";
    } catch (error) {
      console.error(error);
      if (msg) msg.textContent = error.message || "No se pudo guardar.";
    }
  });
}

function attachRealtime() {
  clearRealtime();

  unsubscribers.push(
    onSnapshot(query(collection(db, "users"), orderBy("updatedAt", "desc")), (snap) => {
      state.users = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );

  unsubscribers.push(
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "desc")), (snap) => {
      state.messages = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );

  unsubscribers.push(
    onSnapshot(query(collection(db, "sales"), orderBy("createdAt", "desc")), (snap) => {
      state.sales = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );

  unsubscribers.push(
    onSnapshot(query(collection(db, "expenses"), orderBy("createdAt", "desc")), (snap) => {
      state.expenses = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );

  unsubscribers.push(
    onSnapshot(query(collection(db, "categories"), orderBy("name", "asc")), (snap) => {
      state.categories = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );

  unsubscribers.push(
    onSnapshot(query(collection(db, "products"), orderBy("updatedAt", "desc")), (snap) => {
      state.products = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );

  unsubscribers.push(
    onSnapshot(query(collection(db, "customers"), orderBy("updatedAt", "desc")), (snap) => {
      state.customers = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );

  unsubscribers.push(
    onSnapshot(query(collection(db, "account_movements"), orderBy("createdAt", "desc")), (snap) => {
      state.accountMovements = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );
}

function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      document.querySelectorAll(".nav-btn").forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach((viewNode) => viewNode.classList.remove("active"));
      document.getElementById(`${view}View`)?.classList.add("active");

      const titles = {
        inicio: ["Inicio", "Resumen general del negocio"],
        ventas: ["Ventas", "Carga rápida de comprobantes"],
        gastos: ["Gastos", "Registro de egresos del negocio"],
        stock: ["Stock", "Productos, categorías y alertas"],
        cuentas: ["Cuentas corrientes", "Clientes, cobros y saldos"],
        usuarios: ["Usuarios", "Acceso de administración y vendedores"]
      };

      els.viewTitle.textContent = titles[view]?.[0] || "Panel";
      els.viewSubtitle.textContent = titles[view]?.[1] || "";
    });
  });
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    els.installBtn.classList.remove("hidden");
  });

  window.addEventListener("appinstalled", () => {
    els.installBtn.classList.add("hidden");
    deferredPrompt = null;
  });

  els.installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.classList.add("hidden");
  });
}

function setupUiEvents() {
  els.tabAdmin.addEventListener("click", () => setMode("administrador"));
  els.tabVendor.addEventListener("click", () => setMode("vendedor"));

  els.saleOperationType.addEventListener("change", syncSaleFormVisibility);
  els.paymentMethod.addEventListener("change", syncCheckFields);
  els.expenseCategory.addEventListener("change", syncExpenseVisibility);
  els.customerSearchInput.addEventListener("input", renderEverything);

  els.captureAccountBtn.addEventListener("click", async () => {
    const card = document.getElementById("accountDetailCard");
    if (!card || card.querySelector(".empty")) {
      alert("Seleccioná una cuenta primero.");
      return;
    }

    const canvas = await window.html2canvas(card, {
      backgroundColor: "#ffffff",
      scale: 2
    });

    const link = document.createElement("a");
    link.download = "cuenta-corriente.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  els.logoutBtn.addEventListener("click", async () => {
    state.sessionUser = null;
    state.selectedCustomerId = "";
    clearRealtime();
    await signOut(auth);
  });

  syncSaleFormVisibility();
  syncCheckFields();
  syncExpenseVisibility();
}

function setupForms() {
  bindForm("quickMessageForm", async (data) => {
    if (!isAdmin()) throw new Error("Solo administración puede publicar mensajes.");
    await addDoc(collection(db, "messages"), {
      text: data.text,
      authorName: state.sessionUser.name,
      authorUsername: state.sessionUser.username,
      createdAt: serverTimestamp()
    });
  }, null);

  bindForm("saleForm", async (data, formData) => {
    const amount = Number(data.amount || 0);
    if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");

    const payload = {
      date: data.date,
      amount,
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      operationType: data.operationType,
      createdByName: state.sessionUser.name,
      createdByUsername: state.sessionUser.username,
      createdAt: serverTimestamp()
    };

    if (data.operationType === "contado") {
      payload.paymentMethod = data.paymentMethod || "efectivo";
      payload.details = data.details || "";
      if (data.paymentMethod === "cheque") {
        payload.checkBank = data.checkBank || "";
        payload.checkNumber = data.checkNumber || "";
        payload.checkHolder = data.checkHolder || "";
        payload.checkDueDate = data.checkDueDate || "";
        payload.checkFrontName = formData.get("checkFront")?.name || "";
        payload.checkBackName = formData.get("checkBack")?.name || "";
      }
    } else {
      payload.customerFirstName = data.customerFirstName || "";
      payload.customerLastName = data.customerLastName || "";
      payload.customerPhone = data.customerPhone || "";

      if (!payload.customerFirstName || !payload.customerLastName) {
        throw new Error("En cuenta corriente completá nombre y apellido.");
      }

      const customerId = await saveCustomerForAccount(data);
      payload.customerId = customerId;
      await addDoc(collection(db, "account_movements"), {
        customerId,
        type: "cargo",
        amount,
        date: data.date,
        details: `${data.documentType} ${data.documentNumber}`,
        createdAt: serverTimestamp()
      });
    }

    await addDoc(collection(db, "sales"), payload);
  }, "saleMsg");

  bindForm("expenseForm", async (data) => {
    const amount = Number(data.amount || 0);
    if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");

    await addDoc(collection(db, "expenses"), {
      date: data.date,
      amount,
      category: data.category,
      details: data.details || "",
      freightData: data.category === "Fletes" ? (data.freightData || "") : "",
      createdByName: state.sessionUser.name,
      createdByUsername: state.sessionUser.username,
      createdAt: serverTimestamp()
    });
  }, "expenseMsg");

  bindForm("productForm", async (data) => {
    const id = sanitizeId(data.code);
    await setDoc(doc(db, "products", id), {
      code: data.code,
      name: data.name,
      category: data.category || "General",
      currentStock: Number(data.currentStock || 0),
      minStock: Number(data.minStock || 0),
      cost: Number(data.cost || 0),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }, "productMsg");

  bindForm("categoryForm", async (data) => {
    if (!isAdmin()) throw new Error("Solo administración puede agregar categorías.");
    const id = sanitizeId(data.name);
    await setDoc(doc(db, "categories", id), {
      name: data.name,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }, "categoryMsg");

  bindForm("paymentForm", async (data) => {
    const amount = Number(data.amount || 0);
    if (!data.customerId) throw new Error("Seleccioná un cliente.");
    if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");

    const balance = accountBalance(data.customerId);
    const finalAmount = data.paymentKind === "total" ? balance : amount;

    if (finalAmount <= 0) throw new Error("No hay saldo pendiente.");
    if (finalAmount > balance) throw new Error("El cobro supera el saldo actual.");

    await addDoc(collection(db, "account_movements"), {
      customerId: data.customerId,
      type: "cobro",
      amount: finalAmount,
      date: data.date,
      details: data.details || "Cobro de cuenta corriente",
      createdAt: serverTimestamp()
    });
  }, "paymentMsg");

  bindForm("userForm", async (data) => {
    if (!isAdmin()) throw new Error("Solo administración puede cargar usuarios.");

    const username = data.username.trim().toLowerCase();
    if (!username) throw new Error("Completá el usuario.");

    const userId = sanitizeId(username);
    const passwordHash = await sha256(data.password);

    await setDoc(doc(db, "users", userId), {
      name: data.name,
      username,
      passwordHash,
      role: data.role,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });
  }, "userMsg");
}

function initLoginFlow() {
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    els.loginError.textContent = "";

    try {
      const user = await handleLogin(els.usernameInput.value, els.passwordInput.value);
      state.sessionUser = user;
      applyRoleUI();
      showApp();
      attachRealtime();
    } catch (error) {
      els.loginError.textContent = error.message || "No se pudo iniciar sesión.";
    }
  });

  onAuthStateChanged(auth, (user) => {
    state.authUser = user;
    if (!user) {
      showLogin();
    }
  });
}

setMode("administrador");
setDefaultDates();
setupNavigation();
setupUiEvents();
setupForms();
setupInstallPrompt();
initLoginFlow();
