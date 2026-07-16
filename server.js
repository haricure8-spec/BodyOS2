const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

const ROOT = __dirname;
// BodyOS本体と患者データを分離する。UGLAB/BodyOS に本体を置くと UGLAB/Data に保存される。
const DATA_DIR = process.env.BODYOS_DATA_DIR
  ? path.resolve(process.env.BODYOS_DATA_DIR)
  : path.resolve(ROOT, '..', 'Data');
const BACKUP_DIR = path.join(DATA_DIR, 'Backup');
const PATIENTS_FILE = path.join(DATA_DIR, 'patients.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const RECEPTION_FILE = path.join(DATA_DIR, 'reception.json');
const PORT = Number(process.env.PORT || 3000);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
for (const file of [PATIENTS_FILE, RECORDS_FILE, RECEPTION_FILE]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf8');
}

function readJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
}
function backup(file) {
  if (!fs.existsSync(file)) return;
  const base = path.basename(file, '.json');
  fs.copyFileSync(file, path.join(BACKUP_DIR, `${base}_${stamp()}.json`));
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(x => x.startsWith(base + '_') && x.endsWith('.json'))
    .sort().reverse();
  files.slice(30).forEach(x => fs.unlinkSync(path.join(BACKUP_DIR, x)));
}
function writeJSON(file, value) {
  backup(file);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 5 * 1024 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function safeText(v, max = 500) { return String(v ?? '').trim().slice(0, max); }
function normalizeName(v) { return safeText(v, 100).replace(/[\s　]/g, '').toLowerCase(); }
function birthKey(birth = {}) {
  const y = String(birth.year || '').padStart(4, '0');
  const m = String(Number(birth.month || 0)).padStart(2, '0');
  const d = String(Number(birth.day || 0)).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function patientKey(name, birth) { return `${normalizeName(name)}|${birthKey(birth)}`; }
function nextPatientId(patients) {
  const max = patients.reduce((n, p) => Math.max(n, Number(String(p.patientId || '').replace(/\D/g, '')) || 0), 0);
  return `BP-${String(max + 1).padStart(6, '0')}`;
}
function sanitizePatient(input = {}) {
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
    return json(res, 200, { baseUrl: base, receptionUrl: `${base}/?mode=reception`, dataDir: DATA_DIR });
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
    return json(res, 200, readJSON(RECEPTION_FILE).filter(x => x.status === 'pending'));
  }
  if (url.pathname === '/api/reception' && req.method === 'POST') {
    try {
      const raw = await body(req);
      const receptionType = raw.receptionType === 'revisit' ? 'revisit' : 'new';
      const input = sanitizePatient(raw);
      if (!input.name || !input.birth.year || !input.birth.month || !input.birth.day) {
        return json(res, 400, { error: '氏名と生年月日は必須です。' });
      }
      let matchedPatient = null;
      if (receptionType === 'revisit') {
        const matches = readJSON(PATIENTS_FILE).filter(p => p.patientKey === patientKey(input.name, input.birth));
        if (matches.length !== 1) {
          return json(res, 404, { error: matches.length > 1 ? '同じお名前・生年月日のカルテが複数あります。受付へお声がけください。' : 'カルテが見つかりません。受付へお声がけください。' });
        }
        matchedPatient = matches[0];
        Object.assign(input, matchedPatient);
      } else if (!input.phone) {
        return json(res, 400, { error: '初診の方は電話番号も入力してください。' });
      }
      const rows = readJSON(RECEPTION_FILE);
      const row = {
        id: `R${Date.now()}${Math.random().toString(36).slice(2,6)}`,
        receptionType, status: 'pending', submittedAt: new Date().toISOString(),
        patientId: matchedPatient?.patientId || '', ...input
      };
      rows.push(row); writeJSON(RECEPTION_FILE, rows);
      return json(res, 201, { ok: true, id: row.id, patientId: row.patientId, receptionType });
    } catch { return json(res, 400, { error: '入力内容を読み取れませんでした。' }); }
  }
  if (url.pathname.startsWith('/api/reception/') && req.method === 'DELETE') {
    const id = decodeURIComponent(url.pathname.split('/').pop());
    const rows = readJSON(RECEPTION_FILE); const row = rows.find(x => x.id === id);
    if (row) { row.status = 'accepted'; row.acceptedAt = new Date().toISOString(); writeJSON(RECEPTION_FILE, rows); }
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/patients/search' && req.method === 'GET') {
    const name = url.searchParams.get('name') || '';
    const birth = { year:url.searchParams.get('year'), month:url.searchParams.get('month'), day:url.searchParams.get('day') };
    const key = patientKey(name, birth);
    const patients = readJSON(PATIENTS_FILE).filter(p => p.patientKey === key);
    return json(res, 200, patients);
  }
  if (url.pathname === '/api/records' && req.method === 'POST') {
    try {
      const record = await body(req);
      const patientInput = sanitizePatient(record.patient || {});
      if (!patientInput.name || !patientInput.birth.year || !patientInput.birth.month || !patientInput.birth.day) {
        return json(res, 400, { error: '患者名・生年月日が不足しています。' });
      }
      const patients = readJSON(PATIENTS_FILE);
      const key = patientKey(patientInput.name, patientInput.birth);
      let patient = patients.find(p => p.patientKey === key);
      const now = new Date().toISOString();
      if (!patient) {
        patient = { patientId: nextPatientId(patients), patientKey: key, createdAt: now, updatedAt: now, ...patientInput };
        patients.push(patient);
      } else {
        Object.assign(patient, patientInput, { patientKey: key, updatedAt: now });
      }
      writeJSON(PATIENTS_FILE, patients);

      const records = readJSON(RECORDS_FILE);
      const patientRecords = records.filter(r => r.patientId === patient.patientId);
      const sameDate = records.findIndex(r => r.patientId === patient.patientId && r.visitDate === record.visitDate);
      const visitNumber = sameDate >= 0 ? (records[sameDate].visitNumber || 1) : patientRecords.length + 1;
      const saved = {
        ...record,
        patientId: patient.patientId,
        patientKey: key,
        visitNumber,
        savedAt: now,
        patient: { ...patientInput, patientId: patient.patientId }
      };
      if (sameDate >= 0) records[sameDate] = saved; else records.push(saved);
      writeJSON(RECORDS_FILE, records);
      return json(res, 200, { ok:true, patientId:patient.patientId, visitNumber, recordCount:records.length, dataDir:DATA_DIR });
    } catch (e) { return json(res, 400, { error: e.message || '保存できませんでした。' }); }
  }
  if (url.pathname === '/api/records' && req.method === 'GET') {
    const patientId = safeText(url.searchParams.get('patientId'), 30);
    const rows = readJSON(RECORDS_FILE).filter(r => !patientId || r.patientId === patientId).sort((a,b) => String(b.visitDate).localeCompare(String(a.visitDate)));
    return json(res, 200, rows);
  }
  if (url.pathname === '/api/export' && req.method === 'GET') {
    return json(res, 200, { exportedAt:new Date().toISOString(), patients:readJSON(PATIENTS_FILE), records:readJSON(RECORDS_FILE) });
  }

  let pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': file.endsWith('.html') ? 'no-store' : 'public, max-age=60' });
  fs.createReadStream(file).pipe(res);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nBodyOSはすでに起動しています（ポート${PORT}）。`);
    console.error(`ブラウザで http://localhost:${PORT}/ を開いてください。\n`);
  } else console.error(err);
});
server.listen(PORT, '0.0.0.0', () => {
  const base = `http://${localIP()}:${PORT}`;
  console.log('\nBodyOSを起動しました。');
  console.log(`院内画面: ${base}/`);
  console.log(`患者受付: ${base}/?mode=reception`);
  console.log(`保存先: ${DATA_DIR}`);
  console.log('この黒い画面は診療中は閉じないでください。\n');
});
