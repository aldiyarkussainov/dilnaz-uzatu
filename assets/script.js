/* ============================================================
   Дильназ — Қыз ұзату · interactivity
   ------------------------------------------------------------
   Responsibilities:
     • Open the envelope on tap → play music → reveal pages
     • Toggle music on/off
     • Reveal pages on scroll (IntersectionObserver)
     • Submit RSVP to a Google Apps Script webhook (= Google
       Sheet, exportable as .xlsx). Always saved to localStorage
       as a fallback so admin.html can export later.
   ============================================================ */

/* ─── 1. CONFIG ────────────────────────────────────────────── */

// Paste your deployed Google Apps Script Web App URL here.
// Setup steps are in README.md → "RSVP → Excel".
// Leave "" to use localStorage-only mode.
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyNu7RTcsOrr73uEkWeIe_e8YJrwYqwLi2CTdWPQ4sZ5MRZWK015gv8YmxOM2MiqF60Yw/exec";

const STORAGE_KEY        = "dilnaz_rsvps";
const RSVP_LAST_TS_KEY   = "dilnaz_rsvp_last_timestamp";
const RSVP_CONFIRMED_KEY = "dilnaz_rsvp_confirmed";

// 6 August 2026, 16:00 Astana time (UTC+5)
const TARGET_DATE = new Date("2026-08-06T16:00:00+05:00");

/* On any reload — start from the very top (cover screen).
   Browsers restore the previous scroll position by default; this
   override makes refresh always land on screen 1. */
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

/* ─── 2. PRELOAD splash ───────────────────────────────────── */

// Hide the splash once the page is interactive, but keep it on
// screen for at least one full heartbeat cycle. On exit, the heart
// bursts forward and the preload bg fades, revealing the invitation.
const preloadEl = document.getElementById("preload");
if (preloadEl) {
  const minVisible = new Promise((r) => setTimeout(r, 1000));
  const pageReady  = document.readyState === "complete"
    ? Promise.resolve()
    : new Promise((r) => window.addEventListener("load", r, { once: true }));
  Promise.all([minVisible, pageReady]).then(() => {
    preloadEl.classList.add("is-exiting");
    // Trigger the cover reveal animations the moment preload starts
    // exiting — photo fades in behind the bursting heart, then text
    // staggers in as the preload bg fades.
    document.body.classList.add("cover-revealed");
    // Попытка автостарта музыки — большинство браузеров заблокируют
    // (нет user gesture), но в некоторых случаях (повторный визит,
    // мягкая autoplay policy) сработает; иначе подхватит первый
    // click/touch ниже.
    tryStartMusic();
    setTimeout(() => preloadEl.remove(), 1150);
  });
} else {
  // No preload at all → reveal cover immediately so it isn't stuck hidden
  document.body.classList.add("cover-revealed");
}

/* ─── 3. MUSIC + SCROLL HINT ──────────────────────────────── */

const audio       = document.getElementById("bgMusic");
const musicToggle = document.getElementById("musicToggle");
const scrollCue   = document.getElementById("scrollCue");

