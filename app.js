/* 상하이 여행 앱 — 홈 / 일정 / 기록 / 정산 / 더보기.
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
    plan: I('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/>'),
    log: I('<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-5-5-8 8"/>'),
    money: I('<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 11.5h6"/>'),
    more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/></svg>',
    pen: I('<path d="M4.6 19.4l1-4.4L15.9 4.7a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L9 18.4z"/><path d="M14.2 6.4l3.4 3.4"/><path d="M12.6 19.6h6.8"/>', 1.7),
    check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.6),
    rain: I('<path d="M7 15.5a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 15.5z"/><path d="M9 18.5l-1 2M13 18.5l-1 2M17 18.5l-1 2"/>'),
    cloud: I('<path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 18z"/>'),
    sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
    snow: I('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>'),
    swap: I('<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>'),
    bed: I('<path d="M3.5 18.5V6M3.5 14h17v4.5M20.5 14v-2.5a3 3 0 0 0-3-3h-7v5.5"/><circle cx="7" cy="10.8" r="1.8"/>'),
    plane: I('<path d="M10.5 20.5 12.5 14 6 16l-1.5-1.5 6-4.5-1-6.5L11 3l3.5 6.5 5-1.5a1.5 1.5 0 0 1 1 2.8L15 13l-1.5 6z"/>'),
    globe: I('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.6 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.6-3.5-8.5S9.5 6.1 12 3.5z"/>'),
    camera: I('<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13.2" r="3.3"/>'),
    list: I('<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="m3.5 6.5 1.2 1.2L7 5.4M3.5 12l1.2 1.2L7 10.9M3.5 17.5l1.2 1.2L7 16.4"/>'),
    bag: I('<rect x="4" y="7.5" width="16" height="12.5" rx="2"/><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2"/>'),
    phone: I('<rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M11 17.5h2"/>'),
    info: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>'),
    note: I('<path d="M6 3.5h9l4 4v13H6z"/><path d="M14.5 3.5v4.5h4.5M9 12h7M9 15.5h5"/>'),
    link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    eye: I('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
    users: I('<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.8a3 3 0 0 1 0 5.4M17.5 14a5 5 0 0 1 3 5"/>'),
    download: I('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'),
    undo: I('<path d="M8.5 6 4 10.5 8.5 15"/><path d="M4 10.5h10a6 6 0 0 1 0 12h-3"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
    clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>')
  };
  const STARS_BG = '<svg class="stars-bg" viewBox="0 0 390 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="40" cy="36" r="1" fill="#fff" opacity=".5"/><circle cx="120" cy="22" r=".8" fill="#fff" opacity=".6"/><circle cx="210" cy="44" r="1" fill="#fff" opacity=".4"/><circle cx="300" cy="18" r=".8" fill="#fff" opacity=".7"/><circle cx="352" cy="66" r="1" fill="#fff" opacity=".45"/><circle cx="262" cy="96" r=".7" fill="#fff" opacity=".5"/><circle cx="78" cy="104" r=".8" fill="#fff" opacity=".4"/><circle cx="170" cy="120" r=".7" fill="#fff" opacity=".35"/></svg>';

  /* ---------- weather text ("비 🌧️ 23°/17°") → parts ---------- */
  const TEMP_RE = /-?\d+\s*°\s*\/\s*-?\d+\s*°/;
  function wxParse(w) {
    w = String(w || "");
    const tm = w.match(TEMP_RE), t = tm ? tm[0].replace(/\s+/g, "").replace("/", " / ") : "";
    const c = w.replace(TEMP_RE, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").replace(/\s+/g, " ").trim();
    const kind = /눈/.test(c) ? "snow" : /비|소나기/.test(c) ? "rain" : /맑/.test(c) ? "sun" : "cloud";
    return { c, t, kind };
  }

  /* ---------- storage ---------- */
  const LS_STATE = "sht.state.v1", LS_UI = "sht.ui.v1";
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function norm(d) {
    d = d || {};
    d.trip = d.trip || {}; d.hotel = d.hotel || {};
    d.flight = d.flight || {}; d.flight.legs = d.flight.legs || [];
    d.infos = d.infos || []; d.memos = d.memos || [];
    d.prep = d.prep || {}; ["todo", "pack", "links", "apps"].forEach((k) => { d.prep[k] = d.prep[k] || []; });
    d.settle = d.settle || {}; d.settle.members = d.settle.members || []; d.settle.expenses = d.settle.expenses || [];
    d.days = d.days || []; d.days.forEach((x) => { x.stops = x.stops || []; });
    d.done = d.done || {}; d.journal = d.journal || {};
    return d;
  }
  let state = norm(lsGet(LS_STATE) || clone(window.TRIP_SEED));
  const ui = Object.assign({ tab: "home", day: null, preview: "auto", open: {}, cur: "CNY", payer: "" }, lsGet(LS_UI) || {});
  ui.open = ui.open || {};
  function save() {
    state.savedAt = Date.now();
    if (!lsSet(LS_STATE, state)) toast("폰 저장 공간이 부족해서 저장하지 못했어요");
  }
  function saveUI() { lsSet(LS_UI, ui); }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

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
  function dayProgress(day) {
    const list = day.stops.filter(countable);
    return { list, n: list.length, done: list.filter((s) => state.done[s.id]).length };
  }
  const dayC = (d) => "var(--" + ((d && d.color) || "d1") + ")";
  function hasPri(day) { return day.stops.some((s) => s.pri || (s.spots || []).some((p) => p.pri)); }

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

  /* ---------- shared bits of markup ---------- */
  function nameLink(it) {
    if (!placeOf(it)) return '<span class="ko">' + esc(it.ko) + "</span>";
    return '<a class="ko" href="' + google(it.ko) + '" target="_blank" rel="noopener">' + esc(it.ko) + '<span class="ext" aria-hidden="true">↗</span></a>';
  }
  const starsHtml = (p) => (p && STARS[p] ? '<span class="stars" role="img" aria-label="' + PRI[p] + '">' + STARS[p] + "</span>" : "");
  const tagsHtml = (it) => ((it.tags || []).length ? '<span class="tags">' + it.tags.map((t) => '<span class="tag">' + esc(t) + "</span>").join("") + "</span>" : "");
  const kvHtml = (it) => (it.hours ? '<dl class="kv"><dt>영업</dt><dd>' + esc(it.hours) + "</dd></dl>" : "");
  const memoHtml = (it) => (it.memo ? '<div class="memo"><span class="h">가서 할 일 · 메모</span><span class="b">' + esc(it.memo) + "</span></div>" : "");
  function headHtml(it, pill) {
    return '<div class="head"><div class="txt">' + (pill ? '<span class="pill">다음 갈 곳</span>' : "") +
      '<div class="name-row">' + nameLink(it) + starsHtml(it.pri) + tagsHtml(it) + "</div>" +
      (it.zh ? '<div class="zhn">' + esc(it.zh) + "</div>" : "") +
      (it.desc ? '<div class="gdesc">' + esc(it.desc) + "</div>" : "") +
      '</div><button class="icon-btn" type="button" data-act="edit" data-id="' + it.id + '" aria-label="' + esc(it.ko || "장소") + ' 수정">' + ICON.pen + "</button></div>";
  }
  function actsHtml(it, sm) {
    const q = placeOf(it);
    if (!q) return "";
    const on = !!state.done[it.id], c = sm ? "btn sm" : "btn";
    return '<div class="acts"><a class="' + c + ' primary" href="' + amap(q) + '" target="_blank" rel="noopener">고덕지도</a>' +
      '<a class="' + c + '" href="' + apple(q) + '" target="_blank" rel="noopener">길찾기</a>' +
      '<button class="' + c + '" type="button" data-act="taxi" data-id="' + it.id + '">중국어</button>' +
      '<button class="dbtn' + (on ? " on" : "") + '" type="button" data-act="done" data-id="' + it.id + '" aria-pressed="' + on + '" aria-label="다녀옴">' + ICON.check + "</button></div>";
  }
  function ckHtml(x, label) {
    return '<label class="ck"><input type="checkbox" data-ck="' + x.id + '"' + (state.done[x.id] ? " checked" : "") + "><span>" + (label || esc(x.t)) + "</span></label>";
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

  /* ---------- HOME ---------- */
  function homeHtml() {
    const ph = phase();
    return ph.k === "before" ? homeBefore() : ph.k === "after" ? homeAfter() : homeDuring(ph.day);
  }
  function tile(act, k, v, s) {
    return '<button class="tile" type="button" data-act="' + act + '"><span class="k">' + k + '</span><span class="v">' + esc(v) + "</span>" + (s ? '<span class="s">' + esc(s) + "</span>" : "") + "</button>";
  }
  function wxCell(d) {
    const w = wxParse(d.wx);
    return '<a href="' + WX_URL + '" target="_blank" rel="noopener"><span class="d">' + esc(d.date) + "</span>" + ICON[w.kind] +
      '<span class="c">' + esc(w.c || "—") + '</span><span class="t">' + esc(w.t) + "</span></a>";
  }
  function miniList(day, skipId) {
    const vis = visible(day);
    const rows = vis.map((st, i) => ({ st, i })).filter((x) => placeOf(x.st) && !state.done[x.st.id] && x.st.id !== skipId);
    const doneList = vis.filter((st) => state.done[st.id]);
    let h = '<ul class="tlist" style="--c:' + dayC(day) + '">';
    if (doneList.length) {
      h += '<li><button type="button" data-act="go-plan" data-day="' + day.id + '"><span class="n ok">' + ICON.check + '</span><span class="nm dim">' +
        esc(doneList.map((s) => s.ko).join(" · ")) + " 다녀옴</span></button></li>";
    }
    rows.forEach((x) => {
      const sp = (x.st.spots || []).filter((p) => p.pri !== "maybe").length;
      h += '<li><button type="button" data-act="go-plan" data-day="' + day.id + '" data-focus="' + x.st.id + '"><span class="n">' + (x.i + 1) + '</span><span class="nm">' +
        esc(x.st.ko) + (x.st.pri ? " " + starsHtml(x.st.pri) : "") + "</span>" + (sp ? '<span class="meta">가게 ' + sp + "곳</span>" : "") + "</button></li>";
    });
    if (!rows.length && !doneList.length) h += '<li><button type="button" data-act="go-plan" data-day="' + day.id + '"><span class="nm dim">아직 장소가 없어요</span></button></li>';
    else if (!rows.length) h += '<li><button type="button" data-act="go-plan" data-day="' + day.id + '"><span class="nm dim">남은 곳이 없어요</span></button></li>';
    return h + "</ul>";
  }

  function homeBefore() {
    const t = state.trip, h = state.hotel, legs = state.flight.legs;
    const todo = state.prep.todo, doneN = todo.filter((x) => state.done[x.id]).length;
    const left = todo.filter((x) => !state.done[x.id]), shownLeft = left.slice(0, 3);
    let s = '<div class="cover"><img src="icons/cover.svg" alt=""></div>' +
      '<div class="h-title"><h1 class="hanzi">上海</h1><span class="dday">' + ddayText() + "</span></div>" +
      '<div class="h-dates">' + esc(t.dates) + "</div>" +
      '<div class="tiles">' + tile("hotel", "숙소", h.name || "아직 미정", h.when || "") +
      tile("flight", "항공", legs[0] ? legShort(legs[0]) : "아직 미정", legs[1] ? legShort(legs[1]) : "") + "</div>";
    s += '<div class="sec-h"><h2>출발 전 할 일</h2><span class="mono note">' + doneN + " / " + todo.length + "</span></div>" +
      '<div class="pad"><div class="box"><div class="progress"><i style="width:' + (todo.length ? (doneN / todo.length) * 100 : 0) + '%"></i></div>' +
      (shownLeft.length ? shownLeft.map((x) => ckHtml(x)).join("") : '<div class="empty">다 했어요! 이제 짐만 싸면 돼요</div>') +
      (left.length > shownLeft.length ? '<button class="btn ghost sm" type="button" data-act="go-more" data-open="todo">남은 할 일 ' + (left.length - shownLeft.length) + "개 더 보기</button>" : "") +
      "</div></div>";
    if (state.days.some((d) => d.wx)) {
      s += '<div class="sec-h"><h2>여행 날씨</h2><a href="' + WX_URL + '" target="_blank" rel="noopener">자세히 보기</a></div>' +
        '<div class="pad"><div class="box"><div class="wx4" style="grid-template-columns:repeat(' + state.days.length + ',minmax(0,1fr))">' + state.days.map(wxCell).join("") + "</div></div></div>";
    }
    const d1 = state.days[0];
    if (d1) s += '<div class="sec-h"><h2>첫날 일정</h2><button class="link" type="button" data-act="go-plan" data-day="' + d1.id + '">전체 일정</button></div>' + miniList(d1);
    return s;
  }

  function homeDuring(day) {
    const c = dayC(day), pr = dayProgress(day), vis = visible(day);
    const next = pr.list.find((s) => !state.done[s.id]);
    const w = wxParse(day.wx);
    let s = '<header class="hh" style="--c:' + c + '">' + STARS_BG +
      '<div class="hh-top"><span class="hz">上海</span>' +
      (day.wx ? '<a class="wxchip" href="' + WX_URL + '" target="_blank" rel="noopener">' + ICON[w.kind] + "<span>" + esc(w.c) + (w.t ? " " + esc(w.t) : "") + "</span></a>" : "") + "</div>" +
      '<div class="hh-meta">' + (isNum(day.n) ? "DAY " + esc(day.n) + " · " : "") + esc(day.date) + "</div>" +
      "<h1>" + esc(day.title) + "</h1>" +
      (pr.n ? '<div class="segbar"><div class="segs" style="grid-template-columns:repeat(' + pr.n + ',minmax(0,1fr))">' +
        pr.list.map((x) => '<i class="' + (state.done[x.id] ? "on" : "") + '"></i>').join("") + "</div><span>" + pr.done + " / " + pr.n + " 다녀옴</span></div>" : "") +
      "</header>";
    if (next) {
      const q = placeOf(next), spots = (next.spots || []).filter((p) => p.pri !== "maybe");
      s += '<section class="next" style="--c:' + c + '" aria-label="다음 갈 곳"><span class="pill">다음 갈 곳</span>' +
        '<div class="next-row"><span class="num">' + (vis.indexOf(next) + 1) + '</span><div class="txt" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">' +
        '<div class="name-row">' + nameLink(next) + starsHtml(next.pri) + tagsHtml(next) + "</div>" +
        (next.zh ? '<div class="zhn">' + esc(next.zh) + "</div>" : "") +
        (next.desc ? '<div class="gdesc">' + esc(next.desc) + "</div>" : "") + "</div></div>" +
        (spots.length ? '<div class="note">이 안에서 갈 곳 · ' + spots.map((p) => esc(p.ko)).join(" · ") + "</div>" : "") +
        memoHtml(next) +
        '<div class="btn3"><a class="btn primary" href="' + amap(q) + '" target="_blank" rel="noopener">고덕지도</a>' +
        '<a class="btn" href="' + apple(q) + '" target="_blank" rel="noopener">길찾기</a>' +
        '<button class="btn" type="button" data-act="taxi" data-id="' + next.id + '">택시 카드</button></div>' +
        '<button class="donebig" type="button" data-act="done-next" data-id="' + next.id + '">' + ICON.check + "다녀왔어요 · 다음 장소로</button></section>";
    } else {
      s += '<section class="alldone"><b>' + (pr.n ? "오늘 일정 다 다녀왔어요" : "오늘은 정해진 일정이 없어요") + '</b><span class="note">숙소로 돌아갈 땐 택시 카드를 보여주세요</span>' +
        '<button class="btn primary" type="button" data-act="taxi" data-id="hotel">숙소로 가는 택시 카드</button></section>';
    }
    s += '<div class="quick"><button class="btn" type="button" data-act="calc">' + ICON.swap + "환율 계산</button>" +
      '<button class="btn" type="button" data-act="tab" data-tab="money">' + ICON.money + "N빵 정산</button>" +
      '<button class="btn" type="button" data-act="taxi" data-id="hotel">' + ICON.bed + "숙소로 택시</button></div>";
    s += '<div class="sec-h"><h2>오늘 남은 일정</h2><button class="link" type="button" data-act="go-plan" data-day="' + day.id + '">전체 일정</button></div>' + miniList(day, next && next.id);
    return s;
  }

  function homeAfter() {
    const all = [];
    state.days.forEach((d) => ((state.journal[d.id] || {}).photos || []).forEach((p) => all.push(p)));
    let places = 0;
    state.days.forEach((d) => d.stops.forEach((st) => {
      if (state.done[st.id]) places++;
      (st.spots || []).forEach((p) => { if (state.done[p.id]) places++; });
    }));
    const c = settleCalc();
    let s = '<div class="ah"><span class="k">다녀온 여행</span><div class="t"><span class="hz">上海</span><b>' + esc(state.trip.nights || "") + "</b></div>" +
      '<span class="d">' + esc(String(state.trip.dates || "").replace(/\s*·\s*\d+박.*$/, "")) + "</span></div>" +
      '<button class="hero-photo" type="button" data-act="tab" data-tab="log">' +
      (all[0] ? '<img data-pid="' + esc(all[0]) + '" alt="여행 대표 사진">' : '<span class="ph">' + ICON.log + "기록 탭에 사진을 올리면 여기 대표 사진이 돼요</span>") + "</button>" +
      '<div class="stats"><div class="stat"><span class="k">다녀온 곳</span><span class="v">' + places + '곳</span></div>' +
      '<div class="stat"><span class="k">사진</span><span class="v">' + all.length + '장</span></div>' +
      '<div class="stat"><span class="k">함께 쓴 돈</span><span class="v">' + (c.base === "KRW" ? wonFmt(c.total) : yuanFmt(c.total)) + "</span></div></div>" +
      '<div class="sec-h"><h2>날짜별 기록</h2></div>';
    state.days.forEach((d) => {
      const j = state.journal[d.id] || {}, ph = (j.photos || []).slice(0, 4), n = d.stops.filter((st) => state.done[st.id]).length;
      s += '<button class="daycard" type="button" data-act="go-log" data-day="' + d.id + '" style="--c:' + dayC(d) + '">' +
        '<span class="hd"><span class="rd">' + esc(d.n) + '</span><span><span class="m">' + esc(d.date) + (n ? " · " + n + "곳" : "") + "</span><b>" + esc(d.title) + "</b></span></span>" +
        (ph.length ? '<span class="thumbs4">' + ph.map((id) => '<span><img data-pid="' + esc(id) + '" alt=""></span>').join("") + "</span>" : "") +
        (j.text ? "<p>" + esc(j.text) + "</p>" : !ph.length ? '<p>아직 기록이 없어요</p>' : "") + "</button>";
    });
    return s;
  }

  /* ---------- PLAN ---------- */
  function planDay() {
    let day = findDay(ui.day);
    if (!day) { const ph = phase(); day = ph.day || state.days[0]; ui.day = day && day.id; }
    return day;
  }
  function planHtml() {
    const day = planDay();
    if (!day) return '<div class="page-h"><h1>일정</h1></div><p class="empty pad">일정이 없어요</p>';
    const c = dayC(day), vis = visible(day), w = wxParse(day.wx), ph = phase();
    const nextId = ph.k === "during" && ph.day.id === day.id ? (vis.find((x) => countable(x) && !state.done[x.id]) || {}).id : null;
    let s = '<nav class="daytabs" aria-label="날짜 고르기">' + state.days.map((d) =>
      '<button type="button" data-act="day" data-day="' + d.id + '" style="--c:' + dayC(d) + '" aria-pressed="' + (d.id === day.id) + '"><b>' +
      (isNum(d.n) ? "Day " + esc(d.n) : "귀국") + "</b><span>" + esc(d.date) + "</span></button>").join("") + "</nav>";
    s += '<section style="--c:' + c + '"><div class="dayhead"><span class="rd">' + esc(day.n) + '</span><div class="t"><div class="m"><span>' + esc(day.date) + "</span>" +
      (day.wx ? '<a href="' + WX_URL + '" target="_blank" rel="noopener">' + esc(w.c) + (w.t ? " " + esc(w.t) : "") + " ↗</a>" : "") + "</div><h2>" + esc(day.title) + "</h2></div>" +
      '<button class="icon-btn" type="button" data-act="edit-day" data-day="' + day.id + '" aria-label="이 날 제목·날씨 수정">' + ICON.pen + "</button></div>";
    if (hasPri(day)) s += '<p class="starkey"><span class="stars">★★★</span> 꼭 가기 · <span class="stars">★★</span> 가면 좋음 · <span class="stars">★</span> 여유 있으면</p>';
    s += '<ol class="route">' + vis.map((st, i) => stopHtml(st, i, vis.length, nextId)).join("") + "</ol>";
    s += maybeDrawer(day);
    s += '<div class="addrow"><button class="btn dashed wide" type="button" data-act="add-stop" data-day="' + day.id + '">+ 장소 추가</button></div></section>';
    return s;
  }
  function stopHtml(st, i, n, nextId) {
    const q = placeOf(st);
    const cls = "stop" + (i === 0 ? " first" : "") + (i === n - 1 ? " last" : "") + (state.done[st.id] ? " done" : "") + (st.id === nextId ? " hl" : "");
    return '<li class="' + cls + '" id="st-' + st.id + '"><span class="station">' + (q ? i + 1 : "·") + '</span><div class="card">' +
      headHtml(st, st.id === nextId) + kvHtml(st) + memoHtml(st) + actsHtml(st) + spotsHtml(st) + "</div></li>";
  }
  function spotsHtml(st) {
    const sp = (st.spots || []).filter((p) => p.pri !== "maybe");
    if (!sp.length) return "";
    return '<ul class="spots">' + sp.map((p) => '<li class="spot' + (state.done[p.id] ? " done" : "") + '" id="st-' + p.id + '">' +
      headHtml(p) + kvHtml(p) + memoHtml(p) + actsHtml(p, true) + "</li>").join("") + "</ul>";
  }
  function maybeDrawer(day) {
    const items = [];
    day.stops.forEach((st) => {
      if (st.pri === "maybe") items.push({ it: st, where: "" });
      (st.spots || []).forEach((p) => { if (p.pri === "maybe") items.push({ it: p, where: st.ko }); });
    });
    if (!items.length) return "";
    const key = "maybe-" + day.id;
    return '<details class="fold maybe-fold" data-fold="' + key + '"' + (ui.open[key] ? " open" : "") + '><summary><span class="ft">★ 여유 있으면</span><span class="fc">' +
      items.length + '곳</span><span class="chev" aria-hidden="true"></span></summary><div class="fold-b"><ul class="spots">' +
      items.map((x) => '<li class="spot' + (state.done[x.it.id] ? " done" : "") + '">' + (x.where ? '<span class="where note">' + esc(x.where) + " 안</span>" : "") +
        headHtml(x.it) + kvHtml(x.it) + memoHtml(x.it) + actsHtml(x.it, true) + "</li>").join("") + "</ul></div></details>";
  }

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
  function calcHtml() {
    const rate = +state.settle.rate || 0;
    if (!rate) return '<p class="note">아래 \'인원 · 환율\'에 환율을 넣으면 바로 계산돼요</p>';
    return '<div class="calc"><label class="cin"><span>¥</span><input id="cY" data-keep inputmode="decimal" placeholder="0" autocomplete="off" aria-label="위안"></label>' +
      '<span class="mono note" aria-hidden="true">=</span><label class="cin"><span>₩</span><input id="cW" data-keep inputmode="decimal" placeholder="0" autocomplete="off" aria-label="원"></label></div>';
  }
  let armedExp = null, armedTimer = null;
  function dayLabel(ts) { const t = new Date(ts); return (t.getMonth() + 1) + "." + t.getDate() + " " + "일월화수목금토"[t.getDay()]; }
  function moneyHtml() {
    const S = state.settle, ppl = S.members, c = settleCalc();
    if (ppl.indexOf(ui.payer) < 0) ui.payer = ppl[0] || "";
    let s = '<div class="page-h"><h1>정산</h1><span class="sub mono">' + (c.rate ? "1위안 = " + c.rate + "원" : "") + "</span></div>";
    s += '<div class="sec-h"><h2>환율 계산</h2></div><div class="pad"><div class="box">' + calcHtml() + "</div></div>";
    s += '<div class="sec-h"><h2>N빵 결과</h2></div><div class="pad"><div class="box">';
    if (!ppl.length) s += '<p class="note">아래 \'인원 · 환율\'에서 같이 가는 사람을 먼저 넣어주세요</p>';
    else {
      s += '<span class="lbl">총 지출</span><div class="big">' + (c.base === "KRW" ? wonFmt(c.total) : yuanFmt(c.total)) + "</div>" +
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
        s += '<div class="exp"><span class="w"><b>' + esc(e.what || "지출") + "</b><span>" + esc(e.payer) + " 냄</span></span>" +
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
    return '<details class="fold2" data-fold="' + key + '"' + (ui.open[key] ? " open" : "") + '><summary><span class="ri">' + ICON[icon] + '</span><span class="ft">' + title +
      '</span><span class="fc">' + doneN + "/" + list.length + '</span><span class="chev" aria-hidden="true"></span></summary><div class="fold-b">' +
      (list.length ? list.map((x) => '<div class="li">' + ckHtml(x, esc(x.t) + (x.u ? ' <span class="note">· ' + esc(x.u) + "</span>" : "")) +
        '<button class="icon-btn x" type="button" data-act="li-del" data-list="' + key + '" data-id="' + x.id + '" aria-label="' + esc(x.t) + ' 지우기">' + ICON.x + "</button></div>").join("") : '<div class="empty">비어 있어요</div>') +
      '<div class="addline"><input id="add-' + key + '" data-keep placeholder="' + (key === "apps" ? "앱 이름" : "추가할 것") + '" autocomplete="off" aria-label="' + title + ' 추가"><button class="btn sm" type="button" data-act="li-add" data-list="' + key + '">추가</button></div>' +
      "</div></details>";
  }
  function moreHtml() {
    const h = state.hotel, legs = state.flight.legs;
    let s = '<div class="page-h"><h1>더보기</h1></div>';
    s += '<div class="group-h">여행</div><div class="group">' +
      row("hotel", "bed", "숙소", h.name || "아직 미정") +
      row("flight", "plane", "항공", legs.map(legShort).join("  /  ")) +
      '<a class="row" href="' + PAPAGO + '" target="_blank" rel="noopener"><span class="ri">' + ICON.globe + '</span><span class="rt"><b>번역</b><span>파파고 · 한국어 → 중국어</span></span><span class="chev2" aria-hidden="true">↗</span></a>' +
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
      state.prep.links.map((l) => '<div class="li"><a class="linkrow grow" href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener"><b>' + esc(l.title || hostOf(l.url)) + "</b><span>" + esc(hostOf(l.url)) + "</span></a>" +
        '<button class="icon-btn" type="button" data-act="link-edit" data-id="' + l.id + '" aria-label="' + esc(l.title) + ' 수정">' + ICON.pen + "</button></div>").join("") +
      "</div>" + row("link-add", "plus", "링크 추가", "") + "</div>";
    const opts = [["auto", "자동 (오늘 날짜 기준)"], ["before", "여행 전"]].concat(state.days.map((d) => [d.id, (isNum(d.n) ? "여행 중 · Day " + d.n : "여행 중 · 귀국날") + " (" + d.date + ")"])).concat([["after", "다녀온 뒤"]]);
    s += '<div class="group-h">설정</div><div class="group">' +
      '<div class="row"><span class="ri">' + ICON.eye + '</span><span class="rt"><b>홈 화면 미리보기</b><span>날짜에 따라 바뀌는 홈을 미리 볼 수 있어요</span></span></div>' +
      '<div style="padding:0 14px 12px 56px"><select class="plain" data-change="preview" aria-label="홈 화면 미리보기">' +
      opts.map((o) => '<option value="' + o[0] + '"' + (ui.preview === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select></div>" +
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
    view.innerHTML = TABS[ui.tab]();
    Object.keys(keep).forEach((id) => { const el = document.getElementById(id); if (el && el.tagName !== "SELECT" && id !== "mNames" && id !== "mRate") el.value = keep[id]; });
    document.querySelectorAll(".tabbar button").forEach((b) => {
      if (b.getAttribute("data-tab") === ui.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
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
    sheetCtx = { on: o.on || function () {} };
    sheet.innerHTML = '<button class="sh-bg" type="button" data-act="sh-close" tabindex="-1" aria-label="닫기"></button>' +
      '<div class="sh-panel" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><div class="sh-head"><b>' + esc(o.title) + '</b><button class="btn ghost sm" type="button" data-act="sh-close">닫기</button></div>' +
      '<form class="sh-body" id="shForm">' + o.body + "</form>" + (o.foot ? '<div class="sh-foot">' + o.foot + "</div>" : "") + "</div>";
    sheet.hidden = false;
    document.body.classList.add("noscroll", "sheet-open");
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

  function hotelSheet(editing) {
    const h = state.hotel;
    if (editing) {
      openSheet({
        title: "숙소 수정",
        body: field("name", "숙소 이름", h.name) + field("zh", "중국어 이름 (택시용)", h.zh, { zh: 1 }) + field("addr", "중국어 주소", h.addr, { zh: 1 }) +
          field("when", "체크인 · 체크아웃", h.when, { ph: "예: 14:00 체크인 · 12:00 체크아웃" }) + field("note", "메모", h.note, { area: 1, ph: "예약번호, 조식 등" }),
        foot: footSave(false),
        on(k, v) {
          if (k !== "save") return;
          ["name", "zh", "addr", "when", "note"].forEach((x) => { h[x] = v[x] || ""; });
          save(); closeSheet(); render(); toast("저장했어요");
        }
      });
      return;
    }
    const q = h.zh || h.addr;
    openSheet({
      title: "숙소",
      body: '<div><div class="title-f" style="font-size:18px;font-weight:700">' + esc(h.name || "아직 미정") + "</div>" +
        (h.zh ? '<div class="zhn">' + esc(h.zh) + "</div>" : "") + (h.addr ? '<div class="zhn" style="font-size:13px">' + esc(h.addr) + "</div>" : "") + "</div>" +
        (h.when ? '<div class="kv2"><span class="k">시간</span><span class="v">' + esc(h.when) + "</span></div>" : "") +
        (h.note ? '<div class="kv2"><span class="k">메모</span><span class="v">' + esc(h.note) + "</span></div>" : "") +
        (q ? '<div class="btn3"><a class="btn primary" href="' + amap(q) + '" target="_blank" rel="noopener">고덕지도</a><a class="btn" href="' + apple(q) + '" target="_blank" rel="noopener">길찾기</a><button class="btn" type="button" data-act="taxi" data-id="hotel">택시 카드</button></div>' : ""),
      foot: '<button class="btn" type="button" data-act="sh" data-k="edit">' + ICON.pen.replace("<svg ", '<svg width="16" height="16" ') + "수정</button><span class=\"grow\"></span>",
      on(k) { if (k === "edit") hotelSheet(true); }
    });
  }
  function flightSheet() {
    const f = state.flight;
    openSheet({
      title: "항공",
      body: f.legs.map((l) => '<div class="leg"><div class="lh"><b>' + esc(l.label || "") + "</b><span>" + esc(l.date || "") + '</span><span class="no">' + esc(l.no || "") + "</span></div>" +
        '<div class="lt"><span class="tm">' + esc(l.dep || "") + '</span><span class="ln"></span><span class="tm">' + esc(l.arr || "") + "</span></div>" +
        '<div class="la"><span>' + esc(l.from || "") + "</span><span>" + esc(l.to || "") + "</span></div>" +
        (l.checkin ? '<div class="lc">체크인 ' + esc(l.checkin) + "</div>" : "") +
        (l.fromZh ? '<div class="btn3" style="grid-template-columns:repeat(2,minmax(0,1fr))"><a class="btn" href="' + amap(l.fromZh) + '" target="_blank" rel="noopener">고덕지도</a><button class="btn" type="button" data-act="taxi" data-zh="' + esc(l.fromZh) + '" data-ko="' + esc(l.from) + '">택시 카드</button></div>' : "") +
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
      body += '<div class="field"><span>순서</span><div class="acts"><button class="btn sm" type="button" data-act="sh" data-k="up">위로</button><button class="btn sm" type="button" data-act="sh" data-k="down">아래로</button></div></div>';
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
          apply(v); save(); closeSheet(); render(); toast("저장했어요");
        } else if (k === "del") {
          if (!armDelete(btn)) return;
          const g = findItem(it.id);
          if (g) g.list.splice(g.idx, 1);
          delete state.done[it.id];
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

  /* ---------- photo viewer ---------- */
  const viewerEl = $("#viewer");
  let vDay = null, vIdx = 0;
  function showViewer() {
    const list = (state.journal[vDay] || {}).photos || [];
    if (!list.length) { viewerEl.hidden = true; return; }
    vIdx = Math.max(0, Math.min(vIdx, list.length - 1));
    const img = $("#viewerImg"); img.removeAttribute("src");
    photoUrl(list[vIdx]).then((u) => { if (u) img.src = u; });
    $("#viewerCount").textContent = list.length > 1 ? vIdx + 1 + " / " + list.length : "";
    const del = $("#viewerDel"); del.classList.remove("armed"); del.textContent = "지우기";
    viewerEl.hidden = false;
  }
  async function addPhotos(dayId, files) {
    const j = (state.journal[dayId] = state.journal[dayId] || {});
    j.photos = j.photos || [];
    let n = 0;
    toast("사진 넣는 중…", null, 60000);
    for (const file of files) {
      try {
        const blob = await shrink(file);
        const id = newId("ph");
        await photoDB.put(id, blob);
        j.photos.push(id); n++;
      } catch (e) {}
    }
    save(); render();
    toast(n ? "사진 " + n + "장 넣었어요" : "사진을 넣지 못했어요");
  }

  /* ---------- events ---------- */
  document.addEventListener("submit", (e) => e.preventDefault());
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const act = t.getAttribute("data-act"), id = t.getAttribute("data-id");
    switch (act) {
      case "tab": closeSheet(); go(t.getAttribute("data-tab")); return;
      case "go-plan": go("plan", { day: t.getAttribute("data-day"), focus: t.getAttribute("data-focus") ? "st-" + t.getAttribute("data-focus") : null }); return;
      case "go-log": go("log", { focus: "log-" + t.getAttribute("data-day") }); return;
      case "go-more": ui.open[t.getAttribute("data-open")] = true; go("more"); return;
      case "day": ui.day = t.getAttribute("data-day"); saveUI(); render(); window.scrollTo(0, 0); return;
      case "done":
      case "done-next": {
        const on = act === "done-next" ? true : !state.done[id];
        if (on) state.done[id] = true; else delete state.done[id];
        save(); render();
        if (act === "done-next") toast("다음 장소로 넘어갔어요");
        return;
      }
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
      case "calc": openSheet({ title: "환율 계산", body: calcHtml() }); return;
      case "sh-close": closeSheet(); return;
      case "sh": if (sheetCtx) sheetCtx.on(t.getAttribute("data-k"), formVals(), t); return;
      case "view": vDay = t.getAttribute("data-day"); vIdx = +t.getAttribute("data-i") || 0; showViewer(); return;
      case "viewer-prev": vIdx = vIdx > 0 ? vIdx - 1 : ((state.journal[vDay] || {}).photos || []).length - 1; showViewer(); return;
      case "viewer-next": vIdx = vIdx + 1 >= ((state.journal[vDay] || {}).photos || []).length ? 0 : vIdx + 1; showViewer(); return;
      case "viewer-close": viewerEl.hidden = true; return;
      case "viewer-del": {
        if (!armDelete(t)) return;
        const list = (state.journal[vDay] || {}).photos || [], pid = list[vIdx];
        list.splice(vIdx, 1); save();
        if (pid) { photoDB.del(pid).catch(() => {}); if (urlCache[pid]) { URL.revokeObjectURL(urlCache[pid]); delete urlCache[pid]; } }
        render(); showViewer(); toast("사진을 지웠어요");
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
          t.classList.add("armed"); t.style.background = "var(--chip)";
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
    if (t.getAttribute("data-change") === "preview") {
      ui.preview = t.value; saveUI();
      toast("홈 화면이 바뀌었어요", { label: "홈 보기", fn: () => go("home") }, 4000);
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
    if (t.id === "cY" || t.id === "cW") {
      const rate = +state.settle.rate || 0, v = parseFloat(String(t.value).replace(/[,\s]/g, ""));
      if (!rate) return;
      if (t.id === "cY") $("#cW").value = isNaN(v) ? "" : Math.round(v * rate).toLocaleString("ko-KR");
      else $("#cY").value = isNaN(v) ? "" : (Math.round((v / rate) * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
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
  });

  /* ---------- start ---------- */
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = ICON[el.getAttribute("data-icon")] || ""; });
  render();

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
