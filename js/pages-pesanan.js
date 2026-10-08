/* ==========================================================================
   VIA SEAFOOD — pages-pesanan.js
   Daftar Pesanan Harian (live), Input Pesanan Baru (mode cepat), detail nota,
   preview & cetak struk 58/80 mm, kirim struk via WhatsApp.
   ========================================================================== */
'use strict';
var Pesanan = {
  /* ---------- konversi data ---------- */
  dariBaris: function (h, r) {
    var o = {}; h.forEach(function (k, i) { o[k] = r[i]; });
    var items = []; try { items = typeof o.Items === 'string' ? JSON.parse(o.Items || '[]') : (o.Items || []); } catch (e) { }
    return { id: o.PesananID, tanggal: o.Tanggal, waktu: String(o.Waktu || '').slice(0, 5), plgId: o.PelangganID, pelanggan: o.NamaPelanggan, tipe: o.TipePelanggan, wa: hp08(o.NoWA), alamat: o.Alamat,
      items: items, berat: Number(o.TotalBerat) || 0, subtotal: Number(o.Subtotal) || 0, diskon: Number(o.Diskon) || 0, pajak: Number(o.Pajak) || 0, total: Number(o.Total) || 0,
      status: o.StatusBayar, metode: o.Metode, diterima: Number(o.Diterima) || 0, kembalian: Number(o.Kembalian) || 0, dp: Number(o.DP) || 0, jatuhTempo: o.JatuhTempo || '', piutangId: o.PiutangID || '',
      bukti: !!o.BuktiID, catatan: o.Catatan || '', oleh: o.DicatatOleh, petugas: o.NamaPetugas, kode: o.KodeVerifikasi };
  },
  hariData: function (res) {
    return { tanggal: res.tanggal, v: res.v, kemarin: res.kemarin || {}, piutangTempo: res.piutangTempo || null, rows: (res.r || []).map(function (r) { return Pesanan.dariBaris(res.h, r); }) };
  },
  key: function (tgl) { return 'pesanan:' + tgl; },
  sisipLokal: function (o) {
    var k = this.key(o.tanggal), d = swrPeek(k); if (!d) return;
    var i = d.rows.findIndex(function (x) { return x.id === o.id; });
    if (i > -1) d.rows[i] = Object.assign(d.rows[i], o); else d.rows.push(o);
    swrPut(k, d);
  },

  /* ---------- halaman daftar ---------- */
  st: { tanggal: '', status: '', petugas: '', cari: '', hal: 1, per: 10, data: null },
  template: function () {
    var owner = App.owner(), b = AppState.brand || {};
    return '<div class="page-head"><div><div class="eyebrow">Buku Transaksi Basah <span class="dot"></span><span class="loc">' + esc(b.lokasi || '') + '</span></div><h1 class="page-title">Daftar Pesanan Harian</h1><p class="page-sub">Kelola dan rekapitulasi seluruh transaksi penjualan harian usaha</p></div>' +
      '<div class="page-actions">' + (owner ? '<div class="omzet-pill"><div><div class="l">Omzet Hari Ini</div><div class="v" id="psOmzet">Rp 0</div></div><span class="ic-box sm">' + ic('banknote') + '</span></div>' : '') +
      (App.izin('pesanan_input') ? '<a class="btn btn-accent btn-lg" href="#/pesanan-baru">' + ic('plus') + 'Tambah Pesanan</a>' : '') + '</div></div>' +
      '<div class="kpis" id="psKpi"></div>' +
      '<div class="card mt" style="margin-top:var(--gut)"><div class="filter-bar"><div class="searchbox grow" style="max-width:300px">' + ic('search') + '<input class="input soft" id="psCari" placeholder="Cari nota / pelanggan…"></div>' +
      '<label class="filter-pill">' + ic('calendar', 'sm') + '<input type="date" id="psTgl"></label>' +
      '<label class="filter-pill">' + ic('filter', 'sm') + '<select id="psStatus"><option value="">Semua Status (Lunas & Hutang)</option><option value="Lunas">Lunas</option><option value="Hutang">Hutang / Tempo</option><option value="Batal">Dibatalkan</option></select></label>' +
      '<label class="filter-pill">' + ic('id-card', 'sm') + '<select id="psPetugas"><option value="">Semua Kasir / Staff</option></select></label>' +
      '<button class="btn filter-pill green" data-act="ekspor">' + ic('sheet', 'sm') + 'Ekspor Sheets</button><span class="grow"></span><span class="row gap-s muted" style="font-size:12.5px"><span class="live-dot" id="psLive"></span>Live POS</span></div></div>' +
      '<div class="card" style="margin-top:var(--gut);overflow:hidden"><div class="tbl-wrap"><table class="tbl cards" id="psTbl"><thead><tr><th>ID Pesanan</th><th>Tanggal &amp; Waktu</th><th>Pelanggan</th><th>Rincian Tangkapan</th><th class="r">Total Bayar</th><th class="c">Status</th><th class="c">Bukti</th></tr></thead><tbody>' + skeletonRows(6, 7) + '</tbody></table></div><div class="tbl-foot" id="psFoot"></div></div>' +
      '<div class="info-cards" id="psInfo"></div>';
  },
  init: function (el) {
    var self = this, st = this.st;
    st.tanggal = hariIni();
    el.querySelector('#psTgl').value = st.tanggal;
    el.querySelector('#psTgl').onchange = function (e) { st.tanggal = e.target.value || hariIni(); st.hal = 1; self.muat(el); };
    el.querySelector('#psStatus').onchange = function (e) { st.status = e.target.value; st.hal = 1; self.render(el); };
    el.querySelector('#psPetugas').onchange = function (e) { st.petugas = e.target.value; st.hal = 1; self.render(el); };
    el.querySelector('#psCari').oninput = debounce(function (e) { st.cari = e.target.value.trim().toLowerCase(); st.hal = 1; self.render(el); }, 250);
    bindActs(el, {
      hal: function (a) { st.hal = +a.dataset.h; self.render(el); },
      per: function () { },
      muat: function () { self.muat(el, true); },
      ekspor: function () { self.ekspor(); },
      printer: function () { Pesanan.aturPrinter(); },
      piutang: function () { location.hash = '#/keuangan/piutang'; },
      sinkron: function () { self.muat(el, true); toast('Menyinkronkan…', 'Mengambil data terbaru dari Google Sheets.'); }
    });
    el.querySelector('#psTbl').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-id]'); if (!tr) return;
      if (e.target.closest('[data-bukti]')) { e.stopPropagation(); Pesanan.lihatBukti(tr.dataset.id); return; }
      Pesanan.detail(tr.dataset.id);
    });
  },
  show: function (el) { this.muat(el); },
  muat: function (el, paksa) {
    var self = this, st = this.st, tgl = st.tanggal;
    return swr(this.key(tgl), 'pesanan.list', { tanggal: tgl }, null, { fresh: tgl === hariIni() ? 20000 : 600000, force: paksa, noStore: true, onError: function (r) { el.querySelector('#psTbl tbody').innerHTML = '<tr><td colspan="7">' + retryBox(r) + '</td></tr>'; } })
      .then(function (r) { if (r.success && !r.cached) { swrPut(self.key(tgl), self.hariData(r.data)); } st.data = swrPeek(self.key(tgl)); self.render(el); })
      .then(null, function () { });
  },
  tick: function (el) {
    var st = this.st, self = this; if (st.tanggal !== hariIni() || !st.data) return;
    api('pesanan.since', { tanggal: st.tanggal, v: st.data.v }).then(function (r) {
      if (!r.success || r.data.same) return;
      var d = swrPeek(self.key(st.tanggal)) || st.data;
      if (r.data.full) d = Object.assign(d, { rows: r.data.r.map(function (x) { return Pesanan.dariBaris(r.data.h, x); }) });
      else r.data.r.forEach(function (x) { var o = Pesanan.dariBaris(r.data.h, x), i = d.rows.findIndex(function (y) { return y.id === o.id; }); if (i > -1) d.rows[i] = o; else d.rows.push(o); });
      d.v = r.data.v; swrPut(self.key(st.tanggal), d); st.data = d; self.render(el);
    });
  },
  tickMs: 20000, tickIdleMs: 60000,
  render: function (el) {
    var st = this.st, d = st.data || (st.data = swrPeek(this.key(st.tanggal)));
    if (!d) return;
    var owner = App.owner(), all = d.rows.slice().sort(function (a, b) { return (b.waktu + b.id) < (a.waktu + a.id) ? -1 : 1; });
    var aktif = all.filter(function (o) { return o.status !== 'Batal'; });
    var lunas = aktif.filter(function (o) { return !o.piutangId || o.status === 'Lunas'; }), hutang = aktif.filter(function (o) { return o.piutangId && o.status !== 'Lunas'; });
    var omzet = aktif.reduce(function (s, o) { return s + o.total; }, 0), kg = aktif.reduce(function (s, o) { return s + o.berat; }, 0);
    var perProd = {}; aktif.forEach(function (o) { o.items.forEach(function (i) { perProd[i.nama] = (perProd[i.nama] || 0) + Number(i.qty); }); });
    var dom = Object.keys(perProd).sort(function (a, b) { return perProd[b] - perProd[a]; }).slice(0, 2).map(function (n) { return n.split(' ').slice(0, 2).join(' '); });
    var kmr = d.kemarin || {}, dn = aktif.length - (kmr.n || 0);
    if (el.querySelector('#psOmzet')) el.querySelector('#psOmzet').textContent = rp(omzet);
    var hariLbl = st.tanggal === hariIni() ? 'hari ini' : tglSingkat(st.tanggal);
    el.querySelector('#psKpi').innerHTML =
      kpiHtml('Total Pesanan', String(aktif.length), (kmr.n != null ? '<span class="' + (dn >= 0 ? 'up' : 'down') + '">' + (dn >= 0 ? '↑ ' : '↓ ') + Math.abs(dn) + ' order</span> dari kemarin' : hariLbl), 'receipt-text') +
      kpiHtml('Lunas Terverifikasi', String(lunas.length), (aktif.length ? Math.round(lunas.length / aktif.length * 1000) / 10 : 0) + '% terbayar', 'badge-check', 'paid') +
      kpiHtml('Hutang / Pending', String(hutang.length), owner ? '<span class="text-coral">' + rp(hutang.reduce(function (s, o) { return s + o.total - o.dp; }, 0)) + ' tertunda</span>' : 'nota tempo ' + hariLbl, 'clipboard-clock', 'coral', 'coral') +
      kpiHtml('Volume Tangkapan', angka(Math.round(kg * 10) / 10) + '<small>kg</small>', dom.length ? dom.join(' & ') + ' dominan' : 'belum ada timbangan', 'scale', 'amber');
    // daftar petugas
    var ps = el.querySelector('#psPetugas'), cur = ps.value, petugas = {};
    all.forEach(function (o) { if (o.oleh) petugas[o.oleh] = o.petugas || o.oleh; });
    ps.innerHTML = '<option value="">Semua Kasir / Staff</option>' + Object.keys(petugas).map(function (k) { return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(petugas[k]) + '</option>'; }).join('');
    var rows = all.filter(function (o) {
      if (st.status === 'Lunas' && !(o.status === 'Lunas')) return false;
      if (st.status === 'Hutang' && !(o.status === 'Hutang')) return false;
      if (st.status === 'Batal' && o.status !== 'Batal') return false;
      if (st.petugas && o.oleh !== st.petugas) return false;
      return !st.cari || (o.id + ' ' + o.pelanggan + ' ' + o.items.map(function (i) { return i.nama; }).join(' ')).toLowerCase().indexOf(st.cari) > -1;
    });
    st.filtered = rows;
    var maxH = Math.max(1, Math.ceil(rows.length / st.per)); if (st.hal > maxH) st.hal = maxH;
    var page = rows.slice((st.hal - 1) * st.per, st.hal * st.per);
    var langganan = {}; AppState.pelanggan.forEach(function (p) { if (p.langganan) langganan[p.id] = true; });
    el.querySelector('#psTbl tbody').innerHTML = page.length ? page.map(function (o) {
      var hut = o.status === 'Hutang', sub = hut ? '<span class="text-coral" style="font-weight:600">Jatuh Tempo: ' + tglSingkat(o.jatuhTempo) + '</span>' : esc([o.tipe, o.alamat].filter(Boolean).join(' • ') || 'Pelanggan umum');
      return '<tr class="click' + (o.status === 'Batal' ? ' dim' : '') + '" data-id="' + esc(o.id) + '"><td class="id">#' + esc(o.id) + '</td><td class="hide-m"><div>' + tglSingkat(o.tanggal) + '</div><div class="sub">' + esc(o.waktu) + ' WIB</div></td>' +
        '<td class="full-m"><div class="cust"><span class="avatar ' + avatarKelas(o.pelanggan) + '">' + inisial(o.pelanggan) + '</span><div><div class="row gap-s" style="flex-wrap:wrap"><b>' + esc(o.pelanggan) + '</b>' + (langganan[o.plgId] ? '<span class="tag-langganan">Langganan</span>' : '') + '</div><div class="sub">' + sub + '</div></div></div></td>' +
        '<td class="full-m"><div class="items-cell">' + o.items.slice(0, 3).map(function (i) { return '<span class="item-chip"><span>' + esc(i.nama) + '</span><b>' + angka(i.qty) + esc(i.satuan) + '</b></span>'; }).join('') + (o.items.length > 3 ? '<span class="sub">+' + (o.items.length - 3) + ' item lain</span>' : '') + '</div></td>' +
        '<td class="r"><span class="total' + (hut ? ' coral' : '') + '">' + rp(o.total) + '</span></td><td class="c">' + badgeStatus(o.status, o.piutangId) + '</td>' +
        '<td class="c hide-m">' + (o.bukti ? '<button class="btn btn-soft btn-icon btn-sm" data-bukti="1" title="Lihat bukti bayar">' + ic('camera', 'sm') + '</button>' : '<span class="muted">–</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="7">' + emptyState('receipt-text', rows.length === all.length ? 'Belum ada pesanan ' + hariLbl : 'Tidak ada pesanan yang cocok', rows.length === all.length && App.izin('pesanan_input') ? 'Catat pesanan pertama dengan tombol <b>+ Tambah Pesanan</b>.' : 'Ubah filter atau kata kunci pencarian.') + '</td></tr>';
    el.querySelector('#psFoot').innerHTML = '<span class="row gap-s"><span class="live-dot"></span>Menampilkan <b>' + (rows.length ? (st.hal - 1) * st.per + 1 : 0) + ' - ' + Math.min(st.hal * st.per, rows.length) + '</b> dari <b>' + rows.length + '</b> pesanan ' + hariLbl + '</span>' + pagerHtml(st.hal, rows.length, st.per);
    var bt = Struk.BT.terhubung(), pr = Struk.pengaturan(), pt = d.piutangTempo;
    el.querySelector('#psInfo').innerHTML =
      '<div class="card info-card lift" data-act="printer" style="cursor:pointer"><span class="ic-box amber">' + ic('printer') + '</span><div><div class="t">Cetak Cepat Kasir</div><div class="d">' + (bt ? 'Printer <b>' + esc(Struk.BT.nama) + '</b> terhubung via Bluetooth. ' : 'Printer thermal ' + pr.lebar + ' mm • ') + 'Struk ' + (pr.salinan > 1 ? 'rangkap ' + pr.salinan : '1 lembar') + (pr.hemat ? ' mode ultra hemat' : '') + '. Klik untuk atur printer.</div></div></div>' +
      '<div class="card info-card lift" data-act="sinkron" style="cursor:pointer"><span class="ic-box">' + ic('refresh-cw') + '</span><div><div class="t">Sinkronisasi Timbangan</div><div class="d">Seluruh input berat tercatat langsung ke Google Sheets tanpa selisih. Pembaruan otomatis tiap 20 detik saat layar aktif.</div></div></div>' +
      (owner ? '<div class="card info-card lift" data-act="piutang" style="cursor:pointer"><span class="ic-box coral">' + ic('bell-ring') + '</span><div><div class="t coral">Peringatan Piutang Tempo</div><div class="d">' + (pt && pt.n ? pt.n + ' invoice jatuh tempo dalam 48 jam ke depan' + (pt.nama && pt.nama.length ? ' (' + esc(pt.nama.join(' & ')) + ')' : '') + (pt.lewat ? ', ' + pt.lewat + ' sudah lewat tempo' : '') + '.' : 'Tidak ada piutang yang jatuh tempo dalam 48 jam.') + '</div></div></div>'
        : '<div class="card info-card"><span class="ic-box paid">' + ic('shield-check') + '</span><div><div class="t">Data Terkunci Aman</div><div class="d">Setiap nota disidik SHA-256 & dikunci LockService saat disimpan. Pembatalan wajib izin Owner.</div></div></div>');
  },
  ekspor: function () {
    var rows = this.st.filtered || [];
    if (!rows.length) return toast('Tidak ada data', 'Daftar kosong.', 'warn');
    eksporXLSX('Pesanan ' + this.st.tanggal + '.xlsx', [{ nama: 'Pesanan ' + this.st.tanggal, kolom: ['Nota', 'Tanggal', 'Jam', 'Pelanggan', 'Tipe', 'Rincian', 'Berat (kg)', 'Subtotal', 'Diskon', 'Total', 'Status', 'Metode', 'Jatuh Tempo', 'Petugas', 'Catatan'],
      rows: rows.map(function (o) { return [o.id, o.tanggal, o.waktu, o.pelanggan, o.tipe, o.items.map(function (i) { return i.nama + ' ' + angka(i.qty) + i.satuan + ' @' + i.harga; }).join('; '), o.berat, o.subtotal, o.diskon, o.total, o.status, o.metode, o.jatuhTempo, o.petugas, o.catatan]; }) }]);
  },
  lihatBukti: function (id) {
    var m = modal({ judul: 'Bukti Bayar ' + esc(id), ikon: 'camera', lebar: 'mid', isi: '<div class="skel" style="height:320px"></div>' });
    api('pesanan.bukti', { id: id }).then(function (r) {
      var b = m.$('.modal-body'); if (!b) return;
      if (!r.success) { b.innerHTML = retryBox(r); return; }
      b.innerHTML = r.data.dataUrl ? (/pdf/.test(r.data.dataUrl) ? '<iframe src="' + r.data.dataUrl + '" style="width:100%;height:70vh;border:0"></iframe>' : '<img src="' + r.data.dataUrl + '" style="width:100%;border-radius:12px">') : '<a class="btn btn-primary" target="_blank" href="' + esc(r.data.url) + '">Buka di Google Drive</a>';
    });
  },

  /* ---------- detail nota ---------- */
  detail: function (id) {
    var lokal = null;
    Object.keys(localStorage).some(function (k) { if (k.indexOf(LS_PREFIX + userKey('pesanan:')) === 0) { try { var d = JSON.parse(localStorage.getItem(k)).data; lokal = d.rows.filter(function (o) { return o.id === id; })[0]; } catch (e) { } } return !!lokal; });
    var dr = drawer({ judul: 'Nota #' + esc(id), ikon: 'receipt-text', sub: 'Detail transaksi, pengurangan stok & integritas audit', isi: lokal ? this.detailHtml(lokal, null) : '<div class="skel" style="height:160px"></div><div class="skel" style="height:220px"></div>' });
    var self = this;
    api('pesanan.detail', { id: id }).then(function (r) {
      if (dr.closed) return;
      if (!r.success) { dr.set(retryBox(r)); return; }
      var o = r.data; dr.o = o;
      dr.set(self.detailHtml(o, o), self.detailFoot(o));
      self.pasangDetail(dr, o);
    });
  },
  detailHtml: function (o, full) {
    var lunas = !o.piutangId && o.status !== 'Batal', totKg = o.items.reduce(function (s, i) { return s + (i.satuan === 'kg' ? Number(i.qty) : 0); }, 0);
    var h = '<div class="box"><div class="box-title">Ringkasan Pembayaran &amp; Nilai<span class="r muted">Kategori: <b class="text-teal">Transaksi POS</b></span></div><div class="meta-grid">' +
      '<div class="meta"><div class="k">Total Nilai Nota</div><div class="v big">' + rp(o.total) + '</div></div>' +
      '<div class="meta"><div class="k">Metode Pembayaran</div><div class="v">' + ic(o.piutangId ? 'clock-3' : 'banknote', 'sm') + ' ' + esc(o.piutangId ? 'Tempo / Hutang' : o.metode) + '</div></div>' +
      '<div class="meta"><div class="k">' + (o.piutangId ? 'Uang Muka (DP)' : 'Uang Diterima') + '</div><div class="v">' + rp(o.piutangId ? o.dp : o.diterima) + '</div></div>' +
      '<div class="meta"><div class="k">' + (o.piutangId ? 'Jatuh Tempo' : 'Kembalian') + '</div><div class="v">' + (o.piutangId ? tglSingkat(o.jatuhTempo) : rp(o.kembalian) + (o.kembalian ? '' : ' (Pas)')) + '</div></div>' +
      '</div>' + (o.status === 'Batal' ? '<div class="note-coral mt">' + ic('ban', 'sm') + '<span><b>Nota dibatalkan.</b> ' + esc(o.alasanBatal || '') + '</span></div>' : '') + '</div>';
    h += '<div class="box"><div class="box-title">Detail Komoditas &amp; Pengurangan Stok<span class="badge b-hutang">' + ic('trending-down', 'sm') + '-' + angka(totKg) + ' kg Stok Produk</span></div><div class="tbl-wrap"><table class="tbl" style="font-size:14px"><thead><tr><th style="background:none">Item / Spesifikasi</th><th class="r" style="background:none">Kuantitas</th><th class="r" style="background:none">Harga</th><th class="r" style="background:none">Subtotal</th></tr></thead><tbody>' +
      o.items.map(function (i) { return '<tr><td><b>' + esc(i.nama) + '</b><div class="sub">' + esc([i.grade, i.sku].filter(Boolean).join(' • ') || 'Timbangan digital') + '</div></td><td class="r mono" style="color:var(--teal);font-weight:700">' + angka(i.qty) + ' ' + esc(i.satuan) + '</td><td class="r mono">' + rp(i.harga) + '</td><td class="r mono" style="color:var(--paid);font-weight:700">' + rp(i.sub) + '</td></tr>'; }).join('') +
      (o.diskon ? '<tr><td colspan="3" class="r">Diskon</td><td class="r mono">-' + rp(o.diskon) + '</td></tr>' : '') + (o.pajak ? '<tr><td colspan="3" class="r">' + esc((AppState.cfg || {}).pajakLabel || 'Pajak') + '</td><td class="r mono">' + rp(o.pajak) + '</td></tr>' : '') +
      '</tbody></table></div>' + (o.catatan ? '<div class="note-teal mt">' + ic('notebook-pen', 'sm') + '<span><b>Catatan:</b> ' + esc(o.catatan) + '</span></div>' : '') + '</div>';
    h += '<div class="box"><div class="box-title">Pelanggan &amp; Pengiriman</div><div class="meta-grid two"><div class="meta"><div class="k">Pelanggan</div><div class="v">' + esc(o.pelanggan) + (o.tipe ? ' <span class="muted">(' + esc(o.tipe) + ')</span>' : '') + '</div></div><div class="meta"><div class="k">WhatsApp</div><div class="v">' + (o.wa ? '<a href="https://wa.me/' + hp08(o.wa).replace(/^0/, '62') + '" target="_blank" rel="noopener">' + hpTampil(o.wa) + '</a>' : '-') + '</div></div><div class="meta" style="grid-column:1/-1"><div class="k">Alamat Pengantaran</div><div class="v">' + esc(o.alamat || '-') + '</div></div></div></div>';
    if (full) {
      h += '<div class="box"><div class="box-title">Metadata Perangkat &amp; Integritas Audit' + (full.hashValid ? '<span class="r text-paid row gap-s">' + ic('badge-check', 'sm') + 'Valid SHA-256</span>' : '<span class="r text-coral row gap-s">' + ic('shield-alert', 'sm') + 'Sidik tidak cocok</span>') + '</div><div class="meta-grid two">' +
        '<div class="meta"><div class="k">Waktu Eksekusi</div><div class="v mono">' + esc(full.dibuat || (o.tanggal + ' ' + o.waktu)) + ' WIB</div></div>' +
        '<div class="meta"><div class="k">Terminal &amp; Lokasi POS</div><div class="v">' + ic('tablet-smartphone', 'sm') + ' ' + esc(full.terminal || '-') + '</div></div>' +
        '<div class="meta"><div class="k">Dicatat Oleh</div><div class="v">' + esc(o.petugas || '-') + ' <span class="muted">(' + esc(o.oleh || '') + ')</span></div></div>' +
        '<div class="meta"><div class="k">Status Tabel Ledger</div><div class="v">Sheet ' + esc(full.ledger ? full.ledger.sheet : '-') + ' (Row #' + esc(full.ledger ? full.ledger.baris : '-') + ')</div></div>' +
        '</div><div class="label-up mt">Hash Enkripsi Audit Log</div><div class="hash mt-s">sha256:' + esc(full.hash || '') + '</div>' +
        (full.piutang ? '<div class="note-teal mt">' + ic('wallet', 'sm') + '<span>Piutang <b>' + esc(full.piutang.id) + '</b>: ' + esc(full.piutang.status) + ' • terbayar ' + rp(full.piutang.terbayar) + ' • sisa <b>' + rp(full.piutang.sisa) + '</b></span></div>' : '') +
        ((full.dokumen || []).length ? '<div class="mt"><div class="label-up">Dokumen terbit</div>' + full.dokumen.map(function (d) { return '<div class="row mt-s">' + ic('file-text', 'sm') + '<span>' + esc(d.judul) + ' • ' + esc(d.nomor) + '</span><span class="muted">' + esc(d.dibuat) + '</span></div>'; }).join('') + '</div>' : '') + '</div>';
      h += '<div class="note-amber">' + ic('lock', 'sm') + '<span><b>Catatan Kepatuhan Owner:</b> Data transaksi telah dikunci oleh Apps Script LockService. Perubahan nilai hanya lewat pembatalan nota (izin Owner) — stok otomatis dikembalikan dan tercatat di log audit.</span></div>';
    }
    return h;
  },
  detailFoot: function (o) {
    var owner = App.owner(), bisaBatal = o.status !== 'Batal' && (owner || !(AppState.cfg || {}).approvalBatal);
    return '<button class="btn btn-primary" data-d="struk">' + ic('printer', 'sm') + 'Cetak Struk</button>' + (App.izin('struk_wa') ? '<button class="btn btn-wa" data-d="wa">' + ic('message-circle', 'sm') + 'Kirim WA</button>' : '') +
      '<button class="btn btn-outline" data-d="nota">' + ic('file-text', 'sm') + 'Nota PDF</button>' + (o.bukti ? '<button class="btn btn-outline" data-d="bukti">' + ic('camera', 'sm') + 'Bukti</button>' : '') +
      (App.izin('pesanan_input') ? '<button class="btn btn-ghost" data-d="ubah">' + ic('pencil', 'sm') + 'Catatan / Bukti</button>' : '') +
      (bisaBatal ? '<button class="btn btn-danger" data-d="batal" style="margin-left:auto">' + ic('ban', 'sm') + 'Batalkan Nota</button>' : '');
  },
  pasangDetail: function (dr, o) {
    var self = this;
    dr.el.querySelector('.drawer-foot').onclick = function (e) {
      var b = e.target.closest('[data-d]'); if (!b) return;
      var a = b.dataset.d;
      if (a === 'struk') self.struk(o);
      if (a === 'wa') self.wa(o);
      if (a === 'bukti') self.lihatBukti(o.id);
      if (a === 'nota') Dokumen.cetak('NOTA', o.id, b);
      if (a === 'ubah') self.ubahNota(o, dr);
      if (a === 'batal') konfirmasi('Batalkan nota ' + o.id + '?', 'Stok ' + o.items.map(function (i) { return esc(i.nama) + ' ' + angka(i.qty) + i.satuan; }).join(', ') + ' akan dikembalikan' + (o.piutangId ? ' dan piutang dibatalkan' : '') + '. Tindakan tercatat di log audit.', { bahaya: true, ok: 'Batalkan Nota', alasan: 'Alasan pembatalan', ikon: 'ban' }).then(function (alasan) {
        if (!alasan) return;
        setBusy(b, true);
        api('pesanan.batal', { id: o.id, alasan: alasan }).then(function (r) {
          setBusy(b, false); if (!toastRes(r, 'Nota dibatalkan')) return;
          var no = Object.assign({}, o, r.data); self.sisipLokal(no);
          o.items.forEach(function (i) { var p = AppState.produk.filter(function (x) { return x.id === i.id; })[0]; if (p) p.stok = Math.round((p.stok + Number(i.qty)) * 100) / 100; });
          dr.close(); var c = halamanAktif(); if (c && c.name === 'pesanan') Pesanan.render(c.el);
        });
      });
    };
  },
  ubahNota: function (o, dr) {
    var bukti = null;
    var m = modal({ judul: 'Ubah Catatan / Bukti Nota', ikon: 'pencil', sub: 'Nilai transaksi tidak bisa diubah — gunakan pembatalan bila salah timbang.',
      isi: '<div class="field"><label>Catatan</label><textarea class="textarea" id="unCat">' + esc(o.catatan) + '</textarea></div><div class="grid-2 mt"><div class="field"><label>WhatsApp pelanggan</label><input class="input" id="unWa" value="' + esc(hpTampil(o.wa)) + '" inputmode="tel"></div><div class="field"><label>Alamat</label><input class="input" id="unAl" value="' + esc(o.alamat || '') + '"></div></div><div class="field mt"><label>Foto bukti bayar ' + (o.bukti ? '(ganti)' : '') + '</label><div class="upload-box" id="unUp">' + ic('image-plus', 'lg') + '<b>Ambil foto / pilih file</b><span class="muted" style="font-size:12px">Dikompres otomatis</span></div></div>',
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="unOk">Simpan</button>' });
    m.$('#unUp').onclick = function () { pilihFile('image/*,application/pdf', true).then(function (f) { if (!f) return; (/pdf/.test(f.type) ? bacaFile(f) : kompresGambar(f, 1400, 0.75)).then(function (u) { bukti = u; m.$('#unUp').innerHTML = /pdf/.test(f.type) ? ic('file-check-2', 'lg') + '<b>' + esc(f.name) + '</b>' : '<img src="' + u + '">'; }); }); };
    m.$('#unOk').onclick = function () {
      var b = m.$('#unOk'); setBusy(b, true);
      api('pesanan.update', { id: o.id, catatan: m.$('#unCat').value, wa: m.$('#unWa').value, alamat: m.$('#unAl').value, bukti: bukti ? { dataUrl: bukti } : null }).then(function (r) {
        setBusy(b, false); if (!toastRes(r, 'Nota diperbarui')) return;
        m.close(); Pesanan.sisipLokal(r.data); if (dr) { dr.close(); Pesanan.detail(o.id); }
      });
    };
  },

  /* ---------- struk ---------- */
  struk: function (o, setelahSimpan) {
    var self = this, op = Struk.pengaturan();
    var m = modal({ lebar: 'xl', bar: false, raw: true, isi:
      '<div class="modal-head" style="background:var(--cream);border-bottom:1px solid var(--sand-2)"><div class="ic-box teal">' + ic('receipt-text') + '</div><div class="grow"><h3 style="font-family:var(--sans);font-size:20px;font-weight:600;color:var(--ink)" id="skJudul">Preview Cetak Struk</h3><div class="sub">Kasir ' + esc((AppState.brand || {}).lokasi || '') + ' • Portable Thermal Bluetooth</div></div><span class="badge b-info b-mono">#' + esc(o.id) + '</span><span class="srv-pill" id="skPrn" style="background:#fff;color:var(--ink);border-color:var(--sand)"><i></i>Printer</span><button class="modal-x" data-x>' + ic('x') + '</button></div>' +
      '<div class="struk-modal"><div class="struk-left"><div class="row" style="justify-content:space-between;width:100%;margin-bottom:18px"><span class="label-up row gap-s">' + ic('scan-line', 'sm') + 'Simulasi Skala Nyata 1:1</span><span class="badge" style="background:#fff;border:1px solid var(--sand);color:var(--ink)" id="skLebar">Lebar: 58mm</span></div><div id="skPaper"></div><div class="struk-meta" id="skMeta"></div></div>' +
      '<div class="struk-right">' +
      '<div class="row" style="justify-content:space-between"><span class="label-up">Format Lebar Struk</span><span style="font-size:13px;font-weight:600">Optimalisasi ' + esc((AppState.brand || {}).lokasi || 'Dermaga') + '</span></div>' +
      '<div class="fmt-cards mt-s"><button class="fmt-card" data-w="58"><div class="t">58mm (Ringkas)<i>Dipilih</i></div><div class="d">32 Kolom • Mobile Bluetooth</div></button><button class="fmt-card" data-w="80"><div class="t">80mm (Standar POS)<i>Dipilih</i></div><div class="d">48 Kolom • Kasir Induk</div></button></div>' +
      '<div class="field mt"><label>Model struk</label><select class="select" id="skModel"></select></div>' +
      '<div class="note-amber mt" id="skInfo"></div>' +
      '<div class="dev-card mt"><div class="row" style="justify-content:space-between"><span class="row" style="font-size:17px;font-weight:600">' + ic('printer') + 'Perangkat Terkoneksi</span><span id="skDevSt"></span></div><div class="grid-2 mt"><div><div class="label-up">Nama Printer POS</div><div id="skDevNm" style="font-size:17px;font-weight:700;color:var(--teal);margin-top:4px"></div><div class="muted" style="font-size:12.5px" id="skDevSub"></div></div><div><div class="label-up">Metode Cetak</div><select class="select mt-s" id="skMetode"><option value="browser">Dialog cetak browser / aplikasi printer</option><option value="bt">Bluetooth langsung (ESC/POS)</option><option value="rawbt">Aplikasi RawBT (Android)</option></select></div></div><button class="btn btn-outline btn-sm mt" id="skHub">' + ic('bluetooth', 'sm') + 'Hubungkan Printer Bluetooth</button></div>' +
      '<div class="label-up mt-l">Kustomisasi Layout Struk</div><div class="col mt-s">' +
      optRow('skHemat', 'Mode Ultra Hemat Kertas (Sembunyikan QR)', 'Kurangi panjang kertas dengan menonaktifkan kode verifikasi QR.', op.hemat) +
      optRow('skRingkas', 'Cetak Header Ringkas (1 Baris Alamat)', 'Padatkan logo dan alamat nota menjadi format sebaris.', op.headerRingkas) +
      optRow('skLogo', 'Cetak Logo ' + esc((AppState.brand || {}).appName || ''), 'Emblem & alamat usaha di kepala struk.', op.logo) +
      optRow('skTimbang', 'Sertakan Catatan Timbangan Digital', 'Keterangan proteksi timbangan resmi.', op.rincianTimbang) +
      optRow('skBeep', 'Sinyal Suara Beep Selesai', 'Bunyikan buzzer printer (Bluetooth ESC/POS).', op.beep) + '</div>' +
      '<div class="grid-2 mt"><div class="field"><label class="label-up">Jumlah Salinan</label><select class="select" id="skSalin"><option value="1">1 Lembar (Kasir/Cust)</option><option value="2">2 Lembar (Kasir + Pelanggan)</option><option value="3">3 Lembar</option></select></div><div class="field"><label class="label-up">Ketebalan Gambar (Density)</label><select class="select" id="skDens"><option value="pekat">Pekat / Gelap (High Contrast)</option><option value="normal">Normal</option></select></div></div>' +
      '<label class="check mt">' + '<input type="checkbox" id="skCut"' + (op.autoCut ? ' checked' : '') + '> Auto-cut kertas setelah cetak</label>' +
      '<button class="btn btn-accent btn-lg btn-block mt-l" id="skCetak">' + ic('printer') + 'Cetak Struk Sekarang (Enter)</button>' +
      '<div class="grid-2 mt-s"><button class="btn btn-soft" id="skTes">' + ic('list', 'sm') + 'Test Print 1 Baris</button><button class="btn btn-soft" id="skWa" style="color:var(--paid)">' + ic('message-circle', 'sm') + 'Kirim WhatsApp</button></div>' +
      '<div class="grid-2 mt-s"><button class="btn btn-soft" id="skPng">' + ic('download', 'sm') + 'Unduh Gambar PNG</button><button class="btn btn-soft" id="skSalinTeks">' + ic('copy', 'sm') + 'Salin Teks Struk</button></div>' +
      (setelahSimpan ? '<a class="btn btn-primary btn-block mt" href="#/pesanan-baru" id="skBaru">' + ic('plus', 'sm') + 'Pesanan Baru Lagi</a>' : '') +
      '<button class="btn btn-ghost btn-block mt-s" data-x>Tutup Preview' + (setelahSimpan ? '' : ' & Kembali ke Penjualan') + ' (Esc)</button></div></div>' });
    m.box.style.height = 'min(92vh, 980px)';
    var st = Object.assign({}, op, { metode: op.metode || (Struk.BT.terhubung() ? 'bt' : 'browser') });
    var templates = (AppState.struk || []);
    m.$('#skModel').innerHTML = templates.map(function (t) { return '<option value="' + esc(t.kode) + '">' + esc(t.nama) + ' • ' + t.lebar + ' kolom</option>'; }).join('');
    function hasil() { return Struk.baris(o, st); }
    function simpanLokal() { var keep = {}; ['lebar', 'hemat', 'headerRingkas', 'logo', 'rincianTimbang', 'beep', 'salinan', 'density', 'autoCut', 'metode', 'kode'].forEach(function (k) { keep[k] = st[k]; }); Store.set('printerLokal', keep); }
    function render() {
      st.kode = Struk.templatePilihan(Object.assign({}, st, { kode: st.kodeManual || '' }));
      m.$('#skModel').value = st.kode;
      var h = hasil(); m.hasil = h;
      m.$('#skPaper').innerHTML = Struk.html(h);
      var cm = Struk.panjangCm(h), mm = h.kolom > 40 ? 80 : 58;
      m.$('#skLebar').textContent = 'Lebar: ' + mm + 'mm (' + (mm === 80 ? 576 : 384) + ' dots)';
      m.$('#skJudul').textContent = 'Preview Cetak Struk ' + (st.hemat && mm === 58 ? '58mm Ultra Hemat (Tanpa QR)' : (mm === 58 ? 'Ringkas 58mm' : 'Standar 80mm'));
      var penuh = Struk.panjangCm(Struk.baris(o, Object.assign({}, st, { hemat: false, headerRingkas: false, lebar: 80, kodeManual: '', kode: '' }))), hemat = Math.max(0, Math.round((1 - cm / penuh) * 100));
      m.$('#skMeta').innerHTML = '<span class="row gap-s">' + ic('ruler', 'sm') + '<b>Est. Panjang Kertas:</b> ' + angka(cm) + ' cm</span>' + (hemat > 0 ? '<span class="row gap-s text-paid">' + ic('leaf', 'sm') + 'Hemat ' + hemat + '%' + (st.hemat ? ' (Ultra Hemat)' : '') + '</span>' : '');
      m.$('#skInfo').innerHTML = ic(st.hemat ? 'leaf' : 'info', 'sm') + '<span>' + (st.hemat ? '<b>Mode Ultra Hemat aktif:</b> QR code dihilangkan, panjang struk ' + angka(cm) + ' cm. Cocok untuk transaksi cepat antrean dermaga.' : 'Format ' + mm + 'mm ' + (mm === 58 ? 'dioptimalkan untuk mobile printer Bluetooth saku di timbangan dermaga luar.' : 'untuk printer kasir induk (USB/LAN).') + ' Model struk bisa diubah Owner di <b>Pengaturan → Printer & Struk</b>.') + '</span>';
      m.$$('.fmt-card').forEach(function (b) { b.classList.toggle('on', +b.dataset.w === mm); });
      self.segarkanPrinter(m, st);
    }
    m.$$('.fmt-card').forEach(function (b) { b.onclick = function () { st.lebar = +b.dataset.w; st.kodeManual = ''; if (st.lebar === 80) st.hemat = false; m.$('#skHemat').checked = st.hemat; render(); simpanLokal(); }; });
    m.$('#skModel').onchange = function (e) { st.kodeManual = e.target.value; var t = Struk.template(e.target.value); st.lebar = t.lebar > 40 ? 80 : 58; render(); };
    [['skHemat', 'hemat'], ['skRingkas', 'headerRingkas'], ['skLogo', 'logo'], ['skTimbang', 'rincianTimbang'], ['skBeep', 'beep'], ['skCut', 'autoCut']].forEach(function (x) { m.$('#' + x[0]).onchange = function (e) { st[x[1]] = e.target.checked; if (x[1] === 'hemat') st.kodeManual = ''; render(); simpanLokal(); }; });
    m.$('#skSalin').value = String(st.salinan || 1); m.$('#skSalin').onchange = function (e) { st.salinan = +e.target.value; simpanLokal(); };
    m.$('#skDens').value = st.density || 'pekat'; m.$('#skDens').onchange = function (e) { st.density = e.target.value; simpanLokal(); };
    m.$('#skMetode').value = st.metode; m.$('#skMetode').onchange = function (e) { st.metode = e.target.value; simpanLokal(); self.segarkanPrinter(m, st); };
    m.$('#skHub').onclick = function () { Struk.BT.hubungkan().then(function (n) { st.metode = 'bt'; m.$('#skMetode').value = 'bt'; simpanLokal(); toast('Printer terhubung', n); self.segarkanPrinter(m, st); }, function (e) { if (!/cancel/i.test(e.message)) toast('Bluetooth', e.message, 'err'); }); };
    var cetak = function () { self.kirimCetak(m.hasil, st, m.$('#skCetak')); };
    m.$('#skCetak').onclick = cetak;
    m.$('#skTes').onclick = function () { self.kirimCetak({ lines: [{ t: 'TES PRINTER ' + ((AppState.cfg || {}).tokoNama || '') + ' OK', al: 'c', b: true }, { t: new Date().toLocaleString('id-ID'), al: 'c' }, { cut: true }], kolom: m.hasil.kolom, opsi: st, logo: '' }, st, m.$('#skTes')); };
    m.$('#skWa').onclick = function () { self.wa(o); };
    m.$('#skPng').onclick = function () { Struk.png(m.hasil).then(function (u) { unduhDataUrl('Struk ' + o.id + '.png', u); }); };
    m.$('#skSalinTeks').onclick = function () { salinTeks(Struk.teks(m.hasil)).then(function () { toast('Teks struk disalin'); }); };
    m.box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !/SELECT|TEXTAREA|INPUT/.test(e.target.tagName)) { e.preventDefault(); cetak(); } });
    m.box.tabIndex = -1; setTimeout(function () { m.box.focus(); }, 50);
    if (setelahSimpan) { var bb = m.$('#skBaru'); if (bb) bb.onclick = function () { m.close(); }; }
    render();
    return m;
  },
  segarkanPrinter: function (m, st) {
    var c = _modalStack.filter(function (x) { return x.$ && x.$('#skDevNm'); }).pop(); m = m || c; if (!m || !m.$('#skDevNm')) return;
    st = st || Struk.pengaturan();
    var bt = Struk.BT.terhubung(), metode = st.metode || 'browser';
    m.$('#skDevNm').textContent = metode === 'bt' ? (bt ? Struk.BT.nama : 'Belum terhubung') : metode === 'rawbt' ? 'RawBT Print Service' : 'Printer sistem / driver';
    m.$('#skDevSub').textContent = metode === 'bt' ? (Struk.BT.didukung() ? 'ESC/POS via Web Bluetooth' : 'Web Bluetooth tidak didukung browser ini') : metode === 'rawbt' ? 'Aplikasi Android RawBT (ESC/POS)' : 'Dialog cetak browser, ' + (st.lebar || 58) + ' mm';
    m.$('#skDevSt').innerHTML = (metode !== 'bt' || bt) ? '<span class="badge b-lunas">● Siap Cetak</span>' : '<span class="badge b-sebagian">● Perlu dihubungkan</span>';
    var p = m.$('#skPrn'); if (p) { p.innerHTML = '<i style="background:' + ((metode !== 'bt' || bt) ? '#1B7340' : '#E8A33D') + '"></i>Printer Siap: ' + esc(metode === 'bt' ? (Struk.BT.nama || 'BT') : metode === 'rawbt' ? 'RawBT' : 'Browser'); }
    m.$('#skHub').hidden = metode !== 'bt' || bt;
  },
  kirimCetak: function (hasil, st, btn) {
    if (st.metode === 'bt' || st.metode === 'rawbt') {
      setBusy(btn, true, 'Mencetak…');
      var lanjut = st.metode === 'bt' && !Struk.BT.terhubung() ? Struk.BT.hubungkan() : Promise.resolve();
      lanjut.then(function () { return Struk.escpos(hasil); }).then(function (bytes) {
        if (st.metode === 'rawbt') { Struk.rawbt(bytes); return; }
        var tugas = Promise.resolve(); for (var i = 0; i < Math.max(1, st.salinan || 1); i++) tugas = tugas.then(function () { return Struk.BT.kirim(bytes); });
        return tugas;
      }).then(function () { setBusy(btn, false); toast('Struk dikirim ke printer', (st.salinan || 1) + ' lembar'); }, function (e) { setBusy(btn, false); toast('Gagal mencetak', e.message + ' — mencoba dialog cetak browser.', 'err'); Struk.cetakBrowser(hasil, st.salinan); });
    } else Struk.cetakBrowser(hasil, st.salinan);
  },
  aturPrinter: function () {
    var o = { id: 'ORD-CONTOH-0001', kode: 'CONTOH1234', tanggal: hariIni(), waktu: '09:42', pelanggan: 'Pelanggan Tunai Dermaga', petugas: (AppState.user || {}).nama, items: [{ nama: 'Kakap Merah Segar', grade: 'Grade A', qty: 12.5, satuan: 'kg', harga: 95000, sub: 1187500 }], subtotal: 1187500, total: 1187500, metode: 'Tunai', diterima: 1187500, kembalian: 0, status: 'Lunas', berat: 12.5 };
    this.struk(o);
  },

  /* ---------- kirim WhatsApp ---------- */
  wa: function (o) {
    var self = this, cfg = AppState.cfg || {}, plg = AppState.pelanggan.filter(function (p) { return p.id === o.plgId; })[0], gw = !!cfg.waGateway;
    var st = { format: 'lengkap', rincian: true, link: true, salinan: false };
    var m = modal({ lebar: 'xl', bar: 'green', raw: true, isi:
      '<div class="modal-head" style="border-bottom:1px solid var(--sand-2)"><div class="ic-box">' + ic('message-square-text') + '</div><div class="grow"><h3 style="font-family:var(--sans);font-size:20px;font-weight:600;color:var(--ink)">Preview &amp; Kirim Struk via WhatsApp <span class="badge b-info b-mono" style="vertical-align:3px">#' + esc(o.id) + '</span></h3><div class="sub">Nota Digital Otomatis • ' + (gw ? 'Terintegrasi WhatsApp Gateway (Fonnte)' : 'Buka langsung di WhatsApp') + '</div></div><span class="badge ' + (gw ? 'b-lunas' : 'b-sebagian') + '">● ' + (gw ? 'Gateway WA Online' : 'Gateway belum diatur') + '</span><button class="modal-x" data-x>' + ic('x') + '</button></div>' +
      '<div class="wa-modal" style="position:relative"><div class="wa-left">' +
      '<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--sand-2);padding-bottom:10px"><span class="label-up row gap-s">' + ic('contact-round', 'sm') + 'Tujuan &amp; Profil Pelanggan</span>' + (plg ? '<span class="badge b-info">Pelanggan Terdaftar</span>' : '<span class="badge b-sebagian">Pelanggan Umum</span>') + '</div>' +
      '<div class="field mt"><label class="label-up">Nomor WhatsApp Penerima</label><div class="row"><span class="wa-prefix" style="height:46px">🇮🇩 +62</span><div class="affix grow" style="height:46px"><input id="waNo" inputmode="tel" value="' + esc(hp08(o.wa || (plg && plg.wa) || '').replace(/^0/, '')) + '" placeholder="812-xxxx-xxxx"><span class="ad r" id="waOk"></span></div></div></div>' +
      '<div class="field mt"><label class="label-up"><span>Nama Pelanggan / Restoran</span><a href="#" id="waPilih" style="text-transform:none;letter-spacing:0;font-weight:500">Pilih dari Kontak Buku Kas</a></label><input class="input soft" id="waNama" value="' + esc(o.pelanggan || '') + '"></div>' +
      '<div class="label-up mt-l">Pilihan Format Pesan</div><div class="grid-3 mt-s"><button class="choice" data-f="lengkap"><div class="row" style="justify-content:space-between"><span class="t">Lengkap</span>' + ic('circle-check', 'sm') + '</div><div class="d">Struk + Detail Kg</div></button><button class="choice" data-f="ringkas"><span class="t">Ringkas</span><div class="d">Hanya Total &amp; Item</div></button><button class="choice" data-f="link"><span class="t">Link Saja</span><div class="d">URL Nota Digital</div></button></div>' +
      '<div class="label-up mt-l">Opsi Tambahan Pengiriman</div><div class="col mt-s">' +
      optRow('waRinc', 'Sertakan Rincian Timbangan Digital', angka(o.berat) + ' kg ' + esc(o.items.map(function (i) { return i.nama; }).slice(0, 2).join(', ')), true, 'scale') +
      optRow('waLink', 'Sertakan Link Unduh Struk Resmi', 'Halaman verifikasi QR dengan sidik SHA-256', true, 'link') +
      optRow('waOwner', 'Kirim Salinan ke Owner', gw ? 'Lewat gateway ke WA Owner • Laporan Kasir' : 'Butuh gateway WhatsApp aktif', false, 'copy') + '</div>' +
      '<div class="gw-card mt ' + (gw ? '' : 'off') + '"><span class="live-dot' + (gw ? '' : ' amber') + '"></span><div class="grow"><b style="color:' + (gw ? 'var(--paid)' : 'var(--amber-700)') + '">' + (gw ? 'WhatsApp Business Gateway Terhubung' : 'Gateway WhatsApp belum aktif') + '</b><div class="muted" style="font-size:12.5px">' + (gw ? 'Pesan dikirim otomatis dari nomor usaha via Fonnte.' : 'Gunakan "Buka di WA Web" — pesan dibuka di aplikasi WhatsApp perangkat ini.') + (App.owner() && !gw ? ' Atur di menu WhatsApp & CRM.' : '') + '</div></div>' + ic('radio-tower') + '</div>' +
      '</div><div class="wa-right"><div class="wa-chat-head"><span class="avatar" style="background:var(--teal);color:#fff">' + inisial((AppState.brand || {}).appName) + '</span><div class="grow"><b>' + esc(cfg.tokoNama || 'Via Seafood') + '</b><div class="muted" style="font-size:12px">online • akun resmi bisnis</div></div><span class="badge" style="background:#fff;color:var(--paid)">' + ic('eye', 'sm') + 'Live WA Preview</span></div>' +
      '<div class="wa-bubble" id="waBubble"></div><div class="row mt" style="background:#fff;border-radius:12px;padding:12px 14px;font-size:12.5px;justify-content:space-between;flex-wrap:wrap"><span class="row gap-s muted">' + ic('shield-check', 'sm') + 'Struk bisa diverifikasi lewat tautan resmi</span><b>Estimasi tiba: ' + (gw ? 'Instan (&lt; 1 mnt)' : 'Langsung saat Anda kirim') + '</b></div></div></div>' +
      '<div class="modal-foot"><div class="left"><button class="btn btn-soft" data-x>Batal / Kembali (Esc)</button><button class="btn btn-soft" id="waSalin">' + ic('copy', 'sm') + 'Salin Teks Pesan</button></div><button class="btn btn-outline" id="waWeb">' + ic('external-link', 'sm') + 'Buka di WA Web</button>' + (gw ? '<button class="btn btn-wa btn-lg" id="waKirim">' + ic('send-horizontal', 'sm') + 'Kirim via WhatsApp (Enter)</button>' : '') + '</div>' });
    m.box.style.height = 'min(92vh, 900px)';
    function teks() { return Struk.waTeks(Object.assign({}, o, { pelanggan: m.$('#waNama').value || o.pelanggan }), st.format, { rincian: st.rincian, link: st.link }); }
    function nomor() { return hp08('0' + m.$('#waNo').value.replace(/^0+/, '')); }
    function render() {
      m.$('#waBubble').innerHTML = Struk.waHtml(teks()) + '<span class="tm">' + new Date().toTimeString().slice(0, 5) + ' ✓✓</span>';
      m.$$('.choice').forEach(function (b) { b.classList.toggle('on', b.dataset.f === st.format); });
      m.$('#waOk').innerHTML = hpValid(nomor()) ? '<span class="text-paid">' + ic('badge-check', 'sm') + '</span>' : '';
    }
    m.$$('.choice').forEach(function (b) { b.onclick = function () { st.format = b.dataset.f; render(); }; });
    m.$('#waRinc').onchange = function (e) { st.rincian = e.target.checked; render(); };
    m.$('#waLink').onchange = function (e) { st.link = e.target.checked; render(); };
    m.$('#waOwner').onchange = function (e) { st.salinan = e.target.checked; };
    m.$('#waNo').oninput = render; m.$('#waNama').oninput = render;
    m.$('#waPilih').onclick = function (e) { e.preventDefault(); var inp = m.$('#waNama'); inp.value = ''; inp.focus(); var wrap = document.createElement('div'); inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
      Combo({ el: wrap, items: function () { return AppState.pelanggan; }, cari: function (p) { return p.nama + ' ' + p.wa; }, render: function (p) { return '<div class="cm"><b>' + esc(p.nama) + '</b><span>' + esc(p.tipe) + ' • ' + hpTampil(p.wa) + '</span></div>'; }, onPick: function (p) { inp.value = p.nama; m.$('#waNo').value = hp08(p.wa).replace(/^0/, ''); render(); } }).buka(); };
    m.$('#waSalin').onclick = function () { salinTeks(teks()).then(function () { toast('Teks disalin', 'Tempel di WhatsApp.'); }); };
    m.$('#waWeb').onclick = function () { var n = nomor(); window.open('https://wa.me/' + (hpValid(n) ? n.replace(/^0/, '62') : '') + '?text=' + encodeURIComponent(teks()), '_blank', 'noopener'); };
    var kirim = function () {
      var n = nomor(); if (!hpValid(n)) { m.$('#waNo').parentNode.classList.add('is-err'); return toast('Nomor tidak valid', 'Contoh: 812-9876-5432', 'err'); }
      var b = m.$('#waKirim'); setBusy(b, true, 'Mengirim…');
      api('struk.kirimWA', { id: o.id, nomor: n, pesan: teks(), salinanOwner: st.salinan, simpanNomor: true }).then(function (r) {
        setBusy(b, false);
        if (!r.success) { if (r.data && r.data.code === 'NO_GATEWAY') m.$('#waWeb').click(); return toast('Gagal kirim', r.message, 'err'); }
        var ok = r.data.status === 'Terkirim';
        var pop = document.createElement('div'); pop.className = 'sent-pop';
        pop.innerHTML = '<div class="row" style="align-items:flex-start"><span class="ic-box paid" style="border-radius:50%">' + ic(ok ? 'circle-check' : 'clock-3') + '</span><div class="grow"><b style="font-size:17px">' + (ok ? 'Struk Berhasil Terkirim via WhatsApp!' : 'Struk Masuk Antrean Pengiriman') + '</b><div class="muted" style="font-size:13px;margin-top:4px">Nota <b>#' + esc(o.id) + '</b> ' + (ok ? 'sukses diteruskan ke gateway' : 'akan dikirim dalam ±1 menit') + ' untuk <b>+62 ' + esc(hpTampil(n).slice(1)) + '</b> (' + esc(m.$('#waNama').value) + ') • ' + angka(r.data.ms / 1000) + ' detik.</div></div><span class="badge ' + (ok ? 'b-lunas' : 'b-sebagian') + ' b-mono">' + (ok ? 'Terkirim ✓✓' : 'Antri') + '</span><button class="modal-x" id="spX">' + ic('x') + '</button></div><div class="row mt" style="justify-content:space-between;border-top:1px solid var(--sand-2);padding-top:10px;font-size:13px"><span class="row gap-s"><span class="live-dot"></span>ID Antrean: ' + esc(r.data.antrianId) + '</span><a href="https://wa.me/' + n.replace(/^0/, '62') + '" target="_blank" rel="noopener">Buka di Web WA ' + ic('external-link', 'sm') + '</a></div>';
        m.$('.wa-modal').appendChild(pop); pop.querySelector('#spX').onclick = function () { pop.remove(); };
        if (b) { b.className = 'btn btn-wa btn-lg'; b.innerHTML = ic('circle-check', 'sm') + (ok ? 'Terkirim ke WhatsApp ✓' : 'Masuk antrean'); }
        if (!hp08(o.wa)) { o.wa = n; Pesanan.sisipLokal(o); }
      });
    };
    if (m.$('#waKirim')) m.$('#waKirim').onclick = kirim;
    m.box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && m.$('#waKirim')) { e.preventDefault(); kirim(); } });
    render();
  }
};
function kpiHtml(label, nilai, foot, ikon, ikKelas, labelKelas, valKelas) {
  return '<div class="card kpi"><div class="kpi-top"><div class="kpi-label ' + (labelKelas || '') + '">' + esc(label) + '</div>' + (ikon ? '<span class="ic-box ' + (ikKelas || '') + '">' + ic(ikon) + '</span>' : '') + '</div><div class="kpi-val ' + (labelKelas === 'coral' ? 'coral ' : '') + (valKelas || '') + '">' + nilai + '</div><div class="kpi-foot">' + (foot || '') + '</div></div>';
}
function optRow(id, judul, desk, on, ikon) {
  return '<label class="opt-row" for="' + id + '">' + (ikon ? '<span class="muted">' + ic(ikon) + '</span>' : '') + '<span class="grow"><div class="t">' + judul + '</div><div class="d">' + desk + '</div></span><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '></label>';
}

