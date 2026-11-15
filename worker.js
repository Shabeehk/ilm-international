// ILM International — Cloudflare Worker (runs the website, lead saving and fee payments).
// Handles:  POST /api/lead   -> saves a registration in KV (binding name LEADS)
//           GET  /api/leads?key=ADMIN_KEY -> downloads all registrations as CSV
//           POST /api/pay/order   -> starts a Razorpay payment for one fee
//           POST /api/pay/verify  -> checks the payment and marks the fee as paid
//           POST /api/pay/webhook -> Razorpay calls this too, as a safety net
//           GET  /api/push/key    -> public key browsers need to switch on class reminders
//           POST /api/push/test   -> sends one test reminder to the browser that asks
//           every minute (cron)   -> reminds students, parents and teachers 10 minutes before a class
// Everything else is served from the website files as normal.
//
// Secrets needed for payments (Cloudflare > Worker > Settings > Variables and Secrets):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY
//   RAZORPAY_WEBHOOK_SECRET (optional, only if you add the webhook)
// Class reminders only need SUPABASE_URL and SUPABASE_SERVICE_KEY, plus the cron
// trigger in wrangler.jsonc. The signing key for reminders is made automatically.

// The website on Firebase (ilminternational.web.app) sends registrations here, so allow other sites to POST.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
  });

const clean = (value, max = 120) =>
  String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

const csvCell = (v) => {
  let s = String(v ?? '');
  // stop spreadsheet formula injection, but keep phone numbers like +90 551… as they are
  if (/^[=@\t\r]/.test(s) || /^[+\-](?![\d\s(])/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};

async function saveLead(request, env) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request' }, 400);
  }

  // Honeypot: real visitors never fill the hidden "website" field
  if (clean(data.website)) return json({ ok: true });

  const lead = {
    parent: clean(data.parent),
    whatsapp: clean(data.whatsapp, 40),
    child: clean(data.child),
    age: clean(data.age, 4),
    language: clean(data.language, 20),
    country: clean(data.country, 60),
    page: clean(data.page, 80),
    createdAt: new Date().toISOString(),
    ip_country: request.cf?.country || '',
  };

  if (!lead.parent || !lead.whatsapp) {
    return json({ ok: false, error: 'Name and WhatsApp number are required' }, 400);
  }

  if (env.LEADS) {
    const id = `lead:${Date.now()}:${crypto.randomUUID().slice(0, 8)}`;
    await env.LEADS.put(id, JSON.stringify(lead));
  }
  return json({ ok: true });
}

async function downloadLeads(request, env) {
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return new Response('Not authorised', { status: 401 });
  if (!env.LEADS) return new Response('KV namespace LEADS is not connected yet', { status: 500 });

  const rows = [];
  let cursor;
  do {
    const page = await env.LEADS.list({ prefix: 'lead:', cursor });
    const values = await Promise.all(page.keys.map((k) => env.LEADS.get(k.name, 'json')));
    values.forEach((v) => v && rows.push(v));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const cols = ['createdAt', 'parent', 'whatsapp', 'child', 'age', 'language', 'country', 'ip_country'];
  const csv = [cols.join(',')]
    .concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(',')))
    .join('\r\n');

  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="ilm-leads.csv"',
      'Cache-Control': 'no-store',
    },
  });
}

