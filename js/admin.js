/**
 * Panel privado — acceso de administrador y gestión completa de propiedades.
 *
 * Modelo de acceso "autoservicio": la primera persona que hace clic en
 * "Crear la cuenta de administrador" queda registrada como administradora
 * (tabla `admins`, función `claim_admin()` en sql/schema.sql). Cualquier
 * cuenta creada después de esa ya no puede reclamar el rol y no podrá
 * leer ni modificar propiedades: la protección real vive en las políticas
 * RLS de la base, que exigen `is_admin()`, no solo estar logueado.
 */
(function () {
  const cfg = window.DAN_CONFIG;
  const db = window.danDb;
 
  const els = {};
  let SESSION = null;
  let IS_ADMIN = false;
  let MODE = "login"; // "login" | "signup"
  let PROPIEDADES = [];
  let MENSAJES = [];
  const MAX_FOTOS = 5;
  let fotos = []; // [{ key, url, file }] — orden = orden de la galería; fotos[0] es la portada
 
  document.addEventListener("DOMContentLoaded", init);
 
  async function init() {
    cacheEls();
    wireUI();
    danMountIcons();
    if (!db) {
      showAuthError("Falta configurar js/config.js con los datos de tu proyecto Supabase.");
      return;
    }
    const { data } = await db.auth.getSession();
    await onSessionChange(data.session);
    db.auth.onAuthStateChange((_event, session) => onSessionChange(session));
  }
 
  function cacheEls() {
    els.logoutBtn = document.getElementById("logout-btn");
    els.viewLogin = document.getElementById("view-login");
    els.viewDash = document.getElementById("view-dash");
    els.loginTitle = document.getElementById("login-title");
    els.loginDesc = document.getElementById("login-desc");
    els.loginHint = document.getElementById("login-hint");
    els.authForm = document.getElementById("auth-form");
    els.authEmail = document.getElementById("auth-email");
    els.authPassword = document.getElementById("auth-password");
    els.authSubmit = document.getElementById("auth-submit");
    els.authError = document.getElementById("auth-error");
    els.authOk = document.getElementById("auth-ok");
    els.toggleMode = document.getElementById("toggle-mode");
    els.adminCount = document.getElementById("admin-count");
    els.propList = document.getElementById("prop-list");
    els.newPropBtn = document.getElementById("new-prop-btn");
    els.toggleMsgs = document.getElementById("toggle-msgs");
    els.msgCount = document.getElementById("msg-count");
    els.msgsPanel = document.getElementById("msgs-panel");
    els.msgsList = document.getElementById("msgs-list");
    els.modalBackdrop = document.getElementById("modal-backdrop");
    els.modalTitle = document.getElementById("modal-title");
    els.propForm = document.getElementById("prop-form");
    els.cancelModal = document.getElementById("cancel-modal");
    els.saveError = document.getElementById("save-error");
    els.saveBtn = document.getElementById("save-btn");
    els.fotoInput = document.getElementById("foto-input");
    els.photoGrid = document.getElementById("photo-grid");
  }
 
  function wireUI() {
    els.authForm.addEventListener("submit", onAuthSubmit);
    els.toggleMode.addEventListener("click", () => setMode(MODE === "login" ? "signup" : "login"));
    els.logoutBtn.addEventListener("click", () => db.auth.signOut());
    els.newPropBtn.addEventListener("click", () => openModal());
    els.cancelModal.addEventListener("click", closeModal);
    els.modalBackdrop.addEventListener("click", (e) => { if (e.target === els.modalBackdrop) closeModal(); });
    els.propForm.addEventListener("submit", onSaveProp);
    els.fotoInput.addEventListener("change", onFotoSelected);
    els.toggleMsgs.addEventListener("click", () => {
      els.msgsPanel.hidden = !els.msgsPanel.hidden;
    });
  }
 
  function setMode(mode) {
    MODE = mode;
    els.authError.hidden = true;
    els.authOk.hidden = true;
    if (mode === "signup") {
      els.loginTitle.textContent = "Crear la cuenta de administrador";
      els.loginDesc.textContent = "Esta cuenta quedará como la única administradora del sitio. Guarda bien tu contraseña.";
      els.authSubmit.textContent = "Crear cuenta";
      els.toggleMode.textContent = "Ya tengo una cuenta, iniciar sesión";
      els.loginHint.textContent = "Solo la primera persona que crea una cuenta queda como administradora.";
    } else {
      els.loginTitle.textContent = "Acceso administrador";
      els.loginDesc.textContent = "Ingresa tu correo y contraseña para gestionar el catálogo de propiedades.";
      els.authSubmit.textContent = "Entrar";
      els.toggleMode.textContent = "Crear la cuenta de administrador";
      els.loginHint.textContent = "";
    }
  }
 
  async function onSessionChange(session) {
    SESSION = session;
    if (!session) {
      IS_ADMIN = false;
      showLogin();
      return;
    }
    const { data, error } = await db.rpc("is_admin");
    IS_ADMIN = !error && data === true;
    if (!IS_ADMIN) {
      // No es admin todavía. Cubre el caso de proyectos que piden confirmar
      // el correo: ahí no había sesión activa en el momento del registro,
      // así que el rol nunca se reclamó. Si nadie más lo ha reclamado,
      // esta primera sesión activa (login luego de confirmar el correo)
      // lo reclama ahora. claim_admin() es seguro de llamar aunque la
      // cuenta ya sea admin o aunque ya exista otra: solo tiene efecto la
      // primera vez que alguien lo consigue.
      const { data: claimed } = await db.rpc("claim_admin");
      if (claimed) IS_ADMIN = true;
    }
    if (!IS_ADMIN) {
      await db.auth.signOut();
      showLogin();
      showAuthError("Esta cuenta no tiene permisos de administrador.");
      return;
    }
    showDash();
  }
 
  function showLogin() {
    els.viewLogin.hidden = false;
    els.viewDash.hidden = true;
    els.logoutBtn.hidden = true;
  }
 
  function showDash() {
    els.viewLogin.hidden = true;
    els.viewDash.hidden = false;
    els.logoutBtn.hidden = false;
    cargarPropiedades();
    cargarMensajes();
  }
 
  function showAuthError(msg) {
    els.authOk.hidden = true;
    els.authError.textContent = msg;
    els.authError.hidden = false;
  }
 
  async function onAuthSubmit(e) {
    e.preventDefault();
    els.authError.hidden = true;
    els.authOk.hidden = true;
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    els.authSubmit.disabled = true;
 
    if
