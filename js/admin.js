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
  let fotoState = { file: null, url: null };
 
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
    els.coverPreview = document.getElementById("cover-preview");
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
 
    if (MODE === "login") {
      const { error } = await db.auth.signInWithPassword({ email, password });
      els.authSubmit.disabled = false;
      if (error) showAuthError("Correo o contraseña incorrectos.");
      // onSessionChange se encarga del resto (incluida la verificación is_admin)
      return;
    }
 
    // ---- modo "crear cuenta de administrador" ----
    const { data: exists } = await db.rpc("admin_exists");
    if (exists) {
      els.authSubmit.disabled = false;
      showAuthError("Ya existe una cuenta de administrador para este sitio. Pide las credenciales a quien la creó.");
      return;
    }
    const { data: signUpData, error: signUpError } = await db.auth.signUp({ email, password });
    if (signUpError) {
      els.authSubmit.disabled = false;
      showAuthError(traducirErrorSignup(signUpError.message));
      return;
    }
    if (!signUpData.session) {
      // El proyecto pide confirmar el correo antes de iniciar sesión.
      // Importante: setMode() limpia los mensajes, así que se llama ANTES
      // de fijar el texto de aviso (si se llama después, el mensaje se
      // oculta al instante y la persona nunca alcanza a leerlo).
      setMode("login");
      els.authOk.textContent = "Cuenta creada. Revisa tu correo (" + email + ") y confirma la cuenta. Luego vuelve aquí e inicia sesión con \"Entrar\" — quedarás como administradora automáticamente.";
      els.authOk.hidden = false;
      els.authSubmit.disabled = false;
      return;
    }
    const { data: claimed, error: claimError } = await db.rpc("claim_admin");
    els.authSubmit.disabled = false;
    if (claimError || !claimed) {
      await db.auth.signOut();
      showAuthError("Ya existe una cuenta de administrador para este sitio. Pide las credenciales a quien la creó.");
      return;
    }
    // claim_admin() tuvo éxito: onAuthStateChange ya dispara showDash().
  }
 
  function traducirErrorSignup(msg) {
    if (/already registered/i.test(msg)) return "Ese correo ya está registrado. Intenta iniciar sesión.";
    if (/password/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
    return "No se pudo crear la cuenta: " + msg;
  }
 
  // ---------- propiedades ----------
  async function cargarPropiedades() {
    const { data, error } = await db.from("propiedades").select("*").order("creado_en", { ascending: false });
    if (error) { console.error(error); return; }
    PROPIEDADES = data || [];
    const visibles = PROPIEDADES.filter((p) => p.publicada).length;
    els.adminCount.textContent = `${PROPIEDADES.length} propiedad${PROPIEDADES.length === 1 ? "" : "es"} · ${visibles} visible${visibles === 1 ? "" : "s"} en el sitio`;
    renderPropList();
  }
 
  function renderPropList() {
    if (!PROPIEDADES.length) {
      els.propList.innerHTML = `<p class="badge-note" style="padding:20px 0;">Aún no hay propiedades. Crea la primera con "+ Nueva propiedad".</p>`;
      return;
    }
    els.propList.innerHTML = PROPIEDADES.map((p) => `
      <div class="prop-row" data-row="${p.id}">
        <img class="thumb" src="${p.portada || (p.fotos && p.fotos[0]) || ""}" onerror="this.style.visibility='hidden'" alt="">
        <div class="prop-info">
          <div class="title">${escapeHTML(p.titulo)}</div>
          <div class="meta">${escapeHTML(p.tipo)} · ${escapeHTML(p.comuna)} · ${new Intl.NumberFormat("es-CL").format(p.precio_uf)} UF</div>
          <div class="chip-row">
            <span class="chip ${p.publicada ? "on" : "off"}">${p.publicada ? "Publicada" : "Oculta"}</span>
            ${p.destacada ? '<span class="chip star">Destacada</span>' : ""}
          </div>
        </div>
        <div class="icon-actions">
          <button class="icon-btn ${p.publicada ? "is-on" : ""}" title="${p.publicada ? "Ocultar del sitio" : "Publicar en el sitio"}" data-toggle-pub="${p.id}"><span class="i" data-icon="${p.publicada ? "eye" : "eyeOff"}"></span></button>
          <button class="icon-btn ${p.destacada ? "is-on" : ""}" title="${p.destacada ? "Quitar de destacadas" : "Destacar en portada"}" data-toggle-star="${p.id}"><span class="i" data-icon="${p.destacada ? "starFill" : "star"}"></span></button>
          <button class="icon-btn" title="Editar" data-edit="${p.id}"><span class="i" data-icon="pencil"></span></button>
          <button class="icon-btn danger" title="Eliminar" data-del="${p.id}"><span class="i" data-icon="trash"></span></button>
        </div>
      </div>`).join("");
    danMountIcons(els.propList);
    els.propList.querySelectorAll("[data-toggle-pub]").forEach((b) => b.addEventListener("click", () => togglePropiedad(b.dataset.togglePub, "publicada")));
    els.propList.querySelectorAll("[data-toggle-star]").forEach((b) => b.addEventListener("click", () => togglePropiedad(b.dataset.toggleStar, "destacada")));
    els.propList.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(b.dataset.edit)));
    els.propList.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => eliminarProp(b.dataset.del)));
  }
 
  async function togglePropiedad(id, campo) {
    const p = PROPIEDADES.find((x) => x.id === id);
    if (!p) return;
    const { error } = await db.from("propiedades").update({ [campo]: !p[campo] }).eq("id", id);
    if (!error) cargarPropiedades();
  }
 
  async function eliminarProp(id) {
    if (!confirm("¿Eliminar esta propiedad? Esta acción no se puede deshacer.")) return;
    const p = PROPIEDADES.find((x) => x.id === id);
    const { error } = await db.from("propiedades").delete().eq("id", id);
    if (error) { alert("No se pudo eliminar: " + error.message); return; }
    if (p && p.fotos && p.fotos.length) {
      const paths = p.fotos.map(urlToStoragePath).filter(Boolean);
      if (paths.length) db.storage.from(cfg.STORAGE_BUCKET).remove(paths).catch(() => {});
    }
    cargarPropiedades();
  }
 
  function urlToStoragePath(url) {
    const marker = `/object/public/${cfg.STORAGE_BUCKET}/`;
    const i = url.indexOf(marker);
    return i === -1 ? null : url.substring(i + marker.length);
  }
 
  // ---------- modal crear/editar ----------
  function openModal(id) {
    const p = id ? PROPIEDADES.find((x) => x.id === id) : null;
    els.modalTitle.textContent = p ? "Editar propiedad" : "Nueva propiedad";
    els.propForm.reset();
    els.saveError.hidden = true;
    els.propForm.dataset.id = id || "";
    fotoState = { file: null, url: p ? (p.portada || (p.fotos && p.fotos[0]) || null) : null };
 
    if (p) {
      els.propForm.titulo.value = p.titulo || "";
      els.propForm.comuna.value = p.comuna || "";
      if (p.region) els.propForm.region.value = p.region;
      els.propForm.tipo.value = p.tipo || "Casa";
      els.propForm.precio_uf.value = p.precio_uf ?? "";
      els.propForm.terreno_m2.value = p.terreno_m2 ?? "";
      els.propForm.superficie_construida_m2.value = p.superficie_construida_m2 ?? "";
      els.propForm.dormitorios.value = p.dormitorios ?? "";
      els.propForm.banos.value = p.banos ?? "";
      els.propForm.estacionamientos.value = p.estacionamientos ?? "";
      els.propForm.descripcion.value = p.descripcion || "";
      els.propForm.caracteristicas.value = (p.caracteristicas || []).join(", ");
      els.propForm.publicada.checked = !!p.publicada;
      els.propForm.destacada.checked = !!p.destacada;
    } else {
      els.propForm.publicada.checked = true;
      els.propForm.destacada.checked = false;
    }
    renderCoverPreview();
    els.modalBackdrop.hidden = false;
  }
 
  function closeModal() {
    els.modalBackdrop.hidden = true;
  }
 
  function renderCoverPreview() {
    if (fotoState.url) {
      els.coverPreview.src = fotoState.url;
      els.coverPreview.hidden = false;
    } else {
      els.coverPreview.hidden = true;
    }
  }
 
  function onFotoSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    fotoState.file = file;
    const reader = new FileReader();
    reader.onload = () => { fotoState.url = reader.result; renderCoverPreview(); };
    reader.readAsDataURL(file);
  }
 
  function compressImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => (img.src = reader.result);
      reader.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", quality);
      };
      img.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
 
  async function onSaveProp(e) {
    e.preventDefault();
    els.saveError.hidden = true;
    const f = els.propForm;
    const id = f.dataset.id;
 
    let fotoUrl = fotoState.url && !fotoState.file ? fotoState.url : null;
 
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = "Guardando…";
 
    if (fotoState.file) {
      try {
        const compressed = await compressImage(fotoState.file, 1600, 0.82);
        const path = `propiedades/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await db.storage.from(cfg.STORAGE_BUCKET).upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw upErr;
        const { data } = db.storage.from(cfg.STORAGE_BUCKET).getPublicUrl(path);
        fotoUrl = data.publicUrl;
      } catch (err) {
        els.saveBtn.disabled = false;
        els.saveBtn.textContent = "Guardar";
        els.saveError.textContent = "No se pudo subir la foto: " + (err.message || err);
        els.saveError.hidden = false;
        return;
      }
    }
 
    const caracteristicas = f.caracteristicas.value.split(",").map((s) => s.trim()).filter(Boolean);
 
    const payload = {
      titulo: f.titulo.value.trim(),
      comuna: f.comuna.value.trim(),
      region: f.region.value,
      tipo: f.tipo.value,
      precio_uf: numOrNull(f.precio_uf.value),
      terreno_m2: numOrNull(f.terreno_m2.value),
      superficie_construida_m2: numOrNull(f.superficie_construida_m2.value),
      dormitorios: numOrNull(f.dormitorios.value),
      banos: numOrNull(f.banos.value),
      estacionamientos: numOrNull(f.estacionamientos.value),
      descripcion: f.descripcion.value.trim(),
      caracteristicas,
      publicada: f.publicada.checked,
      destacada: f.destacada.checked,
      actualizado_en: new Date().toISOString(),
    };
    if (fotoUrl) {
      payload.fotos = [fotoUrl];
      payload.portada = fotoUrl;
    }
 
    if (!payload.titulo || !payload.comuna || payload.precio_uf === null) {
      els.saveBtn.disabled = false;
      els.saveBtn.textContent = "Guardar";
      els.saveError.textContent = "Completa al menos título, comuna y precio en UF.";
      els.saveError.hidden = false;
      return;
    }
 
    const { error } = id
      ? await db.from("propiedades").update(payload).eq("id", id)
      : await db.from("propiedades").insert(payload);
 
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "Guardar";
    if (error) {
      els.saveError.textContent = "No se pudo guardar: " + error.message;
      els.saveError.hidden = false;
      return;
    }
    closeModal();
    cargarPropiedades();
  }
 
  function numOrNull(v) {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
 
  // ---------- mensajes ----------
  async function cargarMensajes() {
    const { data, error } = await db.from("mensajes").select("*").order("creado_en", { ascending: false });
    if (error) { console.error(error); return; }
    MENSAJES = data || [];
    els.msgCount.textContent = MENSAJES.filter((m) => !m.leido).length;
    renderMensajes();
  }
 
  function renderMensajes() {
    if (!MENSAJES.length) {
      els.msgsList.innerHTML = `<p class="badge-note" style="padding:12px 0;">No hay mensajes todavía.</p>`;
      return;
    }
    els.msgsList.innerHTML = MENSAJES.map((m) => `
      <div class="prop-row">
        <div class="prop-info">
          <div class="title">${escapeHTML(m.nombre)} <span class="badge-note">· ${new Date(m.creado_en).toLocaleString("es-CL")}</span></div>
          <div class="meta">${escapeHTML(m.correo || "")}${m.telefono ? " · " + escapeHTML(m.telefono) : ""}</div>
          <div class="meta" style="margin-top:4px; color:var(--ink-soft);">${escapeHTML(m.mensaje)}</div>
        </div>
        <div class="icon-actions">
          <button class="icon-btn ${m.leido ? "" : "is-on"}" title="${m.leido ? "Marcar no leído" : "Marcar leído"}" data-read="${m.id}"><span class="i" data-icon="${m.leido ? "eyeOff" : "eye"}"></span></button>
          <button class="icon-btn danger" title="Eliminar" data-delmsg="${m.id}"><span class="i" data-icon="trash"></span></button>
        </div>
      </div>`).join("");
    danMountIcons(els.msgsList);
    els.msgsList.querySelectorAll("[data-read]").forEach((b) => b.addEventListener("click", async () => {
      const m = MENSAJES.find((x) => x.id === b.dataset.read);
      await db.from("mensajes").update({ leido: !m.leido }).eq("id", m.id);
      cargarMensajes();
    }));
    els.msgsList.querySelectorAll("[data-delmsg]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este mensaje?")) return;
      await db.from("mensajes").delete().eq("id", b.dataset.delmsg);
      cargarMensajes();
    }));
  }
 
  function escapeHTML(s) {
    return (s || "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
