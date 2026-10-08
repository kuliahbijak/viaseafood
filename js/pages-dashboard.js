/* ==========================================================================
   VIA SEAFOOD — pages-dashboard.js  (dimuat lazy, khusus Owner)
   Dashboard Owner: KPI, tren penjualan, produk terlaris, kartu foto
   (gambar & teks bisa diganti Superadmin), pesanan terbaru.
   ========================================================================== */
'use strict';
var Dashboard = {
  rentang: 14, data: null,
  template: function () {
    var b = AppState.brand || {};
    return '<div class="page-head"><div><div class="eyebrow">Ringkasan Owner <span class="dot"></span><span class="loc" data-brand-txt="lokasi">' + esc(b.lokasi || '') + '</span></div>' +
      '<h1 class="page-title" id="dbSalam">Selamat Datang</h1><p class="page-sub" id="dbSub">Memuat ringkasan…</p></div>' +
      '<div class="page-actions"><button class="btn btn-outline" data-act="segarkan" title="Segarkan">' + ic('refresh-cw', 'sm') + 'Segarkan</button>' +
      '<a class="btn btn-accent btn-lg" href="#/pesanan-baru">' + ic('plus') + 'Pesanan Baru</a></div></div>' +
      '<div class="kpis" id="dbKpi">' + [1, 2, 3, 4].map(function () { return '<div class="card kpi"><div class="skel" style="height:14px;width:55%"></div><div class="skel mt" style="height:32px;width:70%"></div><div class="skel mt-s" style="height:12px;width:40%"></div></div>'; }).join('') + '</div>' +
      '<div class="dash-grid"><div class="card"><div class="card-head"><div><h3 class="card-title">Tren Penjualan Harian</h3><div class="sub" id="dbTrenSub">Omzet per hari</div></div>' +
      '<div class="seg" id="dbSeg"><button data-n="7">7 Hari</button><button data-n="14" class="on">14 Hari</button><button data-n="30">30 Hari</button></div></div>' +
      '<div class="legend"><span><i style="background:var(--teal)"></i>Omzet</span><span><i style="background:var(--amber)"></i>Rata-rata periode</span><span class="grow"></span><span id="dbTrenTotal"></span></div>' +
      '<div class="chart-box" id="dbChart"><div class="skel" style="height:100%"></div></div></div>' +
      '<div class="card"><div class="card-head"><div><h3 class="card-title">Produk Terlaris</h3><div class="sub">7 hari terakhir • menurut omzet</div></div><a class="btn btn-ghost btn-sm" href="#/produk">' + ic('archive', 'sm') + 'Stok</a></div><div class="top-list" id="dbTop"></div></div></div>' +
      '<div class="photo-cards" id="dbFoto"></div>' +
      '<div class="card" style="margin-top:var(--gut);overflow:hidden"><div class="card-head"><div><h3 class="card-title">Pesanan Terbaru Hari Ini</h3><div class="sub" id="dbTbSub">5 nota terakhir yang tercatat</div></div><a class="btn btn-outline btn-sm" href="#/pesanan">Lihat semua ' + ic('arrow-right', 'sm') + '</a></div>' +
      '<div class="tbl-wrap"><table class="tbl cards" id="dbTerbaru"><thead><tr><th>Nota</th><th>Pelanggan</th><th>Rincian</th><th class="r">Total</th><th class="c">Status</th><th class="hide-m">Waktu</th></tr></thead><tbody>' + skeletonRows(4, 6) + '</tbody></table></div></div>';
  },
  init: function (el) {
    var self = this;
    bindActs(el, { segarkan: function (b) { setBusy(b, true); self.muat(el, true).then(function () { setBusy(b, false); }); }, muat: function () { self.muat(el, true); } });
    el.querySelector('#dbSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      self.rentang = +b.dataset.n; el.querySelectorAll('#dbSeg button').forEach(function (x) { x.classList.toggle('on', x === b); });
      if (self.data) self.grafik(el, self.data);
    });
    el.querySelector('#dbTerbaru').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr) Pesanan.detail(tr.dataset.id); });
    el.querySelector('#dbFoto').addEventListener('click', function (e) { var c = e.target.closest('[data-link]'); if (c) location.hash = c.dataset.link; });
  },
  show: function (el) { this.salam(el); this.muat(el); },
  tick: function (el) { this.salam(el); this.muat(el); },
  muat: function (el, paksa) {
    var self = this;
    return swr('dashboard', 'dashboard', paksa ? { _fresh: 1 } : {}, function (d) { self.render(el, d); }, { fresh: 45000, force: paksa,
      onError: function (r) { el.querySelector('#dbKpi').innerHTML = '<div class="card span-all" style="grid-column:1/-1">' + retryBox(r) + '</div>'; } });
  },
  salam: function (el) {
    var j = new Date().getHours(), s = j < 11 ? 'Selamat Pagi' : j < 15 ? 'Selamat Siang' : j < 18 ? 'Selamat Sore' : 'Selamat Malam';
    var u = AppState.user || {}; el.querySelector('#dbSalam').innerHTML = s + ', ' + esc(String(u.nama || '').split(' ')[0]) + ' <span class="greet-pill" style="vertical-align:middle">Owner</span>';
  },
  render: function (el, d) {
    if (!d || !d.hariIni) return;
    this.data = d;
    var h = d.hariIni, bl = d.bulanIni, pi = d.piutang, st = d.stok;
    el.querySelector('#dbSub').textContent = tglPanjang(h.tanggal) + ' • diperbarui ' + waktuRelatif(d.dibuat);
    var delta = function (v, teks) { return v == null ? '<span class="muted">' + teks + '</span>' : '<span class="delta' + (v < 0 ? ' neg' : '') + '">' + (v < 0 ? '↓ ' : '↑ ') + angka(Math.abs(v), 1) + '%</span> ' + teks; };
    var targetBar = bl.target ? '<div style="width:100%"><div class="progress ' + (bl.persenTarget >= 100 ? '' : 'amber') + '" style="margin-top:4px"><i style="width:' + Math.min(100, bl.persenTarget) + '%"></i></div><div style="margin-top:4px">' + bl.persenTarget + '% dari target ' + rpRingkas(bl.target) + '</div></div>' : '';
    el.querySelector('#dbKpi').innerHTML =
      kpiHtml('Penjualan Hari Ini', '<span class="money">' + rp(h.omzet) + '</span>', delta(h.delta, 'vs kemarin (' + rpRingkas(h.kemarin) + ')'), 'banknote', '', '', 'money') +
      kpiHtml('Penjualan Bulan Ini', rp(bl.omzet), delta(bl.delta, bl.n + ' nota bulan ini') + targetBar, 'trending-up', 'paid', '', 'money') +
      '<div class="card kpi tint-coral lift" data-link="#/keuangan/piutang" style="cursor:pointer"><div class="kpi-top"><div class="kpi-label coral">Piutang Outstanding</div><span class="ic-box coral">' + ic('clipboard-clock') + '</span></div><div class="kpi-val coral money">' + rp(pi.total) + '</div><div class="kpi-foot">' + pi.n + ' nota belum lunas' + (pi.tempo ? ' • <b class="text-coral">' + pi.tempo + ' jatuh tempo ≤2 hari</b>' : '') + (pi.lewat ? ' • ' + pi.lewat + ' lewat tempo' : '') + '</div></div>' +
      kpiHtml('Total Stok Gudang', angka(st.totalKg) + '<small>kg</small>', '<span class="stok-pill ' + (st.status === 'Optimal' ? '' : st.status === 'Waspada' ? 'warn' : 'danger') + '">' + esc(st.status) + '</span> ' + st.komoditas + ' komoditas' + (st.menipis ? ' • ' + st.menipis + ' menipis' : ''), 'archive', 'amber');
    var kp = el.querySelector('[data-link="#/keuangan/piutang"]'); if (kp) kp.onclick = function () { location.hash = '#/keuangan/piutang'; };
    this.grafik(el, d);
    var top = d.terlaris || [];
    el.querySelector('#dbTop').innerHTML = top.length ? top.map(function (t, i) {
      return '<div class="top-item"><div class="tr"><span>' + (i + 1) + '. ' + esc(t.nama) + '</span><span class="num">' + rpRingkas(t.omzet) + '</span></div><div class="sb"><span>' + angka(t.qty) + ' ' + esc(t.satuan || 'kg') + ' terjual</span><span>sisa ' + angka(t.stok) + ' ' + esc(t.satuan || 'kg') + (t.status !== 'Aman' ? ' • <b class="text-coral">' + esc(t.status) + '</b>' : '') + '</span></div>' +
        '<div class="progress ' + (t.status === 'Aman' ? '' : t.status === 'Menipis' ? 'amber' : 'coral') + '"><i style="width:' + Math.max(4, t.persen) + '%"></i></div></div>';
    }).join('') : emptyState('fish', 'Belum ada penjualan', 'Produk terlaris muncul setelah ada pesanan.');
    var kartu = (AppState.brand && AppState.brand.kartu) || [];
    el.querySelector('#dbFoto').innerHTML = kartu.map(function (k, i) {
      var link = k.metrik === 'stok_masuk' ? '#/produk' : k.metrik === 'pesanan_hari' ? '#/pesanan' : '#/pelanggan';
      return '<div class="card photo-card lift" data-link="' + link + '" style="cursor:pointer"><div class="pc-img" data-img="' + i + '"><span class="pc-badge' + (i === 1 ? ' amber' : '') + '">' + esc(k.badge) + '</span><div class="pc-title">' + esc(k.judul) + '</div></div>' +
        '<div class="pc-body"><div><div class="l">' + esc(k.label) + '</div><div class="v">' + esc((d.kartu && d.kartu[k.metrik]) || k.teks || '-') + '</div></div><span class="ic-box sm">' + ic(k.ikon || 'anchor') + '</span></div></div>';
    }).join('');
    el.querySelectorAll('#dbFoto [data-img]').forEach(function (x) { var k = kartu[+x.dataset.img]; App.pasangGambar(x, k.img || App.gambar('kartu' + (+x.dataset.img + 1))); });
    var tb = d.terbaru || [];
    el.querySelector('#dbTbSub').textContent = h.n + ' nota hari ini • ' + angka(h.berat) + ' kg tertimbang';
    el.querySelector('#dbTerbaru tbody').innerHTML = tb.length ? tb.map(function (o) {
      var items = []; try { items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []); } catch (e) { }
      return '<tr class="click' + (o.status === 'Batal' ? ' dim' : '') + '" data-id="' + esc(o.id) + '"><td class="id">#' + esc(o.id) + '</td><td class="full-m"><div class="cust"><span class="avatar ' + avatarKelas(o.pelanggan) + '">' + inisial(o.pelanggan) + '</span><div><b>' + esc(o.pelanggan) + '</b><div class="sub">' + esc(o.tipe || '') + '</div></div></div></td>' +
        '<td class="hide-m"><div class="items-cell">' + items.slice(0, 2).map(function (i) { return '<span class="item-chip"><span>' + esc(i.nama) + '</span><b>' + angka(i.qty) + esc(i.satuan) + '</b></span>'; }).join('') + (items.length > 2 ? '<span class="sub">+' + (items.length - 2) + '</span>' : '') + '</div></td>' +
        '<td class="r"><span class="total' + (o.status === 'Hutang' ? ' coral' : '') + '">' + rp(o.total) + '</span></td><td class="c">' + badgeStatus(o.status, o.piutangId) + '</td><td class="hide-m muted">' + esc(String(o.waktu || '').slice(0, 5)) + ' WIB</td></tr>';
    }).join('') : '<tr><td colspan="6">' + emptyState('receipt-text', 'Belum ada pesanan hari ini', 'Pesanan baru langsung tampil di sini.') + '</td></tr>';
  },
  grafik: function (el, d) {
    var n = this.rentang, tren = (d.tren || []).slice(-n), box = el.querySelector('#dbChart');
    var total = tren.reduce(function (s, t) { return s + t.omzet; }, 0), rata = tren.length ? total / tren.length : 0;
    el.querySelector('#dbTrenSub').textContent = 'Omzet harian • ' + n + ' hari terakhir';
    el.querySelector('#dbTrenTotal').innerHTML = 'Total <b class="text-teal">' + rp(total) + '</b>';
    Grafik.render(box, { tipe: 'garis', judul: 'Tren penjualan', labels: tren.map(function (t) { return +t.tanggal.slice(8, 10) + ' ' + BLN[+t.tanggal.slice(5, 7) - 1]; }), labelTip: tren.map(function (t) { return tglPanjang(t.tanggal); }),
      series: [{ nama: 'Omzet', data: tren.map(function (t) { return t.omzet; }), warna: '#0D4F4F' }, { nama: 'Rata-rata', data: tren.map(function () { return Math.round(rata); }), warna: '#E8A33D', putus: true }],
      ekstra: function (i) { return '<div class="k">' + tren[i].n + ' nota • ' + angka(tren[i].berat) + ' kg</div>'; } });
  }
};
registerPage('dashboard', { auth: 'owner', judul: 'Dashboard', template: function () { return Dashboard.template(); }, init: function (el) { Dashboard.init(el); }, show: function (el) { Dashboard.show(el); }, tick: function (el) { Dashboard.tick(el); }, tickMs: 60000, tickIdleMs: 180000 });
