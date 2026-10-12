/* ==========================================================================
   VIA SEAFOOD — pages-keuangan.js  (khusus Owner)
   Arus kas (penjualan lunas otomatis + pelunasan piutang + catatan manual),
   grafik masuk/keluar, kategori, laporan PDF; Piutang pelanggan: pembayaran
   cicilan/pelunasan, riwayat, pengingat WA/Email massal, kwitansi & tagihan.
   ========================================================================== */
'use strict';
var Keuangan = {
  st: { tab: 'kas', preset: 'bulan', dari: '', sampai: '', jenis: '', cari: '', kas: null, pStatus: 'aktif', pCari: '', piu: null, pilih: {} },
  template: function () {
    return '<div class="page-head"><div><div class="eyebrow">Buku Kas Owner <span class="dot"></span><span class="loc">Khusus Superadmin</span></div><h1 class="page-title">Keuangan &amp; Piutang</h1><p class="page-sub">Arus kas harian, pengeluaran operasional, dan tagihan pelanggan tempo</p></div>' +
      '<div class="page-actions" id="kuAksi"></div></div>' +
      '<div class="card" style="margin-bottom:var(--gut)">' + tabsHtml([{ id: 'kas', label: 'Arus Kas', ikon: 'wallet' }, { id: 'piutang', label: 'Piutang Pelanggan', ikon: 'clipboard-clock' }], 'kas') + '</div>' +
      '<div id="kasPanel"><div class="card" style="margin-bottom:var(--gut)"><div class="filter-bar"><div class="row gap-s" id="kasPreset" style="flex-wrap:wrap">' + chipSel([{ v: 'bulan', l: 'Bulan ini' }, { v: 'lalu', l: 'Bulan lalu' }, { v: '7', l: '7 hari' }, { v: '30', l: '30 hari' }, { v: 'tahun', l: 'Tahun ini' }], 'bulan') + '</div><span class="grow"></span>' +
      '<label class="filter-pill">' + ic('calendar', 'sm') + '<input type="date" id="kasDari"></label><span class="muted">s/d</span><label class="filter-pill">' + ic('calendar', 'sm') + '<input type="date" id="kasSampai"></label></div></div>' +
      '<div class="kpis" id="kasKpi"></div>' +
      '<div class="split-2-1" style="margin-top:var(--gut)"><div class="card"><div class="card-head"><div><h3 class="card-title">Pemasukan vs Pengeluaran</h3><div class="sub" id="kasGSub"></div></div></div><div class="legend"><span><i style="background:var(--teal)"></i>Pemasukan</span><span><i style="background:var(--coral)"></i>Pengeluaran</span></div><div class="chart-box" id="kasChart"></div></div>' +
      '<div class="card card-pad" id="kasKat"></div></div>' +
      '<div class="card" style="margin-top:var(--gut);overflow:hidden"><div class="filter-bar"><div class="seg" id="kasJenis"><button data-v="" class="on">Semua</button><button data-v="Pemasukan">Pemasukan</button><button data-v="Pengeluaran">Pengeluaran</button></div><div class="searchbox grow" style="max-width:300px">' + ic('search') + '<input class="input soft" id="kasCari" placeholder="Cari keterangan, kategori…"></div><span class="grow"></span><button class="btn filter-pill green" data-act="eksporKas">' + ic('sheet', 'sm') + 'Ekspor</button></div>' +
      '<div class="tbl-wrap"><table class="tbl cards" id="kasTbl"><thead><tr><th>Tanggal</th><th>Keterangan</th><th class="hide-m">Kategori</th><th class="r">Jumlah</th><th class="hide-m">Sumber</th><th></th></tr></thead><tbody>' + skeletonRows(6, 6) + '</tbody></table></div><div class="tbl-foot" id="kasFoot"></div></div></div>' +
      '<div id="piuPanel" hidden><div class="kpis" id="piuKpi"></div>' +
      '<div class="split-2-1" style="margin-top:var(--gut)"><div class="card" style="overflow:hidden"><div class="filter-bar"><div class="row gap-s" id="piuStatus" style="flex-wrap:wrap"></div></div>' +
      '<div class="filter-bar" style="padding-top:0"><div class="searchbox grow" style="max-width:320px">' + ic('search') + '<input class="input soft" id="piuCari" placeholder="Cari pelanggan / nota…"></div><span class="grow"></span><button class="btn btn-outline btn-sm" data-act="ingatkanPilih" id="piuIngat" disabled>' + ic('bell-ring', 'sm') + 'Kirim pengingat</button><button class="btn filter-pill green" data-act="eksporPiu">' + ic('sheet', 'sm') + 'Ekspor</button></div>' +
      '<div class="tbl-wrap"><table class="tbl cards" id="piuTbl"><thead><tr><th class="c" style="width:36px"><input type="checkbox" id="piuAll" aria-label="Pilih semua"></th><th>Nota &amp; Pelanggan</th><th class="hide-m">Jatuh Tempo</th><th class="r">Tagihan</th><th class="r">Sisa</th><th class="c">Status</th><th></th></tr></thead><tbody>' + skeletonRows(6, 7) + '</tbody></table></div><div class="tbl-foot" id="piuFoot"></div></div>' +
      '<div class="card"><div class="card-head"><div><h3 class="card-title">Piutang per Pelanggan</h3><div class="sub">Urut sisa terbesar</div></div><button class="btn btn-ghost btn-sm" data-act="tagihanMassal">' + ic('files', 'sm') + 'Tagihan massal</button></div><div id="piuPlg" style="padding:0 18px 18px"></div></div></div></div>';
  },
  init: function (el) {
    var self = this, st = this.st;
    this.aturRentang('bulan');
    pasangTabs(el.querySelector('.tabs'), function (t) { self.tab(el, t); if (location.hash !== '#/keuangan' + (t === 'piutang' ? '/piutang' : '')) history.replaceState(null, '', '#/keuangan' + (t === 'piutang' ? '/piutang' : '')); });
    el.querySelector('#kasPreset').onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; self.aturRentang(b.dataset.v); self.muatKas(el); };
    el.querySelector('#kasDari').onchange = el.querySelector('#kasSampai').onchange = function () { st.preset = ''; st.dari = el.querySelector('#kasDari').value; st.sampai = el.querySelector('#kasSampai').value; self.muatKas(el); };
    el.querySelector('#kasJenis').onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; st.jenis = b.dataset.v; el.querySelectorAll('#kasJenis button').forEach(function (x) { x.classList.toggle('on', x === b); }); self.renderTabelKas(el); };
    el.querySelector('#kasCari').oninput = debounce(function (e) { st.cari = e.target.value.trim().toLowerCase(); self.renderTabelKas(el); }, 200);
    el.querySelector('#piuCari').oninput = debounce(function (e) { st.pCari = e.target.value.trim().toLowerCase(); self.renderPiu(el); }, 200);
    el.querySelector('#piuStatus').onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; st.pStatus = b.dataset.v; st.pilih = {}; self.muatPiu(el); };
    el.querySelector('#piuAll').onchange = function (e) { (st.pRows || []).forEach(function (r) { if (r.sisa > 0) { if (e.target.checked) st.pilih[r.id] = true; else delete st.pilih[r.id]; } }); self.renderPiu(el); };
    bindActs(el, {
      masuk: function () { self.formKas(null, 'Pemasukan'); }, keluar: function () { self.formKas(null, 'Pengeluaran'); },
      laporan: function (b) { Dokumen.cetak('LAPORAN_KEUANGAN', st.dari + '_' + st.sampai, b); },
      eksporKas: function () { self.eksporKas(); }, eksporPiu: function () { self.eksporPiu(); },
      ingatkanPilih: function (b) { self.ingatkan(Object.keys(st.pilih), b); },
      tagihanMassal: function () { Dokumen.massal('TAGIHAN'); },
      muat: function () { if (st.tab === 'kas') self.muatKas(el, true); else self.muatPiu(el, true); }
    });
    el.querySelector('#kasTbl').addEventListener('click', function (e) { var b = e.target.closest('[data-kas]'); if (!b) return; var r = (st.kas.rows || []).filter(function (x) { return x.id === b.dataset.kas; })[0]; if (r) self.menuKas(b, r); });
    el.querySelector('#piuTbl').addEventListener('click', function (e) {
      var cb = e.target.closest('input[data-pilih]'); if (cb) { if (cb.checked) st.pilih[cb.dataset.pilih] = true; else delete st.pilih[cb.dataset.pilih]; self.tombolIngat(el); return; }
      var tr = e.target.closest('tr[data-id]'); if (!tr) return; var r = (st.piu.rows || []).filter(function (x) { return x.id === tr.dataset.id; })[0]; if (!r) return;
      if (e.target.closest('[data-bayar]')) { e.stopPropagation(); return self.bayar(r, function () { self.muatPiu(el, true); }); }
      if (e.target.closest('[data-menu]')) { e.stopPropagation(); return self.menuPiu(e.target.closest('[data-menu]'), r, el); }
      self.riwayat(r, el);
    });
    el.querySelector('#piuPlg').addEventListener('click', function (e) { var a = e.target.closest('[data-tg]'); if (a) { e.stopPropagation(); Dokumen.cetak('TAGIHAN', a.dataset.tg, a); return; } var p = e.target.closest('[data-plg]'); if (p) Pelanggan.detail(p.dataset.plg); });
  },
  show: function (el, param) { this.tab(el, param === 'piutang' ? 'piutang' : 'kas'); },
  tick: function (el) { if (this.st.tab === 'kas') this.muatKas(el); else this.muatPiu(el); },
  tab: function (el, t) {
    this.st.tab = t;
    el.querySelectorAll('.tabs [data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    el.querySelector('#kasPanel').hidden = t !== 'kas'; el.querySelector('#piuPanel').hidden = t !== 'piutang';
    el.querySelector('#kuAksi').innerHTML = t === 'kas' ? '<button class="btn btn-outline" data-act="laporan">' + ic('file-text', 'sm') + 'Laporan PDF</button><button class="btn btn-outline" data-act="keluar">' + ic('circle-minus', 'sm') + 'Pengeluaran</button><button class="btn btn-accent btn-lg" data-act="masuk">' + ic('plus') + 'Pemasukan</button>'
      : '<button class="btn btn-outline" data-act="tagihanMassal">' + ic('files', 'sm') + 'Tagihan Massal PDF</button><button class="btn btn-accent btn-lg" data-act="ingatkanPilih" id="piuIngat2">' + ic('bell-ring') + 'Ingatkan Jatuh Tempo</button>';
    if (t === 'kas') this.muatKas(el); else this.muatPiu(el);
  },

  /* ---------- arus kas ---------- */
  aturRentang: function (p) {
    var st = this.st, h = hariIni(); st.preset = p;
    if (p === 'bulan') { st.dari = h.slice(0, 8) + '01'; st.sampai = h; }
    else if (p === 'lalu') { var pl = periodeGeser(h.slice(0, 7), -1); st.dari = pl + '-01'; st.sampai = tglTambah(periodeGeser(pl, 1) + '-01', -1); }
    else if (p === '7') { st.dari = tglTambah(h, -6); st.sampai = h; }
    else if (p === '30') { st.dari = tglTambah(h, -29); st.sampai = h; }
    else if (p === 'tahun') { st.dari = h.slice(0, 4) + '-01-01'; st.sampai = h; }
  },
  muatKas: function (el, paksa) {
    var st = this.st, self = this;
    el.querySelector('#kasDari').value = st.dari; el.querySelector('#kasSampai').value = st.sampai;
    el.querySelectorAll('#kasPreset [data-v]').forEach(function (b) { b.classList.toggle('on', b.dataset.v === st.preset); });
    var key = st.preset === 'bulan' ? 'kas:bulan' : 'kas:' + st.dari + '_' + st.sampai, dari = st.dari, sampai = st.sampai;
    return swr(key, 'kas.list', st.preset === 'bulan' ? {} : { dari: dari, sampai: sampai }, function (d) { if (st.preset !== 'bulan' && (d.dari !== dari || d.sampai !== sampai)) return; st.kas = d; self.renderKas(el); }, { fresh: 60000, force: paksa,
      onError: function (r) { el.querySelector('#kasTbl tbody').innerHTML = '<tr><td colspan="6">' + retryBox(r) + '</td></tr>'; } });
  },
  renderKas: function (el) {
    var d = this.st.kas; if (!d) return;
    var k = d.kpi, hari = tglSelisihHari(d.dari, d.sampai) + 1;
    el.querySelector('#kasKpi').innerHTML =
      kpiHtml('Total Pemasukan', rp(k.masuk), 'lunas ' + rpRingkas(k.penjualanLunas) + ' • pelunasan ' + rpRingkas(k.pelunasan), 'arrow-down-to-line', 'paid', '', 'money') +
      kpiHtml('Total Pengeluaran', rp(k.keluar), 'operasional & pembelian', 'arrow-up-from-line', 'coral', 'coral', 'money') +
      '<div class="card kpi dark"><div class="kpi-top"><div class="kpi-label">Saldo Bersih Periode</div></div><div class="kpi-val serif" style="font-size:28px;font-family:var(--serif)">' + rp(k.saldo) + '</div><div class="kpi-foot">' + (k.saldo >= 0 ? 'Surplus' : 'Defisit') + ' • ' + hari + ' hari</div></div>' +
      kpiHtml('Penjualan Tempo', rp(k.penjualanTempo), 'belum jadi kas • ' + k.nota + ' nota periode ini', 'clock-3', 'amber', '', 'money');
    el.querySelector('#kasGSub').textContent = tglSingkat(d.dari) + ' – ' + tglSingkat(d.sampai);
    var seri = d.seri;
    if (seri.length > 62) {  // ringkas per minggu bila rentang panjang
      var mg = []; seri.forEach(function (s, i) { if (i % 7 === 0) mg.push({ tanggal: s.tanggal, masuk: 0, keluar: 0 }); var m = mg[mg.length - 1]; m.masuk += s.masuk; m.keluar += s.keluar; }); seri = mg;
    }
    Grafik.render(el.querySelector('#kasChart'), { tipe: 'batang', labels: seri.map(function (s) { return +s.tanggal.slice(8, 10) + ' ' + BLN[+s.tanggal.slice(5, 7) - 1]; }), labelTip: seri.map(function (s) { return (d.seri.length > 62 ? 'Minggu mulai ' : '') + tglPanjang(s.tanggal); }),
      series: [{ nama: 'Pemasukan', data: seri.map(function (s) { return s.masuk; }), warna: '#0D4F4F' }, { nama: 'Pengeluaran', data: seri.map(function (s) { return s.keluar; }), warna: '#E8664A' }] });
    var katList = function (obj, warna, judul) {
      var ks = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }), tot = ks.reduce(function (s, x) { return s + obj[x]; }, 0) || 1;
      return '<div class="label-up mb-s">' + judul + '</div>' + (ks.length ? ks.map(function (x) { return '<div class="top-item mb-s"><div class="tr" style="font-size:13px"><span>' + esc(x) + '</span><span class="num">' + rpRingkas(obj[x]) + '</span></div><div class="progress ' + warna + '" style="height:6px;margin-top:4px"><i style="width:' + Math.max(3, obj[x] / tot * 100) + '%"></i></div></div>'; }).join('') : '<p class="muted" style="font-size:13px">Belum ada.</p>');
    };
    el.querySelector('#kasKat').innerHTML = '<h3 class="card-title mb">Komposisi Kategori</h3>' + katList(d.kategori.masuk, '', 'Pemasukan') + '<div class="mt">' + katList(d.kategori.keluar, 'coral', 'Pengeluaran') + '</div>';
    this.renderTabelKas(el);
  },
  renderTabelKas: function (el) {
    var st = this.st, d = st.kas; if (!d) return;
    var rows = d.rows.filter(function (r) { return (!st.jenis || r.jenis === st.jenis) && (!st.cari || (r.keterangan + ' ' + r.kategori + ' ' + (r.ref || '')).toLowerCase().indexOf(st.cari) > -1); });
    st.kasFiltered = rows;
    var tampil = rows.slice(0, 400);
    el.querySelector('#kasTbl tbody').innerHTML = tampil.length ? tampil.map(function (r) {
      var masuk = r.jenis === 'Pemasukan';
      return '<tr><td class="nowrap"><b>' + tglSingkat(r.tanggal) + '</b><div class="sub">' + esc(HARI[new Date(r.tanggal + 'T00:00:00').getDay()]) + '</div></td><td class="full-m"><div class="row gap-s"><span class="ic-box sm ' + (masuk ? 'paid' : 'coral') + '" style="width:30px;height:30px">' + ic(masuk ? 'arrow-down-to-line' : 'arrow-up-from-line', 'sm') + '</span><div><b>' + esc(r.keterangan || r.kategori) + '</b><div class="sub">' + esc(r.kategori) + (r.oleh ? ' • ' + esc(r.oleh) : '') + '</div></div></div></td>' +
        '<td class="hide-m"><span class="cat-badge ' + (masuk ? '' : 'coral') + '">' + esc(r.kategori) + '</span></td><td class="r"><span class="total ' + (masuk ? '' : 'coral') + '">' + (masuk ? '+' : '−') + rp(r.jumlah).replace('Rp ', 'Rp ') + '</span></td>' +
        '<td class="hide-m"><span class="badge ' + (r.sumber === 'Manual' ? 'b-amber' : 'b-info') + '">' + esc(r.sumber) + '</span></td><td class="r">' + (r.sumber === 'Manual' ? '<button class="btn btn-ghost btn-icon btn-sm" data-kas="' + esc(r.id) + '" aria-label="Aksi">' + ic('ellipsis-vertical', 'sm') + '</button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="6">' + emptyState('wallet', 'Belum ada arus kas', 'Penjualan lunas tercatat otomatis dari pesanan. Catat pengeluaran (es batu, BBM, gaji) dengan tombol <b>Pengeluaran</b>.') + '</td></tr>';
    var m = rows.reduce(function (s, r) { return s + (r.jenis === 'Pemasukan' ? r.jumlah : 0); }, 0), k = rows.reduce(function (s, r) { return s + (r.jenis === 'Pengeluaran' ? r.jumlah : 0); }, 0);
    el.querySelector('#kasFoot').innerHTML = '<span><b>' + rows.length + '</b> catatan' + (rows.length > 400 ? ' (400 ditampilkan — ekspor untuk semua)' : '') + '</span><span>Masuk <b class="text-paid">' + rp(m) + '</b> • Keluar <b class="text-coral">' + rp(k) + '</b></span>';
  },
  menuKas: function (btn, r) {
    var self = this;
    popMenu(btn, [{ label: 'Ubah catatan', ikon: 'pencil', fn: function () { self.formKas(r); } }, '-', { label: 'Hapus catatan', ikon: 'trash-2', bahaya: true, fn: function () {
      konfirmasi('Hapus catatan ' + esc(r.kategori) + ' ' + rp(r.jumlah) + '?', 'Catatan ditandai terhapus (tetap ada jejak di log audit).', { bahaya: true, ok: 'Hapus', alasan: 'Alasan penghapusan', minAlasan: 3 }).then(function (al) {
        if (!al) return; api('kas.hapus', { id: r.id, alasan: al }).then(function (x) { if (toastRes(x)) self.segarkanKas(); });
      });
    } }]);
  },
  formKas: function (r, jenis) {
    var c = AppState.cfg || {}, baru = !r, self = this;
    jenis = r ? r.jenis : jenis;
    var kat = jenis === 'Pemasukan' ? (c.kasMasuk || ['Lain-lain']) : (c.kasKeluar || ['Lain-lain']);
    var m = modal({ judul: (baru ? 'Catat ' : 'Ubah ') + jenis, ikon: jenis === 'Pemasukan' ? 'arrow-down-to-line' : 'arrow-up-from-line', ikonKelas: jenis === 'Pemasukan' ? 'paid' : 'coral', lebar: 'mid',
      sub: jenis === 'Pemasukan' ? 'Penjualan & pelunasan piutang sudah tercatat otomatis — gunakan ini untuk pemasukan lain (modal, pinjaman…).' : 'Biaya operasional harian: es batu, BBM, gaji, sewa lapak, dsb.',
      isi: '<form id="kf"><div class="grid-2">' + fld('Jumlah', rpInp('jumlah', r ? r.jumlah : '', 'autofocus required'), { req: true, cls: 'span-2' }) +
        fld('Kategori', inp('kategori', r ? r.kategori : kat[0], 'list="kfKat" maxlength="40"') + '<datalist id="kfKat">' + kat.map(function (k) { return '<option value="' + esc(k) + '">'; }).join('') + '</datalist>') +
        fld('Tanggal', '<input class="input" type="date" name="tanggal" max="' + hariIni() + '" value="' + (r ? r.tanggal : hariIni()) + '">') +
        fld('Keterangan', txa('keterangan', r ? r.keterangan : '', 'maxlength="300" placeholder="mis. 20 balok es untuk kapal pagi" style="min-height:64px"'), { cls: 'span-2' }) +
        '<div class="span-2 row gap-s" style="flex-wrap:wrap" id="kfChips">' + kat.map(function (k) { return '<button type="button" class="chip chip-s" data-k="' + esc(k) + '">' + esc(k) + '</button>'; }).join('') + '</div></div></form>',
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn ' + (jenis === 'Pemasukan' ? 'btn-primary' : 'btn-danger') + '" id="kfOk">' + ic('save', 'sm') + 'Simpan</button>' });
    m.$('#kfChips').onclick = function (e) { var b = e.target.closest('[data-k]'); if (b) m.$('#f_kategori').value = b.dataset.k; };
    m.$('#kfOk').onclick = function () {
      var f = formData(m.$('#kf')), b = m.$('#kfOk'), jml = parseRp(f.jumlah);
      if (!(jml > 0)) { m.$('#f_jumlah').parentNode.classList.add('is-err'); return toast('Jumlah wajib diisi', '', 'err'); }
      setBusy(b, true);
      api('kas.save', { id: r ? r.id : '', jenis: jenis, jumlah: jml, kategori: f.kategori, tanggal: f.tanggal, keterangan: f.keterangan }).then(function (x) { setBusy(b, false); if (toastRes(x)) { m.close(); self.segarkanKas(); } });
    };
  },
  segarkanKas: function () { swrStale('kas:'); swrStale('dashboard'); var c = halamanAktif(); if (c && c.name === 'keuangan') this.muatKas(c.el, true); },
  eksporKas: function () {
    var rows = this.st.kasFiltered || []; if (!rows.length) return toast('Tidak ada data', '', 'warn');
    eksporXLSX('Arus Kas ' + this.st.dari + ' sd ' + this.st.sampai + '.xlsx', [{ nama: 'Arus Kas', kolom: ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Jumlah', 'Sumber', 'Ref', 'Dicatat oleh'], rows: rows.map(function (r) { return [r.tanggal, r.jenis, r.kategori, r.keterangan, r.jenis === 'Pemasukan' ? r.jumlah : -r.jumlah, r.sumber, r.ref || '', r.oleh || '']; }) }]);
  },

  /* ---------- piutang ---------- */
  muatPiu: function (el, paksa) {
    var st = this.st, self = this, status = st.pStatus;
    return swr('piutang:' + status, 'piutang.list', { status: status }, function (d) { if (st.pStatus !== status) return; st.piu = d; self.renderPiu(el); }, { fresh: 30000, force: paksa,
      onError: function (r) { el.querySelector('#piuTbl tbody').innerHTML = '<tr><td colspan="7">' + retryBox(r) + '</td></tr>'; } });
  },
  renderPiu: function (el) {
    var st = this.st, d = st.piu; if (!d) return;
    var k = d.kpi;
    el.querySelector('#piuKpi').innerHTML =
      '<div class="card kpi tint-coral"><div class="kpi-top"><div class="kpi-label coral">Total Piutang Outstanding</div><span class="ic-box coral">' + ic('clipboard-clock') + '</span></div><div class="kpi-val coral money">' + rp(k.outstanding) + '</div><div class="kpi-foot">' + k.nOutstanding + ' nota belum lunas</div></div>' +
      kpiHtml('Jatuh Tempo ≤ 2 Hari', rp(k.tempo), k.nTempo + ' tagihan perlu diingatkan', 'bell-ring', 'amber', '', 'money') +
      kpiHtml('Lewat Jatuh Tempo', rp(k.lewat), k.nLewat + ' tagihan terlambat', 'triangle-alert', 'coral', k.nLewat ? 'coral' : '', 'money') +
      kpiHtml('Diterima Bulan Ini', rp(k.lunasBulan), k.nLunasBulan + ' pembayaran masuk kas', 'badge-check', 'paid', '', 'money');
    el.querySelector('#piuStatus').innerHTML = chipSel([{ v: 'aktif', l: 'Belum lunas', n: k.nOutstanding }, { v: 'tempo', l: 'Jatuh tempo ≤2 hari', n: k.nTempo }, { v: 'lewat', l: 'Lewat tempo', n: k.nLewat }, { v: 'Lunas Sebagian', l: 'Dicicil' }, { v: 'Lunas', l: 'Lunas' }, { v: 'semua', l: 'Semua' }], st.pStatus);
    var rows = d.rows.filter(function (r) { return !st.pCari || (r.pelanggan + ' ' + r.pesananId + ' ' + r.id).toLowerCase().indexOf(st.pCari) > -1; });
    st.pRows = rows;
    el.querySelector('#piuTbl tbody').innerHTML = rows.length ? rows.map(function (r) {
      var aktif = r.sisa > 0 && r.status !== 'Batal' && r.status !== 'Lunas';
      var jt = !r.jatuhTempo ? '-' : r.telatHari > 0 ? '<span class="text-coral" style="font-weight:700">' + tglSingkat(r.jatuhTempo) + '</span><div class="sub text-coral">lewat ' + r.telatHari + ' hari</div>' : r.tempoHari === 0 && aktif ? '<span class="text-amber" style="font-weight:700">Hari ini</span>' : tglSingkat(r.jatuhTempo) + (aktif ? '<div class="sub">' + r.tempoHari + ' hari lagi</div>' : '');
      var pr = r.jumlah ? Math.round(r.terbayar / r.jumlah * 100) : 0;
      return '<tr class="click" data-id="' + esc(r.id) + '"><td class="c">' + (aktif ? '<input type="checkbox" data-pilih="' + esc(r.id) + '"' + (st.pilih[r.id] ? ' checked' : '') + ' aria-label="Pilih">' : '') + '</td>' +
        '<td class="full-m"><div class="cust"><span class="avatar ' + avatarKelas(r.pelanggan) + '">' + inisial(r.pelanggan) + '</span><div><b>' + esc(r.pelanggan) + '</b><div class="sub">#' + esc(r.pesananId) + ' • ' + tglSingkat(r.tanggal) + (r.pengingat ? ' • ' + ic('bell', 'sm') + ' ' + esc(String(r.pengingat).split('|').pop()) : '') + '</div></div></div></td>' +
        '<td class="hide-m">' + jt + '</td><td class="r num">' + rp(r.jumlah) + '<div class="progress" style="height:5px;margin-top:5px;min-width:80px"><i style="width:' + pr + '%"></i></div></td>' +
        '<td class="r"><span class="total ' + (r.sisa > 0 ? 'coral' : '') + '">' + rp(r.sisa) + '</span></td><td class="c">' + badgeStatus(r.status === 'Belum Lunas' ? 'Belum Lunas' : r.status) + '</td>' +
        '<td class="r nowrap">' + (aktif ? '<button class="btn btn-primary btn-sm" data-bayar="1">' + ic('banknote', 'sm') + 'Bayar</button> ' : '') + '<button class="btn btn-ghost btn-icon btn-sm" data-menu="1" aria-label="Aksi">' + ic('ellipsis-vertical', 'sm') + '</button></td></tr>';
    }).join('') : '<tr><td colspan="7">' + emptyState('badge-check', st.pStatus === 'aktif' ? 'Tidak ada piutang aktif' : 'Tidak ada data', st.pStatus === 'aktif' ? 'Semua pelanggan sudah lunas. 🎉' : 'Coba filter lain.') + '</td></tr>';
    var tot = rows.reduce(function (s, r) { return s + r.sisa; }, 0);
    el.querySelector('#piuFoot').innerHTML = '<span><b>' + rows.length + '</b> tagihan' + (d.total > d.rows.length ? ' (dari ' + d.total + ')' : '') + ' • sisa <b class="text-coral">' + rp(tot) + '</b></span><span class="muted" style="font-size:12px">Klik baris untuk riwayat pembayaran</span>';
    el.querySelector('#piuPlg').innerHTML = (d.perPelanggan || []).length ? d.perPelanggan.slice(0, 12).map(function (p) {
      return '<div class="log-item" data-plg="' + esc(p.id) + '" style="cursor:pointer;align-items:center"><span class="avatar ' + avatarKelas(p.nama) + '" style="width:34px;height:34px;font-size:12px">' + inisial(p.nama) + '</span><div class="grow"><b>' + esc(p.nama) + '</b><span>' + p.n + ' nota' + (p.telat > 0 ? ' • <span class="text-coral">lewat ' + p.telat + ' hari</span>' : '') + '</span></div><div class="r"><b class="text-coral num">' + rpRingkas(p.sisa) + '</b><div><button class="btn btn-ghost btn-xs" data-tg="' + esc(p.id) + '">' + ic('file-text', 'sm') + 'Tagihan</button></div></div></div>';
    }).join('') : '<p class="muted">Tidak ada piutang aktif.</p>';
    this.tombolIngat(el);
  },
  tombolIngat: function (el) {
    var n = Object.keys(this.st.pilih).length, b = el.querySelector('#piuIngat');
    b.disabled = !n; b.innerHTML = ic('bell-ring', 'sm') + 'Kirim pengingat' + (n ? ' (' + n + ')' : '');
    var b2 = el.querySelector('#piuIngat2'); if (b2) b2.innerHTML = ic('bell-ring') + (n ? 'Ingatkan ' + n + ' Terpilih' : 'Ingatkan Jatuh Tempo');
  },
  menuPiu: function (btn, r, el) {
    var self = this, aktif = r.sisa > 0 && r.status !== 'Batal' && r.status !== 'Lunas';
    var items = [{ label: 'Riwayat pembayaran', ikon: 'history', fn: function () { self.riwayat(r, el); } }, { label: 'Lihat nota ' + r.pesananId, ikon: 'receipt-text', fn: function () { Pesanan.detail(r.pesananId); } }];
    if (aktif) items.push({ label: 'Kirim pengingat WA/Email', ikon: 'bell-ring', fn: function () { self.ingatkan([r.id], null); } });
    if (r.wa) items.push({ label: 'Chat WhatsApp manual', ikon: 'message-circle', fn: function () { window.open('https://wa.me/' + hp08(r.wa).replace(/^0/, '62') + '?text=' + encodeURIComponent('Halo ' + r.pelanggan + ', mengingatkan tagihan nota ' + r.pesananId + ' sebesar ' + rp(r.sisa) + (r.jatuhTempo ? ' (jatuh tempo ' + tglIndo(r.jatuhTempo) + ')' : '') + '. Terima kasih 🙏'), '_blank', 'noopener'); } });
    items.push({ label: 'Surat tagihan pelanggan (PDF)', ikon: 'file-text', fn: function () { Dokumen.cetak('TAGIHAN', r.plgId); } }, { label: 'Profil pelanggan', ikon: 'contact-round', fn: function () { Pelanggan.detail(r.plgId); } });
    popMenu(btn, items);
  },
  ingatkan: function (ids, btn) {
    var st = this.st, self = this;
    if (!ids.length) {
      ids = ((st.piu && st.piu.rows) || []).filter(function (r) { return r.sisa > 0 && r.status !== 'Batal' && (r.telatHari > 0 || (r.tempoHari >= 0 && r.tempoHari <= 2)); }).map(function (r) { return r.id; });
      if (!ids.length) return toast('Tidak ada yang perlu diingatkan', 'Tidak ada piutang jatuh tempo ≤2 hari / lewat tempo di daftar ini. Centang tagihan untuk memilih manual.', 'warn');
    }
    konfirmasi('Kirim pengingat ke ' + ids.length + ' tagihan?', 'Pesan dikirim lewat WhatsApp (Fonnte) dan/atau Email sesuai pengaturan menu WhatsApp & CRM. Teks pengingat bisa diubah di matriks notifikasi.', { ok: 'Kirim Pengingat', ikon: 'bell-ring' }).then(function (ok) {
      if (!ok) return; setBusy(btn, true);
      api('piutang.ingatkan', { ids: ids }).then(function (r) { setBusy(btn, false); if (toastRes(r)) { st.pilih = {}; var c = halamanAktif(); if (c && c.name === 'keuangan') self.muatPiu(c.el, true); } });
    });
  },
  eksporPiu: function () {
    var rows = this.st.pRows || []; if (!rows.length) return toast('Tidak ada data', '', 'warn');
    eksporXLSX('Piutang ' + hariIni() + '.xlsx', [{ nama: 'Piutang', kolom: ['ID', 'Nota', 'Pelanggan', 'WhatsApp', 'Tanggal', 'Jatuh Tempo', 'Telat (hari)', 'Jumlah', 'Terbayar', 'Sisa', 'Status', 'Pengingat Terakhir'],
      rows: rows.map(function (r) { return [r.id, r.pesananId, r.pelanggan, r.wa, r.tanggal, r.jatuhTempo, r.telatHari, r.jumlah, r.terbayar, r.sisa, r.status, r.pengingat]; }) }]);
  },
  /** Catat pembayaran (cicilan/pelunasan). r = piutang publik. */
  bayar: function (r, cb) {
    if (!r) return;
    var m = modal({ judul: 'Terima Pembayaran Piutang', ikon: 'banknote', ikonKelas: 'paid', lebar: 'mid', sub: esc(r.pelanggan) + ' • nota #' + esc(r.pesananId),
      isi: '<div class="box" style="padding:14px 18px"><div class="meta-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="meta"><div class="k">Tagihan</div><div class="v">' + rp(r.jumlah) + '</div></div><div class="meta"><div class="k">Terbayar</div><div class="v text-paid">' + rp(r.terbayar) + '</div></div><div class="meta"><div class="k">Sisa</div><div class="v text-coral" style="font-size:18px">' + rp(r.sisa) + '</div></div></div>' + (r.telatHari > 0 ? '<div class="note-coral mt-s">' + ic('triangle-alert', 'sm') + '<span>Lewat jatuh tempo ' + r.telatHari + ' hari (' + tglSingkat(r.jatuhTempo) + ')</span></div>' : '') + '</div>' +
        '<form id="byf" class="mt">' + fld('Jumlah dibayar', rpInp('jumlah', r.sisa, 'autofocus'), { req: true, kanan: '<span class="row gap-s"><button type="button" class="chip chip-s" data-j="' + r.sisa + '">Lunas</button><button type="button" class="chip chip-s" data-j="' + Math.round(r.sisa / 2) + '">50%</button></span>' }) +
        '<div class="field mt"><label>Metode</label><div class="seg" id="byMet" style="width:100%">' + ['Tunai', 'Transfer', 'QRIS', 'Lainnya'].map(function (x, i) { return '<button type="button" style="flex:1" data-v="' + x + '" class="' + (i === 0 ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div></div>' +
        '<div class="grid-2 mt">' + fld('Tanggal terima', '<input class="input" type="date" name="tanggal" max="' + hariIni() + '" value="' + hariIni() + '">') + fld('Catatan', inp('catatan', '', 'maxlength="200" placeholder="mis. transfer BCA a/n …"')) + '</div>' +
        '<label class="check mt"><input type="checkbox" id="byKw" checked> Terbitkan kwitansi PDF setelah disimpan</label></form>',
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="byOk">' + ic('check', 'sm') + 'Simpan Pembayaran</button>' });
    var metode = 'Tunai';
    m.$('#byMet').onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; metode = b.dataset.v; m.$$('#byMet button').forEach(function (x) { x.classList.toggle('on', x === b); }); };
    m.$$('[data-j]').forEach(function (c) { c.onclick = function () { m.$('#f_jumlah').value = angka(+c.dataset.j); }; });
    m.$('#byOk').onclick = function () {
      var f = formData(m.$('#byf')), j = parseRp(f.jumlah), b = m.$('#byOk');
      if (!(j > 0)) return toast('Isi jumlah pembayaran', '', 'err');
      if (j > r.sisa) return toast('Melebihi sisa', 'Sisa piutang ' + rp(r.sisa) + '.', 'err');
      setBusy(b, true, 'Menyimpan…');
      api('piutang.bayar', { id: r.id, jumlah: j, metode: metode, tanggal: f.tanggal, catatan: f.catatan }).then(function (x) {
        setBusy(b, false); if (!toastRes(x)) return;
        var kw = m.$('#byKw').checked; m.close();
        swrStale('piutang:'); swrStale('kas:'); swrStale('dashboard'); swrStale('rekap:'); swrStale('pesanan:');
        if (kw) Dokumen.cetak('KWITANSI', x.data.bayarId);
        if (cb) cb(x.data);
      });
    };
  },
  riwayat: function (r, el) {
    var self = this;
    var d = drawer({ judul: 'Piutang ' + esc(r.pesananId), sub: esc(r.pelanggan) + ' • ' + esc(r.status), ikon: 'clipboard-clock', isi: '<div class="skel" style="height:200px"></div>' });
    var muat = function () {
      api('piutang.riwayat', { id: r.id }).then(function (x) {
        if (d.closed) return; if (!x.success) return d.set(retryBox(x));
        var aktif = r.sisa > 0 && r.status !== 'Batal' && r.status !== 'Lunas';
        d.set('<div class="box"><div class="meta-grid two"><div class="meta"><div class="k">Tagihan</div><div class="v">' + rp(r.jumlah) + '</div></div><div class="meta"><div class="k">Sisa</div><div class="v big" style="color:' + (r.sisa > 0 ? 'var(--coral)' : 'var(--paid)') + '">' + rp(r.sisa) + '</div></div>' +
          '<div class="meta"><div class="k">Tanggal transaksi</div><div class="v">' + tglIndo(r.tanggal) + '</div></div><div class="meta"><div class="k">Jatuh tempo</div><div class="v">' + tglIndo(r.jatuhTempo) + (r.telatHari > 0 ? ' <span class="text-coral">(lewat ' + r.telatHari + ' hari)</span>' : '') + '</div></div>' +
          '<div class="meta" style="grid-column:1/-1"><div class="k">Pengingat terakhir</div><div class="v">' + esc(r.pengingat ? r.pengingat.replace('|', ' • ') : 'Belum pernah') + '</div></div></div></div>' +
          '<div class="box"><div class="box-title">Riwayat Pembayaran<span class="r">' + x.data.filter(function (b) { return b.status !== 'Dihapus'; }).length + ' pembayaran</span></div>' + (x.data.length ? x.data.map(function (b) {
            var hapus = b.status === 'Dihapus';
            return '<div class="log-item" style="align-items:center' + (hapus ? ';opacity:.55' : '') + '"><span class="dt ' + (hapus ? 'coral' : '') + '"></span><div class="grow"><b>' + rp(b.jumlah) + ' • ' + esc(b.metode) + (hapus ? ' (dihapus)' : '') + '</b><span>' + tglSingkat(b.tanggal) + ' • ' + esc(b.oleh || '') + (b.catatan ? ' • ' + esc(b.catatan) : '') + ' • ' + esc(b.id) + '</span></div>' +
              (hapus ? '' : '<button class="btn btn-ghost btn-xs" data-kw="' + esc(b.id) + '">' + ic('file-text', 'sm') + 'Kwitansi</button><button class="btn btn-ghost btn-icon btn-xs" data-hapus="' + esc(b.id) + '" aria-label="Hapus">' + ic('trash-2', 'sm') + '</button>') + '</div>';
          }).join('') : '<p class="muted">Belum ada pembayaran.</p>') + '</div>',
          (aktif ? '<button class="btn btn-primary" data-a="bayar">' + ic('banknote', 'sm') + 'Terima Pembayaran</button><button class="btn btn-outline" data-a="ingat">' + ic('bell-ring', 'sm') + 'Ingatkan</button>' : '') + '<button class="btn btn-ghost" data-a="nota">' + ic('receipt-text', 'sm') + 'Lihat Nota</button>');
      });
    };
    d.el.addEventListener('click', function (e) {
      var kw = e.target.closest('[data-kw]'), hp = e.target.closest('[data-hapus]'), a = e.target.closest('[data-a]');
      if (kw) Dokumen.cetak('KWITANSI', kw.dataset.kw, kw);
      if (hp) konfirmasi('Hapus pembayaran ' + esc(hp.dataset.hapus) + '?', 'Sisa piutang & kas masuk otomatis dikoreksi. Gunakan bila salah input.', { bahaya: true, ok: 'Hapus Pembayaran', alasan: 'Alasan penghapusan' }).then(function (al) {
        if (!al) return; api('piutang.hapusBayar', { bayarId: hp.dataset.hapus, alasan: al }).then(function (x) { if (toastRes(x)) { Object.assign(r, x.data); swrStale('piutang:'); swrStale('kas:'); muat(); if (el) self.muatPiu(el, true); } });
      });
      if (!a) return;
      if (a.dataset.a === 'bayar') self.bayar(r, function (res) { Object.assign(r, res.piutang); muat(); if (el) self.muatPiu(el, true); });
      if (a.dataset.a === 'ingat') self.ingatkan([r.id], a);
      if (a.dataset.a === 'nota') Pesanan.detail(r.pesananId);
    });
    muat();
  }
};
function tglSelisihHari(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
registerPage('keuangan', { auth: 'owner', judul: 'Keuangan & Piutang', template: function () { return Keuangan.template(); }, init: function (el) { Keuangan.init(el); }, show: function (el, p) { Keuangan.show(el, p); }, tick: function (el) { Keuangan.tick(el); }, tickMs: 60000, tickIdleMs: 240000 });