// Fade in the scroll cue a beat after the cover stagger finishes
// (~2.6 s after page load), then fade it out when the user starts
// scrolling. Tied to body.cover-revealed so it never shows during
// preload or before the cover has been revealed.
if (scrollCue) {
  const showCue = () => setTimeout(
    () => scrollCue.classList.add("is-visible"),
    1700
  );
  if (document.body.classList.contains("cover-revealed")) {
    showCue();
  } else {
    const obs = new MutationObserver(() => {
      if (document.body.classList.contains("cover-revealed")) {
        obs.disconnect();
        showCue();
      }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  let dismissed = false;
  const onScroll = () => {
    if (dismissed) return;
    if (window.scrollY > window.innerHeight * 0.25) {
      scrollCue.classList.remove("is-visible");
      dismissed = true;
      window.removeEventListener("scroll", onScroll);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

// Music starts on the first user gesture (browsers block autoplay
// without one). We listen once to click + touchstart and try then.
let musicStarted = false;
function tryStartMusic() {
  if (musicStarted || !audio) return;
  musicStarted = true;
  audio.volume = 0.45;
  audio.play()
    .then(() => musicToggle.classList.remove("is-muted"))
    .catch(() => musicToggle.classList.add("is-muted"));
}
["pointerdown", "click", "touchstart", "touchend", "keydown", "wheel"].forEach((ev) => {
  document.addEventListener(ev, tryStartMusic, { once: true, passive: true });
});

/* Music toggle — manual play/pause */
if (musicToggle) {
  musicToggle.addEventListener("click", (e) => {
    e.stopPropagation(); // don't double-trigger tryStartMusic
    if (!audio) return;
    musicStarted = true;
    if (audio.paused) {
      audio.play()
        .then(() => musicToggle.classList.remove("is-muted"))
        .catch(() => musicToggle.classList.add("is-muted"));
    } else {
      audio.pause();
      musicToggle.classList.add("is-muted");
    }
  });
}

// If the audio file is missing or fails to load, lock the toggle
// in muted state so the icon matches reality.
if (audio) {
  audio.addEventListener("error", () => {
    musicToggle.classList.add("is-muted");
  });
}

/* ─── 4. FLORAL FALLBACK (SVG → PNG → hide) ───────────────── */

// HTML asks for .svg first. If the file is missing, swap to .png.
// If that's also missing, hide the element so the layout stays clean.
document.querySelectorAll(".cover-floral").forEach((img) => {
  img.addEventListener("error", () => {
    if (img.src.endsWith(".svg")) {
      img.src = img.src.replace(/\.svg$/, ".png");
    } else {
      img.style.display = "none";
    }
  });
});

// Envelope image: try .png, fall back to .jpg / .jpeg, then hide.
const envelopeImg = document.querySelector(".envelope-img");
if (envelopeImg) {
  envelopeImg.addEventListener("error", () => {
    if (envelopeImg.src.endsWith(".png")) {
      envelopeImg.src = envelopeImg.src.replace(/\.png$/, ".jpg");
    } else if (envelopeImg.src.endsWith(".jpg")) {
      envelopeImg.src = envelopeImg.src.replace(/\.jpg$/, ".jpeg");
    } else {
      envelopeImg.style.display = "none";
    }
  });
}

/* ─── 4.5. FALLING HEARTS BACKGROUND ──────────────────────── */

(function spawnFallingHearts() {
  const SVG_HEART =
    `<svg viewBox="0 0 24 24" aria-hidden="true">` +
    `<path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>` +
    `</svg>`;

  const COUNT = 22;

  document.querySelectorAll(".falling-hearts").forEach((host) => {
    for (let i = 0; i < COUNT; i++) {
      const h = document.createElement("span");
      const size = 12 + Math.random() * 18;            // 12–30 px
      const dur  = 10 + Math.random() * 14;            // 10–24 s
      h.className = "falling-heart";
      h.style.left              = (Math.random() * 100).toFixed(2) + "%";
      h.style.width             = size.toFixed(1) + "px";
      h.style.height            = size.toFixed(1) + "px";
      h.style.opacity           = (0.10 + Math.random() * 0.20).toFixed(2);
      h.style.animationDuration = dur.toFixed(1) + "s";
      /* Negative delay so hearts start mid-fall instead of all at top */
      h.style.animationDelay    = (-Math.random() * dur).toFixed(1) + "s";
      h.innerHTML = SVG_HEART;
      host.appendChild(h);
    }
  });
})();

/* ─── 5. SCROLL REVEAL ────────────────────────────────────── */

const revealEls = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -10% 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  // Fallback: just show everything
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

/* ─── 6. COUNTDOWN ────────────────────────────────────────── */

// Class-based selectors so the same tick updates ALL countdown
// instances on the page (нижний "подвал" + confirmed-view).
const cdEls = {
  days:   document.querySelectorAll(".cd-days"),
  hours:  document.querySelectorAll(".cd-hours"),
  mins:   document.querySelectorAll(".cd-mins"),
  secs:   document.querySelectorAll(".cd-secs"),
  grids:  document.querySelectorAll(".countdown"),
  passed: document.querySelectorAll(".countdown-passed"),
};

function pad2(n) { return String(n).padStart(2, "0"); }
function setAll(list, value) { list.forEach((el) => { el.textContent = value; }); }

function tickCountdown() {
  const now  = Date.now();
  const diff = TARGET_DATE.getTime() - now;

  if (diff <= 0) {
    cdEls.grids.forEach((g)  => { g.hidden = true; });
    cdEls.passed.forEach((p) => { p.hidden = false; });
    return false; // stop the interval
  }

  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins  = Math.floor((diff % 3_600_000) / 60_000);
  const secs  = Math.floor((diff % 60_000) / 1_000);

  setAll(cdEls.days,  String(days));
  setAll(cdEls.hours, pad2(hours));
  setAll(cdEls.mins,  pad2(mins));
  setAll(cdEls.secs,  pad2(secs));
  return true;
}

if (cdEls.days.length) {
  if (tickCountdown()) {
    const id = setInterval(() => {
      if (!tickCountdown()) clearInterval(id);
    }, 1000);
  }
}

/* ─── 7. RSVP FORM ────────────────────────────────────────── */

const form         = document.getElementById("rsvpForm");
const submitBtn    = document.getElementById("submitBtn");
const status       = document.getElementById("formStatus");
const addGuestBtn  = document.getElementById("addGuest");
const guestFields  = document.getElementById("guestFields");
const formView     = document.getElementById("rsvpFormView");
const confirmView  = document.getElementById("rsvpConfirmedView");
const cancelBtn    = document.getElementById("cancelRsvp");

function showConfirmedView() {
  if (formView)    formView.hidden = true;
  if (confirmView) confirmView.hidden = false;
  // Скрываем нижний таймер-«подвал» — таймер виден только в confirmed-view
  document.body.classList.add("rsvp-confirmed");
}
function showFormView() {
  if (confirmView) confirmView.hidden = true;
  if (formView)    formView.hidden = false;
  document.body.classList.remove("rsvp-confirmed");
  if (form) form.reset();
  // Cleanup: убираем динамически добавленные guest-поля
  if (guestFields) {
    guestFields.querySelectorAll(":scope > .field").forEach((field, i) => {
      if (i > 0) field.remove();
    });
  }
}

// На загрузке: если ранее уже подтвердили — сразу показать confirmed
if (localStorage.getItem(RSVP_CONFIRMED_KEY) === "1") {
  showConfirmedView();
}

if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    // Удаляем запись из localStorage чтобы админка не показывала
    // отменённого гостя как «придёт».
    removeOwnRsvpFromStorage();
    localStorage.removeItem(RSVP_CONFIRMED_KEY);
    showFormView();
  });
}

// + Тағы қонақ — adds an extra guest-name field with a × remove button
function renumberGuests() {
  if (!guestFields) return;
  const labels = guestFields.querySelectorAll(":scope > .field > .field-label");
  labels.forEach((label, i) => {
    if (i === 0) return; // оставляем «Атыңыз, жөніңіз» у первого
    label.textContent = `Қонақ ${i + 1}`;
  });
}

if (addGuestBtn && guestFields) {
  addGuestBtn.addEventListener("click", () => {
    const total = guestFields.querySelectorAll(":scope > .field").length;
    const next  = total + 1;

    const wrapper = document.createElement("div");
    wrapper.className = "field";
    wrapper.innerHTML =
      `<span class="field-label">Қонақ ${next}</span>` +
      `<div class="input-with-remove">` +
        `<input type="text" name="name" placeholder="Атыңыз, жөніңіз" aria-label="Қонақ ${next} атыңыз" />` +
        `<button type="button" class="btn-remove" aria-label="Қонақты жою">×</button>` +
      `</div>`;

    wrapper.querySelector(".btn-remove").addEventListener("click", () => {
      wrapper.remove();
      renumberGuests();
    });

    guestFields.appendChild(wrapper);
    wrapper.querySelector("input").focus();
  });
}

function setStatus(message, kind /* "success" | "error" | "" */) {
  status.textContent = message;
  status.classList.remove("is-success", "is-error");
  if (kind === "success") status.classList.add("is-success");
  if (kind === "error")   status.classList.add("is-error");
}

function saveLocal(record) {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    // Заменяем предыдущую запись с этого устройства (если была),
    // чтобы повторные сабмиты не плодили дубликаты в админке.
    const prevTs   = localStorage.getItem(RSVP_LAST_TS_KEY);
    const filtered = prevTs ? list.filter((r) => r.timestamp !== prevTs) : list;
    filtered.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    localStorage.setItem(RSVP_LAST_TS_KEY, record.timestamp);
  } catch (err) {
    // localStorage may be disabled (private mode, full quota) —
    // we still try the webhook below.
    console.warn("[rsvp] localStorage unavailable", err);
  }
}

/* On cancel — remove THIS device's record from the local list so
   admin.html doesn't show a phantom "придёт" after the guest
   already cancelled. */
function removeOwnRsvpFromStorage() {
  const lastTs = localStorage.getItem(RSVP_LAST_TS_KEY);
  if (!lastTs) return;
  try {
    const list     = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const filtered = list.filter((r) => r.timestamp !== lastTs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn("[rsvp] cancel cleanup failed", err);
  }
  localStorage.removeItem(RSVP_LAST_TS_KEY);
}

async function postWebhook(record) {
  if (!WEBHOOK_URL) return false;
  try {
    // Apps Script Web Apps don't return CORS headers for POST,
    // so we fire-and-forget with mode: "no-cors". The submission
    // still reaches the script and gets appended to the sheet.
    await fetch(WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(record),
    });
    return true;
  } catch (err) {
    console.warn("[rsvp] webhook failed", err);
    return false;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Native validation first
  if (!form.checkValidity()) {
    setStatus("Барлық міндетті жолдарды толтырыңыз", "error");
    form.reportValidity();
    return;
  }

  const formData = new FormData(form);
  const names = formData.getAll("name")
    .map((n) => String(n || "").trim())
    .filter(Boolean);
  const record = {
    name:       names.join(", "),
    attending:  formData.get("attending") || "",
    guests:     names.length,
    wishes:     "",
    timestamp:  new Date().toISOString(),
    user_agent: navigator.userAgent,
  };

  submitBtn.disabled = true;
  setStatus("Жіберіліп жатыр…");

  // Always save locally first — survives any webhook failure
  saveLocal(record);

  // Then try the webhook (no-cors so we can't read the response)
  await postWebhook(record);

  if (record.attending === "yes") {
    setStatus("", "");
    localStorage.setItem(RSVP_CONFIRMED_KEY, "1");
    showConfirmedView();
  } else {
    setStatus("Рақмет жауабыңызға!", "success");
    form.reset();
  }

  // Keep the button disabled briefly to discourage double-submit
  setTimeout(() => { submitBtn.disabled = false; }, 1500);
});
