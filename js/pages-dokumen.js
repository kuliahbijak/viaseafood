/* ==========================================================================
   VIA SEAFOOD — pages-dokumen.js
   Mesin Dokumen: Dokumen.cetak() dipakai semua halaman (nota, kwitansi,
   tagihan, rekap, laporan) + halaman Owner "Dokumen & Struk": template
   Google Docs/Sheets (ganti, pindai, versi, duplikat, reset), editor MODEL
   STRUK dengan pratinjau langsung & kamus penanda, arsip dokumen terbit
   (tarik/verifikasi), cetak massal → ZIP, variabel global.
   ========================================================================== */
'use strict';
var Dokumen = {
  tpl: null, konteks: null, variabel: [],
  muatTemplate: function (paksa) {
    var self = this;
    if (this.tpl && !paksa) return Promise.resolve(this.tpl);
    return api('doc.templates', {}).then(function (r) { if (!r.success) throw r; self.tpl = r.data.templates; self.konteks = r.data.konteks; self.variabel = r.data.variabel || []; return self.tpl; });
  },
  utama: function (jenis) { var l = (this.tpl || []).filter(function (t) { return t.jenis === jenis && t.aktif && t.engine !== 'struk'; }); return l.filter(function (t) { return t.utama; })[0] || l[0] || null; },

  /** Terbitkan dokumen: isi bidang manual (bila template punya), lalu unduh/buka. */
  cetak: function (jenis, ref, btn, opsi) {
    var self = this; opsi = opsi || {};
    if (!ref) return toast('Referensi dokumen kosong', '', 'err');
    setBusy(btn, true);
    this.muatTemplate().then(function () {
      setBusy(btn, false);
      var t = opsi.kode ? self.tpl.filter(function (x) { return x.kode === opsi.kode; })[0] : self.utama(jenis);
      if (!t && opsi.kode) return toast('Template belum tersedia', 'Owner dapat mengatur template di menu Dokumen & Struk.', 'warn');
      // template bawaan yang belum terpasang (instalasi lama) dibuat otomatis oleh server saat dicetak
      if (!t) t = { jenis: jenis, kode: '', nama: ((self.konteks || {})[jenis] || {}).label || 'Dokumen', versi: '', engine: opsi.format === 'xlsx' ? 'sheets' : '', keluaran: opsi.format && opsi.format !== 'pdf' ? ['pdf', opsi.format] : ['pdf'], bidang: [], _sementara: true };
      var formatLain = t.keluaran.filter(function (f) { return f !== 'pdf'; }), fmtAwal = opsi.format && t.keluaran.indexOf(opsi.format) > -1 ? opsi.format : 'pdf';
      if (!(t.bidang || []).length && !opsi.tanya) return self.terbitkan(t, ref, {}, fmtAwal, btn);
      var m = modal({ judul: esc(t.nama), sub: 'Ref: ' + esc(ref) + ' • template ' + esc(t.kode) + ' v' + t.versi, ikon: 'file-text', lebar: 'mid',
        isi: '<form id="dcF">' + (t.bidang || []).map(function (b) {
          var nm = 'b_' + b.kunci, ctrl = b.tipe === 'area' ? '<textarea class="textarea" name="' + nm + '"></textarea>' : b.tipe === 'pilihan' && (b.opsi || []).length ? '<select class="select" name="' + nm + '">' + selectOpts(b.opsi, '') + '</select>' : '<input class="input" name="' + nm + '" type="' + (b.tipe === 'tanggal' ? 'date' : 'text') + '"' + (b.tipe === 'angka' ? ' inputmode="decimal"' : '') + '>';
          return fld(esc(b.label), ctrl, { req: b.wajib, hint: esc(b.bantu || ''), cls: 'mb' });
        }).join('') + (formatLain.length ? fld('Format', '<div class="seg" id="dcFmt"><button type="button" class="on" data-f="pdf">PDF</button>' + formatLain.map(function (f) { return '<button type="button" data-f="' + f + '">' + f.toUpperCase() + '</button>'; }).join('') + '</div>') : '') + '</form>',
        foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="dcOk">' + ic('file-check-2', 'sm') + 'Terbitkan</button>' });
      var fmt = fmtAwal;
      if (m.$('#dcFmt')) m.$$('#dcFmt button').forEach(function (x) { x.classList.toggle('on', x.dataset.f === fmt); });
      if (m.$('#dcFmt')) m.$('#dcFmt').onclick = function (e) { var b = e.target.closest('[data-f]'); if (!b) return; fmt = b.dataset.f; m.$$('#dcFmt button').forEach(function (x) { x.classList.toggle('on', x === b); }); };
      m.$('#dcOk').onclick = function () {
        var isian = {}, kurang = null;
        (t.bidang || []).forEach(function (b) { var el = m.$('[name="b_' + b.kunci + '"]'); isian[b.kunci] = el ? el.value.trim() : ''; if (b.wajib && !isian[b.kunci] && !kurang) kurang = el; });
        if (kurang) { kurang.classList.add('is-err'); kurang.focus(); return; }
        var b = m.$('#dcOk'); self.terbitkan(t, ref, isian, fmt, b).then(function (ok) { if (ok) m.close(); });
      };
    }, function (r) { setBusy(btn, false); toast('Gagal memuat template', r.message || '', 'err'); });
  },
  terbitkan: function (t, ref, isian, format, btn) {
    var self = this, tst = toast('Menyiapkan ' + t.nama + '…', 'Dokumen dirender di Google Docs/Sheets (±5–15 detik).', '', 60000);
    setBusy(btn, true, 'Memproses…');
    return api('doc.print', { jenis: t.jenis, kode: t.kode, ref: ref, isian: isian, format: format }, { timeout: 330000 }).then(function (r) {
      setBusy(btn, false); tst.remove();
      if (!r.success) { toast('Gagal menerbitkan', r.message, 'err'); return false; }
      if (t._sementara) self.tpl = null;
      self.hasil(r.data, { t: t, ref: ref, isian: isian }); return true;
    });
  },
  hasil: function (d, asal) {
    var blobUrl = '';
    if (d.dataUrl && d.format === 'pdf') { try { var bin = atob(d.dataUrl.split(',')[1]), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); blobUrl = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })); } catch (e) { } }
    var hp = /Android|iPhone|iPad/i.test(navigator.userAgent);
    var m = modal({ judul: esc(d.judul), sub: 'Nomor <b>' + esc(d.nomor) + '</b>' + (d.dipakaiUlang ? ' • data sama — memakai berkas yang sudah terbit' : ' • baru terbit'), ikon: 'file-check-2', ikonKelas: 'paid', lebar: blobUrl && !hp ? 'xl' : 'mid',
      onClose: function () { if (blobUrl) setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 3000); },
      isi: (blobUrl && !hp ? '<iframe src="' + blobUrl + '" style="width:100%;height:62vh;border:1px solid var(--sand);border-radius:12px" title="Pratinjau PDF"></iframe>' : '<div class="dropzone" style="cursor:default">' + ic('file-check-2', 'lg') + '<div><b>' + esc(d.nama) + '</b></div><div class="muted" style="font-size:12.5px">Siap diunduh atau dibagikan</div></div>') +
        '<div class="row gap-s mt" style="flex-wrap:wrap;align-items:center"><span class="label-up">SHA-256</span><span class="hash grow" style="font-size:11px">' + esc(d.hash || '-') + '</span></div>',
      foot: (d.verifikasi ? '<button class="btn btn-ghost" id="dhVer">' + ic('shield-check', 'sm') + 'Salin tautan verifikasi</button>' : '') + (d.url ? '<a class="btn btn-outline" target="_blank" rel="noopener" href="' + esc(d.url) + '">' + ic('external-link', 'sm') + 'Buka di Drive</a>' : '') + (asal && d.format === 'pdf' && asal.t.keluaran.some(function (f) { return f !== 'pdf'; }) ? '<button class="btn btn-outline" id="dhLain">' + ic('file-text', 'sm') + (asal.t.engine === 'sheets' ? 'Versi Excel' : 'Versi Word') + '</button>' : '') + (d.dataUrl ? '<button class="btn btn-primary" id="dhUnduh">' + ic('download', 'sm') + 'Unduh ' + esc(d.format.toUpperCase()) + '</button>' : '') });
    var self = this;
    if (m.$('#dhLain')) m.$('#dhLain').onclick = function () { var b = this; self.terbitkan(asal.t, asal.ref, asal.isian, asal.t.engine === 'sheets' ? 'xlsx' : 'docx', b).then(function (ok) { if (ok) m.close(); }); };
    if (m.$('#dhUnduh')) m.$('#dhUnduh').onclick = function () { unduhDataUrl(d.nama, d.dataUrl); };
    if (m.$('#dhVer')) m.$('#dhVer').onclick = function () { salinTeks(d.verifikasi).then(function () { toast('Tautan verifikasi disalin', d.verifikasi); }); };
  },
  /** Cetak massal (nota per tanggal / tagihan semua pelanggan berpiutang) → ZIP. */
  massal: function (jenis, opsi) {
    var self = this; opsi = opsi || {};
    if (jenis === 'REKAP_PER_PELANGGAN') return this.massalRekapPlg(opsi);
    var m = modal({ judul: 'Cetak Massal ' + (jenis === 'NOTA' ? 'Nota' : 'Surat Tagihan'), ikon: 'files', lebar: 'mid', sub: 'Diproses bertahap di server, hasil dikumpulkan dalam satu ZIP di Google Drive.',
      isi: jenis === 'NOTA' ? fld('Tanggal pesanan', '<input class="input" type="date" id="msTgl" value="' + hariIni() + '" max="' + hariIni() + '">', { hint: 'Semua nota (kecuali batal) pada tanggal ini' }) : '<label class="check"><input type="checkbox" id="msLewat"> Hanya pelanggan yang lewat jatuh tempo</label>',
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="msOk">' + ic('play', 'sm') + 'Mulai</button>' });
    m.$('#msOk').onclick = function () {
      var b = this, d = { jenis: jenis }; if (jenis === 'NOTA') d.tanggal = m.$('#msTgl').value; else d.lewatSaja = m.$('#msLewat').checked;
      setBusy(b, true);
      api('doc.massal', d).then(function (r) { setBusy(b, false); if (!toastRes(r)) return; m.close(); self.pantauMassal(r.data.massalId, r.data.total); });
    };
  },
  /** Rekap lengkap tiap pelanggan (PDF + Excel per pelanggan) dalam satu ZIP. */
  massalRekapPlg: function (opsi) {
    var self = this, tipe = ((AppState.cfg || {}).tipePelanggan || []);
    var m = modal({ judul: 'Rekap per Pelanggan — Semua Sekaligus', ikon: 'files', lebar: 'mid', sub: 'Setiap pelanggan mendapat rekap PDF dan Excel masing-masing, dikumpulkan dalam satu ZIP di Google Drive.',
      isi: '<div class="grid-2">' + fld('Periode', '<input class="input" type="month" id="mrPer" value="' + esc(opsi.periode || periodeIni()) + '" max="' + periodeIni() + '">') +
        fld('Tipe pelanggan', '<select class="select" id="mrTipe">' + selectOpts(tipe, opsi.tipe || (tipe.indexOf('Restoran') > -1 ? 'Restoran' : ''), 'Semua tipe') + '</select>', { hint: 'Mis. hanya Restoran' }) + '</div>' +
        '<div class="note-teal mt">' + ic('info', 'sm') + '<span>Hanya pelanggan yang bertransaksi pada periode tersebut. Berkas juga tersimpan satu per satu di <b>Arsip Terbit</b>.</span></div>',
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="mrOk">' + ic('play', 'sm') + 'Mulai</button>' });
    m.$('#mrOk').onclick = function () {
      var b = this; setBusy(b, true);
      api('doc.massal', { jenis: 'REKAP_PER_PELANGGAN', periode: m.$('#mrPer').value || periodeIni(), tipe: m.$('#mrTipe').value }).then(function (r) {
        setBusy(b, false);
        if (!r.success) return toast(/Tidak ada data/.test(r.message) ? 'Tidak ada pelanggan bertransaksi' : 'Gagal', /Tidak ada data/.test(r.message) ? 'Tidak ada pelanggan ' + (m.$('#mrTipe').value || '') + ' yang bertransaksi pada periode ini.' : r.message, 'warn');
        toast('Masuk antrean', r.data.total + ' pelanggan × (PDF + Excel)'); m.close(); self.pantauMassal(r.data.massalId, r.data.total);
      });
    };
  },
  pantauMassal: function (id, total) {
    var m = modal({ judul: 'Membuat ' + total + ' dokumen…', ikon: 'files', tutupLuar: false, isi: '<div class="progress"><i id="pmBar" style="width:2%"></i></div><div class="mt-s muted" id="pmInfo">Mengantre…</div><div id="pmZip" class="mt"></div><p class="muted mt" style="font-size:12px">Boleh ditutup — proses tetap berjalan di server (pekerja latar tiap 10 menit). Hasil ada di Arsip Dokumen.</p>', foot: '<button class="btn btn-outline" data-x>Tutup</button>' });
    var jalan = function () {
      if (m.closed) return;
      api('doc.massalProses', { massalId: id }, { timeout: 360000 }).then(function (r) {
        if (m.closed) return; if (!r.success) { m.$('#pmInfo').textContent = r.message; return; }
        var s = r.data.stat, sel = (s.SELESAI || 0) + (s.GAGAL || 0);
        m.$('#pmBar').style.width = Math.max(2, Math.round(sel / Math.max(1, r.data.total) * 100)) + '%';
        m.$('#pmInfo').textContent = (s.SELESAI || 0) + ' selesai • ' + (s.GAGAL || 0) + ' gagal • ' + (s.MENUNGGU || 0) + ' menunggu';
        if (r.data.zip) { m.$('#pmZip').innerHTML = '<a class="btn btn-primary btn-block" target="_blank" rel="noopener" href="' + esc(r.data.zip) + '">' + ic('download', 'sm') + 'Unduh ZIP dari Drive</a>' + (r.data.gagal.length ? '<div class="note-coral mt-s">' + ic('circle-alert', 'sm') + '<span>' + r.data.gagal.map(function (g) { return esc(g.ref + ': ' + g.galat); }).join('<br>') + '</span></div>' : ''); return; }
        if (s.MENUNGGU) setTimeout(jalan, 800); else setTimeout(jalan, 2500);
      });
    };
    jalan();
  },

  /* =========================== HALAMAN OWNER =========================== */
  tab: 'template',
  TABS: [{ id: 'template', label: 'Template Dokumen', ikon: 'file-text' }, { id: 'struk', label: 'Model Struk', ikon: 'receipt-text' }, { id: 'arsip', label: 'Arsip Terbit', ikon: 'archive' }, { id: 'variabel', label: 'Variabel & Penanda', ikon: 'braces' }],
  template: function () {
    return '<div class="page-head"><div><div class="eyebrow">Mesin Dokumen <span class="dot"></span><span class="loc">Google Docs & Sheets</span></div><h1 class="page-title">Dokumen &amp; Struk</h1><p class="page-sub">Ubah desain nota, kwitansi, tagihan, laporan & model struk tanpa coding</p></div>' +
      '<div class="page-actions"><button class="btn btn-outline" data-act="massalNota">' + ic('files', 'sm') + 'Cetak Nota Massal</button><button class="btn btn-outline" data-act="massalTagihan">' + ic('files', 'sm') + 'Tagihan Massal</button></div></div>' +
      '<div class="card">' + tabsHtml(this.TABS, this.tab) + '</div><div id="dkHost"></div>';
  },
  init: function (el) {
    var self = this;
    pasangTabs(el.querySelector('.tabs'), function (t) { self.buka(el, t); history.replaceState(null, '', '#/dokumen/' + t); });
    bindActs(el, { massalNota: function () { self.massal('NOTA'); }, massalTagihan: function () { self.massal('TAGIHAN'); } });
  },
  show: function (el, p) { this.buka(el, this.TABS.some(function (t) { return t.id === p; }) ? p : this.tab); },
  buka: function (el, t) {
    this.tab = t;
    el.querySelectorAll('.tabs [data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    var host = el.querySelector('#dkHost'), box = host.querySelector('[data-panel="' + t + '"]');
    Array.prototype.forEach.call(host.children, function (c) { c.hidden = c.dataset.panel !== t; });
    if (!box) { box = document.createElement('div'); box.dataset.panel = t; host.appendChild(box); this['p_' + t](box); }
    else if (this['r_' + t]) this['r_' + t](box);
  },

  /* ---------- template dokumen ---------- */
  p_template: function (box) { box.innerHTML = '<div class="skel mt" style="height:260px"></div>'; this.r_template(box); },
  r_template: function (box) {
    var self = this;
    this.muatTemplate(true).then(function () { self.renderTemplate(box); }, function (r) { box.innerHTML = '<div class="card mt">' + retryBox(r) + '</div>'; box.querySelector('[data-act]').onclick = function () { self.r_template(box); }; });
  },
  renderTemplate: function (box) {
    var self = this, grup = {};
    this.tpl.filter(function (t) { return t.engine !== 'struk'; }).forEach(function (t) { (grup[t.jenis] = grup[t.jenis] || []).push(t); });
    box.innerHTML = '<div class="note-teal mt">' + ic('lightbulb') + '<span><b>Cara mengubah desain:</b> klik <b>Buka di Google</b>, ubah tata letak/teks/logo langsung di Google Docs/Sheets (penanda seperti <code>{{NAMA_PELANGGAN}}</code> jangan dihapus), lalu klik <b>Pindai ulang</b>. Atau <b>Ganti berkas</b> dengan .docx/.xlsx buatan Anda sendiri. Setiap perubahan tersimpan sebagai versi baru dan bisa dikembalikan.</span></div>' +
      Object.keys(grup).map(function (j) {
        var k = self.konteks[j] || {};
        return '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic(j === 'NOTA' ? 'receipt-text' : j === 'KWITANSI' ? 'banknote' : j === 'TAGIHAN' ? 'clipboard-clock' : j === 'REKAP_PELANGGAN' ? 'users-round' : j === 'REKAP_PER_PELANGGAN' ? 'contact-round' : j === 'LAPORAN_HARIAN' ? 'calendar' : 'wallet') + '</span><div><div class="t">' + esc(k.label || j) + '</div><div class="muted" style="font-size:12.5px">Referensi: ' + esc(k.ref || '-') + (k.massal ? ' • mendukung cetak massal' : '') + '</div></div></div><div class="sec-body"><div class="grid-2">' +
          grup[j].map(function (t) {
            return '<div class="box tpl-card" data-kode="' + esc(t.kode) + '" style="margin:0' + (t.aktif ? '' : ';opacity:.6') + '"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px"><div><div class="tt">' + esc(t.nama) + '</div><div class="td mono">' + esc(t.kode) + ' • v' + t.versi + ' • ' + (t.engine === 'sheets' ? 'Google Sheets' : 'Google Docs') + ' • ' + esc(t.kertas || 'A4') + (t.orientasi === 'lanskap' ? ' lanskap' : '') + '</div></div>' +
              '<div class="row gap-s">' + (t.utama ? '<span class="badge b-lunas">Utama</span>' : '') + (t.standar ? '<span class="badge b-dark">Bawaan</span>' : '') + '<label class="switch" title="Aktif"><input type="checkbox" data-aktif' + (t.aktif ? ' checked' : '') + '><span></span></label></div></div>' +
              '<div class="row gap-s" style="flex-wrap:wrap;font-size:12px"><span class="pill-stat">' + t.jumlahPenanda + ' penanda</span>' + ((t.bidang || []).length ? '<span class="pill-stat">' + t.bidang.length + ' isian manual</span>' : '') + ((t.slot || []).length ? '<span class="pill-stat">' + t.slot.length + ' tanda tangan</span>' : '') + '<span class="pill-stat">' + esc(t.keluaran.join(' + ').toUpperCase()) + '</span>' + (t.formatNomor ? '<span class="pill-stat mono">' + esc(t.formatNomor) + '</span>' : '') + '</div>' +
              ((t.tidakDikenal || []).length ? '<div class="note-coral" style="padding:8px 12px">' + ic('triangle-alert', 'sm') + '<span>Penanda tidak dikenal: ' + esc(t.tidakDikenal.join(', ')) + '</span></div>' : '') +
              '<div class="row gap-s" style="flex-wrap:wrap">' + (t.url ? '<a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="' + esc(t.url) + '">' + ic('external-link', 'sm') + 'Buka di Google</a>' : '') + '<button class="btn btn-outline btn-sm" data-a="scan">' + ic('scan-search', 'sm') + 'Pindai ulang</button><button class="btn btn-outline btn-sm" data-a="uji">' + ic('file-check-2', 'sm') + 'Uji cetak</button><button class="btn btn-ghost btn-sm" data-a="menu">' + ic('ellipsis-vertical', 'sm') + 'Lainnya</button></div><div class="td">Diperbarui ' + esc(waktuRelatif(t.diperbarui)) + (t.oleh ? ' oleh ' + esc(t.oleh) : '') + '</div></div>';
          }).join('') + '</div></div></div>';
      }).join('');
    box.onclick = function (e) {
      var card = e.target.closest('[data-kode]'); if (!card) return;
      var t = self.tpl.filter(function (x) { return x.kode === card.dataset.kode; })[0], a = e.target.closest('[data-a]'); if (!t || !a) return;
      if (a.dataset.a === 'scan') { setBusy(a, true); api('doc.templateScan', { kode: t.kode }, { timeout: 120000 }).then(function (r) { setBusy(a, false); if (toastRes(r)) self.r_template(box); }); }
      if (a.dataset.a === 'uji') self.ujiCetak(t, a);
      if (a.dataset.a === 'menu') self.menuTemplate(a, t, box);
    };
    box.onchange = function (e) {
      if (!e.target.hasAttribute('data-aktif')) return; var card = e.target.closest('[data-kode]');
      api('doc.templateSave', { kode: card.dataset.kode, aktif: e.target.checked }).then(function (r) { if (toastRes(r, e.target.checked ? 'Template diaktifkan' : 'Template dinonaktifkan')) self.r_template(box); else e.target.checked = !e.target.checked; });
    };
  },
  ujiCetak: function (t, btn) {
    var self = this, k = this.konteks[t.jenis] || {}, saran = t.jenis === 'REKAP_PELANGGAN' ? periodeIni() : t.jenis === 'LAPORAN_KEUANGAN' ? periodeIni() + '-01_' + hariIni() : t.jenis === 'LAPORAN_HARIAN' ? hariIni() : t.jenis === 'REKAP_PER_PELANGGAN' ? ((AppState.pelanggan[0] || {}).id ? AppState.pelanggan[0].id + '_' : '') + periodeIni() : '';
    var m = modal({ judul: 'Uji cetak ' + esc(t.nama), ikon: 'file-check-2', isi: fld(esc(k.ref || 'Referensi'), '<input class="input" id="ujRef" value="' + esc(saran) + '" autofocus placeholder="' + esc(k.ref || '') + '">', { hint: t.jenis === 'NOTA' ? 'Salin nomor nota dari menu Pesanan Harian' : t.jenis === 'KWITANSI' ? 'ID pembayaran ada di riwayat piutang (BYR-…)' : t.jenis === 'TAGIHAN' ? 'ID pelanggan (PLG-…) ada di menu Rekap Pelanggan' : t.jenis === 'REKAP_PER_PELANGGAN' ? 'ID pelanggan + periode, mis. PLG-00001_' + periodeIni() + ' atau rentang PLG-00001_' + periodeIni() + '-01_' + hariIni() : '' }),
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="ujOk">Cetak</button>' });
    m.$('#ujOk').onclick = function () { var ref = m.$('#ujRef').value.trim(); if (!ref) return; m.close(); self.cetak(t.jenis, ref, btn, { kode: t.kode, tanya: true }); };
  },
  menuTemplate: function (btn, t, box) {
    var self = this, segar = function (r) { if (toastRes(r)) self.r_template(box); };
    var items = [{ label: 'Pengaturan template', ikon: 'settings', fn: function () { self.aturTemplate(t, box); } }, { label: 'Ganti berkas (URL / unggah .docx/.xlsx)', ikon: 'upload', fn: function () { self.gantiBerkas(t, box); } },
      { label: 'Unduh berkas template', ikon: 'download', fn: function () { api('doc.templateUnduh', { kode: t.kode }, { timeout: 120000 }).then(function (r) { if (!r.success) return toast('Gagal', r.message, 'err'); if (r.data.dataUrl) unduhDataUrl(r.data.nama, r.data.dataUrl); else if (r.data.isi) unduhTeks(r.data.nama, r.data.isi); }); } },
      { label: 'Riwayat versi', ikon: 'history', fn: function () { self.riwayatVersi(t, box); } }];
    if (!t.utama) items.push({ label: 'Jadikan template utama', ikon: 'star', fn: function () { api('doc.templateSave', { kode: t.kode, utama: true }).then(segar); } });
    items.push({ label: 'Duplikat (buat variasi)', ikon: 'copy', fn: function () { api('doc.templateDuplikat', { kode: t.kode }, { timeout: 120000 }).then(segar); } });
    if (t.standar) items.push('-', { label: 'Reset ke desain bawaan', ikon: 'rotate-ccw', bahaya: true, fn: function () { konfirmasi('Reset ' + esc(t.nama) + '?', 'Desain kembali ke bawaan aplikasi. Versi sekarang tetap tersimpan di riwayat.', { bahaya: true, ok: 'Reset' }).then(function (ok) { if (ok) api('doc.templateReset', { kode: t.kode }, { timeout: 180000 }).then(segar); }); } });
    else items.push('-', { label: 'Hapus template', ikon: 'trash-2', bahaya: true, fn: function () { konfirmasi('Hapus ' + esc(t.nama) + '?', 'Template harus nonaktif dulu. Dokumen yang sudah terbit tetap ada di arsip.', { bahaya: true, ok: 'Hapus' }).then(function (ok) { if (ok) api('doc.templateHapus', { kode: t.kode }).then(segar); }); } });
    popMenu(btn, items);
  },
  aturTemplate: function (t, box) {
    var self = this;
    var m = modal({ judul: 'Pengaturan ' + esc(t.nama), ikon: 'settings', lebar: 'wide',
      isi: '<div class="grid-2">' + fld('Nama template', inp('nama', t.nama, 'maxlength="120"')) + fld('Format nomor', inp('formatNomor', t.formatNomor, 'placeholder="KW/{URUT}/{BULAN_ROMAWI}/{TAHUN}"'), { hint: '{URUT} {TAHUN} {BULAN} {BULAN_ROMAWI} {TANGGAL}' }) +
        fld('Kertas', sel('kertas', ['A4', 'A5', 'Letter', 'Legal', 'F4'], t.kertas || 'A4')) + fld('Orientasi', sel('orientasi', [{ v: 'potret', l: 'Potret' }, { v: 'lanskap', l: 'Lanskap' }], t.orientasi || 'potret')) +
        '<div class="field span-2"><label>Keluaran disimpan</label><div class="row gap-s"><label class="check"><input type="checkbox" checked disabled> PDF</label><label class="check"><input type="checkbox" id="tkX"' + (t.keluaran.indexOf(t.engine === 'sheets' ? 'xlsx' : 'docx') > -1 ? ' checked' : '') + '> ' + (t.engine === 'sheets' ? 'Excel (.xlsx)' : 'Word (.docx)') + ' yang bisa diedit</label></div></div></div>' +
        ((t.slot || []).length ? '<div class="label-up mt-l mb-s">Tanda tangan</div>' + t.slot.map(function (s, i) {
          return '<div class="box" data-slot="' + i + '" style="padding:12px 14px"><div class="grid-3">' + fld('Label', '<input class="input" data-s="label" value="' + esc(s.label) + '">') + fld('Penanda tangan', '<select class="select" data-s="cara">' + selectOpts([{ v: 'pencetak', l: 'Yang mencetak' }, { v: 'owner', l: 'Owner' }, { v: 'tetap', l: 'Nama tetap' }], s.cara) + '</select>') + fld('Nama (bila tetap)', '<input class="input" data-s="nama" value="' + esc(s.nama || '') + '">') +
            fld('Jabatan', '<input class="input" data-s="jabatan" value="' + esc(s.jabatan || '') + '">') + fld('Tanda', '<select class="select" data-s="tanda">' + selectOpts([{ v: 'kosong', l: 'Kosong (ttd basah)' }, { v: 'spesimen', l: 'Spesimen gambar Owner' }, { v: 'qr', l: 'QR tanda tangan elektronik' }], s.tanda) + '</select>') + '</div></div>';
        }).join('') : '') +
        ((t.bidang || []).length ? '<div class="label-up mt-l mb-s">Isian manual saat mencetak</div>' + t.bidang.map(function (b, i) {
          return '<div class="box" data-bid="' + i + '" style="padding:12px 14px"><div class="grid-3"><div class="meta"><div class="k">Penanda</div><div class="v mono">{{' + esc(b.kunci) + '}}</div></div>' + fld('Label', '<input class="input" data-b="label" value="' + esc(b.label) + '">') + fld('Jenis', '<select class="select" data-b="tipe">' + selectOpts(['teks', 'area', 'angka', 'tanggal', 'pilihan'], b.tipe) + '</select>') +
            fld('Petunjuk', '<input class="input" data-b="bantu" value="' + esc(b.bantu || '') + '">') + fld('Pilihan (koma)', '<input class="input" data-b="opsi" value="' + esc((b.opsi || []).join(', ')) + '">') + '<label class="check"><input type="checkbox" data-b="wajib"' + (b.wajib ? ' checked' : '') + '> Wajib diisi</label></div></div>';
        }).join('') : ''),
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="tkOk">' + ic('save', 'sm') + 'Simpan</button>' });
    m.$('#tkOk').onclick = function () {
      var b = this, d = { kode: t.kode, nama: m.$('#f_nama').value.trim(), formatNomor: m.$('#f_formatNomor').value.trim(), kertas: m.$('#f_kertas').value, orientasi: m.$('#f_orientasi').value, keluaran: ['pdf'].concat(m.$('#tkX').checked ? [t.engine === 'sheets' ? 'xlsx' : 'docx'] : []) };
      if ((t.slot || []).length) d.slot = t.slot.map(function (s, i) { var bx = m.$('[data-slot="' + i + '"]'), o = Object.assign({}, s); bx.querySelectorAll('[data-s]').forEach(function (x) { o[x.dataset.s] = x.value; }); return o; });
      if ((t.bidang || []).length) d.bidang = t.bidang.map(function (bd, i) { var bx = m.$('[data-bid="' + i + '"]'), o = { kunci: bd.kunci }; bx.querySelectorAll('[data-b]').forEach(function (x) { o[x.dataset.b] = x.type === 'checkbox' ? x.checked : x.dataset.b === 'opsi' ? x.value.split(',').map(function (s) { return s.trim(); }).filter(String) : x.value; }); return o; });
      setBusy(b, true); api('doc.templateSave', d).then(function (r) { setBusy(b, false); if (toastRes(r)) { m.close(); self.r_template(box); } });
    };
  },
  gantiBerkas: function (t, box) {
    var self = this, data = null;
    var m = modal({ judul: 'Ganti berkas ' + esc(t.nama), ikon: 'upload', lebar: 'mid', sub: 'Versi lama tetap disimpan dan bisa dikembalikan.',
      isi: fld('Tempel URL ' + (t.engine === 'sheets' ? 'Google Spreadsheet' : 'Google Dokumen'), '<input class="input" id="gbUrl" placeholder="https://docs.google.com/…">', { hint: 'Berkas harus bisa dibuka akun pemilik script.' }) + '<div class="divider">ATAU</div>' +
        '<div class="dropzone" id="gbDrop">' + ic('upload', 'lg') + '<div><b>Unggah ' + (t.engine === 'sheets' ? '.xlsx' : '.docx') + '</b></div><div class="muted" style="font-size:12px">Dikonversi otomatis (butuh layanan Drive API aktif di Apps Script)</div></div>' + fld('Catatan versi', '<input class="input" id="gbCat" maxlength="100" placeholder="mis. ganti logo & warna">', { cls: 'mt' }),
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="gbOk">Ganti &amp; Pindai</button>' });
    m.$('#gbDrop').onclick = function () { pilihFile(t.engine === 'sheets' ? '.xlsx,.xls' : '.docx,.doc').then(function (f) { if (!f) return; if (f.size > 8e6) return toast('Berkas terlalu besar', 'Maks 8 MB', 'err'); bacaFile(f).then(function (u) { data = { dataUrl: u, namaBerkas: f.name }; m.$('#gbDrop').innerHTML = ic('file-check-2', 'lg') + '<div><b>' + esc(f.name) + '</b></div>'; }); }); };
    m.$('#gbOk').onclick = function () {
      var url = m.$('#gbUrl').value.trim(), b = this; if (!url && !data) return toast('Tempel URL atau unggah berkas', '', 'warn');
      setBusy(b, true, 'Memproses…');
      api('doc.templateGanti', Object.assign({ kode: t.kode, catatan: m.$('#gbCat').value.trim() }, url ? { url: url } : data), { timeout: 300000 }).then(function (r) { setBusy(b, false); if (toastRes(r)) { m.close(); self.r_template(box); } });
    };
  },
  riwayatVersi: function (t, box, cb) {
    var self = this;
    var m = modal({ judul: 'Riwayat versi ' + esc(t.nama), ikon: 'history', lebar: 'mid', isi: '<div class="log-item"><span class="dt"></span><div><b>Versi ' + t.versi + ' (sekarang)</b><span>' + esc(t.diperbarui || '') + ' • ' + esc(t.oleh || '') + '</span></div></div>' + ((t.riwayat || []).length ? t.riwayat.map(function (h) {
      return '<div class="log-item" style="align-items:center"><span class="dt amber"></span><div class="grow"><b>Versi ' + h.versi + '</b><span>' + esc(h.tanggal) + ' • ' + esc(h.oleh || '') + (h.catatan ? ' • ' + esc(h.catatan) : '') + '</span></div><button class="btn btn-outline btn-sm" data-v="' + h.versi + '">' + ic('rotate-ccw', 'sm') + 'Kembalikan</button></div>';
    }).join('') : '<p class="muted">Belum ada versi sebelumnya.</p>') });
    m.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]'); if (!b) return;
      konfirmasi('Kembalikan ke versi ' + b.dataset.v + '?', 'Isi versi tersebut dipakai lagi sebagai versi baru. Versi sekarang tetap tersimpan.', { ok: 'Kembalikan' }).then(function (ok) {
        if (!ok) return; setBusy(b, true);
        api('doc.templateKembalikan', { kode: t.kode, versi: +b.dataset.v }, { timeout: 180000 }).then(function (r) { setBusy(b, false); if (toastRes(r)) { m.close(); if (cb) cb(r.data); else self.r_template(box); } });
      });
    });
  },

  /* ---------- editor MODEL STRUK ---------- */
  CONTOH: {
    lunas: { id: 'ORD-261007-0048', kode: 'K7Q2M9XW4P', tanggal: '', waktu: '09:42', detik: ':15', pelanggan: 'Restoran Nelayan Rasa', wa: '081298760001', alamat: 'Jl. Pluit Karang Cantik Blok B2 No. 12', items: [{ nama: 'Ikan Kakap Merah Segar', grade: 'Grade A', sku: 'IKN-KKP-01', qty: 12.5, satuan: 'kg', harga: 95000, sub: 1187500 }, { nama: 'Udang Vaname Super 50/kg', grade: 'Size 50', qty: 5, satuan: 'kg', harga: 90000, sub: 450000 }], subtotal: 1637500, diskon: 7500, total: 1630000, metode: 'Tunai', diterima: 1650000, kembalian: 20000, status: 'Lunas', berat: 17.5, catatan: 'Antar sebelum jam 10' },
    tempo: { id: 'ORD-261007-0049', kode: 'P3X8N2KV7A', tanggal: '', waktu: '10:05', detik: ':02', pelanggan: 'Hotel Grand Bahari', wa: '081298760003', alamat: 'Jl. Pantai Indah Kapuk No. 1', items: [{ nama: 'Kepiting Bakau Jantan Super', grade: 'Super', qty: 8, satuan: 'kg', harga: 145000, sub: 1160000 }], subtotal: 1160000, total: 1160000, metode: 'Tempo', dp: 300000, piutangId: 'PIU-0021', jatuhTempo: '', status: 'Hutang', berat: 8 },
    batal: { id: 'ORD-261007-0050', kode: 'B4T9L1QZ8C', tanggal: '', waktu: '10:31', pelanggan: 'Pelanggan Umum', items: [{ nama: 'Cumi-cumi Sero Segar', qty: 3, satuan: 'kg', harga: 85000, sub: 255000 }], subtotal: 255000, total: 255000, metode: 'Tunai', status: 'Batal', berat: 3 }
  },
  p_struk: function (box) {
    var self = this;
    box.innerHTML = '<div class="skel mt" style="height:400px"></div>';
    Promise.all([this.muatTemplate(true), api('doc.kamus', { jenis: 'STRUK' })]).then(function (x) {
      self.kamusStruk = x[1].success ? x[1].data.STRUK : null;
      self.renderStrukList(box);
    }, function (r) { box.innerHTML = '<div class="card mt">' + retryBox(r) + '</div>'; box.querySelector('[data-act]').onclick = function () { self.p_struk(box); }; });
  },
  r_struk: function (box) { if (!box.querySelector('#seIsi')) this.p_struk(box); },
  renderStrukList: function (box, pilih) {
    var self = this, list = this.tpl.filter(function (t) { return t.engine === 'struk'; }), pr = Struk.pengaturan();
    var dipakai = function (k) { return [pr.template58 === k ? '58 mm' : '', pr.template80 === k ? '80 mm' : '', pr.templateHemat === k ? 'Hemat' : ''].filter(String); };
    var t = list.filter(function (x) { return x.kode === pilih; })[0] || list.filter(function (x) { return x.kode === (pr.lebar === 80 ? pr.template80 : pr.template58); })[0] || list[0];
    if (!t) { box.innerHTML = '<div class="card mt">' + emptyState('receipt-text', 'Belum ada model struk', 'Jalankan setupAppEnvironment untuk membuat model bawaan.') + '</div>'; return; }
    var km = this.kamusStruk || { kunci: [], blok: {} };
    box.innerHTML = '<div class="row gap-s mt" style="flex-wrap:wrap" id="seList">' + list.map(function (x) { var d = dipakai(x.kode); return '<button class="chip' + (x.kode === t.kode ? ' on' : '') + '" data-k="' + esc(x.kode) + '"' + (x.aktif ? '' : ' style="opacity:.6"') + '>' + ic('receipt-text', 'sm') + esc(x.nama) + (d.length ? ' <span class="n">• ' + d.join(', ') + '</span>' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="split" style="margin-top:var(--gut);grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);align-items:start"><div class="card card-pad"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><div><h3 class="card-title">' + esc(t.nama) + '</h3><div class="muted mono" style="font-size:12px">' + esc(t.kode) + ' • v' + t.versi + (t.standar ? ' • bawaan' : '') + '</div></div>' +
      '<div class="row gap-s"><label class="filter-pill">Lebar <input id="seLebar" type="number" min="24" max="64" value="' + (t.lebar || 32) + '" style="width:56px;border:0;background:transparent"> kolom</label><button class="btn btn-ghost btn-sm" id="seMenu">' + ic('ellipsis-vertical', 'sm') + '</button></div></div>' +
      '<textarea class="code-edit mt" id="seIsi" spellcheck="false" wrap="off">' + esc(t.isi || '') + '</textarea>' +
      '<div class="row gap-s mt" style="flex-wrap:wrap"><input class="input grow" id="seCat" maxlength="100" placeholder="Catatan perubahan (opsional)"><button class="btn btn-primary" id="seSimpan">' + ic('save', 'sm') + 'Simpan Model</button></div>' +
      '<details class="mt"><summary style="cursor:pointer;font-weight:600">' + ic('circle-help', 'sm') + ' Panduan perintah baris</summary><div class="grid-2 mt-s" style="font-size:12.5px">' +
      [['[C] [R] [L]', 'Rata tengah / kanan / kiri'], ['[B]', 'Tebal'], ['[2]', 'Huruf besar 2× (setengah lebar)'], ['[H]', 'Tinggi 2×'], ['[LR]kiri||kanan', 'Kiri & kanan satu baris'], ['[-] / [=]', 'Garis pemisah'], ['[QR]', 'QR verifikasi (isi opsional)'], ['[LOGO]', 'Logo struk'], ['[BOX]', 'Kotak status'], ['[FEED] / [CUT]', 'Baris kosong / potong kertas'], ['{{#ITEM}} … {{/ITEM}}', 'Ulang per item belanja'], ['{{?TEMPO}} … {{/TEMPO}}', 'Tampil hanya bila ada nilainya'], ['{{TOTAL|rp}}', 'Pengubah: rp, angka, kapital, judul, terbilang, potong:20, bawaan:-, awal:, akhir:'], ['// komentar', 'Baris diabaikan']].map(function (x) { return '<div><code class="mono" style="color:var(--teal);font-weight:700">' + esc(x[0]) + '</code><div class="muted">' + esc(x[1]) + '</div></div>'; }).join('') + '</div></details></div>' +
      '<div><div class="card card-pad"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><h3 class="card-title">Pratinjau Langsung</h3><div class="seg" id="seCth"><button class="on" data-c="lunas">Lunas</button><button data-c="tempo">Tempo</button><button data-c="batal">Batal</button></div></div>' +
      '<div class="row gap-s mt-s" style="flex-wrap:wrap"><label class="check"><input type="checkbox" id="seQr" checked> QR</label><label class="check"><input type="checkbox" id="seLogo" checked> Logo</label><label class="check"><input type="checkbox" id="seRingkas"> Header ringkas</label><span class="muted grow" style="text-align:right;font-size:12px" id="sePanjang"></span></div>' +
      '<div id="sePrev" class="mt" style="display:flex;justify-content:center;background:var(--cream);border-radius:14px;padding:18px;max-height:56vh;overflow:auto"></div><div class="row gap-s mt"><button class="btn btn-outline btn-sm" id="seCetak">' + ic('printer', 'sm') + 'Uji cetak</button><button class="btn btn-ghost btn-sm" id="seTeks">' + ic('copy', 'sm') + 'Salin teks</button></div></div>' +
      '<div class="card card-pad mt"><h3 class="card-title">Kamus Penanda</h3><div class="muted mb-s" style="font-size:12px">Klik untuk menyisipkan di posisi kursor</div><input class="input soft mb-s" id="seKmCari" placeholder="Cari penanda…"><div class="kamus" id="seKamus">' +
      km.kunci.map(function (k) { return '<button type="button" data-ins="{{' + esc(k.kunci) + '}}"><code>{{' + esc(k.kunci) + '}}</code><span class="grow">' + esc(k.ket) + '</span><span class="muted">' + esc(k.contoh) + '</span></button>'; }).join('') +
      Object.keys(km.blok || {}).map(function (b) { return '<button type="button" data-ins="{{#' + b + '}}\n[LR]{{' + b + '.NAMA}} {{' + b + '.QTY}}{{' + b + '.SATUAN}}||{{' + b + '.SUB|angka}}\n{{/' + b + '}}"><code>{{#' + esc(b) + '}}</code><span class="grow">Blok berulang</span></button>' + Object.keys(km.blok[b]).map(function (s) { return '<button type="button" data-ins="{{' + b + '.' + s + '}}"><code>{{' + esc(b + '.' + s) + '}}</code><span class="grow">' + esc(km.blok[b][s]) + '</span></button>'; }).join(''); }).join('') + '</div></div></div></div>';
    var isi = box.querySelector('#seIsi'), contoh = 'lunas', ubah = false;
    var data = function () { var o = JSON.parse(JSON.stringify(self.CONTOH[contoh])); o.tanggal = hariIni(); if (o.piutangId) o.jatuhTempo = tglTambah(hariIni(), 7); o.petugas = AppState.user.nama; return o; };
    var render = function () {
      var kolom = Math.max(24, Math.min(64, +box.querySelector('#seLebar').value || 32)), logo = App.gambar('strukLogo') || App.gambar('logo');
      var d = Struk.dataDari(data(), { headerRingkas: box.querySelector('#seRingkas').checked, rincianTimbang: true });
      var h; try { h = { lines: Struk.render(isi.value, d, kolom, { qr: box.querySelector('#seQr').checked, logo: box.querySelector('#seLogo').checked, logoUrl: logo }), kolom: kolom, logo: logo }; }
      catch (e) { box.querySelector('#sePrev').innerHTML = '<div class="note-coral">' + ic('circle-alert', 'sm') + '<span>Galat template: ' + esc(e.message) + '</span></div>'; return; }
      box.querySelector('#sePrev').innerHTML = Struk.html(h); box.querySelector('#sePanjang').textContent = kolom + ' kolom • ±' + Struk.panjangCm(h) + ' cm kertas';
      box.__hasil = h;
    };
    isi.addEventListener('input', debounce(function () { ubah = true; render(); }, 150));
    isi.addEventListener('keydown', function (e) { if (e.key === 'Tab') { e.preventDefault(); var s = isi.selectionStart; isi.value = isi.value.slice(0, s) + '  ' + isi.value.slice(isi.selectionEnd); isi.selectionStart = isi.selectionEnd = s + 2; } if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); box.querySelector('#seSimpan').click(); } });
    ['#seLebar', '#seQr', '#seLogo', '#seRingkas'].forEach(function (s) { box.querySelector(s).addEventListener('input', render); box.querySelector(s).addEventListener('change', render); });
    box.querySelector('#seCth').onclick = function (e) { var b = e.target.closest('[data-c]'); if (!b) return; contoh = b.dataset.c; box.querySelectorAll('#seCth button').forEach(function (x) { x.classList.toggle('on', x === b); }); render(); };
    box.querySelector('#seKamus').onclick = function (e) { var b = e.target.closest('[data-ins]'); if (!b) return; var s = isi.selectionStart, v = b.dataset.ins; isi.value = isi.value.slice(0, s) + v + isi.value.slice(isi.selectionEnd); isi.focus(); isi.selectionStart = isi.selectionEnd = s + v.length; ubah = true; render(); };
    box.querySelector('#seKmCari').oninput = function (e) { var q = e.target.value.toLowerCase(); box.querySelectorAll('#seKamus button').forEach(function (b) { b.hidden = q && b.textContent.toLowerCase().indexOf(q) < 0; }); };
    box.querySelector('#seList').onclick = function (e) { var b = e.target.closest('[data-k]'); if (!b) return; var pindah = function () { self.renderStrukList(box, b.dataset.k); }; if (ubah) konfirmasi('Buang perubahan?', 'Perubahan pada model ini belum disimpan.', { ok: 'Buang & pindah' }).then(function (ok) { if (ok) pindah(); }); else pindah(); };
    box.querySelector('#seSimpan').onclick = function () {
      var b = this; setBusy(b, true, 'Menyimpan…');
      api('doc.templateSave', { kode: t.kode, isi: isi.value, lebar: +box.querySelector('#seLebar').value, catatan: box.querySelector('#seCat').value.trim() }).then(function (r) {
        setBusy(b, false); if (!toastRes(r, 'Model struk tersimpan')) return; ubah = false;
        self.tpl = self.tpl.map(function (x) { return x.kode === t.kode ? r.data : x; }); t = r.data;
        App.segarkanBoot(true).then(function () { toast('Diterapkan', 'Kasir memakai model baru pada cetak berikutnya.'); });
      });
    };
    box.querySelector('#seCetak').onclick = function () { if (box.__hasil) Struk.cetakBrowser(box.__hasil, 1); };
    box.querySelector('#seTeks').onclick = function () { if (box.__hasil) salinTeks(Struk.teks(box.__hasil)).then(function () { toast('Teks struk disalin'); }); };
    box.querySelector('#seMenu').onclick = function () {
      var btn = this, segar = function (r) { if (toastRes(r)) self.muatTemplate(true).then(function () { App.segarkanBoot(true); self.renderStrukList(box, (r.data && r.data.kode) || t.kode); }); };
      var items = [{ label: 'Riwayat versi', ikon: 'history', fn: function () { self.riwayatVersi(t, box, function (x) { self.muatTemplate(true).then(function () { App.segarkanBoot(true); self.renderStrukList(box, x.kode); }); }); } },
        { label: 'Duplikat jadi model baru', ikon: 'copy', fn: function () { api('doc.templateDuplikat', { kode: t.kode, nama: t.nama + ' (variasi)' }).then(segar); } },
        { label: 'Pakai sebagai model ' + ((t.lebar || 32) > 40 ? '80 mm' : '58 mm'), ikon: 'printer', fn: function () { var p = Struk.pengaturan(); var k = (t.lebar || 32) > 40 ? 'template80' : 'template58'; var cfg = {}; ['lebar', 'hemat', 'headerRingkas', 'logo', 'qr', 'rincianTimbang', 'salinan', 'beep', 'autoCut', 'density', 'template58', 'template80', 'templateHemat'].forEach(function (x) { cfg[x] = p[x]; }); cfg[k] = t.kode; api('settings.save', { nilai: { PRINTER: cfg } }).then(function (r) { if (toastRes(r, 'Model dipakai kasir')) { AppState.cfg = r.data.cfg; self.renderStrukList(box, t.kode); } }); } },
        { label: 'Pakai sebagai model ultra hemat', ikon: 'leaf', fn: function () { var p = Struk.pengaturan(), cfg = Object.assign({}, (AppState.cfg || {}).printer || {}, { templateHemat: t.kode }); api('settings.save', { nilai: { PRINTER: cfg } }).then(function (r) { if (toastRes(r, 'Model hemat diperbarui')) { AppState.cfg = r.data.cfg; self.renderStrukList(box, t.kode); } }); } },
        { label: 'Unduh .txt', ikon: 'download', fn: function () { unduhTeks(t.kode + '.txt', isi.value); } },
        { label: 'Unggah .txt', ikon: 'upload', fn: function () { pilihFile('.txt,text/plain').then(function (f) { if (f) f.text().then(function (s) { isi.value = s; ubah = true; render(); toast('Isi dimuat', 'Klik Simpan Model untuk menerapkan.'); }); }); } },
        { label: t.aktif ? 'Nonaktifkan' : 'Aktifkan', ikon: t.aktif ? 'eye-off' : 'eye', fn: function () { api('doc.templateSave', { kode: t.kode, aktif: !t.aktif }).then(segar); } }];
      if (t.standar) items.push('-', { label: 'Reset ke bawaan', ikon: 'rotate-ccw', bahaya: true, fn: function () { konfirmasi('Reset model ' + esc(t.nama) + '?', 'Isi kembali ke bawaan aplikasi (versi sekarang tersimpan di riwayat).', { bahaya: true, ok: 'Reset' }).then(function (ok) { if (ok) api('doc.templateReset', { kode: t.kode }).then(segar); }); } });
      else items.push('-', { label: 'Hapus model', ikon: 'trash-2', bahaya: true, fn: function () { konfirmasi('Hapus ' + esc(t.nama) + '?', 'Nonaktifkan dulu sebelum menghapus.', { bahaya: true, ok: 'Hapus' }).then(function (ok) { if (ok) api('doc.templateHapus', { kode: t.kode }).then(function (r) { if (toastRes(r)) self.muatTemplate(true).then(function () { App.segarkanBoot(true); self.renderStrukList(box); }); }); }); } });
      popMenu(btn, items);
    };
    render();
  },

  /* ---------- arsip dokumen terbit ---------- */
  aSt: { cari: '', status: '', kode: '' },
  p_arsip: function (box) {
    var self = this, st = this.aSt;
    box.innerHTML = '<div class="card mt"><div class="filter-bar"><div class="searchbox grow" style="max-width:320px">' + ic('search') + '<input class="input soft" id="arCari" placeholder="Cari nomor, judul, referensi…"></div><label class="filter-pill"><select id="arStatus"><option value="">Semua status</option><option value="TERBIT">Terbit</option><option value="DITARIK">Ditarik</option></select></label><label class="filter-pill"><select id="arKode"><option value="">Semua template</option></select></label></div></div>' +
      '<div class="card" style="margin-top:var(--gut);overflow:hidden"><div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>Dokumen</th><th class="hide-m">Template</th><th class="hide-m">Diterbitkan</th><th class="c">Status</th><th></th></tr></thead><tbody id="arBody">' + skeletonRows(6, 5) + '</tbody></table></div></div>';
    box.querySelector('#arCari').oninput = debounce(function (e) { st.cari = e.target.value.trim(); self.r_arsip(box); }, 350);
    box.querySelector('#arStatus').onchange = function (e) { st.status = e.target.value; self.r_arsip(box); };
    box.querySelector('#arKode').onchange = function (e) { st.kode = e.target.value; self.r_arsip(box); };
    this.muatTemplate().then(function () { box.querySelector('#arKode').innerHTML = '<option value="">Semua template</option>' + self.tpl.filter(function (t) { return t.engine !== 'struk'; }).map(function (t) { return '<option value="' + esc(t.kode) + '">' + esc(t.nama) + '</option>'; }).join(''); }, function () { });
    box.querySelector('#arBody').addEventListener('click', function (e) {
      var tr = e.target.closest('[data-tarik]'), sv = e.target.closest('[data-ver]');
      if (sv) salinTeks(sv.dataset.ver).then(function () { toast('Tautan verifikasi disalin'); });
      if (tr) konfirmasi('Tarik dokumen ' + esc(tr.dataset.nomor) + '?', 'Halaman verifikasi akan menampilkan status DITARIK. Berkas tetap tersimpan di arsip.', { bahaya: true, ok: 'Tarik Dokumen', alasan: 'Alasan penarikan' }).then(function (al) {
        if (al) api('doc.tarik', { id: tr.dataset.tarik, alasan: al }).then(function (r) { if (toastRes(r)) self.r_arsip(box); });
      });
    });
    this.r_arsip(box);
  },
  r_arsip: function (box) {
    var st = this.aSt;
    api('doc.list', { cari: st.cari, status: st.status, kode: st.kode }).then(function (r) {
      var body = box.querySelector('#arBody'); if (!body) return;
      if (!r.success) { body.innerHTML = '<tr><td colspan="5">' + retryBox(r) + '</td></tr>'; return; }
      body.innerHTML = r.data.length ? r.data.map(function (x) {
        var ditarik = x.status !== 'TERBIT';
        return '<tr class="' + (ditarik ? 'dim' : '') + '"><td class="full-m"><b>' + esc(x.judul) + '</b><div class="sub mono">' + esc(x.nomor) + ' • ref ' + esc(x.ref) + '</div></td><td class="hide-m"><span class="cat-badge">' + esc(x.template) + '</span> <span class="muted">v' + esc(x.versi) + '</span></td><td class="hide-m">' + esc(waktuRelatif(x.dibuat)) + '<div class="sub">' + esc(x.oleh || '') + '</div></td>' +
          '<td class="c"><span class="badge ' + (ditarik ? 'b-batal' : 'b-lunas') + '">' + esc(x.status) + '</span>' + (ditarik && x.alasan ? '<div class="sub" style="max-width:180px;white-space:normal">' + esc(x.alasan) + '</div>' : '') + '</td>' +
          '<td class="r nowrap">' + (x.pdf ? '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(x.pdf) + '">' + ic('file-text', 'sm') + 'PDF</a>' : '') + (x.verifikasi ? '<button class="btn btn-ghost btn-icon btn-sm" data-ver="' + esc(x.verifikasi) + '" title="Salin tautan verifikasi">' + ic('shield-check', 'sm') + '</button>' : '') + (ditarik ? '' : '<button class="btn btn-ghost btn-icon btn-sm" data-tarik="' + esc(x.id) + '" data-nomor="' + esc(x.nomor) + '" title="Tarik">' + ic('ban', 'sm') + '</button>') + '</td></tr>';
      }).join('') : '<tr><td colspan="5">' + emptyState('archive', 'Belum ada dokumen terbit', 'Dokumen PDF yang diterbitkan dari menu mana pun tercatat di sini lengkap dengan sidik SHA-256.') + '</td></tr>';
    });
  },

  /* ---------- variabel global & kamus ---------- */
  p_variabel: function (box) {
    var self = this;
    box.innerHTML = '<div class="skel mt" style="height:260px"></div>';
    this.muatTemplate(true).then(function () {
      var v = (self.variabel || []).slice();
      box.innerHTML = '<div class="split" style="margin-top:var(--gut);align-items:start"><div class="card card-pad"><h3 class="card-title">Variabel Global</h3><p class="muted" style="font-size:12.5px">Teks yang sering dipakai di semua template, mis. <code>{{VAR.SYARAT_RETUR}}</code> atau <code>{{VAR.NAMA_BANK}}</code>. Ubah sekali, semua dokumen ikut berubah.</p><div id="vrList"></div><button class="btn btn-soft btn-sm mt" id="vrAdd">' + ic('plus', 'sm') + 'Tambah variabel</button>' +
        '<div class="row mt" style="justify-content:flex-end"><button class="btn btn-primary" id="vrOk">' + ic('save', 'sm') + 'Simpan Variabel</button></div></div>' +
        '<div class="card card-pad"><h3 class="card-title">Kamus Penanda per Dokumen</h3><select class="select mt-s" id="kmJenis">' + Object.keys(self.konteks).map(function (j) { return '<option value="' + j + '">' + esc(self.konteks[j].label) + '</option>'; }).join('') + '</select><div class="kamus mt" id="kmIsi" style="max-height:480px"></div></div></div>';
      var render = function () {
        box.querySelector('#vrList').innerHTML = v.length ? v.map(function (x, i) { return '<div class="row gap-s mb-s" data-i="' + i + '"><input class="input mono" data-f="kunci" value="' + esc(x.kunci) + '" placeholder="NAMA_BANK" style="max-width:170px;text-transform:uppercase"><input class="input grow" data-f="nilai" value="' + esc(x.nilai) + '" placeholder="Isi teks"><button class="btn btn-ghost btn-icon" data-del="' + i + '">' + ic('x', 'sm') + '</button></div>'; }).join('') : '<p class="muted">Belum ada variabel.</p>';
      };
      render();
      box.querySelector('#vrList').addEventListener('input', function (e) { var r = e.target.closest('[data-i]'); if (r) v[+r.dataset.i][e.target.dataset.f] = e.target.value; });
      box.querySelector('#vrList').addEventListener('click', function (e) { var d = e.target.closest('[data-del]'); if (d) { v.splice(+d.dataset.del, 1); render(); } });
      box.querySelector('#vrAdd').onclick = function () { v.push({ kunci: '', nilai: '', ket: '' }); render(); };
      box.querySelector('#vrOk').onclick = function () {
        var b = this, kode = (self.tpl.filter(function (t) { return t.engine !== 'struk'; })[0] || self.tpl[0] || {}).kode; if (!kode) return toast('Belum ada template', '', 'warn');
        setBusy(b, true); api('doc.templateSave', { kode: kode, variabel: v }).then(function (r) { setBusy(b, false); if (toastRes(r, 'Variabel tersimpan')) self.muatTemplate(true); });
      };
      var km = function () {
        var j = box.querySelector('#kmJenis').value, k = self.konteks[j] || { kunci: [], blok: {} };
        box.querySelector('#kmIsi').innerHTML = k.kunci.map(function (x) { return '<button type="button" data-c="{{' + esc(x.kunci) + '}}"><code>{{' + esc(x.kunci) + '}}</code><span class="grow">' + esc(x.ket) + '</span><span class="muted">' + esc(x.contoh) + '</span></button>'; }).join('') +
          Object.keys(k.blok || {}).map(function (b) { return '<button type="button" data-c="{{#' + b + '}}"><code>{{#' + esc(b) + '}} … {{/' + esc(b) + '}}</code><span class="grow">Baris tabel berulang</span></button>' + Object.keys(k.blok[b]).map(function (s) { return '<button type="button" data-c="{{' + b + '.' + s + '}}"><code>{{' + esc(b + '.' + s) + '}}</code><span class="grow">' + esc(k.blok[b][s]) + '</span></button>'; }).join(''); }).join('') +
          '<button type="button" data-c="{{LOGO}}"><code>{{LOGO}}</code><span class="grow">Logo (gambar)</span></button><button type="button" data-c="{{QR}}"><code>{{QR}}</code><span class="grow">QR verifikasi (gambar)</span></button><button type="button" data-c="{{TTD_1}}"><code>{{TTD_1}} {{NAMA_PEJABAT_1}} {{JABATAN_1}}</code><span class="grow">Slot tanda tangan</span></button>';
      };
      box.querySelector('#kmJenis').onchange = km; km();
      box.querySelector('#kmIsi').onclick = function (e) { var b = e.target.closest('[data-c]'); if (b) salinTeks(b.dataset.c).then(function () { toast('Disalin', b.dataset.c + ' — tempel di Google Docs/Sheets.'); }); };
    }, function (r) { box.innerHTML = '<div class="card mt">' + retryBox(r) + '</div>'; });
  }
};
registerPage('dokumen', { auth: 'owner', judul: 'Dokumen & Struk', template: function () { return Dokumen.template(); }, init: function (el) { Dokumen.init(el); }, show: function (el, p) { Dokumen.show(el, p); } });
