/*
 * Saran skor menulis otomatis, berbasis aturan (tanpa AI dan tanpa internet).
 * Menghitung 4 aspek rubrik (masing-masing 1 sampai 4) dari bentuk teks:
 * jumlah kata dan kalimat, variasi kosakata, struktur kalimat, kesalahan umum, dan tanda baca.
 * Ini perkiraan, bukan pemahaman makna: guru tetap perlu memeriksa.
 */
(function (root) {
  var VERBS = ('am is are was were be been being have has had do does did will would can could should must ' +
    'like likes liked love loves loved live lives lived play plays played go goes went going come comes came ' +
    'eat eats ate study studies studied help helps helped watch watches watched read reads write writes make ' +
    'makes made want wants wanted need needs needed see sees saw visit visits visited cook cooks cooked spend ' +
    'spent enjoy enjoys enjoyed work works worked learn learns learned get gets got take takes took talk talks ' +
    'talked meet meets met sing sings sang run runs ran walk walks walked use uses used say says said think ' +
    'thinks thought know knows knew give gives gave buy buys bought wear wears wore ride rides rode swim swims ' +
    'swam draw draws drew sleep sleeps slept wake wakes woke').split(' ');
  var VERBSET = {}; VERBS.forEach(function (v) { VERBSET[v] = true; });
  var CONNECT = ('because and but so then when if after before also however while first finally next although that').split(' ');
  var SUBORD = ('because when if after before while although that so').split(' ');
  var COHESION = ('first then because also after finally next however and but so').split(' ');
  var PASTWORDS = ('was were went played visited had did ate saw made took got came met read said thought knew gave bought wore rode swam drew slept woke').split(' ');
  var PASTSET = {}; PASTWORDS.forEach(function (v) { PASTSET[v] = true; });

  var COMMON = {};
  ('the a an i you he she it we they my your his her our their me him us them is am are was were be been do does did ' +
   'have has had will would can could to of in on at for with from by about and or but so because if when then that this ' +
   'these those there here what who where why how not no yes very too also like love live play go going went come make ' +
   'get want need see look help eat study watch read write friend friends family school home name old years year ' +
   'every day week time good best new big small my mother father brother sister like likes').split(' ')
    .forEach(function (w) { COMMON[w] = true; });

  function words(text) { return (text.match(/[A-Za-z']+/g) || []); }

  function isGibberish(w) {
    var l = w.toLowerCase();
    if (l.length < 2) return false;
    return !/[aeiouy]/.test(l) || /(.)\1{2,}/.test(l) || /[^aeiouy']{6,}/.test(l);
  }

  function sentences(text) {
    var raw = text.match(/[^.!?\n]+[.!?]*/g) || [];
    return raw.map(function (s) { return s.trim(); }).filter(function (s) { return words(s).length >= 2; });
  }

  function hasVerb(sentence) {
    return words(sentence).some(function (w) {
      var l = w.toLowerCase();
      return VERBSET[l] || /ed$/.test(l) && l.length > 3 || /ing$/.test(l) && l.length > 4;
    });
  }

  var ERR_RULES = [
    /\bi (is|are|does|has)\b/,
    /\b(he|she|it) (have|are|am|do|don't|go|like|play|live|want|need|love|eat|study)\b/,
    /\b(they|we|you) (is|am|has|was|does)\b/,
    /\b(am|is|are) (go|play|like|live|eat|study|watch|read|write|help|love|have)\b/,
    /\b(more|most) (taller|bigger|better|smaller|faster)\b/,
    /\bmore (good|bad)\b/,
    /\b(many) (water|milk|rice|money|information)\b/
  ];

  function suggest(t1, t2) {
    t1 = String(t1 || ''); t2 = String(t2 || '');
    var text = (t1 + '\n' + t2).trim();
    var W = words(text);
    if (W.length === 0) {
      return { empty: true, total: 0, aspects: [0, 0, 0, 0], metrics: { words: 0, sentences: 0, unique: 0 }, warnings: [] };
    }
    var lower = W.map(function (w) { return w.toLowerCase(); });
    var nW = W.length;
    var uniq = {}; lower.forEach(function (w) { uniq[w] = true; });
    var U = Object.keys(uniq).length;
    var sents = sentences(text);
    var S = sents.length;
    var warnings = [];

    // Teks acak atau asal ketik
    var gib = W.filter(isGibberish).length;
    var counts = {}; lower.forEach(function (w) { counts[w] = (counts[w] || 0) + 1; });
    var top = Math.max.apply(null, Object.keys(counts).map(function (k) { return counts[k]; }));
    var commonCount = lower.filter(function (w) { return COMMON[w]; }).length;
    var gibberish = gib / nW >= 0.3 || (nW >= 8 && commonCount / nW < 0.12);
    var spam = nW >= 8 && top / nW > 0.4;
    if (gibberish) warnings.push('Teks tampak acak, asal ketik, atau bukan bahasa Inggris.');
    if (spam) warnings.push('Satu kata diulang terlalu banyak.');
    var metrics = { words: nW, sentences: S, unique: U };
    if (gibberish || spam) {
      return { empty: false, total: 4, aspects: [1, 1, 1, 1], metrics: metrics, warnings: warnings };
    }

    // 1. Isi dan penyelesaian tugas
    var tw2 = words(t2).length;
    var isi;
    if (nW < 8) isi = 1;
    else if (nW < 20 || S < 3) isi = 2;
    else isi = 3;
    if (tw2 >= 45 && S >= 5) isi = 4;

    // 2. Tata bahasa
    var connectors = lower.filter(function (w) { return CONNECT.indexOf(w) >= 0; }).length;
    var subord = lower.filter(function (w) { return SUBORD.indexOf(w) >= 0; }).length;
    var joined = lower.join(' ');
    var past = lower.some(function (w) { return PASTSET[w] || (/ed$/.test(w) && w.length > 4); });
    var fut = /\bwill\b|\bgoing to\b/.test(joined) || /\b(have|has) (been|gone|seen|lived|visited|\w+ed)\b/.test(joined);
    var errs = 0;
    ERR_RULES.forEach(function (re) { if (re.test(joined)) errs++; });
    var frag = sents.filter(function (s) { return !hasVerb(s); }).length;
    var fragRatio = S ? frag / S : 0;
    var avgLen = S ? nW / S : nW;
    var variety = (connectors >= 1 ? 1 : 0) + (past || fut ? 1 : 0) + (subord >= 1 ? 1 : 0) + (avgLen >= 8 ? 1 : 0);
    var tata = 2;
    if (nW < 10) tata = 1;
    else {
      if (errs === 0 && fragRatio === 0 && S >= 3 && avgLen >= 6) tata += 1;
      if (errs <= 1 && (variety >= 3 || (variety >= 2 && nW >= 60))) tata += 1;
      if (fragRatio > 0.34) tata -= 1;
      if (errs >= 2) tata -= 1;
    }
    tata = Math.max(1, Math.min(4, tata));

    // 3. Kosakata
    var kosa = U < 12 ? 1 : U < 22 ? 2 : U < 40 ? 3 : 4;
    var longRatio = W.filter(function (w) { return w.length >= 7 && /^[a-z]/.test(w); }).length / nW;
    if (longRatio >= 0.1 && U >= 22) kosa += 1;
    if (U / nW < 0.45 && nW >= 25) kosa -= 1;
    kosa = Math.max(1, Math.min(4, kosa));

    // 4. Ejaan, tanda baca, keruntutan
    var capOk = 0, endOk = 0;
    sents.forEach(function (s) { if (/^[A-Z]/.test(s)) capOk++; if (/[.!?]$/.test(s)) endOk++; });
    var mech = S ? (capOk / S + endOk / S) / 2 : 0;
    if (/(^|[\s,.])i(\s|[,.!?]|$)/.test(text)) mech -= 0.15;
    var ejaan = mech < 0.3 ? 1 : mech < 0.6 ? 2 : mech < 0.85 ? 3 : 4;
    var cohesion = lower.filter(function (w) { return COHESION.indexOf(w) >= 0; }).length;
    if (ejaan === 4 && !(cohesion >= 1 && nW >= 40)) ejaan = 3;
    if (S < 3) ejaan = Math.min(ejaan, 2);

    if (nW < 8) warnings.push('Tulisan sangat pendek, saran kurang dapat diandalkan.');
    var aspects = [isi, tata, kosa, ejaan];
    return {
      empty: false,
      total: aspects.reduce(function (a, b) { return a + b; }, 0),
      aspects: aspects, metrics: metrics, warnings: warnings
    };
  }

  root.AutoScore = { suggest: suggest };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AutoScore;
})(typeof window !== 'undefined' ? window : this);
