/* Aturan penilaian sesuai instrumen placement test. Dipakai halaman guru. */
(function (root) {
  var SKILLS = [
    { k: 'b', name: 'Tata bahasa', max: 30 },
    { k: 'c', name: 'Membaca', max: 10 },
    { k: 'd', name: 'Menyimak', max: 10 },
    { k: 'e', name: 'Menulis', max: 16 },
    { k: 'f', name: 'Berbicara', max: 16 }
  ];
  var CUT = { b: [8, 17, 25], c: [3, 6, 8], d: [3, 6, 8], e: [5, 9, 13], f: [5, 9, 13] };
  var LV = ['A1', 'A2', 'B1', 'B2'];
  var KELAS = [
    { n: 'Pemula', c: 'A1' }, { n: 'Dasar', c: 'A2' },
    { n: 'Menengah', c: 'B1' }, { n: 'Lanjutan', c: 'B1 kuat–B2' }
  ];

  function level(k, v) {
    var c = CUT[k];
    return v <= c[0] ? 1 : v <= c[1] ? 2 : v <= c[2] ? 3 : 4;
  }

  // s = { b, c, d, e, f } (angka atau null)
  function calc(s) {
    var lv = {}, ok = true;
    SKILLS.forEach(function (x) {
      var v = s[x.k];
      if (v == null) { ok = false; return; }
      lv[x.k] = level(x.k, v);
    });
    if (!ok) return { ok: false, lv: lv };
    var avg = (lv.b + lv.c + lv.d + lv.e + 2 * lv.f) / 6;
    var ki = avg < 1.5 ? 0 : avg < 2.5 ? 1 : avg < 3.5 ? 2 : 3;
    var vals = SKILLS.map(function (x) { return lv[x.k]; });
    var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
    var flags = [];
    if (mx - mn >= 2) {
      var weak = SKILLS.filter(function (x) { return lv[x.k] === mn; }).map(function (x) { return x.name; });
      flags.push('Perkuat: ' + weak.join(', '));
    }
    if ([1.5, 2.5, 3.5].some(function (t) { return Math.abs(avg - t) <= 0.1; })) {
      flags.push('Dekat batas level, putuskan dari wawancara dan tulisan');
    }
    return { ok: true, lv: lv, avg: avg, ki: ki, flags: flags };
  }

  root.Scoring = { SKILLS: SKILLS, LV: LV, KELAS: KELAS, level: level, calc: calc };
})(window);
