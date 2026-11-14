// ILM International — Cloudflare Worker (runs the website, lead saving and fee payments).
// Handles:  POST /api/lead   -> saves a registration in KV (binding name LEADS)
//           GET  /api/leads?key=ADMIN_KEY -> downloads all registrations as CSV
//           POST /api/pay/order   -> starts a Razorpay payment for one fee
//           POST /api/pay/verify  -> checks the payment and marks the fee as paid
//           POST /api/pay/webhook -> Razorpay calls this too, as a safety net
// Everything else is served from the website files as normal.
//
// Secrets needed for payments (Cloudflare > Worker > Settings > Variables and Secrets):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY
//   RAZORPAY_WEBHOOK_SECRET (optional, only if you add the webhook)

// The website on Firebase (ilminternational.web.app) sends registrations here, so allow other sites to POST.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    // Keep the server files private
    if (['/worker.js', '/wrangler.jsonc', '/README.txt', '/firebase.json', '/supabase-setup.sql', '/PORTAL-SETUP.txt'].includes(pathname)) {
      return new Response('Not found', { status: 404 });
    }
    // Serve the website files (index.html, fees.html, images, styles…)
    return env.ASSETS.fetch(request);
  },
};
