/* ==========================================================================
   VIA SEAFOOD — pages-pelanggan.js
   Rekap Pelanggan Bulanan (staff & owner), daftar & data pelanggan,
   detail pelanggan (tren 6 bulan, piutang untuk Owner, nota bulan ini).
   ========================================================================== */
'use strict';
var Pelanggan = {
  st: { tab: 'rekap', periode: '', cari: '', tipe: '', filter: '', key: 'total', dir: -1, data: null, daftar: null },
  template: function () {
    var b = AppState.brand || {};
    return '<div class="page-head"><div><div class="eyebrow">Rekapitulasi Mitra <span class="dot"></span><span class="loc">' + esc(b.lokasi || '') + '</span></div><h1 class="page-title">Rekap Pelanggan</h1><p class="page-sub">Belanja bulanan per pelanggan, frekuensi transaksi, dan status pembayaran</p></div>' +
      '<div class="page-actions"><div class="seg" style="padding:4px"><button data-act="geser" data-n="-1" aria-label="Bulan sebelumnya">' + ic('chevron-left', 'sm') + '</button><button class="on" id="rkPer" style="min-width:140px" data-act="pilihPer"></button><button data-act="geser" data-n="1" aria-label="Bulan berikutnya">' + ic('chevron-right', 'sm') + '</button></div>' +
      '<button class="btn btn-outline" data-act="cetak">' + ic('file-text', 'sm') + 'Rekap PDF / Excel ' + ic('chevron-down', 'sm') + '</button>' +
      (App.izin('pelanggan_kelola') ? '<button class="btn btn-accent btn-lg" data-act="tambah">' + ic('user-plus') + 'Pelanggan Baru</button>' : '') + '</div></div>' +
      '<div class="card" style="margin-bottom:var(--gut)">' + tabsHtml([{ id: 'rekap', label: 'Rekap Bulanan', ikon: 'chart-column' }, { id: 'daftar', label: 'Daftar Pelanggan', ikon: 'contact-round' }], 'rekap') + '</div>' +
      '<div id="rkPanel"><div class="kpis" id="rkKpi"></div>' +
      '<div class="card" style="margin-top:var(--gut);overflow:hidden"><div class="filter-bar"><div class="searchbox grow" style="max-width:320px">' + ic('search') + '<input class="input soft" id="rkCari" placeholder="Cari pelanggan…"></div>' +
      '<label class="filter-pill">' + ic('store', 'sm') + '<select id="rkTipe"><option value="">Semua tipe</option></select></label>' +
      '<label class="filter-pill">' + ic('filter', 'sm') + '<select id="rkFilter"><option value="">Semua pelanggan</option><option value="langganan">Langganan saja</option><option value="piutang">Ada piutang</option><option value="lewat">Lewat tempo</option><option value="lunas">Lunas</option></select></label>' +
      '<span class="grow"></span><button class="btn filter-pill green" data-act="ekspor">' + ic('sheet', 'sm') + 'Ekspor</button></div>' +
      '<div class="tbl-wrap"><table class="tbl cards" id="rkTbl"><thead></thead><tbody>' + skeletonRows(6, 7) + '</tbody></table></div><div class="tbl-foot" id="rkFoot"></div></div></div>' +
      '<div id="dfPanel" hidden><div class="card" style="overflow:hidden"><div class="filter-bar"><div class="searchbox grow" style="max-width:320px">' + ic('search') + '<input class="input soft" id="dfCari" placeholder="Cari nama, WA, alamat…"></div>' +
      '<label class="check"><input type="checkbox" id="dfSemua"> Tampilkan nonaktif</label><span class="grow"></span><button class="btn filter-pill green" data-act="eksporDf">' + ic('sheet', 'sm') + 'Ekspor</button></div>' +
      '<div class="tbl-wrap"><table class="tbl cards" id="dfTbl"><thead><tr><th>Pelanggan</th><th class="hide-m">WhatsApp</th><th class="hide-m">Alamat</th><th class="c hide-m">Tempo</th><th class="r">Total Belanja</th><th class="hide-m">Terakhir</th><th></th></tr></thead><tbody>' + skeletonRows(6, 7) + '</tbody></table></div></div></div>';
  },
  init: function (el) {
    var self = this, st = this.st;
    st.periode = periodeIni();
    pasangTabs(el.querySelector('.tabs'), function (t) { st.tab = t; el.querySelector('#rkPanel').hidden = t !== 'rekap'; el.querySelector('#dfPanel').hidden = t !== 'daftar'; if (t === 'daftar') self.muatDaftar(el); });
    bindActs(el, {
      geser: function (b) { var p = periodeGeser(st.periode, +b.dataset.n); if (p > periodeIni()) return toast('Belum ada data', 'Periode ' + periodeLabel(p) + ' belum berjalan.', 'warn'); st.periode = p; self.muat(el); },
      pilihPer: function () {
        var m = modal({ judul: 'Pilih Periode', ikon: 'calendar', isi: '<input type="month" class="input" id="ppBln" value="' + st.periode + '" max="' + periodeIni() + '">', foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="ppOk">Tampilkan</button>' });
        m.$('#ppOk').onclick = function () { var v = m.$('#ppBln').value; if (v) { st.periode = v > periodeIni() ? periodeIni() : v; m.close(); self.muat(el); } };
      },
      cetak: function (b) { self.menuRekap(b); },
      tambah: function () { self.form(null); },
      ekspor: function () { self.ekspor(); },
      eksporDf: function () { self.eksporDaftar(); },
      sort: function (a) { var k = a.dataset.key; st.dir = st.key === k ? -st.dir : -1; st.key = k; self.render(el); },
      muat: function () { self.muat(el, true); }
    });
    el.querySelector('#rkCari').oninput = debounce(function (e) { st.cari = e.target.value.trim().toLowerCase(); self.render(el); }, 200);
    el.querySelector('#rkTipe').onchange = function (e) { st.tipe = e.target.value; self.render(el); };
    el.querySelector('#rkFilter').onchange = function (e) { st.filter = e.target.value; self.render(el); };
    el.querySelector('#dfCari').oninput = debounce(function () { self.renderDaftar(el); }, 200);
    el.querySelector('#dfSemua').onchange = function () { st.daftar = null; self.muatDaftar(el); };
    el.querySelector('#rkTbl').addEventListener('click', function (e) { var rk = e.target.closest('[data-rk]'); if (rk) { e.stopPropagation(); self.rekapPlg(rk.closest('tr').dataset.id, rk.dataset.rk, rk); return; } var w = e.target.closest('[data-wa]'); if (w) { e.stopPropagation(); window.open('https://wa.me/' + hp08(w.dataset.wa).replace(/^0/, '62'), '_blank', 'noopener'); return; } var tr = e.target.closest('tr[data-id]'); if (tr && tr.dataset.id) self.detail(tr.dataset.id); });
    el.querySelector('#dfTbl').addEventListener('click', function (e) { var ed = e.target.closest('[data-edit]'); var tr = e.target.closest('tr[data-id]'); if (!tr) return; var p = (st.daftar || []).filter(function (x) { return x.id === tr.dataset.id; })[0]; if (ed) { e.stopPropagation(); self.form(p); return; } self.detail(tr.dataset.id); });
  },
  show: function (el, param) {
    this.muat(el);
    if (param) { var self = this; setTimeout(function () { self.detail(param, true); }, 50); }
  },
  key: function () { return 'rekap:' + this.st.periode; },
  muat: function (el, paksa) {
    var self = this, st = this.st;
    el.querySelector('#rkPer').textContent = periodeLabel(st.periode);
    var c = swrPeek(this.key()); if (!c) { el.querySelector('#rkTbl tbody').innerHTML = skeletonRows(6, 7); el.querySelector('#rkKpi').innerHTML = ''; }
    return swr(this.key(), 'pelanggan.rekap', { periode: st.periode }, function (d) { if (d.periode !== st.periode) return; st.data = d; self.render(el); }, { fresh: st.periode === periodeIni() ? 60000 : 600000, force: paksa,
      onError: function (r) { el.querySelector('#rkTbl tbody').innerHTML = '<tr><td colspan="8">' + retryBox(r) + '</td></tr>'; } });
  },
  render: function (el) {
    var st = this.st, d = st.data; if (!d) return;
    var owner = App.owner(), k = d.kpi, prev = k.bulanLalu || {};
    var dl = prev.total ? Math.round((k.total - prev.total) / prev.total * 1000) / 10 : null;
    el.querySelector('#rkKpi').innerHTML =
      kpiHtml('Pelanggan Bertransaksi', String(k.pelanggan), (k.baru ? '<span class="up">+' + k.baru + ' baru</span> ' : '') + (prev.pelanggan != null ? 'bulan lalu ' + prev.pelanggan : ''), 'users-round') +
      kpiHtml('Total Belanja', rp(k.total), (dl == null ? '' : '<span class="delta' + (dl < 0 ? ' neg' : '') + '">' + (dl < 0 ? '↓ ' : '↑ ') + angka(Math.abs(dl), 1) + '%</span> ') + 'vs ' + rpRingkas(prev.total || 0) + ' bulan lalu', 'banknote', 'paid', '', 'money') +
      kpiHtml('Jumlah Transaksi', angka(k.transaksi) + '<small>nota</small>', 'rata-rata ' + rp(k.rata) + ' / nota', 'receipt-text', 'amber') +
      kpiHtml('Pelanggan Ada Piutang', String(k.adaPiutang), k.adaPiutang ? (owner ? '<a href="#/keuangan/piutang">Kelola piutang →</a>' : 'tagihan belum lunas') : 'semua pembayaran lunas', 'clipboard-clock', k.adaPiutang ? 'coral' : 'paid', k.adaPiutang ? 'coral' : '');
    var tipeSel = el.querySelector('#rkTipe'), tipes = {}; d.rows.forEach(function (r) { if (r.tipe) tipes[r.tipe] = 1; });
    tipeSel.innerHTML = '<option value="">Semua tipe</option>' + Object.keys(tipes).sort().map(function (t) { return '<option' + (t === st.tipe ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
    var rows = d.rows.filter(function (r) {
      if (st.tipe && r.tipe !== st.tipe) return false;
      if (st.filter === 'langganan' && !r.langganan) return false;
      if (st.filter === 'piutang' && r.statusPiutang === 'Lunas') return false;
      if (st.filter === 'lewat' && r.statusPiutang !== 'Lewat Tempo') return false;
      if (st.filter === 'lunas' && r.statusPiutang !== 'Lunas') return false;
      return !st.cari || (r.nama + ' ' + r.tipe + ' ' + r.wa).toLowerCase().indexOf(st.cari) > -1;
    });
    rows = sortRows(rows, st.key, st.dir); st.filtered = rows;
    var maks = Math.max.apply(null, d.rows.map(function (r) { return r.total; }).concat([1]));
    el.querySelector('#rkTbl thead').innerHTML = '<tr><th class="c hide-m" style="width:48px">#</th>' + thSort('Pelanggan', 'nama', st) + thSort('Transaksi', 'transaksi', st, 'c hide-m') + thSort('Total Belanja', 'total', st, 'r') + thSort('Rata-rata', 'rata', st, 'r hide-m') + thSort('Terakhir', 'terakhir', st, 'hide-m') + '<th class="c">Pembayaran</th><th class="c">Rekap Pelanggan</th></tr>';
    var rank = {}; sortRows(d.rows, 'total', -1).forEach(function (r, i) { rank[r.id + r.nama] = i + 1; });
    el.querySelector('#rkTbl tbody').innerHTML = rows.length ? rows.map(function (r) {
      var stp = r.statusPiutang === 'Lunas' ? '<span class="badge b-lunas">' + ic('circle-check', 'sm') + 'Lunas</span>' : '<span class="badge ' + (r.statusPiutang === 'Lewat Tempo' ? 'b-hutang' : 'b-sebagian') + '">' + ic('clock-3', 'sm') + esc(r.statusPiutang) + '</span>' + (owner && r.sisaPiutang ? '<div class="sub text-coral" style="font-weight:600">' + rp(r.sisaPiutang) + '</div>' : '');
      return '<tr class="' + (r.id ? 'click' : '') + '" data-id="' + esc(r.id) + '"><td class="c hide-m"><span class="stepper-n" style="margin:auto;' + (rank[r.id + r.nama] > 3 ? 'background:var(--sand-2);color:var(--ink-2)' : '') + '">' + rank[r.id + r.nama] + '</span></td>' +
        '<td class="full-m"><div class="cust"><span class="avatar ' + avatarKelas(r.nama) + '">' + inisial(r.nama) + '</span><div><div class="row gap-s" style="flex-wrap:wrap"><b>' + esc(r.nama) + '</b>' + (r.langganan ? '<span class="tag-langganan">Langganan</span>' : '') + '</div><div class="sub">' + esc(r.tipe || 'Pelanggan umum') + (r.wa ? ' • <a href="#" data-wa="' + esc(r.wa) + '">' + esc(hpTampil(r.wa)) + '</a>' : '') + '</div></div></div></td>' +
        '<td class="c hide-m num"><b>' + r.transaksi + '</b> <span class="muted">nota</span></td><td class="r"><span class="total">' + rp(r.total) + '</span><div class="progress mist" style="height:5px;margin-top:5px;min-width:90px"><i style="width:' + Math.max(3, r.total / maks * 100) + '%"></i></div></td>' +
        '<td class="r num hide-m">' + rp(r.rata) + '</td><td class="hide-m muted">' + tglSingkat(r.terakhir) + '</td><td class="c">' + stp + '</td>' +
        '<td class="c nowrap">' + (r.id ? '<button class="btn btn-ghost btn-xs" data-rk="pdf" title="Rekap lengkap ' + esc(r.nama) + ' (PDF)">' + ic('file-text', 'sm') + 'PDF</button><button class="btn btn-ghost btn-xs" data-rk="xlsx" title="Rekap lengkap ' + esc(r.nama) + ' (Excel)">' + ic('sheet', 'sm') + 'Excel</button>' : '<span class="muted">–</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="8">' + emptyState('users-round', d.rows.length ? 'Tidak ada pelanggan yang cocok' : 'Belum ada transaksi ' + periodeLabel(st.periode), d.rows.length ? 'Ubah filter pencarian.' : 'Rekap terisi otomatis dari pesanan harian.') + '</td></tr>';
    var tot = rows.reduce(function (s, r) { return s + r.total; }, 0);
    el.querySelector('#rkFoot').innerHTML = '<span><b>' + rows.length + '</b> pelanggan • total <b>' + rp(tot) + '</b> • ' + periodeLabel(st.periode) + '</span><span class="muted" style="font-size:12px">Rekap hari lalu dihitung otomatis tiap 10 menit; hari ini real-time.</span>';
  },
  /* ---------- rekap PDF/Excel: keseluruhan & per pelanggan ---------- */
  menuRekap: function (btn) {
    var self = this, per = this.st.periode, items = [
      { label: 'Rekap keseluruhan ' + periodeLabel(per) + ' — PDF', ikon: 'file-text', fn: function () { Dokumen.cetak('REKAP_PELANGGAN', per, btn); } },
      { label: 'Rekap keseluruhan ' + periodeLabel(per) + ' — Excel', ikon: 'sheet', fn: function () { Dokumen.cetak('REKAP_PELANGGAN', per, btn, { format: 'xlsx' }); } },
      '-',
      { label: 'Rekap lengkap per pelanggan (PDF / Excel)…', ikon: 'contact-round', fn: function () { self.pilihRekap(); } }];
    if (App.owner()) items.push({ label: 'Rekap semua pelanggan, masing-masing PDF + Excel (ZIP)…', ikon: 'files', fn: function () { Dokumen.massal('REKAP_PER_PELANGGAN', { periode: per }); } });
    popMenu(btn, items);
  },
  /** Rekap lengkap satu pelanggan. ref default = pelanggan + periode yang sedang dilihat. */
  rekapPlg: function (id, format, btn, ref) {
    if (!id) return toast('Pelanggan umum tidak punya rekap', 'Rekap per pelanggan hanya untuk pelanggan terdaftar.', 'warn');
    Dokumen.cetak('REKAP_PER_PELANGGAN', ref || id + '_' + this.st.periode, btn, { format: format === 'xlsx' ? 'xlsx' : 'pdf' });
  },
  pilihRekap: function (idAwal) {
    var self = this, st = this.st, rows = (st.data && st.data.rows || []).filter(function (r) { return r.id; }), aktif = {};
    rows.forEach(function (r) { aktif[r.id] = r; });
    var daftar = rows.map(function (r) { return { id: r.id, nama: r.nama, tipe: r.tipe, wa: r.wa, trx: r.transaksi, total: r.total }; })
      .concat(AppState.pelanggan.filter(function (p) { return !aktif[p.id]; }).map(function (p) { return { id: p.id, nama: p.nama, tipe: p.tipe, wa: p.wa, trx: 0, total: 0 }; }));
    var pilih = daftar.filter(function (x) { return x.id === idAwal; })[0] || null, mode = 'bulan';
    var m = modal({ judul: 'Rekap Lengkap per Pelanggan', ikon: 'contact-round', lebar: 'mid', sub: 'Daftar nota, status bayar, ringkasan per produk & rincian item — PDF dan Excel.',
      isi: fld('Pelanggan', '<div id="rpWrap"><div class="with-ic">' + ic('store') + '<input class="input" id="rpPlg" placeholder="Cari nama pelanggan / restoran…" autocomplete="off"></div></div>', { req: true, hint: 'Urutan teratas = belanja terbesar ' + periodeLabel(st.periode) }) +
        '<div class="field mt"><label>Periode</label><div class="seg" id="rpMode" style="width:100%"><button type="button" class="on" data-m="bulan" style="flex:1">' + esc(periodeLabel(st.periode)) + '</button><button type="button" data-m="rentang" style="flex:1">Rentang tanggal</button></div></div>' +
        '<div class="grid-2 mt" id="rpRentang" hidden>' + fld('Dari', '<input class="input" type="date" id="rpDari" value="' + st.periode + '-01" max="' + hariIni() + '">') + fld('Sampai', '<input class="input" type="date" id="rpSampai" value="' + (st.periode === periodeIni() ? hariIni() : tglTambah(periodeGeser(st.periode, 1) + '-01', -1)) + '" max="' + hariIni() + '">') + '</div>' +
        '<div class="note-teal mt">' + ic('info', 'sm') + '<span>Isi rekap: profil pelanggan, ringkasan belanja, <b>daftar semua nota</b> (status lunas/tempo/batal' + (App.owner() ? ' & sisa tagihan' : '') + '), <b>ringkasan per produk</b>, dan lembar <b>rincian setiap item</b>.</span></div>',
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-outline" id="rpXls">' + ic('sheet', 'sm') + 'Unduh Excel</button><button class="btn btn-primary" id="rpPdf">' + ic('file-text', 'sm') + 'Unduh PDF</button>' });
    var inp = m.$('#rpPlg');
    if (pilih) inp.value = pilih.nama;
    Combo({ el: m.$('#rpWrap'), items: function () { return daftar; }, cari: function (x) { return x.nama + ' ' + (x.tipe || '') + ' ' + (x.wa || ''); },
      render: function (x) { return '<span class="avatar ' + avatarKelas(x.nama) + '" style="width:30px;height:30px;font-size:11px">' + inisial(x.nama) + '</span><div class="cm"><b>' + esc(x.nama) + '</b><span>' + esc([x.tipe, x.trx ? x.trx + ' nota • ' + rpRingkas(x.total) : 'belum ada nota ' + periodeLabel(st.periode)].filter(Boolean).join(' • ')) + '</span></div>'; },
      onPick: function (x) { pilih = x; inp.value = x.nama; inp.classList.remove('is-err'); } });
    inp.addEventListener('input', function () { if (pilih && inp.value !== pilih.nama) pilih = null; });
    m.$('#rpMode').onclick = function (e) { var b = e.target.closest('[data-m]'); if (!b) return; mode = b.dataset.m; m.$$('#rpMode button').forEach(function (x) { x.classList.toggle('on', x === b); }); m.$('#rpRentang').hidden = mode !== 'rentang'; };
    var jalan = function (format, btn) {
      if (!pilih) { inp.classList.add('is-err'); inp.focus(); return toast('Pilih pelanggan', 'Ketik lalu pilih nama dari daftar.', 'warn'); }
      var ref = pilih.id + '_' + st.periode;
      if (mode === 'rentang') {
        var dari = m.$('#rpDari').value, sampai = m.$('#rpSampai').value;
        if (!dari || !sampai) return toast('Isi rentang tanggal', '', 'warn');
        if (dari > sampai) { var t = dari; dari = sampai; sampai = t; }
        if (tglSelisih(dari, sampai) > 366) return toast('Rentang terlalu panjang', 'Maksimal 1 tahun per rekap.', 'warn');
        ref = pilih.id + '_' + dari + '_' + sampai;
      }
      m.close(); self.rekapPlg(pilih.id, format, btn, ref);
    };
    m.$('#rpPdf').onclick = function () { jalan('pdf', null); };
    m.$('#rpXls').onclick = function () { jalan('xlsx', null); };
    if (!pilih) setTimeout(function () { inp.focus(); }, 60);
  },
  ekspor: function () {
    var rows = this.st.filtered || [], owner = App.owner();
    if (!rows.length) return toast('Tidak ada data', '', 'warn');
    var kol = ['Pelanggan', 'Tipe', 'Langganan', 'WhatsApp', 'Jumlah Transaksi', 'Total Belanja', 'Rata-rata', 'Terakhir Belanja', 'Status Pembayaran'].concat(owner ? ['Sisa Piutang'] : []);
    eksporXLSX('Rekap Pelanggan ' + this.st.periode + '.xlsx', [{ nama: 'Rekap ' + this.st.periode, kolom: kol, rows: rows.map(function (r) { return [r.nama, r.tipe, r.langganan ? 'Ya' : 'Tidak', r.wa, r.transaksi, r.total, r.rata, r.terakhir, r.statusPiutang].concat(owner ? [r.sisaPiutang || 0] : []); }) }]);
  },

  /* ---------- daftar pelanggan ---------- */
  muatDaftar: function (el, paksa) {
    var self = this, semua = el.querySelector('#dfSemua').checked;
    return swr('pelanggan:' + (semua ? 'semua' : 'aktif'), 'pelanggan.list', semua ? { semua: 1 } : {}, function (d) { self.st.daftar = d.rows; self.renderDaftar(el); }, { fresh: 60000, force: paksa,
      onError: function (r) { el.querySelector('#dfTbl tbody').innerHTML = '<tr><td colspan="7">' + retryBox(r) + '</td></tr>'; } });
  },
  renderDaftar: function (el) {
    var q = el.querySelector('#dfCari').value.trim().toLowerCase(), kelola = App.izin('pelanggan_kelola');
    var rows = (this.st.daftar || []).filter(function (p) { return !q || (p.nama + ' ' + p.wa + ' ' + p.alamat + ' ' + p.tipe + ' ' + (p.email || '')).toLowerCase().indexOf(q) > -1; });
    this.st.dfFiltered = rows;
    el.querySelector('#dfTbl tbody').innerHTML = rows.length ? rows.map(function (p) {
      var wab = p.statusWA === 'Terdaftar' ? '<span class="wa-badge ya">WA ✓</span>' : p.statusWA === 'Tidak Terdaftar' ? '<span class="wa-badge tidak">Bukan WA</span>' : '';
      return '<tr class="click' + (p.aktif ? '' : ' dim') + '" data-id="' + esc(p.id) + '"><td class="full-m"><div class="cust"><span class="avatar ' + avatarKelas(p.nama) + '">' + inisial(p.nama) + '</span><div><div class="row gap-s" style="flex-wrap:wrap"><b>' + esc(p.nama) + '</b>' + (p.langganan ? '<span class="tag-langganan">Langganan</span>' : '') + (p.aktif ? '' : '<span class="badge b-batal">Nonaktif</span>') + '</div><div class="sub">' + esc(p.tipe || '-') + ' • ' + esc(p.id) + '</div></div></div></td>' +
        '<td class="hide-m nowrap">' + (p.wa ? esc(hpTampil(p.wa)) + ' ' + wab : '<span class="muted">-</span>') + '</td><td class="hide-m" style="max-width:240px">' + esc(p.alamat || '-') + '</td><td class="c hide-m">' + (p.tempo ? p.tempo + ' hari' : 'Tunai') + '</td>' +
        '<td class="r">' + (p.total != null ? '<span class="total">' + rp(p.total) + '</span><div class="sub">' + (p.transaksi || 0) + ' nota</div>' : '-') + '</td><td class="hide-m muted">' + tglSingkat(p.terakhir) + '</td>' +
        '<td class="r">' + (kelola ? '<button class="btn btn-ghost btn-icon btn-sm" data-edit="1" aria-label="Edit">' + ic('pencil', 'sm') + '</button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="7">' + emptyState('contact-round', 'Belum ada pelanggan', kelola ? 'Tambahkan dengan tombol <b>Pelanggan Baru</b> atau langsung saat input pesanan.' : '') + '</td></tr>';
  },
  eksporDaftar: function () {
    var rows = this.st.dfFiltered || []; if (!rows.length) return toast('Tidak ada data', '', 'warn');
    eksporXLSX('Daftar Pelanggan.xlsx', [{ nama: 'Pelanggan', kolom: ['ID', 'Nama', 'Tipe', 'Langganan', 'WhatsApp', 'Status WA', 'Email', 'Alamat', 'Tempo (hari)', 'Jumlah Transaksi', 'Total Belanja', 'Terakhir', 'Aktif'],
      rows: rows.map(function (p) { return [p.id, p.nama, p.tipe, p.langganan ? 'Ya' : 'Tidak', p.wa, p.statusWA, p.email, p.alamat, p.tempo, p.transaksi || 0, p.total || 0, p.terakhir || '', p.aktif ? 'Ya' : 'Tidak']; }) }]);
  },

  /* ---------- form tambah / edit ---------- */
  form: function (p, cb) {
    var c = AppState.cfg || {}, baru = !p || !p.id, self = this;
    p = p || { nama: '', tipe: (c.tipePelanggan || [])[0] || 'Restoran', wa: '', email: '', alamat: '', tempo: 0, langganan: false, catatan: '', aktif: true };
    var m = modal({ judul: baru ? 'Pelanggan Baru' : 'Edit Pelanggan', sub: baru ? 'Pelanggan langsung tersedia di Input Pesanan & CRM.' : esc(p.id), ikon: baru ? 'user-plus' : 'pencil', lebar: 'mid',
      isi: '<form id="plf" autocomplete="off"><div class="grid-2">' + fld('Nama pelanggan / usaha', inp('nama', p.nama, 'required maxlength="80" autofocus placeholder="Restoran Nelayan Rasa"'), { req: true, cls: 'span-2' }) +
        fld('Tipe', sel('tipe', (c.tipePelanggan && c.tipePelanggan.length ? c.tipePelanggan : ['Restoran', 'Hotel', 'Eceran']), p.tipe)) +
        fld('Nomor WhatsApp', '<div class="affix"><span class="ad">+62</span><input name="wa" id="f_wa" inputmode="tel" value="' + esc(hp08(p.wa).replace(/^0/, '')) + '" placeholder="812-xxxx-xxxx"></div>', { hint: 'Untuk kirim struk & pengingat tagihan' }) +
        fld('Email', inp('email', p.email, 'type="email" placeholder="opsional"')) +
        fld('Tempo pembayaran', '<div class="affix"><input name="tempo" id="f_tempo" inputmode="numeric" value="' + esc(p.tempo || '') + '" placeholder="0"><span class="ad r">hari</span></div>', { hint: '0 = tunai; dipakai saat nota hutang' }) +
        fld('Alamat pengantaran', txa('alamat', p.alamat, 'maxlength="200" style="min-height:64px"'), { cls: 'span-2' }) +
        fld('Catatan', inp('catatan', p.catatan, 'maxlength="300" placeholder="mis. kirim sebelum jam 9 pagi"'), { cls: 'span-2' }) +
        '<div class="sec-toggle span-2"><div><div class="t">Pelanggan langganan</div><div class="d">Ditandai di daftar pesanan & bisa dipilih untuk blast promo.</div></div>' + sakelar('langganan', p.langganan) + '</div>' +
        (baru ? '' : '<div class="sec-toggle span-2"><div><div class="t">Aktif</div><div class="d">Nonaktif = disembunyikan dari pilihan Input Pesanan.</div></div>' + sakelar('aktif', p.aktif !== false) + '</div>') +
        '</div></form>',
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="plOk">' + ic('save', 'sm') + 'Simpan</button>' });
    m.$('#plOk').onclick = function () {
      var f = formData(m.$('#plf')), b = m.$('#plOk');
      if (f.nama.trim().length < 2) { m.$('#f_nama').classList.add('is-err'); return m.$('#f_nama').focus(); }
      if (f.wa && !hpValid(f.wa)) { m.$('#f_wa').parentNode.classList.add('is-err'); return toast('Nomor WA tidak valid', 'Contoh: 812-3456-7890', 'err'); }
      setBusy(b, true, 'Menyimpan…');
      api('pelanggan.save', { id: p.id, nama: f.nama.trim(), tipe: f.tipe, wa: hp08(f.wa), email: f.email.trim(), alamat: f.alamat, tempo: parseAngka(f.tempo), langganan: f.langganan, catatan: f.catatan, aktif: baru ? true : f.aktif }).then(function (r) {
        setBusy(b, false); if (!toastRes(r)) return;
        App.tambahPelangganLokal(r.data); swrStale('pelanggan:'); swrStale('rekap:'); m.close();
        var cur = halamanAktif(); if (cur && cur.name === 'pelanggan') { self.st.daftar = null; if (self.st.tab === 'daftar') self.muatDaftar(cur.el, true); }
        if (cb) cb(r.data);
      });
    };
  },

  /* ---------- detail ---------- */
  detail: function (id, dariUrl) {
    var self = this, owner = App.owner(), per = this.st.periode || periodeIni();
    var p0 = AppState.pelanggan.filter(function (x) { return x.id === id; })[0] || {};
    var d = drawer({ judul: esc(p0.nama || id), sub: esc((p0.tipe || 'Pelanggan') + ' • ' + id), ikon: 'contact-round', isi: '<div class="skel" style="height:120px"></div><div class="skel mt" style="height:180px"></div>',
      onClose: function () { if (dariUrl && parseHash().name === 'pelanggan' && parseHash().param) history.replaceState(null, '', '#/pelanggan'); } });
    api('pelanggan.detail', { id: id, denganPesanan: 1, periode: per }).then(function (r) {
      if (d.closed) return;
      if (!r.success) { d.set(retryBox(r)); return; }
      var p = r.data, maks = 0;
      d.el.querySelector('.drawer-head h3').textContent = p.nama;
      var piu = (p.piutang || []).filter(function (x) { return x.sisa > 0 && x.status !== 'Batal'; }), sisa = piu.reduce(function (s, x) { return s + x.sisa; }, 0);
      var h = '<div class="box"><div class="meta-grid">' +
        '<div class="meta"><div class="k">Total belanja (sejak awal)</div><div class="v big" style="color:var(--teal)">' + rp(p.total) + '</div></div><div class="meta"><div class="k">Jumlah transaksi</div><div class="v">' + angka(p.transaksi) + ' nota</div></div>' +
        '<div class="meta"><div class="k">Terakhir belanja</div><div class="v">' + tglSingkat(p.terakhir) + '</div></div><div class="meta"><div class="k">' + (owner ? 'Sisa piutang' : 'Tempo') + '</div><div class="v ' + (owner && sisa ? 'text-coral' : '') + '">' + (owner ? rp(sisa) : (p.tempo ? p.tempo + ' hari' : 'Tunai')) + '</div></div></div></div>' +
        '<div class="box"><div class="box-title">Kontak &amp; Pengiriman' + (p.langganan ? '<span class="tag-langganan">Langganan</span>' : '') + '</div><div class="meta-grid two">' +
        '<div class="meta"><div class="k">WhatsApp</div><div class="v">' + (p.wa ? '<a target="_blank" rel="noopener" href="https://wa.me/' + hp08(p.wa).replace(/^0/, '62') + '">' + esc(hpTampil(p.wa)) + '</a> ' + (p.statusWA === 'Terdaftar' ? '<span class="wa-badge ya">WA ✓</span>' : p.statusWA === 'Tidak Terdaftar' ? '<span class="wa-badge tidak">Bukan WA</span>' : '') : '-') + '</div></div>' +
        '<div class="meta"><div class="k">Email</div><div class="v">' + esc(p.email || '-') + '</div></div><div class="meta"><div class="k">Tipe</div><div class="v">' + esc(p.tipe || '-') + '</div></div><div class="meta"><div class="k">Tempo pembayaran</div><div class="v">' + (p.tempo ? p.tempo + ' hari' : 'Tunai') + '</div></div>' +
        '<div class="meta" style="grid-column:1/-1"><div class="k">Alamat</div><div class="v">' + esc(p.alamat || '-') + '</div></div>' + (p.catatan ? '<div class="meta" style="grid-column:1/-1"><div class="k">Catatan</div><div class="v">' + esc(p.catatan) + '</div></div>' : '') + '</div></div>' +
        '<div class="box"><div class="box-title">Belanja 6 Bulan Terakhir</div><div class="chart-mini" id="pdChart"></div></div>';
      if (owner) h += '<div class="box"><div class="box-title">Piutang Pelanggan<span class="r">' + piu.length + ' belum lunas</span></div>' + ((p.piutang || []).length ? (p.piutang || []).slice(0, 10).map(function (x) {
        return '<div class="log-item"><span class="dt ' + (x.sisa > 0 ? (x.telatHari > 0 ? 'coral' : 'amber') : '') + '"></span><div class="grow"><b>' + esc(x.pesananId) + ' • ' + rp(x.jumlah) + '</b><span>' + esc(x.status) + (x.sisa > 0 ? ' • sisa ' + rp(x.sisa) + ' • jatuh tempo ' + tglSingkat(x.jatuhTempo) + (x.telatHari > 0 ? ' (lewat ' + x.telatHari + ' hari)' : '') : ' • lunas ' + tglSingkat(x.lunasPada)) + '</span></div>' +
          (x.sisa > 0 ? '<button class="btn btn-soft btn-sm" data-bayar="' + esc(x.id) + '">' + ic('banknote', 'sm') + 'Bayar</button>' : '') + '</div>';
      }).join('') : '<p class="muted">Tidak ada piutang.</p>') + '</div>';
      h += '<div class="box"><div class="box-title">Nota ' + periodeLabel(per) + '<span class="r">' + (p.pesanan || []).length + ' nota</span></div>' + ((p.pesanan || []).length ? '<div class="tbl-wrap"><table class="tbl cards"><tbody>' + p.pesanan.map(function (o) {
        return '<tr class="click' + (o.status === 'Batal' ? ' dim' : '') + '" data-nota="' + esc(o.id) + '"><td class="id">#' + esc(o.id) + '<div class="sub">' + tglSingkat(o.tanggal) + ' ' + esc(String(o.waktu || '').slice(0, 5)) + '</div></td><td class="r"><span class="total">' + rp(o.total) + '</span></td><td class="c">' + badgeStatus(o.status, o.piutangId) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="muted">Belum ada nota di periode ini.</p>') + '</div>';
      d.set(h, (App.izin('pelanggan_kelola') ? '<button class="btn btn-outline" data-a="edit">' + ic('pencil', 'sm') + 'Edit</button>' : '') + (p.wa ? '<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/' + hp08(p.wa).replace(/^0/, '62') + '">' + ic('message-circle', 'sm') + 'WhatsApp</a>' : '') +
        '<button class="btn btn-outline" data-a="rekapPdf">' + ic('file-text', 'sm') + 'Rekap PDF</button><button class="btn btn-outline" data-a="rekapXls">' + ic('sheet', 'sm') + 'Rekap Excel</button>' +
        (owner && sisa ? '<button class="btn btn-primary" data-a="tagihan">' + ic('file-text', 'sm') + 'Surat Tagihan PDF</button>' : ''));
      p.bulan.forEach(function (b) { if (b.total > maks) maks = b.total; });
      Grafik.render(d.$('#pdChart'), { tipe: 'batang', labels: p.bulan.map(function (b) { return BLN[+b.periode.slice(5, 7) - 1]; }), labelTip: p.bulan.map(function (b) { return periodeLabel(b.periode) + ' • ' + b.transaksi + ' nota'; }), series: [{ nama: 'Belanja', data: p.bulan.map(function (b) { return b.total; }), warna: '#0D4F4F' }], kiri: 44 });
      d.el.addEventListener('click', function (e) {
        var a = e.target.closest('[data-a]'), n = e.target.closest('[data-nota]'), by = e.target.closest('[data-bayar]');
        if (n) Pesanan.detail(n.dataset.nota);
        if (by) { var x = p.piutang.filter(function (q) { return q.id === by.dataset.bayar; })[0]; Keuangan.bayar(x, function () { d.close(); self.detail(id); }); }
        if (!a) return;
        if (a.dataset.a === 'edit') { d.close(); self.form(p, function () { self.detail(id); }); }
        if (a.dataset.a === 'tagihan') Dokumen.cetak('TAGIHAN', p.id, a);
        if (a.dataset.a === 'rekapPdf' || a.dataset.a === 'rekapXls') self.rekapPlg(p.id, a.dataset.a === 'rekapXls' ? 'xlsx' : 'pdf', a, p.id + '_' + per);
      });
    });
  }
};
registerPage('pelanggan', { perm: 'rekap_lihat', judul: 'Rekap Pelanggan', template: function () { return Pelanggan.template(); }, init: function (el) { Pelanggan.init(el); }, show: function (el, param) { Pelanggan.show(el, param); }, tick: function (el) { if (Pelanggan.st.periode === periodeIni()) Pelanggan.muat(el); }, tickMs: 90000, tickIdleMs: 300000 });
