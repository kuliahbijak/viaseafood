/* ==========================================================================
   VIA SEAFOOD — struk.js
   Model struk thermal yang bisa diedit Owner (template teks berdirektif):
     [C] tengah  [R] kanan  [B] tebal  [2] huruf besar  [H] tinggi ganda  [LR]kiri||kanan
     [-] [=] garis  [QR] QR verifikasi  [LOGO] logo struk  [BOX] blok sorot  [FEED] spasi  [CUT] potong
     {{KUNCI|pengubah}}  {{#ITEM}}…{{/ITEM}}  {{?KUNCI}}…{{/KUNCI}} (baris atau sebaris)
   Keluaran: pratinjau HTML, cetak browser (58/80 mm), PNG, ESC/POS (Web Bluetooth / RawBT), teks WA.
   ========================================================================== */
'use strict';
var Struk = {
  /* ---------- data ---------- */
  pengaturan: function () { return Object.assign({ lebar: 58, hemat: false, headerRingkas: true, logo: true, qr: true, rincianTimbang: true, salinan: 1, beep: true, autoCut: true, density: 'pekat', template58: 'STRUK_58', template80: 'STRUK_80', templateHemat: 'STRUK_58_HEMAT' }, (AppState.cfg && AppState.cfg.printer) || {}, Store.get('printerLokal', {}) || {}); },
  template: function (kode) { var t = (AppState.struk || []).filter(function (x) { return x.kode === kode; })[0]; return t || (AppState.struk || [])[0] || { kode: 'X', lebar: 32, isi: '[C][B]{{TOKO_NAMA}}\n[-]\n{{#ITEM}}\n[LR]{{ITEM.NAMA}} {{ITEM.QTY}}{{ITEM.SATUAN}}||{{ITEM.SUB|angka}}\n{{/ITEM}}\n[-]\n[B][LR]TOTAL||{{TOTAL|rp}}' }; },
  templatePilihan: function (opsi) { var p = Object.assign(this.pengaturan(), opsi || {}); return p.kode || (p.lebar === 80 ? p.template80 : (p.hemat ? p.templateHemat : p.template58)); },
  urlVerif: function (o) { var base = (AppState.cfg && AppState.cfg.appUrl) || location.href.split('#')[0]; return base.replace(/#.*$/, '') + '#/v/' + o.id + '-' + o.kode; },
  dataDari: function (o, opsi) {
    opsi = opsi || {};
    var cfg = AppState.cfg || {}, tempo = !!o.piutangId && o.status !== 'Batal', batal = o.status === 'Batal', lunasTunai = !tempo && !batal;
    var sisa = tempo && o.status !== 'Lunas' ? Math.max(0, o.total - (o.dp || 0)) : 0;
    var p = String(o.tanggal || '').split('-'), user = AppState.user || {};
    return {
      TOKO_NAMA: cfg.tokoNama || 'Via Seafood', TOKO_ALAMAT: cfg.tokoAlamat || '', TOKO_WA: hpTampil(cfg.tokoWa), LOKASI: cfg.lokasi || '',
      NOTA: o.id, TANGGAL: p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : o.tanggal, TANGGAL_ISO: o.tanggal, JAM: (o.waktu || '').slice(0, 5) + (o.detik || ''),
      KASIR: o.petugas || user.nama || '', SHIFT: opsi.shift || '', TERMINAL: (Store.get('perangkat', '') || (o.terminal || '').split(' • ')[0] || '-'),
      PELANGGAN: o.pelanggan || 'Pelanggan Umum', PELANGGAN_WA: hpTampil(o.wa), ALAMAT: o.alamat || '',
      SUBTOTAL: o.subtotal, DISKON: o.diskon || 0, PAJAK: o.pajak || 0, PAJAK_LABEL: cfg.pajakLabel || 'Pajak', TOTAL: o.total,
      METODE: o.metode || 'Tunai', DITERIMA: o.diterima || o.total, KEMBALI: o.kembalian || 0, DP: o.dp || 0, SISA: sisa, JATUH_TEMPO: o.jatuhTempo ? tglSingkat(o.jatuhTempo) : '',
      STATUS: batal ? 'DIBATALKAN' : tempo ? (o.status === 'Lunas' ? 'LUNAS (TEMPO)' : 'TEMPO - BELUM LUNAS') : 'LUNAS (' + String(o.metode || 'Tunai').toUpperCase() + ')',
      LUNAS: lunasTunai ? 'YA' : '', TEMPO: tempo ? 'YA' : '', BATAL: batal ? 'YA' : '', CATATAN: o.catatan || '',
      JUMLAH_ITEM: (o.items || []).length, TOTAL_BERAT: angka(o.berat || 0), HASH: o.hash ? 'sha256:' + String(o.hash).slice(0, 32) : (o.kode ? 'kode:' + o.kode : ''),
      URL_VERIFIKASI: o.kode ? this.urlVerif(o) : '',
      HEADER_LENGKAP: opsi.headerRingkas ? '' : 'YA', HEADER_RINGKAS: opsi.headerRingkas ? 'YA' : '', CATATAN_TIMBANG: opsi.rincianTimbang === false ? '' : 'YA',
      ITEM: (o.items || []).map(function (i, k) { return { NO: k + 1, NAMA: i.nama, GRADE: i.grade || '', SKU: i.sku || '', QTY: angka(i.qty), SATUAN: i.satuan || 'kg', HARGA: i.harga, SUB: i.sub }; })
    };
  },
  /* ---------- mesin template ---------- */
  kosong: function (v) { return v === undefined || v === null || v === '' || v === 0 || v === '0' || (Array.isArray(v) && !v.length); },
  terbilang: function (n) {
    n = Math.floor(Math.abs(Number(n) || 0)); var s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
    function t(x) { if (x < 12) return s[x]; if (x < 20) return t(x - 10) + ' belas'; if (x < 100) return t(Math.floor(x / 10)) + ' puluh ' + t(x % 10); if (x < 200) return 'seratus ' + t(x - 100); if (x < 1000) return t(Math.floor(x / 100)) + ' ratus ' + t(x % 100); if (x < 2000) return 'seribu ' + t(x - 1000); if (x < 1e6) return t(Math.floor(x / 1000)) + ' ribu ' + t(x % 1000); if (x < 1e9) return t(Math.floor(x / 1e6)) + ' juta ' + t(x % 1e6); return t(Math.floor(x / 1e9)) + ' miliar ' + t(x % 1e9); }
    return n === 0 ? 'nol' : t(n).replace(/\s+/g, ' ').trim();
  },
  ubah: function (v, peng) {
    v = v === undefined || v === null ? '' : v;
    String(peng || '').split('|').forEach(function (p) {
      p = p.trim(); if (!p) return; var nm = p.split(':')[0].toLowerCase(), arg = p.slice(nm.length + 1);
      if (nm === 'bawaan' || nm === 'default') { if (String(v) === '') v = arg; }
      else if (nm === 'kosong0') { if (Number(v) === 0) v = ''; }
      else if (nm === 'kapital' || nm === 'upper') v = String(v).toUpperCase();
      else if (nm === 'kecil') v = String(v).toLowerCase();
      else if (nm === 'judul') v = String(v).toLowerCase().replace(/\b\w/g, function (h) { return h.toUpperCase(); });
      else if (nm === 'rp' || nm === 'rupiah') v = String(v) === '' ? '' : rp(v);
      else if (nm === 'angka' || nm === 'ribuan') v = String(v) === '' ? '' : angka(v);
      else if (nm === 'terbilang') v = Struk.terbilang(v) + (arg === 'rupiah' ? ' rupiah' : '');
      else if (nm === 'potong') { var n = Number(arg) || 20; if (String(v).length > n) v = String(v).slice(0, n); }
      else if (nm === 'tgl' || nm === 'tanggal') v = tglSingkat(String(v));
      else if (nm === 'awal') { if (String(v) !== '') v = arg + v; } else if (nm === 'akhir') { if (String(v) !== '') v = v + arg; }
    });
    return String(v);
  },
  isiBaris: function (s, data) {
    var self = this, guard = 0;
    while (/\{\{\s*\?/.test(s) && guard++ < 20) {
      s = s.replace(/\{\{\s*\?\s*([A-Za-z][\w.]*)\s*\}\}([\s\S]*?)\{\{\s*\/\s*\1\s*\}\}/i, function (m, k, isi) { return self.kosong(data[k.toUpperCase()]) ? '' : isi; });
      if (!/\{\{\s*\?\s*([A-Za-z][\w.]*)\s*\}\}[\s\S]*?\{\{\s*\/\s*\1\s*\}\}/i.test(s)) s = s.replace(/\{\{\s*[?\/]\s*[A-Za-z][\w.]*\s*\}\}/g, '');
    }
    return s.replace(/\{\{\s*([A-Za-z][\w.]*)\s*(?:\|([^}]*))?\}\}/g, function (m, k, peng) { return self.ubah(data[k.toUpperCase()], peng); });
  },
  proses: function (lines, data, out) {
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i], tr = ln.trim();
      if (/^\/\//.test(tr)) continue;
      var mb = tr.match(/^\{\{\s*#\s*([A-Za-z]\w*)\s*\}\}$/), mc = tr.match(/^\{\{\s*\?\s*([A-Za-z][\w.]*)\s*\}\}$/);
      if (mb || mc) {
        var key = (mb || mc)[1].toUpperCase(), dalam = 0, j = i + 1, isi = [];
        for (; j < lines.length; j++) {
          var t2 = lines[j].trim();
          if (new RegExp('^\\{\\{\\s*[#?]\\s*' + key.replace('.', '\\.') + '\\s*\\}\\}$', 'i').test(t2)) dalam++;
          if (new RegExp('^\\{\\{\\s*\\/\\s*' + key.replace('.', '\\.') + '\\s*\\}\\}$', 'i').test(t2)) { if (!dalam) break; dalam--; }
          isi.push(lines[j]);
        }
        if (mb) (data[key] || []).forEach(function (it, idx) { var d2 = Object.assign({}, data); Object.keys(it).forEach(function (k) { d2[key + '.' + k.toUpperCase()] = it[k]; }); d2.NO = idx + 1; Struk.proses(isi, d2, out); });
        else if (!this.kosong(data[key])) this.proses(isi, data, out);
        i = j; continue;
      }
      var dir = {}, m, rest = ln;
      while ((m = rest.match(/^\s*\[(C|R|L|B|2|H|LR|-|=|QR|LOGO|BOX|CUT|FEED)\]/i))) { dir[m[1].toUpperCase()] = true; rest = rest.slice(m[0].length); }
      var adaPenanda = /\{\{/.test(rest), teks = this.isiBaris(rest, data);
      if (dir.QR) { out.push({ qr: teks.trim() || data.URL_VERIFIKASI || '' }); continue; }
      if (dir.LOGO) { out.push({ logo: true }); continue; }
      if (dir.CUT) { out.push({ cut: true }); continue; }
      if (dir.FEED) { out.push({ t: '' }); continue; }
      if (dir['-'] || dir['=']) { out.push({ sep: dir['-'] ? '-' : '=' }); continue; }
      if (adaPenanda && !teks.replace(/\|\|/g, '').trim()) continue;
      out.push({ t: teks, al: dir.C ? 'c' : dir.R ? 'r' : 'l', b: !!dir.B, x2: !!dir['2'], h2: !!dir.H, lr: !!dir.LR, box: !!dir.BOX });
    }
    return out;
  },
  /** Render template → baris siap cetak (sudah dipotong per lebar kolom). */
  render: function (isi, data, kolom, opsi) {
    opsi = opsi || {};
    var raw = this.proses(String(isi || '').split(/\r?\n/), data, []), out = [];
    raw.forEach(function (r) {
      if (r.qr !== undefined) { if (opsi.qr !== false && r.qr) out.push(r); return; }
      if (r.logo) { if (opsi.logo !== false && opsi.logoUrl) out.push(r); return; }
      if (r.cut) { out.push(r); return; }
      if (r.sep) { out.push({ t: new Array(kolom + 1).join(r.sep), al: 'l', sep: true }); return; }
      var w = r.x2 ? Math.floor(kolom / 2) : kolom;
      Struk.bungkus(r, w).forEach(function (t) { out.push(Object.assign({}, r, { t: t, lr: false, al: r.lr ? 'l' : r.al })); });
    });
    return out;
  },
  bungkus: function (r, w) {
    if (r.lr) {
      var p = r.t.split('||'), kiri = (p[0] || '').replace(/\s+$/, ''), kanan = (p.slice(1).join(' ') || '').trim();
      if (kiri.length + kanan.length + 1 <= w) return [kiri + new Array(w - kiri.length - kanan.length + 1).join(' ') + kanan];
      var baris = this.potongKata(kiri, w);
      var akhir = baris[baris.length - 1];
      if (akhir.length + kanan.length + 1 <= w) baris[baris.length - 1] = akhir + new Array(w - akhir.length - kanan.length + 1).join(' ') + kanan;
      else baris.push(new Array(Math.max(0, w - kanan.length) + 1).join(' ') + kanan.slice(0, w));
      return baris;
    }
    return this.potongKata(r.t, w);
  },
  potongKata: function (s, w) {
    s = String(s); if (s.length <= w) return [s];
    var out = [], cur = '';
    s.split(/(\s+)/).forEach(function (kt) {
      if ((cur + kt).length <= w) { cur += kt; return; }
      if (cur.trim()) out.push(cur.replace(/\s+$/, ''));
      cur = kt.replace(/^\s+/, '');
      while (cur.length > w) { out.push(cur.slice(0, w)); cur = cur.slice(w); }
    });
    if (cur.trim()) out.push(cur.replace(/\s+$/, ''));
    return out.length ? out : [''];
  },
  baris: function (o, opsi) {
    opsi = Object.assign(this.pengaturan(), opsi || {});
    var tpl = this.template(this.templatePilihan(opsi)), kolom = Number(tpl.lebar) || (opsi.lebar === 80 ? 48 : 32);
    if (opsi.lebar === 80 && kolom < 40) kolom = 48; if (opsi.lebar === 58 && kolom > 40) kolom = 32;
    var logo = App.gambar('strukLogo') || App.gambar('logo');
    if (opsi.hemat) { opsi.qr = false; }
    var data = this.dataDari(o, opsi);
    return { lines: this.render(tpl.isi, data, kolom, { qr: opsi.qr, logo: opsi.logo, logoUrl: logo }), kolom: kolom, tpl: tpl, opsi: opsi, logo: logo, data: data };
  },
  /* ---------- pratinjau & ekspor ---------- */
  qrDataUrl: function (teks, sel) { try { var q = qrcode(0, 'M'); q.addData(teks); q.make(); return q.createDataURL(sel || 4, 2); } catch (e) { return ''; } },
  html: function (hasil) {
    var self = this;
    return '<div class="paper ' + (hasil.kolom > 40 ? 'w80' : 'w58') + '">' + hasil.lines.map(function (l) {
      if (l.qr !== undefined) return '<div class="qr"><img alt="QR" src="' + self.qrDataUrl(l.qr) + '"></div>';
      if (l.logo) return '<div class="logo"><img alt="" src="' + esc(hasil.logo) + '"></div>';
      if (l.cut) return '<div class="cutline"></div>';
      var cls = 'ln' + (l.al === 'c' ? ' c' : l.al === 'r' ? ' r' : '') + (l.b ? ' b' : '') + (l.x2 ? ' x2' : '') + (l.box ? ' box' + (/BATAL/.test(l.t) ? ' batal' : '') : '');
      return '<span class="' + cls + '">' + (esc(l.t) || '&nbsp;') + '</span>';
    }).join('') + '</div>';
  },
  teks: function (hasil) { return hasil.lines.filter(function (l) { return l.t !== undefined; }).map(function (l) { var w = l.x2 ? Math.floor(hasil.kolom / 2) : hasil.kolom, t = l.t; if (l.al === 'c') t = new Array(Math.max(0, Math.floor((w - t.length) / 2)) + 1).join(' ') + t; else if (l.al === 'r') t = new Array(Math.max(0, w - t.length) + 1).join(' ') + t; return t; }).join('\n'); },
  panjangCm: function (hasil) { var cm = 1.2; hasil.lines.forEach(function (l) { cm += l.qr !== undefined ? 3.2 : l.logo ? 1.6 : l.x2 ? 0.62 : 0.34; }); return Math.round(cm * 10) / 10; },
  /** Cetak lewat dialog print browser (driver printer thermal / aplikasi printer Bluetooth Android). */
  cetakBrowser: function (hasil, salinan) {
    var mm = hasil.kolom > 40 ? 80 : 58, isi = '';
    for (var i = 0; i < Math.max(1, salinan || 1); i++) isi += (i ? '<div style="page-break-before:always"></div>' : '') + this.html(hasil);
    var css = '@page{size:' + mm + 'mm auto;margin:0}html,body{margin:0;padding:0;background:#fff}.paper{width:' + (mm - 6) + 'mm!important;margin:0 auto;padding:3mm 0 6mm!important;font:600 ' + (mm === 80 ? '2.55mm' : '2.6mm') + '/1.35 "Courier New",monospace;color:#000;white-space:pre}' +
      '.ln{display:block}.c{text-align:center}.r{text-align:right}.b{font-weight:900}.x2{font-size:1.5em}.box{background:#000;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:1mm 0}.qr{text-align:center;margin:2mm 0}.qr img{width:26mm;height:26mm;image-rendering:pixelated;display:inline-block}.logo{text-align:center}.logo img{max-width:30mm;max-height:14mm;display:inline-block;filter:grayscale(1)}.cutline{display:none}';
    var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(fr);
    var d = fr.contentDocument; d.open(); d.write('<!doctype html><html><head><meta charset="utf-8"><title>Struk</title><style>' + css + '</style></head><body>' + isi + '</body></html>'); d.close();
    var imgs = d.images, sisa = imgs.length, go = function () { setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.print(); } setTimeout(function () { fr.remove(); }, 4000); }, 120); };
    if (!sisa) go(); else Array.prototype.forEach.call(imgs, function (im) { if (im.complete) { if (!--sisa) go(); } else im.onload = im.onerror = function () { if (!--sisa) go(); }; });
  },
  png: function (hasil) {
    var self = this, cw = 11, lh = 20, pad = 18, w = hasil.kolom * cw + pad * 2;
    return new Promise(function (res) {
      var tinggi = pad * 2, imgs = [];
      hasil.lines.forEach(function (l) { tinggi += l.qr !== undefined ? 170 : l.logo ? 80 : l.cut ? 12 : (l.x2 ? lh * 1.5 : lh); });
      var cv = document.createElement('canvas'); cv.width = w * 2; cv.height = tinggi * 2;
      var cx = cv.getContext('2d'); cx.scale(2, 2); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, tinggi); cx.textBaseline = 'top';
      var y = pad, tugas = [];
      hasil.lines.forEach(function (l) {
        if (l.qr !== undefined) { var yy = y; tugas.push(muat(self.qrDataUrl(l.qr, 5)).then(function (im) { if (im) cx.drawImage(im, (w - 150) / 2, yy + 8, 150, 150); })); y += 170; return; }
        if (l.logo) { var y2 = y; tugas.push(muat(hasil.logo).then(function (im) { if (!im) return; var s = Math.min(160 / im.width, 66 / im.height); cx.drawImage(im, (w - im.width * s) / 2, y2 + 4, im.width * s, im.height * s); })); y += 80; return; }
        if (l.cut) { y += 12; return; }
        var size = l.x2 ? 26 : 17, cww = l.x2 ? cw * 2 : cw;
        cx.font = (l.b ? '700 ' : '500 ') + size + 'px "Courier New", monospace';
        var t = l.t, tw = t.length * cww, x = l.al === 'c' ? (w - tw) / 2 : l.al === 'r' ? w - pad - tw : pad;
        if (l.box) { cx.fillStyle = '#EAF6EE'; cx.fillRect(pad - 4, y - 2, w - pad * 2 + 8, (l.x2 ? lh * 1.5 : lh) + 2); cx.fillStyle = '#1B7340'; } else cx.fillStyle = '#111';
        for (var i = 0; i < t.length; i++) cx.fillText(t[i], x + i * cww, y + 1);
        y += l.x2 ? lh * 1.5 : lh;
      });
      Promise.all(tugas).then(function () { res(cv.toDataURL('image/png')); });
    });
    function muat(src) { return new Promise(function (r) { if (!src) return r(null); var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { r(im); }; im.onerror = function () { r(null); }; im.src = src; }); }
  },
  /* ---------- ESC/POS ---------- */
  ascii: function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[•·]/g, '-').replace(/[–—]/g, '-').replace(/[✓✔]/g, 'v').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x20-\x7E]/g, ''); },
  raster: function (img, maxDots, gelap) {
    var w = Math.min(maxDots, img.width), h = Math.round(img.height * w / img.width), lebarByte = Math.ceil(w / 8);
    var cv = document.createElement('canvas'); cv.width = lebarByte * 8; cv.height = h;
    var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, h); cx.drawImage(img, (cv.width - w) / 2, 0, w, h);
    var px = cx.getImageData(0, 0, cv.width, h).data, data = [0x1D, 0x76, 0x30, 0x00, lebarByte & 255, (lebarByte >> 8) & 255, h & 255, (h >> 8) & 255], ambang = gelap ? 170 : 128;
    for (var y = 0; y < h; y++) for (var xb = 0; xb < lebarByte; xb++) { var b = 0; for (var bit = 0; bit < 8; bit++) { var i = (y * cv.width + xb * 8 + bit) * 4, lum = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11, a = px[i + 3]; if (a > 100 && lum < ambang) b |= (0x80 >> bit); } data.push(b); }
    return data;
  },
  escpos: function (hasil) {
    var self = this, op = hasil.opsi || {}, maxDots = hasil.kolom > 40 ? 512 : 360, bytes = [0x1B, 0x40], enc = new TextEncoder();
    function teks(s) { Array.prototype.push.apply(bytes, Array.from(enc.encode(self.ascii(s)))); }
    function muat(src) { return new Promise(function (r) { if (!src) return r(null); var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { r(im); }; im.onerror = function () { r(null); }; im.src = src; }); }
    var antri = Promise.resolve();
    hasil.lines.forEach(function (l) {
      antri = antri.then(function () {
        if (l.qr !== undefined) return muat(self.qrDataUrl(l.qr, 6)).then(function (im) { if (!im) return; bytes.push(0x1B, 0x61, 1); Array.prototype.push.apply(bytes, self.raster(im, Math.min(maxDots, 220), op.density === 'pekat')); bytes.push(0x0A); });
        if (l.logo) return muat(hasil.logo).then(function (im) { if (!im) return; bytes.push(0x1B, 0x61, 1); Array.prototype.push.apply(bytes, self.raster(im, Math.min(maxDots, 260), op.density === 'pekat')); bytes.push(0x0A); });
        if (l.cut) { if (op.autoCut !== false) bytes.push(0x1B, 0x64, 3, 0x1D, 0x56, 0x42, 0x00); return; }
        bytes.push(0x1B, 0x61, l.al === 'c' ? 1 : l.al === 'r' ? 2 : 0, 0x1B, 0x45, l.b ? 1 : 0, 0x1D, 0x21, l.x2 ? 0x11 : l.h2 ? 0x01 : 0x00, 0x1D, 0x42, l.box ? 1 : 0);
        teks(l.t); bytes.push(0x0A);
      });
    });
    return antri.then(function () {
      bytes.push(0x1D, 0x42, 0, 0x1D, 0x21, 0, 0x1B, 0x45, 0, 0x1B, 0x61, 0);
      if (!hasil.lines.some(function (l) { return l.cut; })) { bytes.push(0x1B, 0x64, 4); if (op.autoCut !== false) bytes.push(0x1D, 0x56, 0x42, 0x00); }
      if (op.beep) bytes.push(0x1B, 0x42, 0x02, 0x02);
      return new Uint8Array(bytes);
    });
  },
  /** Printer thermal Bluetooth langsung dari browser (Chrome Android/desktop, Web Bluetooth). */
  BT: {
    dev: null, ch: null, nama: '',
    LAYANAN: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb'],
    didukung: function () { return !!(navigator.bluetooth && window.isSecureContext); },
    terhubung: function () { return !!(this.ch && this.dev && this.dev.gatt && this.dev.gatt.connected); },
    hubungkan: function () {
      var self = this;
      if (!this.didukung()) return Promise.reject(new Error('Browser ini belum mendukung Web Bluetooth. Gunakan Chrome Android/desktop, atau cetak via aplikasi printer (RawBT) / dialog cetak.'));
      return navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: self.LAYANAN }).then(function (dev) {
        self.dev = dev; self.nama = dev.name || 'Printer Bluetooth';
        dev.addEventListener('gattserverdisconnected', function () { self.ch = null; if (window.Pesanan && Pesanan.segarkanPrinter) Pesanan.segarkanPrinter(); });
        return dev.gatt.connect();
      }).then(function (srv) { return srv.getPrimaryServices(); }).then(function (svcs) {
        return svcs.reduce(function (p, s) { return p.then(function (hit) { return hit || s.getCharacteristics().then(function (cs) { return cs.filter(function (c) { return c.properties.write || c.properties.writeWithoutResponse; })[0] || null; }); }); }, Promise.resolve(null));
      }).then(function (ch) { if (!ch) throw new Error('Karakteristik tulis printer tidak ditemukan.'); self.ch = ch; Store.set('printerBT', self.nama); return self.nama; });
    },
    kirim: function (bytes) {
      var self = this; if (!this.ch) return Promise.reject(new Error('Printer belum terhubung.'));
      var ukuran = 180, chunks = [];
      for (var i = 0; i < bytes.length; i += ukuran) chunks.push(bytes.slice(i, i + ukuran));
      return chunks.reduce(function (p, c) { return p.then(function () { return self.ch.writeValueWithoutResponse ? self.ch.writeValueWithoutResponse(c) : self.ch.writeValue(c); }).then(function () { return new Promise(function (r) { setTimeout(r, 18); }); }); }, Promise.resolve());
    }
  },
  /** Aplikasi RawBT (Android): kirim ESC/POS lewat intent tanpa Web Bluetooth. */
  rawbt: function (bytes) {
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    location.href = 'intent:base64,' + btoa(s) + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;';
  },
  /* ---------- teks WhatsApp (nota digital) ---------- */
  waTeks: function (o, format, opsi) {
    opsi = opsi || {}; var cfg = AppState.cfg || {}, garis = '--------------------------------', d = this.dataDari(o, {});
    var link = o.kode ? this.urlVerif(o) : '';
    if (format === 'link') return '🧾 *' + String(cfg.tokoNama || 'Via Seafood').toUpperCase() + '*\nNota *' + o.id + '* • Total *' + rp(o.total) + '*\n' + (link ? 'Lihat & verifikasi struk digital:\n' + link : '');
    var t = '🧾 *' + String(cfg.tokoNama || 'Via Seafood').toUpperCase() + ' - NOTA DIGITAL*\n' + (cfg.tokoAlamat ? '_' + cfg.tokoAlamat + '_\n' : '') + garis + '\n';
    t += '*No. Nota:* ' + o.id + '\n*Tanggal:* ' + tglSingkat(o.tanggal) + ', ' + (o.waktu || '') + ' WIB\n*Kasir:* ' + (o.petugas || '') + '\n*Pelanggan:* ' + (o.pelanggan || '') + '\n';
    if (format !== 'ringkas' && opsi.rincian !== false) {
      t += '\n' + garis + '\n🐟 *RINCIAN TIMBANGAN:*\n';
      (o.items || []).forEach(function (i) { t += '• ' + i.nama + (i.grade ? ' (' + i.grade + ')' : '') + '\n   ' + angka(i.qty) + ' ' + i.satuan + ' × ' + rp(i.harga) + ' = *' + rp(i.sub) + '*\n'; });
    } else t += '*Item:* ' + (o.items || []).map(function (i) { return i.nama + ' ' + angka(i.qty) + i.satuan; }).join(', ') + '\n';
    t += garis + '\n';
    if (o.diskon) t += 'Diskon: -' + rp(o.diskon) + '\n';
    if (o.pajak) t += (cfg.pajakLabel || 'Pajak') + ': ' + rp(o.pajak) + '\n';
    t += '*TOTAL:* *' + rp(o.total) + '*\n';
    if (d.TEMPO) t += '*SISA TAGIHAN:* ' + rp(d.SISA) + '\n*JATUH TEMPO:* ' + d.JATUH_TEMPO + '\n'; else t += '*METODE:* ' + (o.metode || 'Tunai') + ' (' + (o.status === 'Batal' ? 'DIBATALKAN' : 'LUNAS') + ')\n';
    if (link && opsi.link !== false) t += garis + '\n🔗 *Link Unduh Struk Digital:*\n' + link + '\n';
    t += '\n_Terima kasih telah berbelanja hasil laut segar di ' + (cfg.tokoNama || 'Via Seafood') + '! Timbangan terkalibrasi resmi dermaga._';
    return t;
  },
  waHtml: function (t) { return esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>').replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
};