registerPage('pesanan', { judul: 'Pesanan Harian', perm: 'pesanan_lihat', template: function () { return Pesanan.template(); }, init: function (el) { Pesanan.init(el); }, show: function (el) { Pesanan.show(el); }, tick: function (el) { Pesanan.tick(el); }, tickMs: 20000, tickIdleMs: 60000 });

/* ==========================================================================
   INPUT PESANAN BARU (Mode Cepat)
   ========================================================================== */
var InputPesanan = {
  F: null,
  baru: function () {
    var cfg = AppState.cfg || {};
    return { reqId: reqIdBaru(), tanggal: hariIni(), pelanggan: { id: '', nama: '', wa: '', alamat: '', tipe: '', tempo: 0, baru: false }, items: [{ produkId: '', qty: '', harga: '' }],
      statusBayar: 'Lunas', metode: 'Tunai', diterima: '', dp: '', tempoHari: cfg.tempoDefault || 7, jatuhTempo: '', diskon: '', catatan: '', bukti: null };
  },
  template: function () {
    var u = AppState.user || {};
    return '<div class="order-wrap"><div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px"><div><a href="#/pesanan" class="row gap-s" style="color:var(--ink);font-weight:500">' + ic('arrow-left', 'sm') + 'Kembali ke Daftar Pesanan</a><h1 class="page-title" style="margin-top:12px">Input Pesanan Baru <span class="badge b-info" style="font-family:var(--sans);font-size:12px;vertical-align:8px">● Mode Cepat</span></h1></div>' +
      '<div class="card row" style="padding:10px 16px"><span class="ic-box sm" style="background:transparent">' + ic('id-card') + '</span><div><div class="label-up" style="font-size:10.5px">Petugas Aktif</div><b>' + esc(u.nama) + ' (' + (u.role === 'OWNER' ? 'Owner' : esc(u.penugasan || 'Staff')) + ')</b></div></div></div>' +
      '<div class="order-banner mt"><span class="ob-ic">' + ic('anchor') + '</span><div><div class="ob-k" id="ipLok"></div><div class="ob-v" id="ipStokTot"></div></div><div class="ob-r">' + ic('badge-check', 'sm') + '<span>Stok live tersinkronisasi</span></div></div>' +
      // 1. pelanggan
      '<div class="card sec-card"><div class="sec-head">' + ic('contact-round') + '<span class="t">1. Data Pelanggan &amp; Waktu</span><span class="r">Kwitansi No: <b id="ipNoNota">#otomatis</b></span></div><div class="sec-body"><div class="grid-2">' +
      '<div class="field"><label>Waktu Transaksi <span class="req">*</span></label><div class="row"><div class="affix soft grow"><span class="ad">' + ic('calendar', 'sm') + '</span><input type="date" id="ipTgl"></div><div class="affix soft" style="width:120px"><input type="time" id="ipJam" disabled></div></div><span class="hint" id="ipTglHint">Waktu otomatis tercatat saat nota disimpan</span></div>' +
      '<div class="field"><label><span>Nama Pelanggan / Restoran <span class="req">*</span></span><a href="#" id="ipPlgBaru" style="color:var(--coral);font-weight:600;font-size:12.5px">' + ic('user-plus', 'sm') + ' + Pelanggan Baru</a></label><div id="ipPlgWrap"><div class="with-ic">' + ic('store') + '<input class="input soft" id="ipPlg" placeholder="Cari atau ketik nama pelanggan…" autocomplete="off"></div></div><div class="quick-chips mt-s" id="ipChips"></div></div>' +
      '<div class="field"><label>No. Kontak / WhatsApp</label><div class="affix soft"><span class="ad">+62</span><input id="ipWa" inputmode="tel" placeholder="812-8890-4412"><span class="ad r" style="color:var(--teal)">' + ic('message-square-text', 'sm') + '</span></div></div>' +
      '<div class="field"><label>Alamat Pengantaran / Meja Pengambilan</label><div class="affix soft"><span class="ad">' + ic('truck', 'sm') + '</span><input id="ipAlamat" placeholder="Jl. / meja ambil di dermaga"></div></div>' +
      '<div class="field" id="ipTipeWrap" hidden><label>Tipe Pelanggan Baru</label><select class="select" id="ipTipe"></select></div>' +
      '</div></div></div>' +
      // 2. item
      '<div class="card sec-card"><div class="sec-head">' + ic('fish') + '<span class="t">2. Rincian Item Produk Laut</span><span class="r"><span class="badge b-amber" id="ipJmlItem">0 Item</span></span></div><div class="sec-body"><div id="ipItems"></div>' +
      '<button class="add-row" data-act="tambah">' + ic('circle-plus') + 'Tambah Baris Produk Laut (F2)</button>' +
      '<div class="total-card"><span class="ic-box amber" style="background:var(--amber);color:var(--ink)">' + ic('banknote') + '</span><div><div class="label-up" style="color:var(--ink)">Total Keseluruhan Nota</div><div class="muted" style="font-size:12.5px" id="ipBerat">Total Berat Bersih: 0 kg</div></div><div class="big"><div class="v" id="ipTotalBig">Rp 0</div><div style="font-size:12px;color:var(--paid);font-weight:600" id="ipPot"></div></div></div>' +
      '<div class="grid-3 mt"><div class="field"><label>Diskon / Potongan (Rp)</label><div class="affix soft"><span class="ad">Rp</span><input id="ipDiskon" inputmode="numeric" placeholder="0"></div></div><div class="field"><label id="ipPajakLbl">Pajak</label><div class="affix soft"><span class="ad">Rp</span><input id="ipPajak" readonly></div></div><div class="field"><label>Subtotal</label><div class="affix soft"><span class="ad">Rp</span><input id="ipSub" readonly></div></div></div>' +
      // 3. pembayaran
      '<div class="label-up mt-l row gap-s" style="color:var(--ink)">' + ic('wallet', 'sm') + 'Skema Pembayaran <span class="req">*</span></div><div class="pay-grid mt-s">' +
      '<label class="pay-card lunas" id="pcLunas"><input type="radio" name="ipBayar" value="Lunas" checked><div><div class="t">● Lunas Langsung <span class="badge b-dark" style="background:var(--paid);font-size:11px">Tunai / Transfer</span></div><div class="d">Uang kas langsung masuk buku harian, tidak menambah saldo piutang.</div></div></label>' +
      '<label class="pay-card hutang" id="pcHutang"><input type="radio" name="ipBayar" value="Hutang"><div><div class="t">○ Hutang / Tempo (Piutang) <span class="badge b-hutang" id="ipTempoBadge" style="font-size:11px">Jatuh Tempo 7 Hari</span></div><div class="d" id="ipHutangDesc">Masuk ke Buku Piutang Pelanggan.</div></div></label></div>' +
      '<div class="pay-extra" id="ipLunasX"><div class="field"><label>Metode</label><div class="seg" id="ipMetode"><button data-m="Tunai" class="on">Tunai</button><button data-m="Transfer">Transfer</button><button data-m="QRIS">QRIS</button></div></div><div class="field" id="ipTerimaWrap"><label>Uang Diterima</label><div class="affix soft"><span class="ad">Rp</span><input id="ipTerima" inputmode="numeric" placeholder="Pas"></div><div class="quick-chips" id="ipPas"></div></div><div class="field"><label>Kembalian</label><div class="affix soft"><span class="ad">Rp</span><input id="ipKembali" readonly value="0"></div></div></div>' +
      '<div class="pay-extra" id="ipHutangX" hidden><div class="field"><label>Jatuh Tempo</label><input class="input soft" type="date" id="ipJT"></div><div class="field"><label>Tempo (hari)</label><div class="seg" id="ipTempoSeg"><button data-t="3">3</button><button data-t="7">7</button><button data-t="14">14</button><button data-t="30">30</button></div></div><div class="field"><label>Uang Muka (DP) <span class="hint">opsional</span></label><div class="affix soft"><span class="ad">Rp</span><input id="ipDp" inputmode="numeric" placeholder="0"></div></div></div>' +
      '<div class="grid-2 mt"><div class="field"><label><span>Catatan / Instruksi Pengiriman</span><span class="muted" style="font-weight:500">Opsional</span></label><textarea class="textarea soft" id="ipCatatan" placeholder="Mis. pengiriman siang jam 13:00, tambah es batu di coolbox"></textarea></div>' +
      '<div class="field"><label><span>Foto Nota / Slip Transfer</span><span class="muted" style="font-weight:500">Maks 5 MB</span></label><div class="upload-box" id="ipUpload">' + ic('image-plus', 'lg') + '<b style="margin-top:6px">Ambil Foto / Pilih File</b><span class="muted" style="font-size:12px">Klik untuk upload bukti fisik</span></div></div></div>' +
      '</div></div>' +
      '<div class="note-teal mt" id="ipNote">' + ic('info', 'sm') + '<span id="ipNoteTx"></span></div>' +
      '<div class="sticky-total"><span class="ic-box sm">' + ic('shopping-cart') + '</span><div><div class="lb">Total Pembayaran</div><div class="vv" id="ipTotal">Rp 0</div></div><div class="acts"><button class="btn btn-soft" data-act="batal">Batal</button><button class="btn btn-outline opt" data-act="draft">' + ic('printer', 'sm') + 'Draft Nota</button><button class="btn btn-accent btn-lg" data-act="simpan" id="ipSimpan">' + ic('save', 'sm') + 'Simpan Pesanan (Potong Stok)</button></div></div></div>';
  },
  init: function (el) {
    var self = this;
    this.el = el;
    bindActs(el, {
      tambah: function () { self.tambahBaris(true); },
      batal: function () { konfirmasi('Batalkan input pesanan?', 'Isian form akan dikosongkan.').then(function (ok) { if (ok) { self.F = self.baru(); Store.del(userKey('draftNota')); self.isiForm(); location.hash = '#/pesanan'; } }); },
      draft: function () { self.simpanDraft(); toast('Draft nota disimpan', 'Tersimpan di perangkat ini.'); self.previewDraft(); },
      simpan: function () { self.simpan(); },
      hapus: function (a) { self.F.items.splice(+a.dataset.i, 1); if (!self.F.items.length) self.F.items.push({ produkId: '', qty: '', harga: '' }); self.renderItems(); self.hitung(); },
      pas: function (a) { el.querySelector('#ipTerima').value = a.dataset.v === 'pas' ? '' : angka(+a.dataset.v); self.F.diterima = a.dataset.v === 'pas' ? '' : +a.dataset.v; self.hitung(); }
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'F2') { e.preventDefault(); self.tambahBaris(true); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key.toLowerCase() === 's')) { e.preventDefault(); self.simpan(); }
    });
    var $ = function (s) { return el.querySelector(s); };
    $('#ipTgl').onchange = function (e) { self.F.tanggal = e.target.value || hariIni(); $('#ipJam').disabled = self.F.tanggal === hariIni(); self.hitung(); self.simpanDraft(); };
    $('#ipJam').onchange = function (e) { self.F.waktu = e.target.value; };
    $('#ipWa').oninput = function (e) { self.F.pelanggan.wa = e.target.value; self.simpanDraft(); };
    $('#ipAlamat').oninput = function (e) { self.F.pelanggan.alamat = e.target.value; self.simpanDraft(); };
    $('#ipTipe').onchange = function (e) { self.F.pelanggan.tipe = e.target.value; };
    $('#ipDiskon').oninput = function (e) { self.F.diskon = parseAngka(e.target.value); self.hitung(); };
    $('#ipTerima').oninput = function (e) { self.F.diterima = e.target.value === '' ? '' : parseAngka(e.target.value); self.hitung(false); };
    $('#ipDp').oninput = function (e) { self.F.dp = parseAngka(e.target.value); self.hitung(false); };
    $('#ipJT').onchange = function (e) { self.F.jatuhTempo = e.target.value; self.hitung(false); };
    $('#ipCatatan').oninput = function (e) { self.F.catatan = e.target.value; self.simpanDraft(); };
    el.querySelectorAll('input[name=ipBayar]').forEach(function (r) { r.onchange = function () { self.F.statusBayar = r.value; self.hitung(); }; });
    $('#ipMetode').onclick = function (e) { var b = e.target.closest('[data-m]'); if (!b) return; self.F.metode = b.dataset.m; self.hitung(); };
    $('#ipTempoSeg').onclick = function (e) { var b = e.target.closest('[data-t]'); if (!b) return; self.F.tempoHari = +b.dataset.t; self.F.jatuhTempo = tglTambah(self.F.tanggal, +b.dataset.t); self.hitung(); };
    $('#ipUpload').onclick = function (e) {
      if (e.target.closest('.x')) { self.F.bukti = null; self.renderBukti(); return; }
      pilihFile('image/*,application/pdf', true).then(function (f) { if (!f) return; if (f.size > 5 * 1024 * 1024 && /pdf/.test(f.type)) return toast('Berkas terlalu besar', 'Maksimal 5 MB.', 'err');
        (/pdf/.test(f.type) ? bacaFile(f) : kompresGambar(f, 1400, 0.72)).then(function (u) { self.F.bukti = { dataUrl: u, nama: f.name, pdf: /pdf/.test(f.type) }; self.renderBukti(); }); });
    };
    $('#ipPlgBaru').onclick = function (e) { e.preventDefault(); self.F.pelanggan = { id: '', nama: $('#ipPlg').value.trim(), wa: '', alamat: '', tipe: 'Eceran', tempo: 0, baru: true }; self.isiPelanggan(); $('#ipPlg').focus(); };
    Combo({ el: $('#ipPlgWrap'), items: function () { return AppState.pelanggan.slice().sort(function (a, b) { return (b.langganan - a.langganan) || (b.trx - a.trx) || a.nama.localeCompare(b.nama); }); },
      cari: function (p) { return p.nama + ' ' + p.wa + ' ' + p.tipe; },
      render: function (p) { return '<span class="avatar ' + avatarKelas(p.nama) + '" style="width:30px;height:30px;font-size:11px">' + inisial(p.nama) + '</span><div class="cm"><b>' + esc(p.nama) + (p.langganan ? ' <span class="tag-langganan">Langganan</span>' : '') + '</b><span>' + esc([p.tipe, hpTampil(p.wa)].filter(Boolean).join(' • ')) + '</span></div>'; },
      footer: function (q) { return ic('user-plus', 'sm') + ' ' + (q ? 'Pakai "' + esc(q) + '" sebagai pelanggan baru' : 'Pelanggan baru…'); },
      onFooter: function (q) { self.F.pelanggan = { id: '', nama: q, wa: '', alamat: '', tipe: 'Eceran', tempo: 0, baru: true }; self.isiPelanggan(); },
      onPick: function (p) { self.pilihPelanggan(p); } });
    $('#ipPlg').addEventListener('input', function (e) { if (self.F.pelanggan.id && e.target.value !== self.F.pelanggan.nama) { self.F.pelanggan.id = ''; } self.F.pelanggan.nama = e.target.value; self.simpanDraft(); });
  },
  show: function (el) {
    if (!this.F) { var d = Store.get(userKey('draftNota'), null); this.F = d && d.items ? d : this.baru(); if (d && d.items && d.items.some(function (i) { return i.produkId; })) toast('Draft dipulihkan', 'Lanjutkan input pesanan yang belum disimpan.'); }
    if (!App.izin('tanggal_mundur')) this.F.tanggal = hariIni();
    this.isiForm();
    var self = this; setTimeout(function () { if (!self.F.pelanggan.nama) el.querySelector('#ipPlg').focus(); }, 60);
  },
  isiForm: function () {
    var el = this.el, F = this.F, cfg = AppState.cfg || {}, $ = function (s) { return el.querySelector(s); };
    $('#ipLok').textContent = ((AppState.brand || {}).lokasi || 'Dermaga') + ' • Buku Kas Harian';
    var kg = AppState.produk.filter(function (p) { return p.aktif && p.satuan === 'kg'; }).reduce(function (s, p) { return s + Math.max(0, p.stok); }, 0);
    $('#ipStokTot').textContent = 'Tangkapan Segar Tersedia: ' + angka(Math.round(kg * 10) / 10) + ' kg • ' + AppState.produk.filter(function (p) { return p.aktif && p.stok > 0; }).length + ' komoditas';
    $('#ipTgl').value = F.tanggal; $('#ipTgl').max = hariIni(); $('#ipTgl').disabled = !App.izin('tanggal_mundur');
    $('#ipJam').disabled = F.tanggal === hariIni(); $('#ipJam').value = F.waktu || new Date().toTimeString().slice(0, 5);
    $('#ipTglHint').textContent = App.izin('tanggal_mundur') ? 'Boleh tanggal mundur (izin aktif). Jam otomatis untuk hari ini.' : 'Waktu otomatis tercatat saat nota dibuat';
    $('#ipTipe').innerHTML = selectOpts(cfg.tipePelanggan || ['Eceran'], F.pelanggan.tipe || 'Eceran');
    $('#ipDiskon').value = F.diskon ? angka(F.diskon) : ''; $('#ipTerima').value = F.diterima ? angka(F.diterima) : ''; $('#ipDp').value = F.dp ? angka(F.dp) : ''; $('#ipCatatan').value = F.catatan || '';
    $('#ipPajakLbl').textContent = (cfg.pajakLabel || 'Pajak') + ' (' + angka(cfg.pajakPersen || 0) + '%)';
    el.querySelector('input[name=ipBayar][value=' + F.statusBayar + ']').checked = true;
    this.isiPelanggan(); this.renderChips(); this.renderItems(); this.renderBukti(); this.hitung();
  },
  renderChips: function () {
    var self = this, top = AppState.pelanggan.slice().sort(function (a, b) { return (b.langganan - a.langganan) || (b.trx - a.trx); }).slice(0, 4);
    var box = this.el.querySelector('#ipChips');
    box.innerHTML = top.length ? '<span class="lbl">Rekomendasi Cepat:</span>' + top.map(function (p) { return '<button class="qchip ' + (p.langganan ? 'vip' : '') + '" data-p="' + esc(p.id) + '">' + esc(p.nama) + (p.langganan ? ' (VIP)' : '') + '</button>'; }).join('') : '';
    box.onclick = function (e) { var b = e.target.closest('[data-p]'); if (!b) return; var p = AppState.pelanggan.filter(function (x) { return x.id === b.dataset.p; })[0]; if (p) self.pilihPelanggan(p); };
  },
  pilihPelanggan: function (p) {
    var cfg = AppState.cfg || {};
    this.F.pelanggan = { id: p.id, nama: p.nama, wa: p.wa, alamat: p.alamat, tipe: p.tipe, tempo: p.tempo, baru: false, langganan: p.langganan };
    this.F.tempoHari = p.tempo || cfg.tempoDefault || 7; this.F.jatuhTempo = tglTambah(this.F.tanggal, this.F.tempoHari);
    this.isiPelanggan(); this.hitung();
    var q = this.el.querySelector('.item-row input.cari-prod'); if (q && !this.F.items[0].produkId) q.focus();
  },
  isiPelanggan: function () {
    var el = this.el, P = this.F.pelanggan;
    el.querySelector('#ipPlg').value = P.nama || '';
    el.querySelector('#ipWa').value = hp08(P.wa || '').replace(/^0/, '');
    el.querySelector('#ipAlamat').value = P.alamat || '';
    el.querySelector('#ipTipeWrap').hidden = !P.baru;
    el.querySelector('#ipPlgBaru').innerHTML = P.baru ? ic('user-check', 'sm') + ' Pelanggan baru' : ic('user-plus', 'sm') + ' + Pelanggan Baru';
    this.simpanDraft();
  },
  produkAktif: function () { return AppState.produk.filter(function (p) { return p.aktif; }); },
  tambahBaris: function (fokus) { this.F.items.push({ produkId: '', qty: '', harga: '' }); this.renderItems(); if (fokus) { var all = this.el.querySelectorAll('.item-row input.cari-prod'); var last = all[all.length - 1]; if (last) last.focus(); } },
  renderItems: function () {
    var self = this, box = this.el.querySelector('#ipItems'), boleh = App.izin('harga_ubah');
    var pm = {}; AppState.produk.forEach(function (p) { pm[p.id] = p; });
    box.innerHTML = this.F.items.map(function (it, i) {
      var p = pm[it.produkId];
      return '<div class="item-row" data-i="' + i + '"><div class="thumb" style="background-image:url(\'' + esc(App.fotoProduk(p)) + '\')"></div>' +
        '<div class="prod"><div class="lbl">Pilih Produk</div><div class="combo-host"><input class="input cari-prod" style="background:#fff" placeholder="Cari produk / SKU…" value="' + esc(p ? p.nama + ' (Stok: ' + angka(p.stok) + ' ' + p.satuan + ')' : '') + '" autocomplete="off"></div></div>' +
        '<div class="qty"><div class="lbl">Berat / Qty</div><div class="affix" style="background:#fff"><input class="qty-in" inputmode="decimal" style="text-align:center;font-weight:700;font-size:17px" value="' + (it.qty === '' ? '' : String(it.qty).replace('.', ',')) + '" placeholder="0"><span class="ad r">' + esc(p ? p.satuan : 'kg') + '</span></div></div>' +
        '<div class="harga"><div class="lbl">Harga / ' + esc(p ? p.satuan : 'Kg') + '</div><div class="affix" style="background:#fff"><span class="ad">Rp</span><input class="harga-in" inputmode="numeric" style="text-align:right;font-weight:600" value="' + (p ? angka(it.harga !== '' && it.harga != null ? it.harga : p.harga) : '') + '"' + (boleh ? '' : ' readonly title="Harga mengikuti katalog (izin ubah harga tidak aktif)"') + '></div></div>' +
        '<div class="sub-v"><div class="lbl">Subtotal</div><b class="sub-txt">Rp 0</b></div><button class="del" data-act="hapus" data-i="' + i + '" aria-label="Hapus baris">' + ic('trash-2', 'sm') + '</button><div class="stok-warn" hidden></div></div>';
    }).join('');
    box.querySelectorAll('.item-row').forEach(function (row) {
      var i = +row.dataset.i, it = self.F.items[i];
      Combo({ el: row.querySelector('.combo-host'), items: function () { return self.produkAktif(); }, cari: function (p) { return p.nama + ' ' + p.sku + ' ' + p.kategori; },
        render: function (p) { return '<div class="thumb sm" style="background-image:url(\'' + esc(App.fotoProduk(p)) + '\')"></div><div class="cm"><b>' + esc(p.nama) + '</b><span>' + esc(p.sku) + ' • ' + rp(p.harga) + '/' + esc(p.satuan) + '</span></div><div class="cr ' + (p.stok <= 0 ? 'text-coral' : p.status !== 'Aman' ? 'text-amber' : 'text-paid') + '">' + angka(p.stok) + ' ' + esc(p.satuan) + '</div>'; },
        onPick: function (p) { it.produkId = p.id; it.harga = ''; self.renderItems(); self.hitung(); var q = box.querySelectorAll('.item-row')[i].querySelector('.qty-in'); if (q) q.focus(); } });
      row.querySelector('.qty-in').oninput = function (e) { it.qty = parseAngka(e.target.value); self.hitung(); };
      row.querySelector('.qty-in').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); if (i === self.F.items.length - 1 && it.produkId) self.tambahBaris(true); else { var nx = box.querySelectorAll('.cari-prod')[i + 1]; if (nx) nx.focus(); } } };
      row.querySelector('.harga-in').oninput = function (e) { it.harga = parseAngka(e.target.value); self.hitung(); };
    });
  },
  totals: function () {
    var F = this.F, cfg = AppState.cfg || {}, pm = {}; AppState.produk.forEach(function (p) { pm[p.id] = p; });
    var sub = 0, kg = 0, n = 0, butuh = {};
    F.items.forEach(function (it) { var p = pm[it.produkId]; if (!p) return; var h = it.harga !== '' && it.harga != null && App.izin('harga_ubah') ? Number(it.harga) : p.harga, q = Number(it.qty) || 0; it._sub = Math.round(q * h); sub += it._sub; if (p.satuan === 'kg') kg += q; if (q > 0) n++; butuh[p.id] = (butuh[p.id] || 0) + q; });
    var disk = Math.min(Math.max(0, Number(F.diskon) || 0), sub), pajak = Math.round((sub - disk) * (Number(cfg.pajakPersen) || 0) / 100);
    return { sub: sub, disk: disk, pajak: pajak, total: sub - disk + pajak, kg: kg, n: n, butuh: butuh, pm: pm };
  },
  hitung: function (renderBayar) {
    var el = this.el, F = this.F, t = this.totals(), cfg = AppState.cfg || {}, $ = function (s) { return el.querySelector(s); };
    el.querySelectorAll('.item-row').forEach(function (row, i) {
      var it = F.items[i], p = t.pm[it && it.produkId]; row.querySelector('.sub-txt').textContent = rp(it && it._sub || 0);
      var w = row.querySelector('.stok-warn');
      if (p && t.butuh[p.id] > p.stok + 1e-9) { w.hidden = false; w.textContent = '⚠ Stok ' + p.nama + ' tersisa ' + angka(p.stok) + ' ' + p.satuan + (cfg.stokMinusBoleh ? ' (stok minus diizinkan)' : ' — kurangi jumlah atau lakukan restock.'); } else w.hidden = true;
    });
    $('#ipJmlItem').textContent = t.n + ' Item Dimasukkan';
    $('#ipBerat').textContent = 'Total Berat Bersih: ' + angka(Math.round(t.kg * 100) / 100) + ' kg (' + t.n + ' Macam Hasil Laut)';
    $('#ipTotalBig').textContent = rp(t.total); $('#ipTotal').textContent = rp(t.total);
    $('#ipPot').innerHTML = t.disk ? ic('badge-percent', 'sm') + ' Sudah termasuk potongan ' + rp(t.disk) : (F.pelanggan.langganan ? ic('badge-check', 'sm') + ' Pelanggan langganan' : '');
    $('#ipSub').value = angka(t.sub); $('#ipPajak').value = angka(t.pajak);
    var lunas = F.statusBayar === 'Lunas';
    $('#pcLunas').classList.toggle('on', lunas); $('#pcHutang').classList.toggle('on', !lunas);
    $('#pcLunas .t').innerHTML = (lunas ? '●' : '○') + ' Lunas Langsung <span class="badge" style="background:var(--paid);color:#fff;font-size:11px">Tunai / Transfer</span>';
    $('#pcHutang .t').innerHTML = (lunas ? '○' : '●') + ' Hutang / Tempo (Piutang) <span class="badge b-hutang" style="font-size:11px">Jatuh Tempo ' + (F.tempoHari || 7) + ' Hari</span>';
    $('#ipHutangDesc').textContent = 'Masuk ke Buku Piutang Pelanggan' + (F.pelanggan.nama ? ' \'' + F.pelanggan.nama + '\'' : '') + '.';
    $('#ipLunasX').hidden = !lunas; $('#ipHutangX').hidden = lunas;
    el.querySelectorAll('#ipMetode button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === F.metode); });
    $('#ipTerimaWrap').style.visibility = F.metode === 'Tunai' ? 'visible' : 'hidden';
    var terima = F.diterima === '' || F.metode !== 'Tunai' ? t.total : Number(F.diterima) || 0;
    $('#ipKembali').value = angka(Math.max(0, terima - t.total)); $('#ipKembali').style.color = terima < t.total ? 'var(--coral)' : '';
    var pas = [t.total, Math.ceil(t.total / 50000) * 50000, Math.ceil(t.total / 100000) * 100000, Math.ceil(t.total / 500000) * 500000].filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; }).slice(0, 4);
    $('#ipPas').innerHTML = t.total ? pas.map(function (v, i) { return '<button class="qchip" data-act="pas" data-v="' + (i === 0 ? 'pas' : v) + '">' + (i === 0 ? 'Uang Pas' : rpRingkas(v)) + '</button>'; }).join('') : '';
    if (!F.jatuhTempo || F.jatuhTempo < F.tanggal) F.jatuhTempo = tglTambah(F.tanggal, F.tempoHari || cfg.tempoDefault || 7);
    $('#ipJT').value = F.jatuhTempo; $('#ipJT').min = F.tanggal;
    el.querySelectorAll('#ipTempoSeg button').forEach(function (b) { b.classList.toggle('on', +b.dataset.t === tglSelisih(F.tanggal, F.jatuhTempo)); });
    var ringkas = F.items.filter(function (it) { return t.pm[it.produkId] && Number(it.qty) > 0; }).map(function (it) { return '<i>' + esc(t.pm[it.produkId].nama) + ' (-' + angka(it.qty) + t.pm[it.produkId].satuan + ')</i>'; });
    $('#ipNoteTx').innerHTML = '<b>Perhatian Kasir:</b> ' + (ringkas.length ? 'Menyimpan pesanan ini akan secara otomatis mengurangi saldo fisik inventaris ' + ringkas.join(' dan ') + ' di gudang pendingin.' : 'Pilih produk dan isi berat. Stok berkurang otomatis saat nota disimpan.') + (lunas ? '' : ' Nota tempo otomatis tercatat di Buku Piutang.');
    this.simpanDraft();
  },
  renderBukti: function () {
    var box = this.el.querySelector('#ipUpload'), b = this.F.bukti;
    box.innerHTML = b ? (b.pdf ? ic('file-check-2', 'lg') + '<b>' + esc(b.nama) + '</b>' : '<img src="' + b.dataUrl + '" alt="Bukti">') + '<button class="btn btn-danger btn-xs x" type="button">' + ic('x', 'sm') + 'Hapus</button>'
      : ic('image-plus', 'lg') + '<b style="margin-top:6px">Ambil Foto / Pilih File</b><span class="muted" style="font-size:12px">Klik untuk upload bukti fisik</span>';
  },
  simpanDraft: debounce(function () { var F = InputPesanan.F; if (!F) return; var c = Object.assign({}, F); if (c.bukti && c.bukti.dataUrl && c.bukti.dataUrl.length > 400000) c.bukti = null; Store.set(userKey('draftNota'), c); }, 400),
  payload: function () {
    var F = this.F, t = this.totals();
    return { tanggal: F.tanggal, waktu: F.tanggal !== hariIni() ? F.waktu : '', pelanggan: { id: F.pelanggan.id, nama: (F.pelanggan.nama || '').trim() || 'Pelanggan Umum', wa: hp08('0' + String(F.pelanggan.wa || '').replace(/^0+/, '')), alamat: F.pelanggan.alamat, tipe: F.pelanggan.tipe },
      items: F.items.filter(function (i) { return i.produkId && Number(i.qty) > 0; }).map(function (i) { return { produkId: i.produkId, qty: Number(i.qty), harga: App.izin('harga_ubah') && i.harga !== '' ? Number(i.harga) : undefined }; }),
      statusBayar: F.statusBayar, metode: F.statusBayar === 'Lunas' ? F.metode : 'Tempo', diterima: F.statusBayar === 'Lunas' && F.metode === 'Tunai' && F.diterima !== '' ? Number(F.diterima) : undefined,
      dp: F.statusBayar === 'Hutang' ? Number(F.dp) || 0 : 0, jatuhTempo: F.statusBayar === 'Hutang' ? F.jatuhTempo : '', diskon: t.disk, catatan: F.catatan, bukti: F.bukti ? { dataUrl: F.bukti.dataUrl } : null };
  },
  validasi: function () {
    var p = this.payload(), t = this.totals(), cfg = AppState.cfg || {};
    if (!p.items.length) return 'Tambahkan minimal satu produk dengan berat/jumlah.';
    if (this.F.items.some(function (i) { return i.produkId && !(Number(i.qty) > 0); })) return 'Ada baris produk dengan berat 0.';
    if (!cfg.stokMinusBoleh) { var lebih = Object.keys(t.butuh).filter(function (id) { return t.butuh[id] > t.pm[id].stok + 1e-9; }); if (lebih.length) return 'Stok tidak cukup: ' + lebih.map(function (id) { return t.pm[id].nama; }).join(', '); }
    if (p.statusBayar === 'Hutang' && (!p.pelanggan.nama || /^pelanggan umum/i.test(p.pelanggan.nama))) return 'Pesanan hutang wajib memakai nama pelanggan.';
    if (p.statusBayar === 'Lunas' && p.diterima !== undefined && p.diterima < t.total) return 'Uang diterima kurang dari total. Pilih Hutang/Tempo bila belum lunas.';
    if (p.pelanggan.wa && !hpValid(p.pelanggan.wa)) return 'Nomor WhatsApp tidak valid.';
    return '';
  },
  simpan: function () {
    var self = this, err = this.validasi(), btn = this.el.querySelector('#ipSimpan');
    if (err) return toast('Periksa isian', err, 'err');
    if (btn.disabled) return;
    setBusy(btn, true, 'Menyimpan & memotong stok…');
    var payload = this.payload();
    api('pesanan.create', payload, { reqId: this.F.reqId }).then(function (r) {
      setBusy(btn, false);
      if (!r.success) { toast('Pesanan belum tersimpan', r.message, 'err'); if (/Stok/.test(r.message)) App.segarkanBoot(true); return; }
      var o = r.data.pesanan;
      App.updateProduk(r.data.produk); if (r.data.pelanggan) App.tambahPelangganLokal({ id: r.data.pelanggan.id, nama: r.data.pelanggan.nama, wa: o.wa, alamat: o.alamat, tipe: payload.pelanggan.tipe || 'Eceran' });
      Pesanan.sisipLokal(o);
      Store.del(userKey('draftNota'));
      self.F = self.baru(); self.isiForm();
      toast('Pesanan Baru Tercatat', '#' + o.id + ' • ' + (o.status === 'Lunas' ? 'Lunas' : 'Tempo') + ' (' + rp(o.total) + ')');
      Pesanan.struk(o, true);
    });
  },
  previewDraft: function () {
    var t = this.totals(), F = this.F, items = F.items.filter(function (i) { return t.pm[i.produkId] && Number(i.qty) > 0; }).map(function (i) { var p = t.pm[i.produkId]; return { nama: p.nama, grade: p.grade, sku: p.sku, qty: Number(i.qty), satuan: p.satuan, harga: i._sub / Number(i.qty), sub: i._sub }; });
    Pesanan.struk({ id: 'DRAFT', kode: '', tanggal: F.tanggal, waktu: new Date().toTimeString().slice(0, 5), pelanggan: F.pelanggan.nama || 'Pelanggan Umum', petugas: (AppState.user || {}).nama, items: items, subtotal: t.sub, diskon: t.disk, pajak: t.pajak, total: t.total, metode: F.metode, diterima: F.diterima || t.total, kembalian: Math.max(0, (F.diterima || t.total) - t.total), status: F.statusBayar === 'Lunas' ? 'Lunas' : 'Hutang', piutangId: F.statusBayar === 'Hutang' ? 'DRAFT' : '', jatuhTempo: F.jatuhTempo, dp: F.dp, berat: t.kg, catatan: 'DRAFT — belum disimpan' });
  }
};
function tglSelisih(a, b) { var pa = String(a).split('-'), pb = String(b).split('-'); return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 864e5); }
registerPage('pesanan-baru', { judul: 'Input Pesanan', perm: 'pesanan_input', template: function () { return InputPesanan.template(); }, init: function (el) { InputPesanan.init(el); }, show: function (el) { InputPesanan.show(el); } });