// ------------------------------------------------------------ fee payments
const enc = new TextEncoder();
async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// compares two strings without leaking where they differ
const sameText = (a, b) => {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
const payReady = (env) => env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY;
const NOT_READY = 'Online payment is not switched on yet. Please contact the academy on WhatsApp.';

// calls one of the payment functions in the Supabase database
async function db(env, fn, args) {
  const res = await fetch(`${String(env.SUPABASE_URL).replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`database error ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function payOrder(request, env) {
  if (!payReady(env)) return json({ ok: false, error: NOT_READY }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid request' }, 400); }
  const invoice = clean(body.invoice, 40);
  const token = clean(body.token, 80);
  if (!/^[0-9a-f-]{36}$/i.test(invoice) || token.length < 20) return json({ ok: false, error: 'Invalid request' }, 400);

  try {
    const fee = await db(env, 'ilm_pay_start', { p_invoice: invoice, p_token: token });
    if (!fee || !fee.ok) return json({ ok: false, error: (fee && fee.error) || 'This fee was not found.' }, 400);

    const api = String(env.RAZORPAY_API || 'https://api.razorpay.com').replace(/\/+$/, '');
    const res = await fetch(`${api}/v1/orders`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: fee.amount_minor,
        currency: fee.currency,
        receipt: invoice,
        notes: { invoice, student: fee.student, student_id: fee.code },
      }),
    });
    const order = await res.json().catch(() => ({}));
    if (!res.ok || !order.id) {
      const why = order && order.error && order.error.description;
      return json({ ok: false, error: why ? `Razorpay: ${why}` : 'The payment could not be started. Please try again.' }, 502);
    }
    await db(env, 'ilm_pay_set_order', { p_invoice: invoice, p_order: order.id });
    return json({
      ok: true,
      key: env.RAZORPAY_KEY_ID,
      order_id: order.id,
      amount: fee.amount_minor,
      currency: fee.currency,
      name: fee.academy || 'ILM International',
      description: `${fee.description} — ${fee.student}`,
      prefill: { name: fee.parent_name || '', contact: fee.parent_whatsapp || '' },
    });
  } catch (err) {
    return json({ ok: false, error: 'The payment could not be started. Please try again.' }, 502);
  }
}

async function payVerify(request, env) {
  if (!payReady(env)) return json({ ok: false, error: NOT_READY }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid request' }, 400); }
  const orderId = clean(body.razorpay_order_id, 60);
  const paymentId = clean(body.razorpay_payment_id, 60);
  const expected = await hmacHex(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
  if (!orderId || !paymentId || !sameText(expected, clean(body.razorpay_signature, 200))) {
    return json({ ok: false, error: 'We could not confirm this payment. If money was taken, please contact the academy.' }, 400);
  }
  try {
    const done = await db(env, 'ilm_pay_confirm', { p_order: orderId, p_payment: paymentId });
    return json({ ok: !!(done && done.ok) });
  } catch (err) {
    return json({ ok: false, error: 'Payment received, but we could not update the record. Please contact the academy.' }, 502);
  }
}

async function payWebhook(request, env) {
  if (!payReady(env) || !env.RAZORPAY_WEBHOOK_SECRET) return json({ ok: false }, 503);
  const raw = await request.text();
  const expected = await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, raw);
  if (!sameText(expected, request.headers.get('x-razorpay-signature'))) return json({ ok: false }, 401);
  let event;
  try { event = JSON.parse(raw); } catch { return json({ ok: false }, 400); }
  const payment = event && event.payload && event.payload.payment && event.payload.payment.entity;
  if (payment && payment.order_id && (event.event === 'payment.captured' || event.event === 'order.paid')) {
    try { await db(env, 'ilm_pay_confirm', { p_order: payment.order_id, p_payment: payment.id }); }
    catch (err) { return json({ ok: false }, 502); }   // Razorpay will try again later
  }
  return json({ ok: true });
}

// ------------------------------------------------- class reminders (Web Push)
const dbReady = (env) => env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY;
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => {
  s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
const join = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

// The signing key (VAPID) is created once and kept in the database, so it never changes.
let vapidCache = null;
async function vapidKeys(env) {
  if (vapidCache) return vapidCache;
  let v = await db(env, 'ilm_svc_vapid', { p_new: null });
  if (!v || !v.jwk) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const pub = await crypto.subtle.exportKey('raw', pair.publicKey);
    v = await db(env, 'ilm_svc_vapid', { p_new: { jwk, public: b64u(pub) } });
  }
  const key = await crypto.subtle.importKey('jwk', { kty: v.jwk.kty, crv: v.jwk.crv, x: v.jwk.x, y: v.jwk.y, d: v.jwk.d },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  vapidCache = { key, public: v.public };
  return vapidCache;
}

async function vapidHeader(endpoint, keys) {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://ilminternational.web.app',
  })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.key, enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.public}`;
}

// Encrypts the message for one browser (RFC 8291, "aes128gcm").
async function encryptFor(sub, text) {
  const uaPublic = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const hkdf = async (salt, ikm, info, bits) => new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bits));
  const ikm = await hkdf(authSecret, shared, join(enc.encode('WebPush: info\0'), uaPublic, asPublic), 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, join(enc.encode(text), new Uint8Array([2]))));
  const header = new Uint8Array(21);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return join(header, asPublic, cipher);
}

async function sendPush(sub, message, keys) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, keys),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '900',
      Urgency: 'high',
    },
    body: await encryptFor(sub, JSON.stringify(message)),
  });
  return res.status;
}

const REMIND = {
  en: { student: 'Your class starts in {n} minutes. Tap to join.', parent: "{name}'s class starts in {n} minutes. Tap to join.", staff: 'Your class starts in {n} minutes. Tap to start it.', test: 'Reminders are working. You will get one 10 minutes before each class.' },
  ml: { student: 'നിങ്ങളുടെ ക്ലാസ് {n} മിനിറ്റിനുള്ളിൽ തുടങ്ങും. ചേരാൻ ടാപ്പ് ചെയ്യൂ.', parent: '{name} — ക്ലാസ് {n} മിനിറ്റിനുള്ളിൽ തുടങ്ങും. ചേരാൻ ടാപ്പ് ചെയ്യൂ.', test: 'ഓർമ്മപ്പെടുത്തലുകൾ ശരിയായി പ്രവർത്തിക്കുന്നു. ഓരോ ക്ലാസിനും 10 മിനിറ്റ് മുമ്പ് അറിയിപ്പ് വരും.' },
  tr: { student: 'Dersin {n} dakika sonra başlıyor. Katılmak için dokun.', parent: '{name} için ders {n} dakika sonra başlıyor. Katılmak için dokunun.', test: 'Hatırlatmalar çalışıyor. Her dersten 10 dakika önce bildirim gelecek.' },
  ar: { student: 'يبدأ درسك بعد {n} دقائق. اضغط للانضمام.', parent: 'يبدأ درس {name} بعد {n} دقائق. اضغط للانضمام.', test: 'التذكيرات تعمل. سيصلك تنبيه قبل كل درس بعشر دقائق.' },
};
function reminderText(sub, key, vars) {
  const pack = REMIND[sub.lang] || REMIND.en;
  let s = pack[key] || REMIND.en[key];
  Object.keys(vars || {}).forEach((k) => { s = s.split(`{${k}}`).join(vars[k]); });
  return s;
}

async function sendReminders(env) {
  if (!dbReady(env)) return { sent: 0, gone: 0 };
  const due = await db(env, 'ilm_svc_due_meetings', {});
  if (!Array.isArray(due) || !due.length) return { sent: 0, gone: 0 };
  const keys = await vapidKeys(env);
  const sent = [], gone = [];
  for (const m of due) {
    const n = Math.max(1, Math.round((new Date(m.starts_at).getTime() - Date.now()) / 60000));
    await Promise.all((m.subs || []).map(async (sub) => {
      const kind = sub.kind === 'parent' ? 'parent' : sub.kind === 'staff' ? 'staff' : 'student';
      const message = {
        title: m.title ? `${m.title} · ${m.class_name}` : m.class_name,
        body: reminderText(kind === 'staff' ? { lang: 'en' } : sub, kind, { n, name: sub.name || '' }),
        url: m.link || m.portal || '',
        tag: `class-${m.id}`,
      };
      try {
        const status = await sendPush(sub, message, keys);
        if (status === 404 || status === 410) gone.push(sub.endpoint);
        else if (status < 300) sent.push(sub.endpoint);
      } catch (err) { /* one bad browser must not stop the others */ }
    }));
  }
  if (sent.length || gone.length) await db(env, 'ilm_svc_push_done', { p_sent: sent, p_gone: gone });
  return { sent: sent.length, gone: gone.length };
}

async function pushKey(env) {
  if (!dbReady(env)) return json({ ok: false, error: 'Reminders are not switched on yet.' }, 503);
  try { return json({ ok: true, key: (await vapidKeys(env)).public }); }
  catch (err) { return json({ ok: false, error: 'Reminders are not ready yet. Please try again later.' }, 502); }
}

async function pushTest(request, env) {
  if (!dbReady(env)) return json({ ok: false, error: 'Reminders are not switched on yet.' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid request' }, 400); }
  const endpoint = String(body.endpoint || '').slice(0, 1000);
  if (!/^https?:\/\//.test(endpoint)) return json({ ok: false, error: 'Invalid request' }, 400);
  try {
    const sub = await db(env, 'ilm_svc_push_sub', { p_endpoint: endpoint });
    if (!sub) return json({ ok: false, error: 'Reminders are not switched on for this device yet.' }, 404);
    const status = await sendPush(sub, { title: 'ILM International', body: reminderText(sub, 'test'), url: sub.portal || '', tag: 'ilm-test' }, await vapidKeys(env));
    if (status === 404 || status === 410) {
      await db(env, 'ilm_svc_push_done', { p_sent: [], p_gone: [endpoint] });
      return json({ ok: false, error: 'This device stopped accepting reminders. Please switch them on again.' }, 410);
    }
    return status < 300 ? json({ ok: true }) : json({ ok: false, error: `The reminder could not be delivered (${status}).` }, 502);
  } catch (err) {
    return json({ ok: false, error: 'The reminder could not be sent. Please try again later.' }, 502);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/lead') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      return request.method === 'POST' ? saveLead(request, env) : json({ ok: false, error: 'Method not allowed' }, 405);
    }
    if (pathname === '/api/leads') {
      return request.method === 'GET' ? downloadLeads(request, env) : new Response('Method not allowed', { status: 405 });
    }
    if (pathname.startsWith('/api/pay/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
      if (pathname === '/api/pay/order') return payOrder(request, env);
      if (pathname === '/api/pay/verify') return payVerify(request, env);
      if (pathname === '/api/pay/webhook') return payWebhook(request, env);
      return json({ ok: false, error: 'Not found' }, 404);
    }
    if (pathname.startsWith('/api/push/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (pathname === '/api/push/key' && request.method === 'GET') return pushKey(env);
      if (pathname === '/api/push/test' && request.method === 'POST') return pushTest(request, env);
      return json({ ok: false, error: 'Not found' }, 404);
    }
    // Keep the server files private
    if (['/worker.js', '/wrangler.jsonc', '/README.txt', '/firebase.json', '/supabase-setup.sql', '/PORTAL-SETUP.txt'].includes(pathname)) {
      return new Response('Not found', { status: 404 });
    }
    // Serve the website files (index.html, fees.html, images, styles…)
    return env.ASSETS.fetch(request);
  },

  // runs every minute (see "triggers" in wrangler.jsonc): sends the 10-minute class reminders
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendReminders(env).catch(() => {}));
  },
};
