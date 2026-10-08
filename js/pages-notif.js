/* ==========================================================================
   VIA SEAFOOD — pages-notif.js  (khusus Owner)
   WhatsApp (Fonnte) & Email: konfigurasi + saklar kanal, matriks notifikasi
   (teks bisa diubah), antrean & log pengiriman, blast per batch 10/20/50,
   CRM kontak (segmen, status WA, tag, opt-out, interaksi, duplikat, impor).
   ========================================================================== */
'use strict';
var Notif = {
  tab: 'gateway', cfg: null,
  TABS: [{ id: 'gateway', label: 'Gateway & Kanal', ikon: 'radio-tower' }, { id: 'matriks', label: 'Matriks Notifikasi', ikon: 'bell-ring' }, { id: 'blast', label: 'Blast WhatsApp', ikon: 'megaphone' }, { id: 'crm', label: 'Kontak CRM', ikon: 'contact-round' }, { id: 'antrean', label: 'Antrean & Log', ikon: 'list-checks' }],
  template: function () {
    return '<div class="page-head"><div><div class="eyebrow">Komunikasi Pelanggan <span class="dot"></span><span class="loc">WhatsApp Fonnte & Email</span></div><h1 class="page-title">WhatsApp &amp; CRM</h1><p class="page-sub">Notifikasi otomatis, pengingat piutang, blast promo & buku kontak pelanggan</p></div><div class="page-actions" id="ntPill"></div></div>' +
      '<div class="card">' + tabsHtml(this.TABS, this.tab) + '</div><div id="ntHost"></div>';
  },
  init: function (el) { var self = this; pasangTabs(el.querySelector('.tabs'), function (t) { self.buka(el, t); history.replaceState(null, '', '#/notifikasi/' + t); }); },
  show: function (el, p) { this.buka(el, this.TABS.some(function (t) { return t.id === p; }) ? p : this.tab); this.pill(el); },
  pill: function (el) {
    var self = this;
    this.muatCfg().then(function (c) { el.querySelector('#ntPill').innerHTML = '<span class="badge ' + (c.waAktif && c.adaToken ? 'b-lunas' : 'b-sebagian') + '">' + ic('message-circle', 'sm') + 'WhatsApp ' + (c.waAktif && c.adaToken ? 'aktif' : 'mati') + '</span><span class="badge ' + (c.emailAktif ? 'b-lunas' : 'b-sebagian') + '">' + ic('mail', 'sm') + 'Email ' + (c.emailAktif ? 'aktif' : 'mati') + '</span>'; }, function () { });
  },
  buka: function (el, t) {
    this.tab = t;
    el.querySelectorAll('.tabs [data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    var host = el.querySelector('#ntHost'), box = host.querySelector('[data-panel="' + t + '"]');
    Array.prototype.forEach.call(host.children, function (c) { c.hidden = c.dataset.panel !== t; });
    if (!box) { box = document.createElement('div'); box.dataset.panel = t; host.appendChild(box); this['p_' + t](box); }
    else if (this['r_' + t]) this['r_' + t](box);
  },
  muatCfg: function (paksa) {
    var self = this; if (this.cfg && !paksa) return Promise.resolve(this.cfg);
    return api('notif.config', {}).then(function (r) { if (!r.success) throw r; self.cfg = r.data; return r.data; });
  },
  simpanCfg: function (data, btn, ok) {
    var self = this; setBusy(btn, true, 'Menyimpan…');
    return api('notif.configSave', data).then(function (r) { setBusy(btn, false); if (!toastRes(r, ok || 'Konfigurasi tersimpan')) return null; self.cfg = r.data; App.segarkanBoot(true); var c = halamanAktif(); if (c && c.name === 'notifikasi') self.pill(c.el); return r.data; });
  },

  /* ---------- gateway & kanal ---------- */
  p_gateway: function (box) {
    var self = this; box.innerHTML = '<div class="skel mt" style="height:300px"></div>';
    this.muatCfg(true).then(function (c) { self.renderGateway(box, c); }, function (r) { box.innerHTML = '<div class="card mt">' + retryBox(r) + '</div>'; box.querySelector('[data-act]').onclick = function () { self.p_gateway(box); }; });
  },
  renderGateway: function (box, c) {
    var self = this;
    box.innerHTML = '<div class="set-grid"><div>' +
      '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm paid">' + ic('message-circle') + '</span><div><div class="t">WhatsApp — Gateway Fonnte</div><div class="muted" style="font-size:12.5px">Daftar di fonnte.com, hubungkan nomor WA usaha, salin token perangkat.</div></div><span class="r"><label class="switch"><input type="checkbox" id="gwWa"' + (c.waAktif ? ' checked' : '') + '><span></span></label></span></div><div class="sec-body">' +
      fld('Token perangkat Fonnte', '<div class="row gap-s"><input class="input grow" id="gwTok" placeholder="' + (c.adaToken ? 'Tersimpan: ' + esc(c.token) + ' — isi untuk mengganti' : 'Tempel token dari dashboard Fonnte') + '" autocomplete="off">' + (c.adaToken ? '<button class="btn btn-ghost btn-sm" id="gwTokHapus">' + ic('trash-2', 'sm') + 'Hapus</button>' : '') + '</div>', { hint: 'Token disimpan di Script Properties (server), tidak pernah dikirim ke browser.' }) +
      '<div class="grid-2 mt">' + fld('Ukuran batch blast', '<select class="select" id="gwBatch">' + selectOpts([10, 20, 50].map(function (n) { return { v: n, l: n + ' pesan / batch' }; }), c.batchDefault) + '</select>') + fld('Jeda antarpesan (detik)', '<input class="input" id="gwJeda" value="' + esc(c.jeda) + '" placeholder="5 atau 3-8">', { hint: 'Rentang acak (mis. 3-8) lebih aman dari blokir' }) + '</div>' +
      '<div class="sec-toggle mt"><div><div class="t">Deteksi otomatis nomor WhatsApp</div><div class="d">Kontak baru dicek apakah nomornya terdaftar WA (butuh paket Fonnte yang mendukung).</div></div><label class="switch"><input type="checkbox" id="gwDet"' + (c.deteksiOtomatis ? ' checked' : '') + '><span></span></label></div>' +
      '<div class="gw-card mt ' + (c.waAktif && c.adaToken ? '' : 'off') + '" id="gwDev"><span class="live-dot' + (c.waAktif && c.adaToken ? '' : ' amber') + '"></span><div class="grow"><b>' + (c.adaToken ? 'Memeriksa perangkat…' : 'Token belum diisi') + '</b><div class="muted" style="font-size:12.5px">' + (c.adaToken ? '' : 'Isi token lalu simpan, kemudian nyalakan saklar WhatsApp.') + '</div></div>' + ic('radio-tower') + '</div>' +
      '<div class="row gap-s mt" style="flex-wrap:wrap"><div class="affix" style="max-width:240px"><span class="ad">+62</span><input id="gwTesNo" inputmode="tel" placeholder="nomor tes" value="' + esc(hp08(c.ownerWa || (AppState.user || {}).wa || '').replace(/^0/, '')) + '"></div><button class="btn btn-outline" id="gwTes">' + ic('send-horizontal', 'sm') + 'Kirim Tes WA</button></div></div></div>' +
      '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic('mail') + '</span><div><div class="t">Email (Gmail akun pemilik script)</div><div class="muted" style="font-size:12.5px">Kuota tersisa hari ini: <b>' + angka(c.kuotaEmail) + '</b> email</div></div><span class="r"><label class="switch"><input type="checkbox" id="gwEm"' + (c.emailAktif ? ' checked' : '') + '><span></span></label></span></div><div class="sec-body"><div class="grid-2">' +
      fld('Nama pengirim', '<input class="input" id="gwNama" value="' + esc(c.namaPengirim) + '">') + fld('Kirim email tes ke', '<div class="row gap-s"><input class="input grow" id="gwTesEm" type="email" value="' + esc(c.ownerEmail || (AppState.user || {}).email || '') + '"><button class="btn btn-outline" id="gwTesE">' + ic('send-horizontal', 'sm') + 'Tes</button></div>') + '</div></div></div>' +
      '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm amber">' + ic('star') + '</span><div class="t">Penerima Laporan Owner &amp; Jadwal</div></div><div class="sec-body"><div class="grid-2">' +
      fld('WhatsApp Owner', '<div class="affix"><span class="ad">+62</span><input id="gwOwWa" inputmode="tel" value="' + esc(hp08(c.ownerWa).replace(/^0/, '')) + '" placeholder="kosong = dari akun Owner"></div>', { hint: 'Stok menipis, keamanan, ringkasan harian' }) +
      fld('Email Owner', '<input class="input" id="gwOwEm" type="email" value="' + esc(c.ownerEmail) + '" placeholder="kosong = dari akun Owner">') +
      fld('Pengingat jatuh tempo (H-x)', '<input class="input" id="gwPgH" value="' + esc(c.pengingatHari) + '">', { hint: '"1,0" = sehari sebelum & pada hari H' }) +
      fld('Ulangi bila lewat tempo tiap', '<div class="affix"><input id="gwPgU" inputmode="numeric" value="' + esc(c.pengingatUlang) + '"><span class="ad r">hari</span></div>', { hint: '0 = tidak diulang' }) +
      fld('Jam tutup buku (ringkasan harian)', '<div class="affix"><input id="gwJam" inputmode="numeric" value="' + esc(c.jamTutup) + '"><span class="ad r">:00 WIB</span></div>') +
      fld('URL aplikasi (untuk tautan di pesan)', '<input class="input" id="gwUrl" value="' + esc(c.appUrl) + '">') + '</div></div></div>' +
      '<div class="save-bar"><button class="btn btn-primary btn-lg" id="gwOk">' + ic('save', 'sm') + 'Simpan Konfigurasi</button></div></div>' +
      '<div><div class="card card-pad"><h3 class="card-title">Cara kerja pengiriman</h3><ol style="padding-left:18px;font-size:13px;color:var(--ink-2);display:grid;gap:8px;margin:12px 0 0"><li>Setiap kejadian (pesanan tempo, pembayaran, stok menipis…) hanya <b>menulis antrean</b> — kasir tidak menunggu.</li><li>Pekerja latar tiap <b>1 menit</b> mengirim antrean lewat Fonnte / Gmail, dengan jeda acak.</li><li>Gagal karena jaringan dicoba ulang otomatis; nomor bukan WA ditandai di CRM.</li><li>Kanal & teks setiap kejadian diatur di <b>Matriks Notifikasi</b>.</li></ol>' +
      '<div class="note-' + (c.trigger ? 'teal' : 'coral') + ' mt">' + ic(c.trigger ? 'circle-check' : 'triangle-alert', 'sm') + '<span>' + (c.trigger ? 'Pekerja latar (trigger tiap menit) <b>aktif</b>.' : 'Trigger belum terpasang — jalankan <code>setupAppEnvironment</code> di editor Apps Script.') + '</span></div></div></div></div>';
    if (c.adaToken) api('wa.device', {}).then(function (r) {
      var g = box.querySelector('#gwDev'); if (!g) return;
      var on = r.success && /connect/i.test(r.data.status);
      g.className = 'gw-card mt ' + (on ? '' : 'off');
      g.innerHTML = '<span class="live-dot' + (on ? '' : ' amber') + '"></span><div class="grow"><b style="color:' + (on ? 'var(--paid)' : 'var(--amber-700)') + '">' + (r.success ? (on ? 'Perangkat terhubung' : 'Perangkat ' + esc(r.data.status || 'terputus')) + ' • ' + esc(r.data.device) : 'Tidak bisa membaca perangkat') + '</b><div class="muted" style="font-size:12.5px">' + (r.success ? 'Paket ' + esc(r.data.paket || '-') + ' • kuota ' + esc(r.data.kuota || '-') + (r.data.kedaluwarsa ? ' • aktif s/d ' + esc(r.data.kedaluwarsa) : '') : esc(r.message)) + '</div></div>' + ic('radio-tower');
    });
    var hapus = box.querySelector('#gwTokHapus'); if (hapus) hapus.onclick = function () { konfirmasi('Hapus token Fonnte?', 'WhatsApp otomatis tidak bisa dipakai sampai token diisi lagi.', { bahaya: true, ok: 'Hapus Token' }).then(function (ok) { if (ok) self.simpanCfg({ token: '__HAPUS__', waAktif: false }, hapus).then(function (c2) { if (c2) self.renderGateway(box, c2); }); }); };
    box.querySelector('#gwTes').onclick = function () { var b = this, n = hp08('0' + box.querySelector('#gwTesNo').value.replace(/^0+/, '')); setBusy(b, true); api('wa.test', { nomor: n }).then(function (r) { setBusy(b, false); toastRes(r, 'Tes terkirim'); }); };
    box.querySelector('#gwTesE').onclick = function () { var b = this; setBusy(b, true); api('email.test', { email: box.querySelector('#gwTesEm').value.trim() }).then(function (r) { setBusy(b, false); toastRes(r, 'Email tes terkirim'); }); };
    box.querySelector('#gwOk').onclick = function () {
      var v = function (id) { return box.querySelector(id).value.trim(); };
      var d = { waAktif: box.querySelector('#gwWa').checked, emailAktif: box.querySelector('#gwEm').checked, batchDefault: +v('#gwBatch'), jeda: v('#gwJeda'), deteksiOtomatis: box.querySelector('#gwDet').checked, namaPengirim: v('#gwNama'),
        ownerWa: v('#gwOwWa') ? hp08('0' + v('#gwOwWa').replace(/^0+/, '')) : '', ownerEmail: v('#gwOwEm'), pengingatHari: v('#gwPgH'), pengingatUlang: v('#gwPgU'), jamTutup: v('#gwJam'), appUrl: v('#gwUrl') };
      if (v('#gwTok')) d.token = v('#gwTok');
      self.simpanCfg(d, this).then(function (c2) { if (c2) self.renderGateway(box, c2); });
    };
  },

  /* ---------- matriks notifikasi ---------- */
  p_matriks: function (box) {
    var self = this; box.innerHTML = '<div class="skel mt" style="height:300px"></div>';
    this.muatCfg(true).then(function (c) { self.renderMatriks(box, c); }, function (r) { box.innerHTML = '<div class="card mt">' + retryBox(r) + '</div>'; });
  },
  renderMatriks: function (box, c) {
    var self = this, m = c.matriks.map(function (x) { return Object.assign({}, x); });
    box.innerHTML = (!c.waAktif || !c.emailAktif ? '<div class="note-amber mt">' + ic('info', 'sm') + '<span>Saklar utama: WhatsApp <b>' + (c.waAktif ? 'aktif' : 'mati') + '</b>, Email <b>' + (c.emailAktif ? 'aktif' : 'mati') + '</b>. Kanal yang mati tidak mengirim walau dicentang di bawah.</span></div>' : '') +
      '<div class="card" style="margin-top:var(--gut);overflow:hidden"><div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>Kejadian</th><th class="hide-m">Penerima</th><th class="c">WhatsApp</th><th class="c">Email</th><th class="r">Teks</th></tr></thead><tbody>' + m.map(function (x, i) {
        var ubah = x.pesan !== x.pesanDefault || x.subjek !== x.subjekDefault;
        return '<tr><td class="full-m"><b>' + esc(x.label) + '</b><div class="sub mono">' + esc(x.kode) + (ubah ? ' • <span class="text-amber">teks diubah</span>' : '') + '</div></td><td class="hide-m"><span class="cat-badge ' + (x.target === 'Owner' ? 'amber' : x.target === 'Staff' ? 'ink' : '') + '">' + esc(x.target) + '</span></td>' +
          '<td class="c"><label class="switch"><input type="checkbox" data-i="' + i + '" data-k="wa"' + (x.wa ? ' checked' : '') + '><span></span></label></td><td class="c"><label class="switch"><input type="checkbox" data-i="' + i + '" data-k="email"' + (x.email ? ' checked' : '') + '><span></span></label></td>' +
          '<td class="r"><button class="btn btn-ghost btn-sm" data-ed="' + i + '">' + ic('pencil', 'sm') + 'Ubah teks</button></td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="save-bar"><span class="muted grow" style="font-size:12.5px">Variabel umum: {nama} {toko} {link}. Teks WhatsApp mendukung *tebal* dan _miring_.</span><button class="btn btn-primary btn-lg" id="mxOk">' + ic('save', 'sm') + 'Simpan Matriks</button></div>';
    box.addEventListener('change', function (e) { var i = e.target.dataset.i; if (i != null && e.target.dataset.k) m[+i][e.target.dataset.k] = e.target.checked; });
    box.querySelectorAll('[data-ed]').forEach(function (b) { b.onclick = function () { self.editTeks(m[+b.dataset.ed], function () { self.renderMatriks(box, Object.assign({}, c, { matriks: m })); }); }; });
    box.querySelector('#mxOk').onclick = function () { self.simpanCfg({ matriks: m }, this, 'Matriks tersimpan').then(function (c2) { if (c2) self.renderMatriks(box, c2); }); };
  },
  editTeks: function (x, cb) {
    var vars = (x.pesanDefault.match(/\{\w+\}/g) || []).concat(['{nama}', '{toko}', '{link}']).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var md = modal({ judul: 'Teks: ' + esc(x.label), ikon: 'message-square-text', lebar: 'wide',
      isi: '<div class="split"><div>' + fld('Subjek email', '<input class="input" id="etSub" value="' + esc(x.subjek) + '">') + fld('Isi pesan (WhatsApp & email)', '<textarea class="textarea mono" id="etPes" style="min-height:240px">' + esc(x.pesan) + '</textarea>', { cls: 'mt' }) +
        '<div class="label-up mt">Variabel (klik untuk sisipkan)</div><div class="row gap-s mt-s" style="flex-wrap:wrap" id="etVar">' + vars.map(function (v) { return '<button type="button" class="chip chip-s mono" data-v="' + v + '">' + v + '</button>'; }).join('') + '</div></div>' +
        '<div><div class="label-up mb-s">Pratinjau WhatsApp</div><div class="wa-right" style="border-radius:14px;padding:16px;min-height:200px"><div class="wa-bubble" id="etPrev"></div></div></div></div>',
      foot: '<button class="btn btn-ghost" id="etReset">' + ic('rotate-ccw', 'sm') + 'Kembalikan bawaan</button><span class="grow"></span><button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="etOk">Pakai Teks</button>' });
    var contoh = { nama: 'Restoran Nelayan Rasa', toko: (AppState.cfg || {}).tokoNama || 'Via Seafood', link: 'https://…/#/v/ORD-…', nota: 'ORD-261007-0012', total: 'Rp 1.187.500', sisa: 'Rp 687.500', jumlah: 'Rp 500.000', jatuhTempo: '14 Oktober 2026', tanggal: '7 Oktober 2026', keterangan: 'jatuh tempo 1 hari lagi', rekening: 'BCA 123456789 a.n. Via Seafood', rincian: '• Kakap Merah 12,5 kg', status: 'Lunas Sebagian', produk: 'Cumi Sero (sisa 6 kg)', omzet: 'Rp 18.450.000', berat: '214,5', lunas: 'Rp 12.100.000', tempo: 'Rp 6.350.000', kasMasuk: 'Rp 13.000.000', kasKeluar: 'Rp 850.000', piutangTempo: '2 nota', terlaris: 'Kakap Merah', isi: 'Isi struk…', sandi: '483920', email: 'kasir@contoh.id', role: 'Staff', penugasan: 'Kasir', waktu: '07/10 09:12', terminal: 'Tablet Kasir 04' };
    var prev = function () { md.$('#etPrev').innerHTML = Struk.waHtml(md.$('#etPes').value.replace(/\{(\w+)\}/g, function (a, k) { return contoh[k] != null ? contoh[k] : a; })); };
    md.$('#etPes').oninput = prev; prev();
    md.$('#etVar').onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; var t = md.$('#etPes'), s = t.selectionStart; t.value = t.value.slice(0, s) + b.dataset.v + t.value.slice(t.selectionEnd); t.focus(); t.selectionStart = t.selectionEnd = s + b.dataset.v.length; prev(); };
    md.$('#etReset').onclick = function () { md.$('#etSub').value = x.subjekDefault; md.$('#etPes').value = x.pesanDefault; prev(); };
    md.$('#etOk').onclick = function () { x.subjek = md.$('#etSub').value; x.pesan = md.$('#etPes').value; md.close(); toast('Teks diperbarui', 'Klik "Simpan Matriks" untuk menyimpan.'); cb(); };
  },

  /* ---------- antrean & log ---------- */
  aSt: { status: '', kanal: '' },
  p_antrean: function (box) {
    var self = this;
    box.innerHTML = '<div class="card mt"><div class="filter-bar"><div class="row gap-s" id="aqStat" style="flex-wrap:wrap"></div><span class="grow"></span><label class="filter-pill"><select id="aqKanal"><option value="">Semua kanal</option><option value="WA">WhatsApp</option><option value="EMAIL">Email</option></select></label>' +
      '<button class="btn btn-outline btn-sm" id="aqRetry">' + ic('rotate-ccw', 'sm') + 'Ulangi yang gagal</button><button class="btn btn-primary btn-sm" id="aqNow">' + ic('send-horizontal', 'sm') + 'Proses sekarang</button></div></div>' +
      '<div class="card" style="margin-top:var(--gut);overflow:hidden"><div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>Waktu</th><th>Penerima</th><th class="hide-m">Kejadian</th><th class="hide-m">Pesan</th><th class="c">Status</th></tr></thead><tbody id="aqBody">' + skeletonRows(6, 5) + '</tbody></table></div></div>';
    box.querySelector('#aqStat').onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; self.aSt.status = b.dataset.v; self.r_antrean(box); };
    box.querySelector('#aqKanal').onchange = function (e) { self.aSt.kanal = e.target.value; self.r_antrean(box); };
    box.querySelector('#aqRetry').onclick = function () { var b = this; setBusy(b, true); api('notif.retry', {}).then(function (r) { setBusy(b, false); if (toastRes(r)) self.r_antrean(box); }); };
    box.querySelector('#aqNow').onclick = function () { var b = this; setBusy(b, true, 'Mengirim…'); api('notif.processNow', {}, { timeout: 330000 }).then(function (r) { setBusy(b, false); toastRes(r, 'Antrean diproses'); self.r_antrean(box); }); };
    this.r_antrean(box);
  },
  r_antrean: function (box) {
    var st = this.aSt;
    api('notif.queue', { status: st.status, kanal: st.kanal }).then(function (r) {
      var body = box.querySelector('#aqBody'); if (!body) return;
      if (!r.success) { body.innerHTML = '<tr><td colspan="5">' + retryBox(r) + '</td></tr>'; return; }
      var s = r.data.stat;
      box.querySelector('#aqStat').innerHTML = chipSel([{ v: '', l: 'Semua' }, { v: 'Antri', l: 'Antri', n: s.Antri || 0 }, { v: 'Terkirim', l: 'Terkirim', n: s.Terkirim || 0 }, { v: 'Gagal', l: 'Gagal', n: s.Gagal || 0 }, { v: 'Batal', l: 'Batal', n: s.Batal || 0 }], st.status);
      body.innerHTML = r.data.rows.length ? r.data.rows.map(function (x) {
        var b = x.status === 'Terkirim' ? 'b-lunas' : x.status === 'Gagal' ? 'b-hutang' : x.status === 'Batal' ? 'b-batal' : 'b-sebagian';
        return '<tr><td class="nowrap muted">' + esc(waktuRelatif(x.dikirim || x.dibuat)) + '</td><td class="full-m"><div class="row gap-s">' + ic(x.kanal === 'WA' ? 'message-circle' : 'mail', 'sm') + '<div><b>' + esc(x.nama || '-') + '</b><div class="sub">' + esc(x.tujuan) + '</div></div></div></td><td class="hide-m"><span class="cat-badge">' + esc(x.event) + '</span></td>' +
          '<td class="hide-m" style="max-width:340px"><div class="sub" style="white-space:normal">' + esc(x.pesan) + '</div></td><td class="c"><span class="badge ' + b + '">' + esc(x.status) + '</span>' + (x.respon && x.status !== 'Terkirim' ? '<div class="sub" style="max-width:160px;white-space:normal">' + esc(x.respon) + '</div>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="5">' + emptyState('inbox', 'Antrean kosong', 'Pesan otomatis & blast akan tercatat di sini.') + '</td></tr>';
    });
  },

  /* ---------- blast ---------- */
  p_blast: function (box) {
    var self = this;
    box.innerHTML = '<div class="split" style="margin-top:var(--gut);align-items:start"><div class="card sec-card" style="margin-top:0"><div class="sec-head"><span class="ic-box sm paid">' + ic('megaphone') + '</span><div><div class="t">Buat Blast Baru</div><div class="muted" style="font-size:12.5px">Promo hasil tangkapan, info libur, pengumuman harga</div></div></div><div class="sec-body">' +
      '<div class="label-up mb-s">1. Penerima</div><div class="seg" id="blSrc" style="width:100%"><button class="on" data-v="crm" style="flex:1">Dari Kontak CRM</button><button data-v="manual" style="flex:1">Daftar manual</button></div>' +
      '<div id="blCrm" class="grid-2 mt"><label class="filter-pill">Segmen <select id="blSeg"><option value="">Semua</option></select></label><label class="filter-pill">Tag <select id="blTag"><option value="">Semua</option></select></label>' +
      '<label class="check"><input type="checkbox" id="blLgn"> Pelanggan langganan saja</label><label class="check"><input type="checkbox" id="blPiu"> Hanya yang punya piutang</label></div>' +
      '<div id="blMan" class="mt" hidden><textarea class="textarea mono" id="blList" style="min-height:120px" placeholder="0812xxxx|Nama Pelanggan\n0813xxxx|Nama Lain"></textarea><div class="hint">Satu nomor per baris, format: nomor|nama</div></div>' +
      '<div class="row gap-s mt"><button class="btn btn-outline btn-sm" id="blCek">' + ic('users-round', 'sm') + 'Hitung penerima</button><button class="btn btn-ghost btn-sm" id="blVal" hidden>' + ic('badge-check', 'sm') + 'Cek nomor WA</button><span class="muted" id="blRing" style="font-size:12.5px"></span></div>' +
      '<div class="label-up mt-l mb-s">2. Pesan</div>' + fld('Judul blast (internal)', '<input class="input" id="blJudul" maxlength="80" placeholder="Promo Kakap Segar Akhir Pekan">') +
      fld('Isi pesan', '<textarea class="textarea" id="blPesan" style="min-height:150px" placeholder="Halo {nama} 👋\n*Kakap merah segar* baru mendarat pagi ini…">Halo {nama} 👋\n</textarea>', { cls: 'mt', hint: 'Variabel: {nama} {toko} {link} {tipe} {alamat}. Gunakan *tebal* & _miring_.' }) +
      '<div class="grid-2 mt">' + fld('Ukuran batch', '<select class="select" id="blBatch">' + selectOpts([10, 20, 50].map(function (n) { return { v: n, l: n + ' / batch' }; }), (this.cfg && this.cfg.batchDefault) || 20) + '</select>') + fld('Jeda (detik)', '<input class="input" id="blJeda" value="' + esc((this.cfg && this.cfg.jeda) || '5') + '">') + '</div>' +
      '<div class="note-amber mt">' + ic('triangle-alert', 'sm') + '<span>Kirim hanya ke pelanggan yang mengenal usaha Anda. Nomor opt-out & ganda dibuang otomatis. Jeda acak mengurangi risiko nomor diblokir WhatsApp.</span></div>' +
      '<button class="btn btn-wa btn-lg btn-block mt" id="blBuat">' + ic('send-horizontal', 'sm') + 'Buat &amp; Mulai Blast</button></div></div>' +
      '<div><div class="card card-pad"><div class="label-up mb-s">Pratinjau</div><div class="wa-right" style="border-radius:14px;padding:16px"><div class="wa-bubble" id="blPrev"></div></div></div>' +
      '<div class="card" style="margin-top:var(--gut);overflow:hidden"><div class="card-head"><h3 class="card-title">Riwayat Blast</h3><button class="btn btn-ghost btn-sm" id="blMuat">' + ic('refresh-cw', 'sm') + '</button></div><div id="blRiwayat" style="padding:0 18px 18px"></div></div></div></div>';
    var src = 'crm', aud = null;
    var prev = function () { var c = (AppState.cfg || {}); box.querySelector('#blPrev').innerHTML = Struk.waHtml(box.querySelector('#blPesan').value.replace(/\{nama\}/g, 'Restoran Nelayan Rasa').replace(/\{toko\}/g, c.tokoNama || 'Via Seafood').replace(/\{link\}/g, c.appUrl || 'https://…').replace(/\{tipe\}/g, 'Restoran').replace(/\{alamat\}/g, 'Jl. Pluit')); };
    box.querySelector('#blPesan').oninput = prev; prev();
    box.querySelector('#blSrc').onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; src = b.dataset.v; aud = null; box.querySelectorAll('#blSrc button').forEach(function (x) { x.classList.toggle('on', x === b); }); box.querySelector('#blCrm').hidden = src !== 'crm'; box.querySelector('#blMan').hidden = src !== 'manual'; box.querySelector('#blRing').textContent = ''; };
    api('crm.stats', {}).then(function (r) { if (!r.success) return; box.querySelector('#blSeg').innerHTML = '<option value="">Semua segmen</option>' + Object.keys(r.data.segmen).map(function (s) { return '<option>' + esc(s) + '</option>'; }).join(''); });
    api('crm.list', { per: 1 }).then(function (r) { if (!r.success) return; box.querySelector('#blTag').innerHTML = '<option value="">Semua tag</option>' + Object.keys(r.data.facet.tag).map(function (s) { return '<option>' + esc(s) + '</option>'; }).join(''); });
    var hitung = function () {
      var d = { sumber: src, segmen: box.querySelector('#blSeg').value, tag: box.querySelector('#blTag').value, langganan: box.querySelector('#blLgn').checked, piutang: box.querySelector('#blPiu').checked, manual: box.querySelector('#blList').value };
      return api('wa.audience', d).then(function (r) {
        if (!r.success) { toast('Gagal', r.message, 'err'); return null; }
        aud = r.data; var g = r.data.ringkas;
        box.querySelector('#blRing').innerHTML = '<b>' + g.valid + '</b> siap dikirim • ' + g.tidakValid + ' tidak valid • ' + g.ganda + ' ganda' + (g.optOut ? ' • ' + g.optOut + ' opt-out' : '') + (g.tidakTerdaftarWA ? ' • ' + g.tidakTerdaftarWA + ' bukan WA' : '');
        box.querySelector('#blVal').hidden = !(Notif.cfg && Notif.cfg.waAktif);
        return aud;
      });
    };
    box.querySelector('#blCek').onclick = function () { var b = this; setBusy(b, true); hitung().then(function () { setBusy(b, false); }); };
    box.querySelector('#blVal').onclick = function () {
      if (!aud) return; var b = this, nomor = aud.rows.filter(function (x) { return x.valid && !x.ganda && !x.statusWA; }).map(function (x) { return x.hp; });
      if (!nomor.length) return toast('Semua nomor sudah dicek', '', 'warn');
      setBusy(b, true, 'Mengecek…'); var i = 0;
      var jalan = function () { var pot = nomor.slice(i, i + 50); if (!pot.length) { setBusy(b, false); toast('Pengecekan selesai', nomor.length + ' nomor'); return hitung(); } api('wa.validate', { nomor: pot }).then(function (r) { if (!r.success) { setBusy(b, false); return toast('Cek nomor tidak tersedia', r.message, 'warn'); } i += 50; jalan(); }); };
      jalan();
    };
    box.querySelector('#blBuat').onclick = function () {
      var b = this, pesan = box.querySelector('#blPesan').value.trim();
      if (pesan.length < 5) return toast('Isi pesan dulu', '', 'warn');
      (aud ? Promise.resolve(aud) : hitung()).then(function (a) {
        if (!a) return;
        var penerima = a.rows.filter(function (x) { return x.valid && !x.ganda && !x.optOut && x.statusWA !== 'Tidak Terdaftar'; }).map(function (x) { return { hp: x.hp, nama: x.nama, vars: x.vars }; });
        if (!penerima.length) return toast('Tidak ada penerima valid', '', 'warn');
        konfirmasi('Kirim blast ke ' + penerima.length + ' nomor?', 'Dikirim bertahap ' + box.querySelector('#blBatch').value + ' pesan per batch dengan jeda ' + esc(box.querySelector('#blJeda').value) + ' detik. Blast tetap berjalan di latar walau halaman ditutup.', { ok: 'Mulai Blast', ikon: 'megaphone' }).then(function (ok) {
          if (!ok) return; setBusy(b, true, 'Membuat…');
          api('wa.blastCreate', { judul: box.querySelector('#blJudul').value.trim(), pesan: pesan, ukuranBatch: +box.querySelector('#blBatch').value, jeda: box.querySelector('#blJeda').value.trim(), penerima: penerima, sasaran: src === 'crm' ? [box.querySelector('#blSeg').value || 'Semua', box.querySelector('#blTag').value].filter(Boolean).join(' • ') : 'Manual' }).then(function (r) {
            setBusy(b, false); if (!toastRes(r)) return; aud = null; self.r_blast(box); self.jalankanBlast(box, r.data.blastId);
          });
        });
      });
    };
    box.querySelector('#blMuat').onclick = function () { self.r_blast(box); };
    box.querySelector('#blRiwayat').addEventListener('click', function (e) {
      var p = e.target.closest('[data-proses]'), s = e.target.closest('[data-stop]');
      if (p) self.jalankanBlast(box, p.dataset.proses);
      if (s) konfirmasi('Hentikan blast?', 'Pesan yang belum terkirim dibatalkan.', { bahaya: true, ok: 'Hentikan' }).then(function (ok) { if (ok) api('wa.blastStop', { blastId: s.dataset.stop }).then(function (r) { if (toastRes(r)) { self._blastJalan = null; self.r_blast(box); } }); });
    });
    this.r_blast(box);
  },
  r_blast: function (box) {
    api('wa.blastList', {}).then(function (r) {
      var el = box.querySelector('#blRiwayat'); if (!el) return;
      if (!r.success) { el.innerHTML = retryBox(r); return; }
      el.innerHTML = r.data.length ? r.data.slice(0, 20).map(function (b) {
        var jalan = b.status === 'Berjalan';
        return '<div class="box" style="padding:12px 14px;margin-bottom:10px" data-blast="' + esc(b.id) + '"><div class="row" style="justify-content:space-between;gap:8px"><b>' + esc(b.judul) + '</b><span class="badge ' + (jalan ? 'b-sebagian' : b.status === 'Selesai' ? 'b-lunas' : 'b-batal') + '">' + esc(b.status) + '</span></div><div class="muted" style="font-size:12px">' + esc(b.sasaran || '') + ' • ' + esc(waktuRelatif(b.tanggal)) + ' • batch ' + b.batch + '</div>' +
          '<div class="progress mt-s"><i style="width:' + b.persen + '%"></i></div><div class="row mt-s" style="justify-content:space-between;font-size:12.5px"><span><b class="text-paid">' + b.terkirim + '</b> terkirim • <b class="text-coral">' + b.gagal + '</b> gagal • ' + b.sisa + ' sisa / ' + b.total + '</span>' + (jalan ? '<span class="row gap-s"><button class="btn btn-primary btn-xs" data-proses="' + esc(b.id) + '">' + ic('play', 'sm') + 'Kirim batch</button><button class="btn btn-ghost btn-xs" data-stop="' + esc(b.id) + '">' + ic('square', 'sm') + 'Stop</button></span>' : '') + '</div></div>';
      }).join('') : '<p class="muted">Belum ada blast.</p>';
    });
  },
  _blastJalan: null,
  /** Kirim batch berturut-turut selama halaman terbuka (trigger tiap menit tetap melanjutkan di latar). */
  jalankanBlast: function (box, id) {
    var self = this; if (this._blastJalan === id) return; this._blastJalan = id;
    var t = toast('Blast berjalan…', 'Mengirim batch pertama.', '', 600000);
    var langkah = function () {
      if (self._blastJalan !== id) { t.remove(); return; }
      api('wa.blastProcess', { blastId: id }, { timeout: 330000 }).then(function (r) {
        if (!r.success) { self._blastJalan = null; t.remove(); return toast('Blast tertunda', r.message + ' — dilanjutkan otomatis oleh pekerja latar.', 'warn'); }
        var td = t.querySelector('.td'); if (td) td.textContent = r.data.terkirim + ' terkirim, ' + r.data.gagal + ' gagal, ' + r.data.sisa + ' sisa (' + r.data.persen + '%)';
        self.r_blast(box);
        if (r.data.sisa > 0 && r.data.status === 'Berjalan' && document.body.contains(box)) setTimeout(langkah, 1500);
        else { self._blastJalan = null; t.remove(); toast('Blast selesai', r.data.terkirim + ' pesan terkirim.'); }
      });
    };
    langkah();
  },

  /* ---------- CRM ---------- */
  cSt: { cari: '', segmen: '', statusWA: '', tag: '', sumber: '', masalah: false, duplikat: false, optOut: false, hal: 1, pilih: {} },
  p_crm: function (box) {
    var self = this, st = this.cSt;
    box.innerHTML = '<div class="kpis" id="crKpi" style="margin-top:var(--gut)"></div>' +
      '<div class="card" style="margin-top:var(--gut)"><div class="filter-bar"><div class="searchbox grow" style="max-width:300px">' + ic('search') + '<input class="input soft" id="crCari" placeholder="Cari nama, nomor, email, tag…"></div>' +
      '<label class="filter-pill"><select id="crSeg"><option value="">Semua segmen</option></select></label><label class="filter-pill"><select id="crWa"><option value="">Status WA</option></select></label><label class="filter-pill"><select id="crTag"><option value="">Semua tag</option></select></label>' +
      '<label class="filter-pill"><select id="crSumber"><option value="">Semua sumber</option><option value="pelanggan">Pelanggan</option><option value="staf">Staf</option><option value="manual">Impor manual</option></select></label>' +
      '<label class="check"><input type="checkbox" id="crMas"> Bermasalah</label><label class="check"><input type="checkbox" id="crDup"> Duplikat</label><label class="check"><input type="checkbox" id="crOpt"> Opt-out</label></div>' +
      '<div class="filter-bar" style="padding-top:0"><button class="btn btn-primary btn-sm" id="crSync">' + ic('refresh-cw', 'sm') + 'Sinkron dari Pelanggan &amp; Staf</button><button class="btn btn-outline btn-sm" id="crImp">' + ic('upload', 'sm') + 'Impor kontak</button><button class="btn btn-outline btn-sm" id="crDupBtn">' + ic('merge', 'sm') + 'Gabung duplikat</button><button class="btn filter-pill green" id="crEks">' + ic('sheet', 'sm') + 'Ekspor</button><span class="grow"></span>' +
      '<span class="muted" id="crPilihN" style="font-size:12.5px"></span><button class="btn btn-ghost btn-sm" id="crBulk" disabled>' + ic('list-checks', 'sm') + 'Aksi massal</button></div></div>' +
      '<div class="card" style="margin-top:var(--gut);overflow:hidden"><div class="tbl-wrap"><table class="tbl cards"><thead><tr><th class="c" style="width:36px"><input type="checkbox" id="crAll" aria-label="Pilih semua"></th><th>Kontak</th><th>WhatsApp</th><th class="hide-m">Email</th><th class="hide-m">Segmen &amp; Tag</th><th class="c hide-m">Pesan</th></tr></thead><tbody id="crBody">' + skeletonRows(8, 6) + '</tbody></table></div><div class="tbl-foot" id="crFoot"></div></div>';
    var muatUlang = function () { st.hal = 1; self.r_crm(box); };
    box.querySelector('#crCari').oninput = debounce(function (e) { st.cari = e.target.value.trim(); muatUlang(); }, 350);
    [['#crSeg', 'segmen'], ['#crWa', 'statusWA'], ['#crTag', 'tag'], ['#crSumber', 'sumber']].forEach(function (x) { box.querySelector(x[0]).onchange = function (e) { st[x[1]] = e.target.value; muatUlang(); }; });
    [['#crMas', 'masalah'], ['#crDup', 'duplikat'], ['#crOpt', 'optOut']].forEach(function (x) { box.querySelector(x[0]).onchange = function (e) { st[x[1]] = e.target.checked; muatUlang(); }; });
    box.querySelector('#crSync').onclick = function () { var b = this; setBusy(b, true, 'Menyinkronkan…'); api('crm.sync', {}).then(function (r) { setBusy(b, false); if (toastRes(r)) self.r_crm(box); }); };
    box.querySelector('#crImp').onclick = function () { self.imporKontak(box); };
    box.querySelector('#crDupBtn').onclick = function () { self.duplikat(box); };
    box.querySelector('#crEks').onclick = function () { var b = this; setBusy(b, true); api('crm.export', {}).then(function (r) { setBusy(b, false); if (!r.success) return toast('Gagal', r.message, 'err'); eksporXLSX('Kontak CRM ' + hariIni() + '.xlsx', [{ nama: 'Kontak', kolom: r.data.kolom, rows: r.data.rows }]); }); };
    box.querySelector('#crAll').onchange = function (e) { (st.rows || []).forEach(function (k) { if (e.target.checked) st.pilih[k.id] = true; else delete st.pilih[k.id]; }); self.renderCrm(box); };
    box.querySelector('#crBulk').onclick = function () { self.bulk(this, box); };
    box.querySelector('#crBody').addEventListener('click', function (e) {
      var cb = e.target.closest('input[data-pilih]'); if (cb) { if (cb.checked) st.pilih[cb.dataset.pilih] = true; else delete st.pilih[cb.dataset.pilih]; self.nPilih(box); return; }
      var tr = e.target.closest('tr[data-id]'); if (tr) self.kontak(tr.dataset.id, box);
    });
    bindActs(box, { hal: function (a) { st.hal = +a.dataset.h; self.r_crm(box); } });
    this.r_crm(box);
  },
  r_crm: function (box) {
    var st = this.cSt, self = this;
    api('crm.stats', {}).then(function (r) {
      if (!r.success) return; var s = r.data;
      box.querySelector('#crKpi').innerHTML = kpiHtml('Total Kontak', angka(s.total), '+' + s.baru7 + ' baru 7 hari • sinkron ' + (s.sinkron ? waktuRelatif(new Date(s.sinkron).toISOString()) : '-'), 'contact-round') +
        kpiHtml('Punya WhatsApp', angka(s.punyaWA), s.terdaftarWA + ' terverifikasi • ' + s.belumCek + ' belum dicek', 'message-circle', 'paid') +
        kpiHtml('Email Valid', angka(s.emailValid), s.optOut + ' opt-out • ' + s.dihubungi30 + ' dihubungi 30 hari', 'mail', 'amber') +
        kpiHtml('Perlu Dirapikan', angka(s.duplikat + s.tidakBisa), s.duplikat + ' duplikat • ' + s.tidakBisa + ' tanpa kontak', 'triangle-alert', 'coral', s.duplikat + s.tidakBisa ? 'coral' : '');
    });
    api('crm.list', { cari: st.cari, segmen: st.segmen, statusWA: st.statusWA, tag: st.tag, sumber: st.sumber, masalah: st.masalah, duplikat: st.duplikat, optOut: st.optOut, halaman: st.hal, per: 50 }).then(function (r) {
      if (!r.success) { box.querySelector('#crBody').innerHTML = '<tr><td colspan="6">' + retryBox(r) + '</td></tr>'; return; }
      st.data = r.data; st.rows = r.data.rows;
      var f = r.data.facet, isi = function (id, obj, label, val) { box.querySelector(id).innerHTML = '<option value="">' + label + '</option>' + Object.keys(obj).sort().map(function (k) { return '<option value="' + esc(k) + '"' + (k === val ? ' selected' : '') + '>' + esc(k) + ' (' + obj[k] + ')</option>'; }).join(''); };
      isi('#crSeg', f.segmen, 'Semua segmen', st.segmen); isi('#crWa', f.statusWA, 'Status WA', st.statusWA); isi('#crTag', f.tag, 'Semua tag', st.tag);
      self.renderCrm(box);
    });
  },
  renderCrm: function (box) {
    var st = this.cSt, d = st.data; if (!d) return;
    box.querySelector('#crBody').innerHTML = d.rows.length ? d.rows.map(function (k) {
      var wab = k.statusWA === 'Terdaftar' ? '<span class="wa-badge ya">WA ✓</span>' : k.statusWA === 'Tidak Terdaftar' ? '<span class="wa-badge tidak">Bukan WA</span>' : k.wa ? '<span class="wa-badge belum">Belum dicek</span>' : '';
      return '<tr class="click' + (k.optOut ? ' dim' : '') + '" data-id="' + esc(k.id) + '"><td class="c"><input type="checkbox" data-pilih="' + esc(k.id) + '"' + (st.pilih[k.id] ? ' checked' : '') + '></td><td class="full-m"><div class="cust"><span class="avatar ' + avatarKelas(k.nama) + '">' + inisial(k.nama) + '</span><div><b>' + esc(k.nama) + '</b>' + (k.duplikat ? ' <span class="badge b-sebagian">duplikat</span>' : '') + (k.optOut ? ' <span class="badge b-batal">opt-out</span>' : '') + '<div class="sub">' + esc(k.sumber) + ' • ' + esc(k.id) + '</div></div></div></td>' +
        '<td class="nowrap">' + (k.wa ? esc(hpTampil(k.wa)) + ' ' + wab : '<span class="muted">-</span>') + '</td><td class="hide-m">' + (k.email ? esc(k.email) + (k.emailValid === 'TIDAK' ? ' <span class="wa-badge tidak">tidak valid</span>' : '') : '<span class="muted">-</span>') + '</td>' +
        '<td class="hide-m"><span class="cat-badge">' + esc(k.segmen) + '</span> ' + k.tag.map(function (t) { return '<span class="chip chip-s">' + esc(t) + '</span>'; }).join(' ') + '</td><td class="c hide-m num">' + k.jumlahPesan + '<div class="sub">' + esc(k.terakhir ? waktuRelatif(k.terakhir) : '') + '</div></td></tr>';
    }).join('') : '<tr><td colspan="6">' + emptyState('contact-round', 'Belum ada kontak', 'Klik <b>Sinkron dari Pelanggan & Staf</b> untuk mengisi CRM otomatis.') + '</td></tr>';
    box.querySelector('#crFoot').innerHTML = '<span><b>' + angka(d.total) + '</b> kontak</span>' + pagerHtml(d.halaman, d.total, d.per);
    this.nPilih(box);
  },
  nPilih: function (box) { var n = Object.keys(this.cSt.pilih).length; box.querySelector('#crPilihN').textContent = n ? n + ' dipilih' : ''; box.querySelector('#crBulk').disabled = !n; },
  bulk: function (btn, box) {
    var self = this, ids = Object.keys(this.cSt.pilih);
    var jalan = function (aksi, nilai) { api('crm.bulk', { ids: ids, aksi: aksi, nilai: nilai || '' }).then(function (r) { if (toastRes(r)) { self.cSt.pilih = {}; self.r_crm(box); } }); };
    var minta = function (aksi, judul) { var m = modal({ judul: judul, ikon: 'tag', isi: '<input class="input" id="bkTag" maxlength="30" placeholder="mis. promo-oktober" autofocus>', foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="bkOk">Terapkan</button>' }); m.$('#bkOk').onclick = function () { var v = m.$('#bkTag').value.trim(); if (!v) return; m.close(); jalan(aksi, v); }; };
    popMenu(btn, [{ label: 'Tambah tag', ikon: 'tag', fn: function () { minta('tag', 'Tambah tag ke ' + ids.length + ' kontak'); } }, { label: 'Hapus tag', ikon: 'tag', fn: function () { minta('untag', 'Hapus tag dari ' + ids.length + ' kontak'); } },
      { label: 'Tandai opt-out (tidak dikirimi blast)', ikon: 'bell-off', fn: function () { jalan('optout'); } }, { label: 'Batalkan opt-out', ikon: 'bell', fn: function () { jalan('optin'); } }, '-',
      { label: 'Hapus kontak impor manual', ikon: 'trash-2', bahaya: true, fn: function () { konfirmasi('Hapus kontak manual terpilih?', 'Hanya kontak bersumber impor manual yang dihapus. Kontak pelanggan/staf tetap.', { bahaya: true, ok: 'Hapus' }).then(function (ok) { if (ok) jalan('hapusManual'); }); } }]);
  },
  kontak: function (id, box) {
    var self = this;
    var d = drawer({ judul: 'Kontak', ikon: 'contact-round', isi: '<div class="skel" style="height:240px"></div>' });
    api('crm.detail', { id: id }).then(function (r) {
      if (d.closed) return; if (!r.success) return d.set(retryBox(r));
      var k = r.data;
      d.el.querySelector('.drawer-head h3').textContent = k.nama;
      d.set('<form id="ckf"><div class="grid-2">' + fld('Nama', inp('nama', k.nama, 'maxlength="80"'), { cls: 'span-2' }) + fld('WhatsApp', inp('wa', hpTampil(k.wa), 'inputmode="tel"')) + fld('Email', inp('email', k.email, 'type="email"')) +
        fld('Tag', inp('tag', k.tag.join(', '), 'placeholder="pisahkan koma"'), { cls: 'span-2' }) + fld('Catatan', txa('catatan', k.catatan, 'maxlength="500" style="min-height:60px"'), { cls: 'span-2' }) +
        '<div class="sec-toggle span-2"><div><div class="t">Opt-out</div><div class="d">Tidak dikirimi blast promo (notifikasi transaksi tetap).</div></div>' + sakelar('optOut', k.optOut) + '</div></div>' +
        (k.sumber !== 'manual' ? '<div class="note-teal mt">' + ic('info', 'sm') + '<span>Nama, WA & email ikut diperbarui di data ' + esc(k.sumber) + ' (satu sumber kebenaran).</span></div>' : '') + '</form>' +
        (k.info && k.info.Total != null ? '<div class="box mt"><div class="meta-grid two"><div class="meta"><div class="k">Total belanja</div><div class="v">' + rp(k.info.Total) + '</div></div><div class="meta"><div class="k">Transaksi</div><div class="v">' + angka(k.info.Transaksi) + ' nota</div></div><div class="meta"><div class="k">Terakhir</div><div class="v">' + tglSingkat(k.info.Terakhir) + '</div></div><div class="meta"><div class="k">Sisa piutang</div><div class="v">' + rp(k.info.SisaPiutang || 0) + '</div></div></div></div>' : '') +
        '<div class="box mt"><div class="box-title">Catat Interaksi</div><div class="row gap-s" style="flex-wrap:wrap"><select class="select" id="ciKanal" style="max-width:150px">' + selectOpts(['Telepon', 'WA Manual', 'Kunjungan', 'Catatan']) + '</select><input class="input grow" id="ciTeks" placeholder="mis. Minta penawaran udang 50 kg untuk Sabtu"><button class="btn btn-outline" id="ciOk" type="button">Catat</button></div></div>' +
        '<div class="box mt"><div class="box-title">Linimasa</div>' + (k.timeline.length ? k.timeline.map(function (t) { return '<div class="log-item"><span class="dt ' + (t.status === 'Gagal' ? 'coral' : t.jenis === 'catatan' ? 'amber' : '') + '"></span><div><b>' + esc(t.kanal) + ' • ' + esc(t.arah) + (t.status ? ' • ' + esc(t.status) : '') + '</b><span style="white-space:normal">' + esc(t.ringkasan) + '</span><span> — ' + esc(waktuRelatif(t.waktu)) + (t.oleh ? ' • ' + esc(t.oleh) : '') + '</span></div></div>'; }).join('') : '<p class="muted">Belum ada interaksi.</p>') + '</div>',
        '<button class="btn btn-primary" id="ckOk">' + ic('save', 'sm') + 'Simpan</button>' + (k.wa ? '<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/' + hp08(k.wa).replace(/^0/, '62') + '">' + ic('message-circle', 'sm') + 'Chat</a>' : '') + (k.sumberData ? '<a class="btn btn-ghost" href="' + esc(k.sumberData.link) + '">' + ic('contact-round', 'sm') + 'Profil pelanggan</a>' : ''));
      d.$('#ckOk').onclick = function () {
        var f = formData(d.$('#ckf')), b = this; setBusy(b, true);
        api('crm.save', { id: k.id, nama: f.nama, wa: hp08(f.wa), email: f.email, tag: f.tag.split(',').map(function (x) { return x.trim(); }).filter(String), catatan: f.catatan, optOut: f.optOut }).then(function (x) { setBusy(b, false); if (toastRes(x)) { self.r_crm(box); if (k.sumber === 'pelanggan') { swrStale('pelanggan:'); App.segarkanBoot(true); } } });
      };
      d.$('#ciOk').onclick = function () { var t = d.$('#ciTeks').value.trim(), b = this; if (!t) return; setBusy(b, true); api('crm.interaksi', { id: k.id, kanal: d.$('#ciKanal').value, ringkasan: t }).then(function (x) { setBusy(b, false); if (toastRes(x)) { d.close(); self.kontak(id, box); } }); };
    });
  },
  imporKontak: function (box) {
    var self = this;
    pilihFile('.xlsx,.xls,.csv').then(function (f) {
      if (!f) return;
      bacaBerkasTabel(f).then(function (sheets) {
        var s = sheets.filter(function (x) { return x.rows.length; })[0]; if (!s) return toast('Berkas kosong', '', 'warn');
        var cari = function (r, kunci) { var k = Object.keys(r).filter(function (h) { return kunci.test(h.toLowerCase().replace(/[^a-z]/g, '')); })[0]; return k ? r[k] : ''; };
        var rows = s.rows.map(function (r) { return { nama: cari(r, /^(nama|name|pelanggan|customer)/), wa: String(cari(r, /(wa|whatsapp|hp|telepon|telp|phone|nomor)/) || ''), email: cari(r, /(email|surel|mail)/), tag: cari(r, /^tag/), segmen: cari(r, /(segmen|tipe|kategori)/), catatan: cari(r, /(catatan|note|keterangan)/) }; });
        konfirmasi('Impor ' + rows.length + ' kontak dari "' + esc(f.name) + '"?', 'Kolom dikenali otomatis (Nama, WA/HP, Email, Tag, Segmen). Nomor yang sudah ada digabung, tidak dobel.', { ok: 'Impor Kontak' }).then(function (ok) {
          if (!ok) return; var t = toast('Mengimpor kontak…', '', '', 60000);
          api('crm.import', { rows: rows }).then(function (r) { t.remove(); if (toastRes(r)) self.r_crm(box); });
        });
      }).catch(function (e) { toast('Gagal membaca berkas', e.message, 'err'); });
    });
  },
  duplikat: function (box) {
    var self = this;
    var m = modal({ judul: 'Kontak Duplikat', ikon: 'merge', lebar: 'wide', sub: 'Kontak dengan nomor WA / email yang sama. Pilih kontak utama lalu gabungkan.', isi: '<div class="skel" style="height:200px"></div>' });
    api('crm.duplikat', {}).then(function (r) {
      var b = m.$('.modal-body'); if (!b) return; if (!r.success) { b.innerHTML = retryBox(r); return; }
      b.innerHTML = r.data.length ? r.data.map(function (g, i) {
        return '<div class="box" data-g="' + i + '"><div class="box-title">' + esc(g.jenis) + ': ' + esc(g.kunci) + '<button class="btn btn-primary btn-xs" data-gab="' + i + '">' + ic('merge', 'sm') + 'Gabungkan</button></div>' + g.kontak.map(function (k, j) { return '<label class="check mb-s"><input type="radio" name="u' + i + '" value="' + esc(k.id) + '"' + (j === 0 ? ' checked' : '') + '> <b>' + esc(k.nama) + '</b> <span class="muted">' + esc(k.sumber) + ' • ' + esc(hpTampil(k.wa)) + ' • ' + esc(k.email || '') + ' • ' + k.jumlahPesan + ' pesan</span></label>'; }).join('') + '</div>';
      }).join('') : emptyState('badge-check', 'Tidak ada duplikat', 'Semua kontak unik.');
      b.querySelectorAll('[data-gab]').forEach(function (bt) { bt.onclick = function () {
        var g = r.data[+bt.dataset.gab], utama = b.querySelector('input[name="u' + bt.dataset.gab + '"]:checked').value;
        setBusy(bt, true); api('crm.merge', { utama: utama, gabung: g.kontak.map(function (k) { return k.id; }).filter(function (x) { return x !== utama; }) }).then(function (x) { setBusy(bt, false); if (toastRes(x)) { bt.closest('.box').remove(); self.r_crm(box); } });
      }; });
    });
  }
};
registerPage('notifikasi', { auth: 'owner', judul: 'WhatsApp & CRM', template: function () { return Notif.template(); }, init: function (el) { Notif.init(el); }, show: function (el, p) { Notif.show(el, p); } });
