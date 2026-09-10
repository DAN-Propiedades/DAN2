/**
 * Sitio público — inicio, catálogo con filtros, ficha de propiedad,
 * nosotros, contacto. Enrutado simple por hash (#/, #/propiedades,
 * #/propiedad/:id, #/nosotros, #/contacto).
 */
(function () {
  const cfg = window.DAN_CONFIG;
  const db = window.danDb;
  const icon = (name) => `<span class="i" data-icon="${name}"></span>`;

  const UF_FMT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
  function fmtUF(n) {
    return "UF " + UF_FMT.format(n);
  }
  function fmtNum(n) {
    return n === null || n === undefined || n === "" ? "—" : UF_FMT.format(n);
  }
  function waLink(msg) {
    return `https://wa.me/${cfg.WHATSAPP_NUMERO}?text=${encodeURIComponent(msg || cfg.MENSAJE_WHATSAPP_GENERICO)}`;
  }
  function escapeHTML(s) {
    return (s || "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function placeholderFor(tipo) {
    const label = encodeURIComponent(tipo || "Propiedad");
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480'><rect width='100%' height='100%' fill='%23E9EEF2'/><text x='50%' y='50%' font-family='sans-serif' font-size='26' fill='%238B93A0' text-anchor='middle' dominant-baseline='middle'>${label}</text></svg>`;
    return `data:image/svg+xml,${svg}`;
  }

  let TODAS = [];
  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheEls();
    wireStaticUI();
    danMountIcons();
    if (!db) {
      showConfigWarning();
      return;
    }
    await cargarPropiedades();
    wireFilters();
    handleRoute();
    window.addEventListener("hashchange", handleRoute);
  }

  function cacheEls() {
    els.gridDestacadas = document.getElementById("grid-destacadas");
    els.grid = document.getElementById("grid-cards");
    els.count = document.getElementById("result-count");
    els.fTipo = document.getElementById("f-tipo");
    els.fComuna = document.getElementById("f-comuna");
    els.fBusca = document.getElementById("f-busca");
    els.fClear = document.getElementById("f-clear");
    els.views = {
      inicio: document.getElementById("view-inicio"),
      propiedades: document.getElementById("view-propiedades"),
      detalle: document.getElementById("view-detalle"),
      nosotros: document.getElementById("view-nosotros"),
      contacto: document.getElementById("view-contacto"),
    };
    els.hero = document.getElementById("hero-section");
    els.menuToggle = document.getElementById("menu-toggle");
    els.mainNav = document.getElementById("main-nav");
    els.waFloat = document.getElementById("wa-float");
    els.contactForm = document.getElementById("contact-form");
    els.contactMsg = document.getElementById("contact-msg");
  }

  function wireStaticUI() {
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const target = el.dataset.nav;
        location.hash = target === "inicio" ? "#/" : "#/" + target;
        els.mainNav.classList.remove("open");
      });
    });
    if (els.menuToggle) {
      els.menuToggle.addEventListener("click", () => els.mainNav.classList.toggle("open"));
    }
    if (els.waFloat) els.waFloat.href = waLink();
    document.querySelectorAll("[data-wa-generic]").forEach((el) => (el.href = waLink()));
    document.querySelectorAll("[data-correo]").forEach((el) => (el.href = "mailto:" + cfg.CORREO_CONTACTO));
    document.querySelectorAll("[data-tel]").forEach((el) => (el.href = "tel:+" + cfg.WHATSAPP_NUMERO));
    document.querySelectorAll(".contact-correo-text").forEach((el) => (el.textContent = cfg.CORREO_CONTACTO));
    document.querySelectorAll(".contact-tel-text").forEach((el) => (el.textContent = cfg.TELEFONO_CONTACTO));
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    if (els.contactForm) els.contactForm.addEventListener("submit", onContactSubmit);
  }

  function showConfigWarning() {
    const msg = '<div class="empty-state">El sitio aún no está conectado a la base de datos. Completa <code>js/config.js</code> con los datos de tu proyecto Supabase (ver INSTRUCCIONES.md).</div>';
    if (els.gridDestacadas) els.gridDestacadas.innerHTML = msg;
    if (els.grid) els.grid.innerHTML = msg;
  }

  // ---------- carga de datos ----------
  async function cargarPropiedades() {
    const { data, error } = await db.from("propiedades").select("*").eq("publicada", true).order("creado_en", { ascending: false });
    if (error) {
      console.error(error);
      const msg = '<div class="empty-state">No se pudo cargar el catálogo. Intenta más tarde.</div>';
      if (els.gridDestacadas) els.gridDestacadas.innerHTML = msg;
      if (els.grid) els.grid.innerHTML = msg;
      return;
    }
    TODAS = data || [];
    poblarFiltros();
    renderDestacadas();
    renderGrid(TODAS);
    setHeroBackground();
  }

  function setHeroBackground() {
    if (!els.hero) return;
    const conFoto = TODAS.find((p) => p.destacada && (p.portada || (p.fotos && p.fotos[0]))) || TODAS.find((p) => p.portada || (p.fotos && p.fotos[0]));
    if (conFoto) {
      const url = conFoto.portada || conFoto.fotos[0];
      els.hero.style.backgroundImage = `url("${url}")`;
      els.hero.classList.remove("hero-fallback");
    } else {
      els.hero.classList.add("hero-fallback");
    }
  }

  function poblarFiltros() {
    const tipos = [...new Set(TODAS.map((p) => p.tipo).filter(Boolean))].sort();
    const comunas = [...new Set(TODAS.map((p) => p.comuna).filter(Boolean))].sort();
    if (els.fTipo) els.fTipo.innerHTML = '<option value="">Todos</option>' + tipos.map((t) => `<option value="${t}">${t}</option>`).join("");
    if (els.fComuna) els.fComuna.innerHTML = '<option value="">Todas</option>' + comunas.map((c) => `<option value="${c}">${c}</option>`).join("");
  }

  function wireFilters() {
    [els.fTipo, els.fComuna].forEach((el) => el && el.addEventListener("change", aplicarFiltros));
    if (els.fBusca) els.fBusca.addEventListener("input", debounce(aplicarFiltros, 180));
    if (els.fClear)
      els.fClear.addEventListener("click", () => {
        if (els.fTipo) els.fTipo.value = "";
        if (els.fComuna) els.fComuna.value = "";
        if (els.fBusca) els.fBusca.value = "";
        aplicarFiltros();
      });
  }

  function aplicarFiltros() {
    const tipo = els.fTipo ? els.fTipo.value : "";
    const comuna = els.fComuna ? els.fComuna.value : "";
    const q = els.fBusca ? els.fBusca.value.trim().toLowerCase() : "";
    renderGrid(
      TODAS.filter((p) => {
        if (tipo && p.tipo !== tipo) return false;
        if (comuna && p.comuna !== comuna) return false;
        if (q && !(p.titulo || "").toLowerCase().includes(q) && !(p.direccion || "").toLowerCase().includes(q)) return false;
        return true;
      })
    );
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }

  // ---------- render ----------
  function renderDestacadas() {
    if (!els.gridDestacadas) return;
    let lista = TODAS.filter((p) => p.destacada).slice(0, 3);
    if (lista.length < 3) {
      const resto = TODAS.filter((p) => !lista.includes(p)).slice(0, 3 - lista.length);
      lista = lista.concat(resto);
    }
    els.gridDestacadas.innerHTML = lista.length
      ? lista.map(cardHTML).join("")
      : '<div class="empty-state">Aún no hay propiedades publicadas. Agrégalas desde el panel privado.</div>';
    danMountIcons(els.gridDestacadas);
    wireCardLinks(els.gridDestacadas);
  }

  function renderGrid(lista) {
    if (!els.grid) return;
    if (els.count) els.count.textContent = `${lista.length} propiedad${lista.length === 1 ? "" : "es"}`;
    els.grid.innerHTML = lista.length
      ? lista.map(cardHTML).join("")
      : '<div class="empty-state">No encontramos propiedades con esos filtros. Prueba ajustar la búsqueda.</div>';
    danMountIcons(els.grid);
    wireCardLinks(els.grid);
  }

  function wireCardLinks(root) {
    root.querySelectorAll("[data-detail]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        location.hash = "#/propiedad/" + a.dataset.detail;
      })
    );
  }

  function ubicacionTexto(p) {
    return [p.comuna, p.region].filter(Boolean).join(", ");
  }

  function cardHTML(p) {
    const foto = p.portada || (p.fotos && p.fotos[0]) || placeholderFor(p.tipo);
    return `
    <a class="card-link" data-detail="${p.id}">
      <article class="card">
        <div class="card-media">
          <img src="${foto}" alt="${escapeHTML(p.titulo)}" loading="lazy">
          <span class="card-tag">${escapeHTML((p.tipo || "").toUpperCase())}</span>
        </div>
        <div class="card-body">
          <div class="card-loc">${icon("pin")} ${escapeHTML(ubicacionTexto(p))}</div>
          <h3>${escapeHTML(p.titulo)}</h3>
          ${p.descripcion ? `<p class="card-desc">${escapeHTML(p.descripcion)}</p>` : ""}
          <div class="spec-row">
            ${p.dormitorios != null ? `<span class="spec">${icon("bed")} ${p.dormitorios}</span>` : ""}
            ${p.banos != null ? `<span class="spec">${icon("bath")} ${p.banos}</span>` : ""}
            ${p.superficie_construida_m2 != null ? `<span class="spec">${icon("ruler")} ${fmtNum(p.superficie_construida_m2)} m²</span>` : p.terreno_m2 != null ? `<span class="spec">${icon("ruler")} ${fmtNum(p.terreno_m2)} m²</span>` : ""}
          </div>
          <div class="card-price">${fmtUF(p.precio_uf)}</div>
        </div>
      </article>
    </a>`;
  }

  // ---------- ruteo ----------
  function handleRoute() {
    const hash = location.hash || "#/";
    const detalle = hash.match(/^#\/propiedad\/(.+)$/);
    Object.values(els.views).forEach((v) => v && (v.hidden = true));
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.remove("active"));

    if (detalle) {
      mostrarDetalle(detalle[1]);
    } else if (hash === "#/propiedades") {
      els.views.propiedades.hidden = false;
      markActive("propiedades");
    } else if (hash === "#/nosotros") {
      els.views.nosotros.hidden = false;
      markActive("nosotros");
    } else if (hash === "#/contacto") {
      els.views.contacto.hidden = false;
      markActive("contacto");
    } else {
      els.views.inicio.hidden = false;
      markActive("inicio");
    }
    window.scrollTo(0, 0);
  }

  function markActive(name) {
    document.querySelectorAll(`[data-nav="${name}"]`).forEach((a) => a.classList.add("active"));
  }

  function mostrarDetalle(id) {
    const p = TODAS.find((x) => String(x.id) === String(id));
    els.views.detalle.hidden = false;
    els.views.detalle.innerHTML = p ? detailHTML(p) : '<div class="empty-state">Esta propiedad ya no está disponible.</div><a class="detail-back" data-nav="propiedades">&larr; Volver al catálogo</a>';
    danMountIcons(els.views.detalle);
    els.views.detalle.querySelectorAll("[data-nav]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        location.hash = "#/" + el.dataset.nav;
      })
    );
  }

  function detailHTML(p) {
    const foto = p.portada || (p.fotos && p.fotos[0]) || placeholderFor(p.tipo);
    const msg = `Hola, me interesa la propiedad "${p.titulo}" (${p.comuna}). ¿Podrían darme más información?`;
    const specs = [
      p.terreno_m2 != null ? { val: fmtNum(p.terreno_m2), lab: "m² terreno" } : null,
      p.superficie_construida_m2 != null ? { val: fmtNum(p.superficie_construida_m2), lab: "m² construidos" } : null,
      p.dormitorios != null ? { val: p.dormitorios, lab: "dormitorios" } : null,
      p.banos != null ? { val: p.banos, lab: "baños" } : null,
      p.estacionamientos != null ? { val: p.estacionamientos, lab: "estacionamientos" } : null,
    ].filter(Boolean);
    const caracteristicas = Array.isArray(p.caracteristicas) ? p.caracteristicas : [];
    return `
    <a class="detail-back" data-nav="propiedades">&larr; Volver al catálogo</a>
    <div class="detail-grid">
      <div><div class="gallery-main"><img src="${foto}" alt="${escapeHTML(p.titulo)}"></div></div>
      <div>
        <span class="card-tag" style="position:static; display:inline-block; margin-bottom:10px;">${escapeHTML((p.tipo || "").toUpperCase())}</span>
        <div class="detail-title-row">
          <h1 style="margin:0;">${escapeHTML(p.titulo)}</h1>
          <div class="detail-price-tag">${fmtUF(p.precio_uf)}</div>
        </div>
        <div class="card-loc" style="margin-bottom:6px;">${icon("pin")} ${escapeHTML(ubicacionTexto(p))}${p.direccion ? " — " + escapeHTML(p.direccion) : ""}</div>
        <p>${escapeHTML(p.descripcion || "")}</p>
        ${caracteristicas.length ? caracteristicas.map((c) => `<span class="tag-chip">${escapeHTML(c)}</span>`).join("") : ""}
        <div class="spec-plate">
          <div class="spec-plate-title">Ficha técnica</div>
          <div class="spec-plate-grid">
            ${specs.map((s) => `<div class="spec-plate-item"><span class="val">${s.val}</span><span class="lab">${s.lab}</span></div>`).join("")}
          </div>
        </div>
        <div class="detail-actions">
          <a class="btn btn-accent" href="${waLink(msg)}" target="_blank" rel="noopener">${icon("chat")} Consultar por WhatsApp</a>
          <a class="btn btn-outline" href="mailto:${cfg.CORREO_CONTACTO}?subject=${encodeURIComponent("Consulta: " + p.titulo)}">${icon("mail")} Escribir por correo</a>
        </div>
      </div>
    </div>`;
  }

  // ---------- formulario de contacto ----------
  async function onContactSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const nombre = form.nombre.value.trim();
    const correo = form.correo.value.trim();
    const telefono = form.telefono.value.trim();
    const mensaje = form.mensaje.value.trim();
    if (!nombre || !mensaje) return;

    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Enviando…';

    let enviado = false;
    if (cfg.WEB3FORMS_ACCESS_KEY && cfg.WEB3FORMS_ACCESS_KEY.indexOf("TU-ACCESS-KEY") === -1) {
      try {
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            access_key: cfg.WEB3FORMS_ACCESS_KEY,
            subject: `Nueva consulta de ${nombre} — DAN Propiedades`,
            from_name: "Sitio DAN Propiedades",
            name: nombre,
            email: correo || "no-informado@danpropiedades.cl",
            telefono,
            mensaje,
          }),
        });
        const json = await res.json();
        enviado = !!json.success;
      } catch (err) {
        console.error(err);
      }
    }

    let guardado = false;
    if (db) {
      try {
        const { error } = await db.from("mensajes").insert({ nombre, correo, telefono, mensaje });
        guardado = !error;
      } catch (err) {
        console.error(err);
      }
    }

    btn.disabled = false;
    btn.innerHTML = original;

    if (els.contactMsg) {
      if (enviado) {
        els.contactMsg.className = "form-msg ok";
        els.contactMsg.textContent = "¡Gracias! Tu mensaje fue enviado. Te contactaremos a la brevedad.";
        form.reset();
      } else if (guardado) {
        els.contactMsg.className = "form-msg ok";
        els.contactMsg.textContent = "Recibimos tu consulta. Si no tenemos noticias tuyas pronto, escríbenos directo por WhatsApp para una respuesta más rápida.";
        form.reset();
      } else {
        els.contactMsg.className = "form-msg err";
        els.contactMsg.textContent = "No pudimos enviar tu consulta en este momento. Por favor escríbenos directo por WhatsApp o al correo de contacto.";
      }
      els.contactMsg.hidden = false;
    }
  }
})();
