/* 상하이 여행 앱 — 홈(위젯) / 일정(지도) / 기록 / 정산 / 더보기.
   Everything is stored on this phone for now (localStorage + IndexedDB for photos);
   the trip-code sharing step will swap the storage layer, not the screens. */
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
  const PAPAGO = "https://papago.naver.com/?sk=ko&tk=zh-CN";
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
    bed: I('<path d="M3.5 18.5V6M3.5 14h17v4.5M20.5 14v-2.5a3 3 0 0 0-3-3h-7v5.5"/><circle cx="7" cy="10.8" r="1.8"/>'),
    plane: I('<path d="M10.5 20.5 12.5 14 6 16l-1.5-1.5 6-4.5-1-6.5L11 3l3.5 6.5 5-1.5a1.5 1.5 0 0 1 1 2.8L15 13l-1.5 6z"/>'),
    planeF: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 15.5v-2l-7.5-4.5V4.2a1.5 1.5 0 0 0-3 0V9L3 13.5v2l7.5-2.3v5l-2.2 1.6V21l3.7-1 3.7 1v-1.2l-2.2-1.6v-5z"/></svg>',
    globe: I('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.6 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.6-3.5-8.5S9.5 6.1 12 3.5z"/>'),
    camera: I('<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13.2" r="3.3"/>'),
    list: I('<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="m3.5 6.5 1.2 1.2L7 5.4M3.5 12l1.2 1.2L7 10.9M3.5 17.5l1.2 1.2L7 16.4"/>'),
    bag: I('<rect x="4" y="7.5" width="16" height="12.5" rx="2"/><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2"/>'),
    phone: I('<rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M11 17.5h2"/>'),
    info: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>'),
    note: I('<path d="M6 3.5h9l4 4v13H6z"/><path d="M14.5 3.5v4.5h4.5M9 12h7M9 15.5h5"/>'),
    link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    eye: I('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
    moon: I('<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>'),
    grid: I('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'),
    users: I('<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.8a3 3 0 0 1 0 5.4M17.5 14a5 5 0 0 1 3 5"/>'),
    download: I('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'),
    undo: I('<path d="M8.5 6 4 10.5 8.5 15"/><path d="M4 10.5h10a6 6 0 0 1 0 12h-3"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>', 2.2),
    x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
    clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>')
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
    /* map points came later: fill them in from the seed for places saved before */
    const seed = seedById();
    const fill = (it) => {
      const s = seed[it.id];
      if (!s) return;
      if (!it.ll && s.ll) it.ll = s.ll;
      if (it.far == null && s.far) it.far = true;
      if (!it.q && s.q) it.q = s.q;
    };
    d.days.forEach((x) => x.stops.forEach((s) => { fill(s); (s.spots || []).forEach(fill); }));
    if (!d.hotel.ll && window.TRIP_SEED.hotel.ll && d.hotel.zh === window.TRIP_SEED.hotel.zh) d.hotel.ll = window.TRIP_SEED.hotel.ll;
    return d;
  }
  let state = norm(lsGet(LS_STATE) || clone(window.TRIP_SEED));
  const W_DEFAULT = ["next", "weather", "hotel", "flight", "todo", "route"];
  const ui = Object.assign({ tab: "home", day: null, preview: "auto", open: {}, cur: "CNY", payer: "", theme: "time" }, lsGet(LS_UI) || {});
  ui.open = ui.open || {};
  function save() {
    state.savedAt = Date.now();
    if (!lsSet(LS_STATE, state)) toast("폰 저장 공간이 부족해서 저장하지 못했어요");
  }
  function saveUI() { lsSet(LS_UI, ui); }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  /* ---------- 낮 / 밤 테마 ---------- */
  const mqDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const THEMES = [["time", "시간 따라 · 저녁 6시부터 밤 테마"], ["system", "폰 설정 따라 · 다크 모드면 밤"], ["light", "항상 낮 테마"], ["dark", "항상 밤 테마"]];
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
    if (root.getAttribute("data-theme") === t) return;
    root.setAttribute("data-theme", t);
    const m = document.getElementById("themeColor");
    if (m) m.setAttribute("content", t === "dark" ? "#0B1030" : "#F1EFFB");
    if (ui.tab === "plan" && view) mountMap(); /* tiles + route colour follow the theme */
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
    return '<label class="' + (cls || "ck") + '"><input type="checkbox" data-ck="' + x.id + '"' + (state.done[x.id] ? " checked" : "") + "><span>" + (label || esc(x.t)) + "</span></label>";
  }
  function field(name, label, value, o) {
    o = o || {};
    const a = ' name="' + name + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") + (o.zh ? ' class="zhin"' : "") + (o.mode ? ' inputmode="' + o.mode + '"' : "") + ' autocomplete="off"';
    const ctl = o.area ? "<textarea" + a + ">" + esc(value) + "</textarea>" : '<input type="' + (o.type || "text") + '"' + a + ' value="' + esc(value) + '">';
    return '<label class="field"><span>' + label + "</span>" + ctl + "</label>";
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

  /* ---------- mini map (widget + no-internet fallback) ---------- */
  const RIVER = [[31.262, 121.53], [31.252, 121.505], [31.246, 121.4945], [31.239, 121.4935], [31.23, 121.4975], [31.22, 121.5005], [31.21, 121.4975], [31.202, 121.4885], [31.196, 121.4775], [31.189, 121.465], [31.18, 121.455]];
  function mapPts(day) {
    const ph = phase(), vis = visible(day), next = ph.k === "during" && ph.day === day ? nextOf(day) : null;
    return vis.map((st, i) => ({ it: st, n: i + 1, ll: st.ll, far: !!st.far, next: next && next.id === st.id, ok: isDone(st.id), sk: isSkip(st.id) })).filter((p) => p.ll && placeOf(p.it));
  }
  function miniMap(day, W, H, o) {
    o = o || {};
    const pts = mapPts(day).filter((p) => !p.far);
    if (!pts.length) return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true"></svg>';
    const kx = Math.cos(31.22 * Math.PI / 180);
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    pts.forEach((p) => { a = Math.min(a, p.ll[0]); b = Math.max(b, p.ll[0]); c = Math.min(c, p.ll[1]); d = Math.max(d, p.ll[1]); });
    const pd = o.pad || 22, sx = Math.max((d - c) * kx, 0.01), sy = Math.max(b - a, 0.01);
    const s = Math.min((W - 2 * pd) / sx, (H - 2 * pd) / sy), cy = (a + b) / 2, cx = (c + d) / 2;
    const P = (ll) => [(W / 2 + (ll[1] - cx) * kx * s).toFixed(1), (H / 2 - (ll[0] - cy) * s).toFixed(1)];
    const line = (arr) => arr.map((ll, i) => (i ? "L" : "M") + P(ll).join(" ")).join(" ");
    const rw = Math.max(6, 0.0036 * s).toFixed(1), r = o.r || 7;
    let g = '<path class="mm-river" d="' + line(RIVER) + '" fill="none" stroke-width="' + rw + '" stroke-linecap="round" stroke-linejoin="round"/>';
    if (pts.length > 1) g += '<path class="mm-route" d="' + line(pts.map((p) => p.ll)) + '" fill="none" stroke-width="2.5" stroke-dasharray="5 5" stroke-linecap="round"/>';
    pts.forEach((p) => {
      const q = P(p.ll), rr = p.next ? r + 2 : r;
      g += '<circle class="mm-pin' + (p.next ? " ac" : p.ok || p.sk ? " ok" : "") + '" cx="' + q[0] + '" cy="' + q[1] + '" r="' + rr + '" stroke-width="2.5"/>';
      if (o.labels) g += '<text x="' + q[0] + '" y="' + (+q[1] + 4) + '" text-anchor="middle" class="mm-n">' + p.n + "</text>";
    });
    return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + g + "</svg>";
  }

  /* ---------- HOME (widgets) ---------- */
  const WDEF = {
    next: { name: "다음 갈 곳", desc: "갈 곳 · 길찾기 · 다녀옴 / 건너뛰기", icon: "pin", size: "wide" },
    weather: { name: "날씨", desc: "최고 · 최저 기온", icon: "cloud", size: "half" },
    hotel: { name: "숙소", desc: "체크인 · 체크아웃 시간", icon: "bed", size: "half" },
    flight: { name: "항공편", desc: "가는 편 · 오는 편 탑승권", icon: "plane", size: "wide" },
    todo: { name: "출발 전 할 일", desc: "체크리스트", icon: "list", size: "half" },
    route: { name: "오늘 동선", desc: "갈 곳을 작은 지도로", icon: "map", size: "half" },
    pack: { name: "필수 준비물", desc: "짐 체크리스트", icon: "bag", size: "half" },
    apps: { name: "필수 앱", desc: "깔아 둘 앱 체크", icon: "phone", size: "half" },
    settle: { name: "N빵 정산", desc: "총 지출 · 보낼 돈", icon: "money", size: "half" },
    fx: { name: "환율 계산", desc: "위안 ↔ 원 바로 계산", icon: "swap", size: "half" },
    photos: { name: "오늘 사진", desc: "사진 바로 올리기", icon: "camera", size: "half" },
    memo: { name: "메모", desc: "최근 메모 한 장", icon: "note", size: "half" }
  };
  function widgetList() {
    const w = Array.isArray(ui.widgets) ? ui.widgets.filter((x, i, a) => WDEF[x] && a.indexOf(x) === i) : W_DEFAULT.slice();
    ui.widgets = w;
    return w;
  }
  let editing = false;
  function homeCtx() {
    const ph = phase(), days = state.days;
    const day = ph.k === "during" ? ph.day : ph.k === "after" ? days[days.length - 1] : days[0];
    return { ph, day };
  }
  function headerArt() {
    const st = [[24, 30, 1], [70, 18, .8], [118, 44, 1.1], [160, 22, .7], [204, 34, 1], [232, 14, .8], [328, 20, .9], [366, 42, .8], [190, 70, .7], [52, 74, .8], [140, 92, .6], [300, 58, .7]];
    return '<svg class="hart" viewBox="0 0 390 190" preserveAspectRatio="xMaxYMax slice" aria-hidden="true"><defs>' +
      '<linearGradient id="hsky" x1="0" y1="0" x2="0" y2="1"><stop class="sky-a" offset="0"/><stop class="sky-b" offset=".7"/><stop class="sky-c" offset="1"/></linearGradient>' +
      '<radialGradient id="hpearl" cx=".38" cy=".34" r=".72"><stop class="pa" offset="0"/><stop class="pb" offset=".6"/><stop class="pc" offset="1"/></radialGradient></defs>' +
      '<rect width="390" height="190" fill="url(#hsky)"/>' +
      st.map((s) => '<circle class="st" cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" opacity=".7"/>').join("") +
      '<circle class="sun" cx="262" cy="46" r="22" opacity=".55"/><circle class="sunr" cx="262" cy="46" r="34" fill="none" stroke-opacity=".45"/>' +
      '<path class="c1" d="M222 176V156h8v-12h8v32zM244 176v-28h8v28zM374 176v-36h8v36zM356 176v-26h10v26z"/>' +
      '<polygon class="c2" points="300,176 300,110 303,110 303,94 306,94 306,82 309,82 311,62 313,82 316,82 316,94 319,94 319,110 322,110 322,176"/>' +
      '<path class="c2" d="M338 176 L340 92 Q343 52 349 34 L353 39 Q358 62 361 92 L363 176 Z"/>' +
      '<path class="c3s" d="M270 176 L276 156 M290 176 L284 156 M280 176 L280 156" stroke-width="3"/>' +
      '<rect class="c3" x="277.5" y="98" width="5" height="58"/><rect class="c3" x="278.4" y="70" width="3.2" height="30"/><path class="c3s" d="M280 66 L280 46" stroke-width="1.6"/>' +
      '<g class="win"><rect x="225" y="160" width="2" height="2"/><rect x="233" y="164" width="2" height="2"/><rect x="247" y="154" width="2" height="2"/><rect x="304" y="120" width="2" height="2"/><rect x="314" y="132" width="2" height="2"/><rect x="309" y="150" width="2" height="2"/><rect x="345" y="110" width="2" height="2"/><rect x="352" y="140" width="2" height="2"/><rect x="358" y="160" width="2" height="2"/><rect x="377" y="150" width="2" height="2"/></g>' +
      '<circle cx="280" cy="152" r="11" fill="url(#hpearl)"/><circle cx="280" cy="98" r="7.5" fill="url(#hpearl)"/><circle cx="280" cy="70" r="3.6" fill="url(#hpearl)"/></svg>';
  }
  function homeHtml() {
    const ctx = homeCtx(), ph = ctx.ph, t = state.trip;
    let chip, title, hint = "";
    if (ph.k === "during") {
      chip = (isNum(ph.day.n) ? "DAY " + ph.day.n + " · " : "귀국 · ") + ph.day.date;
      title = ph.day.title;
    } else if (ph.k === "before") {
      chip = "여행 전"; title = (t.title || "상하이") + " " + (t.nights || ""); hint = String(t.dates || "").replace(/\s*·\s*\d+박.*$/, "");
    } else {
      chip = "다녀온 여행"; title = (t.title || "상하이") + " " + (t.nights || ""); hint = String(t.dates || "").replace(/\s*·\s*\d+박.*$/, "");
    }
    let s = '<header class="hhead">' + headerArt() +
      '<div class="hrow"><span class="hz">上海</span><span class="hchip">' + esc(chip) + "</span>" +
      '<button class="hedit' + (editing ? " done" : "") + '" type="button" data-act="w-edit">' + (editing ? "완료" : "편집") + "</button></div>" +
      '<h1 class="htitle">' + esc(title) + "</h1>" + (hint ? '<div class="hhint mono">' + esc(hint) + "</div>" : "") + "</header>";
    const list = widgetList();
    s += '<div class="wgrid' + (editing ? " wedit" : "") + '" id="wgrid">' + list.map((id) => widgetHtml(id, ctx)).join("") +
      (editing ? '<button class="w-add" type="button" data-act="w-addsheet">+ 위젯 추가</button>' : "") + "</div>";
    if (!list.length && !editing) s += '<p class="note" style="text-align:center;margin-top:24px">오른쪽 위 \'편집\'을 눌러 위젯을 넣어보세요</p>';
    return s;
  }
  function wrapW(id, inner, cls, attrs) {
    const def = WDEF[id];
    return '<div class="w ' + (def.size === "wide" ? "w-wide" : "w-half") + (cls ? " " + cls : "") + '" data-w="' + id + '"' + (attrs || "") + ">" +
      (editing ? '<button class="w-del" type="button" data-act="w-del" data-w="' + id + '" aria-label="' + def.name + ' 위젯 빼기">' + ICON.minus + "</button>" : "") + inner + "</div>";
  }
  function widgetHtml(id, ctx) {
    switch (id) {
      case "next": return wNext(ctx);
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
      case "todo": case "pack": case "apps": return wCheck(id, { todo: "출발 전 할 일", pack: "필수 준비물", apps: "필수 앱" }[id]);
      case "route": {
        const d = ctx.day;
        return wrapW(id, d ? miniMap(d, 172, 138) + '<span class="wtag">' + (ctx.ph.k === "during" ? "오늘 동선" : (isNum(d.n) ? "DAY " + d.n : "귀국") + " 동선") + "</span>" : "", "wmap", d ? ' data-act="go-plan" data-day="' + d.id + '"' : "");
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
        const d = ctx.day, ph = d ? ((state.journal[d.id] || {}).photos || []) : [];
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
  function wCheck(key, title) {
    const list = state.prep[key], doneN = list.filter((x) => state.done[x.id]).length, left = list.filter((x) => !state.done[x.id]);
    return wrapW(key, '<div class="hd"><span class="lbl">' + title + '</span><span class="mono sub">' + doneN + "/" + list.length + "</span></div>" +
      '<div class="wprog"><i style="width:' + (list.length ? (doneN / list.length) * 100 : 0) + '%"></i></div>' +
      (left.length ? left.slice(0, 2).map((x) => ckHtml(x, '<span class="clamp2">' + esc(x.t) + "</span>", "wck")).join("") : '<span class="sub wall">' + ICON.checkc + "다 했어요</span>") +
      '<button class="wlink push" type="button" data-act="go-more" data-open="' + key + '">' + (left.length > 2 ? "남은 " + (left.length - 2) + "개 더" : "전체 보기") + " ›</button>");
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
  function wNext(ctx) {
    const ph = ctx.ph;
    if (ph.k === "before") {
      const d1 = state.days[0], l0 = state.flight.legs[0] || {};
      const names = d1 ? visible(d1).filter(placeOf).map((s) => shortName(s.ko).replace(/^상하이\s*/, "").replace(/\s*국제공항.*$/, " 공항")) : [];
      return wrapW("next", '<div class="wn-glow" aria-hidden="true"></div><div class="wn-top"><span class="lbl ac">출발까지</span></div>' +
        '<div class="wn-dday"><b>' + esc(ddayText()) + "</b>" + (l0.no ? "<span>" + esc([l0.date, l0.dep].filter(Boolean).join(" ")) + " · " + esc(l0.from || "") + " 출발 " + esc(l0.no) + "</span>" : "") + "</div>" +
        (names.length ? '<div class="wn-path"><span class="lbl">첫날</span>' + names.slice(0, 5).map(esc).join(' <i aria-hidden="true">→</i> ') + (names.length > 5 ? " …" : "") + "</div>" : "") +
        '<div class="wn-foot"><button class="btn cta" type="button" data-act="go-plan" data-day="' + (d1 ? d1.id : "") + '">' + ICON.map + "첫날 일정 보기</button>" +
        '<button class="btn" type="button" data-act="go-more" data-open="pack">' + ICON.bag + "준비물</button></div>");
    }
    if (ph.k === "after") {
      let places = 0, photos = 0;
      state.days.forEach((d) => {
        photos += ((state.journal[d.id] || {}).photos || []).length;
        d.stops.forEach((st) => { if (isDone(st.id)) places++; (st.spots || []).forEach((p) => { if (isDone(p.id)) places++; }); });
      });
      Object.keys(state.placePhotos).forEach((k) => { photos += state.placePhotos[k].length; });
      return wrapW("next", '<div class="wn-glow" aria-hidden="true"></div><div class="wn-top"><span class="lbl ac">다녀온 여행 한눈에</span></div>' +
        '<div class="stat3"><div><span>다녀온 곳</span><b>' + places + "곳</b></div><div><span>사진</span><b>" + photos + "장</b></div><div><span>함께 쓴 돈</span><b>" + totalFmt(settleCalc()) + "</b></div></div>" +
        '<div class="wn-foot"><button class="btn cta" type="button" data-act="tab" data-tab="log">' + ICON.log + "기록 보기</button></div>");
    }
    const day = ph.day, pr = dayProgress(day), next = nextOf(day), vis = visible(day);
    const top = '<div class="wn-glow" aria-hidden="true"></div><div class="wn-top"><span class="lbl ac">' + (next ? "다음 갈 곳" : "오늘 일정") + "</span>" + (pr.n ? ringSvg(pr.done + pr.sk, pr.n) : "") + "</div>";
    if (!next) {
      return wrapW("next", top + '<b class="wtitle" style="font-size:19px">' + (pr.n ? "오늘 갈 곳은 다 끝났어요" : "오늘은 정해진 일정이 없어요") + "</b>" +
        '<span class="sub">숙소로 돌아갈 땐 택시 카드를 보여주세요</span>' +
        '<div class="wn-foot"><button class="btn primary" type="button" data-act="taxi" data-id="hotel">' + ICON.taxi + "숙소로 가는 택시 카드</button>" +
        '<button class="btn" type="button" data-act="go-plan" data-day="' + day.id + '">일정 보기</button></div>');
    }
    const q = placeOf(next), spots = (next.spots || []).filter((p) => p.pri !== "maybe");
    return wrapW("next", top +
      '<div class="wn-row"><span class="numdot" style="--c:' + dayC(day) + '">' + (vis.indexOf(next) + 1) + '</span><div class="grow" style="min-width:0;display:flex;flex-direction:column;gap:3px">' +
      '<a class="wn-name" href="' + google(next.ko) + '"' + EXT + ">" + esc(next.ko) + '<span class="ext" aria-label="구글 검색">↗</span></a>' +
      (next.zh ? '<span class="zhs">' + esc(next.zh) + "</span>" : "") +
      (next.pri || (next.tags || []).length ? '<span class="chips" style="margin-top:3px">' + starsHtml(next.pri) + tagsHtml(next) + "</span>" : "") + "</div></div>" +
      (next.memo ? '<div class="memo-in">' + ICON.checkc + "<span>" + esc(next.memo) + "</span></div>" : "") +
      (spots.length ? '<div class="sub" style="position:relative">이 안에서 · ' + spots.map((p) => esc(p.ko)).join(" · ") + "</div>" : "") +
      '<div class="acts3"><a class="btn primary" href="' + amap(q) + '"' + EXT + ">" + ICON.map + "고덕지도</a>" +
      '<a class="btn" href="' + apple(q) + '"' + EXT + '><span class="ic">' + ICON.nav + "</span>길찾기</a>" +
      '<button class="btn" type="button" data-act="taxi" data-id="' + next.id + '"><span class="ic">' + ICON.taxi + "</span>택시</button></div>" +
      '<div class="wn-foot"><button class="btn cta" type="button" data-act="mark-done" data-id="' + next.id + '">' + ICON.check + "다녀왔어요</button>" +
      '<button class="btn" type="button" data-act="mark-skip" data-id="' + next.id + '"><span class="ic">' + ICON.skip + "</span>건너뛰기</button>" +
      '<button class="btn icon-only" type="button" data-act="detail" data-id="' + next.id + '" aria-label="' + esc(next.ko) + ' 자세히">' + ICON.chevR + "</button></div>");
  }

  /* ---------- PLAN: map + list ---------- */
  function planDay() {
    let day = findDay(ui.day);
    if (!day) { const ph = phase(); day = ph.day || state.days[0]; ui.day = day && day.id; }
    return day;
  }
  function planHtml() {
    const day = planDay();
    if (!day) return '<div class="page-h"><h1>일정</h1></div><p class="empty pad">일정이 없어요</p>';
    const c = dayC(day), vis = visible(day), w = wxParse(day.wx), ph = phase(), di = state.days.indexOf(day), pr = dayProgress(day);
    const nextId = ph.k === "during" && ph.day.id === day.id ? (nextOf(day) || {}).id : null;
    const far = mapPts(day).filter((p) => p.far);
    let s = '<div class="plan"><div class="mapwrap"><div class="map" id="map" role="application" aria-label="' + esc(day.title) + ' 지도"></div>' +
      '<div class="daybar"><button class="rb" type="button" data-act="day-step" data-d="-1" aria-label="이전 날"' + (di <= 0 ? " disabled" : "") + ">" + ICON.chevL + "</button>" +
      '<div class="mid"><span>' + (isNum(day.n) ? "DAY " + esc(day.n) : "귀국") + " · " + esc(day.date) + "</span><b>" + esc(day.title) + "</b></div>" +
      '<button class="rb" type="button" data-act="day-step" data-d="1" aria-label="다음 날"' + (di >= state.days.length - 1 ? " disabled" : "") + ">" + ICON.chevR + "</button></div>" +
      (day.wx ? '<a class="mapchip mapwx" href="' + WX_URL + '"' + EXT + ">" + ICON[w.kind] + esc(w.c) + (w.t ? " " + esc(w.t) : "") + "</a>" : "") +
      (far.length ? '<div class="farchips">' + far.map((p) => '<button class="mapchip" type="button" data-act="detail" data-id="' + p.it.id + '"><b class="mono">' + p.n + "</b>" +
        esc(shortName(p.it.ko).replace(/^상하이\s*/, "").replace(/\s*국제공항.*$/, " 공항")) + ' · 지도 밖</button>').join("") + "</div>" : "") +
      "</div>";
    s += '<section class="plist" style="--c:' + c + '"><div class="handle" aria-hidden="true"></div>' +
      '<div class="plist-h"><h2>' + (isNum(day.n) ? "Day " + esc(day.n) : "귀국날") + ' 일정</h2><span class="cnt">' + (pr.n ? pr.done + "/" + pr.n + " 다녀옴" + (pr.sk ? " · " + pr.sk + " 건너뜀" : "") : "") + "</span>" +
      '<button class="icon-btn" type="button" data-act="edit-day" data-day="' + day.id + '" aria-label="이 날 제목·날씨 수정">' + ICON.pen + "</button></div>";
    if (hasPri(day)) s += '<p class="starkey"><span class="stars">★★★</span> 꼭 가기 · <span class="stars">★★</span> 가면 좋음 · <span class="stars">★</span> 여유 있으면</p>';
    s += '<ul class="prows">' + vis.map((st, i) => prowHtml(st, i + 1, nextId, vis[i - 1] && vis[i - 1].id === nextId)).join("") + "</ul>";
    s += maybeDrawer(day);
    s += '<div class="addrow"><button class="btn dashed wide" type="button" data-act="add-stop" data-day="' + day.id + '">+ 장소 추가</button></div></section></div>';
    return s;
  }
  function prowHtml(st, n, nextId, afterNext) {
    const done = isDone(st.id), sk = isSkip(st.id), nx = st.id === nextId, has = !!placeOf(st);
    const sp = (st.spots || []).filter((p) => p.pri !== "maybe").length;
    const num = done ? ICON.check : sk ? ICON.skip : has ? n : "·";
    const sub = sk ? "건너뜀 · 다녀온 걸로 안 쳐요" : st.desc || st.zh || "";
    const right = nx ? '<span class="pr">다음</span>' : sp ? '<span class="pr muted">가게 ' + sp + "곳</span>" : '<span class="pr go">' + ICON.chevR + "</span>";
    return "<li" + (afterNext ? ' class="after-next"' : "") + '><button class="prow' + (nx ? " next" : "") + (done ? " ok" : "") + (sk ? " sk" : "") + '" type="button" id="row-' + st.id + '" data-act="detail" data-id="' + st.id + '">' +
      '<span class="pnum">' + num + '</span><span class="pt"><b>' + esc(st.ko) + starsHtml(st.pri) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span>" + right + "</button></li>";
  }
  function maybeDrawer(day) {
    const items = [];
    day.stops.forEach((st) => {
      if (st.pri === "maybe") items.push({ it: st, where: "" });
      (st.spots || []).forEach((p) => { if (p.pri === "maybe") items.push({ it: p, where: st.ko }); });
    });
    if (!items.length) return "";
    const key = "maybe-" + day.id;
    return '<details class="maybe-fold" data-fold="' + key + '"' + (ui.open[key] ? " open" : "") + '><summary><span class="stars">★</span><span class="ft">여유 있으면 · ' +
      items.length + '곳</span><span class="chev" aria-hidden="true"></span></summary><ul class="prows" style="padding-bottom:6px">' +
      items.map((x) => '<li><button class="prow' + (isDone(x.it.id) ? " ok" : "") + (isSkip(x.it.id) ? " sk" : "") + '" type="button" data-act="detail" data-id="' + x.it.id + '"><span class="pnum">' +
        (isDone(x.it.id) ? ICON.check : "★") + '</span><span class="pt"><b>' + esc(x.it.ko) + "</b><small>" + esc(x.where ? x.where + " 안" : x.it.desc || x.it.zh || "") + '</small></span><span class="pr go">' + ICON.chevR + "</span></button></li>").join("") +
      "</ul></details>";
  }

  /* the real map (Leaflet + CARTO tiles); falls back to a drawn map with no internet */
  let lmap = null;
  const mapView = {};
  function mountMap() {
    if (lmap) { try { lmap.remove(); } catch (e) {} lmap = null; }
    const el = document.getElementById("map");
    if (!el) return;
    const day = planDay();
    const pts = mapPts(day);
    const near = pts.filter((p) => !p.far);
    const hotelHere = day.stops.some((s) => s.zh && s.zh === state.hotel.zh);
    if (!window.L) {
      el.innerHTML = '<div class="mapfallback">' + miniMap(day, 390, 360, { labels: true, r: 11, pad: 46 }) + "</div>";
      return;
    }
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue("--accent-2").trim() || "#7B6CF0";
    lmap = L.map(el, { zoomControl: false, attributionControl: false, zoomSnap: 0.25 });
    L.control.attribution({ prefix: false, position: "bottomright" }).addTo(lmap);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/" + (isDark() ? "dark_all" : "light_all") + "/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(lmap);
    if (near.length > 1) L.polyline(near.map((p) => p.ll), { color: accent, weight: 3, opacity: 0.85, dashArray: "6 8", lineCap: "round", interactive: false }).addTo(lmap);
    const icon = (cls, html, sz) => L.divIcon({ className: "", html: '<div class="pin ' + cls + '">' + html + "</div>", iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] });
    if (state.hotel.ll && !hotelHere) {
      L.marker(state.hotel.ll, { icon: icon("hotel", ICON.bed, 28), title: "숙소", keyboard: false, zIndexOffset: -10 }).on("click", () => hotelSheet(false)).addTo(lmap);
    }
    pts.forEach((p) => {
      const cls = p.next ? "ac" : p.ok ? "ok" : p.sk ? "skip" : "";
      L.marker(p.ll, { icon: icon(cls, p.ok ? ICON.check : String(p.n), p.next ? 34 : 28), title: p.it.ko, zIndexOffset: p.next ? 500 : 0 })
        .on("click", () => detailSheet(p.it.id)).addTo(lmap);
    });
    const v = mapView[day.id];
    if (v) lmap.setView(v.c, v.z, { animate: false });
    else if (near.length > 1) lmap.fitBounds(L.latLngBounds(near.map((p) => p.ll)), { paddingTopLeft: [36, 96], paddingBottomRight: [36, 60], maxZoom: 16 });
    else lmap.setView(near.length ? near[0].ll : pts.length ? pts[0].ll : state.hotel.ll || [31.23, 121.47], near.length ? 14 : 12, { animate: false });
    lmap.on("moveend", () => { if (lmap) mapView[day.id] = { c: lmap.getCenter(), z: lmap.getZoom() }; });
  }

  /* ---------- place detail ---------- */
  function detailSheet(id) {
    const f = findItem(id);
    if (!f) return;
    const it = f.item, day = f.day, isSpot = f.kind === "spot", q = placeOf(it);
    const idx = isSpot ? -1 : visible(day).indexOf(it);
    const photos = state.placePhotos[id] || [];
    const done = isDone(id), sk = isSkip(id);
    const nm = esc(it.ko || "장소");
    let hero;
    if (photos.length) {
      hero = '<div class="dt-hero"><button class="hero-hit" type="button" data-act="view-place" data-id="' + id + '" aria-label="사진 크게 보기"><img data-pid="' + esc(photos[0]) + '" alt="' + nm + ' 사진"></button>' +
        '<label class="plus" aria-label="사진 더 넣기">' + ICON.plus + '<input class="vh" type="file" accept="image/*" multiple data-upload-place="' + id + '"></label>' +
        (photos.length > 1 ? '<span class="cnt">' + photos.length + "장</span>" : "") + "</div>";
    } else {
      hero = '<label class="dt-hero"><svg class="deco" viewBox="0 0 350 172" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="300" cy="30" r="58" fill="none" stroke-width="1.5"/><circle cx="300" cy="30" r="90" fill="none" stroke-width="1.5"/>' +
        '<circle cx="40" cy="156" r="70" fill="none" stroke-width="1.5"/><text x="330" y="154" text-anchor="end" font-size="96">' + (idx >= 0 ? idx + 1 : "") + "</text></svg>" +
        '<span class="addph">' + ICON.camera + '사진 추가</span><input class="vh" type="file" accept="image/*" multiple data-upload-place="' + id + '"></label>';
    }
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
        '<span class="sdot">' + (isDone(p.id) ? ICON.check : isSkip(p.id) ? ICON.skip : "") + "</span><b>" + esc(p.ko) + " " + starsHtml(p.pri) + "</b>" + ICON.chevR + "</button>").join("") : "") +
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
  function refreshDetail(id) { render(); if (!sheet.hidden && sheetCtx && sheetCtx.key === "dt-" + id) detailSheet(id); }
  function setDone(id, on) { if (on) { state.done[id] = true; delete state.skip[id]; } else delete state.done[id]; save(); }
  function setSkip(id, on) { if (on) { state.skip[id] = true; delete state.done[id]; } else delete state.skip[id]; save(); }

  /* ---------- LOG ---------- */
  function logHtml() {
    let s = '<div class="page-h"><h1>기록</h1></div><p class="note pad">사진이랑 그날 기록은 지금은 이 폰에만 저장돼요. 친구랑 같이 보는 건 여행 코드를 붙인 다음부터예요.</p>';
    state.days.forEach((d) => {
      const j = state.journal[d.id] || {}, ph = j.photos || [];
      s += '<section class="logday" id="log-' + d.id + '" style="--c:' + dayC(d) + '"><div class="hd"><span class="rd">' + esc(d.n) + '</span><div><span class="m">' + esc(d.date) + "</span><b>" + esc(d.title) + "</b></div></div>" +
        '<div class="photos">' + ph.map((id, i) => '<button type="button" data-act="view" data-day="' + d.id + '" data-i="' + i + '" aria-label="사진 ' + (i + 1) + ' 크게 보기"><img data-pid="' + esc(id) + '" alt=""></button>').join("") +
        "<label>" + ICON.camera + '<span>사진 추가</span><input class="vh" type="file" accept="image/*" multiple data-upload="' + d.id + '"></label></div>' +
        '<textarea class="journal" data-journal="' + d.id + '" placeholder="오늘 어땠는지 적어두기" aria-label="' + esc(d.date) + ' 기록">' + esc(j.text || "") + "</textarea>" +
        '<div class="saved" data-saved="' + d.id + '"></div></section>';
    });
    return s;
  }

  /* ---------- MONEY ---------- */
  let armedExp = null, armedTimer = null;
  function dayLabel(ts) { const t = new Date(ts); return (t.getMonth() + 1) + "." + t.getDate() + " " + "일월화수목금토"[t.getDay()]; }
  function moneyHtml() {
    const S = state.settle, ppl = S.members, c = settleCalc();
    if (ppl.indexOf(ui.payer) < 0) ui.payer = ppl[0] || "";
    let s = '<div class="page-h"><h1>정산</h1><span class="sub mono">' + (c.rate ? "1위안 = " + c.rate + "원" : "") + "</span></div>";
    s += '<div class="sec-h"><h2>환율 계산</h2></div><div class="pad"><div class="box">' + fxHtml("fx") + "</div></div>";
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
  function checkFold(key, title, icon) {
    const list = state.prep[key], doneN = list.filter((x) => state.done[x.id]).length;
    return '<details class="fold2" data-fold="' + key + '" id="fold-' + key + '"' + (ui.open[key] ? " open" : "") + '><summary><span class="ri">' + ICON[icon] + '</span><span class="ft">' + title +
      '</span><span class="fc">' + doneN + "/" + list.length + '</span><span class="chev" aria-hidden="true"></span></summary><div class="fold-b">' +
      (list.length ? list.map((x) => '<div class="li">' + ckHtml(x, esc(x.t) + (x.u ? ' <span class="note">· ' + esc(x.u) + "</span>" : "")) +
        '<button class="icon-btn x" type="button" data-act="li-del" data-list="' + key + '" data-id="' + x.id + '" aria-label="' + esc(x.t) + ' 지우기">' + ICON.x + "</button></div>").join("") : '<div class="empty">비어 있어요</div>') +
      '<div class="addline"><input id="add-' + key + '" data-keep placeholder="' + (key === "apps" ? "앱 이름" : "추가할 것") + '" autocomplete="off" aria-label="' + title + ' 추가"><button class="btn sm" type="button" data-act="li-add" data-list="' + key + '">추가</button></div>' +
      "</div></details>";
  }
  function selRow(icon, title, sub, sel) {
    return '<div class="row"><span class="ri">' + ICON[icon] + '</span><span class="rt"><b>' + title + "</b><span>" + esc(sub) + "</span></span></div>" + '<div class="rowsel">' + sel + "</div>";
  }
  function moreHtml() {
    const h = state.hotel, legs = state.flight.legs;
    let s = '<div class="page-h"><h1>더보기</h1></div>';
    s += '<div class="group-h">여행</div><div class="group">' +
      row("hotel", "bed", "숙소", h.name || "아직 미정") +
      row("flight", "plane", "항공", legs.map(legShort).join("  /  ")) +
      '<a class="row" href="' + PAPAGO + '"' + EXT + '><span class="ri">' + ICON.globe + '</span><span class="rt"><b>번역</b><span>파파고 · 한국어 → 중국어</span></span><span class="chev2" aria-hidden="true">↗</span></a>' +
      "</div>";
    s += '<div class="group-h">체크리스트</div><div class="group">' + checkFold("todo", "출발 전 할 일", "list") + checkFold("pack", "필수 준비물", "bag") + checkFold("apps", "필수 앱", "phone") + "</div>";
    s += '<div class="group-h">정보</div><div class="group">' +
      '<div class="row"><span class="ri">' + ICON.clock + '</span><span class="rt"><b>시차</b><span>상하이가 한국보다 1시간 느려요</span></span><span class="rv">−1h</span></div>' +
      [["경찰", "중국 현지", "110"], ["구급차", "중국 현지", "120"], ["영사콜센터", "외교부 · 24시간", "+82-2-3210-0404"]].map((x) =>
        '<button class="row" type="button" data-act="copy" data-v="' + x[2] + '"><span class="ri">' + ICON.phone + '</span><span class="rt"><b>' + x[0] + "</b><span>" + x[1] + ' · 눌러서 복사</span></span><span class="rv">' + x[2] + "</span></button>").join("") +
      state.infos.map((x) => row("info-edit", "info", esc(x.title || "정보"), x.body, ' data-id="' + x.id + '"')).join("") +
      row("info-add", "plus", "정보 추가", "") + "</div>";
    s += '<div class="group-h">메모</div><div class="group"><div style="padding:0 14px">' +
      (state.memos.length ? state.memos.map((m) => '<button class="memo-item" type="button" data-act="memo-edit" data-id="' + m.id + '">' + esc(m.text) + "</button>").join("") : '<div class="empty" style="padding:12px 0">아직 메모가 없어요</div>') +
      "</div>" + row("memo-add", "plus", "메모 추가", "") + "</div>";
    s += '<div class="group-h">참고 링크</div><div class="group"><div style="padding:0 14px">' +
      state.prep.links.map((l) => '<div class="li"><a class="linkrow grow" href="' + esc(safeUrl(l.url)) + '"' + EXT + "><b>" + esc(l.title || hostOf(l.url)) + "</b><span>" + esc(hostOf(l.url)) + "</span></a>" +
        '<button class="icon-btn" type="button" data-act="link-edit" data-id="' + l.id + '" aria-label="' + esc(l.title) + ' 수정">' + ICON.pen + "</button></div>").join("") +
      "</div>" + row("link-add", "plus", "링크 추가", "") + "</div>";
    const opts = [["auto", "자동 (오늘 날짜 기준)"], ["before", "여행 전"]].concat(state.days.map((d) => [d.id, (isNum(d.n) ? "여행 중 · Day " + d.n : "여행 중 · 귀국날") + " (" + d.date + ")"])).concat([["after", "다녀온 뒤"]]);
    const sel = (key, list, cur, label) => '<select class="plain" data-change="' + key + '" aria-label="' + label + '">' + list.map((o) => '<option value="' + o[0] + '"' + (cur === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select>";
    s += '<div class="group-h">설정</div><div class="group">' +
      selRow("moon", "화면 테마", isDark() ? "지금은 밤 테마예요" : "지금은 낮 테마예요", sel("theme", THEMES, ui.theme || "time", "화면 테마")) +
      row("w-edit-go", "grid", "홈 위젯 편집", "넣고 빼고 순서 바꾸기") +
      selRow("eye", "홈 화면 미리보기", "날짜에 따라 바뀌는 홈을 미리 볼 수 있어요", sel("preview", opts, ui.preview, "홈 화면 미리보기")) +
      row("share-soon", "users", "친구랑 같이 쓰기", "여행 코드 연결 · 준비 중") +
      row("backup", "download", "데이터 백업 파일 받기", "일정 · 정산 · 기록 글 (사진 빼고)") +
      '<button class="row" type="button" data-act="reset"><span class="ri">' + ICON.undo + '</span><span class="rt"><b>처음 데이터로 되돌리기</b><span>바꾼 일정 · 정산 · 기록 글이 다 지워져요</span></span></button>' +
      "</div>";
    return s;
  }

  /* ---------- render ---------- */
  const view = $("#view");
  const TABS = { home: homeHtml, plan: planHtml, log: logHtml, money: moneyHtml, more: moreHtml };
  function render() {
    const y = window.scrollY, keep = {};
    view.querySelectorAll("[data-keep]").forEach((el) => { if (el.id) keep[el.id] = el.value; });
    const ae = document.activeElement, focusId = ae && view.contains(ae) ? ae.id : "";
    if (!TABS[ui.tab]) ui.tab = "home";
    if (ui.tab !== "home") editing = false;
    if (lmap) { try { lmap.remove(); } catch (e) {} lmap = null; }
    view.innerHTML = TABS[ui.tab]();
    view.setAttribute("data-tab", ui.tab);
    Object.keys(keep).forEach((id) => { const el = document.getElementById(id); if (el && el.tagName !== "SELECT" && id !== "mNames" && id !== "mRate") el.value = keep[id]; });
    document.querySelectorAll(".tabbar button").forEach((b) => {
      if (b.getAttribute("data-tab") === ui.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    if (ui.tab === "plan") mountMap();
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
      body += field("addr", "중국어 주소", it.addr, { zh: 1 }) + field("q", "지도 검색어", it.q, { zh: 1, ph: "비우면 중국어 이름으로 검색" }) +
        '<label class="field"><span>날짜</span><select name="day">' + state.days.map((d) => '<option value="' + d.id + '"' + (d.id === dayId ? " selected" : "") + ">" +
          esc((isNum(d.n) ? "Day " + d.n : "귀국") + " · " + d.date + " · " + d.title) + "</option>").join("") + "</select></label>";
    }
    if (!isNew) {
      body += '<div class="field"><span>순서</span><div class="chips"><button class="btn sm" type="button" data-act="sh" data-k="up">위로</button><button class="btn sm" type="button" data-act="sh" data-k="down">아래로</button></div></div>';
    }
    if (!isSpot && !isNew) {
      const sp = it.spots || [];
      body += '<div class="field"><span>이 구역에서 갈 가게</span>' + (sp.length ? '<div class="mini">' + sp.map((p) => '<div class="r"><span>' + esc(p.ko) + " " + starsHtml(p.pri) + '</span><button class="btn sm" type="button" data-act="sh" data-k="spot" data-id="' + p.id + '">수정</button></div>').join("") + "</div>" : "") +
        '<button class="btn dashed" type="button" data-act="sh" data-k="addspot">+ 가게 추가</button></div>';
    }
    const apply = (v) => {
      it.ko = v.ko || it.ko || "";
      it.zh = v.zh || "";
      ["desc", "hours", "memo", "pri"].concat(isSpot ? [] : ["addr", "q"]).forEach((k) => { if (v[k]) it[k] = v[k]; else delete it[k]; });
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
      body: field("title", "제목", d.title) + '<div class="two">' + field("date", "표시 날짜", d.date) + field("iso", "실제 날짜", d.iso, { type: "date" }) + "</div>" +
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
    openSheet({
      key: "wadd",
      title: "위젯 추가",
      body: rest.length ? rest.map((k) => '<div class="addw"><span class="ri">' + ICON[WDEF[k].icon] + '</span><span class="rt"><b>' + WDEF[k].name + "</b><span>" + WDEF[k].desc + (WDEF[k].size === "wide" ? " · 큰 위젯" : "") + "</span></span>" +
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

  /* ---------- photo viewer (day photos or place photos) ---------- */
  const viewerEl = $("#viewer");
  let vSrc = null, vIdx = 0;
  function vList() {
    if (!vSrc) return [];
    if (vSrc.kind === "place") return state.placePhotos[vSrc.id] || [];
    return (state.journal[vSrc.id] || {}).photos || [];
  }
  function showViewer() {
    const list = vList();
    if (!list.length) { viewerEl.hidden = true; return; }
    vIdx = Math.max(0, Math.min(vIdx, list.length - 1));
    const img = $("#viewerImg"); img.removeAttribute("src");
    photoUrl(list[vIdx]).then((u) => { if (u) img.src = u; });
    $("#viewerCount").textContent = list.length > 1 ? vIdx + 1 + " / " + list.length : "";
    const del = $("#viewerDel"); del.classList.remove("armed"); del.textContent = "지우기";
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
  async function addPhotos(dayId, files) {
    const j = (state.journal[dayId] = state.journal[dayId] || {});
    j.photos = j.photos || [];
    await putPhotos(j.photos, files);
    render();
  }
  async function addPlacePhotos(id, files) {
    const arr = (state.placePhotos[id] = state.placePhotos[id] || []);
    await putPhotos(arr, files);
    refreshDetail(id);
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

  /* ---------- events ---------- */
  document.addEventListener("submit", (e) => e.preventDefault());
  document.addEventListener("click", (e) => {
    /* in edit mode, widgets only move or come out — nothing inside them fires */
    if (editing && e.target.closest("#wgrid") && !e.target.closest(".w-del, .w-add")) { e.preventDefault(); return; }
    const t = e.target.closest("[data-act], [data-href]");
    if (!t) return;
    if (!t.hasAttribute("data-act")) { window.open(t.getAttribute("data-href"), "_blank", "noopener"); return; }
    const act = t.getAttribute("data-act"), id = t.getAttribute("data-id");
    switch (act) {
      case "tab": closeSheet(); editing = false; go(t.getAttribute("data-tab")); return;
      case "go-plan": closeSheet(); go("plan", { day: t.getAttribute("data-day") }); return;
      case "go-log": go("log", { focus: "log-" + t.getAttribute("data-day") }); return;
      case "go-more": { const k = t.getAttribute("data-open"); ui.open[k] = true; go("more", { focus: "fold-" + k }); return; }
      case "day-step": {
        const i = state.days.indexOf(planDay()) + (+t.getAttribute("data-d") || 0);
        if (state.days[i]) { ui.day = state.days[i].id; saveUI(); render(); window.scrollTo(0, 0); }
        return;
      }
      case "w-edit": editing = !editing; render(); return;
      case "w-edit-go": editing = true; go("home"); return;
      case "w-del": {
        const w = t.getAttribute("data-w");
        ui.widgets = widgetList().filter((x) => x !== w); saveUI(); render();
        toast(WDEF[w].name + " 위젯을 뺐어요", { label: "되돌리기", fn: () => { ui.widgets.push(w); saveUI(); render(); } }, 4000);
        return;
      }
      case "w-addsheet": widgetAddSheet(); return;
      case "w-add": {
        const w = t.getAttribute("data-w"), list = widgetList();
        if (list.indexOf(w) < 0) list.push(w);
        ui.widgets = list; saveUI(); render(); widgetAddSheet(); toast(WDEF[w].name + " 위젯을 넣었어요");
        return;
      }
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
      case "sh-close": closeSheet(); return;
      case "sh": if (sheetCtx) sheetCtx.on(t.getAttribute("data-k"), formVals(), t); return;
      case "view": vSrc = { kind: "day", id: t.getAttribute("data-day") }; vIdx = +t.getAttribute("data-i") || 0; showViewer(); return;
      case "viewer-prev": vIdx = vIdx > 0 ? vIdx - 1 : vList().length - 1; showViewer(); return;
      case "viewer-next": vIdx = vIdx + 1 >= vList().length ? 0 : vIdx + 1; showViewer(); return;
      case "viewer-close": viewerEl.hidden = true; return;
      case "viewer-del": {
        if (!armDelete(t)) return;
        const list = vList(), pid = list[vIdx];
        list.splice(vIdx, 1); save();
        if (pid) { photoDB.del(pid).catch(() => {}); if (urlCache[pid]) { URL.revokeObjectURL(urlCache[pid]); delete urlCache[pid]; } }
        render();
        if (vSrc && vSrc.kind === "place" && !sheet.hidden) detailSheet(vSrc.id);
        showViewer(); toast("사진을 지웠어요");
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
        const key = t.getAttribute("data-list"), inp = document.getElementById("add-" + key), v = inp.value.trim();
        if (!v) { inp.focus(); return; }
        state.prep[key].push(key === "apps" ? { id: newId("a"), t: v, u: "" } : { id: newId(key === "todo" ? "t" : "k"), t: v });
        inp.value = ""; ui.open[key] = true; saveUI();
        save(); render();
        return;
      }
      case "li-del": {
        const key = t.getAttribute("data-list");
        state.prep[key] = state.prep[key].filter((x) => x.id !== id);
        delete state.done[id];
        save(); render(); toast("지웠어요");
        return;
      }
      case "copy": copyText(t.getAttribute("data-v"), "복사했어요: " + t.getAttribute("data-v")); return;
      case "info-add": infoSheet(null); return;
      case "info-edit": infoSheet(id); return;
      case "memo-add": memoSheet(null); return;
      case "memo-edit": memoSheet(id); return;
      case "link-add": linkSheet(null); return;
      case "link-edit": linkSheet(id); return;
      case "share-soon": toast("여행 코드는 다음 단계에서 붙일게요"); return;
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
      const id = t.getAttribute("data-ck");
      if (t.checked) state.done[id] = true; else delete state.done[id];
      save(); render();
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
    const ch = t.getAttribute("data-change");
    if (ch === "preview") {
      ui.preview = t.value; saveUI();
      toast("홈 화면이 바뀌었어요", { label: "홈 보기", fn: () => go("home") }, 4000);
    } else if (ch === "theme") {
      ui.theme = t.value; saveUI(); applyTheme(); render();
    }
  });

  const jTimers = {};
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.hasAttribute("data-journal")) {
      const d = t.getAttribute("data-journal");
      clearTimeout(jTimers[d]);
      jTimers[d] = setTimeout(() => {
        (state.journal[d] = state.journal[d] || {}).text = t.value;
        save();
        const s = document.querySelector('[data-saved="' + d + '"]'); if (s) s.textContent = "저장됨";
      }, 500);
      return;
    }
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
    if (e.key !== "Escape") return;
    if (!taxiEl.hidden) taxiEl.hidden = true;
    else if (!viewerEl.hidden) viewerEl.hidden = true;
    else if (!sheet.hidden) closeSheet();
    else if (editing) { editing = false; render(); }
  });

  /* ---------- start ---------- */
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = ICON[el.getAttribute("data-icon")] || ""; });
  applyTheme();
  render();
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
