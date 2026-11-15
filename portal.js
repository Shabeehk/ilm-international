/* ILM International — Learning Portal (login, student app, parent report, certificates) */
(function () {
  'use strict';

  // ---------------------------------------------------------------- setup
  var cfg = window.ILM_CONFIG || {};
  var ready = !!(cfg.SUPABASE_URL && cfg.SUPABASE_KEY && !/YOUR-PROJECT/.test(cfg.SUPABASE_URL) && !/YOUR-PUBLIC/.test(cfg.SUPABASE_KEY));
  var sb = ready && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY) : null;
  var app = document.getElementById('app');
  var TOKEN_KEY = 'ilm_student_token', LANG_KEY = 'ilm_lang', PARENT_LANG_KEY = 'ilm_parent_lang';
  var WHATSAPP = '905518881481';

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  // ------------------------------------------------------------ language
  // Safety net: a browser may still hold an older copy of portal.html that does not load the
  // wording file. In that case fetch it here, so nobody ever sees raw labels like "login_title".
  if (!window.ILM_T) {
    try { var wx = new XMLHttpRequest(); wx.open('GET', 'portal-i18n.js', false); wx.send(); if (wx.status === 200) (0, eval)(wx.responseText); } catch (e) {}
  }
  var T = window.ILM_T || { en: {} }, LANGS = window.ILM_LANGS || { en: 'English' }, LOCALE = window.ILM_LOCALE || {};
  var LANG = 'en';
  function useLang(l, remember) {
    LANG = LANGS[l] ? l : 'en';
    document.documentElement.lang = LANG;
    document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
    if (remember) store.set(LANG_KEY, LANG);
  }
  function t(key, vars) {
    var s = (T[LANG] && T[LANG][key]) || T.en[key] || key;
    // names and IDs are wrapped in direction marks so they sit correctly inside Arabic sentences
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(k === 'name' || k === 'code' ? '\u2068' + vars[k] + '\u2069' : vars[k]); });
    return s;
  }
  function te(key, vars) { return esc(t(key, vars)); }
  function badgeText(code) { return ((T[LANG] && T[LANG].badges_list) || T.en.badges_list)[code] || T.en.badges_list[code] || [code, '']; }
  function skillText(code) { return ((T[LANG] && T[LANG].skills) || T.en.skills)[code] || T.en.skills[code] || code; }
  useLang(store.get(LANG_KEY) || 'en');

  // ------------------------------------------------------------- helpers
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // arrows point the other way in right-to-left languages
  function icon(name, cls) { return '<svg class="ic ' + (name === 'next' || name === 'back' ? 'dir ' : '') + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function pattern(dark) { return '<svg class="pattern" aria-hidden="true"><rect width="100%" height="100%" fill="url(#ilm-pat' + (dark ? '-d' : '') + ')"/></svg>'; }
  function brand(onDark) {
    return '<a class="brand' + (onDark ? ' on-dark' : '') + '" href="index.html" dir="ltr"><svg aria-hidden="true" style="color:' + (onDark ? '#fff' : '#0E4B43') + '"><use href="#i-mark"/></svg><span><b>ILM</b><small>INTERNATIONAL</small></span></a>';
  }
  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function avatar(name, n, cls, photo) {
    if (photo && /^data:image\/(jpeg|png|webp);base64,/.test(photo)) return '<img class="avatar ' + (cls || '') + '" src="' + esc(photo) + '" alt="">';
    return '<span class="avatar av' + (n || 1) + ' ' + (cls || '') + '" aria-hidden="true">' + esc(initials(name)) + '</span>';
  }
  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }
  function toDate(d) { return new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T00:00:00' : d); }
  function fmtDate(d) {
    if (!d) return '';
    var dt = toDate(d);
    if (isNaN(dt)) return '';
    try { return dt.toLocaleDateString(LOCALE[LANG] || 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  }
  function money(amount, currency) {
    try { return new Intl.NumberFormat('en', { style: 'currency', currency: currency || 'USD' }).format(Number(amount) || 0); }
    catch (e) { return (currency || '') + ' ' + (Number(amount) || 0).toFixed(2); }
  }
  function monthName(period) {
    var d = new Date(period + '-01T00:00:00');
    if (isNaN(d)) return period;
    try { return d.toLocaleDateString(LOCALE[LANG] || 'en-GB', { month: 'long', year: 'numeric' }); }
    catch (e) { return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }
  function waLink(number, text) { return 'https://wa.me/' + String(number || '').replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(text || ''); }
  function portalUrl() { return location.origin + location.pathname; }

  function toast(msg, kind) {
    var box = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || 'good');
    el.innerHTML = (kind === 'bad' ? icon('x') : icon('check')) + '<span>' + esc(msg) + '</span>';
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(function () { el.remove(); }, kind === 'bad' ? 6000 : 3200);
  }
  function fail(e) { toast(e && e.message ? e.message : t('err_generic'), 'bad'); }

  function friendly(error) {
    var m = (error && error.message) || '';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return t('err_net');
    if (/permission denied|not find the function|schema cache/i.test(m)) return 'The portal database needs its update. Please run the setup file again in Supabase.';
    if (/Invalid login credentials/i.test(m)) return 'That email or password is not right.';
    if (/already registered/i.test(m)) return 'This email already has an account. Please sign in instead.';
    if (/Email not confirmed/i.test(m)) return 'Please open the confirmation email we sent you, then sign in.';
    if (/at least 6 characters|Password should/i.test(m)) return 'Please choose a password with at least 6 characters.';
    if (/report link is not valid/i.test(m)) return t('link_bad_p');
    return m || t('err_generic');
  }
  async function rpc(fn, args) {
    var out = await sb.rpc(fn, args || {});
    if (out.error) {
      if (/SESSION_EXPIRED/.test(out.error.message || '')) {
        store.del(TOKEN_KEY);
        showLogin(t('session'));
        var e = new Error(t('session')); e.silent = true; throw e;
      }
      throw new Error(friendly(out.error));
    }
    return out.data;
  }
  async function busy(btn, work) {
    if (btn) { if (btn.classList.contains('busy')) return; btn.classList.add('busy'); }
    try { return await work(); }
    catch (e) { if (!e || !e.silent) fail(e); }
    finally { if (btn) btn.classList.remove('busy'); }
  }
  function loading(text) { app.innerHTML = '<div class="loading"><div><i></i>' + esc(text || t('loading')) + '</div></div>'; }

  // click + form routing
  var actions = {}, forms = {};
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var fn = actions[el.dataset.act];
    if (fn) { if (el.tagName !== 'A' || el.getAttribute('href') === '#') e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    var data = {};
    new FormData(f).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
    var fn = forms[f.dataset.form];
    if (fn) fn(f, data, f.querySelector('button[type=submit],button:not([type])'));
  });

  // modal
  function modal(html, wide) {
    closeModal();
    var m = document.createElement('div');
    m.className = 'modal'; m.id = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="box' + (wide ? ' wide' : '') + '">' + html + '</div>';
    m.addEventListener('mousedown', function (e) { if (e.target === m) closeModal(); });
    document.body.appendChild(m);
    var first = m.querySelector('input:not([type=hidden]),select,textarea,button');
    if (first) first.focus();
    return m;
  }
  function closeModal() { var m = document.getElementById('modal'); if (m) m.remove(); }
  actions.closeModal = closeModal;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  function copyText(text, label) {
    var done = function () { toast((label || 'Copied') + ' — ready to paste'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { prompt('Copy this:', text); });
    else prompt('Copy this:', text);
  }
  actions.copy = function (el) { copyText(el.dataset.text, el.dataset.label); };

  var BADGE_ICONS = { first_step: 'play', steady_learner: 'book', book_lover: 'heart', bright_star: 'star', unit_champion: 'award', homework_hero: 'pen', stars_25: 'sun', stars_50: 'sun', stars_100: 'sun', level_graduate: 'cap' };
  var SKILL_CODES = ['quran', 'memorisation', 'salah', 'akhlaq', 'participation'];
  function badgesHtml(owned, showLocked) {
    var html = Object.keys(BADGE_ICONS).filter(function (c) { return showLocked || owned.indexOf(c) >= 0; }).map(function (c) {
      var b = badgeText(c), has = owned.indexOf(c) >= 0, ic = BADGE_ICONS[c];
      return '<div class="badge' + (has ? '' : ' off') + '"><div class="medal">' + icon(has ? ic : 'lock', has && ic === 'star' ? 'fill' : '') + '</div><b>' + esc(b[0]) + '</b><span>' + esc(b[1]) + '</span></div>';
    }).join('');
    return html ? '<div class="badges">' + html + '</div>' : '';
  }
  function dots5(n) { var s = ''; for (var i = 1; i <= 5; i++) s += '<i class="' + (i <= n ? 'on' : '') + '"></i>'; return '<span class="dots5" role="img" aria-label="' + n + ' / 5">' + s + '</span>'; }

  function confetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = document.createElement('div'); c.className = 'confetti';
    var colors = ['#F2B632', '#0E6B5E', '#2B7DB0', '#C2572B', '#fff'];
    for (var i = 0; i < 36; i++) {
      var p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * 0.6 + 's';
      p.style.animationDuration = 1.8 + Math.random() * 1.2 + 's';
      c.appendChild(p);
    }
    document.body.appendChild(c);
    setTimeout(function () { c.remove(); }, 3600);
  }


  // ------------------------------------------------- class times + reminders
  function loc() { return LOCALE[LANG] || 'en-GB'; }
  function dayKey(d) { return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function whenParts(iso) {
    var d = new Date(iso), now = new Date(), tom = new Date(now.getTime() + 864e5), day, time;
    try { time = d.toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit' }); } catch (e) { time = d.toLocaleTimeString(); }
    if (dayKey(d) === dayKey(now)) day = t('today');
    else if (dayKey(d) === dayKey(tom)) day = t('tomorrow');
    else { try { day = d.toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { day = d.toDateString(); } }
    return { day: day, time: time };
  }
  function span(mins) {
    if (mins >= 2880) return t('t_days', { n: Math.floor(mins / 1440) });
    if (mins >= 60) return t('t_hm', { h: Math.floor(mins / 60), m: mins % 60 });
    return t('t_m', { m: Math.max(1, mins) });
  }
  // later | soon (15 minutes before) | live | over
  function classState(m) {
    var start = new Date(m.starts_at).getTime(), end = start + (m.minutes || 45) * 60000, now = Date.now();
    if (now >= end) return { state: 'over', text: '' };
    if (now >= start) return { state: 'live', text: t('live_now') };
    var mins = Math.ceil((start - now) / 60000);
    return { state: mins <= 15 ? 'soon' : 'later', text: t('starts_in', { t: span(mins) }), mins: mins };
  }
  // every 30 seconds: refresh the countdowns on screen
  var ticker = null, onTick = null;
  function every(fn) { onTick = fn; if (!ticker) ticker = setInterval(function () { if (onTick) onTick(); }, 30000); }

  var push = {
    ios: function () { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },
    standalone: function () { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; },
    supported: function () { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
    // show the switch at all? (on iPhone outside the home-screen app we show it and explain the extra step)
    offer: function () { return push.supported() || push.ios(); },
    current: async function () {
      if (!push.supported()) return null;
      try { var reg = await navigator.serviceWorker.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; } catch (e) { return null; }
    },
    on: async function (api) {
      if (!push.supported()) { var e = new Error(t('remind_unsupported')); e.ios = push.ios() && !push.standalone(); throw e; }
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error(t('remind_blocked'));
      var res, j = {};
      try { res = await fetch(String(api || '').replace(/\/+$/, '') + '/api/push/key'); } catch (e) { throw new Error(t('err_net')); }
      j = await res.json().catch(function () { return {}; });
      if (!j.ok) throw new Error(j.error || t('err_generic'));
      var reg = await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub && sub.options && sub.options.applicationServerKey && b64u(sub.options.applicationServerKey) !== j.key) { await sub.unsubscribe(); sub = null; }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(j.key) });
      return sub.toJSON();
    },
    off: async function () { var sub = await push.current(); if (!sub) return null; var j = sub.toJSON(); try { await sub.unsubscribe(); } catch (e) {} return j; },
    test: async function (api) {
      var sub = await push.current(); if (!sub) throw new Error(t('remind_unsupported'));
      var res = await fetch(String(api || '').replace(/\/+$/, '') + '/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      var j = await res.json().catch(function () { return {}; });
      if (!j.ok) throw new Error(j.error || t('err_generic'));
    }
  };
  function b64u(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), out = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; }

  // The page that shows a reminder switch says how to save it (student, parent or teacher).
  var remind = { api: '', save: null };
  function remindRow() {
    if (!push.offer()) return '';
    return '<div class="remind-row" id="remindRow">' + remindOffHtml() + '</div>';
  }
  async function paintRemind() {
    var row = document.getElementById('remindRow'); if (!row) return;
    var sub = await push.current();
    row.innerHTML = sub
      ? icon('check') + '<span class="grow">' + te('remind_on') + '</span><button class="btn ghost sm" data-act="remindTest">' + te('remind_test') + '</button><button class="btn ghost sm" data-act="remindOff">' + te('remind_off') + '</button>'
      : remindOffHtml();
  }
  function remindOffHtml() { return icon('bell') + '<span class="grow">' + te('remind_me') + '</span><button class="btn sm" data-act="remindOn">' + te('remind_turn_on') + '</button>'; }
  actions.remindOn = function (el) {
    busy(el, async function () {
      var sub;
      try { sub = await push.on(remind.api); }
      catch (e) {
        if (e.ios) return modal('<h2>' + te('ios_h') + '</h2><div class="row nw" style="align-items:flex-start">' + icon('share') + '<p>' + te('ios_p') + '</p></div><div class="foot"><button class="btn" data-act="closeModal">' + te('close') + '</button></div>');
        throw e;
      }
      await remind.save(sub, true);
      toast(t('remind_ok')); paintRemind();
    });
  };
  actions.remindOff = function (el) {
    busy(el, async function () { var sub = await push.off(); if (sub) await remind.save(sub, false).catch(function () {}); paintRemind(); });
  };
  actions.remindTest = function (el) { busy(el, async function () { await push.test(remind.api); toast(t('remind_test_ok')); }); };

  // the "next class" card for students and parents
  function nextClassCard(M, cls, who) {
    var list = (M && M.meetings || []).filter(function (m) { return classState(m).state !== 'over'; });
    var teacher = M && M.teacher, m = list[0];
    var tmini = teacher ? '<div class="teacher-mini">' + avatar(teacher.name, 2, '', teacher.photo) + '<div><b dir="auto">' + esc(teacher.name) + '</b><span class="small muted">' + te(who === 'parent' ? 'teacher' : 'teacher_card') + '</span></div></div>' : '';
    if (!m) {
      if (!cls) return '';
      var link0 = safeUrl(cls.meet_link);
      return '<section class="nextclass" id="nextClass"><div class="row"><div class="grow"><span class="eyebrow">' + te('live_class') + '</span><div class="nc-title" dir="auto">' + esc(cls.name) + '</div>' + (cls.schedule ? '<p class="small muted" dir="auto">' + esc(cls.schedule) + '</p>' : '') + '</div></div>' +
        '<div class="row">' + tmini + '<span class="grow"></span>' + (link0 ? '<a class="btn" href="' + esc(link0) + '" target="_blank" rel="noopener">' + icon('video') + te('join_class') + '</a>' : '<span class="chip grey">' + te('link_soon') + '</span>') + '</div></section>';
    }
    var st = classState(m), w = whenParts(m.starts_at), link = safeUrl(m.link);
    return '<section class="nextclass ' + st.state + '" id="nextClass" data-start="' + esc(m.starts_at) + '" data-min="' + m.minutes + '">' +
      '<div class="row" style="align-items:flex-start"><div class="grow"><span class="eyebrow">' + te('next_class') + '</span><div class="nc-when">' + esc(w.day) + ' · <span dir="ltr">' + esc(w.time) + '</span></div>' +
      '<div class="nc-title" dir="auto">' + esc([m.title, m.class_name].filter(Boolean).join(' · ')) + '</div>' + (m.note ? '<p class="small muted" dir="auto">' + esc(m.note) + '</p>' : '') + '</div>' +
      '<span class="countdown" data-cd>' + esc(st.text) + '</span></div>' +
      '<div class="row">' + tmini + '<span class="grow"></span>' + (link ? '<a class="btn ' + (st.state === 'later' ? '' : 'gold big') + '" data-join href="' + esc(link) + '" target="_blank" rel="noopener">' + icon('video') + te(st.state === 'later' ? 'join_class' : 'join_now') + '</a>' : '<span class="chip grey">' + te('link_soon') + '</span>') + '</div>' +
      (list.length > 1 ? '<div class="upcoming"><span class="small muted" style="font-weight:700">' + te('coming_up') + '</span>' + list.slice(1, 4).map(function (x) { var p = whenParts(x.starts_at); return '<div class="u"><b>' + esc(p.day) + '</b><span dir="ltr">' + esc(p.time) + '</span><span class="muted grow" dir="auto">' + esc(x.title || '') + '</span></div>'; }).join('') + '</div>' : '') +
      remindRow() + '<p class="small muted">' + te('time_note') + '</p></section>';
  }
  function liveBanner(list, joinLabel) {
    var m = (list || []).filter(function (x) { return classState(x).state !== 'over'; })[0];
    if (!m) return '';
    var st = classState(m), link = safeUrl(m.link);
    if (st.state === 'later' || (st.state === 'soon' && st.mins > 10) || !link) return '';
    return '<div class="live-banner ' + st.state + '" id="liveBanner">' + icon(st.state === 'live' ? 'video' : 'bell') + '<span>' + esc(st.state === 'live' ? t('live_now') : t('class_soon_banner', { title: m.title || m.class_name, t: span(st.mins) })) + '</span><a class="btn sm" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(joinLabel || t('join_now')) + '</a></div>';
  }
  // refresh countdowns without redrawing the page; returns true when a class has just finished
  function tickCards(list) {
    var card = document.getElementById('nextClass');
    if (card && card.dataset.start) {
      var st = classState({ starts_at: card.dataset.start, minutes: Number(card.dataset.min) });
      if (st.state === 'over') return true;
      card.className = 'nextclass ' + st.state;
      var cd = card.querySelector('[data-cd]'); if (cd) cd.textContent = st.text;
      var j = card.querySelector('[data-join]'); if (j && st.state !== 'later') { j.className = 'btn gold big'; j.lastChild.textContent = t('join_now'); }
    }
    var old = document.getElementById('liveBanner'), html = liveBanner(list), holder = document.getElementById('bannerSlot');
    if (holder) holder.innerHTML = html; else if (old && !html) old.remove();
    return false;
  }

  // language picker (login page, student app, parent page)
  var afterLang = null;
  function langButton(cls) { return '<button class="btn ghost sm ' + (cls || '') + '" data-act="pickLang" aria-label="' + te('language') + '">' + icon('globe') + '<span>' + esc(LANGS[LANG]) + '</span></button>'; }
  actions.pickLang = function () {
    modal('<h2>' + te('pick_language') + '</h2><div class="langs">' + Object.keys(LANGS).map(function (l) {
      return '<button class="opt" data-act="setLang" data-lang="' + l + '" aria-pressed="' + (l === LANG) + '" lang="' + l + '" dir="' + (l === 'ar' ? 'rtl' : 'ltr') + '"><span class="k">' + l.toUpperCase() + '</span><span>' + esc(LANGS[l]) + '</span></button>';
    }).join('') + '</div><div class="foot"><button class="btn ghost" data-act="closeModal">' + te('close') + '</button></div>');
  };
  actions.setLang = function (el) { closeModal(); if (afterLang) afterLang(el.dataset.lang); };

  // ---------------------------------------------------------------- login
  var loginTab = 'student';
  function showLogin(message) {
    document.body.className = '';
    document.title = 'Learning Portal · ILM International';
    afterLang = function (l) { useLang(l, true); showLogin(); };
    app.innerHTML =
      '<div class="login"><section class="login-art">' + pattern() +
      '<div style="position:relative">' + brand(true) + '</div>' +
      '<div style="position:relative;display:grid;gap:14px"><h1>' + te('hero_h') + '</h1><p>' + te('hero_p') + '</p></div>' +
      '<div class="levels">' +
      '<div class="lv"><span class="ar" lang="ar">نور</span><div><b>Noor · ' + te('ages', { a: 5, b: 7 }) + '</b><span>' + te('lv1_sub') + '</span></div></div>' +
      '<div class="lv"><span class="ar" lang="ar">هدى</span><div><b>Huda · ' + te('ages', { a: 8, b: 10 }) + '</b><span>' + te('lv2_sub') + '</span></div></div>' +
      '<div class="lv"><span class="ar" lang="ar">حكمة</span><div><b>Hikmah · ' + te('ages', { a: 11, b: 13 }) + '</b><span>' + te('lv3_sub') + '</span></div></div>' +
      '</div></section>' +
      '<section class="login-main"><div class="login-box">' +
      '<div class="row"><div class="grow"><h2>' + te('login_title') + '</h2><p class="muted">' + te('login_welcome') + '</p></div>' + langButton() + '</div>' +
      (message ? '<p class="note" style="margin-top:14px">' + esc(message) + '</p>' : '') +
      '<div class="tabs" role="tablist">' +
      '<button class="tab" role="tab" data-act="loginTab" data-tab="student" aria-selected="' + (loginTab === 'student') + '">' + icon('star', 'fill') + te('tab_student') + '</button>' +
      '<button class="tab" role="tab" data-act="loginTab" data-tab="staff" aria-selected="' + (loginTab !== 'student') + '">' + icon('users') + te('tab_staff') + '</button></div>' +
      '<div id="loginPane">' + loginPane() + '</div>' +
      '<p class="small muted" style="margin-top:22px">' + te('parents_hint') + ' ' +
      '<a href="' + esc(waLink(WHATSAPP, 'Assalamu alaykum, I need help with the ILM International portal.')) + '" target="_blank" rel="noopener">' + te('need_help') + '</a></p>' +
      '</div></section></div>';
  }
  function loginPane() {
    if (!ready) return '<div class="info"><b>' + te('not_ready_h') + '</b><br>' + te('not_ready_p') + '</div>';
    if (loginTab === 'student') {
      return '<form class="stack" data-form="studentLogin" autocomplete="off">' +
        '<label class="f">' + te('student_id') + ' <span class="hint">' + te('student_id_hint') + '</span>' +
        '<input class="code-input" type="text" name="code" placeholder="ILM-1234" maxlength="10" autocapitalize="characters" dir="ltr" value="' + esc(store.get('ilm_last_code') || '') + '" required></label>' +
        '<label class="f">' + te('pin') + ' <span class="hint">' + te('pin_hint') + '</span>' +
        '<input class="pin-input" type="password" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••••" dir="ltr" required></label>' +
        '<div class="err" id="loginErr" hidden></div>' +
        '<button class="btn big block" type="submit">' + te('lets_learn') + '</button></form>';
    }
    var up = loginTab === 'signup';   // the teacher side of the portal is in English
    return '<form class="stack" data-form="staffLogin" dir="ltr" lang="en">' +
      (up ? '<label class="f">Your full name<input type="text" name="full_name" autocomplete="name" required></label>' : '') +
      '<label class="f">Email<input type="email" name="email" autocomplete="email" required></label>' +
      '<label class="f">Password<input type="password" name="password" autocomplete="' + (up ? 'new-password' : 'current-password') + '" minlength="6" required></label>' +
      '<div class="err" id="loginErr" hidden></div>' +
      '<button class="btn big block" type="submit">' + (up ? 'Create my teacher account' : 'Sign in') + '</button>' +
      '<p class="small center">' + (up
        ? 'Already have an account? <button type="button" class="linkbtn" data-act="loginTab" data-tab="staff">Sign in</button>'
        : 'New teacher? <button type="button" class="linkbtn" data-act="loginTab" data-tab="signup">Create an account</button> · <button type="button" class="linkbtn" data-act="forgot">Forgot password</button>') + '</p>' +
      (up ? '<p class="small muted center">After you sign up, the academy admin approves your account.</p>' : '') +
      '</form>';
  }
  function loginError(msg, pane) { if (pane && pane !== loginTab) return; var e = document.getElementById('loginErr'); if (e) { e.textContent = msg; e.hidden = false; } }
  actions.loginTab = function (el) {
    loginTab = el.dataset.tab;
    document.querySelectorAll('.tab').forEach(function (x) { x.setAttribute('aria-selected', String(x.dataset.tab === (loginTab === 'signup' ? 'staff' : loginTab))); });
    document.getElementById('loginPane').innerHTML = loginPane();
    var f = document.querySelector('#loginPane input'); if (f) f.focus();
  };
  forms.studentLogin = function (f, d, btn) {
    busy(btn, async function () {
      var out = await rpc('ilm_student_login', { p_code: d.code, p_pin: d.pin });
      if (!out.ok) return loginError(/Too many/i.test(out.error || '') ? t('err_locked') : t('err_login'), 'student');
      store.set(TOKEN_KEY, out.token);
      store.set('ilm_last_code', String(d.code || '').toUpperCase());
      await studentHome(true);
    });
  };
  forms.staffLogin = function (f, d, btn) {
    var pane = loginTab;
    busy(btn, async function () {
      var out;
      if (pane === 'signup') {
        out = await sb.auth.signUp({ email: d.email, password: d.password, options: { data: { full_name: d.full_name }, emailRedirectTo: portalUrl() } });
        if (out.error) return loginError(friendly(out.error), pane);
        if (!out.data.session) { loginTab = 'staff'; return showLogin('Almost done! Open the confirmation email we just sent you, then sign in here.'); }
      } else {
        out = await sb.auth.signInWithPassword({ email: d.email, password: d.password });
        if (out.error) return loginError(friendly(out.error), pane);
      }
      await startStaff();
    });
  };
  actions.forgot = function () {
    var email = (document.querySelector('#loginPane input[name=email]') || {}).value;
    if (!email) return loginError('Type your email above first, then press "Forgot password".');
    sb.auth.resetPasswordForEmail(email, { redirectTo: portalUrl() }).then(function () {
      toast('If that email has an account, a reset link is on its way.');
    });
  };
  forms.newPassword = function (f, d, btn) {
    busy(btn, async function () {
      var out = await sb.auth.updateUser({ password: d.password });
      if (out.error) throw new Error(friendly(out.error));
      closeModal(); toast('Your new password is saved.');
    });
  };

  async function startStaff() {
    useLang('en');                      // the dashboard itself is in English
    loading('Opening your dashboard…');
    var me = await rpc('ilm_me');
    if (!me) { useLang(store.get(LANG_KEY) || 'en'); return showLogin(); }
    if (!me.approved) return showPending(me);
    document.body.className = 'staff';
    return window.ILM.staffStart(me);
  }
  function showPending(me) {
    document.body.className = '';
    app.innerHTML = '<div class="login-main" style="min-height:100vh"><div class="login-box center stack">' +
      '<div style="justify-self:center">' + brand() + '</div>' +
      '<h2>Thank you, ' + esc(firstName(me.full_name)) + '!</h2>' +
      '<p>Your teacher account has been created. The academy admin needs to approve it before you can open the dashboard.</p>' +
      '<p class="muted small">Signed in as ' + esc(me.email || '') + '</p>' +
      '<div class="row" style="justify-content:center"><button class="btn" data-act="recheck">Check again</button>' +
      '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(waLink(WHATSAPP, 'Assalamu alaykum, I have created my teacher account on the ILM portal (' + (me.email || '') + '). Please approve it.')) + '">' + icon('wa') + 'Tell the admin</a>' +
      '<button class="btn ghost" data-act="staffLogout">Sign out</button></div></div></div>';
  }
  actions.recheck = function (el) { busy(el, startStaff); };
  actions.staffLogout = function () { sb.auth.signOut().then(function () { loginTab = 'staff'; useLang(store.get(LANG_KEY) || 'en'); showLogin(); }); };

  // -------------------------------------------------------------- student
  var S = null;   // the student's home data
  function token() { return store.get(TOKEN_KEY); }

  function prepPath(units) {
    var nowSet = false;
    units.forEach(function (u) {
      var prevRead = true;
      u.lessons.forEach(function (l) {
        l.open = prevRead;
        if (l.open && !l.read && !nowSet) { l.now = true; nowSet = true; }
        prevRead = l.read;
      });
      u.read = u.lessons.filter(function (l) { return l.read; }).length;
      u.allRead = u.lessons.length > 0 && u.read === u.lessons.length;
      u.done = !!(u.exam && u.exam.passed);
    });
    return units;
  }
  function nextUp() {
    // unit by unit: finish the lessons, then the unit exam, before moving on
    for (var i = 0; i < S.units.length; i++) {
      var u = S.units[i];
      for (var j = 0; j < u.lessons.length; j++) {
        if (u.lessons[j].now) return { kind: 'lesson', id: u.lessons[j].id, title: u.lessons[j].title, label: t(S.stats.read ? 'next_lesson' : 'start_here'), unit: u.title };
      }
      if (u.allRead && !u.done) return { kind: 'exam', id: u.id, title: u.title, label: t('exam_ready'), unit: t('show_learned') };
    }
    return null;
  }

  async function studentHome(top) {
    if (!S) loading();
    var both = await Promise.all([
      rpc('ilm_student_home', { p_token: token() }),
      // older databases do not have the class schedule yet: the page still works without it
      sb.rpc('ilm_student_meetings', { p_token: token() }).then(function (r) { return r.error ? null : r.data; }, function () { return null; })
    ]);
    var data = both[0];
    S = data; S.meet = both[1];
    useLang(S.student.lang || 'en', true);
    prepPath(S.units);
    var total = 0, read = 0, passedUnits = 0;
    S.units.forEach(function (u) { total += u.lessons.length; read += u.read; if (u.done) passedUnits++; });
    S.stats = { total: total, read: read, units: passedUnits };
    renderStudentHome();
    if (top) window.scrollTo(0, 0);
  }

  function nodeHtml(l, n) {
    var cls = l.passed ? 'passed' : l.read ? 'read' : l.now ? 'now' : '';
    var sub = !l.open ? t('node_locked')
      : l.passed ? (l.best_score === l.total ? t('node_perfect') : t('node_passed', { a: l.best_score, b: l.total }))
      : l.read ? t(l.attempts ? 'node_retry' : 'node_quiz')
      : t('minutes', { n: l.minutes });
    return '<li><button class="node ' + cls + '" data-act="openLesson" data-id="' + l.id + '"' + (l.open ? '' : ' disabled') + '>' +
      '<span class="dot">' + (l.passed ? icon('star', 'fill') : l.read ? icon('check') : l.open ? '<b>' + n + '</b>' : icon('lock')) + '</span>' +
      '<span class="grow"><b>' + esc(l.title) + '</b><span class="sub">' + esc(sub) + '</span></span>' +
      (l.open ? icon('next') : '') + '</button></li>';
  }
  function unitHtml(u, i) {
    var pct = u.lessons.length ? Math.round(100 * u.read / u.lessons.length) : 0;
    var ex = u.exam || {};
    var examSub = u.done ? t('exam_passed', { a: ex.best_score, b: ex.total }) : !u.allRead ? t('exam_locked') : t(ex.attempts ? 'exam_retry' : 'exam_ready_sub');
    var open = (u.allRead && !u.done) || u.lessons.some(function (l) { return l.now; });
    return '<details class="card unit' + (u.done ? ' done' : '') + '"' + (open ? ' open' : '') + '>' +
      '<summary class="unit-h"><span class="unit-n">' + (u.done ? icon('award') : (i + 1)) + '</span>' +
      '<div class="grow"><h3>' + esc(u.title) + '</h3><p class="small muted">' + esc(u.summary || '') + '</p>' +
      '<div class="bar' + (u.done ? ' gold' : '') + '" style="margin-top:8px" role="img" aria-label="' + u.read + ' / ' + u.lessons.length + '"><i style="width:' + pct + '%"></i></div></div>' + icon('chev', 'chev') + '</summary>' +
      '<ol class="nodes">' + u.lessons.map(function (l, n) { return nodeHtml(l, n + 1); }).join('') +
      '<li><button class="node exam ' + (u.done ? 'passed' : u.allRead ? 'now' : '') + '" data-act="openExam" data-id="' + u.id + '"' + (u.allRead ? '' : ' disabled') + '>' +
      '<span class="dot">' + icon(u.allRead ? 'award' : 'lock') + '</span><span class="grow"><b>' + te('unit_exam') + '</b><span class="sub">' + esc(examSub) + '</span></span>' + (u.allRead ? icon('next') : '') + '</button></li>' +
      '</ol></details>';
  }
  function homeworkHtml(h) {
    var body;
    if (h.submitted_at) {
      body = '<p class="small" dir="auto"><b>' + te('your_answer') + '</b> ' + esc(h.answer) + '</p>' +
        (h.reviewed
          ? '<div class="row"><span class="chip gold">' + icon('star', 'fill') + te('stars_from_teacher', { n: h.stars || 0 }) + '</span></div>' + (h.feedback ? '<p class="note" dir="auto">' + esc(h.feedback) + '</p>' : '')
          : '<span class="chip blue">' + te('sent_waiting') + '</span>');
    } else {
      body = '<form class="stack" data-form="sendHomework" style="gap:10px"><input type="hidden" name="id" value="' + esc(h.id) + '">' +
        '<label class="f"><span class="sr">' + te('your_answer') + '</span><textarea name="answer" dir="auto" placeholder="' + te('answer_ph') + '" required></textarea></label>' +
        '<div><button class="btn" type="submit">' + icon('pen') + te('send_teacher') + '</button></div></form>';
    }
    return '<div class="hw-item"><div class="row"><b class="grow" dir="auto">' + esc(h.title) + '</b>' + (h.due_date ? '<span class="chip grey">' + icon('calendar') + te('due', { date: fmtDate(h.due_date) }) + '</span>' : '') + '</div>' +
      (h.details ? '<p dir="auto">' + esc(h.details) + '</p>' : '') + body + '</div>';
  }

  function renderStudentHome() {
    var st = S.student, lv = S.level || {}, nx = nextUp(), cls = S.class;
    document.body.className = 'kid' + (lv.id === 1 ? ' lv1' : '');
    document.title = firstName(st.full_name) + ' · ILM International';
    afterLang = function (l) {
      useLang(l, true); S.student.lang = l; loading();
      rpc('ilm_student_lang', { p_token: token(), p_lang: l }).then(function () { return studentHome(); }).catch(fail);
    };
    var meetList = (S.meet && S.meet.meetings) || [];
    remind = { api: S.meet && S.meet.api, save: function (sub, on) { return rpc('ilm_student_push', { p_token: token(), p_sub: sub, p_on: on }); } };
    var pending = S.homework.filter(function (h) { return !h.submitted_at; }).length;

    app.innerHTML =
      '<header class="kid-top"><div class="in">' + brand() +
      '<span class="grow"></span><span class="stars-pill" title="' + te('your_stars') + '">' + icon('star', 'fill') + '<span id="starCount">' + S.stars + '</span></span>' +
      langButton('lang-btn') +
      '<button class="btn ghost sm" data-act="pickAvatar" aria-label="' + te('change_colour') + '" style="padding:2px;border-radius:50%;min-height:0;border:0">' + avatar(st.full_name, st.avatar) + '</button>' +
      '<button class="btn ghost sm" data-act="studentLogout" aria-label="' + te('log_out') + '">' + icon('logout') + '<span class="lbl">' + te('log_out') + '</span></button></div></header>' +
      '<main class="kid-wrap"><div id="bannerSlot">' + liveBanner(meetList) + '</div>' +

      '<section class="hello">' + pattern() +
      '<div style="position:relative"><span class="chip gold">' + esc(lv.name || '') + (lv.age_min ? ' · ' + te('ages', { a: lv.age_min, b: lv.age_max }) : '') + '</span></div>' +
      '<h1>' + te('hello', { name: firstName(st.full_name) }) + '</h1>' +
      '<p>' + (S.stats.read === 0 ? te('hello_new') : S.stats.read >= S.stats.total ? te('hello_all') : te('hello_progress', { a: S.stats.read, b: S.stats.total })) + '</p>' +
      (nx ? '<div class="next"><div class="grow"><span class="lbl">' + esc(nx.label) + '</span><b>' + esc(nx.title) + '</b><span class="small muted">' + esc(nx.unit) + '</span></div>' +
        '<button class="btn gold big" data-act="' + (nx.kind === 'lesson' ? 'openLesson' : 'openExam') + '" data-id="' + nx.id + '">' + icon('play', 'dir') + te(nx.kind === 'lesson' ? 'start' : 'take_exam') + '</button></div>' : '') +
      '</section>' +

      (S.meet ? nextClassCard(S.meet, cls, 'student') : cls ? oldClassCard(cls) : '') +
      '<section class="mini" id="miniStats"><div class="card"><b>' + S.stars + '</b><span>' + te('stars') + '</span></div>' +
      '<div class="card"><b dir="ltr">' + S.stats.read + '<span style="font-size:.5em;color:var(--muted)"> / ' + S.stats.total + '</span></b><span>' + te('lessons_read') + '</span></div>' +
      '<div class="card"><b>' + S.badges.length + '</b><span>' + te('badges') + '</span></div></section>' +


      (S.notes.length ? '<section class="card" style="background:var(--gold-l);box-shadow:none"><div class="row nw" style="align-items:flex-start">' + icon('heart') +
        '<div class="grow"><b>' + te('note_from', { name: S.notes[0].teacher_name || t('your_teacher') }) + '</b><p dir="auto">' + esc(S.notes[0].note) + '</p></div></div></section>' : '') +

      (S.homework.length ? '<section><div class="sec-h"><h2>' + te('my_homework') + '</h2>' + (pending ? '<span class="chip gold">' + te('n_todo', { n: pending }) + '</span>' : '<span class="chip green">' + icon('check') + te('all_done') + '</span>') + '</div><div class="hw">' + S.homework.map(homeworkHtml).join('') + '</div></section>' : '') +

      '<section><div class="sec-h"><h2>' + te('my_path') + '</h2><span class="muted small">' + esc(lv.tagline || '') + '</span></div><div class="stack">' +
      (S.units.length ? S.units.map(unitHtml).join('') : '<div class="card empty">' + icon('book') + '<p>' + te('preparing') + '</p></div>') + '</div></section>' +

      '<section><div class="sec-h"><h2>' + te('my_badges') + '</h2></div><div id="badgeBox">' + badgeBox() + '</div></section>' +

      (S.certificates.length ? '<section><div class="sec-h"><h2>' + te('my_certs') + '</h2></div><div class="stack" style="gap:10px">' + S.certificates.map(function (c) {
        return '<div class="hw-item" style="grid-template-columns:auto 1fr auto;align-items:center"><span class="unit-n" style="background:var(--gold)">' + icon('award') + '</span><div><b dir="auto">' + esc(c.title) + '</b><p class="small muted">' + esc(fmtDate(c.issued_at)) + '</p></div><button class="btn soft sm" data-act="showCert" data-id="' + esc(c.id) + '">' + te('view') + '</button></div>';
      }).join('') + '</div></section>' : '') +

      '<section class="card flat"><div class="row"><div class="row nw grow" style="align-items:flex-start;min-width:220px">' + icon('users') + '<div class="grow"><b>' + te('for_parents') + '</b><p class="small muted">' +
      te(S.fees_due ? 'parents_msg_fee' : 'parents_msg') + '</p></div></div>' +
      '<a class="btn ghost" href="#p=' + esc(st.parent_token) + '">' + (S.fees_due ? icon('bell') : '') + te('open_parent') + '</a></div></section>' +
      '</main>';
    paintRemind();
    every(function () { if (S && !P && tickCards(meetList)) studentHome(); });
  }
  function oldClassCard(cls) {
    var link = safeUrl(cls.meet_link);
    return '<section class="card"><div class="row"><div class="row nw grow" style="align-items:flex-start"><span class="unit-n" style="background:var(--blue-l);color:#154C6E">' + icon('video') + '</span>' +
      '<div class="grow"><b dir="auto">' + esc(cls.name) + '</b><p class="small muted" dir="auto">' + esc([cls.teacher ? t('with_teacher', { name: cls.teacher }) : '', cls.schedule].filter(Boolean).join(' · ') || t('live_class')) + '</p></div></div>' +
      (link ? '<a class="btn" href="' + esc(link) + '" target="_blank" rel="noopener">' + icon('video') + te('join_class') + '</a>' : '<span class="chip grey">' + te('link_soon') + '</span>') + '</div></section>';
  }
  // badges: the ones earned plus the next few to aim for; "See all" opens the rest
  var allBadges = false;
  function badgeBox() {
    var codes = Object.keys(BADGE_ICONS), owned = S.badges;
    if (allBadges) return badgesHtml(owned, true) + '<button class="btn ghost sm badges-more" data-act="badgesToggle" style="margin-top:12px">' + te('fewer_badges') + '</button>';
    var locked = codes.filter(function (c) { return owned.indexOf(c) < 0; });
    var html = '<div class="badges">' + codes.filter(function (c) { return owned.indexOf(c) >= 0; }).concat(locked.slice(0, 3)).map(function (c) {
      var b = badgeText(c), has = owned.indexOf(c) >= 0, ic = BADGE_ICONS[c];
      return '<div class="badge' + (has ? '' : ' off') + '"><div class="medal">' + icon(has ? ic : 'lock', has && ic === 'star' ? 'fill' : '') + '</div><b>' + esc(b[0]) + '</b><span>' + esc(b[1]) + '</span></div>';
    }).join('') + '</div>';
    return html + (locked.length > 3 ? '<div class="center" style="margin-top:12px"><button class="btn ghost sm" data-act="badgesToggle">' + te('all_badges') + ' (' + codes.length + ')</button></div>' : '');
  }
  actions.badgesToggle = function () { allBadges = !allBadges; document.getElementById('badgeBox').innerHTML = badgeBox(); };

  actions.studentLogout = function () {
    var tok = token();
    store.del(TOKEN_KEY); S = null; loginTab = 'student';
    if (tok && sb) sb.rpc('ilm_student_logout', { p_token: tok });
    showLogin();
  };
  actions.pickAvatar = function () {
    var html = '<h2>' + te('pick_colour') + '</h2><div class="avatar-pick">';
    for (var i = 1; i <= 8; i++) html += '<button data-act="setAvatar" data-n="' + i + '" aria-pressed="' + (S.student.avatar === i) + '" aria-label="' + i + '">' + avatar(S.student.full_name, i, 'lg') + '</button>';
    modal(html + '</div><div class="foot"><button class="btn ghost" data-act="closeModal">' + te('close') + '</button></div>');
  };
  actions.setAvatar = function (el) {
    var n = Number(el.dataset.n);
    S.student.avatar = n; closeModal(); renderStudentHome();
    rpc('ilm_student_avatar', { p_token: token(), p_avatar: n }).catch(function () {});
  };
  forms.sendHomework = function (f, d, btn) {
    busy(btn, async function () {
      var out = await rpc('ilm_student_homework', { p_token: token(), p_homework: d.id, p_answer: d.answer });
      toast(t(out.stars ? 'toast_hw_star' : 'toast_hw'));
      await studentHome();
    });
  };

  // ------------------------------------------------ lesson + quiz player
  var P = null;   // player state
  function bodyBlocks(text) {
    return String(text || '').split(/\n\s*\n/).map(function (b) { return b.trim(); }).filter(Boolean).map(function (b) {
      var lines = b.split('\n');
      var bullets = lines.filter(function (l) { return /^- /.test(l); });
      if (bullets.length) {
        var lead = lines.filter(function (l) { return !/^- /.test(l); }).join(' ');
        return (lead ? '<p>' + esc(lead) + '</p>' : '') + '<ul>' + bullets.map(function (l) { return '<li><span>' + esc(l.slice(2)) + '</span></li>'; }).join('') + '</ul>';
      }
      return '<p>' + esc(lines.join(' ')) + '</p>';
    });
  }
  actions.openLesson = function (el) {
    busy(el, async function () {
      var l = await rpc('ilm_student_lesson', { p_token: token(), p_lesson: Number(el.dataset.id) });
      var blocks = bodyBlocks(l.body), per = (S.level && S.level.id === 1) ? 1 : 2, slides = [{ type: 'title' }];
      for (var i = 0; i < blocks.length; i += per) slides.push({ type: 'text', html: blocks.slice(i, i + per).join('') });
      if (l.arabic) slides.push({ type: 'phrase' });
      if (l.action) slides.push({ type: 'action' });
      P = { kind: 'lesson', ref: l.id, lesson: l, title: l.title, eyebrow: l.unit, slides: slides, questions: l.questions, i: 0, answers: {}, wasRead: l.read };
      renderPlayer();
    });
  };
  actions.openExam = function (el) {
    busy(el, async function () {
      var x = await rpc('ilm_student_exam', { p_token: token(), p_unit: Number(el.dataset.id) });
      P = { kind: 'unit', ref: x.id, title: x.title, eyebrow: t('unit_exam'), slides: [{ type: 'examIntro' }], questions: x.questions, i: 0, answers: {} };
      renderPlayer();
    });
  };
  actions.openQuizOnly = function () { P.i = P.slides.length; P.answers = {}; P.result = null; renderPlayer(); };

  function renderPlayer() {
    document.body.className = 'kid' + (S.level && S.level.id === 1 ? ' lv1' : '');
    if (P.result) return renderResult();
    var nS = P.slides.length, nQ = P.questions.length, i = P.i, inQuiz = i >= nS;
    var steps = '';
    for (var k = 0; k < nS + nQ; k++) steps += '<i class="' + (k >= nS ? 'q ' : '') + (k <= i ? 'on' : '') + '"></i>';
    var body, nextLabel, canNext = true;

    if (!inQuiz) {
      var s = P.slides[i], l = P.lesson;
      if (s.type === 'title') body = '<span class="eyebrow">' + esc(P.eyebrow) + '</span><h1>' + esc(P.title) + '</h1>' + (l.hook ? '<p class="hook">' + esc(l.hook) + '</p>' : '') + '<span class="chip grey" style="justify-self:start">' + icon('book') + te('minutes', { n: l.minutes }) + '</span>';
      else if (s.type === 'text') body = s.html;
      else if (s.type === 'phrase') body = '<span class="eyebrow">' + te('say_it') + '</span><div class="phrase">' + pattern() + '<div class="ar" lang="ar">' + esc(l.arabic) + '</div>' + (l.translit && LANG !== 'ar' ? '<div class="tr" dir="ltr">' + esc(l.translit) + '</div>' : '') + (l.meaning ? '<div class="mn">' + esc(l.meaning) + '</div>' : '') + '</div>';
      else if (s.type === 'action') body = '<span class="eyebrow">' + te('try_today') + '</span><div class="todo">' + icon('sun') + '<p style="font-weight:700">' + esc(l.action) + '</p></div><p class="muted">' + te('tell_parents') + '</p>';
      else body = '<span class="eyebrow">' + te('unit_exam') + '</span><h1>' + esc(P.title) + '</h1><p>' + te('exam_intro', { n: nQ }) + '</p><div class="todo">' + icon('heart') + '<p>' + te('exam_kind') + '</p></div>';
      nextLabel = i === nS - 1 ? (nQ ? t(P.kind === 'unit' ? 'start_exam' : 'ready_quiz') : t('finish')) : t('next');
    } else {
      var qi = i - nS, q = P.questions[qi], chosen = P.answers[q.id];
      body = '<span class="eyebrow">' + te('question_of', { a: qi + 1, b: nQ }) + '</span><h1 style="font-size:1.5em">' + esc(q.prompt) + '</h1><div class="opts">' +
        q.options.map(function (o, n) { return '<button class="opt" data-act="pick" data-n="' + n + '" aria-pressed="' + (chosen === n) + '"><span class="k">' + 'ABCD'.charAt(n) + '</span><span>' + esc(o) + '</span></button>'; }).join('') + '</div>';
      canNext = chosen !== undefined;
      nextLabel = t(qi === nQ - 1 ? 'check_answers' : 'next_question');
    }
    app.innerHTML = '<div class="stage"><div class="stage-top"><button class="btn ghost sm" data-act="playerClose" aria-label="' + te('back_path') + '">' + icon('x') + '</button><div class="steps" role="img" aria-label="' + (i + 1) + ' / ' + (nS + nQ) + '">' + steps + '</div></div>' +
      '<div class="stage-body"><div class="slide">' + body + '</div></div>' +
      '<div class="stage-foot"><div class="in">' + (i > 0 ? '<button class="btn ghost big back" data-act="playerBack" aria-label="' + te('back') + '">' + icon('back') + '</button>' : '') +
      '<button class="btn big' + (inQuiz ? ' gold' : '') + '" id="playerNext" data-act="playerNext"' + (canNext ? '' : ' disabled') + '>' + esc(nextLabel) + icon('next') + '</button></div></div></div>';
    window.scrollTo(0, 0);
  }
  actions.pick = function (el) {
    var q = P.questions[P.i - P.slides.length];
    P.answers[q.id] = Number(el.dataset.n);
    document.querySelectorAll('.opt').forEach(function (o) { o.setAttribute('aria-pressed', String(o === el)); });
    document.getElementById('playerNext').disabled = false;
  };
  actions.playerBack = function () { if (P.i > 0) { P.i--; renderPlayer(); } };
  actions.playerClose = function () { P = null; studentHome(); };
  actions.playerNext = function (el) {
    busy(el, async function () {
      var nS = P.slides.length, last = nS + P.questions.length - 1;
      // finishing the reading part
      if (P.kind === 'lesson' && P.i === nS - 1 && !P.wasRead) {
        var r = await rpc('ilm_student_read', { p_token: token(), p_lesson: P.ref });
        P.wasRead = true;
        if (r.stars) toast(t('toast_read'));
        P.newBadges = (P.newBadges || []).concat(r.badges || []);
      }
      if (P.i < last) { P.i++; return renderPlayer(); }
      if (!P.questions.length) { P = null; return studentHome(); }
      P.result = await rpc('ilm_student_submit', { p_token: token(), p_kind: P.kind, p_ref: P.ref, p_answers: P.answers });
      renderResult();
    });
  };

  function renderResult() {
    var r = P.result, perfect = r.score === r.total, on = perfect ? 3 : r.passed ? 2 : r.score > 0 ? 1 : 0;
    var fresh = (P.newBadges || []).concat(r.badges || []);
    var head = t(perfect ? 'res_perfect' : r.passed ? 'res_pass' : 'res_fail');
    var sub = t(perfect ? 'res_perfect_sub' : r.passed ? 'res_pass_sub' : 'res_fail_sub', { a: r.score, b: r.total });
    var stars = '';
    for (var s = 0; s < 3; s++) stars += icon('star', 'fill' + (s < on ? ' on' : ''));
    var byId = {};
    P.questions.forEach(function (q) { byId[q.id] = q; });
    var review = r.results.map(function (x) {
      var q = byId[x.id]; if (!q) return '';
      return '<div class="review-item' + (x.correct ? '' : ' no') + '"><b>' + esc(q.prompt) + '</b>' +
        (x.correct ? '<span class="ans">' + te('ans_yours') + ' <b>' + esc(q.options[x.chosen]) + '</b> · ' + te('ans_correct') + '</span>'
          : '<span class="ans">' + (x.chosen == null ? te('ans_none') + ' ' : te('ans_yours') + ' ' + esc(q.options[x.chosen]) + '. ') + te('ans_right') + ' <b>' + esc(q.options[x.answer]) + '</b></span>') +
        (x.explain ? '<span class="ans muted">' + esc(x.explain) + '</span>' : '') + '</div>';
    }).join('');

    app.innerHTML = '<div class="stage"><div class="stage-body" style="align-items:flex-start;padding-top:28px"><div class="slide">' +
      '<div class="result-hero"><div class="result-stars" role="img" aria-label="' + on + ' / 3">' + stars + '</div><h1>' + esc(head) + '</h1><p>' + esc(sub) + '</p>' +
      '<div class="row" style="justify-content:center">' + (r.stars ? '<span class="stars-pill">' + icon('star', 'fill') + te('plus_stars', { n: r.stars }) + '</span>' : '') +
      fresh.map(function (c) { return BADGE_ICONS[c] ? '<span class="chip gold">' + icon('award') + te('new_badge', { name: badgeText(c)[0] }) + '</span>' : ''; }).join('') + '</div>' +
      (r.certificate ? '<div class="note" style="width:100%">' + te('cert_earned') + '</div>' : '') + '</div>' +
      '<div class="review">' + review + '</div></div></div>' +
      '<div class="stage-foot"><div class="in">' +
      (r.passed ? '<button class="btn big" data-act="playerClose">' + te('back_path') + icon('next') + '</button>' + (perfect ? '' : '<button class="btn ghost big" data-act="openQuizOnly">' + te('try_again') + '</button>')
        : '<button class="btn gold big" data-act="openQuizOnly">' + te('try_again') + '</button>' + (P.kind === 'lesson' ? '<button class="btn ghost big" data-act="rereadLesson">' + te('read_again') + '</button>' : '<button class="btn ghost big" data-act="playerClose">' + te('back_path') + '</button>')) +
      '</div></div></div>';
    window.scrollTo(0, 0);
    if (r.passed && (r.stars || perfect)) confetti();
  }
  actions.rereadLesson = function () { P.i = 0; P.answers = {}; P.result = null; renderPlayer(); };

  // ---------------------------------------------------------- certificate
  function showCertificate(c, studentName, back) {
    document.body.className = '';
    var detail = c.unit && c.total ? t('cert_unit_detail', { a: c.score, b: c.total }) : c.detail;
    app.innerHTML = '<div class="cert-screen"><div class="row no-print" style="width:min(100%,1000px)"><button class="btn ghost" data-act="certBack">' + icon('back') + te('back') + '</button><span class="grow"></span>' +
      '<button class="btn" data-act="printPage">' + icon('print') + te('print') + '</button></div>' +
      '<div class="cert">' + pattern(true) +
      '<svg class="seal" viewBox="0 0 40 40" style="color:#0E4B43" aria-hidden="true"><use href="#i-mark"/></svg>' +
      '<span class="k">ILM International · ' + te('cert_k') + '</span>' +
      '<p>' + te('cert_presented') + '</p><div class="name" dir="auto">' + esc(studentName) + '</div>' +
      '<div class="for" dir="auto">' + esc(c.title) + '</div>' + (detail ? '<p dir="auto">' + esc(detail) + '</p>' : '') +
      '<div class="sig"><span><b>' + esc(fmtDate(c.issued_at)) + '</b>' + te('date') + '</span><span><b>' + esc(c.issued_by || 'ILM International') + '</b>' + te('awarded_by') + '</span></div>' +
      '</div></div>';
    showCertificate.back = back;
    window.scrollTo(0, 0);
  }
  actions.certBack = function () { if (showCertificate.back) showCertificate.back(); };
  actions.printPage = function () { window.print(); };
  actions.showCert = function (el) {
    var c = S.certificates.filter(function (x) { return x.id === el.dataset.id; })[0];
    if (c) showCertificate(c, S.student.full_name, renderStudentHome);
  };

  // --------------------------------------------------------------- parent
  var R = null, parentToken = null;
  async function parentReport(tok) {
    parentToken = tok;
    loading();
    try {
      var both = await Promise.all([
        rpc('ilm_parent_report', { p_token: tok, p_lang: store.get(PARENT_LANG_KEY) || null }),
        sb.rpc('ilm_parent_meetings', { p_token: tok }).then(function (r) { return r.error ? null : r.data; }, function () { return null; })
      ]);
      R = both[0]; R.meet = both[1];
    }
    catch (e) {
      app.innerHTML = '<div class="login-main" style="min-height:100vh"><div class="login-box center stack"><div style="justify-self:center">' + brand() + '</div><h2>' + te('link_bad_h') + '</h2><p>' + esc(e.message) + '</p>' +
        '<div class="row" style="justify-content:center"><a class="btn wa" target="_blank" rel="noopener" href="' + esc(waLink(WHATSAPP, 'Assalamu alaykum, my parent report link is not working.')) + '">' + icon('wa') + te('msg_academy') + '</a><a class="btn ghost" href="portal.html">' + te('go_login') + '</a></div></div></div>';
      return;
    }
    renderParent();
  }
  function feeName(i) { return /^Tuition fee/.test(i.description) ? t('tuition') + ' · ' + monthName(i.period) : i.description; }
  function renderParent(flash) {
    useLang(R.lang || 'en');
    afterLang = function (l) { store.set(PARENT_LANG_KEY, l); parentReport(parentToken); };
    var s = R.student, ac = R.academy || {}, wa = ac.whatsapp || WHATSAPP, kid = firstName(s.full_name);
    document.body.className = '';
    document.title = kid + ' · ' + (ac.name || 'ILM International');
    var due = R.invoices.filter(function (i) { return i.status === 'due'; });
    var paid = R.invoices.filter(function (i) { return i.status === 'paid'; });
    var latest = {};
    R.assessments.forEach(function (a) { if (!latest[a.skill]) latest[a.skill] = a; });
    var notes = R.assessments.filter(function (a) { return a.note; }).slice(0, 4);
    var present = R.attendance.filter(function (a) { return a.status !== 'absent'; }).length;
    var h2 = function (text) { return '<h2 style="font-size:1.5rem">' + esc(text) + '</h2>'; };
    var meetList = (R.meet && R.meet.meetings) || [];
    remind = { api: (R.meet && R.meet.api) || (R.academy && R.academy.pay_api), save: function (sub, on) { return rpc('ilm_parent_push', { p_token: parentToken, p_sub: sub, p_on: on, p_lang: R.lang }); } };

    var dueHtml = due.length
      ? '<section class="due-banner" id="fees"><div class="row nw" style="align-items:flex-start">' + icon('bell') + '<div class="grow"><b>' + (due.length === 1 ? te('fee_one') : te('fee_many', { n: due.length })) + '</b><p class="small muted">' + te('fee_sub', { name: kid }) + '</p></div></div>' +
        due.map(function (i) {
          var late = i.due_date && i.due_date < today();
          return '<div class="due-row"><div class="grow"><b>' + esc(feeName(i)) + '</b><p class="small ' + (late ? '' : 'muted') + '" style="' + (late ? 'color:var(--red);font-weight:700' : '') + '">' + (i.due_date ? te(late ? 'was_due' : 'due', { date: fmtDate(i.due_date) }) : te('due_now')) + '</p></div>' +
            '<span class="amt" dir="ltr">' + esc(money(i.amount, i.currency)) + '</span><button class="btn gold" data-act="payNow" data-id="' + esc(i.id) + '">' + te('pay_now') + '</button></div>';
        }).join('') +
        '<p class="small muted">' + te('pay_secure') + ' <a target="_blank" rel="noopener" href="' + esc(waLink(wa, 'Assalamu alaykum, I would like to pay the fee for ' + s.full_name + ' (' + s.code + ') by bank transfer.')) + '">' + te('msg_whatsapp') + '</a>.</p></section>'
      : (R.invoices.length ? '<section class="card" id="fees"><div class="row nw"><span class="unit-n" style="background:var(--green-l);color:var(--green)">' + icon('check') + '</span><div class="grow"><b>' + te('fees_paid') + '</b><p class="small muted">' + te('thanks') + '</p></div></div></section>' : '');

    app.innerHTML =
      '<header class="report-top">' + pattern() + '<div class="in" style="position:relative;display:grid;gap:18px">' +
      '<div class="row">' + brand(true) + '<span class="grow"></span>' + langButton() + (token() ? '<a class="btn ghost sm" href="portal.html">' + icon('back') + te('student_page') + '</a>' : '') + '<a class="btn wa sm" target="_blank" rel="noopener" href="' + esc(waLink(wa, 'Assalamu alaykum, I have a question about ' + s.full_name + ' (' + s.code + ').')) + '">' + icon('wa') + te('ask_academy') + '</a></div>' +
      '<div class="row" style="align-items:center">' + avatar(s.full_name, s.avatar, 'lg') + '<div class="grow"><span class="chip gold">' + te('p_title') + '</span><h1 style="margin-top:6px" dir="auto">' + esc(s.full_name) + '</h1>' +
      '<p style="color:#CFE5DF">' + esc([R.level ? t('level_x', { name: R.level.name }) : '', R.class ? R.class.name : '', R.class && R.class.teacher ? t('teacher_x', { name: R.class.teacher }) : ''].filter(Boolean).join(' · ')) + '</p></div></div></div></header>' +
      '<main class="report-wrap"><div id="bannerSlot">' + liveBanner(meetList) + '</div>' +
      (flash ? '<section class="card" style="background:var(--green-l);box-shadow:none"><div class="row nw">' + icon('check') + '<b>' + esc(flash) + '</b></div></section>' : '') +
      dueHtml + (R.meet ? nextClassCard(R.meet, null, 'parent') : '') +
      '<section class="tiles">' +
      '<div class="tile"><span class="lbl">' + icon('book') + te('lessons_read') + '</span><b>' + te('a_of_b', { a: s.lessons_read, b: s.lessons_total }) + '</b><div class="bar"><i style="width:' + (s.lessons_total ? Math.round(100 * s.lessons_read / s.lessons_total) : 0) + '%"></i></div></div>' +
      '<div class="tile"><span class="lbl">' + icon('clipboard') + te('quiz_avg') + '</span><b dir="ltr">' + (s.quiz_avg == null ? '—' : s.quiz_avg + '%') + '</b><span class="sub">' + te('quiz_avg_sub') + '</span></div>' +
      '<div class="tile"><span class="lbl">' + icon('calendar') + te('attendance') + '</span><b dir="ltr">' + (s.attendance == null ? '—' : s.attendance + '%') + '</b><span class="sub">' + (R.attendance.length ? te('att_sub', { a: present, b: R.attendance.length }) : te('att_none')) + '</span></div>' +
      '<div class="tile"><span class="lbl">' + icon('star', 'fill') + te('stars_earned') + '</span><b>' + s.stars + '</b><span class="sub">' + te('hw_sub', { a: R.homework.done, b: R.homework.set }) + '</span></div></section>' +

      '<section class="card stack">' + h2(t('assess_h')) +
      (Object.keys(latest).length ? '<div class="list">' + SKILL_CODES.filter(function (k) { return latest[k]; }).map(function (k) {
        return '<div class="li"><span class="grow"><b>' + esc(skillText(k)) + '</b><span class="small muted" style="display:block">' + esc(fmtDate(latest[k].created_at)) + '</span></span>' + dots5(latest[k].score) + '</div>';
      }).join('') + '</div>' : '<p class="muted">' + te('assess_none') + '</p>') +
      notes.map(function (a) { return '<div class="note"><b>' + esc(a.teacher_name || t('teacher')) + '</b> · ' + esc(skillText(a.skill)) + ' · ' + esc(fmtDate(a.created_at)) + '<br><span dir="auto">' + esc(a.note) + '</span></div>'; }).join('') + '</section>' +

      '<section class="card stack">' + h2(t('progress_h', { name: R.level ? R.level.name : '' })) + (R.level && R.level.about ? '<p class="muted">' + esc(R.level.about) + '</p>' : '') +
      '<div class="list">' + R.path.map(function (u, i) {
        var read = u.lessons.filter(function (l) { return l.read; }).length, ex = u.exam;
        return '<div class="li"><span class="unit-n">' + (i + 1) + '</span><span class="grow"><b>' + esc(u.title) + '</b><div class="bar" style="margin-top:6px"><i style="width:' + (u.lessons.length ? Math.round(100 * read / u.lessons.length) : 0) + '%"></i></div><span class="small muted">' + te('lessons_of', { a: read, b: u.lessons.length }) + '</span></span>' +
          (ex ? '<span class="chip ' + (ex.passed ? 'gold' : 'grey') + '">' + (ex.passed ? icon('award') : '') + te('exam') + ' <span dir="ltr">' + ex.best_score + '/' + ex.total + '</span></span>' : '<span class="chip grey">' + te('exam_not') + '</span>') + '</div>';
      }).join('') + '</div></section>' +

      (R.attendance.length ? '<section class="card stack">' + h2(t('recent_classes')) + '<div class="attdots">' + R.attendance.slice().reverse().map(function (a) { return '<i class="' + esc(a.status) + '" title="' + esc(fmtDate(a.day)) + '"></i>'; }).join('') + '</div><p class="small muted">' + te('att_legend') + '</p></section>' : '') +

      (R.badges.length ? '<section class="card stack">' + h2(t('badges_earned')) + badgesHtml(R.badges, false) + '</section>' : '') +

      (R.certificates.length ? '<section class="card stack">' + h2(t('certs')) + '<div class="list">' + R.certificates.map(function (c) {
        return '<div class="li">' + icon('award') + '<span class="grow"><b dir="auto">' + esc(c.title) + '</b><span class="small muted" style="display:block">' + esc(fmtDate(c.issued_at)) + '</span></span><button class="btn soft sm" data-act="parentCert" data-id="' + esc(c.id) + '">' + te('view_print') + '</button></div>';
      }).join('') + '</div></section>' : '') +

      (paid.length ? '<section class="card stack">' + h2(t('pay_history')) + '<div class="list">' + paid.map(function (i) {
        return '<div class="li"><span class="grow"><b>' + esc(feeName(i)) + '</b><span class="small muted" style="display:block">' + te('paid_on', { date: fmtDate(i.paid_at) }) + '</span></span><b dir="ltr">' + esc(money(i.amount, i.currency)) + '</b><span class="chip green">' + icon('check') + te('paid') + '</span></div>';
      }).join('') + '</div></section>' : '') +
      '<p class="small muted center">' + te('private_note', { name: kid, code: s.code }) + '</p></main>';
    paintRemind();
    every(function () { if (R && document.querySelector('.report-wrap') && tickCards(meetList)) parentReport(parentToken); });
  }
  actions.parentCert = function (el) {
    var c = R.certificates.filter(function (x) { return x.id === el.dataset.id; })[0];
    if (c) showCertificate(c, R.student.full_name, function () { renderParent(); });
  };

  function loadScript(src) {
    return new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = src; s.onload = ok;
      s.onerror = function () { no(new Error(t('err_net'))); };
      document.head.appendChild(s);
    });
  }
  async function payApi(path, body) {
    var base = String((R.academy && R.academy.pay_api) || '').replace(/\/+$/, '');
    var res;
    try { res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error(t('err_net')); }
    var out = await res.json().catch(function () { return {}; });
    if (!res.ok || !out.ok) throw new Error(out.error || t('err_generic'));
    return out;
  }
  actions.payNow = function (el) {
    busy(el, async function () {
      var order = await payApi('/api/pay/order', { invoice: el.dataset.id, token: parentToken });
      if (!window.Razorpay) await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      await new Promise(function (done) {
        var rz = new window.Razorpay({
          key: order.key, order_id: order.order_id, amount: order.amount, currency: order.currency,
          name: order.name, description: order.description, prefill: order.prefill, theme: { color: '#0E6B5E' },
          handler: function (resp) {
            payApi('/api/pay/verify', resp).then(function () {
              return rpc('ilm_parent_report', { p_token: parentToken, p_lang: store.get(PARENT_LANG_KEY) || null });
            }).then(function (fresh) {
              fresh.meet = R.meet; R = fresh; renderParent(t('pay_ok')); window.scrollTo(0, 0); confetti();
            }).catch(fail).then(done);
          },
          modal: { ondismiss: function () { done(); } }
        });
        if (rz.on) rz.on('payment.failed', function () { toast(t('pay_fail'), 'bad'); });
        rz.open();
      });
    });
  };

  // ----------------------------------------------------------------- boot
  var SKILLS_EN = T.en.skills || {};
  window.ILM = {
    sb: sb, rpc: rpc, esc: esc, icon: icon, pattern: pattern, brand: brand, avatar: avatar, firstName: firstName, fmtDate: fmtDate,
    money: money, monthName: monthName, today: today, safeUrl: safeUrl, waLink: waLink, portalUrl: portalUrl, toast: toast, fail: fail,
    busy: busy, loading: loading, actions: actions, forms: forms, modal: modal, closeModal: closeModal, copyText: copyText,
    SKILLS: SKILLS_EN, LANGS: LANGS, badgesHtml: badgesHtml, dots5: dots5, bodyBlocks: bodyBlocks, showCertificate: showCertificate,
    showLogin: function (m) { loginTab = 'staff'; showLogin(m); }, app: app,
    whenParts: whenParts, classState: classState, span: span, every: every, push: push, paintRemind: paintRemind, remindRow: remindRow,
    setRemind: function (r) { remind = r; }, liveBanner: liveBanner, tickCards: tickCards
  };

  async function boot() {
    var m = /[#&]p=([A-Za-z0-9]+)/.exec(location.hash);
    try {
      if (!ready) return showLogin();
      if (m) return await parentReport(m[1]);
      if (token()) return await studentHome();
      var out = await sb.auth.getSession();
      if (out.data && out.data.session) return await startStaff();
      showLogin();
    } catch (e) {
      if (!e || !e.silent) { useLang(store.get(LANG_KEY) || 'en'); showLogin(e && e.message); }
    }
  }
  window.addEventListener('hashchange', function () { if (/[#&]p=/.test(location.hash) || location.hash === '') { S = null; useLang(store.get(LANG_KEY) || 'en'); boot(); } });
  if (sb) sb.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') {
      modal('<h2>Choose a new password</h2><form class="stack" data-form="newPassword"><label class="f">New password<input type="password" name="password" minlength="6" autocomplete="new-password" required></label><div class="foot"><button class="btn" type="submit">Save password</button></div></form>');
    }
  });
  // start after portal-staff.js has loaded
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
