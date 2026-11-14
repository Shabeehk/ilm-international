/* ILM International — Learning Portal (teacher and admin dashboard) */
(function () {
  'use strict';
  var I = window.ILM, esc = I.esc, icon = I.icon, rpc = I.rpc, actions = I.actions, forms = I.forms, app = I.app;
  var busy = I.busy, modal = I.modal, closeModal = I.closeModal, toast = I.toast, fmtDate = I.fmtDate, money = I.money, avatar = I.avatar;

  var D = null, me = null, page = 'overview', param = null, isAdmin = false;
  var NAV = [
    ['overview', 'Overview', 'home'], ['students', 'Students', 'users'], ['classes', 'Classes', 'video'],
    ['attendance', 'Attendance', 'calendar'], ['homework', 'Homework', 'pen'], ['syllabus', 'Syllabus', 'book'],
    ['fees', 'Fees', 'coin', true], ['teachers', 'Teachers', 'cap', true], ['settings', 'Settings', 'settings', true]
  ];
  var PLAN_NAMES = { weekend: 'Weekend Class', group: 'Small Group', personal: 'Personal 1-to-1' };
  var ui = { search: '', classFilter: '', attClass: '', attDay: I.today(), att: {}, hwClass: '', level: 1, period: I.today().slice(0, 7), feeFilter: 'month', syllabus: null, fees: null };

  // ------------------------------------------------------------ lookups
  function level(id) { return D.levels.filter(function (l) { return l.id === id; })[0] || {}; }
  function klass(id) { return D.classes.filter(function (c) { return c.id === id; })[0]; }
  function teacher(id) { return D.teachers.filter(function (t) { return t.id === id; })[0]; }
  function student(id) { return D.students.filter(function (s) { return s.id === id; })[0]; }
  function cur() { return (D.settings && D.settings.currency) || 'USD'; }
  function portal() { return (D.settings && D.settings.portal_url) || I.portalUrl(); }
  function parentLink(s) { return portal() + '#p=' + s.parent_token; }
  function opt(value, label, selected) { return '<option value="' + esc(value) + '"' + (String(selected == null ? '' : selected) === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function classOptions(selected, blank) { return (blank ? opt('', blank, selected) : '') + D.classes.filter(function (c) { return c.active; }).map(function (c) { return opt(c.id, c.name, selected); }).join(''); }
  function ago(d) {
    if (!d) return 'Never';
    var days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
    return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 30 ? days + ' days ago' : fmtDate(d);
  }
  function empty(ic, text, btn) { return '<div class="empty">' + icon(ic) + '<p>' + esc(text) + '</p>' + (btn || '') + '</div>'; }
  function csvDownload(name, rows) {
    var csv = rows.map(function (r) { return r.map(function (v) { var s = String(v == null ? '' : v); if (/^[=@\t\r]/.test(s) || /^[+\-](?![\d\s(])/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  // -------------------------------------------------------------- shell
  async function load() { D = await rpc('ilm_staff_bootstrap'); me = D.me; isAdmin = me.role === 'admin'; }
  async function start(profile) {
    me = profile;
    await load();
    if (!ui.attClass && D.classes[0]) ui.attClass = ui.hwClass = D.classes[0].id;
    render();
  }
  async function refresh() { await load(); render(); }
  function go(p, prm) { page = p; param = prm || null; render(); window.scrollTo(0, 0); }
  // every move between sections fetches fresh numbers first, so two people working at once stay in step
  actions.nav = function (el) {
    var p = el.dataset.page, prm = el.dataset.param;
    if (p === 'fees') ui.fees = null;
    load().then(function () { go(p, prm); }, function (e) { I.fail(e); go(p, prm); });
  };

  function navHtml() {
    var pending = isAdmin ? D.teachers.filter(function (t) { return !t.approved; }).length : 0;
    return NAV.filter(function (n) { return !n[3] || isAdmin; }).map(function (n) {
      var count = n[0] === 'homework' ? D.homework_to_review : n[0] === 'teachers' ? pending : n[0] === 'fees' && D.fees ? D.fees.overdue_count : 0;
      return '<button class="navlink" data-act="nav" data-page="' + n[0] + '"' + (page === n[0] || (page === 'student' && n[0] === 'students') ? ' aria-current="page"' : '') + '>' + icon(n[2]) + '<span>' + n[1] + '</span>' + (count ? '<span class="count">' + count + '</span>' : '') + '</button>';
    }).join('');
  }
  function render() {
    document.body.className = 'staff';
    document.title = 'Dashboard · ILM International';
    app.innerHTML = '<div class="shell"><aside class="side">' + I.brand(true) + navHtml() +
      '<div class="who"><div class="row" style="flex-wrap:nowrap">' + avatar(me.full_name, 5, 'sm') + '<div style="min-width:0"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(me.full_name) + '</b><span>' + (isAdmin ? 'Academy admin' : 'Teacher') + '</span></div></div>' +
      '<button class="navlink" data-act="staffLogout">' + icon('logout') + 'Sign out</button></div></aside>' +
      '<div><nav class="mobnav" aria-label="Sections">' + navHtml() + '<button class="navlink" data-act="staffLogout">' + icon('logout') + 'Sign out</button></nav>' +
      '<main class="main" id="main"></main></div></div>';
    var cur = document.querySelector('.mobnav [aria-current]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    (PAGES[page] || PAGES.overview)(document.getElementById('main'));
  }
  function head(title, sub, right) { return '<div class="page-h"><div class="grow"><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (right || '') + '</div>'; }
  var PAGES = {};

  // ----------------------------------------------------------- overview
  PAGES.overview = function (el) {
    var active = D.students.filter(function (s) { return s.active; });
    var quiet = active.filter(function (s) { return !s.last_seen || Date.now() - new Date(s.last_seen).getTime() > 7 * 864e5; });
    var low = active.filter(function (s) { return s.attendance != null && s.attendance < 70; });
    var pending = isAdmin ? D.teachers.filter(function (t) { return !t.approved; }) : [];
    var f = D.fees;
    var attention = [];
    pending.forEach(function (t) { attention.push('<div class="li">' + icon('cap') + '<span class="grow"><b>' + esc(t.full_name) + '</b> is waiting for approval<span class="small muted" style="display:block">' + esc(t.email || '') + '</span></span><button class="btn sm" data-act="approveTeacher" data-id="' + t.id + '">Approve</button></div>'); });
    if (D.homework_to_review) attention.push('<div class="li">' + icon('pen') + '<span class="grow"><b>' + D.homework_to_review + ' homework answer' + (D.homework_to_review > 1 ? 's' : '') + '</b> to mark</span><button class="btn soft sm" data-act="nav" data-page="homework">Open</button></div>');
    if (f && f.overdue_count) attention.push('<div class="li">' + icon('coin') + '<span class="grow"><b>' + f.overdue_count + ' fee' + (f.overdue_count > 1 ? 's are' : ' is') + ' overdue</b><span class="small muted" style="display:block">Send a reminder from the Fees page</span></span><button class="btn soft sm" data-act="nav" data-page="fees">Open</button></div>');
    low.slice(0, 4).forEach(function (s) { attention.push('<div class="li">' + avatar(s.full_name, s.avatar, 'sm') + '<span class="grow"><b>' + esc(s.full_name) + '</b> — attendance is ' + s.attendance + '%</span><button class="btn soft sm" data-act="openStudent" data-id="' + s.id + '">View</button></div>'); });
    quiet.slice(0, 5).forEach(function (s) { attention.push('<div class="li">' + avatar(s.full_name, s.avatar, 'sm') + '<span class="grow"><b>' + esc(s.full_name) + '</b> has not opened the portal ' + (s.last_seen ? 'for a week' : 'yet') + '</span><button class="btn soft sm" data-act="openStudent" data-id="' + s.id + '">View</button></div>'); });

    var steps = '';
    if (isAdmin && (!D.classes.length || !D.students.length)) {
      steps = '<section class="card stack" style="margin-bottom:18px"><h2 style="font-size:1.4rem">Three steps to get going</h2><div class="list">' +
        '<div class="li"><span class="unit-n"' + (D.classes.length ? ' style="background:var(--gold)"' : '') + '>' + (D.classes.length ? icon('check') : '1') + '</span><span class="grow"><b>Create your first class</b><span class="small muted" style="display:block">Choose the level, the teacher and paste the Zoom or Google Meet link.</span></span><button class="btn sm" data-act="classForm">Create class</button></div>' +
        '<div class="li"><span class="unit-n">2</span><span class="grow"><b>Add your students</b><span class="small muted" style="display:block">Each child gets a Student ID and a secret PIN automatically.</span></span><button class="btn sm" data-act="studentForm"' + (D.classes.length ? '' : ' disabled') + '>Add student</button></div>' +
        '<div class="li"><span class="unit-n">3</span><span class="grow"><b>Send the login to parents</b><span class="small muted" style="display:block">One tap sends the ID, PIN and the private parent link on WhatsApp.</span></span></div></div></section>';
    }
    el.innerHTML = head('Assalamu alaykum, ' + I.firstName(me.full_name), isAdmin ? 'Here is how the academy is doing today.' : 'Here is how your classes are doing today.') + steps +
      '<section class="tiles" style="margin-bottom:18px">' +
      '<div class="tile"><span class="lbl">' + icon('users') + 'Students</span><b>' + active.length + '</b><span class="sub">' + (active.length - quiet.length) + ' active this week</span></div>' +
      '<div class="tile"><span class="lbl">' + icon('video') + 'Classes</span><b>' + D.classes.filter(function (c) { return c.active; }).length + '</b><span class="sub">' + (isAdmin ? D.teachers.filter(function (t) { return t.approved; }).length + ' teachers' : 'Your classes') + '</span></div>' +
      '<div class="tile' + (D.homework_to_review ? ' warn' : '') + '"><span class="lbl">' + icon('pen') + 'Homework to mark</span><b>' + D.homework_to_review + '</b><span class="sub">Answers waiting for you</span></div>' +
      (f ? '<div class="tile' + (f.overdue_count ? ' warn' : '') + '"><span class="lbl">' + icon('coin') + 'Fees not paid</span><b>' + esc(money(f.due_total, cur())) + '</b><span class="sub">' + f.due_count + ' unpaid · ' + f.overdue_count + ' overdue</span></div>' +
        '<div class="tile"><span class="lbl">' + icon('check') + 'Collected this month</span><b>' + esc(money(f.paid_this_month, cur())) + '</b><span class="sub">All payment methods</span></div>' : '') +
      '</section><div class="cols">' +
      '<section class="card stack"><h2 style="font-size:1.4rem">Needs your attention</h2>' + (attention.length ? '<div class="list">' + attention.join('') + '</div>' : '<p class="muted">Nothing is waiting. Alhamdulillah!</p>') + '</section>' +
      '<section class="card stack"><h2 style="font-size:1.4rem">' + (isAdmin ? 'Classes' : 'My classes') + '</h2>' +
      (D.classes.length ? '<div class="list">' + D.classes.filter(function (c) { return c.active; }).map(function (c) {
        var link = I.safeUrl(c.meet_link);
        return '<div class="li"><span class="grow"><b>' + esc(c.name) + '</b><span class="small muted" style="display:block">' + esc([level(c.level_id).name, c.schedule, c.students + ' students'].filter(Boolean).join(' · ')) + '</span></span>' + (link ? '<a class="btn sm" href="' + esc(link) + '" target="_blank" rel="noopener">' + icon('video') + 'Start</a>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="muted">' + (isAdmin ? 'No classes yet.' : 'The admin has not given you a class yet.') + '</p>') + '</section></div>';
  };

  // ----------------------------------------------------------- students
  PAGES.students = function (el) {
    var q = ui.search.toLowerCase();
    var rows = D.students.filter(function (s) {
      return (!ui.classFilter || s.class_id === ui.classFilter) && (!q || (s.full_name + ' ' + s.code + ' ' + (s.parent_name || '')).toLowerCase().indexOf(q) >= 0);
    });
    el.innerHTML = head('Students', D.students.length + ' student' + (D.students.length === 1 ? '' : 's') + (isAdmin ? ' in the academy' : ' in your classes'),
      '<div class="row">' + (D.students.length ? '<button class="btn ghost" data-act="exportStudents">' + icon('download') + 'Download list</button>' : '') + (isAdmin ? '<button class="btn" data-act="studentForm">' + icon('plus') + 'Add student</button>' : '') + '</div>') +
      '<div class="toolbar"><input type="search" id="stSearch" placeholder="Search by name or ID" value="' + esc(ui.search) + '" aria-label="Search students">' +
      '<select id="stClass" aria-label="Filter by class">' + classOptions(ui.classFilter, 'All classes') + '</select></div>' +
      (rows.length ? '<div class="tablewrap"><table class="t"><thead><tr><th>Student</th><th>Class</th><th>Lessons</th><th class="num">Quiz avg</th><th class="num">Attendance</th><th class="num">Stars</th><th>Last seen</th>' + (isAdmin ? '<th class="num">Fees due</th>' : '') + '</tr></thead><tbody>' +
        rows.map(function (s) {
          var c = klass(s.class_id), pct = s.lessons_total ? Math.round(100 * s.lessons_read / s.lessons_total) : 0;
          return '<tr class="click" data-act="openStudent" data-id="' + s.id + '" tabindex="0"><td><div class="row" style="flex-wrap:nowrap">' + avatar(s.full_name, s.avatar, 'sm') + '<div><b>' + esc(s.full_name) + '</b>' + (s.active ? '' : ' <span class="chip grey">Not active</span>') + '<div class="small muted">' + esc(s.code) + ' · ' + esc(level(s.level_id).name || '') + '</div></div></div></td>' +
            '<td>' + esc(c ? c.name : '—') + '</td><td style="min-width:130px"><div class="bar"><i style="width:' + pct + '%"></i></div><span class="small muted">' + s.lessons_read + ' of ' + s.lessons_total + '</span></td>' +
            '<td class="num">' + (s.quiz_avg == null ? '—' : s.quiz_avg + '%') + '</td><td class="num">' + (s.attendance == null ? '—' : s.attendance + '%') + '</td><td class="num">' + s.stars + '</td><td>' + esc(ago(s.last_seen)) + '</td>' +
            (isAdmin ? '<td class="num">' + (Number(s.due) > 0 ? '<span class="chip red">' + esc(money(s.due, cur())) + '</span>' : '<span class="chip green">Paid</span>') + '</td>' : '') + '</tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="card">' + empty('users', D.students.length ? 'No student matches your search.' : (isAdmin ? 'No students yet. Add your first student to create their login.' : 'No students are in your classes yet.'), isAdmin && !D.students.length ? '<button class="btn" data-act="studentForm">' + icon('plus') + 'Add student</button>' : '') + '</div>');
    var s = document.getElementById('stSearch');
    s.addEventListener('input', function () { ui.search = s.value; var pos = s.selectionStart; PAGES.students(el); var n = document.getElementById('stSearch'); n.focus(); n.setSelectionRange(pos, pos); });
    document.getElementById('stClass').addEventListener('change', function (e) { ui.classFilter = e.target.value; PAGES.students(el); });
  };
  actions.openStudent = function (el) { go('student', el.dataset.id); };
  actions.exportStudents = function () {
    var rows = [['Student ID', 'Name', 'Gender', 'Birth year', 'Level', 'Class', 'Parent', 'WhatsApp', 'Country', 'Plan', 'Monthly fee', 'Stars', 'Lessons read', 'Quiz average %', 'Attendance %', 'Active', 'Parent report link']];
    D.students.forEach(function (s) { var c = klass(s.class_id); rows.push([s.code, s.full_name, s.gender, s.birth_year, level(s.level_id).name, c ? c.name : '', s.parent_name, s.parent_whatsapp, s.country, PLAN_NAMES[s.plan] || '', isAdmin ? s.monthly_fee : '', s.stars, s.lessons_read, s.quiz_avg, s.attendance, s.active ? 'Yes' : 'No', parentLink(s)]); });
    csvDownload('ilm-students.csv', rows);
  };

  actions.studentForm = function (el) {
    var s = el.dataset.id ? student(el.dataset.id) : {};
    var plans = (D.settings && D.settings.plans) || {};
    modal('<h2>' + (s.id ? 'Edit student' : 'Add a student') + '</h2><form class="stack" data-form="saveStudent">' + (s.id ? '<input type="hidden" name="id" value="' + s.id + '">' : '') +
      '<div class="grid2"><label class="f">Student\'s full name<input type="text" name="full_name" value="' + esc(s.full_name) + '" required></label>' +
      '<label class="f">Boy or girl<select name="gender">' + opt('', 'Choose', s.gender) + opt('boy', 'Boy', s.gender) + opt('girl', 'Girl', s.gender) + '</select></label></div>' +
      '<div class="grid3"><label class="f">Year of birth<input type="number" name="birth_year" min="2005" max="2030" value="' + esc(s.birth_year) + '"></label>' +
      '<label class="f">Class<select name="class_id" id="sfClass">' + classOptions(s.class_id, 'No class yet') + '</select></label>' +
      '<label class="f">Level<select name="level_id" id="sfLevel">' + D.levels.map(function (l) { return opt(l.id, l.name + ' (' + l.age_min + '–' + l.age_max + ')', s.level_id || 1); }).join('') + '</select></label></div>' +
      '<div class="grid2"><label class="f">Parent\'s name<input type="text" name="parent_name" value="' + esc(s.parent_name) + '"></label>' +
      '<label class="f">Parent\'s WhatsApp <span class="hint">With country code, like +44 7700 900123</span><input type="tel" name="parent_whatsapp" value="' + esc(s.parent_whatsapp) + '"></label></div>' +
      '<div class="grid3"><label class="f">Country<input type="text" name="country" value="' + esc(s.country) + '"></label>' +
      '<label class="f">Plan<select name="plan" id="sfPlan">' + opt('', 'Choose', s.plan) + Object.keys(PLAN_NAMES).map(function (k) { return opt(k, PLAN_NAMES[k], s.plan); }).join('') + '</select></label>' +
      '<label class="f">Monthly fee (' + esc(cur()) + ')<input type="number" name="monthly_fee" id="sfFee" min="0" step="0.01" value="' + esc(s.id ? Number(s.monthly_fee) : '') + '"></label></div>' +
      (s.id ? '<label class="f">Status<select name="active">' + opt('true', 'Active — can log in', String(s.active)) + opt('false', 'Not active — login switched off', String(s.active)) + '</select></label>' : '<p class="info">The Student ID and secret PIN are created automatically when you save.</p>') +
      '<div class="foot">' + (s.id ? '<button type="button" class="btn danger" data-act="deleteStudent" data-id="' + s.id + '">' + icon('trash') + 'Delete</button><span class="grow"></span>' : '') + '<button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" type="submit">' + (s.id ? 'Save changes' : 'Create student') + '</button></div></form>', true);
    document.getElementById('sfClass').addEventListener('change', function (e) { var c = klass(e.target.value); if (c) { if (c.level_id) document.getElementById('sfLevel').value = c.level_id; if (c.plan && !document.getElementById('sfPlan').value) { document.getElementById('sfPlan').value = c.plan; document.getElementById('sfFee').value = plans[c.plan] || ''; } } });
    document.getElementById('sfPlan').addEventListener('change', function (e) { if (plans[e.target.value] != null) document.getElementById('sfFee').value = plans[e.target.value]; });
  };
  forms.saveStudent = function (f, d, btn) {
    busy(btn, async function () {
      var out = await rpc('ilm_admin_save_student', { p: d });
      await load();
      if (out.pin) { page = 'student'; param = out.id; render(); credsModal(student(out.id), out.pin, true); }
      else { closeModal(); toast('Saved'); render(); }
    });
  };
  actions.deleteStudent = function (el) {
    var s = student(el.dataset.id);
    modal('<h2>Delete ' + esc(s.full_name) + '?</h2><p>This removes the student and <b>all</b> their progress, marks, attendance and fee records for good. It cannot be undone.</p><p class="note">To keep the records but stop the login, choose "Not active" instead.</p>' +
      '<div class="foot"><button class="btn ghost" data-act="closeModal">Keep student</button><button class="btn danger" data-act="deleteStudentYes" data-id="' + s.id + '">Yes, delete everything</button></div>');
  };
  actions.deleteStudentYes = function (el) {
    busy(el, async function () { await rpc('ilm_admin_delete_student', { p_id: el.dataset.id }); closeModal(); toast('Student deleted'); page = 'students'; await refresh(); });
  };

  function credsText(s, pin) {
    return 'Assalamu alaykum' + (s.parent_name ? ' ' + s.parent_name : '') + '. ' + I.firstName(s.full_name) + '\'s ILM International learning portal is ready.\n\n' +
      'Student login: ' + portal() + '\nStudent ID: ' + s.code + '\nSecret PIN: ' + pin + '\n\n' +
      'Your private parent page (progress report and fees):\n' + parentLink(s) + '\n\nPlease keep these safe. JazakAllahu khayran.';
  }
  function credsModal(s, pin, isNew) {
    var text = credsText(s, pin);
    modal('<h2>' + (isNew ? esc(I.firstName(s.full_name)) + ' is ready to learn' : 'New PIN for ' + esc(I.firstName(s.full_name))) + '</h2>' +
      '<div class="creds"><div><div class="k">Student ID</div><div class="v">' + esc(s.code) + '</div></div><div><div class="k">Secret PIN</div><div class="v">' + esc(pin) + '</div></div></div>' +
      '<p class="note"><b>Send this now.</b> For safety the PIN is shown only once. If it gets lost, you can make a new one with "New PIN".</p>' +
      '<div class="foot">' + (s.parent_whatsapp ? '<a class="btn wa" target="_blank" rel="noopener" href="' + esc(I.waLink(s.parent_whatsapp, text)) + '">' + icon('wa') + 'Send to parent on WhatsApp</a>' : '') +
      '<button class="btn ghost" data-act="copy" data-label="Login details copied" data-text="' + esc(text) + '">' + icon('copy') + 'Copy message</button><button class="btn" data-act="closeModal">Done</button></div>');
  }
  actions.resetPin = function (el) {
    var s = student(el.dataset.id);
    modal('<h2>Make a new PIN?</h2><p>' + esc(I.firstName(s.full_name)) + '\'s old PIN will stop working straight away and they will need the new one to log in.</p><div class="foot"><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" data-act="resetPinYes" data-id="' + s.id + '">Make new PIN</button></div>');
  };
  actions.resetPinYes = function (el) {
    busy(el, async function () { var out = await rpc('ilm_staff_reset_pin', { p_student: el.dataset.id }); credsModal(student(el.dataset.id), out.pin, false); });
  };

  // ------------------------------------------------------ one student
  var T = null;   // student detail
  PAGES.student = function (el) {
    el.innerHTML = '<div class="loading"><div><i></i>Opening the student…</div></div>';
    rpc('ilm_staff_student', { p_student: param }).then(function (data) { T = data; if (page === 'student') renderStudent(el); }).catch(function (e) { I.fail(e); go('students'); });
  };
  function renderStudent(el) {
    var s = T.student, c = klass(s.class_id), latest = {};
    T.assessments.forEach(function (a) { if (!latest[a.skill]) latest[a.skill] = a; });
    var reminder = 'Assalamu alaykum' + (s.parent_name ? ' ' + s.parent_name : '') + '. Here is ' + I.firstName(s.full_name) + '\'s private progress page on the ILM International portal:\n' + parentLink(s);
    el.innerHTML = '<div class="page-h"><button class="btn ghost sm" data-act="nav" data-page="students">' + icon('back') + 'All students</button></div>' +
      '<section class="card" style="margin-bottom:18px"><div class="row">' + avatar(s.full_name, s.avatar, 'lg') + '<div class="grow"><h1 style="font-size:1.9rem;line-height:1.1">' + esc(s.full_name) + '</h1>' +
      '<div class="row" style="gap:6px;margin-top:8px"><span class="chip">' + icon('key') + esc(s.code) + '</span><span class="chip gold">' + esc(level(s.level_id).name || 'No level') + '</span>' + (c ? '<span class="chip blue">' + esc(c.name) + '</span>' : '<span class="chip grey">No class</span>') + (s.active ? '' : '<span class="chip red">Not active</span>') + '<span class="chip grey">Last seen: ' + esc(ago(s.last_seen)) + '</span></div></div>' +
      '<span class="stars-pill">' + icon('star', 'fill') + s.stars + '</span></div>' +
      '<div class="row" style="margin-top:16px;gap:8px"><button class="btn" data-act="assessForm">' + icon('clipboard') + 'Add assessment</button><button class="btn gold" data-act="starsForm">' + icon('star', 'fill') + 'Give stars</button>' +
      '<button class="btn ghost" data-act="certForm">' + icon('award') + 'Certificate</button><button class="btn ghost" data-act="resetPin" data-id="' + s.id + '">' + icon('key') + 'New PIN</button>' +
      (s.parent_whatsapp ? '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(I.waLink(s.parent_whatsapp, reminder)) + '">' + icon('wa') + 'Send parent link</a>' : '') +
      '<button class="btn ghost" data-act="copy" data-label="Parent link copied" data-text="' + esc(parentLink(s)) + '">' + icon('link') + 'Copy parent link</button>' +
      (isAdmin ? '<button class="btn ghost" data-act="studentForm" data-id="' + s.id + '">' + icon('edit') + 'Edit</button>' : '') + '</div></section>' +

      '<section class="tiles" style="margin-bottom:18px"><div class="tile"><span class="lbl">' + icon('book') + 'Lessons read</span><b>' + s.lessons_read + ' <span style="font-size:.5em;color:var(--muted)">of ' + s.lessons_total + '</span></b></div>' +
      '<div class="tile"><span class="lbl">' + icon('clipboard') + 'Quiz average</span><b>' + (s.quiz_avg == null ? '—' : s.quiz_avg + '%') + '</b></div>' +
      '<div class="tile"><span class="lbl">' + icon('calendar') + 'Attendance</span><b>' + (s.attendance == null ? '—' : s.attendance + '%') + '</b></div>' +
      '<div class="tile"><span class="lbl">' + icon('users') + 'Parent</span><b style="font-size:1.2rem;font-family:inherit;font-weight:800">' + esc(s.parent_name || '—') + '</b><span class="sub">' + esc(s.parent_whatsapp || 'No WhatsApp saved') + '</span></div></section>' +

      '<div class="cols"><div class="stack">' +
      '<section class="card stack"><h2 style="font-size:1.4rem">Learning path</h2>' + (T.path.length ? T.path.map(function (u, i) {
        var read = u.lessons.filter(function (l) { return l.read; }).length, ex = u.exam;
        return '<details class="acc" style="box-shadow:none;border:1.5px solid var(--line)"' + (read && read < u.lessons.length ? ' open' : '') + '><summary><span class="unit-n">' + (i + 1) + '</span><span class="grow"><b>' + esc(u.title) + '</b><span class="small muted" style="display:block">' + read + ' of ' + u.lessons.length + ' read' + (ex ? ' · exam ' + ex.best_score + '/' + ex.total + (ex.passed ? ' passed' : '') : '') + '</span></span>' + (ex && ex.passed ? '<span class="chip gold">' + icon('award') + 'Passed</span>' : '') + icon('chev', 'chev') + '</summary><div class="body">' +
          u.lessons.map(function (l) { return '<div class="row small"><span class="grow">' + esc(l.title) + '</span>' + (l.passed ? '<span class="chip gold">Quiz ' + l.best_score + '/' + l.total + '</span>' : l.total ? '<span class="chip grey">Quiz ' + l.best_score + '/' + l.total + ' · ' + l.attempts + ' tries</span>' : l.read ? '<span class="chip">Read</span>' : '<span class="chip grey">Not started</span>') + '</div>'; }).join('') + '</div></details>';
      }).join('') : '<p class="muted">No lessons in this level yet.</p>') + '</section>' +
      '<section class="card stack"><h2 style="font-size:1.4rem">Recent quizzes and exams</h2>' + (T.attempts.length ? '<div class="list">' + T.attempts.slice(0, 10).map(function (a) {
        return '<div class="li"><span class="grow"><b>' + esc(a.title) + '</b><span class="small muted" style="display:block">' + (a.kind === 'unit' ? 'Unit exam' : 'Lesson quiz') + ' · ' + esc(fmtDate(a.created_at)) + '</span></span><span class="chip ' + (a.score * 3 >= a.total * 2 ? 'green' : 'grey') + '">' + a.score + ' / ' + a.total + '</span></div>';
      }).join('') + '</div>' : '<p class="muted">No quizzes taken yet.</p>') + '</section>' +
      '<section class="card stack"><h2 style="font-size:1.4rem">Homework</h2>' + (T.homework.length ? '<div class="list">' + T.homework.map(function (h) {
        return '<div class="li"><span class="grow"><b>' + esc(h.title) + '</b>' + (h.answer ? '<span class="small muted" style="display:block">' + esc(h.answer) + '</span>' : '') + '</span>' + (h.submitted_at ? (h.stars != null ? '<span class="chip gold">' + icon('star', 'fill') + h.stars + '</span>' : '<span class="chip blue">To mark</span>') : '<span class="chip grey">Not handed in</span>') + '</div>';
      }).join('') + '</div>' : '<p class="muted">No homework set for this class yet.</p>') + '</section></div>' +

      '<div class="stack"><section class="card stack"><div class="row"><h2 class="grow" style="font-size:1.4rem">Teacher\'s assessment</h2><button class="btn soft sm" data-act="assessForm">' + icon('plus') + 'Add</button></div>' +
      (T.assessments.length ? '<div class="list">' + Object.keys(I.SKILLS).filter(function (k) { return latest[k]; }).map(function (k) { return '<div class="li"><span class="grow"><b>' + esc(I.SKILLS[k]) + '</b><span class="small muted" style="display:block">' + esc(fmtDate(latest[k].created_at)) + ' · ' + esc(latest[k].teacher_name || '') + '</span></span>' + I.dots5(latest[k].score) + '</div>'; }).join('') + '</div>' +
        T.assessments.filter(function (a) { return a.note; }).slice(0, 3).map(function (a) { return '<p class="note small"><b>' + esc(I.SKILLS[a.skill] || a.skill) + ':</b> ' + esc(a.note) + '</p>'; }).join('')
        : '<p class="muted">Mark recitation, salah practice and manners here. Parents see these marks in their report.</p>') + '</section>' +
      '<section class="card stack"><h2 style="font-size:1.4rem">Attendance</h2>' + (T.attendance.length ? '<div class="attdots">' + T.attendance.slice().reverse().map(function (a) { return '<i class="' + esc(a.status) + '" title="' + esc(fmtDate(a.day) + ' — ' + a.status) + '"></i>'; }).join('') + '</div><p class="small muted">Green: present · Gold: late · Red: absent</p>' : '<p class="muted">No attendance marked yet.</p>') + '</section>' +
      '<section class="card stack"><h2 style="font-size:1.4rem">Badges and certificates</h2>' + (I.badgesHtml(T.badges, false) || '<p class="muted">No badges yet.</p>') +
      (T.certificates.length ? '<div class="list">' + T.certificates.map(function (x) { return '<div class="li">' + icon('award') + '<span class="grow"><b>' + esc(x.title) + '</b><span class="small muted" style="display:block">' + esc(fmtDate(x.issued_at)) + '</span></span><button class="btn soft sm" data-act="staffCert" data-id="' + x.id + '">View</button></div>'; }).join('') + '</div>' : '') + '</section>' +
      '<section class="card stack"><h2 style="font-size:1.4rem">Stars</h2>' + (T.stars_log.length ? '<div class="list">' + T.stars_log.slice(0, 8).map(function (x) { return '<div class="li small"><span class="chip gold">+' + x.amount + '</span><span class="grow">' + esc(x.reason || '') + '</span><span class="muted nowrap">' + esc(fmtDate(x.created_at)) + '</span></div>'; }).join('') + '</div>' : '<p class="muted">No stars yet.</p>') + '</section>' +
      (T.invoices ? '<section class="card stack"><div class="row"><h2 class="grow" style="font-size:1.4rem">Fees</h2><button class="btn soft sm" data-act="nav" data-page="fees">Open fees</button></div>' + (T.invoices.length ? '<div class="list">' + T.invoices.map(function (i) { return '<div class="li"><span class="grow"><b>' + esc(i.description) + '</b><span class="small muted" style="display:block">' + (i.status === 'paid' ? 'Paid ' + esc(fmtDate(i.paid_at)) + ' · ' + esc(i.method || '') : i.due_date ? 'Due ' + esc(fmtDate(i.due_date)) : '') + '</span></span><b>' + esc(money(i.amount, i.currency)) + '</b>' + statusChip(i) + '</div>'; }).join('') + '</div>' : '<p class="muted">No fees created for this student yet.</p>') + '</section>' : '') +
      '</div></div>';
  }
  actions.staffCert = function (el) {
    var c = T.certificates.filter(function (x) { return x.id === el.dataset.id; })[0];
    if (c) I.showCertificate(c, T.student.full_name, render);
  };
  actions.assessForm = function () {
    modal('<h2>Assess ' + esc(I.firstName(T.student.full_name)) + '</h2><form class="stack" data-form="saveAssess">' +
      '<label class="f">What are you marking?<select name="skill">' + Object.keys(I.SKILLS).map(function (k) { return opt(k, I.SKILLS[k]); }).join('') + '</select></label>' +
      '<div class="f"><span>Mark <span class="hint">1 = needs a lot of help · 3 = good · 5 = excellent</span></span><div class="rate" id="rate">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-act="rate" data-n="' + n + '" aria-pressed="' + (n === 4) + '">' + n + '</button>'; }).join('') + '</div><input type="hidden" name="score" value="4"></div>' +
      '<label class="f">Note for the parent <span class="hint">Say what went well, then one thing to practise. Parents can read this.</span><textarea name="note" placeholder="Yusuf recited Al-Fatiha clearly today. Next: practise the last two ayat slowly."></textarea></label>' +
      '<div class="foot"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" type="submit">Save assessment</button></div></form>');
  };
  actions.rate = function (el) {
    el.parentNode.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === el)); });
    el.closest('form').querySelector('input[name=score],input[name=stars]').value = el.dataset.n;
  };
  forms.saveAssess = function (f, d, btn) {
    busy(btn, async function () { await rpc('ilm_staff_assess', { p_student: T.student.id, p_skill: d.skill, p_score: Number(d.score), p_note: d.note }); closeModal(); toast('Assessment saved'); render(); });
  };
  actions.starsForm = function () {
    modal('<h2>Give stars to ' + esc(I.firstName(T.student.full_name)) + '</h2><form class="stack" data-form="saveStars"><div class="grid2"><label class="f">How many?<select name="amount">' + [1, 2, 3, 5, 10].map(function (n) { return opt(n, n + (n === 1 ? ' star' : ' stars'), 2); }).join('') + '</select></label>' +
      '<label class="f">What for? <span class="hint">The child sees this</span><input type="text" name="reason" maxlength="80" placeholder="Helping a classmate" required></label></div>' +
      '<div class="foot"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn gold" type="submit">' + icon('star', 'fill') + 'Give stars</button></div></form>');
  };
  forms.saveStars = function (f, d, btn) {
    busy(btn, async function () { await rpc('ilm_staff_give_stars', { p_student: T.student.id, p_amount: Number(d.amount), p_reason: d.reason }); closeModal(); toast('Stars given'); await load(); render(); });
  };
  actions.certFormStudent = actions.certForm = function () {
    modal('<h2>Award a certificate</h2><p class="muted">Unit certificates are given automatically when a child passes the unit exam. Use this for anything else you want to celebrate.</p><form class="stack" data-form="saveCert">' +
      '<label class="f">Certificate for<input type="text" name="title" maxlength="80" placeholder="Memorising Surah Al-Fatiha" required></label>' +
      '<label class="f">A line of praise <span class="hint">Optional</span><textarea name="detail" placeholder="For reciting the whole surah by heart, beautifully and with confidence."></textarea></label>' +
      '<div class="foot"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" type="submit">' + icon('award') + 'Award certificate</button></div></form>');
  };
  forms.saveCert = function (f, d, btn) {
    busy(btn, async function () { await rpc('ilm_staff_certificate', { p_student: T.student.id, p_title: d.title, p_detail: d.detail }); closeModal(); toast('Certificate awarded'); render(); });
  };

  // ------------------------------------------------------------ classes
  PAGES.classes = function (el) {
    el.innerHTML = head(isAdmin ? 'Classes' : 'My classes', 'Each class has a level, a teacher and a live-class link.', isAdmin ? '<button class="btn" data-act="classForm">' + icon('plus') + 'New class</button>' : '') +
      (D.classes.length ? '<div class="tiles" style="grid-template-columns:repeat(auto-fill,minmax(290px,1fr))">' + D.classes.map(function (c) {
        var t = teacher(c.teacher_id), link = I.safeUrl(c.meet_link);
        return '<section class="card stack" style="gap:12px"><div class="row"><h2 class="grow" style="font-size:1.35rem;line-height:1.15">' + esc(c.name) + '</h2>' + (c.active ? '' : '<span class="chip grey">Closed</span>') + '</div>' +
          '<div class="row" style="gap:6px"><span class="chip gold">' + esc(level(c.level_id).name || 'No level') + '</span>' + (c.plan ? '<span class="chip blue">' + esc(PLAN_NAMES[c.plan] || c.plan) + '</span>' : '') + '<span class="chip">' + icon('users') + c.students + '</span></div>' +
          '<div class="row small" style="flex-wrap:nowrap;align-items:flex-start;gap:10px;color:var(--muted)">' + icon('cap') + '<span><b style="color:var(--ink)">' + esc(t ? t.full_name : 'No teacher yet') + '</b><br>' + esc(c.schedule || 'No timetable yet') + '</span></div>' +
          '<div class="row" style="gap:8px">' + (link ? '<a class="btn sm" href="' + esc(link) + '" target="_blank" rel="noopener">' + icon('video') + 'Start class</a>' : '<span class="chip red">No class link</span>') +
          '<button class="btn soft sm" data-act="toAttendance" data-id="' + c.id + '">Attendance</button><button class="btn soft sm" data-act="toHomework" data-id="' + c.id + '">Homework</button>' +
          (isAdmin ? '<button class="btn ghost sm" data-act="classForm" data-id="' + c.id + '">' + icon('edit') + 'Edit</button>' : '') + '</div></section>';
      }).join('') + '</div>' : '<div class="card">' + empty('video', isAdmin ? 'No classes yet. Create one to start adding students.' : 'The admin has not given you a class yet.', isAdmin ? '<button class="btn" data-act="classForm">' + icon('plus') + 'New class</button>' : '') + '</div>');
  };
  actions.toAttendance = function (el) { ui.attClass = el.dataset.id; ui.att = {}; go('attendance'); };
  actions.toHomework = function (el) { ui.hwClass = el.dataset.id; go('homework'); };
  actions.classForm = function (el) {
    var c = el.dataset.id ? klass(el.dataset.id) : {};
    modal('<h2>' + (c.id ? 'Edit class' : 'New class') + '</h2><form class="stack" data-form="saveClass">' + (c.id ? '<input type="hidden" name="id" value="' + c.id + '">' : '') +
      '<label class="f">Class name<input type="text" name="name" value="' + esc(c.name) + '" placeholder="Noor · Weekend A" required></label>' +
      '<div class="grid3"><label class="f">Level<select name="level_id">' + D.levels.map(function (l) { return opt(l.id, l.name + ' (' + l.age_min + '–' + l.age_max + ')', c.level_id || 1); }).join('') + '</select></label>' +
      '<label class="f">Teacher<select name="teacher_id">' + opt('', 'Choose later', c.teacher_id) + D.teachers.filter(function (t) { return t.approved; }).map(function (t) { return opt(t.id, t.full_name, c.teacher_id); }).join('') + '</select></label>' +
      '<label class="f">Plan<select name="plan">' + opt('', 'Any', c.plan) + Object.keys(PLAN_NAMES).map(function (k) { return opt(k, PLAN_NAMES[k], c.plan); }).join('') + '</select></label></div>' +
      '<label class="f">Timetable <span class="hint">Shown to students and parents. Say the time zone.</span><input type="text" name="schedule" value="' + esc(c.schedule) + '" placeholder="Saturday and Sunday, 6:00 PM London time"></label>' +
      '<label class="f">Live-class link <span class="hint">Zoom or Google Meet link. Students see a "Join my class" button.</span><input type="url" name="meet_link" value="' + esc(c.meet_link) + '" placeholder="https://"></label>' +
      (c.id ? '<label class="f">Status<select name="active">' + opt('true', 'Open', String(c.active)) + opt('false', 'Closed', String(c.active)) + '</select></label>' : '') +
      '<div class="foot"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" type="submit">' + (c.id ? 'Save changes' : 'Create class') + '</button></div></form>');
  };
  forms.saveClass = function (f, d, btn) {
    busy(btn, async function () { var id = await rpc('ilm_admin_save_class', { p: d }); closeModal(); toast('Class saved'); if (!ui.attClass) ui.attClass = ui.hwClass = id; await refresh(); });
  };

  // --------------------------------------------------------- attendance
  PAGES.attendance = function (el) {
    if (!D.classes.length) { el.innerHTML = head('Attendance') + '<div class="card">' + empty('calendar', 'Create a class first, then you can mark attendance.') + '</div>'; return; }
    if (!klass(ui.attClass)) ui.attClass = D.classes[0].id;
    el.innerHTML = head('Attendance', 'Mark who came to class. Parents see this in their report.') +
      '<div class="toolbar"><select id="attClass" aria-label="Class">' + classOptions(ui.attClass) + '</select><input type="date" id="attDay" value="' + esc(ui.attDay) + '" max="' + I.today() + '" aria-label="Date"></div><div id="attBody"><div class="loading" style="min-height:160px"><div><i></i></div></div></div>';
    document.getElementById('attClass').addEventListener('change', function (e) { ui.attClass = e.target.value; PAGES.attendance(el); });
    document.getElementById('attDay').addEventListener('change', function (e) { ui.attDay = e.target.value || I.today(); PAGES.attendance(el); });
    rpc('ilm_staff_attendance', { p_class: ui.attClass, p_day: ui.attDay }).then(function (list) {
      ui.att = {}; list.forEach(function (s) { ui.att[s.id] = s.status || ''; }); ui.attList = list; renderAtt();
    }).catch(I.fail);
  };
  function renderAtt() {
    var box = document.getElementById('attBody'); if (!box) return;
    var list = ui.attList, marked = list.filter(function (s) { return ui.att[s.id]; }).length;
    box.innerHTML = list.length ? '<section class="card stack"><div class="row"><b class="grow">' + esc(fmtDate(ui.attDay)) + ' · ' + marked + ' of ' + list.length + ' marked</b><button class="btn soft sm" data-act="attAll">Mark everyone present</button></div><div class="list">' +
      list.map(function (s) {
        return '<div class="li">' + avatar(s.full_name, s.avatar, 'sm') + '<b class="grow">' + esc(s.full_name) + '</b><div class="seg att" role="group" aria-label="Attendance for ' + esc(s.full_name) + '">' +
          ['present', 'late', 'absent'].map(function (v) { return '<button data-act="attSet" data-id="' + s.id + '" data-v="' + v + '" aria-pressed="' + (ui.att[s.id] === v) + '">' + v.charAt(0).toUpperCase() + v.slice(1) + '</button>'; }).join('') + '</div></div>';
      }).join('') + '</div><div class="foot" style="display:flex;justify-content:flex-end"><button class="btn" data-act="attSave"' + (marked ? '' : ' disabled') + '>Save attendance</button></div></section>'
      : '<div class="card">' + empty('users', 'No students are in this class yet.') + '</div>';
  }
  actions.attSet = function (el) { ui.att[el.dataset.id] = el.dataset.v; renderAtt(); };
  actions.attAll = function () { ui.attList.forEach(function (s) { ui.att[s.id] = 'present'; }); renderAtt(); };
  actions.attSave = function (el) {
    busy(el, async function () {
      var marks = {}; Object.keys(ui.att).forEach(function (k) { if (ui.att[k]) marks[k] = ui.att[k]; });
      var n = await rpc('ilm_staff_attendance_save', { p_class: ui.attClass, p_day: ui.attDay, p_marks: marks });
      toast('Attendance saved for ' + n + ' student' + (n === 1 ? '' : 's')); load();
    });
  };

  // ----------------------------------------------------------- homework
  var HW = [];
  PAGES.homework = function (el) {
    if (!D.classes.length) { el.innerHTML = head('Homework') + '<div class="card">' + empty('pen', 'Create a class first, then you can set homework.') + '</div>'; return; }
    if (!klass(ui.hwClass)) ui.hwClass = D.classes[0].id;
    el.innerHTML = head('Homework', 'Set small tasks, read the answers and reward effort with stars.', '<button class="btn" data-act="hwForm">' + icon('plus') + 'Set homework</button>') +
      '<div class="toolbar"><select id="hwClass" aria-label="Class">' + classOptions(ui.hwClass) + '</select></div><div id="hwBody"><div class="loading" style="min-height:160px"><div><i></i></div></div></div>';
    document.getElementById('hwClass').addEventListener('change', function (e) { ui.hwClass = e.target.value; PAGES.homework(el); });
    rpc('ilm_staff_homework', { p_class: ui.hwClass }).then(function (list) { HW = list; renderHw(); }).catch(I.fail);
  };
  function renderHw() {
    var box = document.getElementById('hwBody'); if (!box) return;
    box.innerHTML = HW.length ? HW.map(function (h) {
      var waiting = h.submissions.filter(function (s) { return !s.reviewed; }).length;
      return '<details class="acc"' + (waiting ? ' open' : '') + '><summary><span class="unit-n">' + icon('pen') + '</span><span class="grow"><b>' + esc(h.title) + '</b><span class="small muted" style="display:block">' + (h.due_date ? 'Due ' + esc(fmtDate(h.due_date)) + ' · ' : '') + h.submissions.length + ' of ' + h.class_size + ' handed in</span></span>' +
        (waiting ? '<span class="chip gold">' + waiting + ' to mark</span>' : h.submissions.length ? '<span class="chip green">' + icon('check') + 'All marked</span>' : '') + icon('chev', 'chev') + '</summary><div class="body">' +
        (h.details ? '<p>' + esc(h.details) + '</p>' : '') +
        (h.submissions.length ? h.submissions.map(function (s) {
          return '<form class="lesson-row" data-form="reviewHw" style="align-items:flex-start"><input type="hidden" name="homework" value="' + h.id + '"><input type="hidden" name="student" value="' + s.student_id + '"><input type="hidden" name="stars" value="' + (s.stars == null ? 3 : s.stars) + '">' +
            '<div class="grow" style="min-width:220px"><b>' + esc(s.full_name) + '</b> <span class="small muted">' + esc(fmtDate(s.submitted_at)) + '</span><p style="margin-top:4px">' + esc(s.answer) + '</p></div>' +
            '<div class="stack" style="gap:8px;flex:1 1 260px"><div class="row" style="gap:8px"><span class="small muted">Stars</span><div class="rate">' + [0, 1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-act="rate" data-n="' + n + '" aria-pressed="' + ((s.stars == null ? 3 : s.stars) === n) + '" style="width:36px;height:36px">' + n + '</button>'; }).join('') + '</div></div>' +
            '<input type="text" name="feedback" maxlength="200" placeholder="A kind word for the child" value="' + esc(s.feedback) + '" aria-label="Feedback"><div><button class="btn sm" type="submit">' + (s.reviewed ? 'Update' : 'Save mark') + '</button></div></div></form>';
        }).join('') : '<p class="muted small">No answers yet.</p>') +
        '<div class="row"><button class="btn ghost sm" data-act="hwForm" data-id="' + h.id + '">' + icon('edit') + 'Edit</button><button class="btn danger sm" data-act="hwDelete" data-id="' + h.id + '">' + icon('trash') + 'Delete</button></div></div></details>';
    }).join('') : '<div class="card">' + empty('pen', 'No homework for this class yet. Small, doable tasks work best — for example "Teach Bismillah to someone at home".', '<button class="btn" data-act="hwForm">' + icon('plus') + 'Set homework</button>') + '</div>';
  }
  actions.hwForm = function (el) {
    var h = el.dataset.id ? HW.filter(function (x) { return x.id === el.dataset.id; })[0] : {};
    modal('<h2>' + (h.id ? 'Edit homework' : 'Set homework') + '</h2><form class="stack" data-form="saveHw">' + (h.id ? '<input type="hidden" name="id" value="' + h.id + '">' : '') + '<input type="hidden" name="class_id" value="' + esc(ui.hwClass) + '">' +
      '<p class="chip blue" style="justify-self:start">' + esc((klass(ui.hwClass) || {}).name) + '</p>' +
      '<label class="f">Title<input type="text" name="title" value="' + esc(h.title) + '" maxlength="100" placeholder="Teach Bismillah at home" required></label>' +
      '<label class="f">What should they do?<textarea name="details" placeholder="Teach one person at home to say Bismillah before eating. Then write who you taught.">' + esc(h.details) + '</textarea></label>' +
      '<label class="f">Due date<input type="date" name="due_date" value="' + esc(h.due_date) + '"></label>' +
      '<div class="foot"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" type="submit">' + (h.id ? 'Save changes' : 'Set homework') + '</button></div></form>');
  };
  forms.saveHw = function (f, d, btn) {
    busy(btn, async function () { await rpc('ilm_staff_save_homework', { p: d }); closeModal(); toast('Homework saved'); PAGES.homework(document.getElementById('main')); });
  };
  actions.hwDelete = function (el) {
    modal('<h2>Delete this homework?</h2><p>The children\'s answers to it are deleted too. Stars already given stay.</p><div class="foot"><button class="btn ghost" data-act="closeModal">Keep</button><button class="btn danger" data-act="hwDeleteYes" data-id="' + el.dataset.id + '">Delete</button></div>');
  };
  actions.hwDeleteYes = function (el) {
    busy(el, async function () { await rpc('ilm_staff_delete_homework', { p_id: el.dataset.id }); closeModal(); PAGES.homework(document.getElementById('main')); });
  };
  forms.reviewHw = function (f, d, btn) {
    busy(btn, async function () {
      await rpc('ilm_staff_review', { p_homework: d.homework, p_student: d.student, p_stars: Number(d.stars), p_feedback: d.feedback });
      toast('Mark saved'); await load(); HW = await rpc('ilm_staff_homework', { p_class: ui.hwClass }); render();
    });
  };

  // ----------------------------------------------------------- syllabus
  PAGES.syllabus = function (el) {
    if (!ui.syllabus) {
      el.innerHTML = head('Syllabus') + '<div class="loading"><div><i></i>Opening the syllabus…</div></div>';
      rpc('ilm_syllabus').then(function (s) { ui.syllabus = s; if (page === 'syllabus') PAGES.syllabus(el); }).catch(I.fail);
      return;
    }
    var lv = ui.syllabus.filter(function (l) { return l.id === ui.level; })[0] || ui.syllabus[0];
    var lessons = 0; lv.units.forEach(function (u) { lessons += u.lessons.length; });
    var psy = String(lv.psychology || '').split('\n');
    el.innerHTML = head('Syllabus', 'Three levels, written for how children learn at each age.', isAdmin ? '<button class="btn" data-act="unitForm">' + icon('plus') + 'Add unit</button>' : '') +
      '<div class="toolbar"><div class="seg">' + ui.syllabus.map(function (l) { return '<button data-act="sylLevel" data-id="' + l.id + '" aria-pressed="' + (l.id === lv.id) + '">' + esc(l.name) + ' · ' + l.age_min + '–' + l.age_max + '</button>'; }).join('') + '</div></div>' +
      '<section class="card" style="background:var(--teal-d);color:#fff;position:relative;overflow:hidden;margin-bottom:14px">' + I.pattern() + '<div class="row" style="position:relative;align-items:flex-start"><div class="ar" lang="ar" style="font-size:3rem;color:var(--gold);line-height:1.2">' + esc(lv.arabic) + '</div><div class="grow"><h2 style="font-size:1.6rem">' + esc(lv.name) + ' · ages ' + lv.age_min + '–' + lv.age_max + '</h2><p style="color:#CFE5DF">' + esc(lv.about) + '</p><p class="small" style="color:var(--gold);margin-top:6px">' + lv.units.length + ' units · ' + lessons + ' lessons · a quiz after every lesson · an exam after every unit</p></div></div></section>' +
      '<details class="acc" style="margin-bottom:14px"><summary><span class="unit-n" style="background:var(--gold-l);color:var(--gold-d)">' + icon('heart') + '</span><span class="grow"><b>' + esc(psy[0] || 'How children this age learn') + '</b><span class="small muted" style="display:block">Read this before you teach the level</span></span>' + icon('chev', 'chev') + '</summary><div class="body"><ul style="margin:0;padding-left:20px;display:grid;gap:8px">' + psy.slice(1).map(function (p) { return '<li>' + esc(p.replace(/^- /, '')) + '</li>'; }).join('') + '</ul></div></details>' +
      lv.units.map(function (u, i) {
        return '<details class="acc"' + (i === 0 ? ' open' : '') + '><summary><span class="unit-n">' + (i + 1) + '</span><span class="grow"><b>' + esc(u.title) + '</b><span class="small muted" style="display:block">' + esc(u.summary || '') + '</span></span><span class="chip">' + u.lessons.length + ' lessons</span>' + icon('chev', 'chev') + '</summary><div class="body">' +
          (u.goal ? '<p class="info"><b>Goal:</b> ' + esc(u.goal) + '</p>' : '') +
          u.lessons.map(function (l, n) {
            return '<div class="lesson-row"><span class="chip grey">' + (n + 1) + '</span><span class="grow"><b>' + esc(l.title) + '</b>' + (l.published ? '' : ' <span class="chip red">Hidden</span>') + '<span class="small muted" style="display:block">' + l.minutes + ' min · ' + l.questions.length + ' quiz questions</span></span><button class="btn soft sm" data-act="lessonView" data-id="' + l.id + '">Open</button>' + (isAdmin ? '<button class="btn ghost sm" data-act="lessonForm" data-id="' + l.id + '">' + icon('edit') + 'Edit</button>' : '') + '</div>';
          }).join('') +
          (isAdmin ? '<div class="row"><button class="btn soft sm" data-act="lessonForm" data-unit="' + u.id + '">' + icon('plus') + 'Add lesson</button><button class="btn ghost sm" data-act="unitForm" data-id="' + u.id + '">' + icon('edit') + 'Edit unit</button></div>' : '') + '</div></details>';
      }).join('');
  };
  actions.sylLevel = function (el) { ui.level = Number(el.dataset.id); PAGES.syllabus(document.getElementById('main')); };
  function findLesson(id) { var out = null; ui.syllabus.forEach(function (lv) { lv.units.forEach(function (u) { u.lessons.forEach(function (l) { if (String(l.id) === String(id)) out = l; }); }); }); return out; }
  function findUnit(id) { var out = null; ui.syllabus.forEach(function (lv) { lv.units.forEach(function (u) { if (String(u.id) === String(id)) out = u; }); }); return out; }
  actions.lessonView = function (el) {
    var l = findLesson(el.dataset.id);
    modal('<div class="row"><h2 class="grow">' + esc(l.title) + '</h2><button class="btn ghost sm" data-act="closeModal" aria-label="Close">' + icon('x') + '</button></div>' +
      (l.teacher_note ? '<div class="note"><b>Teaching tip:</b> ' + esc(l.teacher_note) + '</div>' : '') +
      (l.hook ? '<p class="serif" style="font-size:1.3rem;color:var(--teal-d)">' + esc(l.hook) + '</p>' : '') +
      '<div class="slide" style="box-shadow:none;padding:0;animation:none;max-width:none">' + I.bodyBlocks(l.body).join('') + '</div>' +
      (l.arabic ? '<div class="phrase">' + I.pattern() + '<div class="ar" lang="ar" style="font-size:2rem">' + esc(l.arabic) + '</div><div class="tr">' + esc(l.translit || '') + '</div><div class="mn">' + esc(l.meaning || '') + '</div></div>' : '') +
      (l.action ? '<div class="todo">' + icon('sun') + '<p><b>Try it today:</b> ' + esc(l.action) + '</p></div>' : '') +
      '<h3>Quiz</h3>' + (l.questions.length ? l.questions.map(function (q, n) {
        return '<div class="review-item" style="background:var(--bg)"><b>' + (n + 1) + '. ' + esc(q.prompt) + '</b>' + q.options.map(function (o, k) { return '<span class="ans">' + (k === q.answer ? '<b style="color:var(--green)">✓ ' + esc(o) + '</b>' : '○ ' + esc(o)) + '</span>'; }).join('') + (q.explain ? '<span class="ans muted">' + esc(q.explain) + '</span>' : '') + '</div>';
      }).join('') : '<p class="muted">No quiz questions yet.</p>'), true);
  };
  function qEditor(q, n) {
    q = q || { options: ['', '', ''], answer: 0 };
    var o = q.options.concat(['', '', '', '']).slice(0, 4);
    return '<fieldset class="card flat stack qrow" style="padding:14px;gap:10px"><legend class="small" style="font-weight:800;padding:0 6px">Question ' + (n + 1) + '</legend>' +
      '<input type="text" class="q-prompt" placeholder="The question" value="' + esc(q.prompt) + '" aria-label="Question ' + (n + 1) + '">' +
      '<div class="grid2">' + o.map(function (x, k) { return '<label class="row" style="flex-wrap:nowrap;gap:8px"><input type="radio" name="ans' + n + '" value="' + k + '"' + (q.answer === k ? ' checked' : '') + ' aria-label="Correct answer is option ' + (k + 1) + '" style="width:20px;height:20px;flex:0 0 auto"><input type="text" class="q-opt" placeholder="Answer ' + (k + 1) + (k > 1 ? ' (optional)' : '') + '" value="' + esc(x) + '"></label>'; }).join('') + '</div>' +
      '<input type="text" class="q-explain" placeholder="Short, kind explanation shown after the quiz" value="' + esc(q.explain) + '"><p class="small muted">Tick the circle next to the correct answer.</p></fieldset>';
  }
  actions.lessonForm = function (el) {
    var l = el.dataset.id ? findLesson(el.dataset.id) : { unit_id: el.dataset.unit, minutes: 8, published: true, questions: [] };
    var qs = l.questions.length ? l.questions : [null, null, null];
    modal('<h2>' + (l.id ? 'Edit lesson' : 'New lesson') + '</h2><form class="stack" data-form="saveLesson">' + (l.id ? '<input type="hidden" name="id" value="' + l.id + '">' : '') + '<input type="hidden" name="unit_id" value="' + esc(l.unit_id) + '">' +
      '<div class="grid2"><label class="f">Lesson title<input type="text" name="title" value="' + esc(l.title) + '" required></label><div class="grid2"><label class="f">Minutes<input type="number" name="minutes" min="2" max="30" value="' + esc(l.minutes) + '"></label>' +
      '<label class="f">Show to students<select name="published">' + opt('true', 'Yes', String(l.published)) + opt('false', 'Hidden', String(l.published)) + '</select></label></div></div>' +
      '<label class="f">Opening question <span class="hint">One line that makes the child curious</span><input type="text" name="hook" value="' + esc(l.hook) + '"></label>' +
      '<label class="f">Lesson text <span class="hint">Leave an empty line between short paragraphs. Start a line with "- " to make a list.</span><textarea name="body" style="min-height:200px">' + esc(l.body) + '</textarea></label>' +
      '<div class="grid3"><label class="f">Arabic phrase<input type="text" name="arabic" class="ar" lang="ar" value="' + esc(l.arabic) + '"></label><label class="f">How to say it<input type="text" name="translit" value="' + esc(l.translit) + '"></label><label class="f">Meaning<input type="text" name="meaning" value="' + esc(l.meaning) + '"></label></div>' +
      '<label class="f">Try it today <span class="hint">One small action for the same day</span><input type="text" name="action" value="' + esc(l.action) + '"></label>' +
      '<label class="f">Teaching tip <span class="hint">Only teachers see this</span><textarea name="teacher_note">' + esc(l.teacher_note) + '</textarea></label>' +
      '<h3>Quiz questions</h3><div class="stack" id="qList">' + qs.map(qEditor).join('') + '</div><div><button type="button" class="btn soft sm" data-act="addQuestion">' + icon('plus') + 'Add question</button></div>' +
      '<div class="foot">' + (l.id ? '<button type="button" class="btn danger" data-act="lessonDelete" data-id="' + l.id + '">' + icon('trash') + 'Delete lesson</button><span class="grow"></span>' : '') + '<button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" type="submit">Save lesson</button></div></form>', true);
  };
  actions.addQuestion = function () { var box = document.getElementById('qList'); box.insertAdjacentHTML('beforeend', qEditor(null, box.children.length)); };
  forms.saveLesson = function (f, d, btn) {
    var questions = [];
    f.querySelectorAll('.qrow').forEach(function (row, n) {
      var prompt = row.querySelector('.q-prompt').value.trim(); if (!prompt) return;
      var picked = row.querySelector('input[type=radio]:checked'), ansRaw = picked ? Number(picked.value) : 0, options = [], answer = 0;
      row.querySelectorAll('.q-opt').forEach(function (o, k) { var v = o.value.trim(); if (v) { if (k === ansRaw) answer = options.length; options.push(v); } });
      if (options.length >= 2) questions.push({ prompt: prompt, options: options, answer: answer, explain: row.querySelector('.q-explain').value.trim() });
    });
    Object.keys(d).forEach(function (k) { if (/^ans\d+$/.test(k)) delete d[k]; });
    d.questions = questions;
    busy(btn, async function () { await rpc('ilm_admin_save_lesson', { p: d }); ui.syllabus = null; closeModal(); toast('Lesson saved'); PAGES.syllabus(document.getElementById('main')); });
  };
  actions.lessonDelete = function (el) {
    modal('<h2>Delete this lesson?</h2><p>Students\' progress and quiz scores for this lesson are deleted too. To take it away without losing anything, set "Show to students" to Hidden instead.</p><div class="foot"><button class="btn ghost" data-act="closeModal">Keep</button><button class="btn danger" data-act="lessonDeleteYes" data-id="' + el.dataset.id + '">Delete lesson</button></div>');
  };
  actions.lessonDeleteYes = function (el) {
    busy(el, async function () { await rpc('ilm_admin_delete_lesson', { p_id: Number(el.dataset.id) }); ui.syllabus = null; closeModal(); PAGES.syllabus(document.getElementById('main')); });
  };
  actions.unitForm = function (el) {
    var u = el.dataset.id ? findUnit(el.dataset.id) : {};
    modal('<h2>' + (u.id ? 'Edit unit' : 'New unit') + '</h2><form class="stack" data-form="saveUnit">' + (u.id ? '<input type="hidden" name="id" value="' + u.id + '">' : '') + '<input type="hidden" name="level_id" value="' + ui.level + '">' +
      '<label class="f">Unit title<input type="text" name="title" value="' + esc(u.title) + '" required></label><label class="f">Short description<input type="text" name="summary" value="' + esc(u.summary) + '"></label>' +
      '<label class="f">Goal <span class="hint">What can the child do at the end?</span><textarea name="goal">' + esc(u.goal) + '</textarea></label>' +
      '<div class="foot"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" type="submit">Save unit</button></div></form>');
  };
  forms.saveUnit = function (f, d, btn) {
    busy(btn, async function () { await rpc('ilm_admin_save_unit', { p: d }); ui.syllabus = null; closeModal(); toast('Unit saved'); PAGES.syllabus(document.getElementById('main')); });
  };

  // --------------------------------------------------------------- fees
  function statusChip(i) {
    if (i.status === 'paid') return '<span class="chip green">' + icon('check') + 'Paid</span>';
    if (i.status === 'waived') return '<span class="chip grey">Waived</span>';
    if (i.status === 'cancelled') return '<span class="chip grey">Cancelled</span>';
    return i.due_date && i.due_date < I.today() ? '<span class="chip red">Overdue</span>' : '<span class="chip gold">Not paid</span>';
  }
  function reminderText(i) {
    return 'Assalamu alaykum' + (i.parent_name ? ' ' + i.parent_name : '') + '. A gentle reminder from ILM International: ' + I.firstName(i.student) + '\'s ' + i.description.replace(/^Tuition fee/, 'tuition fee') + ' (' + money(i.amount, i.currency) + ')' +
      (i.due_date ? (i.due_date < I.today() ? ' was due on ' : ' is due on ') + fmtDate(i.due_date) : ' is due') + '.\n\nYou can pay securely online here:\n' + portal() + '#p=' + i.parent_token + '\n\nIf you have already paid, please ignore this message. JazakAllahu khayran.';
  }
  PAGES.fees = function (el) {
    if (!isAdmin) return go('overview');
    if (!ui.fees) {
      el.innerHTML = head('Fees') + '<div class="loading"><div><i></i>Opening the fees…</div></div>';
      rpc('ilm_admin_fees').then(function (f) { ui.fees = f; if (page === 'fees') PAGES.fees(el); }).catch(I.fail);
      return;
    }
    var all = ui.fees, month = all.filter(function (i) { return i.period === ui.period; });
    var rows = ui.feeFilter === 'unpaid' ? all.filter(function (i) { return i.status === 'due'; }) : month;
    var sum = function (list, st) { return list.filter(function (i) { return i.status === st; }).reduce(function (a, i) { return a + Number(i.amount); }, 0); };
    var withFee = D.students.filter(function (s) { return s.active && Number(s.monthly_fee) > 0; }).length;
    var missing = withFee - month.length;
    el.innerHTML = head('Fees', 'Create the monthly fees, see who has paid and remind those who have not.', '<div class="row"><button class="btn ghost" data-act="exportFees">' + icon('download') + 'Download</button><button class="btn ghost" data-act="invoiceForm">' + icon('plus') + 'Single fee</button></div>') +
      '<section class="tiles" style="margin-bottom:18px"><div class="tile"><span class="lbl">' + icon('check') + 'Paid — ' + esc(I.monthName(ui.period)) + '</span><b>' + esc(money(sum(month, 'paid'), cur())) + '</b><span class="sub">' + month.filter(function (i) { return i.status === 'paid'; }).length + ' of ' + month.length + ' fees</span></div>' +
      '<div class="tile' + (sum(month, 'due') ? ' warn' : '') + '"><span class="lbl">' + icon('coin') + 'Not paid — ' + esc(I.monthName(ui.period)) + '</span><b>' + esc(money(sum(month, 'due'), cur())) + '</b><span class="sub">' + month.filter(function (i) { return i.status === 'due'; }).length + ' families</span></div>' +
      '<div class="tile"><span class="lbl">' + icon('bell') + 'All unpaid, any month</span><b>' + esc(money(sum(all, 'due'), cur())) + '</b><span class="sub">' + all.filter(function (i) { return i.status === 'due' && i.due_date && i.due_date < I.today(); }).length + ' overdue</span></div></section>' +
      (missing > 0 && ui.feeFilter === 'month' ? '<section class="card" style="margin-bottom:14px;background:var(--gold-l);box-shadow:none"><div class="row">' + icon('calendar') + '<div class="grow"><b>' + missing + ' student' + (missing === 1 ? ' has' : 's have') + ' no fee for ' + esc(I.monthName(ui.period)) + ' yet</b><p class="small">One click creates a fee for every active student, using the monthly fee on their profile.</p></div><button class="btn" data-act="genForm">Create fees for ' + esc(I.monthName(ui.period)) + '</button></div></section>' : '') +
      '<div class="toolbar"><div class="seg"><button data-act="feeFilter" data-v="month" aria-pressed="' + (ui.feeFilter === 'month') + '">By month</button><button data-act="feeFilter" data-v="unpaid" aria-pressed="' + (ui.feeFilter === 'unpaid') + '">All unpaid</button></div>' +
      (ui.feeFilter === 'month' ? '<input type="month" id="feeMonth" value="' + esc(ui.period) + '" aria-label="Month">' : '') + '</div>' +
      (rows.length ? '<div class="tablewrap"><table class="t"><thead><tr><th>Student</th><th>Fee</th><th class="num">Amount</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + rows.map(function (i) {
        var due = i.status === 'due';
        return '<tr><td><b>' + esc(i.student) + '</b><div class="small muted">' + esc(i.code) + (i.parent_name ? ' · ' + esc(i.parent_name) : '') + '</div></td><td>' + esc(i.description) + (i.note ? '<div class="small muted">' + esc(i.note) + '</div>' : '') + '</td>' +
          '<td class="num"><b>' + esc(money(i.amount, i.currency)) + '</b></td><td>' + esc(i.status === 'paid' ? 'Paid ' + fmtDate(i.paid_at) : fmtDate(i.due_date) || '—') + (i.status === 'paid' && i.method ? '<div class="small muted">' + esc(i.method === 'razorpay' ? 'Online (Razorpay)' : i.method) + '</div>' : '') + (due && i.reminders ? '<div class="small muted">Reminded ' + i.reminders + '× · ' + esc(fmtDate(i.reminded_at)) + '</div>' : '') + '</td><td>' + statusChip(i) + '</td>' +
          '<td><div class="row" style="gap:6px;flex-wrap:nowrap">' + (due ? (i.parent_whatsapp ? '<a class="btn wa sm" data-act="remind" data-id="' + i.id + '" target="_blank" rel="noopener" href="' + esc(I.waLink(i.parent_whatsapp, reminderText(i))) + '">' + icon('wa') + 'Remind</a>' : '<button class="btn ghost sm" data-act="copy" data-label="Reminder copied" data-text="' + esc(reminderText(i)) + '">' + icon('copy') + 'Reminder</button>') +
            '<button class="btn soft sm" data-act="paidForm" data-id="' + i.id + '">Mark paid</button><button class="btn ghost sm" data-act="invoiceForm" data-id="' + i.id + '" aria-label="Edit fee">' + icon('edit') + '</button>'
            : '<button class="btn ghost sm" data-act="reopenFee" data-id="' + i.id + '">Undo</button>') + '</div></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="card">' + empty('coin', ui.feeFilter === 'unpaid' ? 'Every fee is paid. Alhamdulillah!' : 'No fees for ' + I.monthName(ui.period) + ' yet.', ui.feeFilter === 'month' && withFee ? '<button class="btn" data-act="genForm">Create fees for ' + esc(I.monthName(ui.period)) + '</button>' : '') + '</div>') +
      '<p class="small muted" style="margin-top:14px">Parents pay online from their private parent page with the "Pay now" button. Online payments are marked as paid here automatically.</p>';
    var m = document.getElementById('feeMonth'); if (m) m.addEventListener('change', function () { if (m.value) { ui.period = m.value; PAGES.fees(el); } });
  };
  function feesReload() { ui.fees = null; load().then(function () { if (page === 'fees') render(); }); }
  function fee(id) { return ui.fees.filter(function (i) { return i.id === id; })[0]; }
  actions.feeFilter = function (el) { ui.feeFilter = el.dataset.v; PAGES.fees(document.getElementById('main')); };
  actions.remind = function (el) { rpc('ilm_admin_reminded', { p_id: el.dataset.id }).then(function () { var i = fee(el.dataset.id); if (i) { i.reminders++; i.reminded_at = new Date().toISOString(); } }).catch(function () {}); };
  actions.genForm = function () {
    var d = new Date(ui.period + '-05T00:00:00'), def = ui.period + '-05';
    if (d < new Date()) { var n = new Date(Date.now() + 5 * 864e5); def = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
    modal('<h2>Create fees for ' + esc(I.monthName(ui.period)) + '</h2><p>Every active student with a monthly fee on their profile gets one fee for this month. Students who already have one are skipped, so it is safe to press again.</p>' +
      '<form class="stack" data-form="genFees"><label class="f">Pay by date<input type="date" name="due" value="' + def + '" required></label><div class="foot"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" type="submit">Create fees</button></div></form>');
  };
  forms.genFees = function (f, d, btn) {
    busy(btn, async function () { var n = await rpc('ilm_admin_generate_invoices', { p_period: ui.period, p_due: d.due }); closeModal(); toast(n ? n + ' fee' + (n === 1 ? '' : 's') + ' created' : 'Nothing new to create'); feesReload(); });
  };
  actions.invoiceForm = function (el) {
    var i = el.dataset.id ? fee(el.dataset.id) : {};
    modal('<h2>' + (i.id ? 'Edit fee' : 'Add a single fee') + '</h2><form class="stack" data-form="saveInvoice">' + (i.id ? '<input type="hidden" name="id" value="' + i.id + '"><p><b>' + esc(i.student) + '</b> · ' + esc(I.monthName(i.period)) + '</p>'
      : '<div class="grid2"><label class="f">Student<select name="student_id" required>' + opt('', 'Choose') + D.students.filter(function (s) { return s.active; }).map(function (s) { return opt(s.id, s.full_name + ' (' + s.code + ')'); }).join('') + '</select></label><label class="f">Month<input type="month" name="period" value="' + esc(ui.period) + '" required></label></div>') +
      '<label class="f">What is it for?<input type="text" name="description" value="' + esc(i.description || 'Tuition fee') + '" maxlength="80" required></label>' +
      '<div class="grid2"><label class="f">Amount (' + esc(i.currency || cur()) + ')<input type="number" name="amount" min="1" step="0.01" value="' + esc(i.id ? Number(i.amount) : '') + '" required></label><label class="f">Pay by date<input type="date" name="due_date" value="' + esc(i.due_date) + '"></label></div>' +
      '<label class="f">Note <span class="hint">Only you see this</span><input type="text" name="note" value="' + esc(i.note) + '"></label>' +
      '<div class="foot">' + (i.id ? '<button type="button" class="btn danger" data-act="feeDelete" data-id="' + i.id + '">' + icon('trash') + 'Delete</button><button type="button" class="btn ghost" data-act="feeWaive" data-id="' + i.id + '">Waive this fee</button><span class="grow"></span>' : '') + '<button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" type="submit">Save</button></div></form>');
  };
  forms.saveInvoice = function (f, d, btn) {
    busy(btn, async function () { await rpc('ilm_admin_save_invoice', { p: d }); closeModal(); toast('Fee saved'); feesReload(); });
  };
  actions.feeDelete = function (el) { busy(el, async function () { await rpc('ilm_admin_delete_invoice', { p_id: el.dataset.id }); closeModal(); toast('Fee deleted'); feesReload(); }); };
  actions.feeWaive = function (el) { busy(el, async function () { await rpc('ilm_admin_set_invoice', { p_id: el.dataset.id, p_status: 'waived', p_method: '', p_note: '' }); closeModal(); toast('Fee waived'); feesReload(); }); };
  actions.reopenFee = function (el) {
    var i = fee(el.dataset.id);
    if (i.method === 'razorpay') return modal('<h2>This was paid online</h2><p>' + esc(i.student) + ' paid this fee through Razorpay (payment ' + esc(i.rzp_payment_id || '') + '). To give the money back, refund it in your Razorpay dashboard first.</p><div class="foot"><button class="btn ghost" data-act="closeModal">Close</button><button class="btn danger" data-act="reopenFeeYes" data-id="' + i.id + '">Mark as not paid anyway</button></div>');
    actions.reopenFeeYes(el);
  };
  actions.reopenFeeYes = function (el) { busy(el, async function () { await rpc('ilm_admin_set_invoice', { p_id: el.dataset.id, p_status: 'due', p_method: '', p_note: '' }); closeModal(); toast('Marked as not paid'); feesReload(); }); };
  actions.paidForm = function (el) {
    var i = fee(el.dataset.id);
    modal('<h2>Mark as paid</h2><p><b>' + esc(i.student) + '</b> · ' + esc(i.description) + ' · <b>' + esc(money(i.amount, i.currency)) + '</b></p><form class="stack" data-form="markPaid"><input type="hidden" name="id" value="' + i.id + '">' +
      '<label class="f">How did they pay?<select name="method">' + opt('bank', 'Bank transfer') + opt('cash', 'Cash') + opt('card', 'Card (outside the portal)') + opt('other', 'Other') + '</select></label>' +
      '<label class="f">Note <span class="hint">For example the transfer reference</span><input type="text" name="note"></label><div class="foot"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" type="submit">Mark as paid</button></div></form>');
  };
  forms.markPaid = function (f, d, btn) {
    busy(btn, async function () { await rpc('ilm_admin_set_invoice', { p_id: d.id, p_status: 'paid', p_method: d.method, p_note: d.note }); closeModal(); toast('Marked as paid'); feesReload(); });
  };
  actions.exportFees = function () {
    var rows = [['Month', 'Student ID', 'Student', 'Parent', 'WhatsApp', 'Fee', 'Amount', 'Currency', 'Due date', 'Status', 'Paid on', 'Method', 'Razorpay payment', 'Note']];
    (ui.fees || []).forEach(function (i) { rows.push([i.period, i.code, i.student, i.parent_name, i.parent_whatsapp, i.description, i.amount, i.currency, i.due_date, i.status, i.paid_at ? i.paid_at.slice(0, 10) : '', i.method, i.rzp_payment_id, i.note]); });
    csvDownload('ilm-fees.csv', rows);
  };

  // ----------------------------------------------------------- teachers
  PAGES.teachers = function (el) {
    if (!isAdmin) return go('overview');
    el.innerHTML = head('Teachers', 'Teachers create their own account on the login page. You approve them here.', '<button class="btn ghost" data-act="copy" data-label="Invitation copied" data-text="' + esc('Assalamu alaykum. Please create your teacher account for the ILM International portal here: ' + portal() + '\nChoose "Teacher / Admin", then "Create an account". I will approve it straight away.') + '">' + icon('copy') + 'Copy invitation message</button>') +
      '<div class="tablewrap"><table class="t"><thead><tr><th>Name</th><th>Role</th><th>Classes</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + D.teachers.map(function (t) {
        var n = D.classes.filter(function (c) { return c.teacher_id === t.id; }).length, self = t.id === me.id;
        return '<tr><td><div class="row" style="flex-wrap:nowrap">' + avatar(t.full_name, 2, 'sm') + '<div><b>' + esc(t.full_name) + '</b>' + (self ? ' <span class="chip grey">You</span>' : '') + '<div class="small muted">' + esc(t.email || '') + '</div></div></div></td><td>' + (t.role === 'admin' ? '<span class="chip gold">Admin</span>' : '<span class="chip">Teacher</span>') + '</td><td>' + n + '</td><td>' + (t.approved ? '<span class="chip green">' + icon('check') + 'Approved</span>' : '<span class="chip red">Waiting</span>') + '</td>' +
          '<td>' + (self ? '' : '<div class="row" style="gap:6px;flex-wrap:nowrap">' + (t.approved ? '<button class="btn danger sm" data-act="setTeacher" data-id="' + t.id + '" data-approved="false" data-role="' + t.role + '">Remove access</button>' : '<button class="btn sm" data-act="approveTeacher" data-id="' + t.id + '">Approve</button>') +
            (t.approved ? '<button class="btn ghost sm" data-act="setTeacher" data-id="' + t.id + '" data-approved="true" data-role="' + (t.role === 'admin' ? 'teacher' : 'admin') + '">' + (t.role === 'admin' ? 'Make teacher' : 'Make admin') + '</button>' : '') + '</div>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  };
  actions.approveTeacher = function (el) { busy(el, async function () { await rpc('ilm_admin_set_teacher', { p_id: el.dataset.id, p_approved: true, p_role: 'teacher' }); toast('Teacher approved'); await refresh(); }); };
  actions.setTeacher = function (el) {
    busy(el, async function () { await rpc('ilm_admin_set_teacher', { p_id: el.dataset.id, p_approved: el.dataset.approved === 'true', p_role: el.dataset.role }); toast('Saved'); await refresh(); });
  };

  // ----------------------------------------------------------- settings
  PAGES.settings = function (el) {
    if (!isAdmin) return go('overview');
    var s = D.settings || {}, p = s.plans || {};
    el.innerHTML = head('Settings', 'Academy details, plan prices and online payments.') + '<div class="cols"><form class="card stack" data-form="saveSettings"><h2 style="font-size:1.4rem">Academy</h2>' +
      '<div class="grid2"><label class="f">Academy name<input type="text" name="academy" value="' + esc(s.academy) + '" required></label><label class="f">Academy WhatsApp <span class="hint">Numbers only, with country code</span><input type="tel" name="whatsapp" value="' + esc(s.whatsapp) + '" required></label></div>' +
      '<h3>Fees</h3><div class="grid2"><label class="f">Currency <span class="hint">Used for new fees</span><select name="currency">' + ['USD', 'EUR', 'GBP', 'INR', 'TRY', 'AED', 'CAD', 'AUD'].map(function (c) { return opt(c, c, s.currency || 'USD'); }).join('') + '</select></label><span></span></div>' +
      '<div class="grid3"><label class="f">Weekend Class / month<input type="number" name="weekend" min="0" step="0.01" value="' + esc(p.weekend) + '"></label><label class="f">Small Group / month<input type="number" name="group" min="0" step="0.01" value="' + esc(p.group) + '"></label><label class="f">Personal 1-to-1 / month<input type="number" name="personal" min="0" step="0.01" value="' + esc(p.personal) + '"></label></div>' +
      '<p class="small muted">These prices fill in automatically when you choose a plan for a student. They are never shown on the public website.</p>' +
      '<h3>Links</h3><label class="f">Portal address <span class="hint">Used in the WhatsApp messages you send to parents</span><input type="url" name="portal_url" value="' + esc(s.portal_url) + '" required></label>' +
      '<label class="f">Payment server address <span class="hint">Your Cloudflare Worker. Leave as it is unless you move the site.</span><input type="url" name="pay_api" value="' + esc(s.pay_api) + '"></label>' +
      '<div class="foot" style="display:flex;justify-content:flex-end"><button class="btn" type="submit">Save settings</button></div></form>' +
      '<div class="stack"><section class="card stack"><h2 style="font-size:1.4rem">Online payments</h2><p class="muted small">Parents pay with Razorpay from their private page. Check that the payment server is switched on.</p><div id="payStatus"></div><div><button class="btn soft" data-act="payCheck">Check payment setup</button></div></section>' +
      '<section class="card stack"><h2 style="font-size:1.4rem">Your data</h2><p class="muted small">Download a copy to keep or to open in Excel or Google Sheets.</p><div class="row"><button class="btn ghost" data-act="exportStudents">' + icon('download') + 'Students</button><button class="btn ghost" data-act="exportFeesAll">' + icon('download') + 'Fees</button></div></section></div></div>';
  };
  forms.saveSettings = function (f, d, btn) {
    busy(btn, async function () {
      await rpc('ilm_admin_save_settings', { p: { academy: d.academy, whatsapp: d.whatsapp.replace(/[^0-9]/g, ''), currency: d.currency, portal_url: d.portal_url, pay_api: d.pay_api.replace(/\/+$/, ''), plans: { weekend: Number(d.weekend) || 0, group: Number(d.group) || 0, personal: Number(d.personal) || 0 } } });
      toast('Settings saved'); await refresh();
    });
  };
  actions.exportFeesAll = function (el) { busy(el, async function () { if (!ui.fees) ui.fees = await rpc('ilm_admin_fees'); actions.exportFees(); }); };
  actions.payCheck = function (el) {
    busy(el, async function () {
      var box = document.getElementById('payStatus'), base = String((D.settings || {}).pay_api || '').replace(/\/+$/, ''), res, out = {};
      try {
        res = await fetch(base + '/api/pay/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice: '00000000-0000-0000-0000-000000000000', token: 'setup-check-setup-check-0000' }) });
        out = await res.json().catch(function () { return {}; });
      } catch (e) { box.innerHTML = '<p class="err">The payment server could not be reached at this address. Check the "Payment server address" and that the Worker is deployed.</p>'; return; }
      if (res.status === 503) box.innerHTML = '<p class="note"><b>Not switched on yet.</b> Add the Razorpay and Supabase secrets to the Cloudflare Worker (see PORTAL-SETUP.txt, part 4). Until then parents see a "contact the academy" message.</p>';
      else if (res.status === 400 && /not found/i.test(out.error || '')) box.innerHTML = '<p class="info" style="background:var(--green-l);color:var(--green)"><b>Switched on.</b> The payment server can reach your database. Make one small real payment to confirm your Razorpay keys.</p>';
      else if (res.status === 404 || res.status === 405) box.innerHTML = '<p class="err">This address is running an older version of the Worker. Upload the new worker.js to GitHub so Cloudflare redeploys it.</p>';
      else box.innerHTML = '<p class="err">The payment server answered, but it could not reach the database. Check the SUPABASE_URL and SUPABASE_SERVICE_KEY secrets in Cloudflare.</p>';
    });
  };

  // keyboard: Enter on a table row opens it
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches && e.target.matches('tr.click')) e.target.click(); });

  I.staffStart = start;
})();
