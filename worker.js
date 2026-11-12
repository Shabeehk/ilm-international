// ILM International — Cloudflare Worker (runs the website + lead saving).
// Handles:  POST /api/lead   -> saves a registration in KV (binding name LEADS)
//           GET  /api/leads?key=ADMIN_KEY -> downloads all registrations as CSV
// Everything else is served from the website files as normal.

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
    // Keep the server files private
    if (['/worker.js', '/wrangler.jsonc', '/README.txt', '/firebase.json'].includes(pathname)) {
      return new Response('Not found', { status: 404 });
    }
    // Serve the website files (index.html, fees.html, images, styles…)
    return env.ASSETS.fetch(request);
  },
};
