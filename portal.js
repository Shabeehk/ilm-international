/* ILM International — Learning Portal (login, student app, parent report, certificates) */
(function () {
  'use strict';

  // ---------------------------------------------------------------- setup
  var cfg = window.ILM_CONFIG || {};
  var ready = !!(cfg.SUPABASE_URL && cfg.SUPABASE_KEY && !/YOUR-PROJECT/.test(cfg.SUPABASE_URL) && !/YOUR-PUBLIC/.test(cfg.SUPABASE_KEY));
  var sb = ready && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY) : null;
  var app = document.getElementById('app');
  var TOKEN_KEY = 'ilm_student_token';
  var WHATSAPP = '905518881481';

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  // ------------------------------------------------------------- helpers
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(name, cls) { return '<svg class="ic ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function pattern(dark) { return '<svg class="pattern" aria-hidden="true"><rect width="100%" height="100%" fill="url(#ilm-pat' + (dark ? '-d' : '') + ')"/></svg>'; }
  function brand(onDark) {
    return '<a class="brand' + (onDark ? ' on-dark' : '') + '" href="index.html"><svg aria-hidden="true" style="color:' + (onDark ? '#fff' : '#0E4B43') + '"><use href="#i-mark"/></svg><span><b>ILM</b><small>INTERNATIONAL</small></span></a>';
  }
  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function avatar(name, n, cls) { return '<span class="avatar av' + (n || 1) + ' ' + (cls || '') + '" aria-hidden="true">' + esc(initials(name)) + '</span>'; }
  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }
  function fmtDate(d) {
    if (!d) return '';
    var dt = new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T00:00:00' : d);
    return isNaN(dt) ? '' : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function money(amount, currency) {
    try { return new Intl.NumberFormat('en', { style: 'currency', currency: currency || 'USD' }).format(Number(amount) || 0); }
    catch (e) { return (currency || '') + ' ' + (Number(amount) || 0).toFixed(2); }
  }
  function monthName(period) {
    var d = new Date(period + '-01T00:00:00');
    return isNaN(d) ? period : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }
  function waLink(number, text) { return 'https://wa.me/' + String(number || '').replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(text || ''); }
  function portalUrl() { return location.origin + location.pathname; }

  function toast(msg, kind) {
    var box = document.getElementById('toasts');
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || 'good');
    t.innerHTML = (kind === 'bad' ? icon('x') : icon('check')) + '<span>' + esc(msg) + '</span>';
    box.appendChild(t);
    setTimeout(function () { t.remove(); }, kind === 'bad' ? 6000 : 3200);
  }
  function fail(e) { toast(e && e.message ? e.message : 'Something went wrong. Please try again.', 'bad'); }

  function friendly(error) {
    var m = (error && error.message) || '';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No internet connection. Please check and try again.';
    if (/permission denied|not find the function|schema cache/i.test(m)) return 'The portal database is not fully set up yet. Please run the setup file again in Supabase.';
    if (/Invalid login credentials/i.test(m)) return 'That email or password is not right.';
    if (/already registered/i.test(m)) return 'This email already has an account. Please sign in instead.';
    if (/Email not confirmed/i.test(m)) return 'Please open the confirmation email we sent you, then sign in.';
    if (/at least 6 characters|Password should/i.test(m)) return 'Please choose a password with at least 6 characters.';
    return m || 'Something went wrong. Please try again.';
  }
  async function rpc(fn, args) {
    var out = await sb.rpc(fn, args || {});
    if (out.error) {
      if (/SESSION_EXPIRED/.test(out.error.message || '')) {
        store.del(TOKEN_KEY);
        showLogin('Please log in again.');
        var e = new Error('Please log in again.'); e.silent = true; throw e;
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
  function loading(text) { app.innerHTML = '<div class="loading"><div><i></i>' + esc(text || 'Loading…') + '</div></div>'; }

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

  var BADGES = {
    first_step: { name: 'First Step', desc: 'Read your first lesson', icon: 'play' },
    steady_learner: { name: 'Steady Learner', desc: 'Read 5 lessons', icon: 'book' },
    book_lover: { name: 'Book Lover', desc: 'Read 15 lessons', icon: 'heart' },
    bright_star: { name: 'Bright Star', desc: 'A perfect quiz', icon: 'star' },
    unit_champion: { name: 'Unit Champion', desc: 'Passed a unit exam', icon: 'award' },
    homework_hero: { name: 'Homework Hero', desc: 'Handed in 3 homeworks', icon: 'pen' },
    stars_25: { name: '25 Stars', desc: 'Collected 25 stars', icon: 'sun' },
    stars_50: { name: '50 Stars', desc: 'Collected 50 stars', icon: 'sun' },
    stars_100: { name: '100 Stars', desc: 'Collected 100 stars', icon: 'sun' },
    level_graduate: { name: 'Level Graduate', desc: 'Finished every unit', icon: 'cap' }
  };
  var SKILLS = {
    quran: 'Qur\'an recitation', memorisation: 'Memorisation', salah: 'Salah practice',
    akhlaq: 'Manners and behaviour', participation: 'Taking part in class'
  };
  function badgesHtml(owned, showLocked) {
    var html = Object.keys(BADGES).filter(function (c) { return showLocked || owned.indexOf(c) >= 0; }).map(function (c) {
      var b = BADGES[c], has = owned.indexOf(c) >= 0;
      return '<div class="badge' + (has ? '' : ' off') + '"><div class="medal">' + icon(has ? b.icon : 'lock', has && b.icon === 'star' ? 'fill' : '') + '</div><b>' + esc(b.name) + '</b><span>' + esc(b.desc) + '</span></div>';
    }).join('');
    return html ? '<div class="badges">' + html + '</div>' : '';
  }
  function dots5(n) { var s = ''; for (var i = 1; i <= 5; i++) s += '<i class="' + (i <= n ? 'on' : '') + '"></i>'; return '<span class="dots5" role="img" aria-label="' + n + ' out of 5">' + s + '</span>'; }

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

  // ---------------------------------------------------------------- login
  var loginTab = 'student';
  function showLogin(message) {
    document.body.className = '';
    document.title = 'Learning Portal · ILM International';
    app.innerHTML =
      '<div class="login"><section class="login-art">' + pattern() +
      '<div style="position:relative">' + brand(true) + '</div>' +
      '<div style="position:relative;display:grid;gap:14px"><h1>Learn. Practise. Shine.</h1>' +
      '<p>Your lessons, quizzes, homework and stars — all in one place. Teachers follow every child\'s progress, and parents can see it too.</p></div>' +
      '<div class="levels">' +
      '<div class="lv"><span class="ar" lang="ar">نور</span><div><b>Noor · ages 5–7</b><span>Falling in love with Allah</span></div></div>' +
      '<div class="lv"><span class="ar" lang="ar">هدى</span><div><b>Huda · ages 8–10</b><span>What I believe and how I worship</span></div></div>' +
      '<div class="lv"><span class="ar" lang="ar">حكمة</span><div><b>Hikmah · ages 11–13</b><span>Understanding my faith with confidence</span></div></div>' +
      '</div></section>' +
      '<section class="login-main"><div class="login-box">' +
      '<h2>Assalamu alaykum!</h2><p class="muted">Welcome to the ILM International portal.</p>' +
      (message ? '<p class="note" style="margin-top:14px">' + esc(message) + '</p>' : '') +
      '<div class="tabs" role="tablist">' +
      '<button class="tab" role="tab" data-act="loginTab" data-tab="student" aria-selected="' + (loginTab === 'student') + '">' + icon('star', 'fill') + 'I am a student</button>' +
      '<button class="tab" role="tab" data-act="loginTab" data-tab="staff" aria-selected="' + (loginTab !== 'student') + '">' + icon('users') + 'Teacher / Admin</button></div>' +
      '<div id="loginPane">' + loginPane() + '</div>' +
      '<p class="small muted" style="margin-top:22px">Parents: open the private report link the academy sent you on WhatsApp. ' +
      '<a href="' + esc(waLink(WHATSAPP, 'Assalamu alaykum, I need help with the ILM International portal.')) + '" target="_blank" rel="noopener">Need help?</a></p>' +
      '</div></section></div>';
  }
  function loginPane() {
    if (!ready) {
      return '<div class="info"><b>The portal is almost ready.</b><br>The academy still needs to connect the database. Please check back soon.</div>';
    }
    if (loginTab === 'student') {
      return '<form class="stack" data-form="studentLogin" autocomplete="off">' +
        '<label class="f">Student ID <span class="hint">It looks like ILM-1234. Your teacher gave it to you.</span>' +
        '<input class="code-input" type="text" name="code" placeholder="ILM-1234" maxlength="10" autocapitalize="characters" required></label>' +
        '<label class="f">Secret PIN <span class="hint">Your 6 numbers</span>' +
        '<input class="pin-input" type="password" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••••" required></label>' +
        '<div class="err" id="loginErr" hidden></div>' +
        '<button class="btn big block" type="submit">Let\'s learn!</button></form>';
    }
    var up = loginTab === 'signup';
    return '<form class="stack" data-form="staffLogin">' +
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
  function loginError(msg) { var e = document.getElementById('loginErr'); if (e) { e.textContent = msg; e.hidden = false; } }
  actions.loginTab = function (el) {
    loginTab = el.dataset.tab;
    document.querySelectorAll('.tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === (loginTab === 'signup' ? 'staff' : loginTab))); });
    document.getElementById('loginPane').innerHTML = loginPane();
    var f = document.querySelector('#loginPane input'); if (f) f.focus();
  };
  forms.studentLogin = function (f, d, btn) {
    busy(btn, async function () {
      var out = await rpc('ilm_student_login', { p_code: d.code, p_pin: d.pin });
      if (!out.ok) return loginError(out.error);
      store.set(TOKEN_KEY, out.token);
      await studentHome(true);
    });
  };
  forms.staffLogin = function (f, d, btn) {
    busy(btn, async function () {
      var out;
      if (loginTab === 'signup') {
        out = await sb.auth.signUp({ email: d.email, password: d.password, options: { data: { full_name: d.full_name }, emailRedirectTo: portalUrl() } });
        if (out.error) return loginError(friendly(out.error));
        if (!out.data.session) { loginTab = 'staff'; return showLogin('Almost done! Open the confirmation email we just sent you, then sign in here.'); }
      } else {
        out = await sb.auth.signInWithPassword({ email: d.email, password: d.password });
        if (out.error) return loginError(friendly(out.error));
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
    loading('Opening your dashboard…');
    var me = await rpc('ilm_me');
    if (!me) return showLogin();
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
  actions.staffLogout = function () { sb.auth.signOut().then(function () { loginTab = 'staff'; showLogin(); }); };

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
        if (u.lessons[j].now) return { kind: 'lesson', id: u.lessons[j].id, title: u.lessons[j].title, label: S.stats.read ? 'Next lesson' : 'Start here', unit: u.title };
      }
      if (u.allRead && !u.done) return { kind: 'exam', id: u.id, title: u.title, label: 'Unit exam is ready', unit: 'Show what you learned' };
    }
    return null;
  }

  async function studentHome(celebrate) {
    if (!S) loading('Getting your lessons ready…');
    var data = await rpc('ilm_student_home', { p_token: token() });
    S = data;
    prepPath(S.units);
    var total = 0, read = 0, passedUnits = 0;
    S.units.forEach(function (u) { total += u.lessons.length; read += u.read; if (u.done) passedUnits++; });
    S.stats = { total: total, read: read, units: passedUnits };
    renderStudentHome();
    if (celebrate) window.scrollTo(0, 0);
  }

  function nodeHtml(l, n) {
    var cls = l.passed ? 'passed' : l.read ? 'read' : l.now ? 'now' : '';
    var sub = !l.open ? 'Opens after the lesson before it'
      : l.passed ? (l.best_score === l.total ? 'Perfect score!' : 'Quiz passed · ' + l.best_score + ' of ' + l.total)
      : l.read ? (l.attempts ? 'Try the quiz again' : 'Now try the quiz')
      : l.minutes + ' minutes';
    return '<li><button class="node ' + cls + '" data-act="openLesson" data-id="' + l.id + '"' + (l.open ? '' : ' disabled') + '>' +
      '<span class="dot">' + (l.passed ? icon('star', 'fill') : l.read ? icon('check') : l.open ? '<b>' + n + '</b>' : icon('lock')) + '</span>' +
      '<span class="grow"><b>' + esc(l.title) + '</b><span class="sub">' + esc(sub) + '</span></span>' +
      (l.open ? icon('next') : '') + '</button></li>';
  }
  function unitHtml(u, i) {
    var pct = u.lessons.length ? Math.round(100 * u.read / u.lessons.length) : 0;
    var ex = u.exam || {};
    var examSub = u.done ? 'Passed · ' + ex.best_score + ' of ' + ex.total : !u.allRead ? 'Read all the lessons to open the exam' : ex.attempts ? 'Try again — you can do it!' : 'Ready when you are';
    var open = (u.allRead && !u.done) || u.lessons.some(function (l) { return l.now; });
    return '<details class="card unit' + (u.done ? ' done' : '') + '"' + (open ? ' open' : '') + '>' +
      '<summary class="unit-h"><span class="unit-n">' + (u.done ? icon('award') : (i + 1)) + '</span>' +
      '<div class="grow"><h3>' + esc(u.title) + '</h3><p class="small muted">' + esc(u.summary || '') + '</p>' +
      '<div class="bar' + (u.done ? ' gold' : '') + '" style="margin-top:8px" role="img" aria-label="' + u.read + ' of ' + u.lessons.length + ' lessons read"><i style="width:' + pct + '%"></i></div></div>' + icon('chev', 'chev') + '</summary>' +
      '<ol class="nodes">' + u.lessons.map(function (l, n) { return nodeHtml(l, n + 1); }).join('') +
      '<li><button class="node exam ' + (u.done ? 'passed' : u.allRead ? 'now' : '') + '" data-act="openExam" data-id="' + u.id + '"' + (u.allRead ? '' : ' disabled') + '>' +
      '<span class="dot">' + icon(u.allRead ? 'award' : 'lock') + '</span><span class="grow"><b>Unit exam</b><span class="sub">' + esc(examSub) + '</span></span>' + (u.allRead ? icon('next') : '') + '</button></li>' +
      '</ol></details>';
  }
  function homeworkHtml(h) {
    var body;
    if (h.submitted_at) {
      body = '<p class="small"><b>Your answer:</b> ' + esc(h.answer) + '</p>' +
        (h.reviewed
          ? '<div class="row"><span class="chip gold">' + icon('star', 'fill') + (h.stars || 0) + ' stars from your teacher</span></div>' + (h.feedback ? '<p class="note">' + esc(h.feedback) + '</p>' : '')
          : '<span class="chip blue">Sent — waiting for your teacher</span>');
    } else {
      body = '<form class="stack" data-form="sendHomework" style="gap:10px"><input type="hidden" name="id" value="' + esc(h.id) + '">' +
        '<label class="f"><span class="sr">Your answer</span><textarea name="answer" placeholder="Write your answer here…" required></textarea></label>' +
        '<div><button class="btn" type="submit">' + icon('pen') + 'Send to my teacher</button></div></form>';
    }
    return '<div class="hw-item"><div class="row"><b class="grow">' + esc(h.title) + '</b>' + (h.due_date ? '<span class="chip grey">' + icon('calendar') + 'Due ' + esc(fmtDate(h.due_date)) + '</span>' : '') + '</div>' +
      (h.details ? '<p>' + esc(h.details) + '</p>' : '') + body + '</div>';
  }

  function renderStudentHome() {
    var st = S.student, lv = S.level || {}, nx = nextUp(), cls = S.class;
    document.body.className = 'kid' + (lv.id === 1 ? ' lv1' : '');
    document.title = firstName(st.full_name) + ' · ILM International';
    var link = cls && safeUrl(cls.meet_link);
    var pending = S.homework.filter(function (h) { return !h.submitted_at; }).length;

    app.innerHTML =
      '<header class="kid-top"><div class="in">' + brand() +
      '<span class="grow"></span><span class="stars-pill" title="Your stars">' + icon('star', 'fill') + '<span id="starCount">' + S.stars + '</span></span>' +
      '<button class="btn ghost sm" data-act="pickAvatar" aria-label="Change my colour" style="padding:2px;border-radius:50%;min-height:0;border:0">' + avatar(st.full_name, st.avatar) + '</button>' +
      '<button class="btn ghost sm" data-act="studentLogout" aria-label="Log out">' + icon('logout') + '<span class="lbl">Log out</span></button></div></header>' +
      '<main class="kid-wrap">' +

      '<section class="hello">' + pattern() +
      '<div style="position:relative"><span class="chip gold">' + esc(lv.name || 'My level') + (lv.age_min ? ' · ages ' + lv.age_min + '–' + lv.age_max : '') + '</span></div>' +
      '<h1>Assalamu alaykum, ' + esc(firstName(st.full_name)) + '!</h1>' +
      '<p>' + esc(S.stats.read === 0 ? 'Your learning path is ready. Let\'s take the first step, Bismillah!' : S.stats.read >= S.stats.total ? 'MashaAllah — you have read every lesson in your level!' : 'You have read ' + S.stats.read + ' of ' + S.stats.total + ' lessons. Keep going!') + '</p>' +
      (nx ? '<div class="next"><div class="grow"><span class="lbl">' + esc(nx.label) + '</span><b>' + esc(nx.title) + '</b><span class="small muted">' + esc(nx.unit) + '</span></div>' +
        '<button class="btn gold big" data-act="' + (nx.kind === 'lesson' ? 'openLesson' : 'openExam') + '" data-id="' + nx.id + '">' + icon('play') + (nx.kind === 'lesson' ? 'Start' : 'Take the exam') + '</button></div>' : '') +
      '</section>' +

      '<section class="mini"><div class="card"><b>' + S.stars + '</b><span>Stars</span></div>' +
      '<div class="card"><b>' + S.stats.read + '<span style="font-size:.5em;color:var(--muted)"> / ' + S.stats.total + '</span></b><span>Lessons read</span></div>' +
      '<div class="card"><b>' + S.badges.length + '</b><span>Badges</span></div></section>' +

      (cls ? '<section class="card"><div class="row"><div class="row nw grow" style="align-items:flex-start"><span class="unit-n" style="background:var(--blue-l);color:#154C6E">' + icon('video') + '</span>' +
        '<div class="grow"><b>' + esc(cls.name) + '</b><p class="small muted">' + esc([cls.teacher ? 'With ' + cls.teacher : '', cls.schedule].filter(Boolean).join(' · ') || 'Your live class') + '</p></div></div>' +
        (link ? '<a class="btn" href="' + esc(link) + '" target="_blank" rel="noopener">' + icon('video') + 'Join my class</a>' : '<span class="chip grey">Class link coming soon</span>') + '</div></section>' : '') +

      (S.notes.length ? '<section class="card" style="background:var(--gold-l);box-shadow:none"><div class="row nw" style="align-items:flex-start">' + icon('heart') +
        '<div class="grow"><b>A note from ' + esc(S.notes[0].teacher_name || 'your teacher') + '</b><p>' + esc(S.notes[0].note) + '</p></div></div></section>' : '') +

      (S.homework.length ? '<section><div class="sec-h"><h2>My homework</h2>' + (pending ? '<span class="chip gold">' + pending + ' to do</span>' : '<span class="chip green">' + icon('check') + 'All done</span>') + '</div><div class="hw">' + S.homework.map(homeworkHtml).join('') + '</div></section>' : '') +

      '<section><div class="sec-h"><h2>My learning path</h2><span class="muted small">' + esc(lv.tagline || '') + '</span></div><div class="stack">' +
      (S.units.length ? S.units.map(unitHtml).join('') : '<div class="card empty">' + icon('book') + '<p>Your teacher is preparing your lessons.</p></div>') + '</div></section>' +

      '<section><div class="sec-h"><h2>My badges</h2></div>' + badgesHtml(S.badges, true) + '</section>' +

      (S.certificates.length ? '<section><div class="sec-h"><h2>My certificates</h2></div><div class="stack" style="gap:10px">' + S.certificates.map(function (c) {
        return '<div class="hw-item" style="grid-template-columns:auto 1fr auto;align-items:center"><span class="unit-n" style="background:var(--gold)">' + icon('award') + '</span><div><b>' + esc(c.title) + '</b><p class="small muted">' + esc(fmtDate(c.issued_at)) + '</p></div><button class="btn soft sm" data-act="showCert" data-id="' + esc(c.id) + '">View</button></div>';
      }).join('') + '</div></section>' : '') +

      '<section class="card flat"><div class="row"><div class="row nw grow" style="align-items:flex-start;min-width:220px">' + icon('users') + '<div class="grow"><b>For Mama and Baba</b><p class="small muted">' +
      esc(S.fees_due ? 'There is a message from the academy for your parent. Please show them this.' : 'Your parents can see your progress report here.') + '</p></div></div>' +
      '<a class="btn ghost" href="#p=' + esc(st.parent_token) + '">' + (S.fees_due ? icon('bell') : '') + 'Open parent page</a></div></section>' +
      '</main>';
  }

  actions.studentLogout = function () {
    var t = token();
    store.del(TOKEN_KEY); S = null; loginTab = 'student';
    if (t && sb) sb.rpc('ilm_student_logout', { p_token: t });
    showLogin();
  };
  actions.pickAvatar = function () {
    var html = '<h2>Pick your colour</h2><div class="avatar-pick">';
    for (var i = 1; i <= 8; i++) html += '<button data-act="setAvatar" data-n="' + i + '" aria-pressed="' + (S.student.avatar === i) + '" aria-label="Colour ' + i + '">' + avatar(S.student.full_name, i, 'lg') + '</button>';
    modal(html + '</div><div class="foot"><button class="btn ghost" data-act="closeModal">Close</button></div>');
  };
  actions.setAvatar = function (el) {
    var n = Number(el.dataset.n);
    S.student.avatar = n; closeModal(); renderStudentHome();
    rpc('ilm_student_avatar', { p_token: token(), p_avatar: n }).catch(function () {});
  };
  forms.sendHomework = function (f, d, btn) {
    busy(btn, async function () {
      var out = await rpc('ilm_student_homework', { p_token: token(), p_homework: d.id, p_answer: d.answer });
      toast(out.stars ? 'Sent! You earned 1 star.' : 'Your answer was sent.');
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
      P = { kind: 'unit', ref: x.id, title: x.title, eyebrow: 'Unit exam', slides: [{ type: 'examIntro' }], questions: x.questions, i: 0, answers: {} };
      renderPlayer();
    });
  };
  actions.openQuizOnly = function () {
    P.i = P.slides.length; P.answers = {}; P.result = null; renderPlayer();
  };

  function renderPlayer() {
    document.body.className = 'kid' + (S.level && S.level.id === 1 ? ' lv1' : '');
    if (P.result) return renderResult();
    var nS = P.slides.length, nQ = P.questions.length, i = P.i, inQuiz = i >= nS;
    var steps = '';
    for (var k = 0; k < nS + nQ; k++) steps += '<i class="' + (k >= nS ? 'q ' : '') + (k <= i ? 'on' : '') + '"></i>';
    var body, nextLabel, nextAct = 'playerNext', canNext = true;

    if (!inQuiz) {
      var s = P.slides[i], l = P.lesson;
      if (s.type === 'title') body = '<span class="eyebrow">' + esc(P.eyebrow) + '</span><h1>' + esc(P.title) + '</h1>' + (l.hook ? '<p class="hook">' + esc(l.hook) + '</p>' : '') + '<span class="chip grey" style="justify-self:start">' + icon('book') + l.minutes + ' minutes</span>';
      else if (s.type === 'text') body = s.html;
      else if (s.type === 'phrase') body = '<span class="eyebrow">Say it with me</span><div class="phrase">' + pattern() + '<div class="ar" lang="ar">' + esc(l.arabic) + '</div>' + (l.translit ? '<div class="tr">' + esc(l.translit) + '</div>' : '') + (l.meaning ? '<div class="mn">' + esc(l.meaning) + '</div>' : '') + '</div>';
      else if (s.type === 'action') body = '<span class="eyebrow">Try it today</span><div class="todo">' + icon('sun') + '<p style="font-weight:700">' + esc(l.action) + '</p></div><p class="muted">Tell Mama or Baba what you learned!</p>';
      else body = '<span class="eyebrow">Unit exam</span><h1>' + esc(P.title) + '</h1><p>There are ' + nQ + ' questions about everything in this unit. Take your time and read each one carefully.</p><div class="todo">' + icon('heart') + '<p>Do your best. If it does not go well, you can read the lessons again and try once more.</p></div>';
      nextLabel = i === nS - 1 ? (nQ ? (P.kind === 'unit' ? 'Start the exam' : 'I\'m ready for the quiz') : 'Finish') : 'Next';
    } else {
      var qi = i - nS, q = P.questions[qi], chosen = P.answers[q.id];
      body = '<span class="eyebrow">Question ' + (qi + 1) + ' of ' + nQ + '</span><h1 style="font-size:1.5em">' + esc(q.prompt) + '</h1><div class="opts">' +
        q.options.map(function (o, n) { return '<button class="opt" data-act="pick" data-n="' + n + '" aria-pressed="' + (chosen === n) + '"><span class="k">' + 'ABCD'.charAt(n) + '</span><span>' + esc(o) + '</span></button>'; }).join('') + '</div>';
      canNext = chosen !== undefined;
      nextLabel = qi === nQ - 1 ? 'Check my answers' : 'Next question';
    }
    app.innerHTML = '<div class="stage"><div class="stage-top"><button class="btn ghost sm" data-act="playerClose" aria-label="Back to my path">' + icon('x') + '</button><div class="steps" role="img" aria-label="Step ' + (i + 1) + ' of ' + (nS + nQ) + '">' + steps + '</div></div>' +
      '<div class="stage-body"><div class="slide">' + body + '</div></div>' +
      '<div class="stage-foot"><div class="in">' + (i > 0 ? '<button class="btn ghost big back" data-act="playerBack" aria-label="Back">' + icon('back') + '</button>' : '') +
      '<button class="btn big' + (inQuiz ? ' gold' : '') + '" id="playerNext" data-act="' + nextAct + '"' + (canNext ? '' : ' disabled') + '>' + esc(nextLabel) + icon('next') + '</button></div></div></div>';
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
        if (r.stars) toast('You finished reading — 1 star for you!');
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
    var head = perfect ? 'MashaAllah! A perfect score!' : r.passed ? 'Well done! You passed.' : 'Good try! Let\'s have another go.';
    var sub = perfect ? 'You understood everything.' : r.passed ? 'You got ' + r.score + ' out of ' + r.total + '. Want to try for a perfect score?' : 'You got ' + r.score + ' out of ' + r.total + '. Read it once more and try again — every try makes you stronger.';
    var stars = '';
    for (var s = 0; s < 3; s++) stars += icon('star', 'fill' + (s < on ? ' on' : ''));
    var byId = {};
    P.questions.forEach(function (q) { byId[q.id] = q; });
    var review = r.results.map(function (x) {
      var q = byId[x.id]; if (!q) return '';
      return '<div class="review-item' + (x.correct ? '' : ' no') + '"><b>' + esc(q.prompt) + '</b>' +
        (x.correct ? '<span class="ans">Your answer: <b>' + esc(q.options[x.chosen]) + '</b> — correct!</span>'
          : '<span class="ans">' + (x.chosen == null ? 'No answer chosen. ' : 'Your answer: ' + esc(q.options[x.chosen]) + '. ') + 'The right answer: <b>' + esc(q.options[x.answer]) + '</b></span>') +
        (x.explain ? '<span class="ans muted">' + esc(x.explain) + '</span>' : '') + '</div>';
    }).join('');

    app.innerHTML = '<div class="stage"><div class="stage-body" style="align-items:flex-start;padding-top:28px"><div class="slide">' +
      '<div class="result-hero"><div class="result-stars" role="img" aria-label="' + on + ' of 3 stars">' + stars + '</div><h1>' + esc(head) + '</h1><p>' + esc(sub) + '</p>' +
      '<div class="row" style="justify-content:center">' + (r.stars ? '<span class="stars-pill">' + icon('star', 'fill') + '+' + r.stars + ' stars</span>' : '') +
      fresh.map(function (c) { return BADGES[c] ? '<span class="chip gold">' + icon('award') + 'New badge: ' + esc(BADGES[c].name) + '</span>' : ''; }).join('') + '</div>' +
      (r.certificate ? '<div class="note" style="width:100%"><b>You earned a certificate!</b> You can find it on your home page.</div>' : '') + '</div>' +
      '<div class="review">' + review + '</div></div></div>' +
      '<div class="stage-foot"><div class="in">' +
      (r.passed ? '<button class="btn big" data-act="playerClose">Back to my path' + icon('next') + '</button>' + (perfect ? '' : '<button class="btn ghost big" data-act="openQuizOnly">Try again</button>')
        : '<button class="btn gold big" data-act="openQuizOnly">Try again</button>' + (P.kind === 'lesson' ? '<button class="btn ghost big" data-act="rereadLesson">Read it again</button>' : '<button class="btn ghost big" data-act="playerClose">Back to my path</button>')) +
      '</div></div></div>';
    window.scrollTo(0, 0);
    if (r.passed && (r.stars || perfect)) confetti();
  }
  actions.rereadLesson = function () { P.i = 0; P.answers = {}; P.result = null; renderPlayer(); };

  // ---------------------------------------------------------- certificate
  function showCertificate(c, studentName, back) {
    document.body.className = '';
    app.innerHTML = '<div class="cert-screen"><div class="row no-print" style="width:min(100%,1000px)"><button class="btn ghost" data-act="certBack">' + icon('back') + 'Back</button><span class="grow"></span>' +
      '<button class="btn" data-act="printPage">' + icon('print') + 'Print or save as PDF</button></div>' +
      '<div class="cert">' + pattern(true) +
      '<svg class="seal" viewBox="0 0 40 40" style="color:#0E4B43" aria-hidden="true"><use href="#i-mark"/></svg>' +
      '<span class="k">ILM International · Certificate of Achievement</span>' +
      '<p>This certificate is proudly presented to</p><div class="name">' + esc(studentName) + '</div>' +
      '<div class="for">' + esc(c.title) + '</div>' + (c.detail ? '<p>' + esc(c.detail) + '</p>' : '') +
      '<div class="sig"><span><b>' + esc(fmtDate(c.issued_at)) + '</b>Date</span><span><b>' + esc(c.issued_by || 'ILM International') + '</b>Awarded by</span></div>' +
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
    loading('Opening the progress report…');
    try { R = await rpc('ilm_parent_report', { p_token: tok }); }
    catch (e) {
      app.innerHTML = '<div class="login-main" style="min-height:100vh"><div class="login-box center stack"><div style="justify-self:center">' + brand() + '</div><h2>This link did not open</h2><p>' + esc(e.message) + '</p>' +
        '<div class="row" style="justify-content:center"><a class="btn wa" target="_blank" rel="noopener" href="' + esc(waLink(WHATSAPP, 'Assalamu alaykum, my parent report link is not working.')) + '">' + icon('wa') + 'Message the academy</a><a class="btn ghost" href="portal.html">Go to login</a></div></div></div>';
      return;
    }
    renderParent();
  }
  function renderParent(flash) {
    var s = R.student, ac = R.academy || {}, wa = ac.whatsapp || WHATSAPP;
    document.body.className = '';
    document.title = firstName(s.full_name) + '\'s progress · ' + (ac.name || 'ILM International');
    var due = R.invoices.filter(function (i) { return i.status === 'due'; });
    var paid = R.invoices.filter(function (i) { return i.status === 'paid'; });
    var latest = {};
    R.assessments.forEach(function (a) { if (!latest[a.skill]) latest[a.skill] = a; });
    var notes = R.assessments.filter(function (a) { return a.note; }).slice(0, 4);
    var present = R.attendance.filter(function (a) { return a.status !== 'absent'; }).length;

    var dueHtml = due.length
      ? '<section class="due-banner" id="fees"><div class="row nw" style="align-items:flex-start">' + icon('bell') + '<div class="grow"><b>' + (due.length === 1 ? 'A fee is waiting to be paid' : due.length + ' fees are waiting to be paid') + '</b><p class="small muted">Please complete the payment to keep ' + esc(firstName(s.full_name)) + '\'s place in class.</p></div></div>' +
        due.map(function (i) {
          var late = i.due_date && i.due_date < today();
          return '<div class="due-row"><div class="grow"><b>' + esc(i.description) + '</b><p class="small ' + (late ? '' : 'muted') + '" style="' + (late ? 'color:var(--red);font-weight:700' : '') + '">' + (i.due_date ? (late ? 'Was due ' : 'Due ') + esc(fmtDate(i.due_date)) : 'Due now') + '</p></div>' +
            '<span class="amt">' + esc(money(i.amount, i.currency)) + '</span><button class="btn gold" data-act="payNow" data-id="' + esc(i.id) + '">Pay now</button></div>';
        }).join('') +
        '<p class="small muted">Secure card payment by Razorpay. Prefer a bank transfer? <a target="_blank" rel="noopener" href="' + esc(waLink(wa, 'Assalamu alaykum, I would like to pay the fee for ' + s.full_name + ' (' + s.code + ') by bank transfer.')) + '">Message us on WhatsApp</a>.</p></section>'
      : (R.invoices.length ? '<section class="card" id="fees"><div class="row"><span class="unit-n" style="background:var(--green-l);color:var(--green)">' + icon('check') + '</span><div class="grow"><b>All fees are paid</b><p class="small muted">Thank you. JazakAllahu khayran.</p></div></div></section>' : '');

    app.innerHTML =
      '<header class="report-top">' + pattern() + '<div class="in" style="position:relative;display:grid;gap:18px">' +
      '<div class="row">' + brand(true) + '<span class="grow"></span>' + (token() ? '<a class="btn ghost sm" href="portal.html">' + icon('back') + 'Student page</a>' : '') + '<a class="btn wa sm" target="_blank" rel="noopener" href="' + esc(waLink(wa, 'Assalamu alaykum, I have a question about ' + s.full_name + ' (' + s.code + ').')) + '">' + icon('wa') + 'Ask the academy</a></div>' +
      '<div class="row" style="align-items:center">' + avatar(s.full_name, s.avatar, 'lg') + '<div class="grow"><span class="chip gold">Parent progress report</span><h1 style="margin-top:6px">' + esc(s.full_name) + '</h1>' +
      '<p style="color:#CFE5DF">' + esc([R.level ? R.level.name + ' level' : '', R.class ? R.class.name : '', R.class && R.class.teacher ? 'Teacher: ' + R.class.teacher : ''].filter(Boolean).join(' · ')) + '</p></div></div></div></header>' +
      '<main class="report-wrap">' +
      (flash ? '<section class="card" style="background:var(--green-l);box-shadow:none"><div class="row">' + icon('check') + '<b>' + esc(flash) + '</b></div></section>' : '') +
      dueHtml +
      '<section class="tiles">' +
      '<div class="tile"><span class="lbl">' + icon('book') + 'Lessons read</span><b>' + s.lessons_read + ' <span style="font-size:.5em;color:var(--muted)">of ' + s.lessons_total + '</span></b><div class="bar"><i style="width:' + (s.lessons_total ? Math.round(100 * s.lessons_read / s.lessons_total) : 0) + '%"></i></div></div>' +
      '<div class="tile"><span class="lbl">' + icon('clipboard') + 'Quiz average</span><b>' + (s.quiz_avg == null ? '—' : s.quiz_avg + '%') + '</b><span class="sub">Best score on each quiz</span></div>' +
      '<div class="tile"><span class="lbl">' + icon('calendar') + 'Attendance</span><b>' + (s.attendance == null ? '—' : s.attendance + '%') + '</b><span class="sub">' + (R.attendance.length ? present + ' of the last ' + R.attendance.length + ' classes' : 'No classes marked yet') + '</span></div>' +
      '<div class="tile"><span class="lbl">' + icon('star', 'fill') + 'Stars earned</span><b>' + s.stars + '</b><span class="sub">Homework: ' + R.homework.done + ' of ' + R.homework.set + ' handed in</span></div></section>' +

      '<section class="card stack"><h2 style="font-size:1.5rem">Teacher\'s assessment</h2>' +
      (Object.keys(latest).length ? '<div class="list">' + Object.keys(SKILLS).filter(function (k) { return latest[k]; }).map(function (k) {
        return '<div class="li"><span class="grow"><b>' + esc(SKILLS[k]) + '</b><span class="small muted" style="display:block">' + esc(fmtDate(latest[k].created_at)) + '</span></span>' + dots5(latest[k].score) + '</div>';
      }).join('') + '</div>' : '<p class="muted">The teacher has not added an assessment yet. It will appear here after the first classes.</p>') +
      notes.map(function (a) { return '<div class="note"><b>' + esc(a.teacher_name || 'Teacher') + '</b> · ' + esc(SKILLS[a.skill] || a.skill) + ' · ' + esc(fmtDate(a.created_at)) + '<br>' + esc(a.note) + '</div>'; }).join('') + '</section>' +

      '<section class="card stack"><h2 style="font-size:1.5rem">Progress through ' + esc(R.level ? R.level.name : 'the level') + '</h2>' + (R.level && R.level.about ? '<p class="muted">' + esc(R.level.about) + '</p>' : '') +
      '<div class="list">' + R.path.map(function (u, i) {
        var read = u.lessons.filter(function (l) { return l.read; }).length, ex = u.exam;
        return '<div class="li"><span class="unit-n">' + (i + 1) + '</span><span class="grow"><b>' + esc(u.title) + '</b><div class="bar" style="margin-top:6px"><i style="width:' + (u.lessons.length ? Math.round(100 * read / u.lessons.length) : 0) + '%"></i></div><span class="small muted">' + read + ' of ' + u.lessons.length + ' lessons read</span></span>' +
          (ex && ex.passed ? '<span class="chip gold">' + icon('award') + 'Exam ' + ex.best_score + '/' + ex.total + '</span>' : ex ? '<span class="chip grey">Exam ' + ex.best_score + '/' + ex.total + '</span>' : '<span class="chip grey">Exam not taken</span>') + '</div>';
      }).join('') + '</div></section>' +

      (R.attendance.length ? '<section class="card stack"><h2 style="font-size:1.5rem">Recent classes</h2><div class="attdots">' + R.attendance.slice().reverse().map(function (a) { return '<i class="' + esc(a.status) + '" title="' + esc(fmtDate(a.day) + ' — ' + a.status) + '"></i>'; }).join('') + '</div><p class="small muted">Green: present · Gold: late · Red: absent</p></section>' : '') +

      (R.badges.length ? '<section class="card stack"><h2 style="font-size:1.5rem">Badges earned</h2>' + badgesHtml(R.badges, false) + '</section>' : '') +

      (R.certificates.length ? '<section class="card stack"><h2 style="font-size:1.5rem">Certificates</h2><div class="list">' + R.certificates.map(function (c) {
        return '<div class="li">' + icon('award') + '<span class="grow"><b>' + esc(c.title) + '</b><span class="small muted" style="display:block">' + esc(fmtDate(c.issued_at)) + '</span></span><button class="btn soft sm" data-act="parentCert" data-id="' + esc(c.id) + '">View and print</button></div>';
      }).join('') + '</div></section>' : '') +

      (paid.length ? '<section class="card stack"><h2 style="font-size:1.5rem">Payment history</h2><div class="list">' + paid.map(function (i) {
        return '<div class="li"><span class="grow"><b>' + esc(i.description) + '</b><span class="small muted" style="display:block">Paid ' + esc(fmtDate(i.paid_at)) + '</span></span><b>' + esc(money(i.amount, i.currency)) + '</b><span class="chip green">' + icon('check') + 'Paid</span></div>';
      }).join('') + '</div></section>' : '') +
      '<p class="small muted center">This page is private to ' + esc(firstName(s.full_name)) + '\'s family. Please do not share the link. Student ID: ' + esc(s.code) + '</p></main>';
  }
  actions.parentCert = function (el) {
    var c = R.certificates.filter(function (x) { return x.id === el.dataset.id; })[0];
    if (c) showCertificate(c, R.student.full_name, function () { renderParent(); });
  };

  function loadScript(src) {
    return new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = src; s.onload = ok;
      s.onerror = function () { no(new Error('The payment window could not load. Please check your internet and try again.')); };
      document.head.appendChild(s);
    });
  }
  async function payApi(path, body) {
    var base = String((R.academy && R.academy.pay_api) || '').replace(/\/+$/, '');
    var res;
    try { res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error('Could not reach the payment service. Please check your internet and try again.'); }
    var out = await res.json().catch(function () { return {}; });
    if (!res.ok || !out.ok) throw new Error(out.error || 'The payment could not be started. Please try again.');
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
              return rpc('ilm_parent_report', { p_token: parentToken });
            }).then(function (fresh) {
              R = fresh; renderParent('Payment received. JazakAllahu khayran!'); window.scrollTo(0, 0); confetti();
            }).catch(fail).then(done);
          },
          modal: { ondismiss: function () { done(); } }
        });
        if (rz.on) rz.on('payment.failed', function () { toast('The payment did not go through. No money was taken. Please try again.', 'bad'); });
        rz.open();
      });
    });
  };

  // ----------------------------------------------------------------- boot
  window.ILM = {
    sb: sb, rpc: rpc, esc: esc, icon: icon, pattern: pattern, brand: brand, avatar: avatar, firstName: firstName, fmtDate: fmtDate,
    money: money, monthName: monthName, today: today, safeUrl: safeUrl, waLink: waLink, portalUrl: portalUrl, toast: toast, fail: fail,
    busy: busy, loading: loading, actions: actions, forms: forms, modal: modal, closeModal: closeModal, copyText: copyText,
    BADGES: BADGES, SKILLS: SKILLS, badgesHtml: badgesHtml, dots5: dots5, bodyBlocks: bodyBlocks, showCertificate: showCertificate,
    showLogin: function (m) { loginTab = 'staff'; showLogin(m); }, app: app
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
      if (!e || !e.silent) showLogin(e && e.message);
    }
  }
  window.addEventListener('hashchange', function () { if (/[#&]p=/.test(location.hash) || location.hash === '') { S = null; boot(); } });
  if (sb) sb.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') {
      modal('<h2>Choose a new password</h2><form class="stack" data-form="newPassword"><label class="f">New password<input type="password" name="password" minlength="6" autocomplete="new-password" required></label><div class="foot"><button class="btn" type="submit">Save password</button></div></form>');
    }
  });
  // start after portal-staff.js has loaded
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
