const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'clinic_data');
const DATA_FILE = path.join(DATA_DIR, 'reception.json');
const PORT = Number(process.env.PORT || 3000);

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

function readQueue() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}
function writeQueue(rows) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2), 'utf8');
}
function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1024 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function safeText(v, max = 300) { return String(v ?? '').trim().slice(0, max); }
function sanitize(input) {
  const birth = input.birth || {};
  return {
    name: safeText(input.name, 80), kana: safeText(input.kana, 80),
    birth: { year: safeText(birth.year, 4), month: safeText(birth.month, 2), day: safeText(birth.day, 2), hour: safeText(birth.hour, 2), minute: safeText(birth.minute, 2) },
    gender: safeText(input.gender, 10), postal: safeText(input.postal, 10), address: safeText(input.address, 180),
    phone: safeText(input.phone, 30), email: safeText(input.email, 120), occupation: safeText(input.occupation, 100),
    workplace: safeText(input.workplace, 160), commute: safeText(input.commute, 100)
  };
}
function localIP() {
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) for (const n of list || []) {
    if (n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.')) return n.address;
  }
  return 'localhost';
}
function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'})[ext] || 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/config' && req.method === 'GET') {
    const base = `http://${localIP()}:${PORT}`;
    return json(res, 200, { baseUrl: base, receptionUrl: `${base}/?mode=reception` });
  }
  if (url.pathname === '/api/reception/qr' && req.method === 'GET') {
    const target = `http://${localIP()}:${PORT}/?mode=reception`;
    try {
      const svg = await QRCode.toString(target, { type: 'svg', margin: 2, width: 320, color: { dark: '#154266', light: '#F8F6F1' } });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(svg);
    } catch (e) { return json(res, 500, { error: e.message }); }
  }
  if (url.pathname === '/api/reception' && req.method === 'GET') {
    return json(res, 200, readQueue().filter(x => x.status === 'pending'));
  }
  if (url.pathname === '/api/reception' && req.method === 'POST') {
    try {
      const input = sanitize(await body(req));
      if (!input.name || !input.birth.year || !input.birth.month || !input.birth.day || !input.phone) {
        return json(res, 400, { error: '氏名・生年月日・電話番号は必須です。' });
      }
      const rows = readQueue();
      const row = { id: `R${Date.now()}${Math.random().toString(36).slice(2,6)}`, status: 'pending', submittedAt: new Date().toISOString(), ...input };
      rows.push(row); writeQueue(rows);
      return json(res, 201, { ok: true, id: row.id });
    } catch { return json(res, 400, { error: '入力内容を読み取れませんでした。' }); }
  }
  if (url.pathname.startsWith('/api/reception/') && req.method === 'DELETE') {
    const id = decodeURIComponent(url.pathname.split('/').pop());
    const rows = readQueue(); const row = rows.find(x => x.id === id);
    if (row) { row.status = 'accepted'; row.acceptedAt = new Date().toISOString(); writeQueue(rows); }
    return json(res, 200, { ok: true });
  }

  let pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': file.endsWith('.html') ? 'no-store' : 'public, max-age=300' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  const base = `http://${localIP()}:${PORT}`;
  console.log('\nBodyOSを起動しました。');
  console.log(`院内画面: ${base}/`);
  console.log(`患者受付: ${base}/?mode=reception`);
  console.log('同じWi-FiにつながったiPhone/iPadから利用できます。\n');
});
