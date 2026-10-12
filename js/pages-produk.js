/* ==========================================================================
   VIA SEAFOOD — pages-produk.js
   Katalog Produk & Stok: kartu/tabel produk per kategori, KPI stok,
   tambah/edit produk + foto (kompres di HP), penyesuaian stok multi-produk
   (restok, susut, rusak, opname), riwayat keluar-masuk stok (Log_Stok).
   ========================================================================== */
'use strict';
var Produk = {
  st: { kat: '', cari: '', status: '', tampil: 'grid', data: null },
  template: function () {
    var b = AppState.brand || {};
    return '<div class="page-head"><div><div class="eyebrow">Inventaris Cold Storage <span class="dot"></span><span class="loc">' + esc(b.lokasi || '') + '</span></div><h1 class="page-title">Katalog Produk &amp; Stok</h1><p class="page-sub">Harga per satuan, stok real-time, dan riwayat keluar-masuk barang</p></div>' +
      '<div class="page-actions"><button class="btn btn-outline" data-act="riwayat">' + ic('history', 'sm') + 'Riwayat Stok</button>' +
      (App.izin('stok_kelola') ? '<button class="btn btn-outline" data-act="sesuaikan">' + ic('scale', 'sm') + 'Penyesuaian Stok</button>' : '') +
      (App.izin('produk_kelola') ? '<button class="btn btn-accent btn-lg" data-act="tambah">' + ic('plus') + 'Tambah Produk</button>' : '') + '</div></div>' +
      '<div class="kpis" id="pdKpi"></div>' +
      '<div class="card" style="margin-top:var(--gut)"><div class="filter-bar"><div class="cat-tabs grow" id="pdKat"></div></div>' +
      '<div class="filter-bar" style="padding-top:0"><div class="searchbox grow" style="max-width:320px">' + ic('search') + '<input class="input soft" id="pdCari" placeholder="Cari nama, SKU, grade…"></div>' +
      '<label class="filter-pill">' + ic('filter', 'sm') + '<select id="pdStatus"><option value="">Semua status stok</option><option value="perlu">Perlu restok</option><option value="Aman">Aman</option><option value="Menipis">Menipis</option><option value="Kritis">Kritis</option><option value="Habis">Habis</option><option value="nonaktif">Nonaktif</option></select></label>' +
      '<span class="grow"></span><div class="seg" id="pdView"><button data-v="grid" class="on">' + ic('layout-grid', 'sm') + '</button><button data-v="tabel">' + ic('list', 'sm') + '</button></div></div></div>' +
      '<div id="pdList" style="margin-top:var(--gut)"><div class="prod-grid">' + [1, 2, 3, 4].map(function () { return '<div class="card prod-card"><div class="skel" style="aspect-ratio:4/3"></div><div class="pbody"><div class="skel" style="height:14px;width:40%"></div><div class="skel mt-s" style="height:18px"></div><div class="skel mt-s" style="height:22px;width:60%"></div></div></div>'; }).join('') + '</div></div>' +
      '<div class="split-2-1" style="margin-top:var(--gut)"><div class="card" style="overflow:hidden"><div class="card-head"><div><h3 class="card-title">Pergerakan Stok Terbaru</h3><div class="sub">Masuk, keluar karena penjualan, dan koreksi — tercatat otomatis</div></div><button class="btn btn-ghost btn-sm" data-act="riwayat">Semua ' + ic('arrow-right', 'sm') + '</button></div>' +
      '<div class="tbl-wrap"><table class="tbl cards" id="pdLog"><thead><tr><th>Waktu</th><th>Produk</th><th>Jenis</th><th class="r">Jumlah</th><th class="r hide-m">Stok Akhir</th><th class="hide-m">Oleh</th></tr></thead><tbody>' + skeletonRows(4, 6) + '</tbody></table></div></div>' +
      '<div class="card card-pad" id="pdPasokan"></div></div>';
  },
  init: function (el) {
    var self = this, st = this.st;
    st.tampil = Store.get('pdView', 'grid');
    el.querySelectorAll('#pdView button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === st.tampil); });
    el.querySelector('#pdView').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; st.tampil = b.dataset.v; Store.set('pdView', st.tampil); el.querySelectorAll('#pdView button').forEach(function (x) { x.classList.toggle('on', x === b); }); self.renderList(el); };
    el.querySelector('#pdKat').onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; st.kat = b.dataset.v; self.renderKat(el); self.renderList(el); };
    el.querySelector('#pdCari').oninput = debounce(function (e) { st.cari = e.target.value.trim().toLowerCase(); self.renderList(el); }, 200);
    el.querySelector('#pdStatus').onchange = function (e) { st.status = e.target.value; self.renderList(el); };
    bindActs(el, {
      tambah: function () { self.form(null); },
      sesuaikan: function () { self.sesuaikan(); },
      riwayat: function () { self.riwayat(); },
      muat: function () { self.muat(el, true); },
      restok: function () { self.sesuaikan(null, 'Restock Masuk', (st.data && st.data.kpi.restok || []).map(function (r) { return r.id; })); }
    });
    el.querySelector('#pdList').addEventListener('click', function (e) {
      var m = e.target.closest('[data-menu]'); if (m) { e.stopPropagation(); self.menu(m, m.dataset.menu); return; }
      var s = e.target.closest('[data-stok]'); if (s) { e.stopPropagation(); self.sesuaikan(s.dataset.stok); return; }
      var c = e.target.closest('[data-id]'); if (c) self.detail(c.dataset.id);
    });
  },
  show: function (el) { this.muat(el); this.muatLog(el); },
  tick: function (el) { this.muat(el); },
  muat: function (el, paksa) {
    var self = this;
    var lokal = AppState.produk && AppState.produk.length ? { produk: AppState.produk, kpi: null } : null;
    if (lokal && !swrPeek('produk')) { this.st.data = lokal; this.render(el); }
    return swr('produk', 'produk.list', {}, function (d) { self.st.data = d; AppState.produk = d.produk; self.render(el); }, { fresh: 30000, force: paksa,
      onError: function (r) { if (!self.st.data) el.querySelector('#pdList').innerHTML = '<div class="card">' + retryBox(r) + '</div>'; } });
  },
  muatLog: function (el) {
    swr('stoklog', 'stok.log', { limit: 12 }, function (d) {
      el.querySelector('#pdLog tbody').innerHTML = d.rows.length ? d.rows.slice(0, 12).map(Produk.barisLog).join('') : '<tr><td colspan="6">' + emptyState('history', 'Belum ada pergerakan stok bulan ini') + '</td></tr>';
    }, { fresh: 20000, batch: true });
  },
  barisLog: function (r) {
    var jen = r.jumlah > 0 ? 'in' : r.tipe === 'Stok Opname' || /Koreksi/.test(r.tipe) ? 'adj' : 'out';
    return '<tr><td class="hide-m muted nowrap">' + esc(waktuRelatif(r.waktu)) + '</td><td class="full-m"><b>' + esc(r.produk) + '</b><div class="sub">' + esc(r.ket || '') + (r.ref ? ' • ' + esc(r.ref) : '') + '</div></td>' +
      '<td><span class="ttype ' + jen + '">' + ic(jen === 'in' ? 'arrow-down-to-line' : jen === 'out' ? 'arrow-up-from-line' : 'scale', 'sm') + esc(r.tipe) + '</span></td>' +
      '<td class="r num" style="font-weight:700;color:' + (r.jumlah > 0 ? 'var(--paid)' : 'var(--coral)') + '">' + (r.jumlah > 0 ? '+' : '') + angka(r.jumlah) + ' ' + esc(r.satuan) + '</td><td class="r num hide-m">' + angka(r.sesudah) + '</td><td class="hide-m muted">' + esc(r.oleh || '') + '</td></tr>';
  },
  render: function (el) {
    var d = this.st.data; if (!d) return;
    var list = d.produk || [], aktif = list.filter(function (p) { return p.aktif; }), k = d.kpi;
    if (!k) { var restok = aktif.filter(function (p) { return p.status !== 'Aman'; }); k = { skuAktif: aktif.length, kategori: 0, restok: restok, totalKg: aktif.reduce(function (s, p) { return s + (p.satuan === 'kg' ? Math.max(0, p.stok) : 0); }, 0) }; }
    var kats = {}; aktif.forEach(function (p) { kats[p.kategori] = 1; });
    el.querySelector('#pdKpi').innerHTML =
      kpiHtml('Produk Aktif', String(k.skuAktif), Object.keys(kats).length + ' kategori komoditas', 'package') +
      kpiHtml('Total Stok', angka(k.totalKg) + '<small>kg</small>', 'semua komoditas bersatuan kg', 'archive', 'paid') +
      '<div class="card kpi ' + (k.restok.length ? 'tint-coral' : '') + '"><div class="kpi-top"><div class="kpi-label ' + (k.restok.length ? 'coral' : '') + '">Perlu Restok</div><span class="ic-box ' + (k.restok.length ? 'coral' : 'paid') + '">' + ic(k.restok.length ? 'triangle-alert' : 'circle-check') + '</span></div><div class="kpi-val ' + (k.restok.length ? 'coral' : '') + '">' + k.restok.length + '<small>produk</small></div><div class="kpi-foot">' + (k.restok.length ? esc(k.restok.slice(0, 2).map(function (r) { return r.nama; }).join(', ')) + (k.restok.length > 2 ? ' +' + (k.restok.length - 2) : '') + (App.izin('stok_kelola') ? ' • <a href="#" data-act="restok">Restok sekarang</a>' : '') : 'Semua stok di atas batas minimum') + '</div></div>' +
      (k.nilaiStok != null ? kpiHtml('Nilai Stok (Harga Jual)', rp(k.nilaiStok), 'estimasi stok × harga jual', 'banknote', 'amber', '', 'money')
        : kpiHtml('Pasokan Hari Ini', k.pasokan && k.pasokan.masukHariIni ? angka(k.pasokan.masukHariIni) + '<small>kg</small>' : '0<small>kg</small>', k.pasokan ? 'terakhir: ' + esc(k.pasokan.produk) : 'belum ada restok hari ini', 'anchor', 'amber'));
    this.renderKat(el); this.renderList(el);
    var p = k.pasokan;
    el.querySelector('#pdPasokan').innerHTML = '<div class="row gap-s"><span class="ic-box amber">' + ic('anchor') + '</span><div><div class="label-up">Pasokan Kapal Terakhir</div><b style="font-size:15px">' + (p ? esc(p.produk) : 'Belum ada restok') + '</b></div></div>' +
      (p ? '<div class="meta-grid two mt"><div class="meta"><div class="k">Jumlah masuk</div><div class="v">' + angka(p.jumlah) + ' ' + esc(p.satuan) + '</div></div><div class="meta"><div class="k">Waktu</div><div class="v">' + esc(waktuRelatif(p.waktu)) + '</div></div><div class="meta"><div class="k">Total masuk hari ini</div><div class="v">' + angka(p.masukHariIni) + ' kg</div></div><div class="meta"><div class="k">Dicatat oleh</div><div class="v">' + esc(p.oleh || '-') + '</div></div></div>' + (p.keterangan ? '<div class="note-teal mt">' + ic('info', 'sm') + '<span>' + esc(p.keterangan) + '</span></div>' : '') : '<p class="muted mt-s">Catat stok masuk dari kapal/pemasok lewat <b>Penyesuaian Stok → Restock Masuk</b>. Ringkasan pasokan muncul di sini & di dashboard Owner.</p>') +
      (App.izin('stok_kelola') ? '<button class="btn btn-primary btn-block mt" data-act="sesuaikan">' + ic('circle-plus', 'sm') + 'Catat Stok Masuk</button>' : '');
  },
  renderKat: function (el) {
    var d = this.st.data; if (!d) return;
    var hitung = {}, total = 0; (d.produk || []).forEach(function (p) { if (!p.aktif) return; hitung[p.kategori] = (hitung[p.kategori] || 0) + 1; total++; });
    var list = [{ v: '', l: 'Semua', n: total }].concat(Object.keys(hitung).sort().map(function (k) { return { v: k, l: k, n: hitung[k] }; }));
    el.querySelector('#pdKat').innerHTML = chipSel(list, this.st.kat);
  },
  filter: function () {
    var st = this.st, list = (st.data && st.data.produk) || [];
    return list.filter(function (p) {
      if (st.status === 'nonaktif') { if (p.aktif) return false; } else if (!p.aktif) return false;
      if (st.kat && p.kategori !== st.kat) return false;
      if (st.status === 'perlu' && p.status === 'Aman') return false;
      if (st.status && ['Aman', 'Menipis', 'Kritis', 'Habis'].indexOf(st.status) > -1 && p.status !== st.status) return false;
      return !st.cari || (p.nama + ' ' + p.sku + ' ' + p.grade + ' ' + p.kategori).toLowerCase().indexOf(st.cari) > -1;
    });
  },
  pill: function (p) { var c = p.status === 'Aman' ? '' : p.status === 'Menipis' ? 'warn' : 'danger'; return '<span class="stok-pill ' + c + '">' + angka(p.stok) + ' ' + esc(p.satuan) + '</span>'; },
  renderList: function (el) {
    var rows = this.filter(), box = el.querySelector('#pdList'), kelola = App.izin('produk_kelola'), stok = App.izin('stok_kelola'), self = this;
    if (!rows.length) { box.innerHTML = '<div class="card">' + emptyState('fish', this.st.data && this.st.data.produk.length ? 'Tidak ada produk yang cocok' : 'Belum ada produk', kelola && !(this.st.data && this.st.data.produk.length) ? 'Tambahkan komoditas pertama dengan tombol <b>Tambah Produk</b>, atau impor dari pembukuan lama di Pengaturan → Migrasi.' : 'Ubah filter atau kata kunci.') + '</div>'; return; }
    if (this.st.tampil === 'tabel') {
      box.innerHTML = '<div class="card" style="overflow:hidden"><div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>Produk</th><th class="hide-m">Kategori</th><th class="r">Harga</th><th class="r">Stok</th><th class="c hide-m">Status</th><th class="hide-m">Diperbarui</th><th></th></tr></thead><tbody>' +
        rows.map(function (p) {
          return '<tr class="click' + (p.aktif ? '' : ' dim') + '" data-id="' + esc(p.id) + '"><td class="full-m"><div class="cust"><span class="thumb sm" data-foto="' + esc(p.id) + '"></span><div><b>' + esc(p.nama) + '</b><div class="sub">' + esc(p.sku) + (p.grade ? ' • ' + esc(p.grade) : '') + '</div></div></div></td><td class="hide-m"><span class="cat-badge">' + esc(p.kategori) + '</span></td>' +
            '<td class="r num">' + rp(p.harga) + '<span class="muted">/' + esc(p.satuan) + '</span></td><td class="r">' + self.pill(p) + '</td><td class="c hide-m">' + esc(p.status) + '</td><td class="hide-m muted">' + esc(waktuRelatif(p.diperbarui)) + '</td>' +
            '<td class="r">' + (kelola || stok ? '<button class="btn btn-ghost btn-icon btn-sm" data-menu="' + esc(p.id) + '" aria-label="Aksi">' + ic('ellipsis-vertical', 'sm') + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    } else {
      box.innerHTML = '<div class="prod-grid">' + rows.map(function (p) {
        var alert = p.status === 'Kritis' || p.status === 'Habis';
        return '<div class="card prod-card lift' + (alert ? ' alert' : '') + (p.aktif ? '' : ' inactive') + '" data-id="' + esc(p.id) + '" style="cursor:pointer"><div class="pimg" data-foto="' + esc(p.id) + '"><span class="pcat">' + esc(p.kategori) + '</span>' +
          (kelola || stok ? '<button class="pmenu" data-menu="' + esc(p.id) + '" aria-label="Aksi produk">' + ic('ellipsis-vertical', 'sm') + '</button>' : '') +
          (alert ? '<span class="pflag">' + (p.status === 'Habis' ? 'STOK HABIS' : 'STOK KRITIS') + '</span>' : !p.aktif ? '<span class="pflag" style="background:var(--muted)">NONAKTIF</span>' : '') + '</div>' +
          '<div class="pbody"><div class="psku">' + esc(p.sku) + (p.grade ? ' • ' + esc(p.grade) : '') + '</div><div class="pname" title="' + esc(p.nama) + '">' + esc(p.nama) + '</div><div class="pprice">' + rp(p.harga) + ' <small>/' + esc(p.satuan) + '</small></div>' +
          '<div class="pstock"><span class="muted" style="font-size:12.5px">Stok ' + (p.stokMin ? '(min ' + angka(p.stokMin) + ')' : '') + '</span>' + self.pill(p) + '</div></div>' +
          (stok && p.aktif ? '<div class="pfoot"><button class="btn btn-soft btn-sm btn-block" data-stok="' + esc(p.id) + '">' + ic('scale', 'sm') + 'Sesuaikan stok</button></div>' : '') + '</div>';
      }).join('') + '</div>';
    }
    box.querySelectorAll('[data-foto]').forEach(function (x) { var p = self.cari(x.dataset.foto); App.pasangGambar(x, App.fotoProduk(p)); });
  },
  cari: function (id) { return (AppState.produk || []).filter(function (p) { return p.id === id; })[0] || ((this.st.data && this.st.data.produk) || []).filter(function (p) { return p.id === id; })[0]; },
  menu: function (btn, id) {
    var p = this.cari(id), self = this, items = [];
    if (!p) return;
    if (App.izin('produk_kelola')) items.push({ label: 'Edit produk & harga', ikon: 'pencil', fn: function () { self.form(p); } }, { label: 'Ganti foto', ikon: 'camera', fn: function () { self.gantiFoto(p); } });
    if (App.izin('stok_kelola') && p.aktif) items.push({ label: 'Sesuaikan stok', ikon: 'scale', fn: function () { self.sesuaikan(p.id); } });
    items.push({ label: 'Riwayat stok produk ini', ikon: 'history', fn: function () { self.riwayat(p.id); } });
    if (App.izin('produk_kelola')) items.push('-', p.aktif ? { label: 'Nonaktifkan produk', ikon: 'archive', bahaya: true, fn: function () { self.nonaktif(p); } } : { label: 'Aktifkan kembali', ikon: 'circle-check', fn: function () { self.simpan(Object.assign({}, p, { aktif: true }), null, 'Produk diaktifkan.'); } });
    popMenu(btn, items);
  },
  detail: function (id) {
    var p = this.cari(id), self = this; if (!p) return;
    var d = drawer({ judul: esc(p.nama), sub: esc(p.sku + ' • ' + p.kategori), ikon: 'fish',
      isi: '<div class="photo-card card" style="overflow:hidden"><div class="pc-img" id="dpImg" style="height:200px"></div></div>' +
        '<div class="meta-grid two mt"><div class="meta"><div class="k">Harga jual</div><div class="v big" style="color:var(--teal)">' + rp(p.harga) + '<span class="muted" style="font-size:13px">/' + esc(p.satuan) + '</span></div></div><div class="meta"><div class="k">Stok saat ini</div><div class="v big" style="color:' + (p.status === 'Aman' ? 'var(--paid)' : 'var(--coral)') + '">' + angka(p.stok) + ' ' + esc(p.satuan) + '</div></div>' +
        '<div class="meta"><div class="k">Batas minimum</div><div class="v">' + angka(p.stokMin) + ' ' + esc(p.satuan) + '</div></div><div class="meta"><div class="k">Status</div><div class="v">' + this.pill(p) + ' ' + esc(p.status) + '</div></div>' +
        '<div class="meta"><div class="k">Grade / mutu</div><div class="v">' + esc(p.grade || '-') + '</div></div><div class="meta"><div class="k">Diperbarui</div><div class="v">' + esc(waktuRelatif(p.diperbarui)) + '</div></div></div>' +
        (p.deskripsi ? '<p class="mt" style="color:var(--ink-2)">' + esc(p.deskripsi) + '</p>' : '') +
        '<div class="box-title mt-l">Riwayat stok bulan ini</div><div id="dpLog"><div class="skel" style="height:120px"></div></div>',
      foot: (App.izin('produk_kelola') ? '<button class="btn btn-outline" data-a="edit">' + ic('pencil', 'sm') + 'Edit</button>' : '') + (App.izin('stok_kelola') && p.aktif ? '<button class="btn btn-primary" data-a="stok">' + ic('scale', 'sm') + 'Sesuaikan Stok</button>' : '') });
    App.pasangGambar(d.$('#dpImg'), App.fotoProduk(p));
    d.el.addEventListener('click', function (e) { var a = e.target.closest('[data-a]'); if (!a) return; d.close(); if (a.dataset.a === 'edit') self.form(p); else self.sesuaikan(p.id); });
    api('stok.log', { produkId: p.id, limit: 50 }).then(function (r) {
      var box = d.$('#dpLog'); if (!box) return;
      box.innerHTML = !r.success ? retryBox(r) : r.data.rows.length ? '<div class="tbl-wrap"><table class="tbl cards"><tbody>' + r.data.rows.map(Produk.barisLog).join('') + '</tbody></table></div>' : '<p class="muted">Belum ada pergerakan stok bulan ini.</p>';
    });
  },

  /* ---------- tambah / edit produk ---------- */
  form: function (p) {
    var c = AppState.cfg || {}, baru = !p, self = this, fotoData = null;
    p = p || { nama: '', kategori: (c.kategori || [])[0] || '', satuan: 'kg', harga: '', stokMin: c.stokMinDefault || 15, grade: '', deskripsi: '', aktif: true, sku: '', urut: 0 };
    var m = modal({ judul: baru ? 'Tambah Produk Baru' : 'Edit Produk', sub: baru ? 'Komoditas baru langsung tersedia di Input Pesanan.' : esc(p.sku), ikon: baru ? 'circle-plus' : 'pencil', lebar: 'wide',
      isi: '<form id="pf" autocomplete="off"><div class="split" style="grid-template-columns:220px minmax(0,1fr)"><div><div class="upload-box" id="pfFoto" style="aspect-ratio:1;min-height:0">' + ic('image-plus', 'lg') + '<b class="mt-s">Foto produk</b><span class="muted" style="font-size:12px">Ketuk untuk ambil/unggah. Dikompres otomatis.</span></div>' +
        (p.foto ? '<button type="button" class="btn btn-ghost btn-sm btn-block mt-s" id="pfFotoHapus">' + ic('trash-2', 'sm') + 'Hapus foto</button>' : '') + '</div>' +
        '<div class="grid-2">' + fld('Nama produk', inp('nama', p.nama, 'required maxlength="80" placeholder="Ikan Kakap Merah Segar" autofocus'), { req: true, cls: 'span-2' }) +
        fld('Kategori', inp('kategori', p.kategori, 'list="pfKat" placeholder="Ikan Segar"') + '<datalist id="pfKat">' + (c.kategori || []).map(function (k) { return '<option value="' + esc(k) + '">'; }).join('') + '</datalist>') +
        fld('SKU / Kode', inp('sku', p.sku, 'maxlength="30" placeholder="Otomatis bila kosong" style="text-transform:uppercase"')) +
        fld('Harga jual', rpInp('harga', p.harga, 'required'), { req: true, hint: 'Harga per satuan' }) +
        fld('Satuan', sel('satuan', (c.satuan && c.satuan.length ? c.satuan : ['kg', 'ekor', 'pack']), p.satuan)) +
        fld('Batas stok minimum', '<div class="affix"><input name="stokMin" id="f_stokMin" inputmode="decimal" value="' + esc(p.stokMin) + '"><span class="ad r" id="pfSat">' + esc(p.satuan) + '</span></div>', { hint: 'Peringatan "menipis" muncul di bawah angka ini' }) +
        (baru ? fld('Stok awal', '<div class="affix"><input name="stokAwal" id="f_stokAwal" inputmode="decimal" placeholder="0"><span class="ad r">' + esc(p.satuan) + '</span></div>', { hint: 'Tercatat di Log Stok sebagai "Stok Awal"' }) : fld('Stok saat ini', '<input class="input" readonly value="' + angka(p.stok) + ' ' + esc(p.satuan) + '">', { hint: 'Ubah lewat Penyesuaian Stok agar tercatat' })) +
        fld('Grade / mutu', inp('grade', p.grade, 'maxlength="30" placeholder="Grade A, Size 50, Hidup…"')) +
        fld('Urutan tampil', inp('urut', p.urut || '', 'inputmode="numeric" placeholder="0"'), { hint: 'Angka kecil tampil lebih dulu' }) +
        fld('Deskripsi', txa('deskripsi', p.deskripsi, 'maxlength="600" placeholder="Asal tangkapan, ukuran, catatan penyimpanan…"'), { cls: 'span-2' }) +
        (baru ? '' : '<div class="sec-toggle span-2"><div><div class="t">Produk aktif</div><div class="d">Nonaktif = disembunyikan dari Input Pesanan. Riwayat transaksi tetap aman.</div></div>' + sakelar('aktif', p.aktif) + '</div>') +
        '</div></div></form>',
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="pfOk">' + ic('save', 'sm') + (baru ? 'Simpan Produk' : 'Simpan Perubahan') + '</button>' });
    var fb = m.$('#pfFoto');
    if (p.foto) { fb.innerHTML = '<img alt="">'; App.pasangGambar(fb.querySelector('img'), p.foto); }
    fb.onclick = function () {
      pilihFile('image/*').then(function (f) { if (!f) return; return kompresGambar(f, 1200, 0.82).then(function (url) { fotoData = url; fb.innerHTML = '<img src="' + url + '" alt="">'; }); });
    };
    var hapusF = m.$('#pfFotoHapus'); if (hapusF) hapusF.onclick = function () { fotoData = '__HAPUS__'; fb.innerHTML = ic('image-plus', 'lg') + '<b class="mt-s">Foto dihapus</b>'; hapusF.remove(); };
    m.$('#f_satuan').onchange = function (e) { m.$('#pfSat').textContent = e.target.value; };
    m.$('#pfOk').onclick = function () {
      var f = formData(m.$('#pf')), btn = m.$('#pfOk');
      if (f.nama.trim().length < 2) { m.$('#f_nama').classList.add('is-err'); m.$('#f_nama').focus(); return; }
      var data = { id: p.id, nama: f.nama.trim(), kategori: f.kategori.trim(), sku: f.sku.trim(), harga: parseRp(f.harga), satuan: f.satuan, stokMin: parseAngka(f.stokMin), grade: f.grade, deskripsi: f.deskripsi, urut: parseAngka(f.urut), aktif: baru ? true : f.aktif };
      if (baru) data.stokAwal = parseAngka(f.stokAwal);
      setBusy(btn, true, 'Menyimpan…');
      var langkah = Promise.resolve();
      if (fotoData === '__HAPUS__') { data.fotoId = ''; data.fotoUrl = ''; }
      else if (fotoData && baru) langkah = api('produk.foto', { dataUrl: fotoData, nama: data.nama }).then(function (r) { if (r.success) { data.fotoId = r.data.id; data.fotoUrl = ''; } else toast('Foto gagal diunggah', r.message, 'warn'); });
      langkah.then(function () { return self.simpan(data, btn); }).then(function (r) {
        if (!r || !r.success) return;
        if (fotoData && fotoData !== '__HAPUS__' && !baru) api('produk.foto', { id: r.data.id, dataUrl: fotoData, nama: data.nama }).then(function (rf) { if (rf.success) { self.segarkan(); toast('Foto diperbarui', rf.message); } else toast('Foto gagal', rf.message, 'err'); });
        m.close();
      });
    };
  },
  simpan: function (data, btn, pesan) {
    var self = this;
    return api('produk.save', data).then(function (r) {
      if (btn) setBusy(btn, false);
      if (!r.success) { toast('Gagal menyimpan', r.message, 'err'); return r; }
      App.updateProduk([r.data]); toast(pesan || r.message, r.data.nama); self.segarkan();
      return r;
    });
  },
  segarkan: function () {
    var c = halamanAktif(); swrStale('produk'); swrStale('stoklog');
    if (c && c.name === 'produk') { this.muat(c.el, true); this.muatLog(c.el); }
  },
  gantiFoto: function (p) {
    var self = this;
    pilihFile('image/*').then(function (f) {
      if (!f) return;
      var t = toast('Mengunggah foto…', p.nama, '', 20000);
      kompresGambar(f, 1200, 0.82).then(function (url) { return api('produk.foto', { id: p.id, dataUrl: url, nama: p.nama }); }).then(function (r) { t.remove(); toastRes(r, 'Foto diperbarui'); if (r.success) self.segarkan(); });
    });
  },
  nonaktif: function (p) {
    var self = this;
    konfirmasi('Nonaktifkan ' + esc(p.nama) + '?', 'Produk tidak tampil lagi di Input Pesanan. Riwayat penjualan & stoknya tetap tersimpan, dan bisa diaktifkan kembali kapan saja.', { bahaya: true, ok: 'Nonaktifkan' }).then(function (ok) {
      if (!ok) return;
      api('produk.hapus', { id: p.id }).then(function (r) { if (toastRes(r)) { App.updateProduk([r.data]); self.segarkan(); } });
    });
  },

  /* ---------- penyesuaian stok (multi produk) ---------- */
  TIPE: [
    { v: 'Restock Masuk', l: 'Restock Masuk', d: 'Pasokan kapal / pemasok', g: 'in', ik: 'anchor' },
    { v: 'Koreksi Tambah', l: 'Koreksi Tambah', d: 'Selisih hitung (lebih)', g: 'in', ik: 'circle-plus' },
    { v: 'Retur Pelanggan', l: 'Retur Pelanggan', d: 'Barang kembali', g: 'in', ik: 'undo-2' },
    { v: 'Koreksi Susut', l: 'Koreksi Susut', d: 'Susut air / es mencair', g: 'out', ik: 'trending-down' },
    { v: 'Rusak / Buang', l: 'Rusak / Buang', d: 'Busuk, rusak, tidak layak', g: 'out', ik: 'trash-2' },
    { v: 'Pemakaian Internal', l: 'Pemakaian Internal', d: 'Konsumsi / sampel', g: 'out', ik: 'utensils' },
    { v: 'Stok Opname', l: 'Stok Opname', d: 'Isi stok fisik hasil hitung', g: 'adj', ik: 'clipboard-check' }
  ],
  sesuaikan: function (produkId, tipeAwal, daftarId) {
    var self = this, tipe = tipeAwal || 'Restock Masuk', aktif = (AppState.produk || []).filter(function (p) { return p.aktif; });
    if (!aktif.length) return toast('Belum ada produk', 'Tambahkan produk dulu.', 'warn');
    var ids = daftarId && daftarId.length ? daftarId : [produkId || ''];
    var m = modal({ judul: 'Penyesuaian Stok', sub: 'Setiap perubahan tercatat di Log Stok (siapa, kapan, alasan).', ikon: 'scale', lebar: 'wide',
      isi: '<div class="label-up mb-s">Jenis penyesuaian</div><div class="grid-4" id="saTipe" style="gap:10px">' + this.TIPE.map(function (t) { return '<button type="button" class="choice' + (t.v === tipe ? ' on' : '') + '" data-v="' + esc(t.v) + '"><div class="row gap-s"><span class="' + (t.g === 'in' ? 'text-paid' : t.g === 'out' ? 'text-coral' : 'text-amber') + '">' + ic(t.ik, 'sm') + '</span><span class="t">' + esc(t.l) + '</span></div><div class="d">' + esc(t.d) + '</div></button>'; }).join('') + '</div>' +
        '<div class="label-up mt-l mb-s" id="saLbl">Produk &amp; jumlah</div><div id="saRows"></div><button type="button" class="btn btn-soft btn-sm mt-s" id="saAdd">' + ic('plus', 'sm') + 'Tambah produk</button>' +
        '<div class="field mt"><label>Keterangan / alasan</label><input class="input" id="saKet" maxlength="200" placeholder="mis. Kapal KM Bahari, nota pemasok #123"></div>',
      foot: '<span class="muted grow" id="saInfo" style="font-size:12.5px"></span><button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="saOk">' + ic('save', 'sm') + 'Simpan Penyesuaian</button>' });
    var opsi = function (val) {
      var kat = {}; aktif.forEach(function (p) { (kat[p.kategori] = kat[p.kategori] || []).push(p); });
      return '<option value="">— pilih produk —</option>' + Object.keys(kat).sort().map(function (k) { return '<optgroup label="' + esc(k) + '">' + kat[k].map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === val ? ' selected' : '') + '>' + esc(p.nama) + ' (stok ' + angka(p.stok) + ' ' + esc(p.satuan) + ')</option>'; }).join('') + '</optgroup>'; }).join('');
    };
    var baris = function (val) {
      var div = document.createElement('div'); div.className = 'row gap-s mb-s sa-row'; div.style.alignItems = 'flex-start';
      div.innerHTML = '<select class="select grow" style="min-width:0">' + opsi(val) + '</select><div style="width:150px"><div class="affix"><input inputmode="decimal" placeholder="0" class="saJ"><span class="ad r saSat">kg</span></div><div class="hint saHasil" style="font-size:11.5px;margin-top:3px"></div></div><button type="button" class="btn btn-ghost btn-icon" aria-label="Hapus baris">' + ic('x', 'sm') + '</button>';
      m.$('#saRows').appendChild(div);
      var s = div.querySelector('select'), j = div.querySelector('.saJ');
      var upd = function () {
        var p = aktif.filter(function (x) { return x.id === s.value; })[0], h = div.querySelector('.saHasil');
        div.querySelector('.saSat').textContent = p ? p.satuan : 'kg';
        if (!p) { h.textContent = ''; return; }
        var n = parseAngka(j.value), t = self.TIPE.filter(function (x) { return x.v === tipe; })[0];
        var akhir = tipe === 'Stok Opname' ? n : p.stok + (t.g === 'in' ? n : -n);
        h.innerHTML = j.value === '' ? 'stok ' + angka(p.stok) : angka(p.stok) + ' → <b style="color:' + (akhir < 0 ? 'var(--coral)' : 'var(--teal)') + '">' + angka(Math.round(akhir * 100) / 100) + '</b>';
        info();
      };
      s.onchange = function () { upd(); j.focus(); }; j.oninput = upd;
      div.querySelector('button').onclick = function () { if (m.$$('.sa-row').length > 1) { div.remove(); info(); } else { s.value = ''; j.value = ''; upd(); } };
      upd();
    };
    var info = function () { var n = m.$$('.sa-row').filter(function (r) { return r.querySelector('select').value && r.querySelector('.saJ').value !== ''; }).length; m.$('#saInfo').textContent = n ? n + ' produk akan disesuaikan' : ''; };
    ids.forEach(function (id) { baris(id); });
    m.$('#saAdd').onclick = function () { baris(''); };
    m.$('#saTipe').onclick = function (e) {
      var b = e.target.closest('[data-v]'); if (!b) return; tipe = b.dataset.v;
      m.$$('#saTipe .choice').forEach(function (x) { x.classList.toggle('on', x === b); });
      m.$('#saLbl').textContent = tipe === 'Stok Opname' ? 'Produk & stok fisik hasil hitung' : 'Produk & jumlah ' + (self.TIPE.filter(function (x) { return x.v === tipe; })[0].g === 'in' ? 'masuk' : 'keluar');
      m.$$('.sa-row .saJ').forEach(function (j) { j.dispatchEvent(new Event('input')); });
    };
    var f0 = m.$('.sa-row ' + (ids[0] ? '.saJ' : 'select')); if (f0) setTimeout(function () { f0.focus(); }, 60);
    m.$('#saOk').onclick = function () {
      var items = [], salah = false;
      m.$$('.sa-row').forEach(function (r) {
        var id = r.querySelector('select').value, jv = r.querySelector('.saJ').value; if (!id && jv === '') return;
        if (!id || jv === '' || (tipe !== 'Stok Opname' && !(parseAngka(jv) > 0))) { salah = true; r.querySelector(id ? '.saJ' : 'select').classList.add('is-err'); return; }
        items.push({ produkId: id, jumlah: parseAngka(jv) });
      });
      if (salah) return toast('Periksa isian', 'Pilih produk dan isi jumlah lebih dari 0.', 'err');
      if (!items.length) return toast('Belum ada produk', 'Pilih minimal satu produk.', 'warn');
      var btn = m.$('#saOk'); setBusy(btn, true, 'Menyimpan…');
      api('stok.adjust', { tipe: tipe, items: items, keterangan: m.$('#saKet').value.trim() }).then(function (r) {
        setBusy(btn, false);
        if (!r.success) return toast('Gagal', r.message, 'err');
        App.updateProduk(r.data.produk); m.close(); toast(r.message, tipe); self.segarkan(); App.muatAlert();
      });
    };
  },

  /* ---------- riwayat stok ---------- */
  riwayat: function (produkId) {
    var st = { periode: periodeIni(), produkId: produkId || '', tipe: '', cari: '' }, self = this;
    var m = modal({ judul: 'Riwayat Keluar-Masuk Stok', ikon: 'history', lebar: 'xl', sub: 'Log_Stok per bulan — otomatis dari pesanan & penyesuaian manual',
      isi: '<div class="filter-bar" style="padding:0 0 12px"><label class="filter-pill">' + ic('calendar', 'sm') + '<input type="month" id="rsPer" value="' + st.periode + '"></label>' +
        '<label class="filter-pill">' + ic('fish', 'sm') + '<select id="rsProd"><option value="">Semua produk</option>' + (AppState.produk || []).map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === st.produkId ? ' selected' : '') + '>' + esc(p.nama) + '</option>'; }).join('') + '</select></label>' +
        '<label class="filter-pill">' + ic('filter', 'sm') + '<select id="rsTipe"><option value="">Semua jenis</option>' + ['Penjualan', 'Batal Nota', 'Stok Awal'].concat(this.TIPE.map(function (t) { return t.v; })).map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
        '<div class="searchbox grow">' + ic('search') + '<input class="input soft" id="rsCari" placeholder="Cari keterangan, nota, petugas…"></div><button class="btn filter-pill green" id="rsXls">' + ic('sheet', 'sm') + 'Ekspor</button></div>' +
        '<div class="tbl-wrap" style="max-height:60vh;overflow:auto"><table class="tbl cards"><thead><tr><th>Waktu</th><th>Produk</th><th>Jenis</th><th class="r">Jumlah</th><th class="r hide-m">Sebelum → Sesudah</th><th class="hide-m">Oleh</th></tr></thead><tbody id="rsBody">' + skeletonRows(6, 6) + '</tbody></table></div><div class="muted mt-s" id="rsInfo" style="font-size:12.5px"></div>' });
    var data = [];
    var muat = function () {
      m.$('#rsBody').innerHTML = skeletonRows(6, 6);
      api('stok.log', { periode: st.periode, produkId: st.produkId, tipe: st.tipe, cari: st.cari, lengkap: 1, limit: 1000 }).then(function (r) {
        if (m.closed) return;
        if (!r.success) { m.$('#rsBody').innerHTML = '<tr><td colspan="6">' + retryBox(r) + '</td></tr>'; return; }
        data = r.data.rows;
        m.$('#rsBody').innerHTML = data.length ? data.map(function (x) { return self.barisLog(x).replace('<td class="r num hide-m">' + angka(x.sesudah) + '</td>', '<td class="r num hide-m">' + angka(x.sebelum) + ' → <b>' + angka(x.sesudah) + '</b></td>').replace('<td class="hide-m muted nowrap">' + esc(waktuRelatif(x.waktu)) + '</td>', '<td class="hide-m muted nowrap">' + esc(String(x.waktu).slice(0, 16)) + '</td>'); }).join('') : '<tr><td colspan="6">' + emptyState('history', 'Tidak ada catatan', 'Coba periode atau filter lain.') + '</td></tr>';
        m.$('#rsInfo').textContent = r.data.total + ' catatan • ' + periodeLabel(st.periode) + (r.data.total > data.length ? ' (menampilkan ' + data.length + ' terbaru)' : '');
      });
    };
    m.$('#rsPer').onchange = function (e) { st.periode = e.target.value || periodeIni(); muat(); };
    m.$('#rsProd').onchange = function (e) { st.produkId = e.target.value; muat(); };
    m.$('#rsTipe').onchange = function (e) { st.tipe = e.target.value; muat(); };
    m.$('#rsCari').oninput = debounce(function (e) { st.cari = e.target.value.trim(); muat(); }, 400);
    m.$('#rsXls').onclick = function () { if (!data.length) return toast('Tidak ada data', '', 'warn'); eksporXLSX('Log Stok ' + st.periode + '.xlsx', [{ nama: 'Log Stok ' + st.periode, kolom: ['Waktu', 'Produk', 'Jenis', 'Tipe', 'Jumlah', 'Satuan', 'Sebelum', 'Sesudah', 'Ref', 'Keterangan', 'Oleh'], rows: data.map(function (x) { return [x.waktu, x.produk, x.jenis, x.tipe, x.jumlah, x.satuan, x.sebelum, x.sesudah, x.ref, x.ket, x.oleh]; }) }]); };
    muat();
  }
};
registerPage('produk', { judul: 'Produk & Stok', template: function () { return Produk.template(); }, init: function (el) { Produk.init(el); }, show: function (el) { Produk.show(el); }, tick: function (el) { Produk.tick(el); }, tickMs: 45000, tickIdleMs: 180000 });
