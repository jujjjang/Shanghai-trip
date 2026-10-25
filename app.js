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
    ticket: I('<path d="M15 5v2M15 11v2M15 17v2"/><path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2"/>'),
    receipt: I('<path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2"/><path d="M14 8h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3H10m2 0v1.5m0-9V8"/>'),
    bowl: I('<path d="M4 11h16a1 1 0 0 1 1 1v.5c0 1.5-2.517 5.573-4 6.5v1a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-1c-1.687-1.054-4-5-4-6.5V12a1 1 0 0 1 1-1"/><path d="M19 7l-14 1M19 2L5 8"/>'),
    grip: I('<path d="M5 9h14M5 15h14"/>'),
    lock: I('<rect x="5" y="11" width="14" height="9" rx="2.2"/><path d="M8.2 11V8.2a3.8 3.8 0 0 1 7.6 0V11"/>'),
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

  /* ---------- hourly forecast for Shanghai (Open-Meteo, free, no key); kept on the phone for offline ---------- */
  const LS_WX = "sht.wx.v1";
  let wxData = lsGet(LS_WX), wxLoading = false;
  const shanghaiNow = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 13); /* "2026-10-31T14" */
  const daysUntil = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(shanghaiNow().slice(0, 10) + "T00:00:00Z")) / 864e5);
  const wmoKind = (c) => (c >= 71 && c <= 77) || c === 85 || c === 86 ? "snow" : c >= 51 ? "rain" : c >= 2 ? "cloud" : "sun";
  function loadWx() {
    if (wxLoading || (wxData && wxData.d && Date.now() - wxData.at < 3 * 3600e3)) return;
    wxLoading = true;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=31.23&longitude=121.47&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FShanghai&forecast_days=16", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !j.hourly || !j.hourly.time) return;
        wxData = { at: Date.now(), h: j.hourly, d: j.daily || null };
        lsSet(LS_WX, wxData);
        if (!busy() && ui.tab !== "money") render();
      })
      .catch(() => {})
      .finally(() => { wxLoading = false; });
  }
  /* that day's hours (7시–23시, or from now on the day itself) */
  function wxHours(iso) {
    const h = wxData && wxData.h;
    if (!h || !iso) return [];
    const now = shanghaiNow(), out = [];
    h.time.forEach((t, i) => {
      if (t.slice(0, 10) !== iso) return;
      const hr = +t.slice(11, 13);
      if (t.slice(0, 13) < now || hr < 7) return;
      out.push({ h: hr, t: h.temperature_2m[i], kind: wmoKind(h.weather_code[i]), p: h.precipitation_probability ? h.precipitation_probability[i] || 0 : 0, now: t.slice(0, 13) === now });
    });
    return out;
  }

  /* ---------- weather text ("비 🌧️ 23°/17°") → parts ---------- */
  const TEMP_RE = /(-?\d+)\s*°\s*\/\s*(-?\d+)\s*°/;
  /* a trip day's weather: the live forecast once the day is within 16 days, otherwise the words typed into the day */
  function wmoText(c) {
    return c === 0 ? "맑음" : c === 1 ? "대체로 맑음" : c === 2 ? "구름 조금" : c === 3 ? "흐림" : c === 45 || c === 48 ? "안개" : c >= 51 && c <= 57 ? "이슬비" :
      (c >= 71 && c <= 77) || c === 85 || c === 86 ? "눈" : c >= 80 && c <= 82 ? "소나기" : c >= 95 ? "뇌우" : c >= 61 ? "비" : "흐림";
  }
  function dayWx(d) {
    const dd = wxData && wxData.d, i = dd && d && d.iso ? dd.time.indexOf(d.iso) : -1;
    if (i < 0 || dd.weather_code[i] == null) return wxParse(d && d.wx);
    const code = dd.weather_code[i], kind = wmoKind(code), pp = dd.precipitation_probability_max ? dd.precipitation_probability_max[i] || 0 : 0;
    const hi = Math.round(dd.temperature_2m_max[i]), lo = Math.round(dd.temperature_2m_min[i]);
    const c = wmoText(code) + (kind === "rain" && pp ? " " + pp + "%" : kind !== "rain" && pp >= 40 ? " · 비 " + pp + "%" : "");
    return { c, kind, hi: String(hi), lo: String(lo), t: hi + "° / " + lo + "°", live: true };
  }
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
    d.posts = d.posts || []; d.postPhotos = d.postPhotos || {}; d.likes = d.likes || {}; d.shared = d.shared || {}; d.tasks = d.tasks || []; d.layAck = d.layAck || {}; d.avatars = d.avatars || {}; d.mine = d.mine || []; d.myExp = d.myExp || [];
    /* 메모 is a single personal note now: older separate memos are folded into it */
    if (d.memos.length > 1) d.memos = [{ id: d.memos[0].id, text: d.memos.map((m) => m.text).filter(Boolean).join("\n\n"), at: d.memos[0].at }];
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
    /* notes written after the trip was set up (공항·디즈니 가는 길), added once and only where the place still has its original words */
    d.applied = d.applied || [];
    if (d.applied.indexOf("routes-1022") < 0) {
      const one = (id) => { let r = null; d.days.forEach((x) => x.stops.forEach((st) => { if (st.id === id) r = st; })); return r; };
      const a = one("s19"), b = one("s12"), c = one("s14");
      if (a && a.memo === "체크아웃은 12:00까지지만 공항 체크인이 11:30 마감이라 아침 일찍 나가기" && seed.s19) a.memo = seed.s19.memo;
      if (b && !b.how && seed.s12) b.how = seed.s12.how;
      if (c && !c.how && seed.s14) c.how = seed.s14.how;
      if (c && !c.memo && seed.s14) c.memo = seed.s14.memo;
      d.applied.push("routes-1022");
      notesAdded = true;
    }
    /* 준비물 is shared now: the starter items go to both phones, the ones I added myself stay 나만 (same place in my list) */
    if (d.applied.indexOf("pack-share-1022") < 0) {
      const starters = (window.TRIP_SEED.prep.pack || []).map((x) => x.id), own = d.prep.pack.filter((x) => starters.indexOf(x.id) < 0);
      if (own.length) {
        packOrder = d.prep.pack.map((x) => x.id);
        d.prep.pack = d.prep.pack.filter((x) => starters.indexOf(x.id) >= 0);
        own.forEach((x) => { if (!d.mine.some((m) => m.id === x.id)) d.mine.push({ id: x.id, t: x.t, list: "pack" }); });
      }
      d.applied.push("pack-share-1022");
      notesAdded = true;
    }
    /* 출발 전 할 일 got a new starting list: swap the old starter items for it once (my own added ones stay) */
    if (d.applied.indexOf("todo-1022") < 0) {
      const fresh = clone(window.TRIP_SEED.prep.todo), newIds = fresh.map((x) => x.id), oldIds = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
      if (!d.prep.todo.some((x) => newIds.indexOf(x.id) >= 0 && oldIds.indexOf(x.id) < 0)) {
        const covered = /보험|환전|트래블|디즈니|데이터|eSIM|로밍|앱 설치|알리페이|위챗|입국|임시정부|헌지우|체크인|보조배터리|여권 유효|숙소 예약|고덕|Amap/i;
        const extra = d.prep.todo.filter((x) => oldIds.indexOf(x.id) < 0 && !covered.test(x.t || ""));
        d.mine = d.mine.filter((x) => !(x.list === "todo" && /보험|환전/.test(x.t || "")));
        ["t1", "t3", "t4", "t5", "t6"].forEach((id) => { delete d.done[id]; });
        d.prep.todo = fresh.concat(extra);
        todoRenewed = true;
      }
      d.applied.push("todo-1022");
      notesAdded = true;
    }
    /* 아침 · 낮 · 저녁: Day 1 and Day 2 split once by what the notes say; places added later follow the one before them */
    if (d.applied.indexOf("parts-1023") < 0) {
      const P = { s01: "낮", s13: "낮", s07: "저녁", s08: "저녁", s16: "저녁", s17: "저녁", s15: "저녁", s06: "아침", s05: "아침", s04: "낮", s02: "낮", s03: "저녁", s18: "저녁" };
      ["day1", "day2"].forEach((id) => {
        const day = d.days.find((x) => x.id === id);
        if (!day) return;
        const vis = day.stops.filter((x) => x.pri !== "maybe");
        if (vis.length < 3 || vis.some((x) => x.part) || !vis.some((x) => P[x.id])) return;
        let prev = "";
        vis.forEach((x) => { x.part = P[x.id] || prev || (vis.find((y) => P[y.id]) ? P[vis.find((y) => P[y.id]).id] : "낮"); prev = x.part; });
        const rank = (x) => Math.max(0, ["아침", "낮", "저녁"].indexOf(x.part || "낮"));
        day.stops = day.stops.slice().sort((a, b) => rank(a) - rank(b));
      });
      d.applied.push("parts-1023");
      notesAdded = true;
    }
    return d;
  }
  let notesAdded = false, todoRenewed = false, packOrder = null;
  let state = norm(lsGet(LS_STATE) || clone(window.TRIP_SEED));
  if (notesAdded) lsSet(LS_STATE, state); /* keep the added notes (and let them go out to a friend on the next sync) */
  const W_DEFAULT = ["weather", "hotel", "flight", "todo", "pack", "apps", "route"];
  /* 추천 배치: what each home view starts with (and what '초기 세팅으로 되돌리기' brings back) */
  const W_REC = {
    before: ["todo", "pack", "apps", "hotel", "weather", "memo"],
    d1: ["flight", "hotel", "route", "weather", "todo", "photos", "settle", "memo"],
    d2: ["weather", "hotel", "route", "todo", "photos", "settle", "memo"],
    d3: ["weather", "hotel", "route", "flight", "todo", "photos", "settle", "memo"],
    d4: ["flight", "hotel", "route", "weather", "todo", "photos", "settle", "memo"],
    after: ["flight", "hotel", "settle", "todo", "photos", "memo"]
  };
  function wRec(k) {
    if (W_REC[k]) return W_REC[k].slice();
    const i = state.days.findIndex((d) => d.id === k), n = state.days.length;
    return (i === 0 ? W_REC.d1 : i === n - 1 ? W_REC.d4 : i === 2 ? W_REC.d3 : W_REC.d2).slice();
  }
  const ui = Object.assign({ tab: "home", day: null, preview: "auto", open: {}, cur: "CNY", payer: "", theme: "time" }, lsGet(LS_UI) || {});
  ui.open = ui.open || {};
  function save() {
    state.savedAt = Date.now();
    if (!lsSet(LS_STATE, state)) toast("폰 저장 공간이 부족해서 저장하지 못했어요");
    onLocalChange();
  }
  function saveUI() { lsSet(LS_UI, ui); }
  if (todoRenewed && ui.ckOrd && ui.ckOrd.todo) { delete ui.ckOrd.todo; saveUI(); } /* the new starting list shows in its own order */
  if (packOrder) { ui.ckOrd = ui.ckOrd || {}; if (!ui.ckOrd.pack) { ui.ckOrd.pack = packOrder; saveUI(); } }
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
    if (ui.theme === "dusk") ui.theme = "time"; /* 노을 was a trial, now gone */
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
    return photoDB.get(id).then((b) => b || fetchShared(id)).then((b) => (b ? (urlCache[id] = URL.createObjectURL(b)) : ""));
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
    if (it) picsOf(it.id, state.placePhotos[it.id]).forEach((p) => out.push({ p }));
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
  /* 아침 · 낮 · 저녁: a day can be split into three parts; the list keeps them in that order and numbers run straight through
     (so the map pins still match). Long-press a place and drag it under another heading to move it there */
  const PARTS = ["아침", "낮", "저녁"];
  const partRank = (s) => { const i = PARTS.indexOf(s.part); return i < 0 ? 1 : i; };
  const isSplit = (day, but) => day.stops.some((s) => s !== but && s.pri !== "maybe" && s.part);
  function partSort(day) {
    if (!isSplit(day)) return;
    for (let i = 1; i < day.stops.length; i++) if (partRank(day.stops[i]) < partRank(day.stops[i - 1])) { day.stops = day.stops.slice().sort((a, b) => partRank(a) - partRank(b)); return; }
  }
  /* a place joining a day (new, or moved from another day) goes to the end: in a split day that's the last part in use */
  function joinPart(day, it) {
    if (!isSplit(day, it)) { delete it.part; return; }
    const v = visible(day).filter((x) => x !== it);
    it.part = (v.length && v[v.length - 1].part) || "낮";
  }
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
      if (e.settled) return; /* 정산 완료: already paid back */
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
    return { base, rate, total, share, n, xs, skipped, paid };
  }
  const money = (v, c) => (c.base === "KRW" ? wonFmt(v) + (c.rate ? "<small>" + yuanFmt(v / c.rate) + "</small>" : "") : yuanFmt(v));
  const totalFmt = (c) => (c.base === "KRW" ? wonFmt(c.total) : yuanFmt(c.total));

  /* ---------- shared bits of markup ---------- */
  const starsHtml = (p) => (p && STARS[p] ? '<span class="stars" role="img" aria-label="' + PRI[p] + '">' + STARS[p] + "</span>" : "");
  const tagsHtml = (it) => (it.tags || []).map((t) => '<span class="tag">' + esc(t) + "</span>").join("");
  function ckHtml(x, label, cls) {
    return '<label class="' + (cls || "ck") + (state.done[x.id] ? " on" : "") + '"><input type="checkbox" data-ck="' + x.id + '"' + (state.done[x.id] ? " checked" : "") + "><span>" + (label || esc(x.t)) +
      (x.list ? '<i class="mine-ic" title="나만 보기">' + ICON.lock + "</i>" : "") + "</span></label>";
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
    if (!rate) return '<p class="note">가계부 탭 맨 아래 \'환율\'에 환율을 넣으면 바로 계산돼요</p>';
    return '<div class="calc fxpair"><label class="cin"><span>¥</span><input id="' + pre + 'Y" data-keep data-fx="y" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="위안"></label>' +
      '<span class="mono note" aria-hidden="true">=</span><label class="cin"><span>₩</span><input id="' + pre + 'W" data-keep data-fx="w" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="원"></label></div>';
  }

  /* ---------- page-header sky: 밤 = moon, gold sparkles, lit windows / 낮 = soft blue, faint sun ---------- */
  const spark = (x, y, r) => '<path class="tw" fill="#FFD36B" d="M' + x + " " + (y - r) + "Q" + (x + r * .18) + " " + (y - r * .18) + " " + (x + r) + " " + y + "Q" + (x + r * .18) + " " + (y + r * .18) + " " + x + " " + (y + r) +
    "Q" + (x - r * .18) + " " + (y + r * .18) + " " + (x - r) + " " + y + "Q" + (x - r * .18) + " " + (y - r * .18) + " " + x + " " + (y - r) + 'Z"/>';
  function skyArt(h, small) {
    const dy = h - 190;
    const dots = [[24, 30, 1], [70, 18, .8], [118, 44, 1.1], [160, 12, .7], [196, 34, 1], [252, 14, .8], [300, 18, .9], [366, 40, .8], [190, 80, .7], [52, 84, .8], [140, 104, .6], [18, 120, .7], [96, 132, .7], [228, 108, .6]].filter((s) => s[1] < h - 56 && !(s[0] < 210 && s[1] > 22 && s[1] < 108));
    const gold = [[150, 26, 4.2], [226, 74, 3.4], [338, 22, 4.6], [380, 92, 3.4]].filter((s) => s[1] < h - 50);
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
      '<g class="nt" mask="url(#skym)"><g transform="' + (small ? "translate(" + f1(390 - 390 * .76 - 14) + " " + f1(h - 190 * .76 - 10) + ") scale(.76)" : "translate(0 " + dy + ")") + '">' + skyCity("url(#bfade)", "", "") + "</g></g>" +
      '<g class="dy"><g transform="' + (small ? "translate(" + f1(390 - 390 * .76 - 14) + " " + f1(h - 190 * .76 - 10) + ") scale(.76)" : "translate(0 " + dy + ")") + '">' + skyCity("", "lc", "lcb") + "</g></g></svg>";
  }
  /* the little Pudong skyline in page headers; fill = gradient (밤), or classes for flat colours (낮) */
  function skyCity(fill, cls, back) {
    const f = (c) => (fill ? ' fill="' + fill + '"' : ' class="' + c + '"');
    const win = [[225, 160], [233, 166], [247, 156], [304, 122], [314, 134], [309, 152], [345, 112], [352, 142], [358, 162], [377, 150], [365, 168], [228, 170]];
    return '<circle class="pgl" cx="280" cy="128" r="62" fill="url(#pglow)"/>' +
      '<path' + f(back) + ' d="M218 190V152h8v-12h8v50zM242 190v-40h8v40zM372 190v-48h10v48zM354 190v-36h12v36z"/>' +
      '<polygon' + f(cls) + ' points="300,190 300,110 303,110 303,94 306,94 306,82 309,82 311,60 313,82 316,82 316,94 319,94 319,110 322,110 322,190"/>' +
      '<path' + f(cls) + ' d="M338 190 L340 92 Q343 52 349 32 L353 37 Q358 62 361 92 L363 190 Z"/>' +
      '<path class="stkl" d="M270 186 L276 156 M290 186 L284 156 M280 186 L280 156" stroke-width="3"/>' +
      '<rect class="stkf" x="277.5" y="98" width="5" height="58"/><rect class="stkf" x="278.4" y="70" width="3.2" height="30"/><path class="stkl" d="M280 66 L280 44" stroke-width="1.6"/>' +
      '<circle class="tip" cx="280" cy="43" r="1.8" fill="#FFD36B"/>' +
      (fill ? '<g class="win">' + win.map((w) => '<rect x="' + w[0] + '" y="' + w[1] + '" width="2.2" height="2.2"/>').join("") + "</g>" : "") +
      '<circle cx="280" cy="152" r="11" fill="url(#hpearl)"/><circle cx="280" cy="98" r="7.5" fill="url(#hpearl)"/><circle cx="280" cy="70" r="3.6" fill="url(#hpearl)"/>' +
      '<ellipse cx="276.5" cy="148" rx="3.6" ry="2.2" fill="#fff" opacity=".7" transform="rotate(-30 276.5 148)"/>';
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
    weather: { name: "날씨", desc: "시간대별 예보", icon: "cloud", size: "wide" },
    hotel: { name: "숙소", desc: "체크인 · 체크아웃 시간", icon: "bed", size: "half" },
    flight: { name: "항공편", desc: "가는 편 · 오는 편 탑승권", icon: "plane", size: "wide" },
    todo: { name: "할 일", desc: "출발 전 · 날짜별 할 일", icon: "list", size: "big" },
    pack: { name: "준비물", desc: "짐 체크리스트", icon: "bag", size: "big" },
    apps: { name: "필수 앱", desc: "깔아 둘 앱 체크", icon: "phone", size: "half" },
    route: { name: "오늘 동선", desc: "갈 곳을 작은 지도로", icon: "map", size: "half" },
    settle: { name: "가계부", desc: "내 지출 · 오늘 · 정산", icon: "money", size: "half" },
    fx: { name: "환율 계산", desc: "위안 ↔ 원 바로 계산", icon: "swap", size: "half" },
    photos: { name: "오늘 기록", desc: "최근 기록 · 바로 쓰기", icon: "camera", size: "half" },
    memo: { name: "메모", desc: "나만 보는 메모 한 장", icon: "note", size: "half" }
  };
  const CK_TITLE = { todo: "출발 전 할 일", pack: "준비물", apps: "필수 앱" };
  /* list keys: todo / pack / apps (preparation), or "tk:<dayId>" / "tk:after" for each day's own 할 일 */
  /* 할 일 can be 같이 (synced) or 나만 (state.mine: stays on this phone, shown with a lock) */
  const canMine = (key) => key === "todo" || key === "pack" || String(key).indexOf("tk:") === 0;
  const isMine = (id) => state.mine.some((x) => x.id === id);
  function ckList(key) {
    const mine = canMine(key) ? state.mine.filter((x) => x.list === key) : [];
    let base = [];
    if (state.prep[key]) base = state.prep[key].concat(mine);
    else if (String(key).indexOf("tk:") === 0) { const d = key.slice(3); base = state.tasks.filter((x) => x.day === d).concat(mine); }
    /* the order this phone dragged them into (같이 and 나만 mixed); new ones go to the end */
    const ord = (ui.ckOrd || {})[key];
    if (!ord || !ord.length) return base;
    const pos = (id) => { const i = ord.indexOf(id); return i < 0 ? 1e6 : i; };
    return base.map((x, i) => [x, i]).sort((a, b) => pos(a[0].id) - pos(b[0].id) || a[1] - b[1]).map((a) => a[0]);
  }
  /* after a drag: remember the order here, and put the shared list in the same order so a friend sees it too */
  function ckReorder(key, ids) {
    const rank = (x) => { const i = ids.indexOf(x.id); return i < 0 ? 1e6 : i; };
    const inPlace = (arr, pick) => {
      const slots = []; arr.forEach((x, i) => { if (pick(x)) slots.push(i); });
      const items = slots.map((i) => arr[i]).sort((a, b) => rank(a) - rank(b));
      slots.forEach((sl, k) => { arr[sl] = items[k]; });
    };
    if (state.prep[key]) inPlace(state.prep[key], () => true);
    else if (String(key).indexOf("tk:") === 0) { const d = key.slice(3); inPlace(state.tasks, (x) => x.day === d); }
    inPlace(state.mine, (x) => x.list === key);
    if (canMine(key)) { ui.ckOrd = ui.ckOrd || {}; ui.ckOrd[key] = ids; saveUI(); }
    save();
  }
  function ckTitle(key) {
    if (CK_TITLE[key]) return CK_TITLE[key];
    const d = findDay(String(key).slice(3));
    if (!d) return "다녀와서 할 일";
    return d.iso === todayIso() ? "오늘 할 일" : (isNum(d.n) ? "Day " + d.n : "귀국날") + " 할 일";
  }
  function ckAdd(key, text, mine) {
    if (mine && canMine(key)) state.mine.push({ id: newId("m"), t: text, list: key });
    else if (state.prep[key]) state.prep[key].push(key === "apps" ? { id: newId("a"), t: text, u: "" } : { id: newId(key === "todo" ? "t" : "k"), t: text });
    else state.tasks.push({ id: newId("t"), t: text, day: key.slice(3) });
  }
  function ckDel(key, id) {
    state.mine = state.mine.filter((x) => x.id !== id);
    if (state.prep[key]) state.prep[key] = state.prep[key].filter((x) => x.id !== id);
    else state.tasks = state.tasks.filter((x) => x.id !== id);
  }
  /* move one 할 일 / 준비물 between 같이 and 나만, keeping its tick */
  let ptrDown = false;
  document.addEventListener("pointerdown", () => { ptrDown = true; }, true);
  ["pointerup", "pointercancel"].forEach((n) => document.addEventListener(n, () => { setTimeout(() => { ptrDown = false; }, 0); }, true));
  const ckWords = (key, x) => '<label class="ck-t" for="ckx-' + x.id + '">' + esc(x.t) + (x.list ? '<i class="mine-ic">' + ICON.lock + "</i>" : "") + "</label>";
  function ckMove(key, id) {
    /* it stays where it was in the list on this phone */
    if (canMine(key)) { ui.ckOrd = ui.ckOrd || {}; ui.ckOrd[key] = ckList(key).map((y) => y.id); saveUI(); }
    const m = state.mine.find((x) => x.id === id);
    if (m) {
      state.mine = state.mine.filter((x) => x !== m);
      if (state.prep[key]) state.prep[key].push({ id: m.id, t: m.t }); else state.tasks.push({ id: m.id, t: m.t, day: key.slice(3) });
      return "같이";
    }
    const src = state.prep[key] || state.tasks, x = src.find((y) => y.id === id);
    if (!x) return "";
    if (state.prep[key]) state.prep[key] = state.prep[key].filter((y) => y !== x); else state.tasks = state.tasks.filter((y) => y !== x);
    state.mine.push({ id: x.id, t: x.t, list: key });
    return "나만";
  }
  const ckKeyOf = (id) => (state.mine.find((x) => x.id === id) || {}).list || Object.keys(CK_TITLE).find((k) => state.prep[k].some((x) => x.id === id)) || ((state.tasks.find((x) => x.id === id) || {}).day ? "tk:" + state.tasks.find((x) => x.id === id).day : "");
  const todoKey = (ctx) => (ctx.ph.k === "before" ? "todo" : ctx.ph.k === "after" ? "tk:after" : "tk:" + ctx.day.id);
  /* each home view keeps its own widgets; a view that was never edited starts from the old shared set */
  function wKey() { const ph = phase(); return ph.k === "during" ? ph.day.id : ph.k; }
  function wSetName() { const ph = phase(); return ph.k === "before" ? "여행 전" : ph.k === "after" ? "다녀온 뒤" : isNum(ph.day.n) ? "Day " + ph.day.n : "귀국날"; }
  function widgetList() {
    ui.wsets = ui.wsets || {};
    const k = wKey();
    let w = ui.wsets[k];
    if (!Array.isArray(w)) w = wRec(k);
    w = w.filter((x, i, a) => WDEF[x] && a.indexOf(x) === i);
    ui.wsets[k] = w;
    return w;
  }
  function setEdge(bot) { const r = document.documentElement; if (r.classList.contains("edge-b") !== !!bot) r.classList.toggle("edge-b", !!bot); }
  function edgeByScroll() { const r = document.documentElement, max = r.scrollHeight - window.innerHeight; if (max > 24) setEdge(window.scrollY > max / 2); else if (window.scrollY <= 0) setEdge(false); }
  function setWidgets(list) { ui.wsets = ui.wsets || {}; ui.wsets[wKey()] = list; saveUI(); }

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
    /* 밤 하늘 별: the original scatter (it already looked right), with stars beside the tower kept small and still,
       and a few faint ones around the title */
    const nearTower = (x, y) => Math.abs(x - 196) < 46 && y > 140;
    let stars = "";
    for (let i = 0; i < 46; i++) {
      const x = f1(rnd() * 390), y = f1(rnd() * 400), r = f1(0.5 + rnd() * 1.1), o = f1(0.35 + rnd() * 0.55);
      const clear = y > 88 && y < 340 && !(x < 250 && y > 90 && y < 230) && !(x > 296 && y < 142) && !(Math.abs(x - 317) < 24 && Math.abs(y - 171) < 24);
      const nt = nearTower(+x, +y);
      if (clear && i % 6 !== 5 && [13, 16, 43].indexOf(i) < 0 && !(Math.abs(x - 105.4) < 1 && Math.abs(y - 306.7) < 1)) stars += '<circle class="' + (i % 3 || nt ? "" : "tw") + '" cx="' + x + '" cy="' + y + '" r="' + f1(Math.min(r, nt ? 0.7 : 1.2)) + '" fill="#fff" opacity="' + f1(Math.max(o, 0.5)) + '"/>';
    }
    [[22, 76, .8], [104, 56, .7], [292, 46, .8], [374, 34, .7], [276, 172, .7]]
      .forEach((t, i) => { stars += '<circle class="' + (i % 2 ? "tw" : "") + '" cx="' + t[0] + '" cy="' + t[1] + '" r="' + t[2] + '" fill="#fff" opacity=".6"/>'; });
    [[118, 104, .85, 0], [238, 150, .9, 1], [26, 212, .75, 0], [172, 230, .8, 1], [166, 110, .65, 0], [204, 131, 1, 1], [126, 146, .8, 1], [170, 168, .6, 0], [104, 176, .55, 1], [244, 212, .8, 0]]
      .forEach((t) => { stars += '<circle class="' + (t[3] ? "tw" : "") + '" cx="' + t[0] + '" cy="' + t[1] + '" r="' + t[2] + '" fill="#fff" opacity=".6"/>'; });
    const gold = [[360, 232, 4.4], [84, 262, 3.6], [34, 322, 3], [374, 148, 3.4], [370, 300, 3]].map((g) => spark(g[0], g[1], g[2])).join("");
    const bloomPts = [[54, 232], [372, 262], [250, 118], [105.4, 306.7]];
    let far = "", x = -6;
    while (x < 396) {
      const w = 12 + Math.floor(rnd() * 16), h = 26 + Math.floor(rnd() * 64);
      far += '<rect x="' + x + '" y="' + (470 - h) + '" width="' + (w - 2) + '" height="' + (h + 4) + '"/>';
      x += w;
    }
    const blocks = [[0, 404, 26], [24, 420, 20], [42, 380, 22], [62, 410, 18], [80, 392, 24], [102, 424, 18], [118, 400, 22], [138, 430, 16], [228, 418, 18], [342, 408, 20], [360, 380, 18], [376, 420, 16]];
    let near = "", wins = "";
    blocks.forEach((b) => {
      near += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + (474 - b[1]) + '"/>';
      for (let yy = b[1] + 8; yy < 462; yy += 9) for (let xx = b[0] + 4; xx < b[0] + b[2] - 3; xx += 6) if (rnd() < 0.3) wins += '<rect x="' + xx + '" y="' + yy + '" width="2" height="2.6"/>';
    });
    let shim = "";
    for (let i = 0; i < 46; i++) {
      const cx = rnd() * 390, y = 480 + rnd() * 240, w = 6 + rnd() * 34;
      const near1 = Math.abs(cx - 196) < 40 ? "#FFB8E6" : Math.abs(cx - 300) < 30 || Math.abs(cx - 336) < 20 ? "#FFD68A" : "#B7A9FF";
      shim += '<rect class="' + (i % 4 ? "" : "tw") + '" x="' + f1(cx - w / 2) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="1.6" rx=".8" fill="' + near1 + '" opacity="' + f1(0.18 + rnd() * 0.45) + '"/>';
    }
    /* more city past both edges — only seen when the city is drawn smaller (days with a taller card) */
    let xl = -6;
    while (xl > -200) {
      const w = 12 + Math.floor(rnd() * 16), h = 26 + Math.floor(rnd() * 64);
      xl -= w; far += '<rect x="' + xl + '" y="' + (470 - h) + '" width="' + (w - 2) + '" height="' + (h + 4) + '"/>';
    }
    while (x < 600) {
      const w = 12 + Math.floor(rnd() * 16), h = 26 + Math.floor(rnd() * 64);
      far += '<rect x="' + x + '" y="' + (470 - h) + '" width="' + (w - 2) + '" height="' + (h + 4) + '"/>';
      x += w;
    }
    [[-176, 398, 22], [-154, 420, 18], [-136, 386, 24], [-112, 412, 20], [-92, 394, 18], [-74, 424, 16], [-58, 402, 22], [-36, 386, 18], [-18, 414, 18],
      [392, 398, 20], [412, 424, 16], [428, 388, 24], [452, 410, 18], [470, 394, 22], [492, 420, 18], [510, 400, 20], [530, 384, 22], [552, 414, 20]].forEach((b) => {
      near += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + (474 - b[1]) + '"/>';
      for (let yy = b[1] + 8; yy < 462; yy += 9) for (let xx = b[0] + 4; xx < b[0] + b[2] - 3; xx += 6) if (rnd() < 0.3) wins += '<rect x="' + xx + '" y="' + yy + '" width="2" height="2.6"/>';
    });
    /* 밤: a few brighter stars whose light swells and fades, each in its own time */
    const bloom = bloomPts.map((q, i) =>
      '<g transform="translate(' + q[0] + " " + q[1] + ')"><g class="bloom b' + (i + 1) + '"><circle r="11" fill="url(#blg)"/></g><circle r="1.4" fill="#FFFFFF" opacity=".9"/></g>').join("");
    /* 밤: now and then a shooting star slips down the sky (one at a time, mostly none) */
    const shoot = [[378, 236, 160, 56], [176, 250, 154, 46], [268, 318, 166, 40]].map((q, i) =>
      '<g transform="translate(' + q[0] + " " + q[1] + ") rotate(" + q[2] + ')"><g class="shoot s' + (i + 1) + '"><rect x="-' + q[3] + '" y="-.7" width="' + q[3] + '" height="1.4" rx=".7" fill="url(#shg)"/><circle r="1.25" fill="#FFFFFF"/></g></g>').join("");
    heroSvg = '<svg class="hero-art" viewBox="0 0 390 781" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>' +
      '<radialGradient id="blg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF4D6" stop-opacity=".55"/><stop offset=".45" stop-color="#FFF0CC" stop-opacity=".18"/><stop offset="1" stop-color="#FFF0CC" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="shg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".9"/></linearGradient>' +
      '<linearGradient id="hs" x1="0" y1="0" x2="0" y2="1"><stop class="hs0" offset="0"/><stop class="hs1" offset=".3"/><stop class="hs2" offset=".5"/><stop class="hs3" offset=".62"/></linearGradient>' +
      '<linearGradient id="hsd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5AA9DE"/><stop offset="0.05" stop-color="#64AFE1"/><stop offset="0.1" stop-color="#6EB5E4"/><stop offset="0.15" stop-color="#77BBE8"/><stop offset="0.2" stop-color="#80C1EB"/><stop offset="0.25" stop-color="#8AC6ED"/><stop offset="0.3" stop-color="#94CBEF"/><stop offset="0.35" stop-color="#9DD0F1"/><stop offset="0.4" stop-color="#A7D5F2"/><stop offset="0.45" stop-color="#B0DAF4"/><stop offset="0.5" stop-color="#BADDF5"/><stop offset="0.55" stop-color="#C4E0F5"/><stop offset="0.6" stop-color="#CEE3F6"/><stop offset="0.65" stop-color="#D7E4F5"/><stop offset="0.7" stop-color="#E0E3F3"/><stop offset="0.75" stop-color="#E8E3F1"/><stop offset="0.8" stop-color="#EFE3EE"/><stop offset="0.85" stop-color="#F5E2EA"/><stop offset="0.9" stop-color="#F9E3E7"/><stop offset="0.95" stop-color="#FCE7E6"/><stop offset="1" stop-color="#FFEAE4"/></linearGradient>' +
      '<linearGradient id="hwd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCDDF0"/><stop offset=".22" stop-color="#BCD6F0"/><stop offset="1" stop-color="#94C0E6"/></linearGradient>' +
      '<linearGradient id="clg" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FBE3EB"/></linearGradient>' +
      '<linearGradient id="hw" x1="0" y1="0" x2="0" y2="1"><stop class="hw0" offset="0"/><stop class="hw1" offset=".35"/><stop class="hw2" offset="1"/></linearGradient>' +
      '<radialGradient id="hglow" cx=".5" cy=".5" r=".5"><stop class="hg" offset="0" stop-opacity=".5"/><stop class="hg" offset="1" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="hm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE7A8" stop-opacity=".32"/><stop offset="1" stop-color="#FFE7A8" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="trailg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".5"/></linearGradient>' +
      '<radialGradient id="hhaze" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF6F0" stop-opacity=".7"/><stop offset=".35" stop-color="#FFF3EE" stop-opacity=".38"/><stop offset=".7" stop-color="#FFF1EE" stop-opacity=".12"/><stop offset="1" stop-color="#FFF1EE" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="hsun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset=".4" stop-color="#FFFFFF" stop-opacity=".18"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="hp" cx=".36" cy=".32" r=".75"><stop class="hp0" offset="0"/><stop class="hp1" offset=".38"/><stop class="hp2" offset=".78"/><stop class="hp3" offset="1"/></radialGradient>' +
      '<linearGradient id="hb" x1="0" y1="0" x2="0" y2="1"><stop class="hb0" offset="0"/><stop class="hb1" offset="1"/></linearGradient>' +
      '<linearGradient id="hr" x1="0" y1="0" x2="0" y2="1"><stop class="hr" offset="0" stop-opacity=".5"/><stop class="hr" offset="1" stop-opacity="0"/></linearGradient>' +
      '<clipPath id="hcut"><rect x="0" y="0" width="390" height="474"/></clipPath>' + /* the legs stop dead level at the water line */
      '<mask id="hmm"><rect width="390" height="760" fill="#fff"/><circle cx="321" cy="167" r="12.5" fill="#000"/></mask></defs>' +
      '<rect width="390" height="480" fill="url(#hs)"/><rect class="dy" width="390" height="480" fill="url(#hsd)"/>' +
      '<g class="nt">' + stars + gold + bloom + shoot + '<circle cx="314" cy="174" r="44" fill="url(#hm)"/><circle cx="314" cy="174" r="14" fill="#FFE7A8" mask="url(#hmm)"/></g>' +
      '<g class="dy"><circle class="sunglow" cx="314" cy="174" r="82" fill="url(#hsun)"/><circle cx="314" cy="174" r="13.5" fill="#FFFFFF" opacity=".55"/>' +
      '<g class="hsky"><g class="plane-fly"><rect x="-66" y="-.8" width="54" height="1.6" rx=".8" fill="url(#trailg)"/>' +
        '<g transform="rotate(90) scale(.95) translate(-12 -12)"><path fill="#FFFFFF" d="M21 15.5v-2l-7.5-4.5V4.2a1.5 1.5 0 0 0-3 0V9L3 13.5v2l7.5-2.3v5l-2.2 1.6V21l3.7-1 3.7 1v-1.2l-2.2-1.6v-5z"/></g></g></g>' +
      cloud(330, 40, .5, .5, 140) + cloud(64, 262, .9, .75, 105) + cloud(206, 236, .5, .55, 125) + cloud(286, 316, .72, .65, 115) + cloud(130, 352, .58, .6, 98) + cloud(40, 304, .45, .5, 132) +
      "</g>" + '<g class="dy hwat"><ellipse cx="195" cy="476" rx="350" ry="125" fill="url(#hhaze)"/></g>' +
      '<g class="hwat"><ellipse cx="200" cy="470" rx="280" ry="110" fill="url(#hglow)"/></g>' +
      '<g class="hcity"><g class="far">' + far + "</g></g>" +
      '<g class="hwat"><rect y="474" width="390" height="307" fill="url(#hw)"/><rect class="dy" y="474" width="390" height="307" fill="url(#hwd)"/><rect class="hwb" y="780" width="390" height="260"/></g>' +
      '<g class="hcity"><g fill="url(#hb)">' + near +
      '<path d="M284 474 L287 330 Q290 280 302 246 L306 250 Q314 290 316 330 L318 474 Z"/>' +
      '<path fill-rule="evenodd" d="M248 474 L250 296 L272 282 L274 474 Z M254 297 L269 290 L269 306 L254 311 Z"/>' +
      '<polygon points="326,474 326,370 329,370 329,350 332,350 332,334 335,334 337,300 339,334 342,334 342,350 345,350 345,370 348,370 348,474"/>' +
      /* the three legs run on down behind the river: cut flat at the water line, so the tower stands beyond the water, not on it */
      '<path class="hbs" clip-path="url(#hcut)" d="M170.3 480 L190 426 M221.7 480 L202 426 M196 480 L196 426" stroke-width="7" stroke-linecap="butt"/>' +
      '<rect x="191" y="300" width="10" height="122"/><rect x="193" y="228" width="6" height="74"/></g>' +
      '<path class="ant" d="M196 226 L196 158" stroke-width="2.4"/><circle class="tip" cx="196" cy="156" r="2.4" fill="#FFD36B"/>' +
      '<g class="win">' + wins + '<rect x="300" y="300" width="2" height="2.6"/><rect x="305" y="340" width="2" height="2.6"/><rect x="298" y="380" width="2" height="2.6"/><rect x="309" y="410" width="2" height="2.6"/><rect x="262" y="330" width="2" height="2.6"/><rect x="258" y="380" width="2" height="2.6"/><rect x="266" y="420" width="2" height="2.6"/><rect x="336" y="390" width="2" height="2.6"/><rect x="340" y="430" width="2" height="2.6"/></g>' +
      '<g class="pglow"><circle cx="196" cy="420" r="46" fill="url(#hglow)"/><circle cx="196" cy="300" r="30" fill="url(#hglow)"/></g>' +
      '<circle cx="196" cy="420" r="22" fill="url(#hp)"/><circle cx="196" cy="300" r="15" fill="url(#hp)"/><circle cx="196" cy="228" r="7.5" fill="url(#hp)"/>' +
      '<ellipse cx="189" cy="412" rx="7" ry="4.2" fill="#fff" opacity=".7" transform="rotate(-30 189 412)"/><ellipse cx="191" cy="294" rx="4.6" ry="2.8" fill="#fff" opacity=".7" transform="rotate(-30 191 294)"/>' +
      '<rect class="hrf" x="174" y="478" width="44" height="150" fill="url(#hr)" opacity=".55"/></g>' +
      '<g class="hwat"><g class="shim">' + shim + "</g>" +
      '<path class="hzl" d="M0 480 H390" stroke-width="1"/></g></svg>';
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
  /* airline from the flight number (MU512 → 중국동방항공) */
  function airline(no) {
    const m = String(no || "").toUpperCase().match(/^([A-Z0-9]{2})\d/);
    return m ? ({ MU: "중국동방항공", FM: "상하이항공", CA: "중국국제항공", CZ: "중국남방항공", HO: "준야오항공", "9C": "춘추항공", KE: "대한항공", OZ: "아시아나항공", "7C": "제주항공", LJ: "진에어", TW: "티웨이항공", BX: "에어부산", ZE: "이스타항공", RS: "에어서울" })[m[1]] || "" : "";
  }
  function iata(name) {
    const n = String(name || "");
    return /김포|金浦/.test(n) ? "GMP" : /홍차오|虹桥/.test(n) ? "SHA" : /푸동|浦东/.test(n) ? "PVG" : /인천|仁川/.test(n) ? "ICN" : n.slice(0, 3).toUpperCase();
  }
  /* 여행 한눈에: both flights, the hotel, then each day with its places as chips (꼭 가기 first) */
  function tripSumSheet() {
    const legs = state.flight.legs, h = state.hotel, t = state.trip;
    const leg = (l) => '<div class="ts-leg"><small>' + esc((l.label || "") + " · " + (l.date || "")) + '</small><b class="mono">' + esc(iata(l.from) + " " + (l.dep || "")) + "</b><em>→ " + esc(iata(l.to) + " " + (l.arr || "")) + "</em></div>";
    const days = state.days.map((d) => {
      const w = dayWx(d), list = visible(d).filter((x) => !/공항|체크인|체크아웃/.test(x.ko || "") || d.stops.length <= 2);
      const sorted = list.filter((x) => x.pri === "must").concat(list.filter((x) => x.pri !== "must"));
      const chips = sorted.slice(0, 5).map((x) => '<span class="' + (x.pri === "must" ? "m" : "") + '">' + (x.pri === "must" ? "★ " : "") + esc(x.label || shortName(x.ko)) + "</span>").join("") + (sorted.length > 5 ? "<span>+" + (sorted.length - 5) + "</span>" : "");
      return '<button class="ts-day" type="button" data-act="go-plan" data-day="' + d.id + '" style="--c:' + dayC(d) + '"><span class="ts-n">' + esc(d.n) + '</span><span class="ts-dt mono">' + esc(d.date) + (w.hi ? '<i>' + ICON[w.kind] + esc(w.hi) + "°</i>" : "") + '</span><b class="ts-tt">' + esc(d.title) + '</b><span class="ts-go" aria-hidden="true">›</span>' +
        (chips ? '<span class="tchips">' + chips + "</span>" : "") + "</button>";
    }).join("");
    openSheet({
      key: "tripsum", title: (tripTitle() || "여행") + " 한눈에",
      body: '<div class="ts-legs">' + legs.map(leg).join("") + "</div>" +
        (h.name ? '<div class="ts-hotel"><small>숙소' + ((tripTitle().match(/\d+박/) || [""])[0] ? " · " + (tripTitle().match(/\d+박/) || [""])[0] : "") + "</small>" + esc(shortName(h.name)) + (h.note ? " · " + esc(h.note.replace(/\s*\(.*?\)\s*/g, " ")) : "") + "</div>" : "") + days
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
      const d1 = state.days[0], w = dayWx(d1), rate = +state.settle.rate || 0;
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
        '<div class="hc-slide"><div class="bp-wrap"><article class="pc bpass"><div class="bp-main" data-act="flight" role="button" aria-label="항공편 자세히">' +
        '<span class="pc-tag on">' + esc([l0.label || "가는 편", airline(l0.no)].filter(Boolean).join(" · ")) + "</span>" +
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
      Object.keys(Object.assign({}, state.placePhotos, state.shared)).forEach((k) => { if (!state.posts.some((x) => x.id === k)) photos += picsOf(k, state.placePhotos[k]).length; });
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
      const w = dayWx(ph.day);
      if (w.c) hint = '<a class="hwx" href="' + WX_URL + '"' + EXT + ">" + ICON[w.kind] + esc(w.c) + (w.t ? " · " + esc(w.t) : "") + "</a>";
    } else {
      chip = ph.k === "before" ? "여행 전" : "다녀온 여행";
      title = tripTitle() || "상하이";
      hint = '<span class="mono">' + esc(String(t.dates || "").replace(/\s*·\s*\d+박.*$/, "")) + "</span>";
    }
    const flyday = ph.k === "during" && state.days.length && (ph.day === state.days[0] || ph.day === state.days[state.days.length - 1]);
    let s = '<section class="hero' + (flyday ? " flyday" : "") + '">' + heroArt() + /* the plane only crosses the sky on the days we fly */
      '<div class="hero-top"><div class="hrow"><span class="hz">上海</span><button class="hchip" type="button" data-act="preview-pick" aria-label="홈 화면 미리보기 바꾸기">' + esc(chip) + ICON.chevR + "</button>" +
      '<button class="hedit' + (editing ? " done" : "") + '" type="button" data-act="w-edit">' + (editing ? "완료" : "편집") + "</button></div>" +
      '<h1 class="htitle">' + esc(title) + "</h1>" + (hint ? '<div class="hhint">' + hint + "</div>" : "") + "</div>" +
      '<div class="hero-card">' + heroCardHtml(ctx) + "</div>" +
      '<button class="hero-more" type="button" data-act="to-widgets">위젯 ' + ICON.chevR + "</button></section>";
    const list = widgetList();
    /* half-width widgets pair up in order; an odd one left over stretches across the row, so there's never a hole */
    const halves = list.filter((id) => WDEF[id] && WDEF[id].size === "half");
    wSolo = halves.length % 2 ? halves[halves.length - 1] : "";
    s += '<div class="wzone" id="wzone">' + (editing ? '<p class="wnote">' + esc(wSetName()) + " 홈 위젯 편집 중 · 날짜마다 따로 저장돼요</p>" : "") + '<div class="wgrid' + (editing ? " wedit" : "") + '" id="wgrid">' + list.map((id) => widgetHtml(id, ctx)).join("") +
      (editing ? '<button class="w-add" type="button" data-act="w-addsheet">+ 위젯 추가</button>' + wResetBtn() : "") + "</div>" +
      (!list.length && !editing ? '<p class="note" style="text-align:center;margin-top:24px;color:#fff">\'편집\'을 눌러 위젯을 넣어보세요</p>' : "") + "</div>";
    return s;
  }
  let dotScrub = false; /* dragging along the home card's dots: hold off re-renders until the finger lifts */
  const HERO_CARD_BEFORE = 266; /* height of the 여행 전 card area: the river sits just above it, and every day keeps that same gap */
  const HERO_CITY_DAY = 0.85; /* city size on days with a taller card (1 = 여행 전 size) */
  function fitHero() {
    const hero = $(".hero"), card = hero && hero.querySelector(".hero-card");
    if (!hero || !card) return;
    const hr = hero.getBoundingClientRect(), s = Math.max(hr.width / 390, hr.height / 781);
    const lift = card.offsetHeight - HERO_CARD_BEFORE;
    if (lift < 4) { ["--wy", "--cs", "--py"].forEach((k) => hero.style.removeProperty(k)); return; }
    const cs = HERO_CITY_DAY, wy = -lift / s;
    hero.style.setProperty("--wy", wy.toFixed(1) + "px");
    hero.style.setProperty("--cs", String(cs));
    hero.style.setProperty("--py", (wy + 222 * (1 - cs)).toFixed(1) + "px");
  }
  function heroMount() {
    fitHero();
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
    const bar = document.querySelector(".hc-dots");
    if (bar && n > 1) {
      let scrub = false, last = -1;
      const at = (x) => { /* the nearest dot */
        let best = 0, dist = 1e9;
        dots.forEach((d, k) => { const r = d.getBoundingClientRect(), c = Math.abs(x - (r.left + r.width / 2)); if (c < dist) { dist = c; best = k; } });
        return Math.min(n - 1, best);
      };
      const go = (x, smooth) => {
        const i = at(x);
        if (i === last) return;
        last = i; heroIdx[dayId] = i; mark(i);
        hc.scrollTo({ left: i * hc.clientWidth, behavior: smooth ? "smooth" : "auto" });
      };
      bar.addEventListener("pointerdown", (e) => { e.preventDefault(); scrub = dotScrub = true; last = -1; try { bar.setPointerCapture(e.pointerId); } catch (err) {} go(e.clientX, true); });
      bar.addEventListener("pointermove", (e) => { if (scrub) go(e.clientX, false); });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => bar.addEventListener(ev, () => { scrub = dotScrub = false; }));
    }
    let tm;
    hc.addEventListener("scroll", () => {
      clearTimeout(tm);
      tm = setTimeout(() => { const i = Math.round(hc.scrollLeft / Math.max(1, hc.clientWidth)); heroIdx[dayId] = i; mark(i); }, 60);
    }, { passive: true });
  }
  /* in edit mode: put this one home view back to its 추천 배치 (everything at once lives in 설정) */
  function wResetBtn() {
    return '<button class="w-send w-reset" type="button" data-act="w-reset">' + ICON.undo + "<span>위젯 초기 세팅으로 되돌리기</span></button>" +
      '<p class="wnote wsent">지금 보는 ' + esc(wSetName()) + " 화면만 추천 배치로 돌아가요</p>";
  }

  let wSolo = "";
  function wrapW(id, inner, cls, attrs) {
    const def = WDEF[id];
    return '<div class="w w-' + def.size + (id === wSolo ? " w-solo" : "") + (cls ? " " + cls : "") + '" data-w="' + id + '"' + (attrs || "") + ">" +
      (editing ? '<button class="w-del" type="button" data-act="w-del" data-w="' + id + '" aria-label="' + def.name + ' 위젯 빼기">' + ICON.minus + "</button>" : "") + inner + "</div>";
  }
  function widgetHtml(id, ctx) {
    switch (id) {
      case "weather": {
        const d = ctx.ph.k === "after" ? state.days[state.days.length - 1] : ctx.day, w = dayWx(d), hrs = d ? wxHours(d.iso) : [];
        const today = d && d.iso === shanghaiNow().slice(0, 10);
        const lbl = today ? "오늘 날씨" : ctx.ph.k === "before" ? "첫날 날씨" : "날씨";
        const temps = hrs.map((h) => h.t), hi = temps.length ? Math.round(Math.max.apply(null, temps)) : w.hi, lo = temps.length ? Math.round(Math.min.apply(null, temps)) : w.lo;
        const strip = hrs.length
          ? '<div class="wxh">' + hrs.map((h) => '<div class="' + (h.now ? "now" : "") + '"><span>' + (h.now ? "지금" : h.h + "시") + "</span>" + ICON[h.kind] + "<b>" + Math.round(h.t) + "°</b>" + (h.p >= 20 ? "<em>" + h.p + "%</em>" : "<em></em>") + "</div>").join("") + "</div>"
          : '<p class="wxh-none">' + (d && daysUntil(d.iso) > 15 ? "시간대별 예보는 출발 2주 전부터 떠요" : "시간대별 예보를 불러오지 못했어요 · 인터넷 연결되면 떠요") + "</p>";
        return wrapW(id, '<div class="hd"><span class="lbl">' + lbl + '</span><span class="mono sub">' + esc(d ? d.date : "") + "</span></div>" +
          '<div class="wx-row"><span class="ico">' + ICON[w.kind] + '</span><span class="wx-t"><b class="mono">' + esc(hi || "—") + (hi ? "°" : "") + '</b><span class="mono">' + (lo ? "/ " + esc(lo) + "°" : "") + '</span></span><span class="sub wx-c">' + esc(w.c || "") + '</span><a class="wx-more" href="' + WX_URL + '"' + EXT + ">자세히 ↗</a></div>" + strip,
          "wweather");
      }
      case "hotel": {
        const h = state.hotel, tm = hotelTimes(h);
        return wrapW(id, '<div class="hd"><span class="lbl">숙소</span>' + ICON.bed + "</div>" +
          '<b class="wtitle">' + esc(shortName(h.name) || "아직 미정") + "</b>" +
          (h.note ? '<span class="sub clamp2">' + esc(h.note) + "</span>" : "") +
          '<span class="chips push">' + (tm.in ? '<span class="minichip">IN ' + tm.in + "</span>" : "") + (tm.out ? '<span class="minichip">OUT ' + tm.out + "</span>" : "") + "</span>", "", ' data-act="hotel"');
      }
      case "flight": return wFlight(ctx);
      case "todo": return wCheck(todoKey(ctx), "todo");
      case "pack": case "apps": return wCheck(id);
      case "route": {
        const d = ctx.day;
        return wrapW(id, d ? routeMap(d, id === wSolo ? 358 : 172, 138, { mini: true, uid: "w", padT: 22, padB: 18, padL: 22, padR: 22 }) + '<span class="wtag">' + (ctx.ph.k === "during" ? "오늘 동선" : (isNum(d.n) ? "DAY " + d.n : "귀국") + " 동선") + "</span>" : "", "wmap", d ? ' data-act="go-plan" data-day="' + d.id + '"' : "");
      }
      case "settle": {
        const L = ledgerSum(), c = L.c, x = c.xs[0];
        return wrapW(id, '<div class="hd"><span class="lbl">가계부</span>' + ICON.money + "</div>" +
          '<b class="big wbig">' + amtFmt(L.total, c) + "</b>" + '<span class="sub">내 지출 · 오늘 ' + amtFmt(L.today, c) + "</span>" +
          '<span class="sub push wxfer">' + (x ? "<b>" + esc(x.from) + "</b> → <b>" + esc(x.to) + "</b> " + amtFmt(x.v, c) + (c.xs.length > 1 ? " 외 " + (c.xs.length - 1) + "건" : "") : state.settle.expenses.length ? "정산할 돈 없어요" : "아직 같이 쓴 돈 없어요") + "</span>",
          "", ' data-act="tab" data-tab="money"');
      }
      case "fx": return wrapW(id, '<div class="hd"><span class="lbl">환율 계산</span><span class="mono sub">' + (state.settle.rate ? "1 : " + esc(state.settle.rate) : "") + "</span></div>" + '<div class="wfx">' + fxHtml("wfx") + "</div>");
      case "photos": {
        const d = ctx.ph.k === "after" ? state.days[state.days.length - 1] : ctx.ph.k === "before" ? preDay() : ctx.day, list = d ? postsOf(d.id) : [], p = list[list.length - 1];
        const pic = p ? postPics(p.id)[0] : "";
        const lbl = ctx.ph.k === "during" && d && d.iso === todayIso() ? "오늘 기록" : d && d.pre ? "여행 전 기록" : d ? d.date + " 기록" : "기록";
        return wrapW(id, '<div class="hd"><span class="lbl">' + esc(lbl) + '</span><span class="mono sub">' + (list.length ? list.length + "개" : "") + "</span></div>" +
          (p ? '<div class="wpost">' + (pic ? '<img data-pid="' + esc(pic) + '" alt="">' : "") + '<span class="' + (pic ? "t" : "t only") + '">' + esc(p.text || "사진 기록") + "</span></div>" : '<span class="sub">아직 기록이 없어요</span>') +
          '<button class="wpost-add" type="button" data-act="post-new" data-day="' + (d ? d.id : "") + '">' + ICON.plus + "기록 쓰기</button>",
          "", ' data-act="go-log" data-day="' + (d ? d.id : "") + '"');
      }
      case "memo": {
        const m = state.memos[0];
        return wrapW(id, '<div class="hd"><span class="lbl">메모</span>' + ICON.note + "</div>" + '<div class="wmemo">' + (m ? esc(m.text) : '<span class="sub">눌러서 메모 적기</span>') + "</div>",
          "", ' data-act="memo-add"');
      }
    }
    return "";
  }
  /* delete a checklist item, with 되돌리기 putting it back in the same spot */
  function ckDelUndo(k, id) {
    const arrs = [state.mine, state.prep[k] || state.tasks];
    let home = null;
    arrs.forEach((a) => { const i = a.findIndex((y) => y.id === id); if (i >= 0 && !home) home = { a: a === state.mine ? "mine" : state.prep[k] ? "prep" : "tasks", i, it: a[i] }; });
    const wasDone = !!state.done[id];
    const redraw = () => { render(); if (sheetKey() === "ck-" + k) ckSheet(k); };
    ckDel(k, id); delete state.done[id]; openSw = null; save(); redraw();
    if (!home) { toast("지웠어요"); return; }
    toast("'" + home.it.t + "' 지웠어요", { label: "되돌리기", fn: () => {
      const a = home.a === "mine" ? state.mine : home.a === "prep" ? state.prep[k] : state.tasks;
      if (!a.some((y) => y.id === id)) a.splice(Math.min(home.i, a.length), 0, home.it);
      if (wasDone) state.done[id] = true;
      save(); redraw();
    } }, 5000);
  }
  /* checklist widgets: the whole list, scrollable; tap anywhere else to open it big */
  function wCheck(key, wid) {
    const list = ckList(key), doneN = list.filter((x) => state.done[x.id]).length, title = ckTitle(key);
    const sorted = list.filter((x) => !state.done[x.id]).concat(list.filter((x) => state.done[x.id]));
    return wrapW(wid || key, '<div class="hd"><span class="lbl">' + esc(title) + '</span><button class="wedit-ic" type="button" data-act="ck-sheet" data-list="' + key + '" aria-label="' + esc(title) + ' 추가 · 편집">' + ICON.pen + "</button></div>" +
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
    const c = dayC(day), vis = visible(day), w = dayWx(day), ph = phase(), di = state.days.indexOf(day), pr = dayProgress(day);
    const nextId = ph.k === "during" && ph.day.id === day.id ? (nextOf(day) || {}).id : null;
    const far = mapPts(day).filter((p) => p.far);
    let s = '<div class="plan"><div class="mapwrap"><div class="map" id="map" role="img" aria-label="' + esc(day.title) + ' 동선 그림 지도"></div>' +
      '<div class="daybar"><button class="rb" type="button" data-act="day-step" data-d="-1" aria-label="이전 날"' + (di <= 0 ? " disabled" : "") + ">" + ICON.chevL + "</button>" +
      '<div class="mid"><span>' + (isNum(day.n) ? "DAY " + esc(day.n) : "귀국") + " · " + esc(day.date) + "</span><b>" + esc(day.title) + "</b></div>" +
      '<button class="rb" type="button" data-act="day-step" data-d="1" aria-label="다음 날"' + (di >= state.days.length - 1 ? " disabled" : "") + ">" + ICON.chevR + "</button></div>" +
      '<div class="mapbot"><div class="far">' + far.map((p) => '<button class="mapchip" type="button" data-act="detail" data-id="' + p.it.id + '"><b class="mono">' + p.n + "</b>" + esc(mapLabel(p.it)) + " · 지도 밖</button>").join("") + "</div>" +
      (w.c ? '<a class="mapchip mapwx" href="' + WX_URL + '"' + EXT + ">" + ICON[w.kind] + esc(w.c) + (w.t ? " " + esc(w.t) : "") + "</a>" : "") + "</div></div>";
    s += '<section class="plist" style="--c:' + c + '"><div class="handle" aria-hidden="true"></div>' +
      '<div class="plist-h"><h2>' + (isNum(day.n) ? "Day " + esc(day.n) : "귀국날") + ' 일정</h2><span class="cnt">' + (pr.n ? pr.done + "/" + pr.n + " 다녀옴" + (pr.sk ? " · " + pr.sk + " 건너뜀" : "") : "") + "</span>" +
      '<button class="icon-btn" type="button" data-act="edit-day" data-day="' + day.id + '" aria-label="이 날 제목·날씨 수정">' + ICON.pen + "</button></div>";
    if (hasPri(day)) s += '<p class="starkey"><span class="stars">★★★</span> 꼭 가기 · <span class="stars">★★</span> 가면 좋음 · <span class="stars">★</span> 여유 있으면</p>';
    if (vis.length > 1) s += '<p class="dragkey">' + (isSplit(day) ? "길게 눌러 끌면 순서를 바꾸거나 다른 시간대로 옮길 수 있어요" : "길게 눌러 끌면 순서를 바꿀 수 있어요") + "</p>";
    const row = (st) => { const i = vis.indexOf(st); return prowHtml(st, i + 1, nextId, vis[i - 1] && vis[i - 1].id === nextId, c); };
    s += isSplit(day)
      ? '<ul class="prows" data-split="1">' + PARTS.map((p) => { const its = vis.filter((x) => PARTS[partRank(x)] === p); return '<li class="pgh' + (its.length ? "" : " empty") + '" data-part="' + p + '"><span>' + p + "</span></li>" + its.map(row).join(""); }).join("") + "</ul>"
      : '<ul class="prows">' + vis.map(row).join("") + "</ul>";
    s += maybeDrawer(day);
    s += '<div class="addrow"><button class="btn dashed wide" type="button" data-act="add-stop" data-day="' + day.id + '">+ 장소 추가</button></div></section></div>';
    return s;
  }
  /* every row can be swiped left to show 삭제; long-press a place row to drag it (its shops move with it) */
  const swipeWrap = (id, inner) => '<div class="swipe" data-sw="' + id + '"><button class="sw-del" type="button" data-act="row-del" data-id="' + id + '" tabindex="-1" aria-label="삭제"><span class="sw-ic">' + ICON.trash + "</span></button>" + inner + "</div>";
  function prowHtml(st, n, nextId, afterNext, c) {
    const done = isDone(st.id), sk = isSkip(st.id), nx = st.id === nextId;
    const num = done ? ICON.check : sk ? ICON.skip : n; /* every place gets its number, Chinese name or not */
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
    if (it.how) rows.push('<div class="r">' + ICON.nav + '<span class="k">가는 길</span><span class="v pre">' + esc(it.how) + "</span></div>");
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
  const postPics = (id) => picsOf(id, state.postPhotos[id]);
  const dayPics = (dayId) => postsOf(dayId).reduce((a, p) => a.concat(postPics(p.id)), []);
  const meName = () => sync.me || "";
  const hhmm = (ts) => { const t = new Date(ts); return pad(t.getHours()) + ":" + pad(t.getMinutes()); };
  const likeNames = (id) => Object.keys(state.likes).filter((k) => state.likes[k] && k.indexOf(id + "|") === 0).map((k) => k.slice(id.length + 1));
  /* each person's round icon in 기록: a line icon on a soft colour, both picked in 여행 인원 (or by tapping your own).
     Icons: Tabler Icons (MIT, © Paweł Kuna) */
  const AVI = {
    dumpling: '<path d="M5.532 5.532a2.53 2.53 0 0 1 2.56 -.623a2.532 2.532 0 0 1 4.604 -.717q .146 -.24 .356 -.45a2.532 2.532 0 0 1 4.318 1.637a2.53 2.53 0 0 1 2.844 .511l.358 .358c1.384 1.385 -.7 5.713 -4.655 9.669c-3.956 3.955 -8.284 6.04 -9.669 4.655l-.358 -.358l-.114 -.122a2.53 2.53 0 0 1 -.398 -2.724a2.532 2.532 0 0 1 -1.186 -4.675a2.532 2.532 0 0 1 .718 -4.603a2.53 2.53 0 0 1 .622 -2.558"/>',
    bowl: '<path d="M4 11h16a1 1 0 0 1 1 1v.5c0 1.5 -2.517 5.573 -4 6.5v1a1 1 0 0 1 -1 1h-8a1 1 0 0 1 -1 -1v-1c-1.687 -1.054 -4 -5 -4 -6.5v-.5a1 1 0 0 1 1 -1"/><path d="M19 7l-14 1"/><path d="M19 2l-14 3"/>',
    boba: '<path d="M17.95 9l-1.478 8.69c-.25 1.463 -.374 2.195 -.936 2.631c-1.2 .931 -6.039 .88 -7.172 0c-.562 -.436 -.687 -1.168 -.936 -2.632l-1.478 -8.689"/><path d="M6 9l.514 -1.286a5.908 5.908 0 0 1 10.972 0l.514 1.286"/><path d="M5 9h14"/><path d="M12 9l4 -7"/><path d="M10.01 14h.01"/><path d="M11.02 18h.01"/><path d="M13.02 16h.01"/>',
    teapot: '<path d="M10.29 3h3.42a2 2 0 0 1 1.988 1.78l1.555 14a2 2 0 0 1 -1.988 2.22h-6.53a2 2 0 0 1 -1.988 -2.22l1.555 -14a2 2 0 0 1 1.988 -1.78"/><path d="M7.47 12.5l-4.257 -5.019a.899 .899 0 0 1 .69 -1.481h13.09a3 3 0 0 1 3.007 3v3c0 1.657 -1.346 3 -3.007 3"/><path d="M7 17h10"/>',
    plane: '<path d="M14.5 6.5l3 -2.9a2.05 2.05 0 0 1 2.9 2.9l-2.9 3l2.5 7.5l-2.5 2.55l-3.5 -6.55l-3 3v3l-2 2l-1.5 -4.5l-4.5 -1.5l2 -2h3l3 -3l-6.5 -3.5l2.5 -2.5l7.5 2.5"/>',
    camera: '<path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>',
    cat: '<path d="M20 3v10a8 8 0 1 1 -16 0v-10l3.432 3.432a7.963 7.963 0 0 1 4.568 -1.432c1.769 0 3.403 .574 4.728 1.546l3.272 -3.546"/><path d="M2 16h5l-4 4"/><path d="M22 16h-5l4 4"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M9 11v.01"/><path d="M15 11v.01"/>',
    dog: '<path d="M11 5h2"/><path d="M19 12c-.667 5.333 -2.333 8 -5 8h-4c-2.667 0 -4.333 -2.667 -5 -8"/><path d="M11 16c0 .667 .333 1 1 1s1 -.333 1 -1h-2"/><path d="M12 18v2"/><path d="M10 11v.01"/><path d="M14 11v.01"/><path d="M5 4l6 .97l-6.238 6.688a1.021 1.021 0 0 1 -1.41 .111a.953 .953 0 0 1 -.327 -.954l1.975 -6.815"/><path d="M19 4l-6 .97l6.238 6.688c.358 .408 .989 .458 1.41 .111a.953 .953 0 0 0 .327 -.954l-1.975 -6.815"/>',
    pig: '<path d="M15 11v.01"/><path d="M16 3l0 3.803a6.019 6.019 0 0 1 2.658 3.197h1.341a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-1.342a6.008 6.008 0 0 1 -1.658 2.473v2.027a1.5 1.5 0 0 1 -3 0v-.583a6.04 6.04 0 0 1 -1 .083h-4a6.04 6.04 0 0 1 -1 -.083v.583a1.5 1.5 0 0 1 -3 0v-2l0 -.027a6 6 0 0 1 4 -10.473h2.5l4.5 -3"/>',
    fish: '<path d="M16.69 7.44a6.973 6.973 0 0 0 -1.69 4.56c0 1.747 .64 3.345 1.699 4.571"/><path d="M2 9.504c7.715 8.647 14.75 10.265 20 2.498c-5.25 -7.761 -12.285 -6.142 -20 2.504"/><path d="M18 11v.01"/><path d="M11.5 10.5c-.667 1 -.667 2 0 3"/>',
    butterfly: '<path d="M12 18.176a3 3 0 1 1 -4.953 -2.449l-.025 .023a4.502 4.502 0 0 1 1.483 -8.75c1.414 0 2.675 .652 3.5 1.671a4.5 4.5 0 1 1 4.983 7.079a3 3 0 1 1 -4.983 2.25l-.005 .176"/><path d="M12 19v-10"/><path d="M9 3l3 2l3 -2"/>',
    deer: '<path d="M3 3c0 2 1 3 4 3c2 0 3 1 3 3"/><path d="M21 3c0 2 -1 3 -4 3c-2 0 -3 .333 -3 3"/><path d="M12 18c-1 0 -4 -3 -4 -6c0 -2 1.333 -3 4 -3s4 1 4 3c0 3 -3 6 -4 6"/><path d="M15.185 14.889l.095 -.18a4 4 0 1 1 -6.56 0"/><path d="M17 3c0 1.333 -.333 2.333 -1 3"/><path d="M7 3c0 1.333 .333 2.333 1 3"/><path d="M7 6c-2.667 .667 -4.333 1.667 -5 3"/><path d="M17 6c2.667 .667 4.333 1.667 5 3"/><path d="M8.5 10l-1.5 -1"/><path d="M15.5 10l1.5 -1"/><path d="M12 15h.01"/>',
    ghost: '<path d="M5 11a7 7 0 0 1 14 0v7a1.78 1.78 0 0 1 -3.1 1.4a1.65 1.65 0 0 0 -2.6 0a1.65 1.65 0 0 1 -2.6 0a1.65 1.65 0 0 0 -2.6 0a1.78 1.78 0 0 1 -3.1 -1.4v-7"/><path d="M10 10l.01 0"/><path d="M14 10l.01 0"/><path d="M10 14a3.5 3.5 0 0 0 4 0"/>',
    cherry: '<path d="M4 16.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0"/><path d="M14 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M9 13c.366 -2 1.866 -3.873 4.5 -5.6"/><path d="M17 15c-1.333 -2.333 -2.333 -5.333 -1 -9"/><path d="M5 6c3.667 -2.667 7.333 -2.667 11 0c-3.667 2.667 -7.333 2.667 -11 0"/>',
    flower: '<path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M12 2a3 3 0 0 1 3 3c0 .562 -.259 1.442 -.776 2.64l-.724 1.36l1.76 -1.893c.499 -.6 .922 -1 1.27 -1.205a2.968 2.968 0 0 1 4.07 1.099a3.011 3.011 0 0 1 -1.09 4.098c-.374 .217 -.99 .396 -1.846 .535l-2.664 .366l2.4 .326c1 .145 1.698 .337 2.11 .576a3.011 3.011 0 0 1 1.09 4.098a2.968 2.968 0 0 1 -4.07 1.098c-.348 -.202 -.771 -.604 -1.27 -1.205l-1.76 -1.893l.724 1.36c.516 1.199 .776 2.079 .776 2.64a3 3 0 0 1 -6 0c0 -.562 .259 -1.442 .776 -2.64l.724 -1.36l-1.76 1.893c-.499 .601 -.922 1 -1.27 1.205a2.968 2.968 0 0 1 -4.07 -1.098a3.011 3.011 0 0 1 1.09 -4.098c.374 -.218 .99 -.396 1.846 -.536l2.664 -.366l-2.4 -.325c-1 -.145 -1.698 -.337 -2.11 -.576a3.011 3.011 0 0 1 -1.09 -4.099a2.968 2.968 0 0 1 4.07 -1.099c.348 .203 .771 .604 1.27 1.205l1.76 1.894c-1 -2.292 -1.5 -3.625 -1.5 -4a3 3 0 0 1 3 -3"/>',
    icecream: '<path d="M12 21.5v-4.5"/><path d="M8 17h8v-10a4 4 0 1 0 -8 0v10"/><path d="M8 10.5l8 -3.5"/><path d="M8 14.5l8 -3.5"/>'
  };
  const AVI_ORDER = Object.keys(AVI);
  const AVC = { sky: ["#E6F1FB", "#185FA5"], pink: ["#FBEAF0", "#993556"], mint: ["#E1F5EE", "#0F6E56"], lilac: ["#EEEDFE", "#534AB7"],
    peach: ["#FAECE7", "#993C1D"], lemon: ["#FAEEDA", "#854F0B"], leaf: ["#EAF3DE", "#3B6D11"], stone: ["#F1EFE8", "#5F5E5A"] };
  const AV_DEF_C = ["sky", "pink", "mint", "lilac"]; /* until someone picks, everyone is a 만두 in their own colour */
  function avOf(name) {
    let v = state.avatars[name];
    if (typeof v === "string") v = { i: v };
    v = v && typeof v === "object" ? v : {};
    const c = AV_DEF_C[(state.settle.members || []).indexOf(name)] || "sky";
    return { i: AVI[v.i] ? v.i : "dumpling", c: AVC[v.c] ? v.c : c };
  }
  const avSvg = (k) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + AVI[k] + "</svg>";
  const avStyle = (c) => "--avb:" + AVC[c][0] + ";--avi:" + AVC[c][1];
  function avHtml(name) {
    const a = avOf(name);
    return '<span class="av pic" style="' + avStyle(a.c) + '">' + (a.i ? avSvg(a.i) : '<b>' + esc(String(name).slice(0, 1)) + "</b>") + "</span>";
  }
  let avBack = "";
  function avSheet(name, back) {
    if (back !== undefined) avBack = back || "";
    const a = avOf(name);
    openSheet({
      key: "av", center: true, title: name + " 아이콘",
      body: '<div class="avprev">' + avHtml(name) + "<b>" + esc(name) + "</b></div>" +
        '<div class="avgrid">' + AVI_ORDER.map((k) => '<button type="button" class="avopt' + (k === a.i ? " on" : "") + '" data-act="av-set" data-f="i" data-p="' + esc(name) + '" data-k="' + k + '" aria-pressed="' + (k === a.i) + '" style="' + avStyle(a.c) + '"><span class="av pic">' + avSvg(k) + "</span></button>").join("") + "</div>" +
        '<div class="avcols">' + Object.keys(AVC).map((c) => '<button type="button" class="avcol' + (c === a.c ? " on" : "") + '" data-act="av-set" data-f="c" data-p="' + esc(name) + '" data-k="' + c + '" aria-pressed="' + (c === a.c) + '" aria-label="색 ' + c + '" style="' + avStyle(c) + '"><i></i></button>').join("") + "</div>",
      foot: '<span class="grow"></span><button class="btn primary" type="button" data-act="av-done">완료</button>'
    });
  }
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
    } else if (p.ph) ph = '<div class="pmiss">' + ICON.camera + "<span>사진 " + p.ph + "장 · " + esc(who || "친구") + " 폰에서 올라오는 중이에요</span></div>";
    return '<article class="post" id="post-' + p.id + '">' +
      '<header class="post-h">' + (nm === (meName() || "나") ? '<button class="avbtn" type="button" data-act="av-pick" data-p="' + esc(nm) + '" aria-label="내 아이콘 바꾸기">' + avHtml(nm) + "</button>" : avHtml(nm)) + '<div class="who"><b>' + esc(nm) + "</b><span>" +
      esc([p.at ? hhmm(p.at) : "", place ? place.item.label || shortName(place.item.ko) : ""].filter(Boolean).join(" · ")) + "</span></div>" +
      '<button class="icon-btn" type="button" data-act="post-edit" data-id="' + p.id + '" aria-label="기록 고치기">' + ICON.more + "</button></header>" +
      ph + (p.text ? '<p class="ptext">' + esc(p.text) + "</p>" : "") +
      '<footer class="pf"><button class="heart' + (mine ? " on" : "") + '" type="button" data-act="post-like" data-id="' + p.id + '" aria-pressed="' + mine + '" aria-label="좋아요">' + ICON.heart + "</button>" +
      (likes.length ? '<span class="likes">' + esc(likes.join(", ")) + "</span>" : "") + "</footer></article>";
  }
  /* 기록 has one extra "day" before Day 1 for anything written while getting ready */
  const PRE = "before";
  function preDay() { return { id: PRE, n: "", date: "출발 전까지", title: "여행 전", stops: [], pre: true }; }
  function logDay(id) { return id === PRE ? preDay() : findDay(id); }
  function logC(d) { return d.pre ? "var(--accent)" : dayC(d); }
  function logHtml() {
    const sel = ui.logDay && logDay(ui.logDay) ? ui.logDay : "all";
    let s = pageHead("기록", "날마다 사진 · 한 줄 기록", true);
    s += '<div class="lchips" role="tablist" aria-label="날짜 고르기"><button type="button" class="lchip' + (sel === "all" ? " on" : "") + '" data-act="log-day" data-v="all" aria-pressed="' + (sel === "all") + '">전체</button>' +
      '<button type="button" class="lchip txt' + (sel === PRE ? " on" : "") + '" data-act="log-day" data-v="' + PRE + '" aria-pressed="' + (sel === PRE) + '">여행 전</button>' +
      state.days.map((d) => '<button type="button" class="lchip' + (sel === d.id ? " on" : "") + '" data-act="log-day" data-v="' + d.id + '" aria-pressed="' + (sel === d.id) + '" style="--c:' + dayC(d) + '"><i>' + esc(d.n) + "</i>" + esc(String(d.date).split(" ")[0]) + "</button>").join("") + "</div>";
    /* newest on top: the latest day first and, within a day, the latest post first.
       In 전체, days still ahead with nothing in them stay out of the way (their chip is there to write one) */
    let days = sel === "all"
      ? (postsOf(PRE).length ? [preDay()] : []).concat(state.days.filter((d) => postsOf(d.id).length || !(d.iso && d.iso > todayIso()))).reverse()
      : [logDay(sel)];
    /* nothing written yet: a little stack of empty polaroids and one line to start, instead of a lone 여행 전 row */
    const none = sel === "all" ? !state.posts.length : !postsOf(sel).length;
    if (none) {
      const d0 = sel === "all" ? null : logDay(sel), ph = phase();
      const line = d0 && !d0.pre ? esc(d0.title) + "<br>이날 본 것 하나만 남겨볼까요?" : ph.k === "during" ? "사진 한 장, 한 줄이면 충분해요<br>오늘 본 것 하나만 남겨볼까요?" : ph.k === "after" ? "사진 한 장, 한 줄이면 충분해요<br>기억이 흐려지기 전에 남겨볼까요?" : "사진 한 장, 한 줄이면 충분해요<br>여행 전 설렘부터 남겨볼까요?";
      s += '<div class="lempty"><div class="lempty-art" aria-hidden="true"><span class="pola p1"><i>' + ICON.camera + '</i></span><span class="pola p2"><i>' + ICON.heart + '</i></span><span class="pola p3"><i>' + ICON.pin + "</i></span></div>" +
        "<b>" + (d0 && !d0.pre ? (isNum(d0.n) ? "Day " + esc(d0.n) : "귀국날") + "엔 아직 기록이 없어요" : "아직 남긴 기록이 없어요") + "</b><p>" + line + "</p>" +
        '<button class="btn primary" type="button" data-act="post-new" data-day="' + (sel !== "all" ? sel : "") + '">' + ICON.pen + "첫 기록 남기기</button></div>";
      return s + '<div class="fpad"></div>';
    }
    if (!days.length) days = [preDay()];
    days.forEach((d) => {
      const list = postsOf(d.id).slice().reverse();
      s += '<section class="fday" id="log-' + d.id + '" style="--c:' + logC(d) + '"><div class="fday-h"><span class="rd">' + (d.pre ? ICON.plane : esc(d.n)) + '</span><div><span class="m">' + esc(d.date) + "</span><b>" + esc(d.title) + "</b></div>" +
        (list.length ? '<span class="cnt">' + list.length + "개</span>" : "") + "</div>" +
        (list.length ? list.map(postHtml).join("") : '<button class="fempty" type="button" data-act="post-new" data-day="' + d.id + '">' + ICON.plus + "<span>" + (d.pre ? "출발 전 기록 남기기" : "이날 첫 기록 남기기") + "</span></button>") + "</section>";
    });
    return s + '<div class="fpad"></div><button class="fab" type="button" data-act="post-new" data-day="' + (sel !== "all" ? sel : "") + '" aria-label="기록 쓰기">' + ICON.plus + "</button>";
  }
  /* writing / editing a post: photos, a few lines, which day, and (if you like) which place */
  let cmp = null;
  function defaultLogDay() {
    const ph = phase();
    return ph.k === "during" ? ph.day.id : ui.logDay && logDay(ui.logDay) ? ui.logDay : ph.k === "before" ? PRE : (state.days[0] || {}).id;
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
    const d = logDay(cmp.day) || state.days[0], stops = d ? d.stops : [];
    const rm = (k, i) => '<button type="button" data-act="cmp-rm" data-k="' + k + '" data-i="' + i + '" aria-label="사진 빼기">' + ICON.x + "</button>";
    const thumbs = cmp.keep.map((pid, i) => '<div class="cth"><img data-pid="' + esc(pid) + '" alt="">' + rm("keep", i) + "</div>").join("") +
      cmp.add.map((a, i) => '<div class="cth"><img src="' + a.url + '" alt="">' + rm("add", i) + "</div>").join("");
    openSheet({
      key: "post-edit", title: cmp.id ? "기록 고치기" : "새 기록",
      body: '<div class="cpics">' + thumbs + '<label class="cadd">' + ICON.camera + '<span>사진 넣기</span><input class="vh" type="file" accept="image/*" multiple data-post-pick></label></div>' +
        '<label class="field"><span class="vh">내용</span><textarea id="cmpText" placeholder="어땠어? 한 줄이라도 좋아요" style="min-height:110px">' + esc(cmp.text) + "</textarea></label>" +
        '<div class="field"><span>날짜</span><div class="chips">' + '<button class="btn sm chipbtn" type="button" data-act="cmp-day" data-v="' + PRE + '" aria-pressed="' + (cmp.day === PRE) + '">여행 전</button>' + state.days.map((x) => '<button class="btn sm chipbtn" type="button" data-act="cmp-day" data-v="' + x.id + '" aria-pressed="' + (x.id === cmp.day) + '">' +
          esc((isNum(x.n) ? "Day " + x.n : "귀국") + " · " + String(x.date).split(" ")[0]) + "</button>").join("") + "</div></div>" +
        (stops.length ? '<label class="field"><span>장소 · 안 골라도 돼요</span><select id="cmpPlace"><option value="">선택 안 함</option>' +
          stops.map((st) => '<option value="' + st.id + '"' + (cmp.place === st.id ? " selected" : "") + ">" + esc(shortName(st.ko)) + "</option>").join("") + "</select></label>" : ""),
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
    delete state.postPhotos[id]; delete state.shared[id];
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
    const oldLocal = state.postPhotos[p.id] || [], added = ids.filter((x) => cmp.keep.indexOf(x) < 0);
    postPics(p.id).filter((x) => ids.indexOf(x) < 0).forEach(dropPhoto);
    const local = ids.filter((x) => oldLocal.indexOf(x) >= 0 || added.indexOf(x) >= 0);
    if (local.length) state.postPhotos[p.id] = local; else delete state.postPhotos[p.id];
    setShared(p.id, (state.shared[p.id] || []).filter((x) => ids.indexOf(x) >= 0));
    p.text = text; p.day = cmp.day;
    if (cmp.place) p.place = cmp.place; else delete p.place;
    if (!p.by || p.by === meName()) { if (ids.length) p.ph = ids.length; else delete p.ph; }
    if (isNew) state.posts.push(p);
    upSoon();
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
    unlinkPic(p.id, pid, state.postPhotos);
    const left = postPics(p.id).length;
    if (!p.by || p.by === meName()) { if (left) p.ph = left; else delete p.ph; }
    if (!p.text && !left && !p.ph) deletePost(p.id);
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
  /* the little bar under a tapped expense */
  function expBarClose() {
    document.querySelectorAll(".exp-acts").forEach((b) => b.remove());
    document.querySelectorAll(".exp.sel").forEach((r) => r.classList.remove("sel"));
  }
  document.addEventListener("click", (e) => { if (!e.target.closest(".exp-acts, .exp-open")) expBarClose(); }, true);
  function dayLabel(ts) { const t = new Date(ts); return (t.getMonth() + 1) + "." + t.getDate() + " " + "일월화수목금토"[t.getDay()]; }
  /* ---------- 가계부: every expense by day, with 정산 for the shared ones ----------
     같이 쓴 돈 → state.settle.expenses (synced, split N ways) · 나만 쓴 돈 → state.myExp (this phone only, not split) */
  const CATS = [["food", "식비", "bowl", "pink"], ["move", "교통", "taxi", "sky"], ["shop", "쇼핑", "bag", "lilac"], ["fun", "관광", "ticket", "mint"], ["etc", "기타", "receipt", "stone"]];
  const catOf = (k) => CATS.find((c) => c[0] === k) || CATS[4];
  const catIc = (k) => { const c = catOf(k); return '<span class="av pic exp-ic" style="' + avStyle(c[3]) + '">' + ICON[c[2]] + "</span>"; };
  function allExp() {
    return state.settle.expenses.map((e) => Object.assign({ mine: false }, e)).concat(state.myExp.map((e) => Object.assign({ mine: true }, e)));
  }
  function inBase(e, c) { const v = +e.amt || 0; return c.base === "KRW" ? (e.cur === "KRW" ? v : v * c.rate) : e.cur === "KRW" ? 0 : v; }
  const amtFmt = (v, c) => (c.base === "KRW" ? wonFmt(v) : yuanFmt(v));
  /* 내 지출: my 나만 money in full + my even share of what we spent together (what's left once we've settled up) */
  function ledgerSum() {
    const c = settleCalc(), all = allExp(), tIso = todayIso(), cats = {}, part = (e) => (e.mine ? 1 : 1 / (c.n || 1));
    let total = 0, today = 0;
    all.forEach((e) => {
      const v = inBase(e, c) * part(e), d = new Date(e.at || 0), iso = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      total += v; if (iso === tIso) today += v;
      const k = catOf(e.cat)[0]; cats[k] = (cats[k] || 0) + v;
    });
    return { c, all, total, today, cats, part };
  }
  /* which day an expense belongs to: today, or any trip day (for writing things down later) */
  /* 지출 날짜: any date (오늘 by default); anything before the first trip day is grouped as 여행 전 */
  const tripStart = () => (state.days.find((d) => d.iso) || {}).iso || "";
  const isoOf = (ts) => { const t = new Date(ts); return t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()); };
  const isPreExp = (e) => { const st = tripStart(); return !!st && isoOf(e.at || 0) < st; };
  function expAt(day) {
    const m = String(day || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return Date.now();
    const n = new Date(); n.setFullYear(+m[1], +m[2] - 1, +m[3]); return n.getTime();
  }
  function expNewSheet() {
    const ppl = state.settle.members, cat = ui.cat || "food";
    const radio = (name, val, label, on, cls) => '<label class="rchip' + (cls ? " " + cls : "") + '"><input type="radio" name="' + name + '" value="' + esc(val) + '"' + (on ? " checked" : "") + "><span>" + label + "</span></label>";
    openSheet({
      key: "exp-new", title: "지출 추가",
      body: '<div class="expform">' +
        (ppl.length ? '<div class="seg" role="radiogroup" aria-label="지출 종류">' +
          '<label><input type="radio" name="kind" value="shared"' + (ui.expMine ? "" : " checked") + "><span>" + ICON.users + "공동 지출</span></label>" +
          '<label><input type="radio" name="kind" value="mine"' + (ui.expMine ? " checked" : "") + "><span>" + ICON.lock + "개인 지출</span></label></div>" +
          '<p class="note seg-note seg-shared">' + ppl.length + "명이 나눠서 정산해요</p>" + '<p class="note seg-note seg-mine">정산 안 하고 내 폰에만 남겨요</p>' : "") +
        '<div class="amtrow"><label class="field" style="flex:1"><span class="vh">금액</span><input name="amt" inputmode="decimal" placeholder="금액" autocomplete="off"></label>' +
          '<div class="chips">' + radio("cur", "CNY", "¥", ui.cur !== "KRW") + radio("cur", "KRW", "₩", ui.cur === "KRW") + "</div></div>" +
        field("what", "어디에 썼는지", "", { ph: "예: 점심 딤섬" }) +
        '<div class="field"><span>종류</span><div class="chips">' + CATS.map((k) => radio("cat", k[0], ICON[k[2]] + k[1], k[0] === cat, "catchip")).join("") + "</div></div>" +
        (ppl.length ? '<div class="field payrow"><span>낸 사람</span><div class="chips">' + ppl.map((p) => radio("payer", p, esc(p), p === ui.payer)).join("") + "</div></div>" : "") +
        '<label class="field"><span>날짜</span><input type="date" name="d" value="' + todayIso() + '"></label>' +
        "</div>",
      foot: '<span class="grow"></span><button class="btn" type="button" data-act="sh-close">취소</button><button class="btn primary" type="button" data-act="sh" data-k="save">추가</button>',
      on(k, v) {
        if (k !== "save") return;
        const amt = parseFloat(String(v.amt || "").replace(/[,\s]/g, ""));
        if (!(amt > 0)) { toast("금액을 넣어주세요"); const a = sheet.querySelector('input[name="amt"]'); if (a) a.focus(); return; }
        const mine = v.kind === "mine" || !ppl.length;
        const e = { id: newId("x"), amt, cur: v.cur === "KRW" ? "KRW" : "CNY", what: v.what || "", cat: v.cat || "etc", at: v.d && v.d !== todayIso() ? expAt(v.d) : Date.now() };
        if (mine) state.myExp.push(e);
        else { e.payer = v.payer || ppl[0]; state.settle.expenses.push(e); ui.payer = e.payer; }
        ui.cur = e.cur; ui.cat = e.cat; ui.expMine = v.kind === "mine"; saveUI();
        save(); closeSheet(); render(); toast(mine ? "개인 지출로 넣었어요" : "공동 지출로 넣었어요");
      }
    });
    const a = sheet.querySelector('input[name="amt"]'); if (a) a.focus();
  }
  function settleCard(L) {
    const S = state.settle, ppl = S.members, c = L.c;
    if (!ppl.length) return '<div class="pad"><div class="box"><p class="note">더보기 → 설정 → 여행 인원을 넣으면 공동 지출을 나눠 드려요</p></div></div>';
    const shared = S.expenses.slice().sort((a, b) => (b.at || 0) - (a.at || 0)), open = shared.filter((e) => !e.settled), doneN = shared.length - open.length;
    if (!shared.length) return '<div class="pad"><div class="box"><p class="note">공동 지출이 아직 없어요 · ＋에서 \'공동 지출\'로 넣으면 여기서 나눠요</p></div></div>';
    let s = '<div class="pad"><div class="box st">';
    if (!open.length) s += '<div class="st-res">' + ICON.check + "<b>정산 다 했어요</b></div>";
    else if (!c.xs.length) s += '<div class="st-res"><b>딱 맞아요</b><span class="note">주고받을 돈이 없어요</span></div>';
    else s += c.xs.map((x) => '<div class="st-x"><b>' + esc(x.from) + '</b><span class="note">→</span><b>' + esc(x.to) + '</b><span class="amt">' + money(x.v, c) + "</span></div>").join("");
    if (open.length) s += '<div class="st-who">' + ppl.map((p) => '<div class="sc-p"><span>' + esc(p) + ' 냄</span><span class="mono">' + amtFmt(c.paid[p] || 0, c) + "</span></div>").join("") +
      '<p class="note">정산할 돈 ' + amtFmt(c.total, c) + " · 1인당 " + amtFmt(c.share, c) + "</p></div>";
    if (c.skipped) s += '<p class="note">원화로 넣은 지출 ' + c.skipped + "건은 환율을 넣어야 합산돼요</p>";
    s += '<p class="note st-tip">' + ICON.check + (doneN ? "정산 완료 " + doneN + "건 빠짐 · 지출 누르면 정산 완료" : "지출 내역에서 지출을 누르면 정산 완료") + "</p>";
    return s + "</div></div>";
  }
  /* 내 지출: total + today; opens to show where it went (공동 지출 내 몫 / 개인 지출, then by kind) */
  function mySumCard(L) {
    const c = L.c;
    let shared = 0, own = 0;
    L.all.forEach((e) => { const v = inBase(e, c) * L.part(e); if (e.mine) own += v; else shared += v; });
    const cats = CATS.filter((k) => L.cats[k[0]]), max = Math.max(1, ...cats.map((k) => L.cats[k[0]]));
    return '<div class="pad"><details class="box ms" data-fold="my-sum"' + (ui.open["my-sum"] ? " open" : "") + '><summary class="ms-sum"><div class="stiles"><div class="stile"><span>내 여행 총 지출</span><b>' + amtFmt(L.total, c) + "</b></div>" +
      '<div class="stile"><span>오늘</span><b>' + amtFmt(L.today, c) + '</b></div></div><span class="chev" aria-hidden="true"></span></summary><div class="ms-more">' +
      (L.all.length ? '<div class="sc-p"><span>' + ICON.users + "공동 지출 · 내 몫</span><b>" + amtFmt(shared, c) + "</b></div>" +
        '<div class="sc-p"><span>' + ICON.lock + "개인 지출</span><b>" + amtFmt(own, c) + "</b></div>" +
        '<div class="ms-cats">' + cats.map((k) => '<div class="ms-cat" style="' + avStyle(k[3]) + '">' + catIc(k[0]) + "<span>" + k[1] + '</span><i><i style="width:' + ((L.cats[k[0]] / max) * 100).toFixed(1) + '%"></i></i><b>' + amtFmt(L.cats[k[0]], c) + "</b></div>").join("") + "</div>"
        : '<p class="note">아직 적은 지출이 없어요</p>') + "</div></details></div>";
  }
  function moneyHtml() {
    const S = state.settle, ppl = S.members, L = ledgerSum(), c = L.c;
    if (ppl.indexOf(ui.payer) < 0) ui.payer = ppl[0] || "";
    let s = pageHead("가계부", c.rate ? "1위안 = " + c.rate + "원" : "여행 지출 · 정산", true);
    s += mySumCard(L);
    s += '<div class="sec-h"><h2>지출 내역</h2></div>';
    if (L.all.length) {
      const list = L.all.slice().sort((a, b) => (b.at || 0) - (a.at || 0)), days = {};
      const grp = (e) => (isPreExp(e) ? "여행 전" : dayLabel(e.at || 0));
      list.forEach((e) => { const dl = grp(e); days[dl] = (days[dl] || 0) + inBase(e, c) * L.part(e); });
      let last = "";
      list.forEach((e) => {
        const dl = grp(e);
        if (dl !== last) { s += (last ? "</div></div>" : "") + '<div class="exp-dh"><span>' + dl + "</span><span>" + amtFmt(days[dl], c) + '</span></div><div class="pad"><div class="box exp-box">'; last = dl; }
        s += '<div class="exp' + (e.settled ? " settled" : "") + '" data-id="' + e.id + '">' + catIc(e.cat) + '<button class="exp-open" type="button" data-act="exp-tap" data-id="' + e.id + '" aria-label="' + esc(e.what || "지출") + ' 정산 · 고치기"><span class="w2"><b>' + esc(e.what || catOf(e.cat)[1]) +
          (e.mine ? '<i class="mine-ic" title="나만 쓴 돈">' + ICON.lock + "</i>" : "") + "</b><span>" + (isPreExp(e) ? dayLabel(e.at || 0).split(" ")[0] + " · " : "") + (e.mine ? "개인 지출" : esc(e.payer) + " 냄") + "</span></span>" +
          '<span class="a">' + (e.cur === "KRW" ? wonFmt(+e.amt) : yuanFmt(+e.amt)) + (e.settled ? '<small class="exp-ok">' + ICON.check + "정산 완료</small>" : e.cur !== "KRW" && c.rate ? "<small>" + wonFmt(e.amt * c.rate) + "</small>" : "") + "</span></button>" +
          '<button class="btn sm ghost" type="button" data-act="exp-del" data-id="' + e.id + '" aria-label="이 지출 지우기">' + ICON.x + "</button></div>";
      });
      s += "</div></div>";
    } else s += '<div class="pad"><p class="note" style="text-align:center;padding:18px 0">＋를 눌러 첫 지출을 적어보세요</p></div>';
    s += '<div class="sec-h"><h2>정산</h2></div>' + settleCard(L);
    s += '<div class="sec-h"><h2>환율</h2></div><div class="pad"><div class="box">' + fxHtml("fx") +
      '<details class="fold flat" data-fold="settle-set"' + (ui.open["settle-set"] || !S.rate ? " open" : "") + '><summary><span class="ft">환율 바꾸기</span><span class="chev" aria-hidden="true"></span></summary><div class="fold-b form">' +
      '<label class="field"><span>1위안 = ?원</span><input id="mRate" data-keep inputmode="decimal" value="' + esc(S.rate || "") + '" autocomplete="off"></label>' +
      '<button class="btn" type="button" data-act="settle-save">저장</button></div></details></div></div>';
    return s + '<div class="fpad"></div><button class="fab" type="button" data-act="exp-new" aria-label="지출 추가">' + ICON.plus + "</button>";
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
    s += '<div class="group-h">참고 링크</div><div class="group links">' +
      state.prep.links.map((l) => '<div class="li"><a class="linkrow grow" href="' + esc(safeUrl(l.url)) + '"' + EXT + "><b>" + esc(l.title || hostOf(l.url)) + "</b><span>" + esc(hostOf(l.url)) + "</span></a>" +
        '<button class="icon-btn" type="button" data-act="link-edit" data-id="' + l.id + '" aria-label="' + esc(l.title) + ' 수정">' + ICON.pen + "</button></div>").join("") +
      row("link-add", "plus", "링크 추가", "") + "</div>";
    const cur = ui.theme || "time";
    s += '<div class="group-h">설정</div><div class="group">' +
      '<div class="setrow"><div class="top"><span class="ri">' + ICON.moon + '</span><span class="rt"><b>화면 테마</b><span>' + (isDark() ? "지금은 밤 테마 · 화면 전체가 남색" : "지금은 낮 테마 · 위는 파란 하늘, 아래는 밝게") + "</span></span></div>" +
      '<div class="seg4" role="group" aria-label="화면 테마">' + THEMES.map((t) => '<button type="button" data-act="theme-set" data-v="' + t[0] + '" aria-pressed="' + (cur === t[0]) + '">' + ICON[t[1]] + "<span>" + t[2] + "</span></button>").join("") + "</div></div>" +
      '<div class="setrow"><div class="top"><span class="ri">' + ICON.pen + '</span><span class="rt"><b>여행 제목</b><span>홈 맨 위에 크게 나와요</span></span></div>' +
        '<input class="tinput" data-change="trip-title" value="' + esc(tripTitle()) + '" placeholder="예: 상하이 3박 4일" autocomplete="off" enterkeyhint="done" aria-label="여행 제목"></div>' +
      '<button class="row" type="button" data-act="members"><span class="ri">' + ICON.users + '</span><span class="rt"><b>여행 인원</b><span>기록 · 정산 · 연동에 쓰여요</span></span><span class="rv">' + esc((state.settle.members || []).join(" · ")) + "</span></button>" +
      row("share", "users", "친구랑 같이 쓰기", shareSub()) +
      row("backup", "download", "데이터 백업 파일 받기", "일정 · 정산 · 기록 글 (사진 빼고)") +
      '<button class="row" type="button" data-act="reset"><span class="ri">' + ICON.undo + '</span><span class="rt"><b>초기 세팅으로 되돌리기</b><span>홈 위젯 · 준비물 · 필수 앱 · 할 일</span></span><span class="rv">' + ICON.chevR + "</span></button>" +
      '<button class="row" type="button" data-act="app-update"><span class="ri">' + ICON.sync + '</span><span class="rt"><b>앱 버전</b><span id="appVer">확인 중…</span></span><span class="rv">새로 받기</span></button>' +
      "</div>";
    setTimeout(showAppVer, 0);
    return s;
  }
  /* which version this phone is running: the name of the offline copy the service worker keeps */
  function showAppVer() {
    const el = document.getElementById("appVer");
    if (!el || !window.caches) { if (el) el.textContent = "알 수 없음"; return; }
    caches.keys().then((ks) => { const v = ks.filter((k) => /^sht-\d{4}-/.test(k)).sort().pop(); el.textContent = v ? v.replace("sht-", "") : "알 수 없음"; }).catch(() => { el.textContent = "알 수 없음"; });
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
    state.days.forEach(partSort);
    const y = window.scrollY, keep = {};
    view.querySelectorAll("[data-keep]").forEach((el) => { if (el.id) keep[el.id] = el.value; });
    const ae = document.activeElement, focusId = ae && view.contains(ae) ? ae.id : "";
    const wl = Array.from(view.querySelectorAll(".wlist")).map((el) => el.scrollTop);
    if (!TABS[ui.tab]) ui.tab = "home";
    if (ui.tab !== "home") editing = false;
    view.innerHTML = TABS[ui.tab]();
    syncClouds(view);
    document.body.setAttribute("data-tab", ui.tab);
    document.documentElement.setAttribute("data-tab", ui.tab);
    requestAnimationFrame(edgeByScroll);
    Object.keys(keep).forEach((id) => { const el = document.getElementById(id); if (el && el.tagName !== "SELECT" && id !== "mNames" && id !== "mRate") el.value = keep[id]; });
    view.querySelectorAll(".wlist").forEach((el, i) => { if (wl[i]) el.scrollTop = wl[i]; });
    document.querySelectorAll(".tabbar button").forEach((b) => {
      if (b.getAttribute("data-tab") === ui.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    if (ui.tab === "plan") { fitPlan(); drawMap(); }
    if (ui.tab === "home") heroMount();
    loadWx();
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
  let viewStale = false; /* something changed under an open sheet; draw the screen once it closes */
  function closeSheet() {
    sheet.hidden = true; sheet.innerHTML = ""; sheetCtx = null;
    document.body.classList.remove("noscroll", "sheet-open");
    if (viewStale) { viewStale = false; render(); }
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
  let ckMineOn = false;
  function ckSheet(key) {
    const list = ckList(key), doneN = list.filter((x) => state.done[x.id]).length, title = ckTitle(key);
    openSheet({
      key: "ck-" + key,
      center: true,
      title,
      body: '<div class="addline"><input id="add-' + key + '" data-addkey="' + key + '" placeholder="' + (key === "apps" ? "앱 이름 추가" : "추가할 것") + '" autocomplete="off" enterkeyhint="done" aria-label="' + esc(title) + ' 추가">' +
        (canMine(key) ? '<button class="btn minebtn" type="button" data-act="ck-mine" data-list="' + key + '" aria-pressed="' + ckMineOn + '" title="켜면 내 폰에만 저장돼요">' + ICON.lock + "나만</button>" : "") +
        '<button class="btn primary" type="button" data-act="li-add" data-list="' + key + '">추가</button></div>' +
        (canMine(key) ? '<p class="note ck-note">' + ICON.lock + " 나만 보는 " + (key === "pack" ? "준비물" : "할 일") + " · 나머지는 같이 봐요 · 체크는 각자</p>" : "") +
        '<div class="ckhead"><div class="wprog" data-prog="' + key + '"><i style="width:' + (list.length ? (doneN / list.length) * 100 : 0) + '%"></i></div><span class="mono" data-count="' + key + '">' + doneN + " / " + list.length + "</span></div>" +
        (list.length ? '<div class="cklist ckedit" data-key="' + key + '">' + list.map((x) => {
          const b = (act, cls, ic, label) => '<button class="' + cls + '" type="button" data-act="' + act + '" data-list="' + key + '" data-id="' + x.id + '" aria-label="' + label + '">' + ic + "</button>";
          return '<div class="li sli" data-id="' + x.id + '"><div class="sli-sc"><div class="sli-in">' +
            '<label class="ck ckbox' + (state.done[x.id] ? " on" : "") + '" aria-label="' + esc(x.t) + ' 체크"><input type="checkbox" id="ckx-' + x.id + '" data-ck="' + x.id + '"' + (state.done[x.id] ? " checked" : "") + "></label>" +
            ckWords(key, x) +
            '<span class="ck-grip" data-grip="' + key + '" aria-label="끌어서 순서 바꾸기">' + ICON.grip + '</span></div><div class="sli-acts">' +
            (canMine(key) ? b("li-mine", "sa-mine", x.list ? ICON.users : ICON.lock, x.list ? "같이 보기로" : "나만 보기") : "") +
            b("li-edit", "sa-edit", ICON.pen, "고치기") + b("li-del", "sa-del", ICON.trash, "지우기") + "</div></div></div>";
        }).join("") + "</div>" +
          '<p class="note ck-tip"><span>왼쪽으로 밀면 ' + (canMine(key) ? "나만 보기 · " : "") + "고치기 · 지우기</span><span>" + ICON.grip + " 끌면 순서 바꾸기</span></p>" : '<p class="empty">아직 비어 있어요</p>')
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
  /* ---------- 자동 찾기: share text from 고덕지도 / 디엔핑 → Chinese name + address; OpenStreetMap → map pin ---------- */
  const SH_BOX = "120.85,31.9,122.2,30.65", SH_MID = [31.2304, 121.4737];
  function kmBetween(a, b) {
    const r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(x));
  }
  const hanN = (t) => (String(t).match(/[一-鿿]/g) || []).length;
  const addrLike = (t) => (/[省市区县镇]/.test(t) && /(路|街|道|号|弄|巷|村|广场|大厦|中心)/.test(t)) || /(路|街)\d+(-\d+)?号/.test(t);
  function parseShare(text) {
    let t = String(text || "").replace(/https?:\/\/\S+/g, "\n").replace(/【[^】]*】|\[[^\]]*\]/g, "\n");
    t = t.replace(/(我分享了一个位置给你|我在高德地图上发现了一个好地方|给你推荐一家店|推荐一家店|推荐给你|分享自\S*|点击(链接)?查看\S*|复制[^\n]*打开[^\n]*|打开(高德地图|大众点评|美团|App)[^\n]*|快来看看吧?|来自(高德地图|大众点评)\S*)/g, "\n");
    let parts = t.split(/[\n\r]+|[，,；;。]|\s{2,}|\s+[·|]\s+/).map((x) => x.trim()).filter(Boolean);
    /* "武康大楼 上海市徐汇区…" on one line: split where the address starts */
    parts = parts.reduce((out, x) => {
      const w = x.split(/\s+/), k = w.findIndex((y, i) => i > 0 && addrLike(w.slice(i).join("")));
      if (k > 0) out.push(w.slice(0, k).join(" "), w.slice(k).join(" ")); else out.push(x);
      return out;
    }, []);
    let zh = "", addr = "";
    parts.forEach((x) => { const m = x.match(/^(地址|位置|address)\s*[:：]?\s*(.+)$/i); if (m && !addr) addr = m[2].trim(); });
    const junk = (x) => /^(地址|位置|电话|营业|人均|评分|¥|￥)/i.test(x) || (/(人均|¥|￥|条评价|星级)/.test(x) && hanN(x) < 6);
    parts.forEach((x) => {
      if (junk(x)) return;
      if (addrLike(x)) { if (!addr) addr = x; return; }
      if (!zh && hanN(x) >= 2) zh = x.replace(/^["“'「『:：\s]+|["”'」』:：\s]+$/g, "");
    });
    return { zh, addr };
  }
  let geoLast = 0;
  async function nomi(q) {
    const wait = geoLast + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    geoLast = Date.now();
    const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=cn&bounded=1&viewbox=" + SH_BOX + "&accept-language=zh-CN&q=" + encodeURIComponent(q), { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("http " + r.status);
    const a = await r.json();
    return a && a[0] ? [+(+a[0].lat).toFixed(5), +(+a[0].lon).toFixed(5)] : null;
  }
  async function geoLookup(zh, addr) {
    const tries = [];
    const add = (q) => { q = String(q || "").trim(); if (q && hanN(q) >= 2 && tries.indexOf(q) < 0) tries.push(q); };
    add(zh); add(String(zh || "").replace(/[（(][^）)]*[）)]/g, "")); add(addr);
    add(String(addr || "").replace(/^(中国)?(上海市?)?/, "").replace(/\d[\d\-—]*号.*$/, ""));
    for (const q of tries) { const ll = await nomi(q); if (ll) return ll; }
    return null;
  }
  const locating = {};
  async function locate(id, quiet) {
    const f = findItem(id);
    if (!f || f.kind === "spot" || locating[id]) return;
    const key = f.item.zh || f.item.addr;
    if (!key) return;
    locating[id] = true;
    try {
      const ll = await geoLookup(f.item.zh, f.item.addr);
      const g = findItem(id); /* re-read: a sync may have swapped the object meanwhile */
      if (!g || (g.item.zh || g.item.addr) !== key) return;
      const it = g.item;
      if (ll) {
        it.ll = ll; delete it.llMiss;
        if (kmBetween(SH_MID, ll) > 12) it.far = true; else delete it.far;
        save(); render(); if (!quiet) toast((it.ko || it.zh) + " 위치를 찾아서 지도에 꽂았어요");
      } else {
        it.llMiss = key; save();
        if (!quiet) toast((it.ko || it.zh) + " 위치는 못 찾았어요 · 지도 핀만 빠지고 나머진 다 돼요", null, 3500);
      }
    } catch (e) { /* offline: tried again next time the app opens */ }
    finally { delete locating[id]; }
  }
  function locateMissing() {
    if (navigator.onLine === false) return;
    const ids = [];
    state.days.forEach((d) => d.stops.forEach((st) => { const k = st.zh || st.addr; if (!st.ll && k && st.llMiss !== k) ids.push(st.id); }));
    ids.slice(0, 8).reduce((pr, id) => pr.then(() => locate(id, true)), Promise.resolve());
  }
  function sharePreview() {
    const ta = sheet.querySelector('textarea[name="share"]'), out = document.getElementById("shPrev");
    if (!ta || !out) return;
    const p = parseShare(ta.value);
    out.innerHTML = !ta.value.trim() ? "" : p.zh
      ? '<div class="sp-row"><span>중국어 이름</span><b class="zh">' + esc(p.zh) + "</b></div>" + (p.addr ? '<div class="sp-row"><span>주소</span><b class="zh">' + esc(p.addr) + "</b></div>" : "") + '<p class="sp-ok">' + ICON.pin + "저장하면 지도 위치도 알아서 찾아요</p>"
      : '<p class="sp-no">중국어 이름을 못 찾았어요 · 고덕지도나 디엔핑에서 공유 → 복사한 걸 붙여넣어 주세요</p>';
  }
  function itemSheet(id, opt) {
    opt = opt || {};
    const f = id ? findItem(id) : null;
    const parent = f ? f.parent : opt.parent ? findItem(opt.parent).item : null;
    const isSpot = f ? f.kind === "spot" : !!opt.parent;
    const isNew = !f;
    const it = f ? f.item : { id: newId(isSpot ? "p" : "s"), ko: "", zh: "" };
    const dayId = f ? f.day.id : opt.parent ? findItem(opt.parent).day.id : opt.day;
    const keep = opt.keep || {}, mode = opt.mode || (isNew ? "auto" : "manual");
    const daySel = (sel) => '<label class="field"><span>날짜</span><select name="day">' + state.days.map((d) => '<option value="' + d.id + '"' + (d.id === sel ? " selected" : "") + ">" +
      esc((isNum(d.n) ? "Day " + d.n : "귀국") + " · " + d.date + " · " + d.title) + "</option>").join("") + "</select></label>";
    const modeSeg = '<div class="amode" role="group" aria-label="넣는 방법">' +
      [["auto", "자동 찾기"], ["manual", "직접 넣기"]].map((m) => '<button type="button" data-act="sh" data-k="mode-' + m[0] + '" aria-pressed="' + (mode === m[0]) + '">' + m[1] + "</button>").join("") + "</div>";
    if (mode === "auto") {
      const autoBody = modeSeg +
        '<label class="field"><span>고덕지도 · 디엔핑에서 공유 → 복사한 걸 붙여넣기</span><textarea name="share" class="zhin" style="min-height:96px" placeholder="예: 武康大楼 上海市徐汇区淮海中路1842号 https://surl.amap.com/…&#10;중국어 이름만 붙여넣어도 돼요">' + esc(keep.share || "") + "</textarea></label>" +
        '<div class="shprev" id="shPrev" aria-live="polite"></div>' +
        '<div class="two">' + field("ko", (isSpot ? "가게" : "장소") + " 한국어 이름 · 안 써도 돼요", keep.ko != null ? keep.ko : it.ko) + priSelect(keep.pri != null ? keep.pri : it.pri) + "</div>" +
        (isSpot ? "" : daySel(keep.day || dayId));
      openSheet({
        key: "item", title: isNew ? (isSpot ? "가게 추가" : "장소 추가") : (it.ko || it.zh || "장소") + " 다시 찾기",
        body: autoBody, foot: footSave(false),
        on(k, v) {
          if (k === "mode-manual") { const p = parseShare(v.share); itemSheet(id, Object.assign({}, opt, { mode: "manual", keep: { ko: v.ko || "", zh: p.zh || "", pri: v.pri, day: v.day } })); return; }
          if (k !== "save") return;
          const p = parseShare(v.share);
          if (!p.zh) { toast("중국어 이름을 못 찾았어요 · 공유 → 복사한 걸 붙여넣어 주세요", null, 3500); return; }
          const changed = it.zh !== p.zh;
          it.zh = p.zh; it.ko = v.ko || (isNew ? p.zh : it.ko || p.zh);
          if (p.addr) it.addr = p.addr; else if (changed) delete it.addr;
          if (v.pri) it.pri = v.pri; else delete it.pri;
          if (changed) { delete it.ll; delete it.llMiss; delete it.far; }
          if (isNew) {
            if (isSpot) (parent.spots = parent.spots || []).push(it);
            else { const dd = findDay(v.day || dayId); joinPart(dd, it); dd.stops.push(it); }
          } else if (!isSpot && v.day && v.day !== f.day.id && findDay(v.day)) {
            f.list.splice(f.list.indexOf(it), 1); joinPart(findDay(v.day), it); findDay(v.day).stops.push(it); ui.day = v.day; saveUI();
          }
          save(); render(); detailSheet(it.id);
          if (!isSpot && !it.ll) { toast("저장했어요 · 지도 위치 찾는 중…"); locate(it.id); } else toast("저장했어요");
        }
      });
      const ta = sheet.querySelector('textarea[name="share"]');
      if (ta) { ta.addEventListener("input", sharePreview); sharePreview(); }
      return;
    }
    let body = modeSeg + '<div class="two">' + field("ko", isSpot ? "가게 이름" : "장소 이름", keep.ko != null ? keep.ko : it.ko) + priSelect(keep.pri != null ? keep.pri : it.pri) + "</div>" +
      field("zh", "중국어 이름 (택시·지도용)", keep.zh != null && !it.zh ? keep.zh : it.zh, { zh: 1 }) +
      field("desc", "한 줄 설명", it.desc, { ph: "예: 신천지 근처 딤섬집" }) +
      field("tags", "태그 (쉼표로 구분)", (it.tags || []).join(", "), { ph: "예: 예약 필수, 현금만" }) +
      field("hours", "영업시간", it.hours, { ph: "예: 10:00–22:00, 월요일 휴무" }) +
      field("memo", "가서 할 일 · 메모", it.memo, { area: 1, ph: "예: 홍미창펀 꼭 먹기" }) +
      field("how", "가는 길 · 안 써도 돼요", it.how, { area: 1, ph: "예: 10호선 신톈디역 6번 출구" });
    if (!isSpot) body += daySel(keep.day || dayId);
    const apply = (v) => {
      it.ko = v.ko || it.ko || "";
      if ((v.zh || "") !== (it.zh || "")) { delete it.ll; delete it.llMiss; delete it.far; } /* a new Chinese name means a new place on the map */
      it.zh = v.zh || "";
      ["desc", "hours", "memo", "pri", "how"].forEach((k) => { if (v[k]) it[k] = v[k]; else delete it[k]; });
      const tags = String(v.tags || "").split(/[,，]/).map((x) => x.trim()).filter(Boolean);
      if (tags.length) it.tags = tags; else delete it.tags;
      if (isNew) {
        if (isSpot) (parent.spots = parent.spots || []).push(it);
        else { joinPart(findDay(dayId), it); findDay(dayId).stops.push(it); }
      } else if (!isSpot && v.day && v.day !== f.day.id && findDay(v.day)) {
        f.list.splice(f.list.indexOf(it), 1);
        joinPart(findDay(v.day), it);
        findDay(v.day).stops.push(it);
        ui.day = v.day; saveUI();
      }
    };
    openSheet({
      key: "item", title: isNew ? (isSpot ? "가게 추가" : "장소 추가") : (it.ko || "장소") + " 수정",
      body,
      foot: footSave(!isNew),
      on(k, v, btn) {
        if (k === "mode-auto") { itemSheet(id, Object.assign({}, opt, { mode: "auto", keep: { ko: v.ko || "", share: v.zh || "", pri: v.pri, day: v.day } })); return; }
        if (k === "save") {
          if (!v.ko) { toast("이름을 적어주세요"); return; }
          apply(v); save(); render(); detailSheet(it.id);
          if (!isSpot && it.zh && !it.ll) { toast("저장했어요 · 지도 위치 찾는 중…"); locate(it.id); } else toast("저장했어요");
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
        field("wx", "날씨", d.wx, { ph: "예: 맑음 ☀️ 21°/14°" }) +
        '<label class="field"><span>일정 목록 나누기</span><select name="split"><option value="">안 나누기</option><option value="1"' + (isSplit(d) ? " selected" : "") + '>아침 · 낮 · 저녁으로 나누기</option></select>' +
        '<span class="hint">나누면 장소를 길게 눌러 다른 시간대 밑으로 끌어 옮길 수 있어요</span></label>',
      foot: footSave(false),
      on(k, v) {
        if (k !== "save") return;
        d.title = v.title || d.title; d.date = v.date || d.date; if (v.iso) d.iso = v.iso;
        if (v.wx) d.wx = v.wx; else delete d.wx;
        if (v.split && !isSplit(d)) visible(d).forEach((x) => { x.part = "낮"; });
        else if (!v.split) d.stops.forEach((x) => { delete x.part; });
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
  const tripTitle = () => ((state.trip.title || "") + " " + (state.trip.nights || "")).trim();
  function tripTitleSheet() {
    const t = state.trip;
    openSheet({
      title: "여행 제목",
      body: '<p class="note">홈 맨 위에 크게 나오는 제목이에요. 친구랑 같이 쓰면 같이 바뀌어요.</p>' +
        field("title", "제목", t.title || "", { ph: "예: 상하이" }) + field("nights", "기간", t.nights || "", { ph: "예: 3박 4일" }),
      foot: footSave(false),
      on(k, v) {
        if (k !== "save") return;
        state.trip.title = v.title; state.trip.nights = v.nights;
        save(); closeSheet(); render(); toast("바꿨어요");
      }
    });
  }
  function membersSheet() {
    const ms = state.settle.members || [];
    openSheet({
      key: "members", title: "여행 인원",
      body: '<p class="note">기록 · 정산 · 친구랑 같이 쓰기에 쓰여요. 동그라미를 누르면 기록에 뜨는 아이콘을 고를 수 있어요.</p>' +
        (ms.length ? '<div class="cklist mems">' + ms.map((n) => '<div class="li"><button class="avbtn" type="button" data-act="av-pick" data-p="' + esc(n) + '" data-back="members" aria-label="' + esc(n) + ' 아이콘 고르기">' + avHtml(n) + '</button><span class="ck">' + esc(n) + '</span><button class="icon-btn" type="button" data-act="mem-del" data-p="' + esc(n) + '" aria-label="' + esc(n) + ' 빼기">' + ICON.x + "</button></div>").join("") + "</div>" : '<p class="empty">아직 아무도 없어요</p>') +
        '<div class="addline"><input id="memNew" placeholder="이름 추가" autocomplete="off" enterkeyhint="done"><button class="btn primary" type="button" data-act="mem-add">추가</button></div>'
    });
  }
  /* 초기 세팅으로 되돌리기: pick what goes back to how the app started — the list as it was, nothing added, nothing ticked */
  function resetSheet() {
    const opts = [["widgets", "홈 위젯", "모든 날짜를 추천 배치로", true], ["pack", "준비물", "나만 준비물 지우기 · 기본 목록 복구 · 체크 풀기", false], ["apps", "필수 앱", "처음 목록으로 · 체크 풀기", false],
      ["todo", "할 일", "나만 할 일 지우기 · 기본 목록 복구 · 체크 풀기", false]];
    openSheet({
      key: "reset", title: "초기 세팅으로 되돌리기",
      body: '<div class="rlist">' + opts.map((o) => '<label class="rrow"><input type="checkbox" name="' + o[0] + '"' + (o[3] ? " checked" : "") + '><span><b>' + o[1] + "</b><small>" + o[2] + "</small></span></label>").join("") + "</div>" +
        '<p class="note">할 일 · 준비물은 같이 보는 거라, 다시 넣은 기본 항목은 친구 폰에도 생겨요.</p>',
      foot: '<span class="grow"></span><button class="btn" type="button" data-act="sh-close">취소</button><button class="btn danger" type="button" data-act="sh" data-k="go">되돌리기</button>',
      on(k, v, btn) {
        if (k !== "go") return;
        const picked = opts.filter((o) => v[o[0]]);
        if (!picked.length) { toast("되돌릴 걸 골라주세요"); return; }
        if (!btn.classList.contains("armed")) { btn.classList.add("armed"); btn.textContent = "한 번 더 누르면 되돌려요"; return; }
        const seed = window.TRIP_SEED, untick = (list) => list.forEach((x) => { delete state.done[x.id]; });
        if (v.widgets) { ui.wsets = {}; editing = false; saveUI(); }
        const isTodo = (k2) => k2 === "todo" || String(k2).indexOf("tk:") === 0;
        if (ui.ckOrd) { Object.keys(ui.ckOrd).forEach((k2) => { if ((v.todo && isTodo(k2)) || (v.pack && k2 === "pack")) delete ui.ckOrd[k2]; }); saveUI(); }
        if (v.apps) { untick(state.prep.apps); state.prep.apps = clone(seed.prep.apps || []); untick(state.prep.apps); }
        /* shared lists: my 나만 ones go, deleted starters come back, ticks off (a friend's added ones stay) */
        const back = (key, also) => {
          const mineHere = state.mine.filter((x) => (key === "todo" ? isTodo(x.list) : x.list === key));
          untick(mineHere); state.mine = state.mine.filter((x) => mineHere.indexOf(x) < 0);
          const sd = seed.prep[key] || [], L = state.prep[key];
          sd.forEach((x, i) => { /* back in its starting place: just before the next starter item that's still there */
            if (L.some((y) => y.id === x.id)) return;
            const nx = sd.slice(i + 1).map((z) => L.findIndex((y) => y.id === z.id)).find((j) => j >= 0);
            if (nx == null) L.push(clone(x)); else L.splice(nx, 0, clone(x));
          });
          untick(state.prep[key]); if (also) untick(also);
        };
        if (v.pack) back("pack");
        if (v.todo) back("todo", state.tasks);
        save(); closeSheet(); render(); toast(picked.map((o) => o[1]).join(", ") + " 되돌렸어요", null, 3500);
      }
    });
  }
  function memoSheet() {
    const m = state.memos[0] || null;
    openSheet({
      title: "메모",
      body: '<label class="field"><span class="vh">메모</span><textarea name="text" style="min-height:40vh" placeholder="자유롭게 적어두기 · 이 폰에만 저장돼요">' + esc(m ? m.text : "") + "</textarea></label>",
      foot: footSave(!!m),
      on(k, v, btn) {
        if (k === "save") {
          if (!v.text) { state.memos = []; save(); closeSheet(); render(); return; }
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
    $("#viewerFoot").hidden = !(x.u && vSrc.kind === "place"); /* internet pictures: copy or change the address */
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
    save(); render(); upSoon();
  }
  async function addPlacePhotos(id, files) {
    const arr = (state.placePhotos[id] = state.placePhotos[id] || []);
    await putPhotos(arr, files);
    upSoon();
    render(); detailSheet(id);
  }

  /* ---------- home widget editing: remove, add, long-press drag ---------- */
  let press = null, drag = null;
  function soloRefresh(grid) {
    const halves = Array.from(grid.querySelectorAll(".w[data-w]")).filter((el) => el.classList.contains("w-half"));
    halves.forEach((el, i) => el.classList.toggle("w-solo", halves.length % 2 === 1 && i === halves.length - 1));
  }
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
    if (grid) setWidgets(Array.from(grid.querySelectorAll(".w[data-w]")).map((el) => el.getAttribute("data-w")));
    drag = null;
    render(); /* sizes (and the route map's width) follow the new order */
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
    soloRefresh(over.parentNode);
  });
  /* 할 일 · 준비물 sheet: drag a row by its grip */
  /* the ≡ grip: pulled up/down it moves the row; pulled sideways the row slides open/shut like anywhere else */
  let ckDrag = null;
  const ckIds = (list) => Array.from(list.children).map((r) => r.getAttribute("data-id"));
  const ckDragGo = () => {
    const d = ckDrag;
    d.on = true;
    openRows().forEach((o) => shut(o, true));
    d.li.classList.add("dragging");
    try { d.g.setPointerCapture(d.id); } catch (err) {}
  };
  sheet.addEventListener("pointerdown", (e) => {
    const g = e.target.closest(".ck-grip");
    if (!g) return;
    const li = g.closest(".li");
    ckDrag = { li, g, key: g.getAttribute("data-grip"), id: e.pointerId, list: li.parentNode, x: e.clientX, y: e.clientY, on: false, order: ckIds(li.parentNode).join() };
    if (e.pointerType === "mouse") { e.preventDefault(); ckDragGo(); }
  });
  document.addEventListener("pointermove", (e) => {
    if (!ckDrag || e.pointerId !== ckDrag.id) return;
    if (!ckDrag.on) {
      const dx = e.clientX - ckDrag.x, dy = e.clientY - ckDrag.y;
      if (Math.abs(dx) > 6 && Math.abs(dx) >= Math.abs(dy)) { ckDrag = null; return; } /* sideways: let the row slide */
      if (Math.abs(dy) < 6) return;
      ckDragGo();
    }
    e.preventDefault();
    let before = null;
    for (const r of Array.from(ckDrag.list.children)) {
      if (r === ckDrag.li) continue;
      const b = r.getBoundingClientRect();
      if (e.clientY < b.top + b.height / 2) { before = r; break; }
    }
    if (before !== ckDrag.li.nextSibling || (!before && ckDrag.li !== ckDrag.list.lastElementChild)) ckDrag.list.insertBefore(ckDrag.li, before);
  }, { passive: false });
  /* only redraw when the order really changed (a plain touch on ≡ used to redraw the whole list — that was the flicker) */
  const ckDrop = () => {
    if (!ckDrag) return;
    const d = ckDrag;
    ckDrag = null;
    if (!d.on) return;
    d.li.classList.remove("dragging");
    const ids = ckIds(d.list);
    if (ids.join() === d.order) return;
    ckReorder(d.key, ids);
    viewStale = true;
  };
  document.addEventListener("pointerup", ckDrop);
  document.addEventListener("pointercancel", ckDrop);
  document.addEventListener("touchmove", (e) => {
    if (!ckDrag) return;
    if (ckDrag.on) { e.preventDefault(); return; }
    const t = e.touches[0];
    if (t && Math.abs(t.clientY - ckDrag.y) > Math.abs(t.clientX - ckDrag.x)) e.preventDefault(); /* up/down on ≡ is a move, not a scroll */
  }, { passive: false });
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
    if (li.parentNode.hasAttribute("data-split")) li.parentNode.classList.add("drag-on");
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
    const acts = row.parentNode.querySelector(".wsw-acts"), w = acts ? acts.offsetWidth + 8 : SW_W;
    rg = { row, w, id: e.pointerId, x0: e.clientX, y0: e.clientY, lastY: e.clientY, base: openSw === row ? -w : 0, mode: null, t: setTimeout(startRowDrag, e.pointerType === "mouse" ? 260 : 380) };
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
      const x = Math.max(-rg.w - 30, Math.min(0, rg.base + dx));
      rg.row.style.transform = "translateX(" + x + "px)";
      rg.row.parentNode.classList.toggle("open", x < -4);
      rg.dx = dx;
      return;
    }
    if (rg.mode === "drag") {
      const ul = rg.li.parentNode, el = document.elementFromPoint(e.clientX, e.clientY);
      const over = el && el.closest("li[data-id], li.pgh");
      if (!over || over === rg.li || over.parentNode !== ul) return;
      const r = over.getBoundingClientRect();
      ul.insertBefore(rg.li, e.clientY > r.top + r.height / 2 ? over.nextSibling : over);
    }
  });
  /* 할 일 · 준비물 sheet: press and hold a row for 나만/같이 · 고치기 · 지우기 (a short tap ticks it) */
  let lp = null, lpFired = false;
  function ckMenuClose() {
    const m = sheet.querySelector(".ckmenu");
    if (m) m.remove();
    sheet.querySelectorAll(".sli.lp").forEach((r) => r.classList.remove("lp"));
  }
  function ckMenuOpen(li) {
    ckMenuClose();
    const list = li.closest(".cklist"), key = list && list.getAttribute("data-key"), id = li.getAttribute("data-id");
    const x = key && ckList(key).find((y) => y.id === id);
    if (!x) return;
    const b = (act, ic, label, cls) => '<button type="button" role="menuitem"' + (cls ? ' class="' + cls + '"' : "") + ' data-act="' + act + '" data-list="' + key + '" data-id="' + id + '">' + ic + "<span>" + label + "</span></button>";
    const m = document.createElement("div");
    m.className = "ckmenu"; m.setAttribute("role", "menu");
    m.innerHTML = (canMine(key) ? b("li-mine", x.list ? ICON.users : ICON.lock, x.list ? "같이 보기로" : "나만 보기") : "") + b("li-edit", ICON.pen, "고치기") + b("li-del", ICON.trash, "지우기", "del");
    sheet.appendChild(m);
    li.classList.add("lp");
    const r = li.getBoundingClientRect(), mh = m.offsetHeight, mw = m.offsetWidth;
    m.style.top = (r.bottom + 6 + mh < window.innerHeight - 12 ? r.bottom + 6 : Math.max(12, r.top - mh - 6)) + "px";
    m.style.left = Math.max(12, Math.min(r.left + 36, window.innerWidth - mw - 12)) + "px";
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
  }
  sheet.addEventListener("pointerdown", (e) => {
    lpFired = false;
    /* a tap anywhere else just closes the menu */
    if (sheet.querySelector(".ckmenu") && !e.target.closest(".ckmenu")) { ckMenuClose(); lpFired = true; return; }
    if (e.button && e.button > 0) return;
    const inn = e.target.closest(".cklist .sli-in");
    if (!inn || e.target.closest(".ck-grip, .ck-edit")) return;
    const li = inn.closest(".sli");
    lp = { id: e.pointerId, x: e.clientX, y: e.clientY, t: setTimeout(() => { lp = null; lpFired = true; ckMenuOpen(li); }, 420) };
  });
  document.addEventListener("pointermove", (e) => { if (lp && e.pointerId === lp.id && Math.abs(e.clientX - lp.x) + Math.abs(e.clientY - lp.y) > 10) { clearTimeout(lp.t); lp = null; } });
  ["pointerup", "pointercancel"].forEach((n) => document.addEventListener(n, () => { if (lp) { clearTimeout(lp.t); lp = null; } }));
  /* the finger lifting after the hold mustn't also tick the box */
  sheet.addEventListener("touchend", (e) => { if (lpFired && e.cancelable) e.preventDefault(); }, { passive: false });
  sheet.addEventListener("click", (e) => { if (lpFired) { lpFired = false; e.preventDefault(); e.stopPropagation(); } }, true);
  sheet.addEventListener("contextmenu", (e) => { const inn = e.target.closest(".cklist .sli-in"); if (inn) { e.preventDefault(); if (!sheet.querySelector(".ckmenu")) ckMenuOpen(inn.closest(".sli")); } });
  const openRows = () => Array.from(sheet.querySelectorAll(".sli-sc")).filter((sc) => sc.scrollLeft > 4);
  /* settle a row open/shut in one quick glide: stop the phone's own (slower) glide, jump the scroll to the end spot,
     and slide the contents the rest of the way frame by frame — already moving on the very first frame, fast at first, soft at the end */
  const rowTo = (sc, open, now) => {
    cancelAnimationFrame(sc._raf);
    sc.style.overflowX = "hidden"; /* ends the phone's own glide right here, so nothing fights the one below */
    const to = open ? sc.scrollWidth - sc.clientWidth : 0, from = sc.scrollLeft, kids = Array.from(sc.children);
    sc.style.scrollSnapType = "none";
    sc.scrollLeft = to;
    const set = (v) => kids.forEach((k) => { k.style.transform = Math.abs(v) > 0.5 ? "translateX(" + v + "px)" : ""; });
    const done = () => { set(0); sc.style.scrollSnapType = ""; sc.style.overflowX = ""; };
    const d0 = to - from;
    if (now || Math.abs(d0) < 1) { done(); return; }
    const t0 = performance.now(), dur = 180;
    let last = 0;
    const step = () => {
      const p = last = Math.min(1, Math.max(last, (performance.now() - t0 + 16) / dur)), e = 1 - Math.pow(1 - p, 3);
      set(d0 * (1 - e));
      if (p < 1) sc._raf = requestAnimationFrame(step); else done();
    };
    step();
  };
  const shut = (sc, now) => rowTo(sc, false, now);
  let rowT = null;
  sheet.addEventListener("touchstart", (e) => { const sc = e.target.closest(".sli-sc"); rowT = sc && !e.target.closest(".sli-acts") ? { sc, left: sc.scrollLeft } : null; }, { passive: true });
  sheet.addEventListener("touchend", () => {
    const t = rowT;
    rowT = null;
    if (!t) return;
    const now = t.sc.scrollLeft;
    if (Math.abs(now - t.left) < 6) return;
    const open = now > t.left;
    rowTo(t.sc, open);
  }, { passive: true });
  sheet.addEventListener("scroll", (e) => {
    if (sheet.querySelector(".ckmenu")) ckMenuClose();
    const sc = e.target;
    if (sc.classList && sc.classList.contains("sli-sc") && sc.scrollLeft > 4) openRows().forEach((o) => { if (o !== sc) shut(o); });
  }, true);
  sheet.addEventListener("click", (e) => {
    const open = openRows();
    if (!open.length || e.target.closest(".sli-acts")) return;
    open.forEach((o) => shut(o));
    if (open.some((o) => o.contains(e.target))) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  function endRowGesture() {
    if (!rg) return;
    clearTimeout(rg.t);
    const g = rg;
    rg = null;
    if (g.mode === "swipe") {
      swallow = true;
      g.row.style.transition = "";
      const x = g.base + (g.dx || 0), keep = g.base ? (g.dx || 0) < 40 : x < -40;
      if (keep) { g.row.style.transform = "translateX(" + -g.w + "px)"; g.row.parentNode.classList.add("open"); openSw = g.row; }
      else { g.row.style.transform = ""; g.row.parentNode.classList.remove("open"); if (openSw === g.row) openSw = null; }
    } else if (g.mode === "drag") {
      swallow = true;
      g.li.classList.remove("dragging");
      const ul = g.li.parentNode, day = planDay();
      const ids = Array.from(ul.children).map((li) => li.getAttribute("data-id"));
      const byId = {}; day.stops.forEach((s) => { byId[s.id] = s; });
      if (ul.hasAttribute("data-split")) {
        let cur = PARTS[0];
        Array.from(ul.children).forEach((li) => { const p = li.getAttribute("data-part"), it = byId[li.getAttribute("data-id")]; if (p) cur = p; else if (it) it.part = cur; });
      }
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
       각자: 준비물 · 필수 앱 (and their ticks) · 사진 · 화면 설정
     Every piece is its own row (one expense, one memo, one tick, one day…), so two people changing
     different things never overwrite each other; the same piece changed twice → the later one stays.
     Offline-first: everything still saves on the phone; changes wait and go out once there's signal. */
  const CODE_ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  function syncCfg() {
    const c = window.TRIP_SYNC || {}, o = sync.cfg || {};
    return { url: String(o.url || c.url || "").trim().replace(/\/+$/, ""), key: String(o.key || c.key || "").trim() };
  }
  const syncReady = () => { const c = syncCfg(); return !!(c.url && c.key); };
  /* the app ships with its own storage address (config.js), so nobody has to connect by hand */
  const fixedCfg = () => { const c = window.TRIP_SYNC || {}; return !!(c.url && c.key); };
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
    pack: [() => state.prep.pack, (a) => { state.prep.pack = a; }],
    link: [() => state.prep.links, (a) => { state.prep.links = a; }],
    info: [() => state.infos, (a) => { state.infos = a; }],
    post: [() => state.posts, (a) => { state.posts = a; }],
    task: [() => state.tasks, (a) => { state.tasks = a; }]
  };
  /* ticks that stay on this phone: 준비물 · 앱, and every 할 일 (같이 할 일 too — the list is shared, the checking is each person's own) */
  const personalIds = () => { const s = new Set(); state.prep.pack.concat(state.prep.apps, state.mine, state.prep.todo, state.tasks).forEach((x) => s.add(x.id)); return s; };
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
    Object.keys(state.avatars).forEach((k) => { if (state.avatars[k]) m["av:" + k] = state.avatars[k]; });
    /* one row per shared photo, so two people adding or removing photos never overwrite each other */
    Object.keys(state.shared).forEach((o) => (state.shared[o] || []).forEach((pid) => { m["ph:" + o + ":" + pid] = 1; }));
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
      case "layout": case "lay": break; /* from the old '친구 첫 화면도 이 배치로': not used any more */
      case "av": if (v) state.avatars[id] = v; else delete state.avatars[id]; break;
      case "ph": {
        const c = id.lastIndexOf(":"), o = id.slice(0, c), pid = id.slice(c + 1);
        if (!o || !validPid(pid)) break;
        const a = (state.shared[o] || []).filter((x) => x !== pid);
        if (v) { a.push(pid); a.sort(); }
        setShared(o, a);
        if (!v) { /* removed on the other phone: gone here too */
          [state.postPhotos, state.placePhotos].forEach((mp) => { const l = mp[o]; if (l && l.indexOf(pid) >= 0) { l.splice(l.indexOf(pid), 1); if (!l.length) delete mp[o]; } });
          dropPhoto(pid);
        }
        break;
      }
      case "done": if (personalIds().has(id)) break; if (v) state.done[id] = true; else delete state.done[id]; break;
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
    const per = personalIds();
    Object.keys(sync.base).forEach((k) => { if (!(k in cur) && sync.base[k] !== "null" && !(k.indexOf("done:") === 0 && per.has(k.slice(5)))) rows.push({ k, v: null }); });
    return rows;
  }

  /* don't pull changes in while someone is typing, dragging or has an edit form open —
     the form would save onto an old copy. It just waits for the next round. */
  function busy() {
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && (view.contains(ae) || sheet.contains(ae))) return true;
    if (rg || drag || press || dotScrub || ckDrag || lp || (openSw && openSw.isConnected) || sheet.querySelector(".ckmenu")) return true;
    if (!sheet.hidden && Array.from(sheet.querySelectorAll(".sli-sc")).some((sc) => sc.scrollLeft > 4)) return true;
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
    uploadPending();
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

  /* ---------- 사진도 같이: photos go to a public Supabase Storage bucket under the trip code ----------
     Each post / place keeps a synced list of photo ids that are on the server ("shared"); the phone that
     took a photo uploads it in the background, the other phone downloads it once and keeps it. */
  const BUCKET = "trip-photos";
  const validPid = (x) => typeof x === "string" && /^ph[a-z0-9]{4,40}$/.test(x);
  function picsOf(owner, local) {
    const out = (state.shared[owner] || []).filter(validPid);
    (local || []).forEach((x) => { if (out.indexOf(x) < 0) out.push(x); });
    return out;
  }
  function setShared(owner, list) { if (list && list.length) state.shared[owner] = list; else delete state.shared[owner]; }
  function unlinkPic(owner, pid, localMap) {
    const a = localMap[owner];
    if (a) { const k = a.indexOf(pid); if (k >= 0) a.splice(k, 1); if (!a.length) delete localMap[owner]; }
    setShared(owner, (state.shared[owner] || []).filter((x) => x !== pid));
  }
  const objUrl = (pid) => syncCfg().url + "/storage/v1/object/" + BUCKET + "/" + encodeURIComponent(sync.code) + "/" + pid + ".jpg";
  const fetching = {};
  function fetchShared(pid) {
    if (!validPid(pid) || !sync.code || !syncReady()) return Promise.resolve(null);
    if (fetching[pid]) return fetching[pid];
    return (fetching[pid] = fetch(objUrl(pid).replace("/object/", "/object/public/"), { cache: "force-cache" })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => { if (b && b.size) { photoDB.put(pid, b).catch(() => {}); return b; } return null; })
      .catch(() => null)
      .finally(() => { delete fetching[pid]; }));
  }
  function pendingUploads() {
    const jobs = [];
    [state.postPhotos, state.placePhotos].forEach((map) => Object.keys(map).forEach((o) => {
      if (map === state.postPhotos && !state.posts.some((x) => x.id === o)) return; /* post was deleted */
      (map[o] || []).forEach((pid) => { if (validPid(pid) && (state.shared[o] || []).indexOf(pid) < 0) jobs.push([o, pid]); });
    }));
    return jobs;
  }
  let upBusy = false, upWait = 0, upT = 0;
  const upSoon = () => { if (!sync.code) return; clearTimeout(upT); upT = setTimeout(uploadPending, 1200); };
  async function uploadPending() {
    if (upBusy || !sync.code || !syncReady() || Date.now() < upWait) return;
    const jobs = pendingUploads();
    if (!jobs.length) { if (sync.photoErr) { sync.photoErr = ""; saveSync(); } return; }
    upBusy = true;
    let done = 0;
    try {
      for (const [o, pid] of jobs.slice(0, 8)) {
        const blob = await photoDB.get(pid);
        if (!blob) { unlinkPic(o, pid, state.postPhotos[o] ? state.postPhotos : state.placePhotos); continue; }
        const c = syncCfg(), h = { apikey: c.key, "Content-Type": blob.type || "image/jpeg", "x-upsert": "false" };
        if (!/^sb_/.test(c.key)) h.Authorization = "Bearer " + c.key;
        const r = await fetch(objUrl(pid), { method: "POST", headers: h, body: blob });
        let ok = r.ok;
        if (!ok) { const t = await r.text().catch(() => ""); ok = r.status === 409 || /duplicate|already exists/i.test(t); if (!ok) throw new Error("up " + r.status + " " + t.slice(0, 160)); }
        if ((state.shared[o] || []).indexOf(pid) < 0) state.shared[o] = (state.shared[o] || []).concat(pid).sort();
        done++;
      }
      sync.photoErr = "";
    } catch (e) {
      const m = String((e && e.message) || e);
      sync.photoErr = /up (400|401|403|404)/.test(m) ? "setup" : "net";
      upWait = Date.now() + (sync.photoErr === "setup" ? 300000 : 30000);
    } finally {
      upBusy = false; saveSync();
      if (done) save(); /* the new shared lists go out with the next sync round */
      refreshSyncText();
    }
  }

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
    /* the shared half comes from the trip; my 나만 items, apps and photos stay as they are */
    const per = personalIds();
    if (rows.some((r) => r.k.indexOf("day:") === 0 && r.v)) state.days = [];
    if (rows.some((r) => r.k.indexOf("pack:") === 0 && r.v)) state.prep.pack = [];
    state.prep.todo = []; state.prep.links = []; state.infos = []; state.settle.expenses = []; state.posts = []; state.likes = {}; state.shared = {}; state.tasks = []; state.layout = null; state.layAck = {}; state.avatars = {};
    Object.keys(state.journal).forEach((d) => { if (state.journal[d]) delete state.journal[d].text; });
    Object.keys(state.done).forEach((id) => { if (!per.has(id)) delete state.done[id]; });
    state.skip = {};
    Object.assign(sync, { code, cursor: null, base: {}, ts: {}, err: "" });
    rows.forEach((r) => {
      const ts = tsKey(r.ts);
      sync.base[r.k] = s2(r.v); sync.ts[r.k] = ts;
      if (!sync.cursor || ts > sync.cursor) sync.cursor = ts;
    });
    ui.wsets = {}; saveUI(); /* a phone that joins a trip starts from the 추천 배치 */
    const ticks = Object.assign({}, state.done);
    rows.forEach((r) => applyKey(r.k, r.v));
    Object.keys(LISTS).forEach(orderList);
    /* a 할 일 tick that arrived before its list row: ticks on 할 일 are each person's own, so keep what this phone had */
    const per2 = personalIds();
    rows.forEach((r) => { if (r.k.indexOf("done:") === 0) { const i = r.k.slice(5); if (per2.has(i)) { if (ticks[i]) state.done[i] = true; else delete state.done[i]; } } });
    state = norm(state);
    lsSet(LS_STATE, state);
    sync.last = Date.now();
    saveSync();
    render();
  }
  function leaveTrip() { Object.assign(sync, { code: "", cursor: null, base: {}, ts: {}, err: "", photoErr: "" }); saveSync(); }

  function syncStatus() {
    if (!sync.code) return "";
    const n = pendingRows().length;
    if (sync.err) return (/noconfig/.test(sync.err) ? "저장소 연결 정보가 없어요" : "지금은 연결이 안 돼요") + (n ? " · 보낼 것 " + n + "개 대기 중" : "") + " · 연결되면 알아서 맞춰요";
    if (!sync.last) return "맞추는 중…";
    const s = Math.round((Date.now() - sync.last) / 1000);
    const up = pendingUploads().length;
    return (s < 60 ? "방금" : s < 3600 ? Math.round(s / 60) + "분 전" : Math.round(s / 3600) + "시간 전") + " 맞췄어요" + (n ? " · 보낼 것 " + n + "개" : "") +
      (sync.photoErr === "setup" ? " · 사진 공유는 저장소 설정이 필요해요" : up ? " · 사진 " + up + "장 올리는 중" : "");
  }
  const shareSub = () => (sync.code ? sync.code + " · " + syncStatus() : "여행 코드로 친구랑 연결");
  function refreshSyncText() {
    const st = document.getElementById("syncSt");
    if (st) st.textContent = syncStatus();
    const r = view.querySelector('[data-act="share"] .rt span');
    if (r) r.textContent = shareSub();
  }
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
        '<div class="shbtns"><button class="btn primary" type="button" data-act="sync-invite">' + ICON.users + "초대 링크 복사</button>" +
        '<button class="btn" type="button" data-act="sync-now">' + ICON.sync + "지금 맞추기</button></div>" +
        meChips() +
        '<button class="btn ghost danger" type="button" data-act="sync-leave">이 폰에서 같이 쓰기 그만두기</button>';
    } else if (!c.url || !c.key) {
      body = '<p class="note">친구한테 받은 초대 링크가 있으면 붙여넣고 참여를 누르면 끝이에요.</p>' + meChips() +
        joinBox(prefill, "초대 링크 붙여넣기") +
        '<details class="fold"><summary><span class="ft">처음 시작하는 사람 · 저장소 연결</span><span class="chev" aria-hidden="true"></span></summary><div class="fold-b form">' +
        '<p class="note">무료 Supabase 프로젝트 하나가 필요해요. 만드는 법은 GitHub 저장소의 SUPABASE_SETUP.md에 있어요.</p>' +
        field("surl", "Project URL", c.url, { ph: "https://xxxx.supabase.co" }) + field("skey", "Publishable key", c.key, { ph: "sb_publishable_…" }) +
        '<button class="btn primary" type="button" data-act="sync-cfg">연결</button></div></details>';
    } else {
      body = meChips() +
        '<button class="bigopt main" type="button" data-act="sync-create"><span class="ri">' + ICON.plus + '</span><span class="rt"><b>새 여행 코드 만들기</b><span>지금 이 폰에 있는 일정으로 시작해요</span></span></button>' +
        '<div class="ordiv"><span>친구가 이미 만들었으면</span></div>' +
        joinBox(prefill, "SH-XXXX-XXXX 또는 초대 링크") +
        '<p class="note">참여하면 일정 · 정산 · 기록 같은 같이 보는 내용이 친구 것으로 바뀌어요. 준비물 · 앱, 할 일 체크, 나만 할 일은 그대로고, 이 폰에 있던 사진은 친구 여행에 다시 올라가요.</p>' +
        (fixedCfg() ? "" : '<button class="btn ghost sm" type="button" data-act="sync-cfgclear">저장소 연결 바꾸기</button>');
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
      try { await createTrip(); shareSheet(); render(); toast("여행 코드를 만들었어요 · 초대 링크 복사해서 친구한테 보내주세요", null, 4000); }
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
      copyText(text, "초대 링크를 복사했어요 · 카톡에 붙여넣어 보내세요");
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
    if (editing && e.target.closest("#wgrid") && !e.target.closest(".w-del, .w-add, .w-reset")) { e.preventDefault(); return; }
    if (swallow) { swallow = false; e.preventDefault(); return; }
    if (openSw && !e.target.closest(".sw-del")) { const was = openSw; closeSwipe(); if (e.target.closest(".swipe") && was.contains(e.target)) { e.preventDefault(); return; } }
    /* ticking a box inside a checklist widget shouldn't also open the big list */
    if (e.target.closest(".wck")) return;
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
      case "cmp-day": cmpRead(); cmp.day = t.getAttribute("data-v"); { const d = logDay(cmp.day); if (!d || !d.stops.some((x) => x.id === cmp.place)) cmp.place = ""; } drawPostSheet(); return;
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
        setWidgets(widgetList().filter((x) => x !== w)); render();
        toast(WDEF[w].name + " 위젯을 뺐어요 · 내용은 그대로 있어요", { label: "되돌리기", fn: () => { setWidgets(widgetList().concat(w)); render(); } }, 4000);
        return;
      }
      case "w-addsheet": widgetAddSheet(); return;
      case "trip-title": tripTitleSheet(); return;
      case "w-reset": {
        if (!t.classList.contains("armed")) { t.classList.add("armed"); t.lastChild.textContent = "한 번 더 누르면 되돌려요"; return; }
        ui.wsets = ui.wsets || {}; delete ui.wsets[wKey()]; saveUI(); render(); toast(wSetName() + " 위젯을 추천 배치로 되돌렸어요");
        return;
      }
      case "members": membersSheet(); return;
      case "av-pick": avSheet(t.getAttribute("data-p"), t.getAttribute("data-back")); return;
      case "av-set": {
        const n = t.getAttribute("data-p"), a = avOf(n);
        a[t.getAttribute("data-f") === "c" ? "c" : "i"] = t.getAttribute("data-k");
        state.avatars[n] = a; save(); render(); avSheet(n);
        return;
      }
      case "av-done": if (avBack === "members") membersSheet(); else closeSheet(); return;
      case "mem-del": {
        const n = t.getAttribute("data-p");
        state.settle.members = state.settle.members.filter((x) => x !== n);
        save(); render(); membersSheet(); return;
      }
      case "mem-add": {
        const inp = document.getElementById("memNew"), v = inp ? inp.value.trim() : "";
        if (!v) { if (inp) inp.focus(); return; }
        if (state.settle.members.indexOf(v) < 0) state.settle.members.push(v);
        save(); render(); membersSheet(); { const again = document.getElementById("memNew"); if (again) again.focus(); } return;
      }
      case "trip-sum": tripSumSheet(); return;
      case "preview-pick": previewSheet(); return;
      case "preview-set": ui.preview = t.getAttribute("data-v") || "auto"; saveUI(); closeSheet(); render(); window.scrollTo(0, 0); return;
      case "w-add": {
        const w = t.getAttribute("data-w"), list = widgetList();
        if (list.indexOf(w) < 0) list.push(w);
        setWidgets(list); render(); widgetAddSheet(); toast(WDEF[w].name + " 위젯을 넣었어요");
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
      case "viewer-copy": { const x = vItems()[vIdx]; if (x && x.u) copyText(x.u, "사진 링크를 복사했어요"); return; }
      case "viewer-edit": viewerEl.hidden = true; photoSheet(vSrc.id); return;
      case "viewer-del": {
        if (!armDelete(t)) return;
        const x = vItems()[vIdx];
        if (!x) return;
        if (x.u) { const f = findItem(vSrc.id); if (f) { f.item.img = ""; delete f.item.imgSrc; } }
        else if (vSrc.kind === "place") { unlinkPic(vSrc.id, x.p, state.placePhotos); dropPhoto(x.p); }
        else removePic(x.p);
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
        state.settle.expenses.push({ id: newId("x"), amt, cur: ui.cur === "KRW" ? "KRW" : "CNY", what: whatEl.value.trim(), payer: ui.payer, at: expAt() });
        amtEl.value = ""; whatEl.value = "";
        save(); render(); toast("추가했어요");
        return;
      }
      case "exp-new": expNewSheet(); return;
      case "exp-tap": { /* tap an expense: a small bar opens under it (tap again to close) */
        const row = t.closest(".exp"), had = row && row.classList.contains("sel");
        expBarClose();
        if (!row || had) return;
        const e = state.settle.expenses.find((x) => x.id === id), mine = !e && state.myExp.find((x) => x.id === id);
        if (!e && !mine) return;
        const bar = document.createElement("div");
        bar.className = "exp-acts";
        bar.innerHTML = (e ? '<button type="button" class="' + (e.settled ? "" : "pri") + '" data-act="exp-settle" data-id="' + id + '">' + (e.settled ? "정산 완료 취소" : ICON.check + "정산 완료") + "</button>" : "") +
          '<button type="button" data-act="exp-amt" data-id="' + id + '">' + ICON.pen + "금액 고치기</button>";
        row.classList.add("sel"); row.after(bar);
        return;
      }
      case "exp-settle": {
        const x = state.settle.expenses.find((y) => y.id === id);
        if (!x) return;
        if (x.settled) delete x.settled; else x.settled = true;
        save(); render(); toast(x.settled ? "정산 완료 · 정산에서 뺐어요" : "다시 정산에 넣었어요");
        return;
      }
      case "exp-amt":
      case "exp-edit": { /* the amount turns into a box right there; Enter or tapping away saves it */
        const e = state.settle.expenses.find((x) => x.id === id) || state.myExp.find((x) => x.id === id);
        expBarClose();
        const ob = act === "exp-amt" ? document.querySelector('.exp[data-id="' + id + '"] .exp-open') : t;
        if (!e || !ob) return;
        const box = document.createElement("div");
        box.className = "exp-open editing";
        box.innerHTML = ob.querySelector(".w2").outerHTML + '<span class="a"><label class="exp-edit"><span>' + (e.cur === "KRW" ? "₩" : "¥") + '</span><input inputmode="decimal" value="' + esc(e.amt) + '" aria-label="금액" autocomplete="off"></label></span>';
        ob.replaceWith(box);
        const inp = box.querySelector("input");
        inp.focus(); inp.select();
        let over = false;
        const done = (ok) => {
          if (over) return;
          over = true;
          const v = parseFloat(String(inp.value).replace(/[,\s]/g, ""));
          if (ok && v > 0 && v !== +e.amt) { e.amt = v; save(); toast("고쳤어요"); }
          render();
        };
        inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); done(true); } else if (ev.key === "Escape") done(false); });
        inp.addEventListener("blur", () => done(true));
        return;
      }
      case "exp-del": { /* gone at once; 되돌리기 puts it back in the same spot */
        const inShared = state.settle.expenses.some((x) => x.id === id), arr = inShared ? state.settle.expenses : state.myExp, i = arr.findIndex((x) => x.id === id);
        if (i < 0) return;
        const it = arr.splice(i, 1)[0];
        save(); render();
        toast("'" + (it.what || catOf(it.cat)[1]) + "' 지웠어요", { label: "되돌리기", fn: () => {
          const a = inShared ? state.settle.expenses : state.myExp;
          if (!a.some((x) => x.id === id)) a.splice(Math.min(i, a.length), 0, it);
          save(); render();
        } }, 5000);
        return;
      }
      case "settle-save": {
        const rate = parseFloat(String($("#mRate").value).replace(/[,\s]/g, ""));
        state.settle.rate = rate > 0 ? rate : 0;
        save(); render(); toast("저장했어요");
        return;
      }
      case "li-add": {
        const key = t.getAttribute("data-list"), inp = document.getElementById("add-" + key), v = inp ? inp.value.trim() : "";
        if (!v) { if (inp) inp.focus(); return; }
        ckAdd(key, v, ckMineOn);
        save(); render(); ckSheet(key);
        const again = document.getElementById("add-" + key); if (again) again.focus();
        return;
      }
      case "ck-mine": ckMineOn = !ckMineOn; { const k = t.getAttribute("data-list"), inp = document.getElementById("add-" + k), v = inp ? inp.value : ""; ckSheet(k); const again = document.getElementById("add-" + k); if (again) { again.value = v; again.focus(); } } return;
      case "li-mine": { const k = t.getAttribute("data-list"), r = ckMove(k, id); save(); render(); ckSheet(k); if (r) toast(r === "나만" ? "이제 내 폰에만 보여요" : "이제 친구 폰에도 보여요"); return; }
      case "li-edit": { /* the words turn into a box right there; Enter or tapping away saves */
        const key = t.getAttribute("data-list"), x = ckList(key).find((y) => y.id === id);
        const row = sheet.querySelector('.cklist .sli[data-id="' + id + '"]'), words = row && row.querySelector(".ck-t");
        ckMenuClose();
        const sc = row && row.querySelector(".sli-sc"); if (sc) sc.scrollLeft = 0;
        if (!x || !words) return;
        const inp = document.createElement("input");
        inp.className = "ck-edit"; inp.value = x.t; inp.setAttribute("enterkeyhint", "done"); inp.setAttribute("aria-label", "고치기");
        words.replaceWith(inp);
        inp.focus(); inp.select();
        let over = false;
        const done = (ok) => {
          if (over) return;
          over = true;
          const v = inp.value.trim();
          if (ok && v && v !== x.t) { x.t = v; save(); render(); toast("고쳤어요"); }
          const tmp = document.createElement("div"); tmp.innerHTML = ckWords(key, x);
          if (inp.isConnected) inp.replaceWith(tmp.firstChild);
        };
        inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); done(true); } else if (ev.key === "Escape") done(false); });
        inp.addEventListener("blur", () => done(true));
        return;
      }
      case "li-del": ckDelUndo(t.getAttribute("data-list"), id); return;
      case "copy": copyText(t.getAttribute("data-v"), "복사했어요: " + t.getAttribute("data-v")); return;
      case "info-add": infoSheet(null); return;
      case "info-edit": infoSheet(id); return;
      case "memo-add": memoSheet(); return;
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
      case "reset": resetSheet(); return;
      case "app-update": {
        if (!swReg) { location.reload(); return; }
        wantUpd = true; toast("새 버전 찾는 중…");
        swReg.update().then(() => { setTimeout(() => { if (!swReg.installing && !swReg.waiting) { wantUpd = false; toast("지금이 최신 버전이에요"); } }, 2500); }).catch(() => { wantUpd = false; toast("인터넷 연결을 확인해 주세요"); });
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
      const key = ckKeyOf(id);
      if (key) {
        const list = ckList(key), n = list.filter((x) => state.done[x.id]).length;
        document.querySelectorAll('[data-prog="' + key + '"] i').forEach((i) => { i.style.width = (list.length ? (n / list.length) * 100 : 0) + "%"; });
        document.querySelectorAll('[data-count="' + key + '"]').forEach((c) => { c.textContent = n + " / " + list.length; });
      }
      return;
    }
    if (t.hasAttribute("data-settle")) {
      const x = state.settle.expenses.find((y) => y.id === t.getAttribute("data-settle"));
      if (x) { if (t.checked) x.settled = true; else delete x.settled; save(); render(); }
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
    if (t.getAttribute("data-change") === "trip-title") {
      const v = t.value.trim();
      if (v && v !== tripTitle()) { state.trip.title = v; state.trip.nights = ""; save(); toast("여행 제목을 바꿨어요"); }
      else t.value = tripTitle();
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
  window.addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => { if (ui.tab === "plan") { fitPlan(); drawMap(); } if (ui.tab === "home") fitHero(); }, 150); });

  /* ---------- start ---------- */
  /* pinch-zoom only ever showed the page edges; the app is laid out for the phone already */
  ["gesturestart", "gesturechange"].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  /* pulling past the top shows the top colour, past the bottom the bottom colour: the page's own (html) background
     switches by where you are, or, on a page too short to scroll, by which way the finger moves */
  let edgeY = 0;
  document.addEventListener("touchstart", (e) => { edgeY = e.touches[0].clientY; }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (document.documentElement.scrollHeight - window.innerHeight > 24) return;
    const dy = e.touches[0].clientY - edgeY;
    if (Math.abs(dy) > 3) setEdge(dy < 0);
  }, { passive: true });
  window.addEventListener("scroll", edgeByScroll, { passive: true });
  const setAppH = () => { document.documentElement.style.setProperty("--app-h", window.innerHeight + "px"); };
  setAppH();
  window.addEventListener("resize", setAppH);
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = ICON[el.getAttribute("data-icon")] || ""; });
  applyTheme();
  render();
  takeInviteFromUrl();
  if (sync.code) setTimeout(syncNow, 400);
  setTimeout(locateMissing, 5000); /* places added without a pin (or by a friend whose phone was offline) get one */
  /* fetch every place picture once in the background so the service worker keeps it: opening a card later shows it at once, offline too */
  function warmPictures() {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller || navigator.onLine === false) return;
    const urls = [];
    state.days.forEach((d) => d.stops.forEach((st) => [st].concat(st.spots || []).forEach((x) => { if (x.img && urls.indexOf(x.img) < 0) urls.push(x.img); })));
    urls.reduce((pr, u) => pr.then(() => new Promise((ok) => { const im = new Image(); im.referrerPolicy = "no-referrer"; im.onload = im.onerror = () => ok(); im.src = u; setTimeout(ok, 8000); })), Promise.resolve());
  }
  setTimeout(warmPictures, 3000);
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (ui.tab === "plan") { fitPlan(); drawMap(); } }); } catch (e) {}
  setInterval(applyTheme, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { applyTheme(); if (ui.tab === "home" && !editing) render(); } });
  if (mqDark) { try { mqDark.addEventListener("change", applyTheme); } catch (e) { try { mqDark.addListener(applyTheme); } catch (e2) {} } }

  let swReg = null, wantUpd = false;
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    let updReady = false;
    const opened = Date.now();
    navigator.serviceWorker.register("sw.js").then((reg) => {
      swReg = reg;
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            updReady = true;
            /* just opened (or asked for it): nothing is in progress yet, so switch at once */
            if ((Date.now() - opened < 12000 || wantUpd) && sheet.hidden && !editing) { location.reload(); return; }
            toast("새 버전이 있어요", { label: "새로고침", fn: () => location.reload() }, 15000);
          }
        });
      });
      /* a home-screen app is rarely reloaded, so look for a new version whenever it comes back to the front (and now and then) */
      const check = () => { try { reg.update(); } catch (e) {} };
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) return;
        const ed = document.getElementById("ske");
        if (updReady && sheet.hidden && !(ed && !ed.hidden) && !editing) { location.reload(); return; } /* coming back to the app: a good moment to switch */
        check();
      });
      setInterval(check, 30 * 60 * 1000);
      check();
    }).catch(() => {});
  }
})();
