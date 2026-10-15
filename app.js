/* Halaman murid: mengerjakan placement test di gadget. */
(function () {
  const LS_KEY = 'placement-test-state-v1';
  const PER_PAGE = 5;
  const MAX_PLAYS = 2;
  const app = document.getElementById('app');
  const progress = document.getElementById('progress');
  const bar = document.getElementById('progress-bar');
  const meta = document.getElementById('step-meta');

  let Q = null;
  let pages = [];
  let st = null;          // state murid
  let audioFile = {};     // idx -> true/false (apakah file mp3 tersedia)
  let speaking = null;    // idx rekaman yang sedang diputar
  let htmlAudio = null;
  let resumePage = 0;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = 'abcd';
  const CFG = window.PT_CONFIG || {};
  const configured = !!CFG.API_URL && !/PASTE/.test(CFG.API_URL);

  function blank() {
    return {
      started: false, name: '', cls: '', page: 0, startedAt: 0,
      answers: { b: Array(30).fill(null), c: Array(10).fill(null), d: Array(10).fill(null) },
      writing: { t1: '', t2: '' }, plays: [0, 0]
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return blank();
      const s = JSON.parse(raw);
      return Object.assign(blank(), s);
    } catch (e) { return blank(); }
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) { /* abaikan */ } }
  function clearSaved() { try { localStorage.removeItem(LS_KEY); } catch (e) { /* abaikan */ } }

  function buildPages() {
    pages = [{ t: 'intro' }];
    for (let i = 0; i < Q.b.items.length; i += PER_PAGE) pages.push({ t: 'q', sec: 'b', from: i });
    Q.c.passages.forEach((_, i) => pages.push({ t: 'read', idx: i }));
    Q.d.clips.forEach((_, i) => pages.push({ t: 'listen', idx: i }));
    pages.push({ t: 'write' });
    pages.push({ t: 'review' });
  }
  const firstPage = (pred) => pages.findIndex(pred);

  /* ---------- helpers tampilan ---------- */
  function questionsHtml(sec, start, items) {
    return items.map((it, k) => {
      const n = start + k;
      const cur = st.answers[sec][n];
      const opts = it.o.map((o, j) =>
        `<label class="opt"><input type="radio" name="q-${sec}-${n}" data-sec="${sec}" data-n="${n}" value="${j}"${cur === j ? ' checked' : ''}>` +
        `<span><b>${L[j]}</b><em style="font-style:normal">${esc(o)}</em></span></label>`).join('');
      return `<div class="q" role="radiogroup" aria-labelledby="ql-${sec}-${n}">` +
        `<p class="q-text" id="ql-${sec}-${n}"><span class="q-no">${n + 1}.</span>${esc(it.q)}</p>` +
        `<div class="opts">${opts}</div></div>`;
    }).join('');
  }
  function navHtml(prevLabel, nextLabel) {
    return `<div class="nav"><button class="btn ghost" data-nav="prev" type="button">${prevLabel || 'Kembali'}</button>` +
      `<button class="btn" data-nav="next" type="button">${nextLabel || 'Lanjut'}</button></div>`;
  }
  function wordCount(t) { const m = t.trim().match(/\S+/g); return m ? m.length : 0; }

  /* ---------- halaman ---------- */
  function renderIntro() {
    const resume = st.started && st.name
      ? `<div class="notice" style="margin-bottom:14px"><strong>Ada tes yang belum selesai atas nama ${esc(st.name)}.</strong>` +
        `<div class="nav" style="margin-top:10px"><button class="btn" id="resume" type="button">Lanjutkan</button>` +
        `<button class="btn ghost" id="restart" type="button">Mulai baru</button></div></div>` : '';
    app.innerHTML = `<div class="card">
      <h2>Selamat datang</h2>
      <p class="lead">Tes ini untuk mengetahui kemampuan bahasa Inggrismu sebelum kursus dimulai, supaya kamu masuk kelas yang pas.</p>
      ${resume}
      <div class="stack">
        <div><label class="fl" for="f-name">Nama lengkap</label>
          <input class="inp" id="f-name" type="text" autocomplete="name" maxlength="80" value="${esc(st.started ? '' : st.name)}" placeholder="Tulis namamu">
          <div class="err" id="err-name"></div></div>
        <div><label class="fl" for="f-cls">Sekolah dan kelas <span class="opt">(boleh dikosongkan)</span></label>
          <input class="inp" id="f-cls" type="text" maxlength="80" value="${esc(st.cls)}" placeholder="Contoh: SMPN 5, kelas 8B"></div>
      </div>
      <div class="notice" style="margin:18px 0">
        <strong>Sebelum mulai</strong>
        <ul class="list">
          <li>Ini bukan ujian lulus atau gagal, dan tidak mempengaruhi nilai sekolah.</li>
          <li>Kerjakan sejauh yang kamu bisa. Soal makin sulit di bagian akhir.</li>
          <li>Jangan menebak sembarangan, dan jangan membuka kamus atau ponsel lain.</li>
          <li>Untuk bagian menyimak, nyalakan suara dan pakai earphone jika ada.</li>
          <li>Lama pengerjaan sekitar 45 menit. Tes berbicara dilakukan langsung dengan gurumu.</li>
        </ul>
      </div>
      <button class="btn block" id="start" type="button">Mulai tes</button>
    </div>`;
  }

  function renderQ(p) {
    const items = Q[p.sec].items.slice(p.from, p.from + PER_PAGE);
    app.innerHTML = `<div class="card">
      <div class="step-label">Bagian A dari E</div>
      <h2 class="sec-title">${esc(Q.b.title)}</h2>
      <p class="lead">${esc(Q.b.instr)}</p>
      ${questionsHtml('b', p.from, items)}
      ${navHtml()}
    </div>`;
  }

  function renderRead(p) {
    const ps = Q.c.passages[p.idx];
    const start = p.idx * 5;
    app.innerHTML = `<div class="card">
      <div class="step-label">Bagian B dari E · Teks ${p.idx + 1} dari ${Q.c.passages.length}</div>
      <h2 class="sec-title">${esc(Q.c.title)}</h2>
      <p class="lead">${esc(Q.c.instr)}</p>
      <div class="passage"><h3>${esc(ps.title)}</h3>${esc(ps.text)}</div>
      ${questionsHtml('c', start, ps.items)}
      ${navHtml()}
    </div>`;
  }

  function audioCardHtml(idx) {
    const clip = Q.d.clips[idx];
    const left = Math.max(0, MAX_PLAYS - (st.plays[idx] || 0));
    const canTts = 'speechSynthesis' in window;
    const hasFile = audioFile[idx] === true;
    let status = '';
    let disabled = false;
    if (speaking === idx) { status = 'Sedang diputar…'; disabled = true; }
    else if (left === 0) { status = 'Kesempatan memutar sudah habis.'; disabled = true; }
    else if (!hasFile && !canTts) { status = 'Perangkat ini tidak bisa memutar suara. Mintalah guru membacakannya.'; disabled = true; }
    else { status = 'Sisa kesempatan memutar: ' + left + ' kali'; }
    return `<div class="audio-card" id="audio-card">
      <button class="btn" id="play" type="button" data-idx="${idx}"${disabled ? ' disabled' : ''}>&#9654; Putar</button>
      <div class="info"><strong>${esc(clip.title)}</strong><span>${esc(status)}</span></div>
    </div>`;
  }
  function renderListen(p) {
    const clip = Q.d.clips[p.idx];
    const start = p.idx * 5;
    app.innerHTML = `<div class="card">
      <div class="step-label">Bagian C dari E · Rekaman ${p.idx + 1} dari ${Q.d.clips.length}</div>
      <h2 class="sec-title">${esc(Q.d.title)}</h2>
      <p class="lead">${esc(Q.d.instr)}</p>
      ${audioCardHtml(p.idx)}
      ${questionsHtml('d', start, clip.items)}
      ${navHtml()}
    </div>`;
    if (audioFile[p.idx] === undefined) {
      fetch('audio/' + clip.audio, { method: 'HEAD' }).then((r) => { audioFile[p.idx] = r.ok; }, () => { audioFile[p.idx] = false; })
        .then(refreshAudioCard);
    }
  }
  function refreshAudioCard() {
    const p = pages[st.page];
    if (!p || p.t !== 'listen') return;
    const el = document.getElementById('audio-card');
    if (el) el.outerHTML = audioCardHtml(p.idx);
  }

  function stopAudio() {
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* abaikan */ }
    if (htmlAudio) { try { htmlAudio.pause(); } catch (e) { /* abaikan */ } htmlAudio = null; }
    speaking = null;
  }
  function finishPlay() { speaking = null; refreshAudioCard(); }
  function play(idx) {
    if (speaking !== null || (st.plays[idx] || 0) >= MAX_PLAYS) return;
    const clip = Q.d.clips[idx];
    st.plays[idx] = (st.plays[idx] || 0) + 1;
    save();
    speaking = idx;
    if (audioFile[idx] === true) {
      htmlAudio = new Audio('audio/' + clip.audio);
      htmlAudio.onended = finishPlay;
      htmlAudio.onerror = finishPlay;
      htmlAudio.play().catch(finishPlay);
      refreshAudioCard();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const voices = synth.getVoices ? synth.getVoices() : [];
    const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
    const pick = (i) => en.length ? en[i % en.length] : null;
    const who = {};
    clip.script.forEach((line, i) => {
      const u = new SpeechSynthesisUtterance(line[1]);
      u.lang = 'en-US';
      u.rate = 0.88;
      if (!(line[0] in who)) who[line[0]] = Object.keys(who).length;
      const k = who[line[0]];
      const v = pick(k);
      if (v) u.voice = v;
      u.pitch = k === 0 ? 1.1 : 0.85;
      if (i === clip.script.length - 1) { u.onend = finishPlay; u.onerror = finishPlay; }
      synth.speak(u);
    });
    refreshAudioCard();
  }

  function renderWrite() {
    const T = Q.e.tasks;
    const box = (t) => `<div class="q"><p class="q-text">${esc(t.title)}</p>
      <p class="lead" style="margin-bottom:8px">${esc(t.prompt)}</p>
      <textarea class="inp" id="w-${t.id}" data-w="${t.id}" rows="6" placeholder="Write here...">${esc(st.writing[t.id])}</textarea>
      <div class="wc" id="wc-${t.id}">${wordCount(st.writing[t.id])} kata</div></div>`;
    app.innerHTML = `<div class="card">
      <div class="step-label">Bagian D dari E</div>
      <h2 class="sec-title">${esc(Q.e.title)}</h2>
      <p class="lead">${esc(Q.e.instr)}</p>
      ${T.map(box).join('')}
      ${navHtml()}
    </div>`;
  }

  function sectionStat(sec) {
    const a = st.answers[sec];
    return { done: a.filter((x) => x !== null).length, total: a.length };
  }
  function renderReview(errMsg) {
    const rows = [
      ['b', 'A. Tata bahasa dan kosakata', firstPage((p) => p.t === 'q')],
      ['c', 'B. Membaca', firstPage((p) => p.t === 'read')],
      ['d', 'C. Menyimak', firstPage((p) => p.t === 'listen')]
    ].map(([sec, label, pg]) => {
      const s = sectionStat(sec);
      const warn = s.done < s.total;
      return `<div class="sum-row${warn ? ' warn' : ''}"><span>${label}: <strong>${s.done}</strong> dari ${s.total} dijawab</span>` +
        `<button type="button" data-goto="${pg}">Periksa</button></div>`;
    }).join('');
    const w1 = st.writing.t1.trim().length > 0, w2 = st.writing.t2.trim().length > 0;
    const wp = firstPage((p) => p.t === 'write');
    const writeRow = `<div class="sum-row${w1 ? '' : ' warn'}"><span>D. Menulis: Tugas 1 ${w1 ? 'terisi' : 'belum diisi'}, Tugas 2 ${w2 ? 'terisi' : 'tidak diisi'}</span>` +
      `<button type="button" data-goto="${wp}">Periksa</button></div>`;
    app.innerHTML = `<div class="card">
      <div class="step-label">Hampir selesai</div>
      <h2 class="sec-title">Periksa dan kirim</h2>
      <p class="lead">Soal yang kosong boleh tetap dikirim. Setelah dikirim, jawaban tidak bisa diubah.</p>
      <div class="summary">${rows}${writeRow}</div>
      <div class="err" id="submit-err">${esc(errMsg || '')}</div>
      <div class="nav"><button class="btn ghost" data-nav="prev" type="button">Kembali</button>
      <button class="btn" id="submit" type="button">Kirim jawaban</button></div>
    </div>`;
  }

  function renderDone() {
    progress.hidden = true; meta.textContent = '';
    app.innerHTML = `<div class="card">
      <div class="done-mark" aria-hidden="true">&#10003;</div>
      <h2>Terima kasih, jawabanmu sudah terkirim</h2>
      <p class="lead">Hasil tes akan disampaikan oleh gurumu. Sekarang beri tahu guru bahwa kamu sudah selesai, lalu lanjut ke tes berbicara.</p>
      <p style="margin:0;color:var(--muted)">Kamu boleh menutup halaman ini.</p>
    </div>`;
  }

  /* ---------- alur ---------- */
  function show() {
    stopAudio();
    const p = pages[st.page];
    progress.hidden = p.t === 'intro';
    bar.style.width = (st.page / (pages.length - 1) * 100) + '%';
    meta.textContent = p.t === 'intro' ? '' : 'Langkah ' + st.page + ' dari ' + (pages.length - 1);
    if (p.t === 'intro') renderIntro();
    else if (p.t === 'q') renderQ(p);
    else if (p.t === 'read') renderRead(p);
    else if (p.t === 'listen') renderListen(p);
    else if (p.t === 'write') renderWrite();
    else renderReview();
    window.scrollTo(0, 0);
  }
  function go(i) {
    st.page = Math.max(0, Math.min(pages.length - 1, i));
    save(); show();
  }

  function startTest() {
    const name = document.getElementById('f-name').value.trim();
    if (!name) {
      const e = document.getElementById('err-name');
      e.textContent = 'Nama wajib diisi.';
      document.getElementById('f-name').setAttribute('aria-invalid', 'true');
      document.getElementById('f-name').focus();
      return;
    }
    st = blank();
    st.name = name;
    st.cls = document.getElementById('f-cls').value.trim();
    st.started = true;
    st.startedAt = Date.now();
    go(1);
  }

  function submit() {
    const btn = document.getElementById('submit');
    btn.disabled = true; btn.textContent = 'Mengirim…';
    fetch(CFG.API_URL, {
      method: 'POST', // tanpa header khusus agar tidak memicu preflight CORS di Apps Script
      body: JSON.stringify({
        action: 'submit', name: st.name, cls: st.cls, answers: st.answers, writing: st.writing,
        durationSec: Math.round((Date.now() - st.startedAt) / 1000)
      })
    }).then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        clearSaved();
        renderDone();
      })
      .catch((e) => {
        renderReview('Jawaban belum terkirim: ' + (e.message || 'periksa koneksi Wi-Fi') + '. Jawabanmu aman, coba kirim lagi.');
      });
  }

  /* ---------- event ---------- */
  app.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'start') return startTest();
    if (t.id === 'resume') return go(resumePage || 1);
    if (t.id === 'restart') { clearSaved(); st = blank(); show(); return; }
    if (t.id === 'submit') return submit();
    if (t.id === 'play') return play(Number(t.getAttribute('data-idx')));
    if (t.dataset.nav === 'prev') return go(st.page - 1);
    if (t.dataset.nav === 'next') return go(st.page + 1);
    if (t.dataset.goto) return go(Number(t.dataset.goto));
  });
  app.addEventListener('change', (e) => {
    const r = e.target;
    if (r.matches && r.matches('input[type=radio][data-sec]')) {
      st.answers[r.dataset.sec][Number(r.dataset.n)] = Number(r.value);
      save();
    }
  });
  app.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.w) {
      st.writing[t.dataset.w] = t.value;
      document.getElementById('wc-' + t.dataset.w).textContent = wordCount(t.value) + ' kata';
      save();
    } else if (t.id === 'f-name') {
      t.removeAttribute('aria-invalid');
      document.getElementById('err-name').textContent = '';
    }
  });
  window.addEventListener('pagehide', stopAudio);

  /* ---------- mulai ---------- */
  fetch('questions.json').then((r) => r.json()).then((q) => {
    Q = q;
    if (!configured) {
      app.innerHTML = '<div class="card"><h2>Aplikasi belum dihubungkan ke spreadsheet</h2><p class="lead">Guru: isi alamat Web app Google Apps Script di file config.js (lihat README, langkah 3), lalu muat ulang halaman ini.</p></div>';
      return;
    }
    buildPages();
    st = load();
    // Tampilkan halaman awal dulu; jika ada tes yang belum selesai, murid bisa melanjutkan.
    resumePage = st.started ? st.page : 0;
    st.page = 0;
    show();
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices) speechSynthesis.getVoices();
  }).catch(() => {
    app.innerHTML = '<div class="card"><h2>Soal tidak bisa dimuat</h2><p class="lead">Periksa koneksi Wi-Fi, lalu muat ulang halaman ini.</p></div>';
  });
})();
