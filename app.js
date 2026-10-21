/* 상하이 여행 앱 — 홈(위젯) / 일정(그림 지도) / 기록 / 정산 / 더보기.
   Everything is stored on this phone first (localStorage + IndexedDB for photos);
   with a trip code, the shared parts are also kept in step with a friend's phone (see 친구랑 같이 쓰기). */
(function () {
  "use strict";

  /* ---------- small helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const isNum = (n) => /^\d+$/.test(String(n));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const amap = (q) => "https://uri.amap.com/search?keyword=" + encodeURIComponent(q) + "&city=021&view=map&callnative=1&src=shanghai-trip";
  const apple = (q) => "https://maps.apple.com/?daddr=" + encodeURIComponent(q) + "&dirflg=r";
  const withCity = (q) => (/상하이|上海/.test(q) ? q : q + " 상하이");
  const google = (q) => "https://www.google.com/search?hl=ko&q=" + encodeURIComponent(withCity(String(q || "").trim()));
  const WX_URL = "https://search.naver.com/search.naver?query=" + encodeURIComponent("상하이 날씨");
  const PAPAGO_WEB = "https://papago.naver.com/?sk=ko&tk=zh-CN";
  const PAPAGO_STORE = "itms-apps://apps.apple.com/app/id1147874819";
  const PAPAGO_SHORTCUT = "shortcuts://run-shortcut?name=" + encodeURIComponent("파파고");
  const PRI = { must: "꼭 가기", nice: "가면 좋음", maybe: "여유 있으면" };
  const STARS = { must: "★★★", nice: "★★", maybe: "★" };
  const EXT = ' target="_blank" rel="noopener"';
  function safeUrl(u) {
    u = String(u || "").trim();
    if (u && !/^[a-z]+:/i.test(u) && u.indexOf(".") > 0) u = "https://" + u;
    return /^https?:\/\/[^\s]+$/i.test(u) ? u : "";
  }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }

  /* ---------- icons (stroke, 24px box) ---------- */
  const I = (d, sw) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  const BED = '<path d="M3.5 18.5V6M3.5 14h17v4.5M20.5 14v-2.5a3 3 0 0 0-3-3h-7v5.5"/><circle cx="7" cy="10.8" r="1.8"/>';
  const ICON = {
    home: I('<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>'),
    map: I('<path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z"/><path d="M9 4.5v13M15 6.5v13"/>'),
    log: I('<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-5-5-8 8"/>'),
    money: I('<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 11.5h6"/>'),
    more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/></svg>',
    pen: I('<path d="M4.6 19.4l1-4.4L15.9 4.7a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L9 18.4z"/><path d="M14.2 6.4l3.4 3.4"/><path d="M12.6 19.6h6.8"/>', 1.7),
    check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.6),
    checkc: I('<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>'),
    skip: I('<path d="M5 6.5l6 5.5-6 5.5"/><path d="M12.5 6.5l6 5.5-6 5.5"/>', 2),
    nav: I('<path d="M4 11.5 20 4l-7.5 16-1.8-6.7z"/>', 1.9),
    taxi: I('<path d="M5 16V12.3L7 7.5h10l2 4.8V16"/><rect x="3.5" y="12" width="17" height="5" rx="1.5"/><path d="M7 19.5v-2.3M17 19.5v-2.3"/>'),
    pin: I('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
    chevL: I('<path d="m14.5 6-6 6 6 6"/>', 2),
    chevR: I('<path d="m9.5 6 6 6-6 6"/>', 2),
    minus: I('<path d="M6 12h12"/>', 3),
    rain: I('<path d="M7 15.5a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 15.5z"/><path d="M9 18.5l-1 2M13 18.5l-1 2M17 18.5l-1 2"/>', 1.6),
    cloud: I('<path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 18z"/>', 1.6),
    sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>', 1.6),
    snow: I('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>', 1.6),
    swap: I('<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>'),
    bed: I(BED),
    plane: I('<path d="M10.5 20.5 12.5 14 6 16l-1.5-1.5 6-4.5-1-6.5L11 3l3.5 6.5 5-1.5a1.5 1.5 0 0 1 1 2.8L15 13l-1.5 6z"/>'),
    planeF: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 15.5v-2l-7.5-4.5V4.2a1.5 1.5 0 0 0-3 0V9L3 13.5v2l7.5-2.3v5l-2.2 1.6V21l3.7-1 3.7 1v-1.2l-2.2-1.6v-5z"/></svg>',
    globe: I('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.6 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.6-3.5-8.5S9.5 6.1 12 3.5z"/>'),
    trans: I('<path d="M4 5.5h9M8.5 3.5v2M6 5.5c.6 3 2.6 5.6 5.5 7M11 5.5c-.8 3.6-3.4 6.6-7 8"/><path d="m12.5 20.5 4-9 4 9M14 17.5h5"/>'),
    camera: I('<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13.2" r="3.3"/>'),
    list: I('<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="m3.5 6.5 1.2 1.2L7 5.4M3.5 12l1.2 1.2L7 10.9M3.5 17.5l1.2 1.2L7 16.4"/>'),
    bag: I('<rect x="4" y="7.5" width="16" height="12.5" rx="2"/><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2"/>'),
    phone: I('<rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M11 17.5h2"/>'),
    info: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>'),
    note: I('<path d="M6 3.5h9l4 4v13H6z"/><path d="M14.5 3.5v4.5h4.5M9 12h7M9 15.5h5"/>'),
    eye: I('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
    moon: I('<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>'),
    grid: I('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'),
    users: I('<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.8a3 3 0 0 1 0 5.4M17.5 14a5 5 0 0 1 3 5"/>'),
    download: I('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'),
    undo: I('<path d="M8.5 6 4 10.5 8.5 15"/><path d="M4 10.5h10a6 6 0 0 1 0 12h-3"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>', 2.2),
    x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
    trash: I('<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/><path d="M10 11v6M14 11v6"/>'),
    clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    store: I('<path d="M5 8.5h14l-1 11H6z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>'),
    bolt: I('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>'),
    pass: I('<rect x="5" y="3.5" width="14" height="17" rx="2"/><circle cx="12" cy="10.5" r="3"/><path d="M9 16.5h6"/>'),
    card: I('<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10h17M7 14.5h3"/>'),
    heart: I('<path d="M12 20.2s-7.6-4.6-7.6-10.4A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.6 2.5c0 5.8-7.6 10.4-7.6 10.4z"/>'),
    plug: I('<path d="M9 3.5v4M15 3.5v4"/><path d="M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16v4.5"/>'),
    sync: I('<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M17.8 3.6v3.6h-3.6M6.2 20.4v-3.6h3.6"/>')
  };

  /* ---------- weather text ("비 🌧️ 23°/17°") → parts ---------- */
  const TEMP_RE = /(-?\d+)\s*°\s*\/\s*(-?\d+)\s*°/;
  function wxParse(w) {
    w = String(w || "");
    const tm = w.match(TEMP_RE);
    const c = w.replace(TEMP_RE, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").replace(/\s+/g, " ").trim();
    const kind = /눈/.test(c) ? "snow" : /비|소나기/.test(c) ? "rain" : /맑/.test(c) ? "sun" : "cloud";
    return { c, kind, hi: tm ? tm[1] : "", lo: tm ? tm[2] : "", t: tm ? tm[1] + "° / " + tm[2] + "°" : "" };
  }

  /* ---------- storage ---------- */
  const LS_STATE = "sht.state.v1", LS_UI = "sht.ui.v1";
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function seedById() {
    const m = {};
    (window.TRIP_SEED.days || []).forEach((d) => d.stops.forEach((s) => { m[s.id] = s; (s.spots || []).forEach((p) => { m[p.id] = p; }); }));
    return m;
  }
  function norm(d) {
    d = d || {};
    d.trip = d.trip || {}; d.hotel = d.hotel || {};
    d.flight = d.flight || {}; d.flight.legs = d.flight.legs || [];
    d.infos = d.infos || []; d.memos = d.memos || [];
    d.prep = d.prep || {}; ["todo", "pack", "links", "apps"].forEach((k) => { d.prep[k] = d.prep[k] || []; });
    d.settle = d.settle || {}; d.settle.members = d.settle.members || []; d.settle.expenses = d.settle.expenses || [];
    d.days = d.days || []; d.days.forEach((x) => { x.stops = x.stops || []; });
    d.done = d.done || {}; d.skip = d.skip || {}; d.journal = d.journal || {}; d.placePhotos = d.placePhotos || {};
    d.posts = d.posts || []; d.postPhotos = d.postPhotos || {}; d.likes = d.likes || {};
    /* 기록 used to be one text box + photos per day: each becomes that day's first post, with the same id on every phone */
    Object.keys(d.journal).forEach((dayId) => {
      const j = d.journal[dayId] || {}, ph = (j.photos || []).filter(Boolean);
      if (j.text || ph.length) {
        const id = "p-" + dayId, day = d.days.find((x) => x.id === dayId);
        let p = d.posts.find((x) => x.id === id);
        if (!p) { p = { id, day: dayId, at: day && day.iso ? Date.parse(day.iso + "T21:00:00+08:00") : 0, by: "", text: "" }; d.posts.push(p); }
        if (j.text && !p.text) p.text = j.text;
        if (ph.length) { d.postPhotos[id] = (d.postPhotos[id] || []).concat(ph); p.ph = d.postPhotos[id].length; }
      }
      delete d.journal[dayId];
    });
    /* things added after the first version: map points, short map labels, place photos */
    const seed = seedById();
    const fill = (it) => {
      const s = seed[it.id];
      if (!s) return;
      if (!it.ll && s.ll) it.ll = s.ll;
      if (it.far == null && s.far) it.far = true;
      if (!it.q && s.q) it.q = s.q;
      if (!it.label && s.label) it.label = s.label;
      if (it.img === undefined && s.img) { it.img = s.img; if (s.imgSrc) it.imgSrc = s.imgSrc; }
    };
    d.days.forEach((x) => x.stops.forEach((s) => { fill(s); (s.spots || []).forEach(fill); }));
    if (!d.hotel.ll && window.TRIP_SEED.hotel.ll && d.hotel.zh === window.TRIP_SEED.hotel.zh) d.hotel.ll = window.TRIP_SEED.hotel.ll;
    return d;
  }
  let state = norm(lsGet(LS_STATE) || clone(window.TRIP_SEED));
  const W_DEFAULT = ["weather", "hotel", "flight", "todo", "pack", "apps", "route"];
  const ui = Object.assign({ tab: "home", day: null, preview: "auto", open: {}, cur: "CNY", payer: "", theme: "time" }, lsGet(LS_UI) || {});
  ui.open = ui.open || {};
  function save() {
    state.savedAt = Date.now();
    if (!lsSet(LS_STATE, state)) toast("폰 저장 공간이 부족해서 저장하지 못했어요");
    onLocalChange();
  }
  function saveUI() { lsSet(LS_UI, ui); }
  /* 친구랑 같이 쓰기: which trip this phone follows + what it last agreed on with the server (stays on this phone) */
  const LS_SYNC = "sht.sync.v1";
  const sync = Object.assign({ code: "", me: "", cursor: null, base: {}, ts: {}, cfg: null, err: "", last: 0 }, lsGet(LS_SYNC) || {});
  sync.base = sync.base || {}; sync.ts = sync.ts || {}; sync.err = "";
  function saveSync() { lsSet(LS_SYNC, sync); }
  let syncT = 0, pushing = false, pushAgain = false, pulling = false, pullLater = false, lastToast = 0;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  /* ---------- 낮 / 밤 테마 ---------- */
  const mqDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const THEMES = [["time", "clock", "시간 따라"], ["system", "phone", "폰 설정 따라"], ["light", "sun", "항상 낮"], ["dark", "moon", "항상 밤"]];
  function wantDark() {
    const m = ui.theme || "time";
    if (m === "dark") return true;
    if (m === "light") return false;
    if (m === "system") return !!(mqDark && mqDark.matches);
    const h = new Date().getHours();
    return h >= 18 || h < 6;
  }
  const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";
  function applyTheme() {
    const t = wantDark() ? "dark" : "light", root = document.documentElement;
    if (root.getAttribute("data-theme") !== t) root.setAttribute("data-theme", t);
    const m = document.getElementById("themeColor");
    if (m) m.setAttribute("content", t === "dark" ? "#0A0E2E" : "#5AA9DE");
  }

  /* photos live in IndexedDB as shrunk JPEG blobs, keyed by id */
  const photoDB = (() => {
    let p;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open("sht-photos", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("p");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const run = (mode, fn) => open().then((db) => new Promise((res, rej) => {
      const t = db.transaction("p", mode), req = fn(t.objectStore("p"));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = t.onabort = () => rej(t.error);
    }));
    return {
      put: (k, v) => run("readwrite", (s) => s.put(v, k)),
      get: (k) => run("readonly", (s) => s.get(k)),
      del: (k) => run("readwrite", (s) => s.delete(k))
    };
  })();
  const urlCache = {};
  function photoUrl(id) {
    if (urlCache[id]) return Promise.resolve(urlCache[id]);
    return photoDB.get(id).then((b) => (b ? (urlCache[id] = URL.createObjectURL(b)) : ""));
  }
  function hydratePhotos(root) {
    root.querySelectorAll("img[data-pid]").forEach((img) => {
      photoUrl(img.getAttribute("data-pid")).then((u) => { if (u) img.src = u; }).catch(() => {});
    });
  }
  async function shrink(file, max) {
    max = max || 1600;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.82));
    } finally { URL.revokeObjectURL(url); }
  }
  /* a place's pictures: a web address (it.img) first, then photos added on this phone */
  function placeImgs(it) {
    const out = [];
    if (it && it.img) out.push({ u: it.img });
    ((it && state.placePhotos[it.id]) || []).forEach((p) => out.push({ p }));
    return out;
  }
  function imgHtml(x, cls, alt, onerr) {
    if (!x) return "";
    if (x.u) return '<img class="' + (cls || "") + '" src="' + esc(x.u) + '" alt="' + esc(alt || "") + '" loading="lazy" referrerpolicy="no-referrer" onerror="' + (onerr || "this.remove()") + '">';
    return '<img class="' + (cls || "") + '" data-pid="' + esc(x.p) + '" alt="' + esc(alt || "") + '">';
  }

  /* ---------- data helpers ---------- */
  const findDay = (id) => state.days.find((d) => d.id === id);
  function findItem(id) {
    for (const day of state.days) {
      for (let j = 0; j < day.stops.length; j++) {
        const st = day.stops[j];
        if (st.id === id) return { kind: "stop", day, list: day.stops, idx: j, item: st };
        const sp = st.spots || [];
        for (let k = 0; k < sp.length; k++) if (sp[k].id === id) return { kind: "spot", day, list: sp, idx: k, item: sp[k], parent: st };
      }
    }
    return null;
  }
  const placeOf = (it) => it && (it.q || it.zh);
  const visible = (day) => day.stops.filter((s) => s.pri !== "maybe");
  const countable = (st) => !!placeOf(st) && st.pri !== "maybe";
  const isDone = (id) => !!state.done[id];
  const isSkip = (id) => !state.done[id] && !!state.skip[id];
  function dayProgress(day) {
    const list = day.stops.filter(countable);
    return { list, n: list.length, done: list.filter((s) => isDone(s.id)).length, sk: list.filter((s) => isSkip(s.id)).length };
  }
  const nextOf = (day) => day && day.stops.filter(countable).find((s) => !isDone(s.id) && !isSkip(s.id));
  const dayC = (d) => "var(--" + ((d && d.color) || "d1") + ")";
  function hasPri(day) { return day.stops.some((s) => s.pri || (s.spots || []).some((p) => p.pri)); }
  const shortName = (n) => String(n || "").replace(/\s*\(.*?\)\s*/g, " ").trim();
  function mapLabel(it) {
    if (it.label) return it.label;
    const n = shortName(it.ko).replace(/^상하이\s*/, "").replace(/\s*국제공항.*$/, " 공항");
    return n.length > 9 ? n.slice(0, 8) + "…" : n;
  }

  function todayIso() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function phase() {
    const p = ui.preview || "auto", days = state.days;
    if (p === "before") return { k: "before" };
    if (p === "after") return { k: "after" };
    if (p !== "auto" && findDay(p)) return { k: "during", day: findDay(p) };
    const t = todayIso(), first = days[0] && days[0].iso, last = days.length ? days[days.length - 1].iso : "";
    if (!first || t < first) return { k: "before" };
    if (t > last) return { k: "after" };
    return { k: "during", day: days.find((d) => d.iso === t) || days.filter((d) => d.iso <= t).pop() || days[0] };
  }
  function ddayText() {
    const first = state.days[0] && state.days[0].iso;
    if (!first) return "";
    const n = Math.round((new Date(first + "T00:00:00") - new Date(todayIso() + "T00:00:00")) / 86400000);
    return n > 0 ? "D-" + n : n === 0 ? "D-DAY" : "D+" + -n;
  }
  function legShort(l) { return [l.no, [l.date, l.dep].filter(Boolean).join(" ")].filter(Boolean).join(" · "); }
  const AP = [[/김포/, "GMP"], [/인천/, "ICN"], [/홍차오|虹桥/, "SHA"], [/푸동|浦东/, "PVG"]];
  const apCode = (n) => { const a = AP.find((x) => x[0].test(n || "")); return a ? a[1] : String(n || "").slice(0, 3); };
  function hotelTimes(h) {
    const w = String(h.when || "");
    const a = w.match(/(\d{1,2}:\d{2})\s*체크인/) || w.match(/체크인\s*(\d{1,2}:\d{2})/);
    const b = w.match(/(\d{1,2}:\d{2})\s*체크아웃/) || w.match(/체크아웃\s*(\d{1,2}:\d{2})/);
    return { in: a ? a[1] : "", out: b ? b[1] : "" };
  }

  /* ---------- settle math (same rules as the trip page) ---------- */
  const wonFmt = (v) => "₩" + (Math.round(v / 10) * 10).toLocaleString("ko-KR");
  const yuanFmt = (v) => "¥" + (Math.round(v * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
  function settleCalc() {
    const S = state.settle, rate = +S.rate || 0, base = rate ? "KRW" : "CNY", ppl = S.members || [], paid = {};
    let total = 0, skipped = 0;
    ppl.forEach((p) => { paid[p] = 0; });
    S.expenses.forEach((e) => {
      let v = +e.amt || 0;
      if (base === "KRW") v = e.cur === "KRW" ? v : v * rate;
      else if (e.cur === "KRW") { skipped++; return; }
      total += v; paid[e.payer] = (paid[e.payer] || 0) + v;
    });
    const n = ppl.length, share = n ? total / n : 0, eps = base === "KRW" ? 5 : 0.05, debt = [], cred = [];
    ppl.forEach((p) => { const b = paid[p] - share; if (b < -eps) debt.push({ p, v: -b }); else if (b > eps) cred.push({ p, v: b }); });
    debt.sort((a, b) => b.v - a.v); cred.sort((a, b) => b.v - a.v);
    const xs = []; let i = 0, j = 0;
    while (i < debt.length && j < cred.length) {
      const m = Math.min(debt[i].v, cred[j].v);
      xs.push({ from: debt[i].p, to: cred[j].p, v: m });
      debt[i].v -= m; cred[j].v -= m;
      if (debt[i].v <= eps) i++;
      if (cred[j].v <= eps) j++;
    }
    return { base, rate, total, share, n, xs, skipped };
  }
  const money = (v, c) => (c.base === "KRW" ? wonFmt(v) + (c.rate ? "<small>" + yuanFmt(v / c.rate) + "</small>" : "") : yuanFmt(v));
  const totalFmt = (c) => (c.base === "KRW" ? wonFmt(c.total) : yuanFmt(c.total));

  /* ---------- shared bits of markup ---------- */
  const starsHtml = (p) => (p && STARS[p] ? '<span class="stars" role="img" aria-label="' + PRI[p] + '">' + STARS[p] + "</span>" : "");
  const tagsHtml = (it) => (it.tags || []).map((t) => '<span class="tag">' + esc(t) + "</span>").join("");
  function ckHtml(x, label, cls) {
    return '<label class="' + (cls || "ck") + (state.done[x.id] ? " on" : "") + '"><input type="checkbox" data-ck="' + x.id + '"' + (state.done[x.id] ? " checked" : "") + "><span>" + (label || esc(x.t)) + "</span></label>";
  }
  function field(name, label, value, o) {
    o = o || {};
    const a = ' name="' + name + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") + (o.zh ? ' class="zhin"' : "") + (o.mode ? ' inputmode="' + o.mode + '"' : "") + ' autocomplete="off"';
    const ctl = o.area ? "<textarea" + a + ">" + esc(value) + "</textarea>" : '<input type="' + (o.type || "text") + '"' + a + ' value="' + esc(value) + '">';
    return '<label class="field"><span>' + label + "</span>" + ctl + (o.hint ? '<span class="hint">' + o.hint + "</span>" : "") + "</label>";
  }
  function priSelect(v) {
    return '<label class="field"><span>우선순위</span><select name="pri">' +
      [["", "없음"], ["must", "★★★ 꼭 가기"], ["nice", "★★ 가면 좋음"], ["maybe", "★ 여유 있으면"]].map((o) => '<option value="' + o[0] + '"' + ((v || "") === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") +
      "</select></label>";
  }
  function ringSvg(v, n) {
    const C = 119.38, f = n ? Math.min(1, v / n) : 0;
    return '<svg class="ring" viewBox="0 0 46 46" role="img" aria-label="' + n + "곳 중 " + v + '곳 끝"><circle class="tr" cx="23" cy="23" r="19" fill="none" stroke-width="4"/>' +
      (f ? '<circle class="ar" cx="23" cy="23" r="19" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + (f * C).toFixed(1) + " " + C + '" transform="rotate(-90 23 23)"/>' : "") +
      '<text x="23" y="27" text-anchor="middle">' + v + "/" + n + "</text></svg>";
  }
  function fxHtml(pre) {
    const rate = +state.settle.rate || 0;
    if (!rate) return '<p class="note">정산 탭 \'인원 · 환율\'에 환율을 넣으면 바로 계산돼요</p>';
    return '<div class="calc fxpair"><label class="cin"><span>¥</span><input id="' + pre + 'Y" data-keep data-fx="y" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="위안"></label>' +
      '<span class="mono note" aria-hidden="true">=</span><label class="cin"><span>₩</span><input id="' + pre + 'W" data-keep data-fx="w" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="원"></label></div>';
  }

  /* ---------- page-header sky: 밤 = moon, gold sparkles, lit windows / 낮 = soft blue, faint sun ---------- */
  const spark = (x, y, r) => '<path class="tw" fill="#FFD36B" d="M' + x + " " + (y - r) + "Q" + (x + r * .18) + " " + (y - r * .18) + " " + (x + r) + " " + y + "Q" + (x + r * .18) + " " + (y + r * .18) + " " + x + " " + (y + r) +
    "Q" + (x - r * .18) + " " + (y + r * .18) + " " + (x - r) + " " + y + "Q" + (x - r * .18) + " " + (y - r * .18) + " " + x + " " + (y - r) + 'Z"/>';
  function skyArt(h, small) {
    const dy = h - 190;
    const dots = [[24, 30, 1], [70, 18, .8], [118, 44, 1.1], [160, 12, .7], [196, 34, 1], [252, 14, .8], [300, 18, .9], [366, 40, .8], [190, 80, .7], [52, 84, .8], [140, 104, .6], [18, 120, .7], [96, 132, .7], [228, 108, .6]].filter((s) => s[1] < h - 56);
    const gold = [[44, 50, 5.5], [150, 30, 4.2], [214, 72, 3.4], [338, 22, 4.6], [104, 100, 3.2], [380, 92, 3.4]].filter((s) => s[1] < h - 50);
    const win = [[225, 160], [233, 166], [247, 156], [304, 122], [314, 134], [309, 152], [345, 112], [352, 142], [358, 162], [377, 150], [365, 168], [228, 170]];
    return '<svg class="hart" viewBox="0 0 390 ' + h + '" preserveAspectRatio="' + (small ? "xMaxYMax meet" : "xMaxYMax slice") + '" aria-hidden="true"><defs>' +
      '<linearGradient id="bfade" gradientUnits="userSpaceOnUse" x1="0" y1="' + (60 + dy) + '" x2="0" y2="' + (190 + dy) + '"><stop class="bt" offset="0"/><stop class="bt" offset=".7"/><stop class="bb" offset="1"/></linearGradient>' +
      '<radialGradient id="hpearl" cx=".36" cy=".32" r=".75"><stop class="pp0" offset="0"/><stop class="pp1" offset=".4"/><stop class="pp2" offset=".8"/><stop class="pp3" offset="1"/></radialGradient>' +
      '<radialGradient id="pglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#E9A8FF" stop-opacity=".55"/><stop offset="1" stop-color="#E9A8FF" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="mglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE7A8" stop-opacity=".35"/><stop offset="1" stop-color="#FFE7A8" stop-opacity="0"/></radialGradient>' +
      '<mask id="moonm"><rect x="0" y="0" width="390" height="' + h + '" fill="#fff"/><circle cx="' + (small ? 327 : 243) + '" cy="' + (small ? 66 : 38) + '" r="' + (small ? 10.5 : 15) + '" fill="#000"/></mask></defs>' +
      '<radialGradient id="psun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset=".4" stop-color="#FFFFFF" stop-opacity=".18"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>' +
      '<g class="nt">' + dots.map((s, i) => '<circle class="' + (i % 2 ? "tw" : "") + '" fill="#FFFFFF" cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" opacity=".75"/>').join("") +
      gold.map((s) => spark(s[0], s[1], s[2])).join("") +
      (small ? '<circle cx="322" cy="70" r="30" fill="url(#mglow)"/><circle cx="322" cy="70" r="11.5" fill="#FFE7A8" mask="url(#moonm)"/>' : '<circle cx="236" cy="44" r="40" fill="url(#mglow)"/><circle cx="236" cy="44" r="16" fill="#FFE7A8" mask="url(#moonm)"/>') + "</g>" +
      '<g class="dy">' + (small ? '<circle class="sunglow" cx="322" cy="68" r="48" fill="url(#psun)"/><circle cx="322" cy="68" r="9.5" fill="#FFFFFF" opacity=".5"/>' + cloud(214, 120, .42, .75, 90) + cloud(64, 142, .34, .6, 110)
        : '<circle cx="236" cy="44" r="56" fill="url(#psun)"/><circle cx="236" cy="44" r="12" fill="#FFFFFF" opacity=".5"/>' + cloud(150, 40, .5, .7, 140)) + "</g>" +
      '<linearGradient id="skyf" gradientUnits="userSpaceOnUse" x1="0" y1="' + (h - 46) + '" x2="0" y2="' + h + '"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>' +
      '<mask id="skym"><rect width="390" height="' + h + '" fill="url(#skyf)"/></mask>' +
      '<g mask="url(#skym)"><g transform="' + (small ? "translate(" + f1(390 - 390 * .76) + " " + f1(h - 190 * .76) + ") scale(.76)" : "translate(0 " + dy + ")") + '">' +
      '<circle class="pgl" cx="280" cy="128" r="62" fill="url(#pglow)"/>' +
      '<path fill="url(#bfade)" d="M218 190V152h8v-12h8v50zM242 190v-40h8v40zM372 190v-48h10v48zM354 190v-36h12v36z"/>' +
      '<polygon fill="url(#bfade)" points="300,190 300,110 303,110 303,94 306,94 306,82 309,82 311,60 313,82 316,82 316,94 319,94 319,110 322,110 322,190"/>' +
      '<path fill="url(#bfade)" d="M338 190 L340 92 Q343 52 349 32 L353 37 Q358 62 361 92 L363 190 Z"/>' +
      '<path class="stkl" d="M270 186 L276 156 M290 186 L284 156 M280 186 L280 156" stroke-width="3"/>' +
      '<rect class="stkf" x="277.5" y="98" width="5" height="58"/><rect class="stkf" x="278.4" y="70" width="3.2" height="30"/><path class="stkl" d="M280 66 L280 44" stroke-width="1.6"/>' +
      '<circle cx="280" cy="43" r="1.8" fill="#FFD36B"/>' +
      '<g class="win">' + win.map((w) => '<rect x="' + w[0] + '" y="' + w[1] + '" width="2.2" height="2.2"/>').join("") + "</g>" +
      '<circle cx="280" cy="152" r="11" fill="url(#hpearl)"/><circle cx="280" cy="98" r="7.5" fill="url(#hpearl)"/><circle cx="280" cy="70" r="3.6" fill="url(#hpearl)"/>' +
      '<ellipse cx="276.5" cy="148" rx="3.6" ry="2.2" fill="#fff" opacity=".7" transform="rotate(-30 276.5 148)"/></g></g></svg>';
  }
  const pageHead = (title, sub, tight) => '<header class="phead' + (tight ? " tight" : "") + '">' + skyArt(tight ? 188 : 184, true) + "<h1>" + esc(title) + "</h1>" + (sub ? '<span class="sub">' + esc(sub) + "</span>" : "") + "</header>";

  /* ---------- the illustrated route map ---------- */
  /* rough centre lines of 황푸강 and 쑤저우강 (WGS-84), enough to place the day's stops */
  const RIVER = [[31.262, 121.535], [31.256, 121.52], [31.25, 121.505], [31.2455, 121.4965], [31.24, 121.4955], [31.234, 121.4985], [31.226, 121.501], [31.217, 121.5015], [31.209, 121.4975], [31.202, 121.489], [31.196, 121.4795], [31.19, 121.468], [31.183, 121.457], [31.172, 121.452], [31.16, 121.45]];
  const CREEK = [[31.2452, 121.495], [31.2448, 121.4905], [31.2441, 121.485], [31.2449, 121.479], [31.2468, 121.474], [31.2456, 121.468], [31.2432, 121.463], [31.244, 121.456], [31.242, 121.448], [31.243, 121.438]];
  function mapPts(day) {
    const ph = phase(), vis = visible(day), next = ph.k === "during" && ph.day === day ? nextOf(day) : null;
    return vis.map((st, i) => ({ it: st, n: i + 1, ll: st.ll, far: !!st.far, next: !!next && next.id === st.id, ok: isDone(st.id), sk: isSkip(st.id) })).filter((p) => p.ll && placeOf(p.it));
  }
  const f1 = (v) => Math.round(v * 10) / 10;
  function smooth(P, k) {
    if (P.length < 2) return "";
    k = k || 6;
    let d = "M" + f1(P[0][0]) + " " + f1(P[0][1]);
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      d += "C" + f1(p1[0] + (p2[0] - p0[0]) / k) + " " + f1(p1[1] + (p2[1] - p0[1]) / k) + " " + f1(p2[0] - (p3[0] - p1[0]) / k) + " " + f1(p2[1] - (p3[1] - p1[1]) / k) + " " + f1(p2[0]) + " " + f1(p2[1]);
    }
    return d;
  }
  let mctx = null;
  function textW(t) {
    try {
      mctx = mctx || document.createElement("canvas").getContext("2d");
      mctx.font = "600 12px 'IBM Plex Sans KR', 'Apple SD Gothic Neo', sans-serif";
      return mctx.measureText(t).width;
    } catch (e) { return t.length * 12; }
  }
  function routeMap(day, W, H, o) {
    o = o || {};
    const mini = !!o.mini, uid = o.uid || "m";
    const pts = mapPts(day), near = pts.filter((p) => !p.far);
    const hLL = state.hotel.ll, hotelIn = day.stops.some((s) => s.zh && s.zh === state.hotel.zh);
    const ctx = near.length < 2 && hLL && !hotelIn ? hLL : null;
    const bpts = near.map((p) => p.ll).concat(ctx ? [ctx] : []);
    let s = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid slice" class="' + (mini ? "mini" : "") + '" aria-hidden="' + (mini ? "true" : "false") + '">' +
      '<defs><pattern id="dots' + uid + '" width="18" height="18" patternUnits="userSpaceOnUse"><circle class="rm-dot" cx="2" cy="2" r="1.3"/></pattern>' +
      '<radialGradient id="blob' + uid + '"><stop offset="0" class="rm-bs1"/><stop offset="1" class="rm-bs2"/></radialGradient></defs>' +
      '<rect class="rm-bg" width="' + W + '" height="' + H + '"/><rect width="' + W + '" height="' + H + '" fill="url(#dots' + uid + ')"/>' +
      '<circle cx="' + f1(W * .12) + '" cy="' + f1(H * .38) + '" r="' + f1(W * .42) + '" fill="url(#blob' + uid + ')"/><circle cx="' + f1(W * .9) + '" cy="' + f1(H * .8) + '" r="' + f1(W * .46) + '" fill="url(#blob' + uid + ')"/>';
    if (!bpts.length) return s + "</svg>";
    const kx = Math.cos(31.22 * Math.PI / 180);
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    bpts.forEach((p) => { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); });
    const pT = o.padT || 30, pB = o.padB || 30, pL = o.padL || 30, pR = o.padR || 30;
    const sx = Math.max((d - c) * kx, 0.012), sy = Math.max(b - a, 0.012);
    const sc = Math.min((W - pL - pR) / sx, (H - pT - pB) / sy);
    const X0 = pL + (W - pL - pR) / 2, Y0 = pT + (H - pT - pB) / 2, cy = (a + b) / 2, cx = (c + d) / 2;
    const P = (ll) => [X0 + (ll[1] - cx) * kx * sc, Y0 - (ll[0] - cy) * sc];
    const inView = (q, m) => q[0] > -m && q[0] < W + m && q[1] > -m && q[1] < H + m;
    /* rivers */
    const rv = RIVER.map(P), rw = Math.max(10, Math.min(70, 0.0036 * sc)), cr = CREEK.map(P), cw = Math.max(4, Math.min(22, 0.001 * sc));
    const rd = smooth(rv), cd = smooth(cr);
    s += '<path class="rm-river2" d="' + cd + '" stroke-width="' + f1(cw + 4) + '" opacity=".6"/><path class="rm-river" d="' + cd + '" stroke-width="' + f1(cw) + '"/>' +
      '<path class="rm-river2" d="' + rd + '" stroke-width="' + f1(rw + 8) + '" opacity=".55"/><path class="rm-river" d="' + rd + '" stroke-width="' + f1(rw) + '"/>' +
      (mini ? "" : '<path class="rm-riverhi" d="' + rd + '" stroke-width="' + f1(Math.max(2, rw * .16)) + '"/>');
    const pinXY = near.map((p) => P(p.ll));
    if (!mini) {
      /* river name, laid along the water where it shows */
      const okR = rv.map((q, i) => ({ q, i })).filter((x) => x.q[0] > 40 && x.q[0] < W - 40 && x.q[1] > pT + 20 && x.q[1] < H - pB - 10 && pinXY.every((p) => Math.hypot(p[0] - x.q[0], p[1] - x.q[1]) > 46));
      if (okR.length) {
        const m = okR[Math.floor(okR.length / 2)], i = m.i, pa = rv[Math.max(0, i - 1)], pb = rv[Math.min(rv.length - 1, i + 1)];
        let ang = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) * 180 / Math.PI;
        if (ang > 90) ang -= 180;
        if (ang < -90) ang += 180;
        s += '<text class="rm-rlabel" text-anchor="middle" transform="translate(' + f1(m.q[0]) + " " + f1(m.q[1] + 4) + ") rotate(" + f1(ang) + ')">황푸강</text>';
      }
      const pd = P([31.2355, 121.5095]);
      if (pd[0] > 50 && pd[0] < W - 50 && pd[1] > pT + 30 && pd[1] < H - pB - 20 && pinXY.every((p) => Math.hypot(p[0] - pd[0], p[1] - pd[1]) > 70)) s += '<text class="rm-district" text-anchor="middle" x="' + f1(pd[0]) + '" y="' + f1(pd[1]) + '">푸동</text>';
    }
    /* route */
    if (ctx && near.length) {
      const h0 = P(ctx), p0 = pinXY[0];
      s += '<path class="rm-ctx" d="M' + f1(h0[0]) + " " + f1(h0[1]) + " Q" + f1((h0[0] + p0[0]) / 2) + " " + f1(Math.min(h0[1], p0[1]) - 40) + " " + f1(p0[0]) + " " + f1(p0[1]) + '"/>';
    }
    if (pinXY.length > 1) {
      const rd2 = smooth(pinXY, 7);
      s += '<path class="rm-glow" d="' + rd2 + '" stroke-width="' + (mini ? 7 : 12) + '"/><path class="rm-route' + (mini ? "" : " anim") + '" d="' + rd2 + '"' + (mini ? ' style="stroke-width:2.4;stroke-dasharray:1 5"' : "") + "/>";
      if (!mini) {
        for (let i = 0; i < pinXY.length - 1; i++) {
          const p1 = pinXY[i], p2 = pinXY[i + 1], len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
          if (len < 70) continue;
          const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI;
          s += '<path class="rm-arrow" d="M-4 -5 L2 0 L-4 5" transform="translate(' + f1((p1[0] + p2[0]) / 2) + " " + f1((p1[1] + p2[1]) / 2) + ") rotate(" + f1(ang) + ')"/>';
        }
      }
    }
    /* labels next to the pins, nudged so they don't sit on each other */
    const R = mini ? 6.5 : 13;
    const showHotel = hLL && !hotelIn && inView(P(hLL), -10);
    const hXY = showHotel ? P(hLL) : null;
    if (!mini) {
      const boxes = [], items = near.map((p, i) => ({ x: pinXY[i][0], y: pinXY[i][1], t: mapLabel(p.it), id: p.it.id, dim: p.ok || p.sk, r: p.next ? R + 2 : R }));
      if (hXY) items.push({ x: hXY[0], y: hXY[1], t: "숙소", id: "", hotel: true, r: R });
      const obst = items.map((it) => [it.x - it.r - 2, it.y - it.r - 2, it.x + it.r + 2, it.y + it.r + 2]).concat([[W - 84, pT - 6, W, pT + 62]]);
      const over = (r) => boxes.concat(obst).reduce((a, q) => a + Math.max(0, Math.min(r[2], q[2]) - Math.max(r[0], q[0])) * Math.max(0, Math.min(r[3], q[3]) - Math.max(r[1], q[1])), 0);
      const hit = (r) => boxes.concat(obst).some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
      const inside = (r) => r[0] > 4 && r[2] < W - 4 && r[1] > pT - 26 && r[3] < H - pB + 30;
      let lab = "";
      items.forEach((it) => {
        const w = Math.ceil(textW(it.t)) + 18, hh = 23, g = it.r + 5;
        const cand = [[it.x + g, it.y - hh / 2], [it.x - g - w, it.y - hh / 2], [it.x - w / 2, it.y - g - hh], [it.x - w / 2, it.y + g],
          [it.x + g - 4, it.y - hh - 6], [it.x - g - w + 4, it.y - hh - 6], [it.x + g - 4, it.y + 6], [it.x - g - w + 4, it.y + 6],
          [it.x + g + 22, it.y - hh / 2], [it.x - g - w - 22, it.y - hh / 2], [it.x - w / 2, it.y - g - hh - 20], [it.x - w / 2, it.y + g + 20],
          [it.x + g + 14, it.y - hh - 20], [it.x - g - w - 14, it.y - hh - 20], [it.x + g + 14, it.y + 20], [it.x - g - w - 14, it.y + 20]];
        let pick = null;
        for (const q of cand) { const r = [q[0], q[1], q[0] + w, q[1] + hh]; if (inside(r) && !hit(r)) { pick = r; break; } }
        if (!pick) { let best = Infinity; for (const q of cand) { const r = [q[0], q[1], q[0] + w, q[1] + hh]; if (!inside(r)) continue; const o = over(r); if (o < best) { best = o; pick = r; } } }
        if (!pick) return;
        boxes.push(pick);
        lab += '<g class="rm-lab' + (it.dim ? " dim" : "") + '"' + (it.hotel ? ' data-act="hotel"' : ' data-act="detail" data-id="' + it.id + '"') + ' style="cursor:pointer"><rect x="' + f1(pick[0]) + '" y="' + f1(pick[1]) + '" width="' + w + '" height="' + hh + '" rx="11.5"/>' +
          '<text x="' + f1(pick[0] + 9) + '" y="' + f1(pick[1] + 15.5) + '">' + esc(it.t) + "</text></g>";
      });
      s += lab;
    }
    /* pins */
    if (hXY) {
      s += '<g class="rm-pin rm-hotel" data-act="hotel" transform="translate(' + f1(hXY[0]) + " " + f1(hXY[1]) + ')"><circle class="sh" r="' + (R + 2) + '" cy="3"/><circle class="c" r="' + R + '"/>' +
        (mini ? "" : '<svg x="-8" y="-8" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + BED + "</svg>") + "</g>";
    }
    near.forEach((p, i) => {
      const q = pinXY[i], r = p.next ? R + 2 : R, cls = p.next ? " ac" : p.ok ? " ok" : p.sk ? " sk" : "";
      s += '<g class="rm-pin' + cls + '" data-act="detail" data-id="' + p.it.id + '" style="--c:' + dayC(day) + '" transform="translate(' + f1(q[0]) + " " + f1(q[1]) + ')">' +
        (p.next && !mini ? '<circle class="pulse" r="' + r + '"/>' : "") + '<circle class="sh" r="' + (r + 2) + '" cy="3"/><circle class="c" r="' + r + '"/>' +
        (mini ? "" : p.ok ? '<path d="M-5 .5 L-1.5 4 L5 -3.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : '<text class="n" y="4.3">' + p.n + "</text>") + "</g>";
    });
    if (!mini) {
      /* little compass + scale bar */
      const steps = [100, 200, 500, 1000, 2000, 5000, 10000], pxPerM = sc / 111320;
      const m = steps.find((v) => v * pxPerM >= 46) || 10000, len = m * pxPerM, x2 = W - 18, yC = pT + 12;
      s += '<g class="rm-compass" transform="translate(' + (W - 26) + " " + yC + ')"><path d="M0 -10 L4.5 3 L0 0.5 L-4.5 3Z"/><text y="15">N</text></g>' +
        '<g class="rm-scale"><path d="M' + f1(x2 - len) + " " + (yC + 34) + " v-4 M" + f1(x2 - len) + " " + (yC + 32) + " H" + x2 + " M" + x2 + " " + (yC + 34) + ' v-4"/>' +
        '<text x="' + x2 + '" y="' + (yC + 46) + '" text-anchor="end">' + (m >= 1000 ? m / 1000 + "km" : m + "m") + "</text></g>";
    }
    return s + "</svg>";
  }
  /* size the map so the list under it ends on a clean row line right at the tab bar */
  function fitPlan() {
    const mw = $(".mapwrap"), bar = $(".tabbar");
    if (!mw || !bar) return;
    mw.style.height = "";
    const H = window.innerHeight, cur = mw.getBoundingClientRect().height, sy = window.scrollY;
    const want = bar.getBoundingClientRect().top + sy;
    const minH = Math.round(H * 0.48), maxH = Math.round(H * 0.62);
    const edges = Array.from(view.querySelectorAll(".plist .swipe")).map((el) => el.getBoundingClientRect().bottom + sy).sort((a, b) => a - b);
    let pick = null;
    for (const e of edges) { const h = cur - (e - want); if (h >= minH) pick = Math.min(h, maxH); }
    if (pick != null && Math.abs(pick - cur) > 1) mw.style.height = Math.round(pick) + "px";
  }
  function drawMap() {
    const el = document.getElementById("map");
    if (!el) return;
    const day = planDay(), bar = $(".daybar"), r = el.getBoundingClientRect();
    const padT = bar ? Math.max(84, bar.getBoundingClientRect().bottom - r.top + 40) : 104;
    el.innerHTML = routeMap(day, Math.round(r.width), Math.round(r.height), { padT, padB: 78, padL: 40, padR: 40, uid: "p" });
  }

  /* ---------- HOME: full-screen night view + widgets below ---------- */
  const WDEF = {
    weather: { name: "날씨", desc: "최고 · 최저 기온", icon: "cloud", size: "half" },
    hotel: { name: "숙소", desc: "체크인 · 체크아웃 시간", icon: "bed", size: "half" },
    flight: { name: "항공편", desc: "가는 편 · 오는 편 탑승권", icon: "plane", size: "wide" },
    todo: { name: "출발 전 할 일", desc: "체크리스트", icon: "list", size: "big" },
    pack: { name: "필수 준비물", desc: "짐 체크리스트", icon: "bag", size: "big" },
    apps: { name: "필수 앱", desc: "깔아 둘 앱 체크", icon: "phone", size: "half" },
    route: { name: "오늘 동선", desc: "갈 곳을 작은 지도로", icon: "map", size: "half" },
    settle: { name: "N빵 정산", desc: "총 지출 · 보낼 돈", icon: "money", size: "half" },
    fx: { name: "환율 계산", desc: "위안 ↔ 원 바로 계산", icon: "swap", size: "half" },
    photos: { name: "오늘 사진", desc: "사진 바로 올리기", icon: "camera", size: "half" },
    memo: { name: "메모", desc: "최근 메모 한 장", icon: "note", size: "half" }
  };
  const CK_TITLE = { todo: "출발 전 할 일", pack: "필수 준비물", apps: "필수 앱" };
  function widgetList() {
    const w = Array.isArray(ui.widgets) ? ui.widgets.filter((x, i, a) => WDEF[x] && a.indexOf(x) === i) : W_DEFAULT.slice();
    ui.widgets = w;
    return w;
  }
  let editing = false;
  const heroIdx = {};
  function homeCtx() {
    const ph = phase(), days = state.days;
    const day = ph.k === "during" ? ph.day : ph.k === "after" ? days[days.length - 1] : days[0];
    return { ph, day };
  }
  /* the view behind the home screen: Lujiazui skyline over the river. One drawing for both themes —
     밤: stars, moon, lit windows / 낮: blue sky blushing pink-peach at the horizon, a soft sun, drifting clouds. Colours come from CSS (.hero-art …). */
  /* a soft cloud; with dur it drifts across the whole sky (starting where it is drawn) and loops */
  function cloud(x, y, s, o, dur, w) {
    let mv = "";
    if (dur) {
      const m = 60 * s + 30, W = w || 390, span = W + 2 * m, p = (x + m) / span;
      mv = ' data-dur="' + dur + '" data-ph="' + f1(p * dur) + '" style="--a:' + f1(-(x + m)) + "px;--b:" + f1(W - x + m) + "px;animation-duration:" + dur + "s;animation-delay:" + f1(-p * dur) + 's"';
    }
    return '<g class="cl' + (dur ? " mv" : "") + '"' + mv + ' transform="translate(' + x + " " + y + ") scale(" + s + ')" opacity="' + o + '">' +
      '<path d="M-44 0 Q-46 -12 -32 -14 Q-30 -30 -12 -28 Q-2 -44 18 -36 Q34 -40 38 -24 Q52 -22 50 -8 Q54 0 44 2 L-38 2 Q-46 2 -44 0 Z"/></g>';
  }
  let heroSvg = "";
  function heroArt() {
    if (heroSvg) return heroSvg;
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    let stars = "";
    for (let i = 0; i < 46; i++) {
      const x = f1(rnd() * 390), y = f1(rnd() * 400), r = f1(0.5 + rnd() * 1.1);
      stars += '<circle class="' + (i % 3 ? "" : "tw") + '" cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#fff" opacity="' + f1(0.35 + rnd() * 0.55) + '"/>';
    }
    const gold = [[46, 128, 6], [128, 70, 4.4], [92, 236, 3.4], [232, 54, 4], [356, 214, 4.6], [176, 168, 3], [24, 300, 3.2], [270, 338, 3]].map((g) => spark(g[0], g[1], g[2])).join("");
    let far = "", x = -6;
    while (x < 396) {
      const w = 12 + Math.floor(rnd() * 16), h = 26 + Math.floor(rnd() * 64);
      far += '<rect x="' + x + '" y="' + (470 - h) + '" width="' + (w - 2) + '" height="' + h + '"/>';
      x += w;
    }
    const blocks = [[0, 404, 26], [24, 420, 20], [42, 380, 22], [62, 410, 18], [80, 392, 24], [102, 424, 18], [118, 400, 22], [138, 430, 16], [228, 418, 18], [342, 408, 20], [360, 380, 18], [376, 420, 16]];
    let near = "", wins = "";
    blocks.forEach((b) => {
      near += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + (470 - b[1]) + '"/>';
      for (let yy = b[1] + 8; yy < 462; yy += 9) for (let xx = b[0] + 4; xx < b[0] + b[2] - 3; xx += 6) if (rnd() < 0.3) wins += '<rect x="' + xx + '" y="' + yy + '" width="2" height="2.6"/>';
    });
    let shim = "";
    for (let i = 0; i < 46; i++) {
      const cx = rnd() * 390, y = 480 + rnd() * 240, w = 6 + rnd() * 34;
      const near1 = Math.abs(cx - 196) < 40 ? "#FFB8E6" : Math.abs(cx - 300) < 30 || Math.abs(cx - 336) < 20 ? "#FFD68A" : "#B7A9FF";
      shim += '<rect class="' + (i % 4 ? "" : "tw") + '" x="' + f1(cx - w / 2) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="1.6" rx=".8" fill="' + near1 + '" opacity="' + f1(0.18 + rnd() * 0.45) + '"/>';
    }
    heroSvg = '<svg class="hero-art" viewBox="0 0 390 760" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>' +
      '<linearGradient id="hs" x1="0" y1="0" x2="0" y2="1"><stop class="hs0" offset="0"/><stop class="hs1" offset=".3"/><stop class="hs2" offset=".5"/><stop class="hs3" offset=".62"/></linearGradient>' +
      '<linearGradient id="hsd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5AA9DE"/><stop offset="0.05" stop-color="#64AFE1"/><stop offset="0.1" stop-color="#6EB5E4"/><stop offset="0.15" stop-color="#77BBE8"/><stop offset="0.2" stop-color="#80C1EB"/><stop offset="0.25" stop-color="#8AC6ED"/><stop offset="0.3" stop-color="#94CBEF"/><stop offset="0.35" stop-color="#9DD0F1"/><stop offset="0.4" stop-color="#A7D5F2"/><stop offset="0.45" stop-color="#B0DAF4"/><stop offset="0.5" stop-color="#BADDF5"/><stop offset="0.55" stop-color="#C4E0F5"/><stop offset="0.6" stop-color="#CEE3F6"/><stop offset="0.65" stop-color="#D7E4F5"/><stop offset="0.7" stop-color="#E0E3F3"/><stop offset="0.75" stop-color="#E8E3F1"/><stop offset="0.8" stop-color="#EFE3EE"/><stop offset="0.85" stop-color="#F5E2EA"/><stop offset="0.9" stop-color="#F9E3E7"/><stop offset="0.95" stop-color="#FCE7E6"/><stop offset="1" stop-color="#FFEAE4"/></linearGradient>' +
      '<linearGradient id="hwd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCDDF0"/><stop offset=".22" stop-color="#BCD6F0"/><stop offset="1" stop-color="#94C0E6"/></linearGradient>' +
      '<linearGradient id="clg" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FBE3EB"/></linearGradient>' +
      '<linearGradient id="hw" x1="0" y1="0" x2="0" y2="1"><stop class="hw0" offset="0"/><stop class="hw1" offset=".35"/><stop class="hw2" offset="1"/></linearGradient>' +
      '<radialGradient id="hglow" cx=".5" cy=".5" r=".5"><stop class="hg" offset="0" stop-opacity=".5"/><stop class="hg" offset="1" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="hm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE7A8" stop-opacity=".32"/><stop offset="1" stop-color="#FFE7A8" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="hhaze" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF6F0" stop-opacity=".7"/><stop offset=".35" stop-color="#FFF3EE" stop-opacity=".38"/><stop offset=".7" stop-color="#FFF1EE" stop-opacity=".12"/><stop offset="1" stop-color="#FFF1EE" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="hsun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset=".4" stop-color="#FFFFFF" stop-opacity=".18"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="hp" cx=".36" cy=".32" r=".75"><stop class="hp0" offset="0"/><stop class="hp1" offset=".38"/><stop class="hp2" offset=".78"/><stop class="hp3" offset="1"/></radialGradient>' +
      '<linearGradient id="hb" x1="0" y1="0" x2="0" y2="1"><stop class="hb0" offset="0"/><stop class="hb1" offset="1"/></linearGradient>' +
      '<linearGradient id="hr" x1="0" y1="0" x2="0" y2="1"><stop class="hr" offset="0" stop-opacity=".5"/><stop class="hr" offset="1" stop-opacity="0"/></linearGradient>' +
      '<mask id="hmm"><rect width="390" height="760" fill="#fff"/><circle cx="363" cy="231" r="12.5" fill="#000"/></mask></defs>' +
      '<rect width="390" height="480" fill="url(#hs)"/><rect class="dy" width="390" height="480" fill="url(#hsd)"/>' +
      '<g class="nt">' + stars + gold + '<circle cx="356" cy="238" r="44" fill="url(#hm)"/><circle cx="356" cy="238" r="14" fill="#FFE7A8" mask="url(#hmm)"/></g>' +
      '<g class="dy"><circle class="sunglow" cx="352" cy="232" r="76" fill="url(#hsun)"/><circle cx="352" cy="232" r="12" fill="#FFFFFF" opacity=".55"/>' +
      cloud(330, 40, .5, .5, 140) + cloud(64, 262, .9, .75, 105) + cloud(206, 236, .5, .55, 125) + cloud(286, 316, .72, .65, 115) + cloud(130, 352, .58, .6, 98) + cloud(40, 304, .45, .5, 132) +
      '<ellipse cx="195" cy="476" rx="350" ry="125" fill="url(#hhaze)"/></g>' +
      '<ellipse cx="200" cy="470" rx="280" ry="110" fill="url(#hglow)"/>' +
      '<g class="far">' + far + "</g>" +
      '<rect y="470" width="390" height="290" fill="url(#hw)"/><rect class="dy" y="470" width="390" height="290" fill="url(#hwd)"/>' +
      '<g fill="url(#hb)">' + near +
      '<path d="M284 470 L287 330 Q290 280 302 246 L306 250 Q314 290 316 330 L318 470 Z"/>' +
      '<path fill-rule="evenodd" d="M248 470 L250 296 L272 282 L274 470 Z M254 297 L269 290 L269 306 L254 311 Z"/>' +
      '<polygon points="326,470 326,370 329,370 329,350 332,350 332,334 335,334 337,300 339,334 342,334 342,350 345,350 345,370 348,370 348,470"/>' +
      '<path class="hbs" d="M174 470 L190 426 M218 470 L202 426 M196 470 L196 426" stroke-width="7" stroke-linecap="round"/>' +
      '<rect x="191" y="300" width="10" height="122"/><rect x="193" y="228" width="6" height="74"/></g>' +
      '<path class="ant" d="M196 226 L196 158" stroke-width="2.4"/><circle cx="196" cy="156" r="2.4" fill="#FFD36B"/>' +
      '<g class="win">' + wins + '<rect x="300" y="300" width="2" height="2.6"/><rect x="305" y="340" width="2" height="2.6"/><rect x="298" y="380" width="2" height="2.6"/><rect x="309" y="410" width="2" height="2.6"/><rect x="262" y="330" width="2" height="2.6"/><rect x="258" y="380" width="2" height="2.6"/><rect x="266" y="420" width="2" height="2.6"/><rect x="336" y="390" width="2" height="2.6"/><rect x="340" y="430" width="2" height="2.6"/></g>' +
      '<g class="pglow"><circle cx="196" cy="420" r="46" fill="url(#hglow)"/><circle cx="196" cy="300" r="30" fill="url(#hglow)"/></g>' +
      '<circle cx="196" cy="420" r="22" fill="url(#hp)"/><circle cx="196" cy="300" r="15" fill="url(#hp)"/><circle cx="196" cy="228" r="7.5" fill="url(#hp)"/>' +
      '<ellipse cx="189" cy="412" rx="7" ry="4.2" fill="#fff" opacity=".7" transform="rotate(-30 189 412)"/><ellipse cx="191" cy="294" rx="4.6" ry="2.8" fill="#fff" opacity=".7" transform="rotate(-30 191 294)"/>' +
      '<rect x="174" y="474" width="44" height="150" fill="url(#hr)" opacity=".55"/>' +
      '<g class="shim">' + shim + "</g>" +
      '<path class="hzl" d="M0 476 H390" stroke-width="1"/></svg>';
    return heroSvg;
  }
  function placeCard(st, i, list, day, nextId) {
    const q = placeOf(st), th = placeImgs(st)[0], done = isDone(st.id), sk = isSkip(st.id), nx = st.id === nextId;
    const n = visible(day).indexOf(st) + 1;
    const lbl = nx ? '<span class="pc-tag on">다음 갈 곳</span>' : done ? '<span class="pc-tag">다녀옴 ✓</span>' : sk ? '<span class="pc-tag">건너뜀</span>' : '<span class="pc-tag">' + (nextId && list.findIndex((x) => x.id === nextId) > i ? "지나온 곳" : "이따 갈 곳") + "</span>";
    const info = st.memo || st.desc || st.hours || "";
    /* same slots on every card: picture (or drawn stand-in), name + zh, one note line, buttons */
    return '<div class="hc-slide"><article class="pc' + (done || sk ? " dim" : "") + '" data-act="detail" data-id="' + st.id + '" style="--c:' + dayC(day) + '">' +
      '<div class="pc-ph"><div class="pc-ph0" aria-hidden="true"><i></i><i></i><b>' + n + "</b></div>" + (th ? imgHtml(th, "", st.ko, "this.remove()") : "") + "</div>" +
      '<div class="pc-b"><div class="pc-top">' + lbl + '<span class="pc-r">' + starsHtml(st.pri) + '<span class="mono pc-n">' + (i + 1) + " / " + list.length + "</span></span></div>" +
      '<div class="pc-row"><span class="numdot">' + (done ? ICON.check : n) + '</span><div class="pc-t">' +
      '<a class="wn-name" href="' + google(st.ko) + '"' + EXT + "><span>" + esc(st.ko) + '</span><span class="ext" aria-label="구글 검색">↗</span></a>' +
      '<span class="zhs">' + esc(st.zh || " ") + "</span></div></div>" +
      '<div class="pc-info">' + tagsHtml(st) + (info ? "<span>" + esc(info) + "</span>" : "") + "</div>" +
      '<div class="acts3">' + (q ? '<a class="btn primary" href="' + amap(q) + '"' + EXT + ">" + ICON.map + "고덕지도</a>" +
        '<a class="btn" href="' + apple(q) + '"' + EXT + '><span class="ic">' + ICON.nav + "</span>길찾기</a>" +
        '<button class="btn" type="button" data-act="taxi" data-id="' + st.id + '"><span class="ic">' + ICON.taxi + "</span>택시</button>" : "") + "</div>" +
      "</div></article></div>";
  }
  /* airport names in the trip data → the 3-letter codes on a boarding pass */
  function iata(name) {
    const n = String(name || "");
    return /김포|金浦/.test(n) ? "GMP" : /홍차오|虹桥/.test(n) ? "SHA" : /푸동|浦东/.test(n) ? "PVG" : /인천|仁川/.test(n) ? "ICN" : n.slice(0, 3).toUpperCase();
  }
  /* 여행 한눈에: both flights, the hotel, then each day with its places as chips (꼭 가기 first) */
  function tripSumSheet() {
    const legs = state.flight.legs, h = state.hotel, t = state.trip;
    const leg = (l) => '<div class="ts-leg"><small>' + esc((l.label || "") + " · " + (l.date || "")) + '</small><b class="mono">' + esc(iata(l.from) + " " + (l.dep || "")) + "</b><em>→ " + esc(iata(l.to) + " " + (l.arr || "")) + "</em></div>";
    const days = state.days.map((d) => {
      const w = wxParse(d.wx), list = visible(d).filter((x) => !/공항|체크인|체크아웃/.test(x.ko || "") || d.stops.length <= 2);
      const sorted = list.filter((x) => x.pri === "must").concat(list.filter((x) => x.pri !== "must"));
      const chips = sorted.slice(0, 5).map((x) => '<span class="' + (x.pri === "must" ? "m" : "") + '">' + (x.pri === "must" ? "★ " : "") + esc(x.label || shortName(x.ko)) + "</span>").join("") + (sorted.length > 5 ? "<span>+" + (sorted.length - 5) + "</span>" : "");
      return '<button class="ts-day" type="button" data-act="go-plan" data-day="' + d.id + '" style="--c:' + dayC(d) + '"><span class="ts-n">' + esc(d.n) + '</span><span class="ts-dt mono">' + esc(d.date) + (w.hi ? '<i>' + ICON[w.kind] + esc(w.hi) + "°</i>" : "") + '</span><b class="ts-tt">' + esc(d.title) + '</b><span class="ts-go" aria-hidden="true">›</span>' +
        (chips ? '<span class="tchips">' + chips + "</span>" : "") + "</button>";
    }).join("");
    openSheet({
      key: "tripsum", title: (t.title || "여행") + " " + (t.nights || "") + " 한눈에",
      body: '<div class="ts-legs">' + legs.map(leg).join("") + "</div>" +
        (h.name ? '<div class="ts-hotel"><small>숙소' + (t.nights ? " · " + esc(String(t.nights).split(" ")[0]) : "") + "</small>" + esc(shortName(h.name)) + (h.note ? " · " + esc(h.note.replace(/\s*\(.*?\)\s*/g, " ")) : "") + "</div>" : "") + days
    });
  }
  /* 여행 전: after the D-day card, swipe through '가기 전에 알아둘 것' — big numbers, one highlighted line, a note, source chips */
  function briefCard(c) {
    const B = window.TRIP_BRIEF || {}, legs = state.flight.legs, l0 = legs[0] || {}, l1 = legs[1] || {};
    let tiles = c.tiles || [], wide = c.wide, note = c.note || "", links = c.links || [];
    const cut = (s) => String(s || "").split("·").pop().replace(/마감/, "").trim();
    if (c.id === "airport") {
      tiles = [{ k: "가는 날 체크인 마감", v: cut(l0.checkin) || "—", u: l0.from || "" }, { k: "오는 날 체크인 마감", v: cut(l1.checkin) || "—", u: l1.from || "" }];
      wide = { k: (l0.to || "공항") + " → 숙소", v: c.route || "" };
      note = state.hotel.note || "";
      links = [{ t: "숙소 가는 길", b: "↗", c: "var(--accent)", url: apple(state.hotel.zh || state.hotel.addr || state.hotel.name) }];
    }
    if (c.id === "life") {
      const d1 = state.days[0], w = wxParse(d1 && d1.wx), rate = +state.settle.rate || 0;
      note = [w.c ? "첫날 " + w.c + (w.t ? " " + w.t : "") : "", rate ? "1위안 ≈ " + rate + "원 (정산 환율)" : ""].filter(Boolean).join(" · ");
      links = [{ t: "상하이 날씨", b: "↗", c: "var(--accent)", url: WX_URL }];
    }
    const tile = (t) => '<div class="btile"><small>' + esc(t.k) + "</small><b>" + esc(t.v) + (t.u ? "<em>" + esc(t.u) + "</em>" : "") + "</b></div>";
    return '<div class="hc-slide"><article class="pc brief"><div class="pc-b">' +
      '<div class="br-top"><h3 class="br-h"><span class="bri">' + (ICON[c.icon] || ICON.info) + "</span>" + esc(c.title) + '</h3><span class="mono pc-n">' + esc(B.checked || "") + " 기준</span></div>" +
      '<div class="btiles">' + tiles.map(tile).join("") + "</div>" +
      (wide ? '<div class="bwide' + (wide.warn ? " warn" : "") + '"><small>' + esc(wide.k) + "</small><b>" + esc(wide.v) + "</b></div>" : "") +
      (note ? '<p class="bnote">' + esc(note) + "</p>" : "") +
      (links.length ? '<div class="bchips">' + links.map((l) => '<a class="bchip" href="' + esc(l.url) + '"' + EXT + '><span class="fv" style="background:' + esc(l.c || "var(--accent)") + '">' + esc(l.b || "↗") + "</span>" + esc(l.t) + " ↗</a>").join("") + "</div>" : "") +
      "</div></article></div>";
  }
  function heroCardHtml(ctx) {
    const ph = ctx.ph;
    if (ph.k === "before") {
      const d1 = state.days[0], l0 = state.flight.legs[0] || {};
      const names = d1 ? visible(d1).filter(placeOf).map(mapLabel) : [];
      const cards = ((window.TRIP_BRIEF || {}).cards || []);
      const start = heroIdx.before != null ? Math.min(heroIdx.before, cards.length) : 0;
      const l0f = l0.from || "", l0t = l0.to || "";
      return '<div class="hc-wrap"><div class="hc" id="hc" data-day="before" data-start="' + start + '">' +
        '<div class="hc-slide"><div class="bp-wrap"><article class="pc bpass"><div class="bp-main">' +
        '<span class="pc-tag on">출발까지 · ' + esc(l0.label || "가는 편") + "</span>" +
        '<div class="bp-route"><div><b class="bp-code">' + esc(iata(l0f)) + "</b><span>" + esc(l0f + " " + (l0.dep || "")) + '</span></div><i class="bp-line" aria-hidden="true">' + ICON.planeF + '</i><div class="r"><b class="bp-code">' + esc(iata(l0t)) + "</b><span>" + esc(l0t + " " + (l0.arr || "")) + "</span></div></div>" +
        '<div class="bp-kv"><div><small>DATE</small><b>' + esc(l0.date || "") + "</b></div><div><small>FLIGHT</small><b>" + esc(l0.no || "") + "</b></div><div><small>CHECK-IN</small><b>" + esc(String(l0.checkin || "").split("·").pop().replace(/마감/, "").trim() || "—") + "</b></div></div>" +
        '<button class="btn cta" type="button" data-act="trip-sum">' + ICON.list + "여행 한눈에 보기</button></div>" +
        '<button class="bp-stub" type="button" data-act="ck-sheet" data-list="pack" aria-label="준비물 보기"><span>출발까지</span><b>' + esc(ddayText()) + "</b><em>" + ICON.bag + "준비물</em></button>" +
        "</article></div></div>" +
        cards.map(briefCard).join("") + "</div>" +
        '<div class="hc-nav"><button class="hc-arr l" type="button" data-act="hc-step" data-d="-1" aria-label="이전">' + ICON.chevL + "</button>" +
        '<div class="hc-dots" aria-hidden="true">' + "<i></i>".repeat(cards.length + 1) + "</div>" +
        '<button class="hc-arr r" type="button" data-act="hc-step" data-d="1" aria-label="다음">' + ICON.chevR + "</button></div></div>";
    }
    if (ph.k === "after") {
      let places = 0, photos = 0;
      state.days.forEach((d) => {
        photos += dayPics(d.id).length;
        d.stops.forEach((st) => { if (isDone(st.id)) places++; (st.spots || []).forEach((p) => { if (isDone(p.id)) places++; }); });
      });
      Object.keys(state.placePhotos).forEach((k) => { photos += state.placePhotos[k].length; });
      return '<div class="hc-one"><article class="pc"><div class="pc-b"><div class="pc-top"><span class="pc-tag on">다녀온 여행 한눈에</span></div>' +
        '<div class="stat3"><div><span>다녀온 곳</span><b>' + places + "곳</b></div><div><span>사진</span><b>" + photos + "장</b></div><div><span>함께 쓴 돈</span><b>" + totalFmt(settleCalc()) + "</b></div></div>" +
        '<div class="wn-foot"><button class="btn cta" type="button" data-act="tab" data-tab="log">' + ICON.log + "기록 보기</button></div></div></article></div>";
    }
    const day = ph.day, list = visible(day).filter(placeOf), next = nextOf(day);
    if (!list.length) return '<div class="hc-one"><article class="pc"><div class="pc-b"><b class="wtitle">오늘은 정해진 일정이 없어요</b><button class="btn primary" type="button" data-act="taxi" data-id="hotel">' + ICON.taxi + "숙소로 가는 택시 카드</button></div></article></div>";
    const start = heroIdx[day.id] != null ? Math.min(heroIdx[day.id], list.length - 1) : next ? list.indexOf(next) : list.length - 1;
    return '<div class="hc-wrap"><div class="hc" id="hc" data-day="' + day.id + '" data-start="' + start + '">' + list.map((st, i) => placeCard(st, i, list, day, next && next.id)).join("") + "</div>" +
      '<div class="hc-nav"><button class="hc-arr l" type="button" data-act="hc-step" data-d="-1" aria-label="이전 장소">' + ICON.chevL + "</button>" +
      '<div class="hc-dots" aria-hidden="true">' + list.map((st, i) => '<i class="' + (isDone(st.id) || isSkip(st.id) ? "ok" : "") + (next && st.id === next.id ? " nx" : "") + '"></i>').join("") + "</div>" +
      '<button class="hc-arr r" type="button" data-act="hc-step" data-d="1" aria-label="다음 장소">' + ICON.chevR + "</button></div></div>";
  }
  /* which day the home screen shows: 자동 / 여행 전 / each day / 다녀온 뒤 (same list as 더보기 → 홈 화면 미리보기) */
  const previewOpts = () => [["auto", "자동 (오늘 날짜 기준)", ""], ["before", "여행 전", ""]]
    .concat(state.days.map((d) => [d.id, isNum(d.n) ? "여행 중 · Day " + d.n : "여행 중 · 귀국날", d.date]))
    .concat([["after", "다녀온 뒤", ""]]);
  function previewSheet() {
    const cur = ui.preview || "auto";
    openSheet({
      key: "preview", center: true, title: "홈 화면 미리보기",
      body: '<div class="pvlist">' + previewOpts().map((o) => '<button class="pvopt" type="button" data-act="preview-set" data-v="' + esc(o[0]) + '" aria-pressed="' + (cur === o[0]) + '"><span>' + esc(o[1]) + "</span>" +
        (o[2] ? "<small>" + esc(o[2]) + "</small>" : "") + ICON.check + "</button>").join("") + "</div>"
    });
  }
  function homeHtml() {
    const ctx = homeCtx(), ph = ctx.ph, t = state.trip;
    let chip, title, hint = "";
    if (ph.k === "during") {
      chip = (isNum(ph.day.n) ? "DAY " + ph.day.n + " · " : "귀국 · ") + ph.day.date;
      title = ph.day.title;
      const w = wxParse(ph.day.wx);
      if (ph.day.wx) hint = '<a class="hwx" href="' + WX_URL + '"' + EXT + ">" + ICON[w.kind] + esc(w.c) + (w.t ? " · " + esc(w.t) : "") + "</a>";
    } else {
      chip = ph.k === "before" ? "여행 전" : "다녀온 여행";
      title = (t.title || "상하이") + " " + (t.nights || "");
      hint = '<span class="mono">' + esc(String(t.dates || "").replace(/\s*·\s*\d+박.*$/, "")) + "</span>";
    }
    let s = '<section class="hero">' + heroArt() +
      '<div class="hero-top"><div class="hrow"><span class="hz">上海</span><button class="hchip" type="button" data-act="preview-pick" aria-label="홈 화면 미리보기 바꾸기">' + esc(chip) + ICON.chevR + "</button>" +
      '<button class="hedit' + (editing ? " done" : "") + '" type="button" data-act="w-edit">' + (editing ? "완료" : "편집") + "</button></div>" +
      '<h1 class="htitle">' + esc(title) + "</h1>" + (hint ? '<div class="hhint">' + hint + "</div>" : "") + "</div>" +
      '<div class="hero-card">' + heroCardHtml(ctx) + "</div>" +
      '<button class="hero-more" type="button" data-act="to-widgets">위젯 ' + ICON.chevR + "</button></section>";
    const list = widgetList();
    s += '<div class="wzone" id="wzone"><div class="wgrid' + (editing ? " wedit" : "") + '" id="wgrid">' + list.map((id) => widgetHtml(id, ctx)).join("") +
      (editing ? '<button class="w-add" type="button" data-act="w-addsheet">+ 위젯 추가</button>' : "") + "</div>" +
      (!list.length && !editing ? '<p class="note" style="text-align:center;margin-top:24px;color:#fff">\'편집\'을 눌러 위젯을 넣어보세요</p>' : "") + "</div>";
    return s;
  }
  function heroMount() {
    const hc = document.getElementById("hc");
    if (!hc) return;
    const n = hc.children.length, start = +hc.getAttribute("data-start") || 0, dayId = hc.getAttribute("data-day");
    const dots = Array.from(document.querySelectorAll(".hc-dots i"));
    const l = $(".hc-arr.l"), r = $(".hc-arr.r");
    const mark = (i) => {
      dots.forEach((d, k) => d.classList.toggle("on", k === i));
      if (l) l.disabled = i <= 0;
      if (r) r.disabled = i >= n - 1;
    };
    hc.scrollLeft = start * hc.clientWidth;
    mark(start);
    let tm;
    hc.addEventListener("scroll", () => {
      clearTimeout(tm);
      tm = setTimeout(() => { const i = Math.round(hc.scrollLeft / Math.max(1, hc.clientWidth)); heroIdx[dayId] = i; mark(i); }, 60);
    }, { passive: true });
  }
  function wrapW(id, inner, cls, attrs) {
    const def = WDEF[id];
    return '<div class="w w-' + def.size + (cls ? " " + cls : "") + '" data-w="' + id + '"' + (attrs || "") + ">" +
      (editing ? '<button class="w-del" type="button" data-act="w-del" data-w="' + id + '" aria-label="' + def.name + ' 위젯 빼기">' + ICON.minus + "</button>" : "") + inner + "</div>";
  }
  function widgetHtml(id, ctx) {
    switch (id) {
      case "weather": {
        const d = ctx.day, w = wxParse(d && d.wx);
        const lbl = ctx.ph.k === "during" ? "오늘 날씨" : ctx.ph.k === "before" ? "첫날 날씨" : "날씨";
        return wrapW(id, '<div class="hd"><span class="lbl">' + lbl + '</span><span class="mono sub">' + esc(d ? d.date : "") + "</span></div>" +
          '<span class="ico">' + ICON[w.kind] + "</span>" +
          (w.hi ? '<span class="wx-t"><b class="mono">' + esc(w.hi) + '°</b><span class="mono">/ ' + esc(w.lo) + "°</span></span>" : '<span class="wx-t"><b>—</b></span>') +
          '<span class="sub">' + esc(w.c || "아직 없음") + " · 자세히 ↗</span>", "", ' data-href="' + WX_URL + '"');
      }
      case "hotel": {
        const h = state.hotel, tm = hotelTimes(h);
        return wrapW(id, '<div class="hd"><span class="lbl">숙소</span>' + ICON.bed + "</div>" +
          '<b class="wtitle">' + esc(shortName(h.name) || "아직 미정") + "</b>" +
          (h.note ? '<span class="sub clamp2">' + esc(h.note) + "</span>" : "") +
          '<span class="chips push">' + (tm.in ? '<span class="minichip">IN ' + tm.in + "</span>" : "") + (tm.out ? '<span class="minichip">OUT ' + tm.out + "</span>" : "") + "</span>", "", ' data-act="hotel"');
      }
      case "flight": return wFlight(ctx);
      case "todo": case "pack": case "apps": return wCheck(id);
      case "route": {
        const d = ctx.day;
        return wrapW(id, d ? routeMap(d, 172, 138, { mini: true, uid: "w", padT: 22, padB: 18, padL: 22, padR: 22 }) + '<span class="wtag">' + (ctx.ph.k === "during" ? "오늘 동선" : (isNum(d.n) ? "DAY " + d.n : "귀국") + " 동선") + "</span>" : "", "wmap", d ? ' data-act="go-plan" data-day="' + d.id + '"' : "");
      }
      case "settle": {
        const c = settleCalc(), x = c.xs[0];
        return wrapW(id, '<div class="hd"><span class="lbl">N빵 정산</span>' + ICON.money + "</div>" +
          '<b class="big wbig">' + totalFmt(c) + "</b>" + '<span class="sub">' + (state.settle.members.length ? c.n + "명 · 1인당 " + (c.base === "KRW" ? wonFmt(c.share) : yuanFmt(c.share)) : "인원을 먼저 넣어주세요") + "</span>" +
          '<span class="sub push wxfer">' + (x ? "<b>" + esc(x.from) + "</b> → <b>" + esc(x.to) + "</b> " + (c.base === "KRW" ? wonFmt(x.v) : yuanFmt(x.v)) + (c.xs.length > 1 ? " 외 " + (c.xs.length - 1) + "건" : "") : state.settle.expenses.length ? "보낼 돈 없어요" : "아직 지출이 없어요") + "</span>",
          "", ' data-act="tab" data-tab="money"');
      }
      case "fx": return wrapW(id, '<div class="hd"><span class="lbl">환율 계산</span><span class="mono sub">' + (state.settle.rate ? "1 : " + esc(state.settle.rate) : "") + "</span></div>" + '<div class="wfx">' + fxHtml("wfx") + "</div>");
      case "photos": {
        const d = ctx.day, ph = d ? dayPics(d.id) : [];
        const lbl = ctx.ph.k === "during" ? "오늘 사진" : d ? d.date + " 사진" : "사진";
        return wrapW(id, '<div class="hd"><span class="lbl">' + esc(lbl) + '</span><span class="mono sub">' + ph.length + "장</span></div>" +
          '<div class="wphotos">' + ph.slice(-2).reverse().map((pid) => '<button type="button" data-act="view" data-day="' + d.id + '" data-i="' + ph.indexOf(pid) + '" aria-label="사진 크게 보기"><img data-pid="' + esc(pid) + '" alt=""></button>').join("") +
          (d ? "<label>" + ICON.camera + '<input class="vh" type="file" accept="image/*" multiple data-upload="' + d.id + '"></label>' : "") + "</div>");
      }
      case "memo": {
        const m = state.memos[0];
        return wrapW(id, '<div class="hd"><span class="lbl">메모</span>' + ICON.note + "</div>" + '<div class="wmemo">' + (m ? esc(m.text) : '<span class="sub">눌러서 메모 적기</span>') + "</div>",
          "", m ? ' data-act="memo-edit" data-id="' + m.id + '"' : ' data-act="memo-add"');
      }
    }
    return "";
  }
  /* checklist widgets: the whole list, scrollable; tap anywhere else to open it big */
  function wCheck(key) {
    const list = state.prep[key], doneN = list.filter((x) => state.done[x.id]).length;
    const sorted = list.filter((x) => !state.done[x.id]).concat(list.filter((x) => state.done[x.id]));
    return wrapW(key, '<div class="hd"><span class="lbl">' + CK_TITLE[key] + '</span><button class="wedit-ic" type="button" data-act="ck-sheet" data-list="' + key + '" aria-label="' + CK_TITLE[key] + ' 추가 · 편집">' + ICON.pen + "</button></div>" +
      '<div class="wprog" data-prog="' + key + '"><i style="width:' + (list.length ? (doneN / list.length) * 100 : 0) + '%"></i></div>' +
      '<div class="wlist">' + (sorted.length ? sorted.map((x) => ckHtml(x, esc(x.t), "wck")).join("") : '<span class="sub" style="padding:6px 0">비어 있어요 · 연필을 눌러 추가</span>') + "</div>", "wcheck", ' data-act="ck-sheet" data-list="' + key + '"');
  }
  function wFlight(ctx) {
    const legs = state.flight.legs;
    if (!legs.length) return wrapW("flight", '<div class="wf-main"><span class="lbl">항공</span><span class="sub">아직 미정</span></div>', "wf", ' data-act="flight"');
    const back = ctx.ph.k === "after" || (ctx.ph.k === "during" && ctx.ph.day !== state.days[0]);
    const main = back && legs[1] ? legs[1] : legs[0], other = main === legs[0] ? legs[1] : legs[0];
    return wrapW("flight", '<div class="wf-main"><div class="wf-top"><span class="lbl">항공 · ' + esc(main.label || "") + '</span><span class="mono sub">' + esc([main.no, main.date].filter(Boolean).join(" · ")) + "</span></div>" +
      '<div class="wf-route"><span class="wf-ap"><b>' + esc(apCode(main.from)) + "</b><span>" + esc(main.from || "") + " · " + esc(main.dep || "") + '</span></span><span class="wf-line">' + ICON.planeF + "</span>" +
      '<span class="wf-ap r"><b>' + esc(apCode(main.to)) + "</b><span>" + esc(main.to || "") + " · " + esc(main.arr || "") + "</span></span></div>" +
      (main.checkin ? '<span class="sub">체크인 ' + esc(main.checkin) + "</span>" : "") + "</div>" +
      (other ? '<div class="wf-cut" aria-hidden="true"></div><div class="wf-back"><span>' + esc(other.label || "") + " " + esc(other.date || "") + "</span><b>" + esc(apCode(other.from)) + " " + esc(other.dep || "") + " → " + esc(apCode(other.to)) + " " + esc(other.arr || "") + '</b><span class="r">' + esc(other.no || "") + "</span></div>" : ""),
      "wf", ' data-act="flight"');
  }
  /* ---------- PLAN: illustrated map + list ---------- */
  function planDay() {
    let day = findDay(ui.day);
    if (!day) { const ph = phase(); day = ph.day || state.days[0]; ui.day = day && day.id; }
    return day;
  }
  function planHtml() {
    const day = planDay();
    if (!day) return pageHead("일정", "") + '<p class="empty pad">일정이 없어요</p>';
    const c = dayC(day), vis = visible(day), w = wxParse(day.wx), ph = phase(), di = state.days.indexOf(day), pr = dayProgress(day);
    const nextId = ph.k === "during" && ph.day.id === day.id ? (nextOf(day) || {}).id : null;
    const far = mapPts(day).filter((p) => p.far);
    let s = '<div class="plan"><div class="mapwrap"><div class="map" id="map" role="img" aria-label="' + esc(day.title) + ' 동선 그림 지도"></div>' +
      '<div class="daybar"><button class="rb" type="button" data-act="day-step" data-d="-1" aria-label="이전 날"' + (di <= 0 ? " disabled" : "") + ">" + ICON.chevL + "</button>" +
      '<div class="mid"><span>' + (isNum(day.n) ? "DAY " + esc(day.n) : "귀국") + " · " + esc(day.date) + "</span><b>" + esc(day.title) + "</b></div>" +
      '<button class="rb" type="button" data-act="day-step" data-d="1" aria-label="다음 날"' + (di >= state.days.length - 1 ? " disabled" : "") + ">" + ICON.chevR + "</button></div>" +
      '<div class="mapbot"><div class="far">' + far.map((p) => '<button class="mapchip" type="button" data-act="detail" data-id="' + p.it.id + '"><b class="mono">' + p.n + "</b>" + esc(mapLabel(p.it)) + " · 지도 밖</button>").join("") + "</div>" +
      (day.wx ? '<a class="mapchip mapwx" href="' + WX_URL + '"' + EXT + ">" + ICON[w.kind] + esc(w.c) + (w.t ? " " + esc(w.t) : "") + "</a>" : "") + "</div></div>";
    s += '<section class="plist" style="--c:' + c + '"><div class="handle" aria-hidden="true"></div>' +
      '<div class="plist-h"><h2>' + (isNum(day.n) ? "Day " + esc(day.n) : "귀국날") + ' 일정</h2><span class="cnt">' + (pr.n ? pr.done + "/" + pr.n + " 다녀옴" + (pr.sk ? " · " + pr.sk + " 건너뜀" : "") : "") + "</span>" +
      '<button class="icon-btn" type="button" data-act="edit-day" data-day="' + day.id + '" aria-label="이 날 제목·날씨 수정">' + ICON.pen + "</button></div>";
    if (hasPri(day)) s += '<p class="starkey"><span class="stars">★★★</span> 꼭 가기 · <span class="stars">★★</span> 가면 좋음 · <span class="stars">★</span> 여유 있으면</p>';
    s += '<ul class="prows">' + vis.map((st, i) => prowHtml(st, i + 1, nextId, vis[i - 1] && vis[i - 1].id === nextId, c)).join("") + "</ul>";
    s += maybeDrawer(day);
    s += '<div class="addrow"><button class="btn dashed wide" type="button" data-act="add-stop" data-day="' + day.id + '">+ 장소 추가</button></div></section></div>';
    return s;
  }
  /* every row can be swiped left to show 삭제; long-press a place row to drag it (its shops move with it) */
  const swipeWrap = (id, inner) => '<div class="swipe" data-sw="' + id + '"><button class="sw-del" type="button" data-act="row-del" data-id="' + id + '" tabindex="-1" aria-label="삭제"><span class="sw-ic">' + ICON.trash + "</span></button>" + inner + "</div>";
  function prowHtml(st, n, nextId, afterNext, c) {
    const done = isDone(st.id), sk = isSkip(st.id), nx = st.id === nextId, has = !!placeOf(st);
    const num = done ? ICON.check : sk ? ICON.skip : has ? n : "·";
    const sub = sk ? "건너뜀 · 다녀온 걸로 안 쳐요" : st.desc || st.zh || "";
    const th = placeImgs(st)[0];
    const right = nx ? '<span class="pr">다음</span>' : th ? imgHtml(th, "pthumb", "") : '<span class="pr go">' + ICON.chevR + "</span>";
    return '<li data-id="' + st.id + '" class="' + (afterNext ? "after-next" : "") + (nx ? " is-next" : "") + '">' +
      swipeWrap(st.id, '<button class="prow' + (nx ? " next" : "") + (done ? " ok" : "") + (sk ? " sk" : "") + '" type="button" id="row-' + st.id + '" data-act="detail" data-id="' + st.id + '" data-drag="1">' +
        '<span class="pnum">' + num + '</span><span class="pt"><b>' + esc(st.ko) + starsHtml(st.pri) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span>" + right + "</button>") +
      subrowsHtml(st, c) + "</li>";
  }
  /* shops inside a place, listed right under it */
  function subrowsHtml(st, c) {
    const sp = st.spots || [];
    if (!sp.length) return "";
    return '<ul class="subrows" style="--c:' + c + '">' + sp.map((p) => {
      const done = isDone(p.id), sk = isSkip(p.id);
      const sub = sk ? "건너뜀" : [p.desc, p.hours].filter(Boolean).join(" · ") || p.zh || "";
      return "<li>" + swipeWrap(p.id, '<button class="srow' + (done ? " ok" : "") + (sk ? " sk" : "") + (p.pri === "maybe" ? " maybe" : "") + '" type="button" data-act="detail" data-id="' + p.id + '">' +
        '<span class="sic">' + (done ? ICON.check : sk ? ICON.skip : ICON.store) + '</span><span class="pt"><b>' + esc(p.ko) + starsHtml(p.pri) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span>" +
        '<span class="pr go">' + ICON.chevR + "</span></button>") + "</li>";
    }).join("") + "</ul>";
  }
  function maybeDrawer(day) {
    const items = day.stops.filter((st) => st.pri === "maybe");
    if (!items.length) return "";
    const key = "maybe-" + day.id;
    return '<details class="maybe-fold" data-fold="' + key + '"' + (ui.open[key] ? " open" : "") + '><summary><span class="stars">★</span><span class="ft">여유 있으면 · ' +
      items.length + '곳</span><span class="chev" aria-hidden="true"></span></summary><ul class="prows" data-maybe="1">' +
      items.map((it) => '<li data-id="' + it.id + '">' + swipeWrap(it.id, '<button class="prow' + (isDone(it.id) ? " ok" : "") + (isSkip(it.id) ? " sk" : "") + '" type="button" data-act="detail" data-id="' + it.id + '" data-drag="1"><span class="pnum">' +
        (isDone(it.id) ? ICON.check : "★") + '</span><span class="pt"><b>' + esc(it.ko) + "</b><small>" + esc(it.desc || it.zh || "") + '</small></span><span class="pr go">' + ICON.chevR + "</span></button>") + subrowsHtml(it, dayC(day)) + "</li>").join("") +
      "</ul></details>";
  }

  /* ---------- place detail ---------- */
  function detailSheet(id) {
    const f = findItem(id);
    if (!f) return;
    const it = f.item, day = f.day, isSpot = f.kind === "spot", q = placeOf(it);
    const idx = isSpot ? -1 : visible(day).indexOf(it);
    const imgs = placeImgs(it);
    const done = isDone(id), sk = isSkip(id);
    const nm = esc(it.ko || "장소");
    let hero = '<div class="dt-hero' + (imgs.length ? "" : " noimg") + '"><button class="ph" type="button" data-act="photo-sheet" data-id="' + id + '">' +
      '<svg class="deco" viewBox="0 0 350 188" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="300" cy="30" r="58" fill="none" stroke-width="1.5"/><circle cx="300" cy="30" r="90" fill="none" stroke-width="1.5"/>' +
      '<circle cx="40" cy="166" r="70" fill="none" stroke-width="1.5"/><text x="330" y="168" text-anchor="end" font-size="104">' + (idx >= 0 ? idx + 1 : "") + "</text></svg>" +
      '<span class="addph">' + ICON.camera + "사진 넣기</span></button>";
    if (imgs.length) {
      hero += '<button class="hero-hit" type="button" data-act="view-place" data-id="' + id + '" aria-label="사진 크게 보기">' + imgHtml(imgs[0], "", it.ko + " 사진", "this.closest('.dt-hero').classList.add('noimg')") + "</button>" +
        (imgs[0].u && it.imgSrc ? '<a class="credit" href="' + esc(it.imgSrc) + '"' + EXT + ">사진 · Wikimedia Commons ↗</a>" : "") +
        (imgs.length > 1 ? '<span class="cnt">' + imgs.length + "장</span>" : "") +
        '<button class="plus" type="button" data-act="photo-sheet" data-id="' + id + '" aria-label="사진 바꾸기 · 더 넣기">' + ICON.camera + "</button>";
    }
    hero += "</div>";
    const chips = (it.pri ? '<span class="chip-gold">' + STARS[it.pri] + " " + PRI[it.pri] + "</span>" : "") +
      (it.tags || []).map((t) => '<span class="chip-coral">' + esc(t) + "</span>").join("") +
      (isSpot ? '<span class="chip-soft">' + esc(f.parent.ko) + " 안</span>" : "");
    let body = '<div class="dt">' + hero +
      '<div class="dt-title"><span class="numdot" style="--c:' + dayC(day) + '">' + (done ? ICON.check : idx >= 0 ? idx + 1 : "·") + "</span>" +
      '<a class="dt-name" href="' + google(it.ko) + '"' + EXT + ">" + nm + '<span class="ext">검색 ↗</span></a>' +
      '<button class="icon-btn" type="button" data-act="edit" data-id="' + id + '" aria-label="' + nm + ' 수정">' + ICON.pen + "</button></div>" +
      '<div class="dt-sub">' + (it.zh ? '<span class="zhs">' + esc(it.zh) + "</span>" : "") + (it.desc ? '<span class="sub">' + esc(it.desc) + "</span>" : "") +
      (chips ? '<div class="chips">' + chips + "</div>" : "") + "</div>";
    if (q) {
      body += '<div class="dt-acts"><a class="btn primary" href="' + amap(q) + '"' + EXT + ">" + ICON.map + "고덕지도</a>" +
        '<a class="btn" href="' + apple(q) + '"' + EXT + '><span class="ic">' + ICON.nav + "</span>길찾기</a>" +
        '<button class="btn" type="button" data-act="taxi" data-id="' + id + '"><span class="ic">' + ICON.taxi + "</span>택시 카드</button></div>";
    }
    const rows = [];
    if (it.hours) rows.push('<div class="r">' + ICON.clock + '<span class="k">영업</span><span class="v mono">' + esc(it.hours) + "</span></div>");
    if (it.addr) rows.push('<button class="r" type="button" data-act="copy" data-v="' + esc(it.addr) + '">' + ICON.pin + '<span class="k">주소</span><span class="v zh">' + esc(it.addr) + '</span><span class="cp">복사</span></button>');
    if (it.memo) rows.push('<div class="r">' + ICON.note + '<span class="k">할 일</span><span class="v">' + esc(it.memo) + "</span></div>");
    if (rows.length) body += '<div class="dt-info">' + rows.join("") + "</div>";
    if (!isSpot) {
      const sp = it.spots || [];
      body += '<div class="dt-spots">' + (sp.length ? '<span class="h">이 안에서 갈 가게</span>' + sp.map((p) => '<button type="button" data-act="detail" data-id="' + p.id + '"' + (isDone(p.id) || isSkip(p.id) ? ' class="ok"' : "") + ">" +
        '<span class="sic" style="--c:' + dayC(day) + '">' + (isDone(p.id) ? ICON.check : isSkip(p.id) ? ICON.skip : ICON.store) + "</span><b>" + esc(p.ko) + " " + starsHtml(p.pri) + "</b>" + ICON.chevR + "</button>").join("") : "") +
        '<button type="button" class="addspot" data-act="add-spot" data-id="' + id + '">' + ICON.plus + "가게 추가</button></div>";
    }
    body += "</div>";
    const nx = nextOf(day), nextBtn = nx && nx.id !== id ? '<button class="btn primary" type="button" data-act="detail" data-id="' + nx.id + '">다음 장소' + ICON.chevR + "</button>" : "";
    let foot;
    if (done) foot = '<button class="btn grow" type="button" data-act="dt-undone" data-id="' + id + '">' + ICON.check + "다녀옴 · 취소</button>" + nextBtn;
    else if (sk) foot = '<button class="btn grow" type="button" data-act="dt-unskip" data-id="' + id + '">' + ICON.undo + "건너뜀 · 되돌리기</button>" + nextBtn;
    else foot = '<button class="btn cta" type="button" data-act="dt-done" data-id="' + id + '">' + ICON.check + "다녀왔어요</button>" +
      '<button class="btn" type="button" data-act="dt-skip" data-id="' + id + '"><span class="ic">' + ICON.skip + "</span>건너뛰기</button>";
    openSheet({ key: "dt-" + id, bare: true, title: it.ko || "장소", body, foot, footCls: "dt-foot" });
  }
  function refreshDetail(id) { render(); if (sheetKey() === "dt-" + id) detailSheet(id); }
  function setDone(id, on) { if (on) { state.done[id] = true; delete state.skip[id]; } else delete state.done[id]; save(); }
  function setSkip(id, on) { if (on) { state.skip[id] = true; delete state.done[id]; } else delete state.skip[id]; save(); }

  /* ---------- LOG: a feed of posts (photos + a few lines), by day ---------- */
  const postsOf = (dayId) => state.posts.filter((p) => p.day === dayId).sort((a, b) => (a.at || 0) - (b.at || 0));
  const postPics = (id) => state.postPhotos[id] || [];
  const dayPics = (dayId) => postsOf(dayId).reduce((a, p) => a.concat(postPics(p.id)), []);
  const meName = () => sync.me || "";
  const hhmm = (ts) => { const t = new Date(ts); return pad(t.getHours()) + ":" + pad(t.getMinutes()); };
  const likeNames = (id) => Object.keys(state.likes).filter((k) => state.likes[k] && k.indexOf(id + "|") === 0).map((k) => k.slice(id.length + 1));
  function whoColor(name) {
    const i = (state.settle.members || []).indexOf(name);
    return i === 0 ? "var(--d1)" : i === 1 ? "var(--d2)" : i === 2 ? "var(--d3)" : "var(--accent)";
  }
  function postHtml(p) {
    const pics = postPics(p.id), who = p.by || "", nm = who || meName() || "나", place = p.place ? findItem(p.place) : null;
    const likes = likeNames(p.id), mine = !!state.likes[p.id + "|" + (meName() || "나")];
    let ph = "";
    if (pics.length) {
      ph = '<div class="pph"><div class="pstrip">' + pics.map((pid, i) => '<button type="button" data-act="post-view" data-id="' + p.id + '" data-i="' + i + '" aria-label="사진 크게 보기"><img data-pid="' + esc(pid) + '" alt=""></button>').join("") + "</div>" +
        (pics.length > 1 ? '<span class="pcount mono">1 / ' + pics.length + '</span><div class="pdots">' + pics.map((x, i) => '<i class="' + (i ? "" : "on") + '"></i>').join("") + "</div>" : "") + "</div>";
    } else if (p.ph) ph = '<div class="pmiss">' + ICON.camera + "<span>사진 " + p.ph + "장 · " + esc(who || "친구") + " 폰에만 있어요</span></div>";
    return '<article class="post" id="post-' + p.id + '">' +
      '<header class="post-h"><span class="av" style="background:' + whoColor(nm) + '">' + esc(nm.slice(0, 1)) + '</span><div class="who"><b>' + esc(nm) + "</b><span>" +
      esc([p.at ? hhmm(p.at) : "", place ? place.item.label || shortName(place.item.ko) : ""].filter(Boolean).join(" · ")) + "</span></div>" +
      '<button class="icon-btn" type="button" data-act="post-edit" data-id="' + p.id + '" aria-label="기록 고치기">' + ICON.more + "</button></header>" +
      ph + (p.text ? '<p class="ptext">' + esc(p.text) + "</p>" : "") +
      '<footer class="pf"><button class="heart' + (mine ? " on" : "") + '" type="button" data-act="post-like" data-id="' + p.id + '" aria-pressed="' + mine + '" aria-label="좋아요">' + ICON.heart + "</button>" +
      (likes.length ? '<span class="likes">' + esc(likes.join(", ")) + "</span>" : "") + "</footer></article>";
  }
  function logHtml() {
    const sel = ui.logDay && findDay(ui.logDay) ? ui.logDay : "all";
    let s = pageHead("기록", "날마다 사진 · 한 줄 기록", true);
    s += '<div class="lchips" role="tablist" aria-label="날짜 고르기"><button type="button" class="lchip' + (sel === "all" ? " on" : "") + '" data-act="log-day" data-v="all" aria-pressed="' + (sel === "all") + '">전체</button>' +
      state.days.map((d) => '<button type="button" class="lchip' + (sel === d.id ? " on" : "") + '" data-act="log-day" data-v="' + d.id + '" aria-pressed="' + (sel === d.id) + '" style="--c:' + dayC(d) + '"><i>' + esc(d.n) + "</i>" + esc(String(d.date).split(" ")[0]) + "</button>").join("") + "</div>";
    s += '<p class="lognote2">' + (sync.code ? "글은 친구랑 같이 봐요 · 사진은 올린 사람 폰에만 있어요" : "사진은 이 폰에만 저장돼요") + "</p>";
    (sel === "all" ? state.days : [findDay(sel)]).forEach((d) => {
      const list = postsOf(d.id);
      s += '<section class="fday" id="log-' + d.id + '" style="--c:' + dayC(d) + '"><div class="fday-h"><span class="rd">' + esc(d.n) + '</span><div><span class="m">' + esc(d.date) + "</span><b>" + esc(d.title) + "</b></div>" +
        (list.length ? '<span class="cnt">' + list.length + "개</span>" : "") + "</div>" +
        (list.length ? list.map(postHtml).join("") : '<button class="fempty" type="button" data-act="post-new" data-day="' + d.id + '">' + ICON.plus + "<span>이날 첫 기록 남기기</span></button>") + "</section>";
    });
    return s + '<div class="fpad"></div><button class="fab" type="button" data-act="post-new" data-day="' + (sel !== "all" ? sel : "") + '" aria-label="기록 쓰기">' + ICON.plus + "</button>";
  }
  /* writing / editing a post: photos, a few lines, which day, and (if you like) which place */
  let cmp = null;
  function defaultLogDay() {
    const ph = phase();
    return ph.k === "during" ? ph.day.id : ui.logDay && findDay(ui.logDay) ? ui.logDay : (state.days[0] || {}).id;
  }
  function postSheet(id, dayId) {
    const p = id ? state.posts.find((x) => x.id === id) : null;
    const fresh = !cmp || cmp.id !== (p ? p.id : null) || (!p && !cmp.text && !cmp.add.length);
    if (fresh) cmp = { id: p ? p.id : null, day: p ? p.day : dayId || defaultLogDay(), text: p ? p.text || "" : "", place: p ? p.place || "" : "", keep: p ? postPics(p.id).slice() : [], add: [] };
    drawPostSheet();
  }
  function cmpRead() {
    const t = document.getElementById("cmpText"), pl = document.getElementById("cmpPlace");
    if (t) cmp.text = t.value;
    if (pl) cmp.place = pl.value;
  }
  function drawPostSheet() {
    const d = findDay(cmp.day) || state.days[0], stops = d ? d.stops : [];
    const rm = (k, i) => '<button type="button" data-act="cmp-rm" data-k="' + k + '" data-i="' + i + '" aria-label="사진 빼기">' + ICON.x + "</button>";
    const thumbs = cmp.keep.map((pid, i) => '<div class="cth"><img data-pid="' + esc(pid) + '" alt="">' + rm("keep", i) + "</div>").join("") +
      cmp.add.map((a, i) => '<div class="cth"><img src="' + a.url + '" alt="">' + rm("add", i) + "</div>").join("");
    openSheet({
      key: "post-edit", title: cmp.id ? "기록 고치기" : "새 기록",
      body: '<div class="cpics">' + thumbs + '<label class="cadd">' + ICON.camera + '<span>사진 넣기</span><input class="vh" type="file" accept="image/*" multiple data-post-pick></label></div>' +
        '<label class="field"><span class="vh">내용</span><textarea id="cmpText" placeholder="어땠어? 한 줄이라도 좋아요" style="min-height:110px">' + esc(cmp.text) + "</textarea></label>" +
        '<div class="field"><span>날짜</span><div class="chips">' + state.days.map((x) => '<button class="btn sm chipbtn" type="button" data-act="cmp-day" data-v="' + x.id + '" aria-pressed="' + (x.id === cmp.day) + '">' +
          esc((isNum(x.n) ? "Day " + x.n : "귀국") + " · " + String(x.date).split(" ")[0]) + "</button>").join("") + "</div></div>" +
        '<label class="field"><span>장소 · 안 골라도 돼요</span><select id="cmpPlace"><option value="">선택 안 함</option>' +
          stops.map((st) => '<option value="' + st.id + '"' + (cmp.place === st.id ? " selected" : "") + ">" + esc(shortName(st.ko)) + "</option>").join("") + "</select></label>",
      foot: (cmp.id ? '<button class="btn danger" type="button" data-act="sh" data-k="del">삭제</button>' : "") +
        '<span class="grow"></span><button class="btn" type="button" data-act="sh-close">취소</button><button class="btn primary" type="button" data-act="sh" data-k="save">' + (cmp.id ? "저장" : "올리기") + "</button>",
      on(k, v, btn) {
        cmpRead();
        if (k === "del") {
          if (!armDelete(btn)) return;
          deletePost(cmp.id); cmp = null; closeSheet(); render(); toast("지웠어요");
        } else if (k === "save") savePost(btn);
      }
    });
  }
  function dropPhoto(pid) {
    photoDB.del(pid).catch(() => {});
    if (urlCache[pid]) { URL.revokeObjectURL(urlCache[pid]); delete urlCache[pid]; }
  }
  function deletePost(id) {
    postPics(id).forEach(dropPhoto);
    delete state.postPhotos[id];
    state.posts = state.posts.filter((x) => x.id !== id);
    Object.keys(state.likes).forEach((k) => { if (k.indexOf(id + "|") === 0) delete state.likes[k]; });
    save();
  }
  async function savePost(btn) {
    const text = (cmp.text || "").trim();
    if (!text && !cmp.keep.length && !cmp.add.length) { toast("사진이나 글을 넣어주세요"); return; }
    btn.disabled = true;
    let p = cmp.id ? state.posts.find((x) => x.id === cmp.id) : null;
    const isNew = !p;
    if (!p) p = { id: newId("p"), at: Date.now(), by: meName() };
    const ids = cmp.keep.slice();
    if (cmp.add.length) {
      toast("사진 넣는 중…", null, 60000);
      for (const a of cmp.add) {
        try { const blob = await shrink(a.file), pid = newId("ph"); await photoDB.put(pid, blob); ids.push(pid); } catch (e) {}
        URL.revokeObjectURL(a.url);
      }
    }
    postPics(p.id).filter((x) => ids.indexOf(x) < 0).forEach(dropPhoto);
    if (ids.length) state.postPhotos[p.id] = ids; else delete state.postPhotos[p.id];
    p.text = text; p.day = cmp.day;
    if (cmp.place) p.place = cmp.place; else delete p.place;
    if (!p.by || p.by === meName()) { if (ids.length) p.ph = ids.length; else delete p.ph; }
    if (isNew) state.posts.push(p);
    cmp = null;
    save(); closeSheet();
    if (ui.logDay && ui.logDay !== "all" && ui.logDay !== p.day) { ui.logDay = p.day; saveUI(); }
    if (ui.tab !== "log") go("log"); else render();
    const el = document.getElementById("post-" + p.id);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    toast(isNew ? "올렸어요" : "고쳤어요");
  }
  /* a photo in the day's posts (viewer 지우기) */
  function removePic(pid) {
    const p = state.posts.find((x) => postPics(x.id).indexOf(pid) >= 0);
    if (!p) return;
    const arr = state.postPhotos[p.id];
    arr.splice(arr.indexOf(pid), 1);
    if (!arr.length) delete state.postPhotos[p.id];
    if (!p.by || p.by === meName()) { if (arr.length) p.ph = arr.length; else delete p.ph; }
    if (!p.text && !arr.length && !p.ph) deletePost(p.id);
    dropPhoto(pid);
  }
  document.addEventListener("scroll", (e) => {
    const el = e.target;
    if (!el || !el.classList || !el.classList.contains("pstrip")) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)), box = el.parentNode;
    const c = box.querySelector(".pcount");
    if (c) c.textContent = i + 1 + " / " + el.children.length;
    box.querySelectorAll(".pdots i").forEach((d, k) => d.classList.toggle("on", k === i));
  }, true);

  /* ---------- MONEY ---------- */
  let armedExp = null, armedTimer = null;
  function dayLabel(ts) { const t = new Date(ts); return (t.getMonth() + 1) + "." + t.getDate() + " " + "일월화수목금토"[t.getDay()]; }
  function moneyHtml() {
    const S = state.settle, ppl = S.members, c = settleCalc();
    if (ppl.indexOf(ui.payer) < 0) ui.payer = ppl[0] || "";
    let s = pageHead("정산", c.rate ? "1위안 = " + c.rate + "원" : "N빵 · 환율 계산", true);
    s += '<div class="pad"><div class="box"><span class="lbl">환율 계산</span><div style="margin-top:8px">' + fxHtml("fx") + "</div></div></div>";
    s += '<div class="sec-h"><h2>N빵 결과</h2></div><div class="pad"><div class="box">';
    if (!ppl.length) s += '<p class="note">아래 \'인원 · 환율\'에서 같이 가는 사람을 먼저 넣어주세요</p>';
    else {
      s += '<span class="lbl">총 지출</span><div class="bigsum">' + totalFmt(c) + "</div>" +
        '<p class="note">' + c.n + "명 · 1인당 " + (c.base === "KRW" ? wonFmt(c.share) : yuanFmt(c.share)) + "</p>";
      if (!S.expenses.length) s += '<p class="note xfer">지출을 넣으면 누가 누구한테 얼마 보낼지 여기 나와요</p>';
      else if (!c.xs.length) s += '<p class="note xfer">딱 맞아요. 보낼 돈이 없어요</p>';
      else c.xs.forEach((x) => { s += '<div class="xfer"><b>' + esc(x.from) + '</b><span class="note">→</span><b>' + esc(x.to) + '</b><span class="amt">' + money(x.v, c) + "</span></div>"; });
      if (c.skipped) s += '<p class="note">원화로 넣은 지출 ' + c.skipped + "건은 환율을 넣어야 합산돼요</p>";
    }
    s += "</div></div>";
    if (ppl.length) {
      s += '<div class="sec-h"><h2>지출 추가</h2></div><div class="pad"><div class="box form">' +
        '<div class="amtrow"><input id="eAmt" data-keep inputmode="decimal" placeholder="금액" aria-label="금액" autocomplete="off">' +
        '<div class="seg2" role="group" aria-label="통화"><button class="btn" type="button" data-act="cur" data-cur="CNY" aria-pressed="' + (ui.cur !== "KRW") + '">¥</button>' +
        '<button class="btn" type="button" data-act="cur" data-cur="KRW" aria-pressed="' + (ui.cur === "KRW") + '">₩</button></div></div>' +
        '<input id="eWhat" data-keep placeholder="어디에 썼는지 (예: 점심 딤섬)" aria-label="내용" autocomplete="off">' +
        '<div class="chips"><span class="lbl">낸 사람</span>' + ppl.map((p) => '<button class="btn sm chipbtn" type="button" data-act="payer" data-p="' + esc(p) + '" aria-pressed="' + (p === ui.payer) + '">' + esc(p) + "</button>").join("") + "</div>" +
        '<button class="btn primary" type="button" data-act="exp-add">추가</button></div></div>';
    }
    if (S.expenses.length) {
      const list = S.expenses.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
      let last = "";
      s += '<div class="sec-h"><h2>내역 ' + list.length + '건</h2></div><div class="pad"><div class="box" style="padding-top:4px">';
      list.forEach((e) => {
        const dl = dayLabel(e.at || 0);
        if (dl !== last) { s += '<div class="exp-day">' + dl + "</div>"; last = dl; }
        const armed = armedExp === e.id;
        s += '<div class="exp"><span class="w2"><b>' + esc(e.what || "지출") + "</b><span>" + esc(e.payer) + " 냄</span></span>" +
          '<span class="a">' + (e.cur === "KRW" ? wonFmt(+e.amt) : yuanFmt(+e.amt)) + (e.cur !== "KRW" && c.rate ? "<small>" + wonFmt(e.amt * c.rate) + "</small>" : "") + "</span>" +
          '<button class="btn sm ' + (armed ? "danger armed" : "ghost") + '" type="button" data-act="exp-del" data-id="' + e.id + '" aria-label="이 지출 지우기">' + (armed ? "지우기" : ICON.x) + "</button></div>";
      });
      s += "</div></div>";
    }
    s += '<div class="pad sec"><details class="fold" data-fold="settle-set"' + (ui.open["settle-set"] || !ppl.length ? " open" : "") +
      '><summary><span class="ft">인원 · 환율</span><span class="chev" aria-hidden="true"></span></summary><div class="fold-b form">' +
      '<label class="field"><span>같이 가는 사람 (쉼표로 구분)</span><input id="mNames" data-keep value="' + esc(ppl.join(", ")) + '" autocomplete="off"></label>' +
      '<label class="field"><span>환율 (1위안 = ?원)</span><input id="mRate" data-keep inputmode="decimal" value="' + esc(S.rate || "") + '" autocomplete="off"></label>' +
      '<button class="btn" type="button" data-act="settle-save">저장</button></div></details></div>';
    return s;
  }

  /* ---------- MORE ---------- */
  function row(act, icon, title, sub, extra) {
    return '<button class="row" type="button" data-act="' + act + '"' + (extra || "") + '><span class="ri">' + ICON[icon] + '</span><span class="rt"><b>' + title + "</b>" +
      (sub ? "<span>" + esc(sub) + "</span>" : "") + '</span><span class="chev2" aria-hidden="true">›</span></button>';
  }
  function moreHtml() {
    const h = state.hotel, legs = state.flight.legs;
    let s = pageHead("더보기", String(state.trip.dates || ""), true);
    s += '<div class="group-h">정보</div><div class="group">' +
      '<div class="row"><span class="ri">' + ICON.clock + '</span><span class="rt"><b>시차</b><span>상하이가 한국보다 1시간 느려요</span></span><span class="rv">−1h</span></div>' +
      [["경찰", "중국 현지", "110"], ["구급차", "중국 현지", "120"], ["영사콜센터", "외교부 · 24시간", "+82-2-3210-0404"]].map((x) =>
        '<button class="row" type="button" data-act="copy" data-v="' + x[2] + '"><span class="ri">' + ICON.phone + '</span><span class="rt"><b>' + x[0] + "</b><span>" + x[1] + ' · 눌러서 복사</span></span><span class="rv">' + x[2] + "</span></button>").join("") +
      state.infos.map((x) => row("info-edit", "info", esc(x.title || "정보"), x.body, ' data-id="' + x.id + '"')).join("") +
      row("info-add", "plus", "정보 추가", "") + "</div>";
    s += '<div class="group-h">메모</div><div class="group">' +
      state.memos.map((m) => { const ls = String(m.text || "").split("\n").filter((x) => x.trim()); return '<button class="row memo-row" type="button" data-act="memo-edit" data-id="' + m.id + '"><span class="ri">' + ICON.note + '</span><span class="rt"><b>' + esc(ls[0] || "메모") + "</b><span>" + esc(ls.slice(1).join(" · ") || (m.at ? dayLabel(m.at) : "")) + '</span></span><span class="chev2" aria-hidden="true">›</span></button>'; }).join("") +
      row("memo-add", "plus", "메모 추가", "") + "</div>";
    s += '<div class="group-h">참고 링크</div><div class="group links">' +
      state.prep.links.map((l) => '<div class="li"><a class="linkrow grow" href="' + esc(safeUrl(l.url)) + '"' + EXT + "><b>" + esc(l.title || hostOf(l.url)) + "</b><span>" + esc(hostOf(l.url)) + "</span></a>" +
        '<button class="icon-btn" type="button" data-act="link-edit" data-id="' + l.id + '" aria-label="' + esc(l.title) + ' 수정">' + ICON.pen + "</button></div>").join("") +
      row("link-add", "plus", "링크 추가", "") + "</div>";
    const opts = previewOpts().map((o) => [o[0], o[1] + (o[2] ? " (" + o[2] + ")" : "")]);
    const cur = ui.theme || "time";
    s += '<div class="group-h">설정</div><div class="group">' +
      '<div class="setrow"><div class="top"><span class="ri">' + ICON.moon + '</span><span class="rt"><b>화면 테마</b><span>' + (isDark() ? "지금은 밤 테마 · 화면 전체가 남색" : "지금은 낮 테마 · 위는 파란 하늘, 아래는 밝게") + "</span></span></div>" +
      '<div class="seg4" role="group" aria-label="화면 테마">' + THEMES.map((t) => '<button type="button" data-act="theme-set" data-v="' + t[0] + '" aria-pressed="' + (cur === t[0]) + '">' + ICON[t[1]] + "<span>" + t[2] + "</span></button>").join("") + "</div></div>" +
      row("w-edit-go", "grid", "홈 위젯 편집", "넣고 빼고 순서 바꾸기") +
      '<div class="setrow"><div class="top"><span class="ri">' + ICON.eye + '</span><span class="rt"><b>홈 화면 미리보기</b><span>날짜에 따라 바뀌는 홈을 미리 볼 수 있어요</span></span></div>' +
      '<label class="selbox"><select data-change="preview" aria-label="홈 화면 미리보기">' + opts.map((o) => '<option value="' + o[0] + '"' + (ui.preview === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select></label></div>" +
      row("share", "users", "친구랑 같이 쓰기", shareSub()) +
      row("backup", "download", "데이터 백업 파일 받기", "일정 · 정산 · 기록 글 (사진 빼고)") +
      '<button class="row" type="button" data-act="reset"><span class="ri">' + ICON.undo + '</span><span class="rt"><b>처음 데이터로 되돌리기</b><span>' + (sync.code ? "같이 쓰는 중이라 친구 폰도 같이 되돌아가요" : "바꾼 일정 · 정산 · 기록 글이 다 지워져요") + "</span></span></button>" +
      "</div>";
    return s;
  }

  /* ---------- render ---------- */
  const view = $("#view");
  const TABS = { home: homeHtml, plan: planHtml, log: logHtml, money: moneyHtml, more: moreHtml };
  /* clouds keep drifting from where they were when the screen is redrawn: their place comes from the clock */
  function syncClouds(root) {
    const now = Date.now() / 1000;
    root.querySelectorAll(".cl.mv").forEach((g) => {
      const d = +g.getAttribute("data-dur") || 0, ph = +g.getAttribute("data-ph") || 0;
      if (d) g.style.animationDelay = (-((now + ph) % d)).toFixed(2) + "s";
    });
  }
  function render() {
    const y = window.scrollY, keep = {};
    view.querySelectorAll("[data-keep]").forEach((el) => { if (el.id) keep[el.id] = el.value; });
    const ae = document.activeElement, focusId = ae && view.contains(ae) ? ae.id : "";
    const wl = Array.from(view.querySelectorAll(".wlist")).map((el) => el.scrollTop);
    if (!TABS[ui.tab]) ui.tab = "home";
    if (ui.tab !== "home") editing = false;
    view.innerHTML = TABS[ui.tab]();
    syncClouds(view);
    document.body.setAttribute("data-tab", ui.tab);
    Object.keys(keep).forEach((id) => { const el = document.getElementById(id); if (el && el.tagName !== "SELECT" && id !== "mNames" && id !== "mRate") el.value = keep[id]; });
    view.querySelectorAll(".wlist").forEach((el, i) => { if (wl[i]) el.scrollTop = wl[i]; });
    document.querySelectorAll(".tabbar button").forEach((b) => {
      if (b.getAttribute("data-tab") === ui.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    if (ui.tab === "plan") { fitPlan(); drawMap(); }
    if (ui.tab === "home") heroMount();
    hydratePhotos(view);
    window.scrollTo(0, y);
    if (focusId) { const f = document.getElementById(focusId); if (f) f.focus({ preventScroll: true }); }
  }
  function go(tab, opt) {
    opt = opt || {};
    ui.tab = tab;
    if (opt.day) ui.day = opt.day;
    saveUI(); render(); window.scrollTo(0, 0);
    if (opt.focus) {
      const el = document.getElementById(opt.focus);
      if (el) el.scrollIntoView({ block: "center" });
    }
  }

  /* ---------- toast ---------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg, action, ms) {
    toastEl.innerHTML = "<span>" + esc(msg) + "</span>" + (action ? '<button type="button" id="toastAct">' + esc(action.label) + "</button>" : "");
    toastEl.hidden = false;
    if (action) $("#toastAct").onclick = () => { toastEl.hidden = true; action.fn(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms || 2400);
  }
  function copyText(t, okMsg) {
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      toast(ok ? okMsg : "길게 눌러서 복사해 주세요");
    };
    try { navigator.clipboard.writeText(t).then(() => toast(okMsg), fallback); } catch (e) { fallback(); }
  }

  /* ---------- sheet (bottom panel) ---------- */
  const sheet = $("#sheet");
  let sheetCtx = null;
  function openSheet(o) {
    const same = !sheet.hidden && sheetCtx && o.key && sheetCtx.key === o.key;
    const oldBody = same ? sheet.querySelector(".sh-body") : null, top = oldBody ? oldBody.scrollTop : 0;
    sheetCtx = { on: o.on || function () {}, key: o.key || "" };
    const head = o.bare
      ? '<div class="handle" aria-hidden="true"></div><button class="sh-x" type="button" data-act="sh-close" aria-label="닫기">' + ICON.x + "</button>"
      : '<div class="sh-head"><b>' + esc(o.title) + '</b><button class="btn ghost sm" type="button" data-act="sh-close">닫기</button></div>';
    sheet.innerHTML = '<button class="sh-bg" type="button" data-act="sh-close" tabindex="-1" aria-label="닫기"></button>' +
      '<div class="sh-panel' + (same ? " still" : "") + (o.bare ? " bare" : "") + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' + head +
      '<form class="sh-body' + (o.bare ? " flush" : "") + '" id="shForm">' + o.body + "</form>" + (o.foot ? '<div class="' + (o.footCls || "sh-foot") + '">' + o.foot + "</div>" : "") + "</div>";
    sheet.classList.toggle("center", !!o.center);
    sheet.hidden = false;
    document.body.classList.add("noscroll", "sheet-open");
    hydratePhotos(sheet);
    if (top) sheet.querySelector(".sh-body").scrollTop = top;
  }
  function closeSheet() {
    sheet.hidden = true; sheet.innerHTML = ""; sheetCtx = null;
    document.body.classList.remove("noscroll", "sheet-open");
  }
  function formVals() {
    const f = $("#shForm"), o = {};
    if (!f) return o;
    new FormData(f).forEach((v, k) => { o[k] = typeof v === "string" ? v.trim() : v; });
    return o;
  }
  const footSave = (del) => (del ? '<button class="btn danger" type="button" data-act="sh" data-k="del">삭제</button>' : "") +
    '<span class="grow"></span><button class="btn" type="button" data-act="sh-close">취소</button><button class="btn primary" type="button" data-act="sh" data-k="save">저장</button>';
  function armDelete(btn) {
    if (btn.classList.contains("armed")) return true;
    btn.classList.add("armed"); btn.textContent = "정말 삭제";
    return false;
  }
  const sheetKey = () => (!sheet.hidden && sheetCtx ? sheetCtx.key : "");

  /* checklist sheet: check, add, delete in one place */
  function ckSheet(key) {
    const list = state.prep[key], doneN = list.filter((x) => state.done[x.id]).length;
    openSheet({
      key: "ck-" + key,
      center: true,
      title: CK_TITLE[key],
      body: '<div class="addline"><input id="add-' + key + '" data-addkey="' + key + '" placeholder="' + (key === "apps" ? "앱 이름 추가" : "추가할 것") + '" autocomplete="off" enterkeyhint="done" aria-label="' + CK_TITLE[key] + ' 추가">' +
        '<button class="btn primary" type="button" data-act="li-add" data-list="' + key + '">추가</button></div>' +
        '<div class="ckhead"><div class="wprog" data-prog="' + key + '"><i style="width:' + (list.length ? (doneN / list.length) * 100 : 0) + '%"></i></div><span class="mono" data-count="' + key + '">' + doneN + " / " + list.length + "</span></div>" +
        (list.length ? '<div class="cklist">' + list.map((x) => '<div class="li">' + ckHtml(x, esc(x.t)) +
          '<button class="icon-btn" type="button" data-act="li-del" data-list="' + key + '" data-id="' + x.id + '" aria-label="' + esc(x.t) + ' 지우기">' + ICON.x + "</button></div>").join("") + "</div>" : '<p class="empty">아직 비어 있어요</p>')
    });
  }
  function papagoSheet() {
    openSheet({
      title: "번역 · 파파고",
      body: '<a class="bigopt main" href="' + PAPAGO_STORE + '"><span class="ri">' + ICON.store + '</span><span class="rt"><b>파파고 앱 열기</b><span>앱스토어 파파고 화면이 뜨면 \'열기\'를 누르면 앱으로 넘어가요</span></span></a>' +
        '<a class="bigopt" href="' + PAPAGO_SHORTCUT + '"><span class="ri">' + ICON.bolt + '</span><span class="rt"><b>단축어로 바로 열기</b><span>단축어 앱에서 \'앱 열기 → Papago\' 단축어를 \'파파고\'라는 이름으로 한 번 만들어 두면, 이 버튼이 앱을 바로 열어요</span></span></a>' +
        '<a class="bigopt" href="' + PAPAGO_WEB + '"' + EXT + '><span class="ri">' + ICON.globe + '</span><span class="rt"><b>웹에서 번역</b><span>papago.naver.com · 한국어 → 중국어</span></span></a>'
    });
  }

  function photoSheet(id) {
    const f = findItem(id);
    if (!f) return;
    const it = f.item;
    openSheet({
      key: "ph-" + id,
      title: "사진 넣기",
      body: '<label class="bigopt main"><span class="ri">' + ICON.camera + '</span><span class="rt"><b>앨범에서 고르기</b><span>폰에 있는 사진을 여러 장 넣을 수 있어요</span></span><input class="vh" type="file" accept="image/*" multiple data-upload-place="' + id + '"></label>' +
        field("img", "인터넷 사진 주소", it.img, { type: "url", ph: "https://…jpg", hint: "인터넷에서 사진을 길게 눌러 '이미지 주소 복사' 한 걸 붙여넣으면 돼요" }),
      foot: (it.img ? '<button class="btn danger" type="button" data-act="sh" data-k="clear">주소 사진 빼기</button>' : "") + '<span class="grow"></span><button class="btn" type="button" data-act="sh-close">취소</button><button class="btn primary" type="button" data-act="sh" data-k="save">저장</button>',
      on(k, v) {
        if (k === "clear") { it.img = ""; delete it.imgSrc; save(); render(); detailSheet(id); toast("사진을 뺐어요"); return; }
        if (k !== "save") return;
        const u = safeUrl(v.img);
        if (v.img && !u) { toast("사진 주소를 확인해 주세요"); return; }
        if (u !== (it.img || "")) { it.img = u; delete it.imgSrc; save(); }
        render(); detailSheet(id); if (u) toast("사진을 넣었어요");
      }
    });
  }
  function hotelSheet(editing2) {
    const h = state.hotel;
    if (editing2) {
      openSheet({
        title: "숙소 수정",
        body: field("name", "숙소 이름", h.name) + field("zh", "중국어 이름 (택시용)", h.zh, { zh: 1 }) + field("addr", "중국어 주소", h.addr, { zh: 1 }) +
          field("when", "체크인 · 체크아웃", h.when, { ph: "예: 14:00 체크인 · 12:00 체크아웃" }) + field("note", "메모", h.note, { area: 1, ph: "예: 조식, 와이파이" }),
        foot: footSave(false),
        on(k, v) {
          if (k !== "save") return;
          ["name", "zh", "addr", "when", "note"].forEach((x) => { h[x] = v[x] || ""; });
          save(); closeSheet(); render(); toast("저장했어요");
        }
      });
      return;
    }
    const q = h.zh || h.addr, tm = hotelTimes(h);
    openSheet({
      title: "숙소",
      body: '<div><div style="font-size:18px;font-weight:700;line-height:1.35">' + esc(h.name || "아직 미정") + "</div>" +
        (h.zh ? '<div class="zhs">' + esc(h.zh) + "</div>" : "") + (h.addr ? '<div class="zhs" style="font-size:13px">' + esc(h.addr) + "</div>" : "") + "</div>" +
        (tm.in || tm.out ? '<div class="chips">' + (tm.in ? '<span class="minichip">체크인 ' + tm.in + "</span>" : "") + (tm.out ? '<span class="minichip">체크아웃 ' + tm.out + "</span>" : "") + "</div>" : h.when ? '<div class="kv2"><span class="k">시간</span><span class="v">' + esc(h.when) + "</span></div>" : "") +
        (h.note ? '<div class="kv2"><span class="k">메모</span><span class="v">' + esc(h.note) + "</span></div>" : "") +
        (q ? '<div class="acts3"><a class="btn primary" href="' + amap(q) + '"' + EXT + ">" + ICON.map + '고덕지도</a><a class="btn" href="' + apple(q) + '"' + EXT + '><span class="ic">' + ICON.nav + '</span>길찾기</a><button class="btn" type="button" data-act="taxi" data-id="hotel"><span class="ic">' + ICON.taxi + "</span>택시</button></div>" : ""),
      foot: '<button class="btn" type="button" data-act="sh" data-k="edit">' + ICON.pen + "수정</button><span class=\"grow\"></span>",
      on(k) { if (k === "edit") hotelSheet(true); }
    });
  }
  function flightSheet() {
    const f = state.flight;
    openSheet({
      title: "항공",
      body: f.legs.map((l) => '<div class="leg"><div class="lh"><b>' + esc(l.label || "") + "</b><span>" + esc(l.date || "") + '</span><span class="no">' + esc(l.no || "") + "</span></div>" +
        '<div class="lt"><span class="tm">' + esc(l.dep || "") + '</span><span class="ln"></span><span class="tm">' + esc(l.arr || "") + "</span></div>" +
        '<div class="la"><span>' + esc(apCode(l.from)) + " · " + esc(l.from || "") + "</span><span>" + esc(apCode(l.to)) + " · " + esc(l.to || "") + "</span></div>" +
        (l.checkin ? '<div class="lc">체크인 ' + esc(l.checkin) + "</div>" : "") +
        (l.fromZh ? '<div class="acts3" style="grid-template-columns:repeat(2,minmax(0,1fr))"><a class="btn" href="' + amap(l.fromZh) + '"' + EXT + ">" + ICON.map + '고덕지도</a><button class="btn" type="button" data-act="taxi" data-zh="' + esc(l.fromZh) + '" data-ko="' + esc(l.from) + '">' + ICON.taxi + "택시 카드</button></div>" : "") +
        "</div>").join("") + (f.note ? '<div class="kv2"><span class="k">메모</span><span class="v">' + esc(f.note) + "</span></div>" : "")
    });
  }
  function itemSheet(id, opt) {
    opt = opt || {};
    const f = id ? findItem(id) : null;
    const parent = f ? f.parent : opt.parent ? findItem(opt.parent).item : null;
    const isSpot = f ? f.kind === "spot" : !!opt.parent;
    const isNew = !f;
    const it = f ? f.item : { id: newId(isSpot ? "p" : "s"), ko: "", zh: "" };
    const dayId = f ? f.day.id : opt.parent ? findItem(opt.parent).day.id : opt.day;
    let body = '<div class="two">' + field("ko", isSpot ? "가게 이름" : "장소 이름", it.ko) + priSelect(it.pri) + "</div>" +
      field("zh", "중국어 이름 (택시·지도용)", it.zh, { zh: 1 }) +
      field("desc", "한 줄 설명", it.desc, { ph: "예: 신천지 근처 딤섬집" }) +
      field("tags", "태그 (쉼표로 구분)", (it.tags || []).join(", "), { ph: "예: 예약 필수, 현금만" }) +
      field("hours", "영업시간", it.hours, { ph: "예: 10:00–22:00, 월요일 휴무" }) +
      field("memo", "가서 할 일 · 메모", it.memo, { area: 1, ph: "예: 홍미창펀 꼭 먹기" });
    if (!isSpot) {
      body += '<label class="field"><span>날짜</span><select name="day">' + state.days.map((d) => '<option value="' + d.id + '"' + (d.id === dayId ? " selected" : "") + ">" +
          esc((isNum(d.n) ? "Day " + d.n : "귀국") + " · " + d.date + " · " + d.title) + "</option>").join("") + "</select></label>";
    }
    const apply = (v) => {
      it.ko = v.ko || it.ko || "";
      it.zh = v.zh || "";
      ["desc", "hours", "memo", "pri"].forEach((k) => { if (v[k]) it[k] = v[k]; else delete it[k]; });
      const tags = String(v.tags || "").split(/[,，]/).map((x) => x.trim()).filter(Boolean);
      if (tags.length) it.tags = tags; else delete it.tags;
      if (isNew) {
        if (isSpot) (parent.spots = parent.spots || []).push(it);
        else findDay(dayId).stops.push(it);
      } else if (!isSpot && v.day && v.day !== f.day.id && findDay(v.day)) {
        f.list.splice(f.list.indexOf(it), 1);
        findDay(v.day).stops.push(it);
        ui.day = v.day; saveUI();
      }
    };
    openSheet({
      title: isNew ? (isSpot ? "가게 추가" : "장소 추가") : (it.ko || "장소") + " 수정",
      body,
      foot: footSave(!isNew),
      on(k, v, btn) {
        if (k === "save") {
          if (!v.ko) { toast("이름을 적어주세요"); return; }
          apply(v); save(); render(); detailSheet(it.id); toast("저장했어요");
        } else if (k === "del") {
          if (!armDelete(btn)) return;
          const g = findItem(it.id);
          if (g) g.list.splice(g.idx, 1);
          delete state.done[it.id]; delete state.skip[it.id];
          save(); closeSheet(); render(); toast("지웠어요");
        } else if (k === "up" || k === "down") {
          const g = findItem(it.id), to = g.idx + (k === "up" ? -1 : 1);
          if (to < 0 || to >= g.list.length) { toast(k === "up" ? "이미 맨 위예요" : "이미 맨 아래예요"); return; }
          g.list.splice(g.idx, 1); g.list.splice(to, 0, it);
          save(); render(); toast("순서를 바꿨어요");
        } else if (k === "addspot" || k === "spot") {
          if (v.ko) { apply(v); save(); render(); }
          closeSheet();
          if (k === "addspot") itemSheet(null, { parent: it.id }); else itemSheet(btn.getAttribute("data-id"));
        }
      }
    });
  }
  function daySheet(dayId) {
    const d = findDay(dayId);
    openSheet({
      title: (isNum(d.n) ? "Day " + d.n : "귀국날") + " 수정",
      body: field("title", "제목", d.title) + field("date", "화면에 보이는 날짜", d.date, { ph: "예: 10.31 토" }) + field("iso", "실제 날짜 (홈 화면이 오늘이 며칠째인지 알아보는 데 써요)", d.iso, { type: "date" }) +
        field("wx", "날씨", d.wx, { ph: "예: 맑음 ☀️ 21°/14°" }),
      foot: footSave(false),
      on(k, v) {
        if (k !== "save") return;
        d.title = v.title || d.title; d.date = v.date || d.date; if (v.iso) d.iso = v.iso;
        if (v.wx) d.wx = v.wx; else delete d.wx;
        save(); closeSheet(); render(); toast("저장했어요");
      }
    });
  }
  function infoSheet(id) {
    const x = id ? state.infos.find((i) => i.id === id) : null;
    openSheet({
      title: x ? "정보 수정" : "정보 추가",
      body: field("title", "제목", x ? x.title : "", { ph: "예: 숙소 와이파이" }) + field("body", "내용", x ? x.body : "", { area: 1, ph: "예: ID hotel_5G / PW 12345678" }),
      foot: footSave(!!x),
      on(k, v, btn) {
        if (k === "save") {
          if (!v.title && !v.body) { toast("내용을 적어주세요"); return; }
          if (x) { x.title = v.title; x.body = v.body; } else state.infos.push({ id: newId("i"), title: v.title, body: v.body });
          save(); closeSheet(); render(); toast("저장했어요");
        } else if (k === "del") {
          if (!armDelete(btn)) return;
          state.infos = state.infos.filter((i) => i !== x); save(); closeSheet(); render(); toast("지웠어요");
        }
      }
    });
  }
  function memoSheet(id) {
    const m = id ? state.memos.find((i) => i.id === id) : null;
    openSheet({
      title: m ? "메모 수정" : "메모 추가",
      body: '<label class="field"><span class="vh">메모</span><textarea name="text" style="min-height:40vh" placeholder="자유롭게 적어두기">' + esc(m ? m.text : "") + "</textarea></label>",
      foot: footSave(!!m),
      on(k, v, btn) {
        if (k === "save") {
          if (!v.text) { toast("내용을 적어주세요"); return; }
          if (m) { m.text = v.text; m.at = Date.now(); } else state.memos.unshift({ id: newId("m"), text: v.text, at: Date.now() });
          save(); closeSheet(); render(); toast("저장했어요");
        } else if (k === "del") {
          if (!armDelete(btn)) return;
          state.memos = state.memos.filter((i) => i !== m); save(); closeSheet(); render(); toast("지웠어요");
        }
      }
    });
  }
  function linkSheet(id) {
    const l = id ? state.prep.links.find((i) => i.id === id) : null;
    openSheet({
      title: l ? "링크 수정" : "링크 추가",
      body: field("title", "이름", l ? l.title : "", { ph: "예: 디즈니랜드 공식 사이트" }) + field("url", "주소", l ? l.url : "", { type: "url", ph: "https://" }),
      foot: footSave(!!l),
      on(k, v, btn) {
        if (k === "save") {
          const u = safeUrl(v.url);
          if (!u) { toast("주소를 확인해 주세요"); return; }
          if (l) { l.title = v.title; l.url = u; } else state.prep.links.push({ id: newId("l"), title: v.title, url: u });
          save(); closeSheet(); render(); toast("저장했어요");
        } else if (k === "del") {
          if (!armDelete(btn)) return;
          state.prep.links = state.prep.links.filter((i) => i !== l); save(); closeSheet(); render(); toast("지웠어요");
        }
      }
    });
  }
  function widgetAddSheet() {
    const have = widgetList(), rest = Object.keys(WDEF).filter((k) => have.indexOf(k) < 0);
    const sizeTxt = { wide: " · 가로로 긴 위젯", big: " · 큰 위젯", tall: " · 세로로 긴 위젯", half: "" };
    openSheet({
      key: "wadd",
      title: "위젯 추가",
      body: rest.length ? rest.map((k) => '<div class="addw"><span class="ri">' + ICON[WDEF[k].icon] + '</span><span class="rt"><b>' + WDEF[k].name + "</b><span>" + WDEF[k].desc + sizeTxt[WDEF[k].size] + "</span></span>" +
        '<button class="plusb" type="button" data-act="w-add" data-w="' + k + '" aria-label="' + WDEF[k].name + ' 넣기">' + ICON.plus + "</button></div>").join("") : '<p class="empty">위젯을 다 넣었어요</p>'
    });
  }

  /* ---------- taxi card ---------- */
  const taxiEl = $("#taxi");
  let taxiZh = "";
  function openTaxi(zh, addr, ko) {
    taxiZh = zh || addr || "";
    $("#taxiZh").textContent = zh || "";
    const a = $("#taxiAddr"); a.textContent = addr || ""; a.hidden = !addr;
    $("#taxiKo").textContent = ko || "";
    taxiEl.hidden = false;
    if (taxiZh) copyText(taxiZh, "중국어 복사했어요");
  }

  /* ---------- photo viewer (day photos or a place's pictures) ---------- */
  const viewerEl = $("#viewer");
  let vSrc = null, vIdx = 0;
  function vItems() {
    if (!vSrc) return [];
    if (vSrc.kind === "place") { const f = findItem(vSrc.id); return f ? placeImgs(f.item) : []; }
    if (vSrc.kind === "post") return postPics(vSrc.id).map((p) => ({ p }));
    return dayPics(vSrc.id).map((p) => ({ p }));
  }
  function showViewer() {
    const list = vItems();
    if (!list.length) { viewerEl.hidden = true; return; }
    vIdx = Math.max(0, Math.min(vIdx, list.length - 1));
    const x = list[vIdx], img = $("#viewerImg");
    img.removeAttribute("src");
    if (x.u) img.src = x.u; else photoUrl(x.p).then((u) => { if (u) img.src = u; });
    $("#viewerCount").textContent = list.length > 1 ? vIdx + 1 + " / " + list.length : "";
    const del = $("#viewerDel"); del.classList.remove("armed"); del.textContent = x.u ? "사진 빼기" : "지우기";
    viewerEl.hidden = false;
  }
  async function putPhotos(arr, files) {
    let n = 0;
    toast("사진 넣는 중…", null, 60000);
    for (const file of files) {
      try {
        const blob = await shrink(file);
        const id = newId("ph");
        await photoDB.put(id, blob);
        arr.push(id); n++;
      } catch (e) {}
    }
    save();
    toast(n ? "사진 " + n + "장 넣었어요" : "사진을 넣지 못했어요");
    return n;
  }
  /* photos from the home widget become a photo-only post on that day */
  async function addPhotos(dayId, files) {
    const arr = [];
    await putPhotos(arr, files);
    if (!arr.length) return;
    const p = { id: newId("p"), day: dayId, at: Date.now(), by: meName(), text: "", ph: arr.length };
    state.posts.push(p); state.postPhotos[p.id] = arr;
    save(); render();
  }
  async function addPlacePhotos(id, files) {
    const arr = (state.placePhotos[id] = state.placePhotos[id] || []);
    await putPhotos(arr, files);
    render(); detailSheet(id);
  }

  /* ---------- home widget editing: remove, add, long-press drag ---------- */
  let press = null, drag = null;
  function startDrag() {
    if (!press) return;
    drag = { w: press.w, id: press.id };
    press.w.classList.add("dragging");
    press = null;
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
  }
  function endDrag() {
    if (press) { clearTimeout(press.t); press = null; }
    if (!drag) return;
    drag.w.classList.remove("dragging");
    const grid = $("#wgrid");
    if (grid) { ui.widgets = Array.from(grid.querySelectorAll(".w[data-w]")).map((el) => el.getAttribute("data-w")); saveUI(); }
    drag = null;
  }
  view.addEventListener("pointerdown", (e) => {
    if (!editing || (e.button && e.button > 0)) return;
    const w = e.target.closest("#wgrid .w[data-w]");
    if (!w || e.target.closest(".w-del")) return;
    press = { w, id: e.pointerId, x: e.clientX, y: e.clientY, t: setTimeout(startDrag, e.pointerType === "mouse" ? 120 : 260) };
  });
  document.addEventListener("pointermove", (e) => {
    if (press && e.pointerId === press.id) {
      if (Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 10) { clearTimeout(press.t); press = null; }
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const over = el && el.closest("#wgrid .w[data-w]");
    if (!over || over === drag.w) return;
    const r = over.getBoundingClientRect(), dr = drag.w.getBoundingClientRect();
    const sameRow = Math.abs(r.top - dr.top) < 12;
    const after = sameRow ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    over.parentNode.insertBefore(drag.w, after ? over.nextSibling : over);
  });
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  document.addEventListener("touchmove", (e) => { if (drag) e.preventDefault(); }, { passive: false });
  view.addEventListener("contextmenu", (e) => { if (editing && e.target.closest("#wgrid")) e.preventDefault(); });

  /* ---------- plan: swipe the map sideways to go to the day before / after ---------- */
  let ds = null;
  view.addEventListener("pointerdown", (e) => {
    if (ui.tab !== "plan" || !e.target.closest(".mapwrap") || e.target.closest(".daybar button, .mapbot")) return;
    ds = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  document.addEventListener("pointerup", (e) => {
    if (!ds || e.pointerId !== ds.id) return;
    const dx = e.clientX - ds.x, dy = e.clientY - ds.y;
    ds = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const i = state.days.indexOf(planDay()) + (dx < 0 ? 1 : -1);
    if (!state.days[i]) return;
    swallow = true;
    ui.day = state.days[i].id; saveUI(); render(); window.scrollTo(0, 0);
    const p = $(".plan"); if (p) p.classList.add(dx < 0 ? "in-r" : "in-l");
  });
  document.addEventListener("pointercancel", () => { ds = null; });

  /* ---------- plan list gestures: swipe left to delete, long-press to drag ---------- */
  let rg = null, swallow = false, openSw = null, edgeRaf = 0;
  const SW_W = 92;
  function closeSwipe(except) {
    if (openSw && openSw !== except) { openSw.style.transform = ""; openSw.parentNode.classList.remove("open"); }
    if (openSw !== except) openSw = null;
  }
  function startRowDrag() {
    if (!rg || rg.mode) return;
    const li = rg.row.closest("li");
    if (!li || !rg.row.hasAttribute("data-drag")) return;
    closeSwipe();
    rg.mode = "drag"; rg.li = li;
    li.classList.add("dragging");
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    const loop = () => {
      if (!rg || rg.mode !== "drag") { edgeRaf = 0; return; }
      const y = rg.lastY;
      if (y > window.innerHeight - 120) window.scrollBy(0, 9);
      else if (y < 110) window.scrollBy(0, -9);
      edgeRaf = requestAnimationFrame(loop);
    };
    edgeRaf = requestAnimationFrame(loop);
  }
  view.addEventListener("pointerdown", (e) => {
    swallow = false;
    if (ui.tab !== "plan" || (e.button && e.button > 0)) return;
    if (e.target.closest(".sw-del")) return;
    const row = e.target.closest(".swipe > .prow, .swipe > .srow");
    if (!row) { closeSwipe(); return; }
    rg = { row, id: e.pointerId, x0: e.clientX, y0: e.clientY, lastY: e.clientY, base: openSw === row ? -SW_W : 0, mode: null, t: setTimeout(startRowDrag, e.pointerType === "mouse" ? 260 : 380) };
  });
  document.addEventListener("pointermove", (e) => {
    if (!rg || e.pointerId !== rg.id) return;
    const dx = e.clientX - rg.x0, dy = e.clientY - rg.y0;
    rg.lastY = e.clientY;
    if (!rg.mode) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) { clearTimeout(rg.t); rg.mode = "swipe"; closeSwipe(rg.row); rg.row.style.transition = "none"; }
      else if (Math.abs(dy) > 10) { clearTimeout(rg.t); rg = null; return; }
      else return;
    }
    e.preventDefault();
    if (rg.mode === "swipe") {
      const x = Math.max(-SW_W - 30, Math.min(0, rg.base + dx));
      rg.row.style.transform = "translateX(" + x + "px)";
      rg.row.parentNode.classList.toggle("open", x < -4);
      rg.dx = dx;
      return;
    }
    if (rg.mode === "drag") {
      const ul = rg.li.parentNode, el = document.elementFromPoint(e.clientX, e.clientY);
      const over = el && el.closest("li[data-id]");
      if (!over || over === rg.li || over.parentNode !== ul) return;
      const r = over.getBoundingClientRect();
      ul.insertBefore(rg.li, e.clientY > r.top + r.height / 2 ? over.nextSibling : over);
    }
  });
  function endRowGesture() {
    if (!rg) return;
    clearTimeout(rg.t);
    const g = rg;
    rg = null;
    if (g.mode === "swipe") {
      swallow = true;
      g.row.style.transition = "";
      const x = g.base + (g.dx || 0);
      if (x < -SW_W / 2) { g.row.style.transform = "translateX(" + -SW_W + "px)"; g.row.parentNode.classList.add("open"); openSw = g.row; }
      else { g.row.style.transform = ""; g.row.parentNode.classList.remove("open"); if (openSw === g.row) openSw = null; }
    } else if (g.mode === "drag") {
      swallow = true;
      g.li.classList.remove("dragging");
      const ul = g.li.parentNode, day = planDay();
      const ids = Array.from(ul.children).map((li) => li.getAttribute("data-id"));
      const byId = {}; day.stops.forEach((s) => { byId[s.id] = s; });
      const moved = ids.map((k) => byId[k]).filter(Boolean);
      const isMaybe = ul.hasAttribute("data-maybe");
      const others = day.stops.filter((s) => (isMaybe ? s.pri !== "maybe" : s.pri === "maybe"));
      day.stops = isMaybe ? others.concat(moved) : moved.concat(others);
      save(); render(); toast("순서를 바꿨어요");
    }
  }
  document.addEventListener("pointerup", endRowGesture);
  document.addEventListener("pointercancel", () => { if (rg && rg.mode === "swipe") endRowGesture(); else if (rg) { clearTimeout(rg.t); if (rg.mode === "drag") endRowGesture(); rg = null; } });
  document.addEventListener("touchmove", (e) => { if (rg && rg.mode) e.preventDefault(); }, { passive: false });
  function deleteRow(id) {
    const f = findItem(id);
    if (!f) return;
    const list = f.list, idx = f.idx, item = f.item;
    list.splice(idx, 1);
    openSw = null;
    save(); render();
    toast("'" + (item.ko || "장소") + "' 지웠어요", { label: "되돌리기", fn: () => { list.splice(Math.min(idx, list.length), 0, item); save(); render(); } }, 5000);
  }

  /* ---------- 친구랑 같이 쓰기 (여행 코드) ----------
     Shared through a tiny Supabase table, reached only via two functions that need the trip code:
       같이: 일정 · 다녀옴/건너뛰기 · 출발 전 할 일 · 정산 · 메모 · 정보 · 링크 · 숙소/항공 · 기록 글
       각자: 필수 준비물 · 필수 앱 (and their ticks) · 사진 · 화면 설정
     Every piece is its own row (one expense, one memo, one tick, one day…), so two people changing
     different things never overwrite each other; the same piece changed twice → the later one stays.
     Offline-first: everything still saves on the phone; changes wait and go out once there's signal. */
  const CODE_ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  function syncCfg() {
    const c = window.TRIP_SYNC || {}, o = sync.cfg || {};
    return { url: String(o.url || c.url || "").trim().replace(/\/+$/, ""), key: String(o.key || c.key || "").trim() };
  }
  const syncReady = () => { const c = syncCfg(); return !!(c.url && c.key); };
  function normCode(s) {
    const t = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return t.length >= 10 ? t.slice(0, 2) + "-" + t.slice(2, 6) + "-" + t.slice(6, 10) : "";
  }
  function newCode() {
    const a = new Uint32Array(8);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 4294967295); }
    let s = "SH";
    for (let i = 0; i < 8; i++) s += CODE_ABC[a[i] % CODE_ABC.length];
    return normCode(s);
  }
  /* server times → fixed-width UTC strings ("2026-10-31T03:12:45.123456Z") so plain string compare works */
  function tsKey(s) {
    s = String(s || "");
    const m = s.match(/\.(\d+)/), us = m ? (m[1] + "000000").slice(3, 6) : "000";
    const d = new Date(s.replace(" ", "T").replace(/\.(\d+)/, (x, f) => "." + (f + "000").slice(0, 3)).replace(/([+-]\d\d)$/, "$1:00"));
    return isNaN(d) ? s : d.toISOString().slice(0, 23) + us + "Z";
  }
  const tsMinus = (k, ms) => new Date(Date.parse(k.replace(/(\.\d{3})\d+Z$/, "$1Z")) - ms).toISOString();
  const b64e = (s) => btoa(unescape(encodeURIComponent(s)));
  const b64d = (s) => decodeURIComponent(escape(atob(s)));
  function inviteLink() {
    const c = syncCfg(), fixed = window.TRIP_SYNC && window.TRIP_SYNC.url && window.TRIP_SYNC.url.replace(/\/+$/, "") === c.url;
    return location.origin + location.pathname + "#join=" + encodeURIComponent(sync.code) + (fixed ? "" : "&s=" + encodeURIComponent(b64e(JSON.stringify([c.url, c.key]))));
  }
  /* a bare code or a whole invite link (or the whole message around it); a link also carries the server */
  function parseInvite(text) {
    const t = String(text || "").trim();
    const m = t.match(/[#&?]join=([^&\s]+)/), sm = t.match(/[#&?]s=([^&\s]+)/);
    const out = { code: normCode(m ? decodeURIComponent(m[1]) : t), cfg: null };
    if (sm) { try { const a = JSON.parse(b64d(decodeURIComponent(sm[1]))); if (a && safeUrl(a[0]) && a[1]) out.cfg = { url: safeUrl(a[0]).replace(/\/+$/, ""), key: String(a[1]) }; } catch (e) {} }
    return out;
  }
  async function rpc(fn, body) {
    const c = syncCfg();
    if (!c.url || !c.key) throw new Error("noconfig");
    const h = { "Content-Type": "application/json", apikey: c.key };
    if (!/^sb_/.test(c.key)) h.Authorization = "Bearer " + c.key; /* old-style anon key (a JWT) */
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), 15000) : 0;
    try {
      const r = await fetch(c.url + "/rest/v1/rpc/" + fn, { method: "POST", headers: h, body: JSON.stringify(body), cache: "no-store", signal: ctl ? ctl.signal : undefined });
      if (!r.ok) { let t = ""; try { t = await r.text(); } catch (e) {} throw new Error("http " + r.status + " " + t.slice(0, 200)); }
      return await r.json();
    } finally { clearTimeout(tm); }
  }

  /* state ⇄ rows. Ordered lists go as one row per item plus one row for the order,
     so two people adding to the same list at once both keep what they added. */
  const LISTS = {
    day: [() => state.days, (a) => { state.days = a; }],
    todo: [() => state.prep.todo, (a) => { state.prep.todo = a; }],
    link: [() => state.prep.links, (a) => { state.prep.links = a; }],
    info: [() => state.infos, (a) => { state.infos = a; }],
    memo: [() => state.memos, (a) => { state.memos = a; }],
    post: [() => state.posts, (a) => { state.posts = a; }]
  };
  const personalIds = () => { const s = new Set(); state.prep.pack.concat(state.prep.apps).forEach((x) => s.add(x.id)); return s; };
  function flatten() {
    const m = {}, per = personalIds();
    m.trip = state.trip; m.hotel = state.hotel; m.flight = state.flight;
    Object.keys(LISTS).forEach((n) => {
      const a = LISTS[n][0]();
      a.forEach((x) => { if (!x.id) x.id = newId(n[0]); m[n + ":" + x.id] = x; });
      m["o:" + n] = a.map((x) => x.id);
    });
    m.settle = { members: state.settle.members, rate: state.settle.rate };
    state.settle.expenses.forEach((e) => { m["x:" + e.id] = e; });
    Object.keys(state.likes).forEach((k) => { if (state.likes[k]) m["like:" + k] = true; });
    Object.keys(state.done).forEach((id) => { if (state.done[id] && !per.has(id)) m["done:" + id] = true; });
    Object.keys(state.skip).forEach((id) => { if (state.skip[id]) m["skip:" + id] = true; });
    return m;
  }
  /* sort a list by the last order everyone agreed on; items the order doesn't know yet go last */
  function orderList(n) {
    let o = null;
    try { o = JSON.parse(sync.base["o:" + n] || "null"); } catch (e) {}
    if (!Array.isArray(o) || !LISTS[n]) return;
    const L = LISTS[n], at = (x) => { const i = o.indexOf(x.id); return i < 0 ? 1e6 : i; };
    L[1](L[0]().map((x, i) => [x, i]).sort((a, b) => at(a[0]) - at(b[0]) || a[1] - b[1]).map((q) => q[0]));
  }
  function applyKey(k, v) {
    const p = k.indexOf(":"), kind = p < 0 ? k : k.slice(0, p), id = p < 0 ? "" : k.slice(p + 1);
    if (LISTS[kind]) {
      const a = LISTS[kind][0](), i = a.findIndex((x) => x.id === id);
      if (!v) { if (i >= 0) a.splice(i, 1); }
      else if (i >= 0) a[i] = v;
      else { a.push(v); orderList(kind); }
      return;
    }
    switch (kind) {
      case "trip": case "hotel": case "flight": if (v && typeof v === "object") state[kind] = v; break;
      case "o": orderList(id); break;
      case "settle": if (v) { state.settle.members = v.members || []; state.settle.rate = v.rate || ""; } break;
      case "x": {
        const i = state.settle.expenses.findIndex((e) => e.id === id);
        if (!v) { if (i >= 0) state.settle.expenses.splice(i, 1); }
        else if (i >= 0) state.settle.expenses[i] = v;
        else { state.settle.expenses.push(v); state.settle.expenses.sort((a, b) => (a.at || 0) - (b.at || 0)); }
        break;
      }
      case "j": { const j = (state.journal[id] = state.journal[id] || {}); if (v) j.text = v; else delete j.text; break; } /* from a phone still on the old app */
      case "like": if (v) state.likes[id] = true; else delete state.likes[id]; break;
      case "done": if (v) state.done[id] = true; else delete state.done[id]; break;
      case "skip": if (v) state.skip[id] = true; else delete state.skip[id]; break;
    }
  }
  /* the server hands objects back with their keys re-sorted, so compare in one fixed key order */
  function s2(v) {
    if (v === undefined || typeof v === "function") return "null";
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(s2).join(",") + "]";
    return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined && typeof v[k] !== "function").map((k) => JSON.stringify(k) + ":" + s2(v[k])).join(",") + "}";
  }
  const baseOf = (k) => (sync.base[k] == null ? "null" : sync.base[k]);
  function pendingRows() {
    const cur = flatten(), rows = [];
    Object.keys(cur).forEach((k) => { if (baseOf(k) !== s2(cur[k])) rows.push({ k, v: cur[k] }); });
    Object.keys(sync.base).forEach((k) => { if (!(k in cur) && sync.base[k] !== "null") rows.push({ k, v: null }); });
    return rows;
  }

  /* don't pull changes in while someone is typing, dragging or has an edit form open —
     the form would save onto an old copy. It just waits for the next round. */
  function busy() {
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && (view.contains(ae) || sheet.contains(ae))) return true;
    if (rg || drag || press) return true;
    if (!sheet.hidden && !/^(ck-|dt-|share)/.test(sheetKey()) && sheet.querySelector(".sh-body input, .sh-body textarea, .sh-body select")) return true;
    return false;
  }
  function onLocalChange() {
    if (!sync.code) return;
    clearTimeout(syncT);
    syncT = setTimeout(syncNow, 700);
  }
  async function syncPush() {
    if (!sync.code || !syncReady()) return;
    if (pushing) { pushAgain = true; return; }
    const rows = pendingRows();
    if (!rows.length) return;
    pushing = true;
    try {
      for (let i = 0; i < rows.length; i += 400) {
        const part = rows.slice(i, i + 400);
        const res = await rpc("trip_push", { p_code: sync.code, p_rows: part, p_by: sync.me || null });
        part.forEach((r) => { sync.base[r.k] = s2(r.v); });
        (res || []).forEach((x) => { const t = tsKey(x.ts); if (!sync.ts[x.k] || t > sync.ts[x.k]) sync.ts[x.k] = t; });
      }
      sync.err = ""; sync.last = Date.now();
    } catch (e) { sync.err = String((e && e.message) || e); }
    finally {
      pushing = false; saveSync();
      if (pushAgain) { pushAgain = false; setTimeout(syncNow, 300); }
    }
  }
  async function syncPull() {
    if (!sync.code || pulling || !syncReady()) return;
    if (busy()) { pullLater = true; return; }
    pulling = true;
    try {
      const rows = await rpc("trip_pull", { p_code: sync.code, p_since: sync.cursor ? tsMinus(sync.cursor, 30000) : null });
      if (busy()) { pullLater = true; return; }
      const cur = flatten(), who = new Set();
      let changed = 0, cursor = sync.cursor;
      (rows || []).forEach((r) => {
        const ts = tsKey(r.ts), s = s2(r.v);
        if (!cursor || ts > cursor) cursor = ts;
        if (sync.ts[r.k] && sync.ts[r.k] >= ts) return;
        const mine = s2(cur[r.k]), pending = mine !== baseOf(r.k);
        sync.ts[r.k] = ts; sync.base[r.k] = s;
        if (pending || mine === s) return; /* my unsent change is newer: it goes out next and wins */
        applyKey(r.k, r.v); changed++;
        if (r.by_name && r.by_name !== sync.me) who.add(r.by_name);
      });
      sync.cursor = cursor; sync.err = ""; sync.last = Date.now();
      if (changed) {
        state = norm(state);
        if (!lsSet(LS_STATE, state)) toast("폰 저장 공간이 부족해서 저장하지 못했어요");
        redraw();
        if (who.size && Date.now() - lastToast > 45000) { lastToast = Date.now(); toast(Array.from(who).join(", ") + " 님이 바꾼 내용이 들어왔어요"); }
      }
    } catch (e) { sync.err = String((e && e.message) || e); }
    finally { pulling = false; saveSync(); }
  }
  async function syncNow() {
    await syncPush();
    await syncPull();
    if (pendingRows().length && !pushing && !sync.err) await syncPush();
    refreshSyncText();
  }
  function redraw() {
    render();
    const k = sheetKey();
    if (k.indexOf("dt-") === 0) { if (findItem(k.slice(3))) detailSheet(k.slice(3)); else closeSheet(); }
    else if (k.indexOf("ck-") === 0) ckSheet(k.slice(3));
  }
  const retry = () => { if (pullLater && sync.code) { pullLater = false; setTimeout(() => { if (!busy()) syncPull(); else pullLater = true; }, 400); } };
  document.addEventListener("focusout", retry);
  document.addEventListener("pointerup", retry);
  setInterval(() => { if (sync.code && !document.hidden) syncNow(); else refreshSyncText(); }, 10000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && sync.code) syncNow(); });
  window.addEventListener("online", () => { if (sync.code) syncNow(); });

  /* start · join · leave */
  async function createTrip() {
    Object.assign(sync, { code: newCode(), cursor: null, base: {}, ts: {}, err: "" });
    await syncPush();
    if (sync.err || pendingRows().length) { const e = sync.err || "push"; Object.assign(sync, { code: "", base: {}, ts: {}, err: "" }); saveSync(); throw new Error(e); }
    await syncPull();
  }
  async function joinTrip(code) {
    const rows = await rpc("trip_pull", { p_code: code, p_since: null });
    if (!(rows || []).some((r) => r.v !== null)) throw new Error("nocode");
    /* the shared half comes from the trip; my own packing list, apps and photos stay as they are */
    const per = personalIds();
    if (rows.some((r) => r.k.indexOf("day:") === 0 && r.v)) state.days = [];
    state.prep.todo = []; state.prep.links = []; state.infos = []; state.memos = []; state.settle.expenses = []; state.posts = []; state.likes = {};
    Object.keys(state.journal).forEach((d) => { if (state.journal[d]) delete state.journal[d].text; });
    Object.keys(state.done).forEach((id) => { if (!per.has(id)) delete state.done[id]; });
    state.skip = {};
    Object.assign(sync, { code, cursor: null, base: {}, ts: {}, err: "" });
    rows.forEach((r) => {
      const ts = tsKey(r.ts);
      sync.base[r.k] = s2(r.v); sync.ts[r.k] = ts;
      if (!sync.cursor || ts > sync.cursor) sync.cursor = ts;
    });
    rows.forEach((r) => applyKey(r.k, r.v));
    Object.keys(LISTS).forEach(orderList);
    state = norm(state);
    lsSet(LS_STATE, state);
    sync.last = Date.now();
    saveSync();
    render();
  }
  function leaveTrip() { Object.assign(sync, { code: "", cursor: null, base: {}, ts: {}, err: "" }); saveSync(); }

  function syncStatus() {
    if (!sync.code) return "";
    const n = pendingRows().length;
    if (sync.err) return (/noconfig/.test(sync.err) ? "저장소 연결 정보가 없어요" : "지금은 연결이 안 돼요") + (n ? " · 보낼 것 " + n + "개 대기 중" : "") + " · 연결되면 알아서 맞춰요";
    if (!sync.last) return "맞추는 중…";
    const s = Math.round((Date.now() - sync.last) / 1000);
    return (s < 60 ? "방금" : s < 3600 ? Math.round(s / 60) + "분 전" : Math.round(s / 3600) + "시간 전") + " 맞췄어요" + (n ? " · 보낼 것 " + n + "개" : "");
  }
  const shareSub = () => (sync.code ? sync.code + " · " + syncStatus() : "여행 코드로 친구랑 연결");
  function refreshSyncText() {
    const st = document.getElementById("syncSt");
    if (st) st.textContent = syncStatus();
    const r = view.querySelector('[data-act="share"] .rt span');
    if (r) r.textContent = shareSub();
  }
  const SHARE_INFO = '<div class="shinfo"><div><b>같이 보는 것</b><span>일정 · 다녀옴/건너뛰기 · 출발 전 할 일 · 정산 · 메모 · 정보 · 링크 · 숙소/항공 · 기록 글</span></div>' +
    "<div><b>각자 따로</b><span>필수 준비물 · 필수 앱 체크 · 사진 · 화면 설정</span></div></div>";
  function meChips() {
    const ms = state.settle.members || [];
    if (!ms.length) return "";
    return '<div class="field"><span>나는 누구?</span><div class="chips">' + ms.map((p) => '<button class="btn sm chipbtn" type="button" data-act="sync-me" data-p="' + esc(p) + '" aria-pressed="' + (sync.me === p) + '">' + esc(p) + "</button>").join("") + "</div></div>";
  }
  function joinBox(prefill, ph) {
    return '<div class="addline"><input id="joinCode" placeholder="' + ph + '" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(prefill || "") + '"><button class="btn primary" type="button" data-act="sync-join">참여</button></div>';
  }
  function shareSheet(prefill) {
    const c = syncCfg();
    let body;
    if (sync.code) {
      body = '<div class="codebox"><span class="lbl">우리 여행 코드</span><b class="mono">' + esc(sync.code) + '</b><span class="sub" id="syncSt">' + esc(syncStatus()) + "</span></div>" +
        '<div class="shbtns"><button class="btn primary" type="button" data-act="sync-invite">' + ICON.users + "초대 보내기</button>" +
        '<button class="btn" type="button" data-act="sync-now">' + ICON.sync + "지금 맞추기</button></div>" +
        meChips() + SHARE_INFO +
        '<button class="btn ghost danger" type="button" data-act="sync-leave">이 폰에서 같이 쓰기 그만두기</button>';
    } else if (!c.url || !c.key) {
      body = '<p class="note">친구한테 받은 초대 링크가 있으면 붙여넣고 참여를 누르면 끝이에요.</p>' + meChips() +
        joinBox(prefill, "초대 링크 붙여넣기") +
        '<details class="fold"><summary><span class="ft">처음 시작하는 사람 · 저장소 연결</span><span class="chev" aria-hidden="true"></span></summary><div class="fold-b form">' +
        '<p class="note">무료 Supabase 프로젝트 하나가 필요해요. 만드는 법은 GitHub 저장소의 SUPABASE_SETUP.md에 있어요.</p>' +
        field("surl", "Project URL", c.url, { ph: "https://xxxx.supabase.co" }) + field("skey", "Publishable key", c.key, { ph: "sb_publishable_…" }) +
        '<button class="btn primary" type="button" data-act="sync-cfg">연결</button></div></details>' + SHARE_INFO;
    } else {
      body = meChips() +
        '<button class="bigopt main" type="button" data-act="sync-create"><span class="ri">' + ICON.plus + '</span><span class="rt"><b>새 여행 코드 만들기</b><span>지금 이 폰에 있는 일정으로 시작해요</span></span></button>' +
        '<div class="ordiv"><span>친구가 이미 만들었으면</span></div>' +
        joinBox(prefill, "SH-XXXX-XXXX 또는 초대 링크") +
        '<p class="note">참여하면 일정 · 정산 같은 같이 보는 내용이 친구 것으로 바뀌어요. 준비물 · 앱 체크랑 사진은 그대로예요.</p>' + SHARE_INFO +
        '<button class="btn ghost sm" type="button" data-act="sync-cfgclear">저장소 연결 바꾸기</button>';
    }
    openSheet({ key: "share", title: "친구랑 같이 쓰기", body });
  }
  async function onSyncAct(act, t) {
    if (act === "sync-me") { sync.me = t.getAttribute("data-p"); saveSync(); shareSheet(document.getElementById("joinCode") ? document.getElementById("joinCode").value : ""); return; }
    if (act === "sync-now") {
      t.disabled = true; await syncNow(); t.disabled = false;
      toast(sync.err ? "지금은 연결이 안 돼요 · 연결되면 알아서 맞춰요" : "맞췄어요");
      return;
    }
    if (act === "sync-cfg") {
      const v = formVals(), url = safeUrl(v.surl).replace(/\/+$/, "");
      if (!url || !v.skey) { toast("URL이랑 키를 둘 다 넣어주세요"); return; }
      sync.cfg = { url, key: v.skey }; saveSync();
      t.disabled = true;
      try { await rpc("trip_pull", { p_code: "SH-TEST-0000", p_since: null }); shareSheet(); toast("저장소랑 연결됐어요"); }
      catch (e) { t.disabled = false; toast(/http 404/.test(e.message) ? "연결은 됐는데 SQL을 아직 안 돌린 것 같아요" : /http 401|http 403/.test(e.message) ? "키가 맞지 않아요" : "연결이 안 돼요 · URL을 확인해 주세요", null, 4000); }
      return;
    }
    if (act === "sync-cfgclear") { sync.cfg = null; saveSync(); shareSheet(); return; }
    const needMe = () => { if (!sync.me && (state.settle.members || []).length) { toast("'나는 누구?'를 먼저 골라주세요"); return true; } return false; };
    if (act === "sync-create") {
      if (needMe()) return;
      t.disabled = true;
      try { await createTrip(); shareSheet(); render(); toast("여행 코드를 만들었어요 · 초대 보내기로 친구한테 보내세요", null, 4000); }
      catch (e) { t.disabled = false; toast("코드를 만들지 못했어요 · 인터넷이랑 저장소 연결을 확인해 주세요", null, 4000); }
      return;
    }
    if (act === "sync-join") {
      const inp = document.getElementById("joinCode"), inv = parseInvite(inp ? inp.value : "");
      if (!inv.code) { toast("코드를 확인해 주세요 (SH-XXXX-XXXX)"); return; }
      if (needMe()) return;
      if (inv.cfg) { sync.cfg = inv.cfg; saveSync(); }
      if (!syncReady()) { toast("코드만으로는 안 돼요 · 초대 링크를 통째로 붙여넣어 주세요", null, 4000); return; }
      t.disabled = true;
      try { await joinTrip(inv.code); shareSheet(); toast("같이 쓰기 시작! " + inv.code); }
      catch (e) { t.disabled = false; toast(/nocode/.test(e.message) ? "그 코드로 된 여행을 못 찾았어요" : "연결이 안 돼요 · 잠시 후 다시 해주세요", null, 4000); }
      return;
    }
    if (act === "sync-invite") {
      const link = inviteLink(), text = "상하이 여행 앱 같이 쓰자! 앱 → 더보기 → 친구랑 같이 쓰기 → 아래 링크 통째로 붙여넣기\n" + link;
      if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      copyText(text, "초대 메시지를 복사했어요 · 카톡에 붙여넣어 보내세요");
      return;
    }
    if (act === "sync-leave") {
      if (!t.classList.contains("armed")) { t.classList.add("armed"); t.textContent = "한 번 더 누르면 그만둬요 · 이 폰 내용은 그대로"; return; }
      leaveTrip(); shareSheet(); render(); toast("같이 쓰기를 그만뒀어요");
    }
  }
  /* opened from an invite link: keep the server info, then show the join box */
  function takeInviteFromUrl() {
    if (!/[#&]join=/.test(location.hash)) return;
    const full = location.href, inv = parseInvite(full);
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    if (!inv.code) return;
    if (sync.code === inv.code) { toast("이미 이 여행 코드로 같이 쓰고 있어요"); return; }
    if (inv.cfg && !sync.code) { sync.cfg = inv.cfg; saveSync(); }
    if (sync.code) { shareSheet(); toast("지금은 다른 여행 코드에 연결돼 있어요 · 그만두기 후 참여해 주세요", null, 5000); return; }
    shareSheet(full);
  }

  /* ---------- events ---------- */
  document.addEventListener("submit", (e) => e.preventDefault());
  document.addEventListener("click", (e) => {
    /* in edit mode, widgets only move or come out — nothing inside them fires */
    if (editing && e.target.closest("#wgrid") && !e.target.closest(".w-del, .w-add")) { e.preventDefault(); return; }
    /* ticking a box inside a checklist widget shouldn't also open the big list */
    if (e.target.closest(".wck")) return;
    if (swallow) { swallow = false; e.preventDefault(); return; }
    if (openSw && !e.target.closest(".sw-del")) { const was = openSw; closeSwipe(); if (e.target.closest(".swipe") && was.contains(e.target)) { e.preventDefault(); return; } }
    const lk = e.target.closest("a[href]");
    if (lk && !lk.hasAttribute("data-act")) return;
    const t = e.target.closest("[data-act], [data-href]");
    if (!t) return;
    if (!t.hasAttribute("data-act")) { window.open(t.getAttribute("data-href"), "_blank", "noopener"); return; }
    const act = t.getAttribute("data-act"), id = t.getAttribute("data-id");
    if (act.indexOf("sync-") === 0) { onSyncAct(act, t); return; }
    switch (act) {
      case "tab": closeSheet(); editing = false; go(t.getAttribute("data-tab")); return;
      case "go-plan": closeSheet(); go("plan", { day: t.getAttribute("data-day") }); return;
      case "go-log": ui.logDay = t.getAttribute("data-day") || "all"; go("log"); return;
      case "log-day": ui.logDay = t.getAttribute("data-v") || "all"; saveUI(); render(); { const c = $(".lchips"); if (c) window.scrollTo({ top: Math.max(0, c.getBoundingClientRect().top + window.scrollY - 70) }); } return;
      case "post-new": postSheet(null, t.getAttribute("data-day") || null); return;
      case "post-edit": postSheet(id); return;
      case "post-view": vSrc = { kind: "post", id }; vIdx = +t.getAttribute("data-i") || 0; showViewer(); return;
      case "post-like": {
        const k = id + "|" + (meName() || "나");
        if (state.likes[k]) delete state.likes[k]; else state.likes[k] = true;
        save(); render(); return;
      }
      case "cmp-day": cmpRead(); cmp.day = t.getAttribute("data-v"); { const d = findDay(cmp.day); if (!d || !d.stops.some((x) => x.id === cmp.place)) cmp.place = ""; } drawPostSheet(); return;
      case "cmp-rm": cmpRead(); cmp[t.getAttribute("data-k")].splice(+t.getAttribute("data-i"), 1); drawPostSheet(); return;
      case "day-step": {
        const i = state.days.indexOf(planDay()) + (+t.getAttribute("data-d") || 0);
        if (state.days[i]) { ui.day = state.days[i].id; saveUI(); render(); window.scrollTo(0, 0); const p = $(".plan"); if (p) p.classList.add(+t.getAttribute("data-d") > 0 ? "in-r" : "in-l"); }
        return;
      }
      case "w-edit": editing = !editing; render(); if (editing) { const z = $("#wzone"); if (z) window.scrollTo({ top: z.getBoundingClientRect().top + window.scrollY - 8, behavior: "smooth" }); } return;
      case "w-edit-go": editing = true; go("home"); { const z = $("#wzone"); if (z) window.scrollTo({ top: z.getBoundingClientRect().top + window.scrollY - 8 }); } return;
      case "w-del": {
        const w = t.getAttribute("data-w");
        ui.widgets = widgetList().filter((x) => x !== w); saveUI(); render();
        toast(WDEF[w].name + " 위젯을 뺐어요 · 내용은 그대로 있어요", { label: "되돌리기", fn: () => { ui.widgets.push(w); saveUI(); render(); } }, 4000);
        return;
      }
      case "w-addsheet": widgetAddSheet(); return;
      case "trip-sum": tripSumSheet(); return;
      case "preview-pick": previewSheet(); return;
      case "preview-set": ui.preview = t.getAttribute("data-v") || "auto"; saveUI(); closeSheet(); render(); window.scrollTo(0, 0); return;
      case "w-add": {
        const w = t.getAttribute("data-w"), list = widgetList();
        if (list.indexOf(w) < 0) list.push(w);
        ui.widgets = list; saveUI(); render(); widgetAddSheet(); toast(WDEF[w].name + " 위젯을 넣었어요");
        return;
      }
      case "ck-sheet": ckSheet(t.getAttribute("data-list")); return;
      case "row-del": deleteRow(id); return;
      case "photo-sheet": photoSheet(id); return;
      case "to-widgets": { const z = $("#wzone"); if (z) window.scrollTo({ top: z.getBoundingClientRect().top + window.scrollY - 8, behavior: "smooth" }); return; }
      case "hc-step": { const hc = $("#hc"); if (hc) hc.scrollBy({ left: (+t.getAttribute("data-d") || 0) * hc.clientWidth, behavior: "smooth" }); return; }
      case "detail": detailSheet(id); return;
      case "mark-done":
      case "dt-done": {
        setDone(id, true);
        if (act === "dt-done") refreshDetail(id); else render();
        toast("다녀왔어요 ✓", { label: "되돌리기", fn: () => { setDone(id, false); refreshDetail(id); } }, 4000);
        return;
      }
      case "mark-skip":
      case "dt-skip": {
        setSkip(id, true);
        if (act === "dt-skip") refreshDetail(id); else render();
        toast("건너뛰었어요 · 다녀온 곳엔 안 들어가요", { label: "되돌리기", fn: () => { setSkip(id, false); refreshDetail(id); } }, 4500);
        return;
      }
      case "dt-undone": setDone(id, false); refreshDetail(id); return;
      case "dt-unskip": setSkip(id, false); refreshDetail(id); return;
      case "add-spot": closeSheet(); itemSheet(null, { parent: id }); return;
      case "view-place": vSrc = { kind: "place", id }; vIdx = 0; showViewer(); return;
      case "taxi": {
        if (id === "hotel") { const h = state.hotel; openTaxi(h.zh, h.addr, h.name); return; }
        if (!id) { openTaxi(t.getAttribute("data-zh"), "", t.getAttribute("data-ko")); return; }
        const f = findItem(id); if (f) openTaxi(f.item.zh || f.item.q, f.item.addr, f.item.ko);
        return;
      }
      case "taxi-copy": if (taxiZh) copyText(taxiZh, "중국어 복사했어요"); return;
      case "taxi-close": taxiEl.hidden = true; return;
      case "edit": itemSheet(id); return;
      case "add-stop": itemSheet(null, { day: t.getAttribute("data-day") }); return;
      case "edit-day": daySheet(t.getAttribute("data-day")); return;
      case "hotel": hotelSheet(false); return;
      case "flight": flightSheet(); return;
      case "papago": papagoSheet(); return;
      case "theme-set": ui.theme = t.getAttribute("data-v"); saveUI(); applyTheme(); render(); return;
      case "sh-close": closeSheet(); return;
      case "sh": if (sheetCtx) sheetCtx.on(t.getAttribute("data-k"), formVals(), t); return;
      case "view": vSrc = { kind: "day", id: t.getAttribute("data-day") }; vIdx = +t.getAttribute("data-i") || 0; showViewer(); return;
      case "viewer-prev": vIdx = vIdx > 0 ? vIdx - 1 : vItems().length - 1; showViewer(); return;
      case "viewer-next": vIdx = vIdx + 1 >= vItems().length ? 0 : vIdx + 1; showViewer(); return;
      case "viewer-close": viewerEl.hidden = true; return;
      case "viewer-del": {
        if (!armDelete(t)) return;
        const x = vItems()[vIdx];
        if (!x) return;
        if (x.u) { const f = findItem(vSrc.id); if (f) { f.item.img = ""; delete f.item.imgSrc; } }
        else if (vSrc.kind === "place") {
          const arr = state.placePhotos[vSrc.id] || [];
          const k = arr.indexOf(x.p); if (k >= 0) arr.splice(k, 1);
          dropPhoto(x.p);
        } else removePic(x.p);
        save(); render();
        if (vSrc.kind === "place" && sheetKey() === "dt-" + vSrc.id) detailSheet(vSrc.id);
        showViewer(); toast("사진을 뺐어요");
        return;
      }
      case "cur": ui.cur = t.getAttribute("data-cur"); saveUI(); render(); return;
      case "payer": ui.payer = t.getAttribute("data-p"); saveUI(); render(); return;
      case "exp-add": {
        const amtEl = $("#eAmt"), whatEl = $("#eWhat");
        const amt = parseFloat(String(amtEl.value).replace(/[,\s]/g, ""));
        if (!(amt > 0)) { toast("금액을 넣어주세요"); amtEl.focus(); return; }
        state.settle.expenses.push({ id: newId("x"), amt, cur: ui.cur === "KRW" ? "KRW" : "CNY", what: whatEl.value.trim(), payer: ui.payer, at: Date.now() });
        amtEl.value = ""; whatEl.value = "";
        save(); render(); toast("추가했어요");
        return;
      }
      case "exp-del": {
        clearTimeout(armedTimer);
        if (armedExp !== id) { armedExp = id; render(); armedTimer = setTimeout(() => { armedExp = null; render(); }, 3500); return; }
        armedExp = null;
        state.settle.expenses = state.settle.expenses.filter((x) => x.id !== id);
        save(); render(); toast("지웠어요");
        return;
      }
      case "settle-save": {
        const names = $("#mNames").value.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
        const rate = parseFloat(String($("#mRate").value).replace(/[,\s]/g, ""));
        state.settle.members = Array.from(new Set(names));
        state.settle.rate = rate > 0 ? rate : 0;
        save(); render(); toast("저장했어요");
        return;
      }
      case "li-add": {
        const key = t.getAttribute("data-list"), inp = document.getElementById("add-" + key), v = inp ? inp.value.trim() : "";
        if (!v) { if (inp) inp.focus(); return; }
        state.prep[key].push(key === "apps" ? { id: newId("a"), t: v, u: "" } : { id: newId(key === "todo" ? "t" : "k"), t: v });
        save(); render(); ckSheet(key);
        const again = document.getElementById("add-" + key); if (again) again.focus();
        return;
      }
      case "li-del": {
        const key = t.getAttribute("data-list");
        state.prep[key] = state.prep[key].filter((x) => x.id !== id);
        delete state.done[id];
        save(); render(); ckSheet(key); toast("지웠어요");
        return;
      }
      case "copy": copyText(t.getAttribute("data-v"), "복사했어요: " + t.getAttribute("data-v")); return;
      case "info-add": infoSheet(null); return;
      case "info-edit": infoSheet(id); return;
      case "memo-add": memoSheet(null); return;
      case "memo-edit": memoSheet(id); return;
      case "link-add": linkSheet(null); return;
      case "link-edit": linkSheet(id); return;
      case "share": shareSheet(); return;
      case "backup": {
        const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "shanghai-trip-backup-" + todayIso() + ".json";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        return;
      }
      case "reset": {
        if (!t.classList.contains("armed")) {
          t.classList.add("armed"); t.style.background = "var(--coral-soft)";
          t.querySelector("b").textContent = "한 번 더 누르면 되돌려요";
          setTimeout(() => render(), 4000);
          return;
        }
        state = norm(clone(window.TRIP_SEED)); save(); render(); toast("처음 데이터로 되돌렸어요");
        return;
      }
    }
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.hasAttribute("data-ck")) {
      const id = t.getAttribute("data-ck"), on = t.checked;
      if (on) state.done[id] = true; else delete state.done[id];
      save();
      document.querySelectorAll('[data-ck="' + id + '"]').forEach((el) => { el.checked = on; const l = el.closest("label"); if (l) l.classList.toggle("on", on); });
      const key = Object.keys(CK_TITLE).find((k) => state.prep[k].some((x) => x.id === id));
      if (key) {
        const list = state.prep[key], n = list.filter((x) => state.done[x.id]).length;
        document.querySelectorAll('[data-prog="' + key + '"] i').forEach((i) => { i.style.width = (list.length ? (n / list.length) * 100 : 0) + "%"; });
        document.querySelectorAll('[data-count="' + key + '"]').forEach((c) => { c.textContent = n + " / " + list.length; });
      }
      return;
    }
    if (t.hasAttribute("data-post-pick")) {
      const files = Array.from(t.files || []);
      t.value = "";
      if (files.length && cmp) { cmpRead(); files.forEach((f) => cmp.add.push({ file: f, url: URL.createObjectURL(f) })); drawPostSheet(); }
      return;
    }
    if (t.hasAttribute("data-upload")) {
      const files = Array.from(t.files || []);
      t.value = "";
      if (files.length) addPhotos(t.getAttribute("data-upload"), files);
      return;
    }
    if (t.hasAttribute("data-upload-place")) {
      const files = Array.from(t.files || []);
      t.value = "";
      if (files.length) addPlacePhotos(t.getAttribute("data-upload-place"), files);
      return;
    }
    if (t.getAttribute("data-change") === "preview") {
      ui.preview = t.value; saveUI();
      toast("홈 화면이 바뀌었어요", { label: "홈 보기", fn: () => go("home") }, 4000);
    }
  });

  const jTimers = {};
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.hasAttribute("data-fx")) {
      const rate = +state.settle.rate || 0, v = parseFloat(String(t.value).replace(/[,\s]/g, ""));
      const box = t.closest(".fxpair"), y = t.getAttribute("data-fx") === "y";
      const other = box && box.querySelector('[data-fx="' + (y ? "w" : "y") + '"]');
      if (!rate || !other) return;
      if (y) other.value = isNaN(v) ? "" : Math.round(v * rate).toLocaleString("ko-KR");
      else other.value = isNaN(v) ? "" : (Math.round((v / rate) * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
    }
  });

  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.matches || !d.matches("details[data-fold]")) return;
    ui.open[d.getAttribute("data-fold")] = d.open; saveUI();
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.hasAttribute && e.target.hasAttribute("data-addkey")) {
      e.preventDefault();
      const b = sheet.querySelector('[data-act="li-add"][data-list="' + e.target.getAttribute("data-addkey") + '"]');
      if (b) b.click();
      return;
    }
    if (e.key !== "Escape") return;
    if (!taxiEl.hidden) taxiEl.hidden = true;
    else if (!viewerEl.hidden) viewerEl.hidden = true;
    else if (!sheet.hidden) closeSheet();
    else if (editing) { editing = false; render(); }
  });

  let rsz;
  window.addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => { if (ui.tab === "plan") { fitPlan(); drawMap(); } }, 150); });

  /* ---------- start ---------- */
  const setAppH = () => { document.documentElement.style.setProperty("--app-h", window.innerHeight + "px"); };
  setAppH();
  window.addEventListener("resize", setAppH);
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = ICON[el.getAttribute("data-icon")] || ""; });
  applyTheme();
  render();
  takeInviteFromUrl();
  if (sync.code) setTimeout(syncNow, 400);
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (ui.tab === "plan") { fitPlan(); drawMap(); } }); } catch (e) {}
  setInterval(applyTheme, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { applyTheme(); if (ui.tab === "home" && !editing) render(); } });
  if (mqDark) { try { mqDark.addEventListener("change", applyTheme); } catch (e) { try { mqDark.addListener(applyTheme); } catch (e2) {} } }

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            toast("새 버전이 있어요", { label: "새로고침", fn: () => location.reload() }, 10000);
          }
        });
      });
    }).catch(() => {});
  }
})();
