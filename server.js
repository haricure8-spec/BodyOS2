const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'clinic_data');
const DATA_FILE = path.join(DATA_DIR, 'reception.json');
const RECORD_FILE = path.join(DATA_DIR, 'database.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PORT = Number(process.env.PORT || 3000);

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
fs.mkdirSync(BACKUP_DIR, { recursive: true });
if (!fs.existsSync(RECORD_FILE)) fs.writeFileSync(RECORD_FILE, JSON.stringify({patients:[],records:[]}, null, 2), 'utf8');

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

function readDatabase() {
  try { return JSON.parse(fs.readFileSync(RECORD_FILE, 'utf8')); }
  catch { return { patients: [], records: [] }; }
}
function backupDatabase() {
  if (!fs.existsSync(RECORD_FILE)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(RECORD_FILE, path.join(BACKUP_DIR, `database-${stamp}.json`));
  const files = fs.readdirSync(BACKUP_DIR).filter(x=>x.startsWith('database-')).sort().reverse();
  files.slice(30).forEach(x=>fs.unlinkSync(path.join(BACKUP_DIR,x)));
}
function writeDatabase(db) {
  backupDatabase();
  const tmp = RECORD_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, RECORD_FILE);
}
function patientIdentity(p) {
  const birth = p.birth || {};
  return `${String(p.name||'').replace(/\s+/g,'')}|${birth.year||''}-${birth.month||''}-${birth.day||''}|${String(p.phone||'').replace(/\D/g,'')}`;
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

  if (url.pathname === '/api/records' && req.method === 'GET') {
    return json(res, 200, readDatabase());
  }
  if (url.pathname === '/api/records' && req.method === 'POST') {
    try {
      const input = await body(req);
      const p = input.patient || {};
      if (!safeText(p.name,80) || !safeText(p.birth?.year,4) || !safeText(p.birth?.month,2) || !safeText(p.birth?.day,2)) {
        return json(res, 400, { error: '患者名と生年月日は必須です。' });
      }
      const db = readDatabase();
      db.patients = Array.isArray(db.patients) ? db.patients : [];
      db.records = Array.isArray(db.records) ? db.records : [];
      const identity = patientIdentity(p);
      let patient = db.patients.find(x=>x.identity===identity);
      if (!patient) {
        patient = { patientId:`P${String(db.patients.length+1).padStart(6,'0')}`, identity, createdAt:new Date().toISOString(), ...p };
        db.patients.push(patient);
      } else Object.assign(patient,p,{updatedAt:new Date().toISOString()});
      const visitDate = safeText(input.visitDate,10) || new Date().toISOString().slice(0,10);
      const record = { ...input, patientId:patient.patientId, visitDate, updatedAt:new Date().toISOString() };
      const idx = db.records.findIndex(x=>x.patientId===patient.patientId && x.visitDate===visitDate);
      if (idx>=0) db.records[idx]=record; else db.records.push(record);
      writeDatabase(db);
      return json(res, 200, { ok:true, patientId:patient.patientId, visitDate, recordCount:db.records.length });
    } catch (e) { return json(res, 500, { error:e.message || '保存できませんでした。' }); }
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
