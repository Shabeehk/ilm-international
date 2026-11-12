/* ILM International — popup, lead capture, gated fee page and WhatsApp messages */
(function () {
  'use strict';

  var WHATSAPP_NUMBER = '905518881481';      // +90 551 888 14 81 (no + or spaces)
  var LEAD_KEY = 'ilm_lead_v1';
  var POPUP_DELAY_MS = 1500;

  var PLANS = {
    weekend:  { name: 'Weekend Class',        price: '$80',  detail: '2 classes a week on weekends, 2 hours' },
    group:    { name: 'Small Group Class',    price: '$150', detail: 'live online batch of 5 students' },
    personal: { name: 'Personal 1-to-1 Teacher', price: '$500', detail: 'dedicated teacher, customised timings' }
  };

  /* ---------- helpers ---------- */
  function waLink(text) {
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text);
  }
  function getLead() {
    try { return JSON.parse(localStorage.getItem(LEAD_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveLead(lead) {
    try { localStorage.setItem(LEAD_KEY, JSON.stringify(lead)); } catch (e) { /* private mode: continue */ }
    window.__ilmLead = lead;
  }
  function currentLead() { return getLead() || window.__ilmLead || null; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var CHAT_TEXT = 'Assalamu alaikum ILM International! I would like to know more about the online Islamic classes for my child.';

  /* ---------- generic chat links ---------- */
  $all('[data-wa-chat]').forEach(function (a) {
    a.href = waLink(a.getAttribute('data-wa-chat') || CHAT_TEXT);
    a.target = '_blank';
    a.rel = 'noopener';
  });

  /* ---------- modal ---------- */
  var modal = $('#leadModal');
  var lastFocus = null;

  function showStep(step) {
    if (!modal) return;
    $all('[data-step]', modal).forEach(function (el) { el.hidden = el.getAttribute('data-step') !== step; });
    var first = $('[data-step="' + step + '"] input, [data-step="' + step + '"] .btn', modal);
    if (first) setTimeout(function () { first.focus(); }, 30);
  }
  function openModal(step) {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    showStep(step || 'intro');
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    try { sessionStorage.setItem('ilm_popup_closed', '1'); } catch (e) {}
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    $all('[data-close]', modal).forEach(function (b) { b.addEventListener('click', closeModal); });
    $all('[data-go-register]', modal).forEach(function (b) { b.addEventListener('click', function () { showStep('form'); }); });
    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab') {
        var f = $all('a[href], button, input, select', modal).filter(function (el) { return el.offsetParent !== null && !el.closest('.hp'); });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* Buttons that open the register form, or go straight to fees if already registered */
  $all('[data-open-register]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (currentLead() && b.hasAttribute('data-fees-if-known')) { location.href = 'fees.html'; return; }
      openModal('form');
    });
  });

  /* Auto popup on the landing page */
  if (modal && document.body.hasAttribute('data-landing')) {
    var params = new URLSearchParams(location.search);
    var closed = false;
    try { closed = sessionStorage.getItem('ilm_popup_closed') === '1'; } catch (e) {}
    if (params.get('register') === '1') {
      openModal('form');
    } else if (!currentLead() && !closed) {
      setTimeout(function () { if (modal.hidden) openModal('intro'); }, POPUP_DELAY_MS);
    }
  }

  /* ---------- lead forms ---------- */
  $all('form.lead-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('.form-error', form);
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = String(v).trim(); });

      if (!data.parent || !data.whatsapp || !data.child || !data.age) {
        if (err) { err.textContent = 'Please fill in your name, WhatsApp number, child\'s name and age.'; err.hidden = false; }
        return;
      }
      if (!/^[+\d][\d\s\-()]{6,}$/.test(data.whatsapp)) {
        if (err) { err.textContent = 'Please enter a valid WhatsApp number with country code, e.g. +90 555 123 45 67.'; err.hidden = false; }
        return;
      }
      if (err) err.hidden = true;

      var btn = $('button[type="submit"]', form);
      if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

      var lead = {
        parent: data.parent, whatsapp: data.whatsapp, child: data.child, age: data.age,
        language: data.language || 'English', country: data.country || '',
        website: data.website || '', page: location.pathname, at: new Date().toISOString()
      };
      saveLead(lead);

      var done = function () { location.href = 'fees.html'; };
      var timer = setTimeout(done, 4000);
      fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
        keepalive: true
      }).catch(function () {}).finally(function () { clearTimeout(timer); done(); });
    });
  });

  /* ---------- fee page ---------- */
  if (document.body.hasAttribute('data-fees')) {
    var lead = currentLead();
    if (!lead) { location.replace('index.html?register=1'); return; }

    $all('[data-parent-name]').forEach(function (el) { el.textContent = lead.parent.split(' ')[0]; });

    $all('[data-plan]').forEach(function (a) {
      var plan = PLANS[a.getAttribute('data-plan')];
      if (!plan) return;
      var msg =
        'Assalamu alaikum ILM International!\n\n' +
        'I would like to join the *' + plan.name + ' – ' + plan.price + '/month* (' + plan.detail + ').\n\n' +
        'Parent: ' + lead.parent + '\n' +
        'Child: ' + lead.child + ' (age ' + lead.age + ')\n' +
        'Language: ' + lead.language + '\n' +
        (lead.country ? 'Country: ' + lead.country + '\n' : '') +
        '\nPlease share the next steps and class timings.';
      a.href = waLink(msg);
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  /* ---------- footer year ---------- */
  $all('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
