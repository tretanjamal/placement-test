/**
 * Placement Test Bahasa Inggris: penghubung ke Google Spreadsheet.
 *
 * Tempel seluruh isi file ini ke Apps Script yang terpasang pada spreadsheet Anda
 * (Ekstensi > Apps Script), ganti TEACHER_PIN, lalu Deploy sebagai Web app.
 * Kunci jawaban hanya ada di sini, tidak pernah dikirim ke gadget murid.
 */

// GANTI PIN INI sebelum deploy. PIN dipakai guru untuk membuka halaman hasil.
var TEACHER_PIN = '1234';

var SHEET_NAME = 'Hasil';

// Kunci jawaban: nomor pilihan benar (0 = a, 1 = b, 2 = c, 3 = d).
var KEYS = {
  b: [1, 0, 1, 2, 1, 1, 1, 2, 2, 2, 0, 1, 1, 2, 1, 2, 2, 1, 2, 1, 0, 2, 2, 0, 1, 0, 1, 2, 1, 1],
  c: [1, 2, 1, 1, 1, 1, 2, 1, 2, 1],
  d: [1, 0, 1, 2, 0, 1, 1, 1, 3, 1]
};

var HEAD = ['ID', 'Waktu kirim', 'Nama', 'Sekolah/kelas', 'Tata bahasa (30)', 'Membaca (10)', 'Menyimak (10)',
  'Menulis (16)', 'Berbicara (16)', 'Rata-rata level', 'Level CEFR', 'Kelas', 'Catatan guru',
  'Durasi (detik)', 'Tulisan 1', 'Tulisan 2', 'Jawaban (JSON)'];
// Nomor kolom (mulai dari 1)
var C = { ID: 1, TIME: 2, NAME: 3, CLS: 4, B: 5, C: 6, D: 7, E: 8, F: 9, AVG: 10, CEFR: 11, KELAS: 12, NOTE: 13, DUR: 14, W1: 15, W2: 16, ANS: 17 };

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#1b365d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    // Kolom teks: mencegah isi yang diawali "=" dibaca sebagai rumus.
    [C.ID, C.NAME, C.CLS, C.NOTE, C.W1, C.W2, C.ANS].forEach(function (c) {
      sh.getRange(1, c, 1000, 1).setNumberFormat('@');
    });
    sh.getRange(1, C.TIME, 1000, 1).setNumberFormat('dd/mm/yyyy hh:mm');
    sh.getRange(1, C.AVG, 1000, 1).setNumberFormat('0.00');
    sh.setColumnWidth(C.NAME, 180);
  }
  return sh;
}

function str_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}

function intOrNull_(v, max) {
  if (v === null || v === '' || v === undefined) return null;
  var n = Number(v);
  return (n % 1 === 0 && n >= 0 && n <= max) ? n : undefined;
}

function scoreSection_(key, given) {
  var arr = Array.isArray(given) ? given : [];
  var s = 0;
  var clean = key.map(function (k, i) {
    var a = (typeof arr[i] === 'number' && arr[i] % 1 === 0 && arr[i] >= 0 && arr[i] <= 3) ? arr[i] : null;
    if (a === k) s++;
    return a;
  });
  return { score: s, answers: clean };
}

// Rumus di spreadsheet supaya level dan kelas juga terhitung jika Anda mengisi nilai langsung di sel.
function setFormulas_(sh, r) {
  function lv(col, a, b, c) {
    return 'IF(' + col + r + '<=' + a + ',1,IF(' + col + r + '<=' + b + ',2,IF(' + col + r + '<=' + c + ',3,4)))';
  }
  var avg = '=IF(COUNT(E' + r + ':I' + r + ')<5,"",(' + lv('E', 8, 17, 25) + '+' + lv('F', 3, 6, 8) + '+' + lv('G', 3, 6, 8) +
    '+' + lv('H', 5, 9, 13) + '+2*' + lv('I', 5, 9, 13) + ')/6)';
  var cefr = '=IF(J' + r + '="","",IF(J' + r + '<1.5,"A1",IF(J' + r + '<2.5,"A2",IF(J' + r + '<3.5,"B1","B1 kuat-B2"))))';
  var kelas = '=IF(J' + r + '="","",IF(J' + r + '<1.5,"Pemula",IF(J' + r + '<2.5,"Dasar",IF(J' + r + '<3.5,"Menengah","Lanjutan"))))';
  sh.getRange(r, C.AVG).setFormula(avg);
  sh.getRange(r, C.CEFR).setFormula(cefr);
  sh.getRange(r, C.KELAS).setFormula(kelas);
}

