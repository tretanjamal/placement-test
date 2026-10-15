/* Halaman guru: melihat hasil murid secara langsung. */
(function () {
  const S = window.Scoring;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => n.toFixed(2).replace('.', ',');

  let pin = '';
  let results = [];
  let lastSig = '';
  let pending = false;
  let timer = null;
  let expanded = new Set();
  let delArmed = null;
  let delTimer = null;
  let serverOffset = 0;

  const CFG = window.PT_CONFIG || {};
  const configured = !!CFG.API_URL && !/PASTE/.test(CFG.API_URL);

  // Semua panggilan memakai POST tanpa header khusus (aturan CORS Apps Script).
  function call(body) {
    if (!configured) return Promise.reject(Object.assign(new Error('Belum dihubungkan ke spreadsheet. Isi config.js.'), { status: 0 }));
    return fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify(Object.assign({ pin: pin }, body)) })
      .then((r) => r.json())
      .then((j) => {
        if (j && j.error) { const e = new Error(j.error); e.status = j.status || 400; throw e; }
        return j;
      });
  }
  const sig = () => JSON.stringify(results);
  const calcOf = (r) => S.calc({ b: r.scores.b, c: r.scores.c, d: r.scores.d, e: r.e, f: r.f });

  /* ---------- login ---------- */
  function showDash() {
    $('login').hidden = true; $('dash').hidden = false;
    $('logout').hidden = false; $('live').hidden = false;
    loadInfo();
    poll();
    timer = setInterval(poll, 8000);
  }
  function showLogin(msg) {
    clearInterval(timer);
    $('dash').hidden = true; $('login').hidden = false;
    $('logout').hidden = true; $('live').hidden = true;
    $('login-err').textContent = msg || '';
    try { sessionStorage.removeItem('pt-pin'); } catch (e) { /* abaikan */ }
    pin = '';
  }
  $('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    pin = $('pin').value.trim();
    call({ action: 'results' }).then((j) => {
      try { sessionStorage.setItem('pt-pin', pin); } catch (er) { /* abaikan */ }
      results = j.results; serverOffset = j.serverTime - Date.now();
      showDash(); lastSig = sig(); renderAll();
    }).catch((er) => { $('login-err').textContent = er.status === 401 ? 'PIN salah.' : (er.status === 0 ? er.message : 'Spreadsheet tidak terjangkau. Periksa koneksi internet.'); });
  });
  $('logout').addEventListener('click', () => showLogin(''));

  /* ---------- info alamat ---------- */
  function loadInfo() {
    const u = location.href.split('#')[0].split('?')[0].replace(/guru\.html$/, '');
    $('urls').innerHTML = `<div class="url-box"><code>${esc(u)}</code><button class="btn ghost small" data-copy="${esc(u)}" type="button">Salin</button></div>`;
  }
  $('urls').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-copy]');
    if (!b) return;
    const text = b.getAttribute('data-copy');
    try {
      navigator.clipboard.writeText(text).then(() => { b.textContent = 'Tersalin'; setTimeout(() => { b.textContent = 'Salin'; }, 1500); },
        () => { b.textContent = 'Salin manual'; });
    } catch (er) { b.textContent = 'Salin manual'; }
  });

  /* ---------- polling ---------- */
  function setLive(ok) {
    $('live').classList.toggle('off', !ok);
    $('live-text').textContent = ok
      ? 'Terhubung · ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Koneksi terputus, mencoba lagi…';
  }
  function editing() {
    const a = document.activeElement;
    return a && a.matches && a.matches('.mini, .note-inp');
  }
  function poll() {
    call({ action: 'results' }).then((j) => {
      setLive(true);
      serverOffset = j.serverTime - Date.now();
      results = j.results;
      const s = sig();
      if (s === lastSig) return;
      lastSig = s;
      if (editing()) { pending = true; return; }
      renderAll();
    }).catch((er) => {
      if (er.status === 401) showLogin('PIN berubah, masuk lagi.');
      else setLive(false);
    });
  }
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (pending && !editing()) { pending = false; renderAll(); } }, 50);
  });

  /* ---------- tampilan ---------- */
  function timeStr(ts) { return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
  function durStr(sec) { return sec < 60 ? sec + ' detik' : Math.round(sec / 60) + ' menit'; }

  function renderSummary() {
    const counts = [0, 0, 0, 0]; let wait = 0;
    results.forEach((r) => { const c = calcOf(r); if (c.ok) counts[c.ki]++; else wait++; });
    const total = counts.reduce((a, b) => a + b, 0);
    $('dist-bar').innerHTML = total === 0 ? '' : counts.map((n, i) =>
      n ? `<span class="k${i}" style="flex:${n} 1 0" title="${S.KELAS[i].n}: ${n}"></span>` : '').join('');
    $('legend').innerHTML = counts.map((n, i) =>
      `<div><div class="n">${n}</div><div class="t"><span class="dot k${i}"></span>${S.KELAS[i].n}</div><div class="c">${S.KELAS[i].c}</div></div>`).join('');
    $('sum-sub').textContent = results.length + ' murid sudah mengirim jawaban' +
      (wait ? ', ' + wait + ' menunggu nilai menulis atau berbicara' : '') + '.';
  }

  function calcCells(r) {
    const c = calcOf(r);
    return {
      avg: c.ok ? '<strong>' + fmt(c.avg) + '</strong>' : '<span class="pending">–</span>',
      kelas: c.ok ? `<span class="kelas k${c.ki}">${S.KELAS[c.ki].n}</span> <small>${S.KELAS[c.ki].c}</small>`
        : '<span class="pending">Menunggu nilai</span>',
      flags: c.ok ? c.flags : []
    };
  }
  function scoreCell(r, k, max) {
    const v = r.scores[k];
    return `<td class="num">${v}<span class="lv lv${S.level(k, v)}">${S.LV[S.level(k, v) - 1]}</span></td>`;
  }
  function inputCell(r, k) {
    const v = r[k];
    return `<td class="num"><input class="mini" type="number" inputmode="numeric" min="0" max="16" step="1" ` +
      `data-id="${r.id}" data-k="${k}" value="${v == null ? '' : v}" aria-label="Nilai ${k === 'e' ? 'menulis' : 'berbicara'} ${esc(r.name)}"></td>`;
  }
  function rowHtml(r) {
    const cc = calcCells(r);
    const isNew = Date.now() + serverOffset - r.submittedAt < 3 * 60 * 1000;
    const open = expanded.has(r.id);
    let h = `<tr data-row="${r.id}"><td>${timeStr(r.submittedAt)}${isNew ? '<span class="new">Baru</span>' : ''}</td>` +
      `<td class="name">${esc(r.name)}${r.cls ? '<small>' + esc(r.cls) + '</small>' : ''}</td>` +
      scoreCell(r, 'b') + scoreCell(r, 'c') + scoreCell(r, 'd') + inputCell(r, 'e') + inputCell(r, 'f') +
      `<td class="num avg" data-avg="${r.id}">${cc.avg}</td><td data-kelas="${r.id}">${cc.kelas}</td>` +
      `<td style="text-align:right"><button class="btn ghost small" type="button" data-toggle="${r.id}">${open ? 'Tutup' : 'Detail'}</button></td></tr>`;
    if (open) h += detailHtml(r, cc);
    return h;
  }
  function detailHtml(r, cc) {
    const armed = delArmed === r.id;
    return `<tr class="detail" data-detail="${r.id}"><td colspan="10"><div class="detail"><div class="detail-grid">
      <div><h4>Menulis, Tugas 1</h4><div class="write-box">${esc(r.writing.t1) || '<span class="pending">Tidak diisi</span>'}</div>
        <h4 style="margin-top:12px">Menulis, Tugas 2</h4><div class="write-box">${esc(r.writing.t2) || '<span class="pending">Tidak diisi</span>'}</div></div>
      <div><h4>Catatan guru</h4>
        <input class="inp note-inp" type="text" maxlength="300" data-id="${r.id}" value="${esc(r.note)}" placeholder="Misalnya: pemalu saat berbicara">
        <p style="margin:12px 0 4px;color:var(--muted);font-size:14px">Lama mengerjakan: ${durStr(r.durationSec)}</p>
        <div class="flag" data-flags="${r.id}">${cc.flags.map(esc).join('<br>')}</div>
        <div style="margin-top:14px"><button class="btn ${armed ? 'danger' : 'ghost'} small" type="button" data-del="${r.id}">${armed ? 'Yakin hapus hasil ini?' : 'Hapus hasil'}</button></div></div>
    </div></div></td></tr>`;
  }

  function visible() {
    const q = $('q').value.trim().toLowerCase();
    const f = $('filter').value, so = $('sort').value;
    const list = results.filter((r) => {
      if (q && r.name.toLowerCase().indexOf(q) < 0) return false;
      const c = calcOf(r);
      if (f === 'all') return true;
      if (f === 'wait') return !c.ok;
      return c.ok && String(c.ki) === f;
    });
    list.sort((a, b) => {
      if (so === 'name') return a.name.localeCompare(b.name, 'id');
      if (so === 'new') return b.submittedAt - a.submittedAt;
      const ca = calcOf(a), cb = calcOf(b);
      const va = ca.ok ? ca.avg : -1, vb = cb.ok ? cb.avg : -1;
      return so === 'hi' ? vb - va : va - vb;
    });
    return list;
  }
  function renderRows() {
    const list = visible();
    $('rows').innerHTML = list.map(rowHtml).join('');
    const e = $('empty');
    if (results.length === 0) {
      e.hidden = false;
      e.innerHTML = 'Belum ada murid yang mengirim jawaban. Halaman ini diperbarui otomatis setiap beberapa detik.';
    } else if (list.length === 0) {
      e.hidden = false; e.textContent = 'Tidak ada murid yang cocok dengan pencarian atau filter ini.';
    } else { e.hidden = true; }
  }
  function renderAll() { renderSummary(); renderRows(); }

  /* ---------- interaksi ---------- */
  ['q', 'filter', 'sort'].forEach((id) => $(id).addEventListener('input', renderRows));

  $('rows').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.toggle) {
      const id = t.dataset.toggle;
      if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
      renderRows();
    } else if (t.dataset.del) {
      const id = t.dataset.del;
      if (delArmed === id) {
        clearTimeout(delTimer); delArmed = null;
        call({ action: 'delete', id: id }).then(() => {
          results = results.filter((r) => r.id !== id); expanded.delete(id);
          lastSig = sig(); renderAll();
        }).catch(() => {});
      } else {
        delArmed = id; renderRows();
        clearTimeout(delTimer);
        delTimer = setTimeout(() => { delArmed = null; renderRows(); }, 3500);
      }
    }
  });

  function patch(id, body, inputEl) {
    return call(Object.assign({ action: 'patch', id: id }, body)).then((r) => {
      const i = results.findIndex((x) => x.id === id);
      if (i >= 0) results[i] = r;
      lastSig = sig();
      if (inputEl) inputEl.removeAttribute('aria-invalid');
      const cc = calcCells(r);
      const a = document.querySelector('[data-avg="' + id + '"]');
      const k = document.querySelector('[data-kelas="' + id + '"]');
      const f = document.querySelector('[data-flags="' + id + '"]');
      if (a) a.innerHTML = cc.avg;
      if (k) k.innerHTML = cc.kelas;
      if (f) f.innerHTML = cc.flags.map(esc).join('<br>');
      renderSummary();
    }).catch((er) => { if (inputEl) { inputEl.setAttribute('aria-invalid', 'true'); inputEl.title = er.message; } });
  }
  $('rows').addEventListener('change', (e) => {
    const t = e.target;
    if (t.classList.contains('mini')) {
      const raw = t.value.trim();
      const v = raw === '' ? null : Number(raw);
      if (v !== null && (!Number.isInteger(v) || v < 0 || v > 16)) { t.setAttribute('aria-invalid', 'true'); return; }
      patch(t.dataset.id, { [t.dataset.k]: v }, t);
    } else if (t.classList.contains('note-inp')) {
      patch(t.dataset.id, { note: t.value }, t);
    }
  });

  /* ---------- CSV ---------- */
  function cell(v) {
    const t = String(v == null ? '' : v);
    return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }
  $('csv').addEventListener('click', () => {
    const head = ['Nama', 'Sekolah/kelas', 'Waktu kirim', 'Tata bahasa', 'Membaca', 'Menyimak', 'Menulis', 'Berbicara',
      'Rata-rata level', 'Level CEFR', 'Kelas', 'Perhatian', 'Catatan'];
    const rows = results.slice().sort((a, b) => a.name.localeCompare(b.name, 'id')).map((r) => {
      const c = calcOf(r);
      return [r.name, r.cls, new Date(r.submittedAt).toLocaleString('id-ID'), r.scores.b, r.scores.c, r.scores.d,
        r.e == null ? '' : r.e, r.f == null ? '' : r.f,
        c.ok ? fmt(c.avg) : '', c.ok ? S.KELAS[c.ki].c : '', c.ok ? S.KELAS[c.ki].n : 'Menunggu nilai',
        c.ok ? c.flags.join('; ') : '', r.note].map(cell).join(',');
    });
    const blob = new Blob(['﻿' + [head.map(cell).join(',')].concat(rows).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hasil-placement-test.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  /* ---------- mulai ---------- */
  try {
    const saved = sessionStorage.getItem('pt-pin');
    if (saved) {
      pin = saved;
      call({ action: 'results' }).then((j) => {
        results = j.results; serverOffset = j.serverTime - Date.now();
        showDash(); lastSig = sig(); renderAll();
      }).catch(() => showLogin(''));
    }
  } catch (e) { /* abaikan */ }
})();