function rowToResult_(v) {
  function n(x) { return (x === '' || x == null) ? null : Number(x); }
  var t = v[C.TIME - 1];
  return {
    id: String(v[C.ID - 1]),
    name: String(v[C.NAME - 1]),
    cls: String(v[C.CLS - 1]),
    submittedAt: t instanceof Date ? t.getTime() : Number(t) || 0,
    durationSec: Number(v[C.DUR - 1]) || 0,
    scores: { b: Number(v[C.B - 1]) || 0, c: Number(v[C.C - 1]) || 0, d: Number(v[C.D - 1]) || 0 },
    writing: { t1: String(v[C.W1 - 1]), t2: String(v[C.W2 - 1]) },
    e: n(v[C.E - 1]),
    f: n(v[C.F - 1]),
    note: String(v[C.NOTE - 1])
  };
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, C.ID, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function doGet() {
  return json_({ ok: true, info: 'API placement test aktif.' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    locked = lock.tryLock(25000);
    if (!locked) return json_({ error: 'Server sedang sibuk, coba lagi.' });
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = req.action;

    if (action === 'submit') return submit_(req);

    // Semua aksi lain khusus guru.
    if (String(req.pin || '') !== String(TEACHER_PIN)) return json_({ error: 'PIN salah.', status: 401 });
    var sh = sheet_();

    if (action === 'results') {
      var last = sh.getLastRow();
      var out = [];
      if (last >= 2) {
        var vals = sh.getRange(2, 1, last - 1, HEAD.length).getValues();
        vals.forEach(function (v) { if (v[C.ID - 1] !== '') out.push(rowToResult_(v)); });
      }
      return json_({ results: out, serverTime: Date.now() });
    }

    if (action === 'patch') {
      var row = findRow_(sh, req.id);
      if (row < 0) return json_({ error: 'Data tidak ditemukan.', status: 404 });
      if ('e' in req) {
        var ev = intOrNull_(req.e, 16);
        if (ev === undefined) return json_({ error: 'Skor menulis harus 0 sampai 16.' });
        if (ev === null) sh.getRange(row, C.E).clearContent(); else sh.getRange(row, C.E).setValue(ev);
      }
      if ('f' in req) {
        var fv = intOrNull_(req.f, 16);
        if (fv === undefined) return json_({ error: 'Skor berbicara harus 0 sampai 16.' });
        if (fv === null) sh.getRange(row, C.F).clearContent(); else sh.getRange(row, C.F).setValue(fv);
      }
      if ('note' in req) sh.getRange(row, C.NOTE).setValue(str_(req.note, 300));
      return json_(rowToResult_(sh.getRange(row, 1, 1, HEAD.length).getValues()[0]));
    }

    if (action === 'delete') {
      var drow = findRow_(sh, req.id);
      if (drow < 0) return json_({ error: 'Data tidak ditemukan.', status: 404 });
      sh.deleteRow(drow);
      return json_({ ok: true });
    }

    return json_({ error: 'Aksi tidak dikenal.' });
  } catch (err) {
    return json_({ error: 'Terjadi kesalahan: ' + err });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function submit_(req) {
  var name = str_(req.name, 80);
  if (!name) return json_({ error: 'Nama wajib diisi.' });
  var a = req.answers || {};
  var b = scoreSection_(KEYS.b, a.b);
  var c = scoreSection_(KEYS.c, a.c);
  var d = scoreSection_(KEYS.d, a.d);
  var w = req.writing || {};
  var sh = sheet_();
  var id = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  var dur = Math.max(0, Math.min(86400, Math.round(Number(req.durationSec) || 0)));
  var row = Math.max(2, sh.getLastRow() + 1);
  sh.getRange(row, 1, 1, HEAD.length).setValues([[
    id, new Date(), name, str_(req.cls, 80), b.score, c.score, d.score, '', '', '', '', '', '',
    dur, str_(w.t1, 4000), str_(w.t2, 4000), JSON.stringify({ b: b.answers, c: c.answers, d: d.answers })
  ]]);
  setFormulas_(sh, row);
  return json_({ ok: true });
}

// Opsional: jalankan sekali dari editor untuk membuat sheet "Hasil" beserta judul kolomnya.
function setup() {
  sheet_();
}
