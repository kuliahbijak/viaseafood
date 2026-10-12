/* ==========================================================================
   VIA SEAFOOD — pages-admin.js  (khusus Owner / Superadmin)
   Pengaturan: Pengguna & Hak Akses (RBAC), Toko & Operasional, Printer &
   Struk, Tampilan & Branding (logo + SEMUA gambar latar bisa diganti),
   Keamanan & Backup, Migrasi Data, Integrasi Sheets & Drive.
   + halaman Log Aktivitas (audit).
   ========================================================================== */
'use strict';
var PRESET_IZIN = {
  kasir: ['pesanan_input', 'pesanan_lihat', 'rekap_lihat', 'pelanggan_kelola', 'struk_wa'],
  gudang: ['pesanan_lihat', 'produk_kelola', 'stok_kelola'],
  semua: ['pesanan_input', 'pesanan_lihat', 'produk_kelola', 'stok_kelola', 'rekap_lihat', 'pelanggan_kelola', 'struk_wa', 'harga_ubah', 'tanggal_mundur']
};
var KHUSUS_OWNER = ['Dashboard omzet & laba', 'Keuangan, arus kas & piutang', 'Pengaturan, akun & hak akses', 'WhatsApp, blast & CRM', 'Template dokumen & arsip', 'Log audit & backup'];
var SLOT_INFO = {
  logo: { d: 'Persegi, PNG transparan ±512 px. Tampil di menu, login, favicon & dokumen.', contain: true, w: 512, png: true },
  loginBg: { d: 'Lanskap ±1920×1080 — foto dermaga/kapal untuk halaman login.', w: 1920 },
  sidebarBg: { d: 'Potret ±600×1200 — tampil samar di menu samping.', w: 1200 },
  orderBanner: { d: 'Lebar ±1600×400 — kepala halaman Input Pesanan.', w: 1600 },
  pageBg: { d: 'Tekstur halus ±1920 px — latar konten (dibuat sangat samar).', w: 1920 },
  strukLogo: { d: 'Hitam-putih kontras tinggi ±384 px — dicetak di struk thermal.', contain: true, w: 384, png: true },
  kartu1: { d: 'Kartu foto dashboard #1 (±1200×600).', w: 1200 }, kartu2: { d: 'Kartu foto dashboard #2 (±1200×600).', w: 1200 }, kartu3: { d: 'Kartu foto dashboard #3 (±1200×600).', w: 1200 },
  produkDefault: { d: 'Foto bawaan untuk produk yang belum punya foto.', w: 900 },
  ttdOwner: { d: 'PNG transparan tanda tangan Owner — spesimen di kwitansi & tagihan.', contain: true, w: 600, png: true }
};

var Admin = {
  tab: 'pengguna', set: null, users: null,
  TABS: [{ id: 'pengguna', label: 'Pengguna & Hak Akses', ikon: 'users-round' }, { id: 'toko', label: 'Toko & Operasional', ikon: 'store' }, { id: 'printer', label: 'Printer & Struk', ikon: 'printer' },
    { id: 'tampilan', label: 'Tampilan & Branding', ikon: 'palette' }, { id: 'keamanan', label: 'Keamanan & Backup', ikon: 'shield-check' }, { id: 'migrasi', label: 'Migrasi Data', ikon: 'database' }, { id: 'sistem', label: 'Sheets & Drive', ikon: 'sheet' }],
  template: function () {
    return '<div class="page-head"><div><div class="eyebrow">Panel Superadmin <span class="dot"></span><span class="loc">Owner</span></div><h1 class="page-title">Pengaturan Sistem</h1><p class="page-sub">Pengguna & hak akses, identitas toko, printer, tampilan, keamanan dan data</p></div>' +
      '<div class="page-actions"><span class="pill-stat" id="admVer">' + ic('badge-check', 'sm') + 'v' + VERSI_FE + '</span></div></div>' +
      '<div class="card">' + tabsHtml(this.TABS, this.tab) + '</div><div id="admHost"></div>';
  },
  init: function (el) { var self = this; pasangTabs(el.querySelector('.tabs'), function (t) { self.buka(el, t); history.replaceState(null, '', '#/pengaturan/' + t); }); },
  show: function (el, param) { this.buka(el, this.TABS.some(function (t) { return t.id === param; }) ? param : this.tab); },
  buka: function (el, t) {
    this.tab = t;
    el.querySelectorAll('.tabs [data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    var host = el.querySelector('#admHost'), box = host.querySelector('[data-panel="' + t + '"]');
    Array.prototype.forEach.call(host.children, function (c) { c.hidden = c.dataset.panel !== t; });
    if (!box) { box = document.createElement('div'); box.dataset.panel = t; host.appendChild(box); this['p_' + t](box, true); }
    else if (this['r_' + t]) this['r_' + t](box);
  },
  muatSet: function (paksa) {
    var self = this;
    if (this.set && !paksa) return Promise.resolve(this.set);
    return api('settings.get', {}).then(function (r) { if (!r.success) throw r; self.set = r.data; return r.data; });
  },
  simpanSet: function (nilai, btn) {
    var self = this;
    if (!Object.keys(nilai).length) { toast('Tidak ada perubahan', '', 'warn'); return Promise.resolve(null); }
    setBusy(btn, true, 'Menyimpan…');
    return api('settings.save', { nilai: nilai }).then(function (r) {
      setBusy(btn, false); if (!toastRes(r, 'Pengaturan tersimpan')) return null;
      Object.keys(nilai).forEach(function (k) { if (self.set) self.set.nilai[k] = typeof nilai[k] === 'object' ? JSON.stringify(nilai[k]) : String(nilai[k]); });
      if (r.data.cfg) AppState.cfg = r.data.cfg;
      App.segarkanBoot(true); App.muatPublik();
      return r;
    });
  },
  gagal: function (box, r, fn) { box.innerHTML = '<div class="card mt">' + retryBox(r) + '</div>'; var b = box.querySelector('[data-act]'); if (b) b.onclick = fn; },
  pakaiBrand: function (b) {
    AppState.brand = b; App.terapkanBrand(b);
    var pub = Store.get('pub', null); if (pub) { pub.brand = b; Store.set('pub', pub); }
    var boot = Store.get(userKey('boot'), null); if (boot && boot.data) { boot.data.brand = b; Store.set(userKey('boot'), boot); }
    if (this.set) this.set.brand = b;
    buangHalaman('dashboard'); buangHalaman('pesanan-baru');
  },

  /* ---------- spesifikasi formulir pengaturan ---------- */
  renderSpec: function (spec, nilai) {
    return spec.map(function (s) {
      return '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic(s.ikon || 'settings') + '</span><div><div class="t">' + esc(s.judul) + '</div>' + (s.sub ? '<div class="muted" style="font-size:12.5px">' + esc(s.sub) + '</div>' : '') + '</div></div><div class="sec-body"><div class="grid-2">' +
        s.f.map(function (f) {
          var k = f[0], label = f[1], tipe = f[2], cls = f[3] || '', hint = f[4] || '', v = nilai[k] == null ? '' : nilai[k];
          if (tipe === 'saklar') return '<div class="sec-toggle ' + cls + '"><div><div class="t">' + esc(label) + '</div><div class="d">' + esc(hint) + '</div></div>' + '<label class="switch"><input type="checkbox" data-k="' + k + '"' + (v === 'YA' ? ' checked' : '') + '><span></span></label></div>';
          var ctrl = tipe === 'area' ? '<textarea class="textarea" data-k="' + k + '" style="min-height:64px">' + esc(v) + '</textarea>'
            : tipe === 'rp' ? '<div class="affix"><span class="ad">Rp</span><input data-k="' + k + '" data-rp inputmode="numeric" value="' + (v && +v ? angka(+v) : '') + '"></div>'
            : tipe === 'pilih' ? '<select class="select" data-k="' + k + '">' + selectOpts(f[5], v) + '</select>'
            : '<input class="input" data-k="' + k + '" value="' + esc(v) + '"' + (tipe === 'angka' ? ' inputmode="decimal"' : tipe === 'email' ? ' type="email"' : tipe === 'hp' ? ' inputmode="tel"' : '') + '>';
          return fld(esc(label), ctrl, { cls: cls, hint: tipe === 'list' ? (hint || 'Pisahkan dengan koma') : hint });
        }).join('') + '</div></div></div>';
    }).join('');
  },
  bacaSpec: function (box, nilai) {
    var out = {};
    box.querySelectorAll('[data-k]').forEach(function (x) {
      var k = x.dataset.k, v = x.type === 'checkbox' ? (x.checked ? 'YA' : 'TIDAK') : x.hasAttribute('data-rp') ? String(parseRp(x.value)) : x.value.trim();
      if (String(nilai[k] == null ? '' : nilai[k]) !== v) out[k] = v;
    });
    return out;
  },
  barSimpan: function (id, teks) { return '<div class="save-bar"><span class="muted grow" style="font-size:12.5px">' + ic('info', 'sm') + ' ' + (teks || 'Perubahan berlaku untuk semua perangkat setelah disimpan.') + '</span><button class="btn btn-primary btn-lg" id="' + id + '">' + ic('save', 'sm') + 'Simpan Pengaturan</button></div>'; },

  /* ======================= PENGGUNA & HAK AKSES ======================= */
  p_pengguna: function (box) {
    var self = this;
    box.innerHTML = '<div class="kpis" id="usKpi" style="margin-top:var(--gut)"></div>' +
      '<div class="set-grid"><div class="card" style="overflow:hidden"><div class="card-head"><div><h3 class="card-title">Akun Pengguna</h3><div class="sub">Owner (Superadmin) &amp; Staff Kasir / Gudang</div></div><button class="btn btn-accent" data-u="tambah">' + ic('user-plus', 'sm') + 'Tambah Akun Staff</button></div>' +
      '<div class="filter-bar" style="padding-top:0"><div class="searchbox grow">' + ic('search') + '<input class="input soft" id="usCari" placeholder="Cari nama / email…"></div><label class="filter-pill">' + ic('filter', 'sm') + '<select id="usFilter"><option value="">Semua akun</option><option value="OWNER">Owner</option><option value="STAFF">Staff</option><option value="Nonaktif">Nonaktif</option></select></label></div>' +
      '<div class="tbl-wrap"><table class="tbl cards" id="usTbl"><thead><tr><th>Pengguna</th><th>Peran &amp; Tugas</th><th class="c hide-m">Izin</th><th class="c">Status</th><th class="hide-m">Terakhir Aktif</th><th></th></tr></thead><tbody>' + skeletonRows(4, 6) + '</tbody></table></div></div>' +
      '<div><div class="card card-pad"><div class="row" style="justify-content:space-between"><h3 class="card-title">Log Akses Terbaru</h3><a href="#/audit" class="btn btn-ghost btn-sm">Semua ' + ic('arrow-right', 'sm') + '</a></div><div id="usLog" class="mt"></div></div>' +
      '<div class="card card-pad mt"><h3 class="card-title">' + ic('shield-check', 'sm') + ' Prinsip Keamanan</h3><ul class="list-plain mt-s" style="font-size:13px;color:var(--ink-2);display:grid;gap:8px">' +
      '<li>• Hak akses diperiksa di <b>server</b> untuk setiap aksi — tidak bisa dibobol dari browser.</li><li>• PIN/sandi disimpan sebagai hash SHA-256 bergaram; Owner pun tidak bisa melihatnya.</li><li>• 5× salah sandi = akun terkunci 15 menit & Owner diberi peringatan.</li><li>• Menonaktifkan akun / ganti PIN langsung mengeluarkan semua sesinya.</li></ul></div></div></div>' +
      '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic('shield-check') + '</span><div class="t">Matriks Hak Akses (RBAC)</div><span class="r">Izin Staff bisa diatur per akun</span></div><div class="sec-body"><div class="rbac-grid" id="usRbac"></div></div></div>';
    box.querySelector('#usCari').oninput = debounce(function () { self.renderUsers(box); }, 200);
    box.querySelector('#usFilter').onchange = function () { self.renderUsers(box); };
    box.addEventListener('click', function (e) {
      var t = e.target.closest('[data-u]'); if (!t) return;
      if (t.dataset.u === 'tambah') return self.formUser(null);
      var u = (self.users.rows || []).filter(function (x) { return x.id === t.dataset.id; })[0]; if (!u) return;
      if (t.dataset.u === 'edit') self.formUser(u); else if (t.dataset.u === 'menu') self.menuUser(t, u);
    });
    this.r_pengguna(box);
  },
  r_pengguna: function (box) {
    var self = this;
    return api('users.list', {}).then(function (r) { if (!r.success) return self.gagal(box, r, function () { self.p_pengguna(box); }); self.users = r.data; self.renderUsers(box); });
  },
  renderUsers: function (box) {
    var d = this.users; if (!d) return;
    var q = box.querySelector('#usCari').value.trim().toLowerCase(), f = box.querySelector('#usFilter').value, me = AppState.user.id;
    box.querySelector('#usKpi').innerHTML = kpiHtml('Total Akun', String(d.kpi.total), d.kpi.aktif + ' aktif', 'users-round') + kpiHtml('Owner', String(d.kpi.owner), 'akses penuh superadmin', 'star', 'amber') +
      kpiHtml('Staff Kasir', String(d.kpi.kasir), 'input pesanan & struk', 'id-card', 'paid') + kpiHtml('Staff Gudang', String(d.kpi.gudang), 'produk & stok cold storage', 'archive');
    var rows = d.rows.filter(function (u) { return (!f || (f === 'Nonaktif' ? u.status !== 'Aktif' : u.role === f && u.status === 'Aktif')) && (!q || (u.nama + ' ' + u.email + ' ' + u.penugasan).toLowerCase().indexOf(q) > -1); });
    box.querySelector('#usTbl tbody').innerHTML = rows.map(function (u) {
      var own = u.role === 'OWNER';
      return '<tr class="' + (u.status === 'Aktif' ? '' : 'dim') + '"><td class="full-m"><div class="cust"><span class="avatar ' + (own ? '' : avatarKelas(u.nama)) + '"' + (own ? ' style="background:var(--teal);color:#fff"' : '') + '>' + esc(u.inisial || inisial(u.nama)) + '</span><div><b>' + esc(u.nama) + (u.id === me ? ' <span class="muted">(Anda)</span>' : '') + '</b><div class="sub">' + esc(u.email) + (u.wa ? ' • ' + esc(hpTampil(u.wa)) : '') + '</div></div></div></td>' +
        '<td><span class="badge ' + (own ? 'b-owner' : 'b-info') + '">' + ic(own ? 'star' : 'id-card', 'sm') + (own ? 'Owner' : 'Staff') + '</span><div class="sub" style="margin-top:3px">' + esc(u.penugasan || '') + (u.shift ? ' • ' + esc(u.shift) : '') + '</div></td>' +
        '<td class="c hide-m">' + (own ? '<span class="muted">Semua</span>' : '<b>' + (u.izin || []).length + '</b><span class="muted">/9</span>') + '</td><td class="c">' + (u.status === 'Aktif' ? '<span class="badge b-lunas">Aktif</span>' : '<span class="badge b-batal">Nonaktif</span>') + (u.wajibGanti ? '<div class="sub text-amber">wajib ganti PIN</div>' : '') + '</td>' +
        '<td class="hide-m muted">' + esc(u.terakhirAktif ? waktuRelatif(u.terakhirAktif) : 'Belum pernah') + '</td><td class="r nowrap"><button class="btn btn-ghost btn-icon btn-sm" data-u="edit" data-id="' + esc(u.id) + '" aria-label="Edit">' + ic('pencil', 'sm') + '</button><button class="btn btn-ghost btn-icon btn-sm" data-u="menu" data-id="' + esc(u.id) + '" aria-label="Aksi">' + ic('ellipsis-vertical', 'sm') + '</button></td></tr>';
    }).join('') || '<tr><td colspan="6">' + emptyState('users-round', 'Tidak ada akun yang cocok') + '</td></tr>';
    box.querySelector('#usLog').innerHTML = (d.logAkses || []).length ? d.logAkses.map(function (l) { return '<div class="log-item"><span class="dt ' + (/GAGAL|KEAMANAN|TERKUNCI/.test(l.aksi + l.kategori) ? 'coral' : /LOGOUT/.test(l.aksi) ? 'amber' : '') + '"></span><div><b>' + esc(l.nama) + ' • ' + esc(l.aksi.replace(/_/g, ' ').toLowerCase()) + '</b><span>' + esc(waktuRelatif(l.waktu)) + (l.terminal ? ' • ' + esc(l.terminal) : '') + '</span></div></div>'; }).join('') : '<p class="muted">Belum ada aktivitas.</p>';
    var izin = d.izin || {}, kol = function (judul, sub, list, n, ikon) {
      return '<div class="rbac-col"><h4><span class="row gap-s">' + ic(ikon, 'sm') + esc(judul) + '</span><span class="badge b-info">' + n + ' akun</span></h4><div class="muted mb-s" style="font-size:12px">' + esc(sub) + '</div><ul>' + Object.keys(izin).map(function (k) { var ok = list === true || list.indexOf(k) > -1; return '<li class="' + (ok ? '' : 'no') + '">' + ic(ok ? 'check' : 'x', 'sm') + esc(izin[k]) + '</li>'; }).join('') +
        KHUSUS_OWNER.map(function (x) { return '<li class="' + (list === true ? '' : 'no') + '">' + ic(list === true ? 'check' : 'lock', 'sm') + esc(x) + '</li>'; }).join('') + '</ul></div>';
    };
    box.querySelector('#usRbac').innerHTML = kol('Owner (Superadmin)', 'Akses penuh tanpa batas', true, d.kpi.owner, 'star') + kol('Staff Kasir', 'Preset bawaan — bisa diubah per akun', PRESET_IZIN.kasir, d.kpi.kasir, 'id-card') + kol('Staff Gudang', 'Preset bawaan — bisa diubah per akun', PRESET_IZIN.gudang, d.kpi.gudang, 'archive');
  },
  menuUser: function (btn, u) {
    var self = this, me = u.id === AppState.user.id;
    var items = [{ label: 'Edit akun & izin', ikon: 'pencil', fn: function () { self.formUser(u); } }];
    if (!me) items.push({ label: 'Reset PIN / sandi', ikon: 'key-round', fn: function () { self.resetPin(u); } }, { label: 'Keluarkan dari semua perangkat', ikon: 'monitor-x', fn: function () {
      konfirmasi('Keluarkan ' + esc(u.nama) + '?', 'Semua sesi login akun ini berakhir seketika.', { ok: 'Keluarkan' }).then(function (ok) { if (ok) api('users.logoutSemua', { id: u.id }).then(function (r) { toastRes(r); }); });
    } }, '-', u.status === 'Aktif' ? { label: 'Nonaktifkan akun', ikon: 'ban', bahaya: true, fn: function () { self.ubahStatus(u, 'Nonaktif'); } } : { label: 'Aktifkan akun', ikon: 'circle-check', fn: function () { self.ubahStatus(u, 'Aktif'); } });
    popMenu(btn, items);
  },
  ubahStatus: function (u, status) {
    var self = this;
    konfirmasi((status === 'Aktif' ? 'Aktifkan' : 'Nonaktifkan') + ' akun ' + esc(u.nama) + '?', status === 'Aktif' ? 'Akun bisa login kembali.' : 'Akun tidak bisa login dan semua sesinya langsung berakhir. Data transaksinya tetap tersimpan.', { bahaya: status !== 'Aktif', ok: status === 'Aktif' ? 'Aktifkan' : 'Nonaktifkan' }).then(function (ok) {
      if (ok) api('users.status', { id: u.id, status: status }).then(function (r) { if (toastRes(r)) self.r_pengguna(document.querySelector('[data-panel="pengguna"]')); });
    });
  },
  resetPin: function (u) {
    var m = modal({ judul: 'Reset PIN ' + esc(u.nama), ikon: 'key-round', sub: 'Sesi akun ini akan diakhiri & wajib ganti PIN saat login.',
      isi: fld('PIN / sandi baru', '<input class="input" id="rpPin" inputmode="numeric" maxlength="32" placeholder="Kosongkan = PIN acak 6 digit">', { hint: 'Minimal 6 karakter' }) + '<label class="check mt">' + '<input type="checkbox" id="rpKirim"' + (u.wa || u.email ? ' checked' : '') + '> Kirim PIN baru ke WhatsApp/Email ' + esc(u.nama) + '</label>',
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="rpOk">Reset PIN</button>' });
    m.$('#rpOk').onclick = function () {
      var pin = m.$('#rpPin').value.trim(), b = m.$('#rpOk'); if (pin && pin.length < 6) return toast('PIN terlalu pendek', 'Minimal 6 karakter.', 'err');
      setBusy(b, true);
      api('users.resetSandi', { id: u.id, sandi: pin, kirim: m.$('#rpKirim').checked }).then(function (r) {
        setBusy(b, false); if (!r.success) return toast('Gagal', r.message, 'err');
        m.close(); Admin.infoPin(u.nama, u.email, r.data.sandi);
      });
    };
  },
  infoPin: function (nama, email, pin) {
    var m = modal({ judul: 'PIN untuk ' + esc(nama), ikon: 'key-round', ikonKelas: 'paid', isi: '<p>Berikan kredensial ini kepada ' + esc(nama) + '. PIN <b>wajib diganti</b> saat login pertama.</p><div class="box" style="text-align:center"><div class="label-up">Email</div><div class="mono" style="font-size:15px">' + esc(email) + '</div><div class="label-up mt">PIN / Sandi awal</div><div class="serif" style="font-size:36px;font-weight:700;letter-spacing:.2em;color:var(--teal)">' + esc(pin) + '</div></div><p class="muted" style="font-size:12.5px">PIN ini hanya ditampilkan sekali dan tidak tersimpan dalam bentuk asli.</p>',
      foot: '<button class="btn btn-outline" id="ipSalin">' + ic('copy', 'sm') + 'Salin</button><button class="btn btn-primary" data-x>Selesai</button>' });
    m.$('#ipSalin').onclick = function () { salinTeks('Login ' + ((AppState.brand || {}).appName || '') + '\nEmail: ' + email + '\nPIN: ' + pin + '\n' + location.href.split('#')[0]).then(function () { toast('Disalin'); }); };
  },
  formUser: function (u) {
    var self = this, baru = !u, izinKat = (this.users && this.users.izin) || (AppState.boot && AppState.boot.izinKatalog) || {};
    u = u || { nama: '', email: '', wa: '', role: 'STAFF', penugasan: 'Kasir & Timbangan', shift: '', izin: PRESET_IZIN.kasir.slice(), status: 'Aktif', wajibGanti: true };
    var role = u.role, izin = (u.izin || []).slice();
    var m = modal({ judul: baru ? 'Tambah Akun Staff' : 'Edit Akun ' + esc(u.nama), sub: baru ? 'PIN awal dikirim otomatis ke WhatsApp/Email (bila notifikasi aktif).' : esc(u.email), ikon: baru ? 'user-plus' : 'user-check', lebar: 'xl',
      isi: '<form id="uf" autocomplete="off"><div class="split" style="align-items:start"><div>' +
        '<div class="row gap-s mb"><span class="avatar lg" id="ufAv" style="background:var(--teal);color:#fff">' + esc(inisial(u.nama || '?')) + '</span><div><b id="ufNmPrev">' + esc(u.nama || 'Nama Staff') + '</b><div class="muted" style="font-size:12.5px" id="ufTgPrev">' + esc(u.penugasan) + '</div></div></div>' +
        '<div class="grid-2">' + fld('Nama lengkap', inp('nama', u.nama, 'required maxlength="60" autofocus'), { req: true, cls: 'span-2' }) +
        fld('Email login', inp('email', u.email, 'type="email" required autocomplete="off"'), { req: true }) +
        fld('WhatsApp', '<div class="affix"><span class="ad">+62</span><input name="wa" id="f_wa" inputmode="tel" value="' + esc(hp08(u.wa).replace(/^0/, '')) + '" placeholder="812-xxxx"></div>') +
        '<div class="field span-2"><label>Peran</label><div class="grid-2" id="ufRole"><button type="button" class="choice' + (role === 'STAFF' ? ' on' : '') + '" data-r="STAFF"><div class="row gap-s">' + ic('id-card', 'sm') + '<span class="t">Staff (Admin)</span></div><div class="d">Kasir / gudang — izin diatur per modul</div></button><button type="button" class="choice' + (role === 'OWNER' ? ' on' : '') + '" data-r="OWNER"><div class="row gap-s">' + ic('star', 'sm') + '<span class="t">Owner (Superadmin)</span></div><div class="d">Akses penuh termasuk keuangan & pengaturan</div></button></div></div>' +
        fld('Penugasan', inp('penugasan', u.penugasan, 'list="ufTugas" maxlength="60"') + '<datalist id="ufTugas"><option value="Kasir & Timbangan"><option value="Admin Gudang / Cold Storage"><option value="Kasir Senior"><option value="Supervisor Dermaga"><option value="Kurir & Pengiriman"></datalist>') +
        fld('Shift kerja', inp('shift', u.shift, 'list="ufShift" maxlength="60" placeholder="opsional"') + '<datalist id="ufShift"><option value="Pagi (03:00–11:00)"><option value="Siang (11:00–19:00)"><option value="Malam (19:00–03:00)"><option value="Penuh waktu"></datalist>') +
        fld(baru ? 'PIN / sandi awal' : 'Ganti PIN / sandi', '<input class="input" name="sandi" id="f_sandi" inputmode="numeric" maxlength="32" autocomplete="new-password" placeholder="' + (baru ? 'Kosongkan = PIN acak 6 digit' : 'Kosongkan bila tidak diganti') + '">', { cls: 'span-2', hint: 'Kasir: 6 digit angka. Minimal 6 karakter.' }) +
        '<div class="sec-toggle span-2"><div><div class="t">Wajib ganti PIN saat login berikutnya</div><div class="d">Disarankan untuk akun baru / setelah reset.</div></div>' + sakelar('wajibGanti', u.wajibGanti) + '</div>' +
        (baru ? '' : '<div class="sec-toggle span-2"><div><div class="t">Akun aktif</div><div class="d">Nonaktif = tidak bisa login, sesi langsung berakhir.</div></div>' + sakelar('aktif', u.status === 'Aktif', u.id === AppState.user.id ? 'disabled' : '') + '</div>') +
        '</div></div><div><div class="row" style="justify-content:space-between"><div class="label-up">Izin modul</div><div class="row gap-s" id="ufPreset"><button type="button" class="chip chip-s" data-p="kasir">Preset Kasir</button><button type="button" class="chip chip-s" data-p="gudang">Preset Gudang</button><button type="button" class="chip chip-s" data-p="semua">Semua</button></div></div>' +
        '<div class="perm-list mt-s" id="ufIzin"></div><div class="note-amber mt">' + ic('lock', 'sm') + '<span>Menu <b>Dashboard, Keuangan & Piutang, Pengaturan, WhatsApp & CRM, Dokumen, Log Audit</b> selalu khusus Owner.</span></div></div></div></form>',
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="ufOk">' + ic('save', 'sm') + (baru ? 'Buat Akun' : 'Simpan Perubahan') + '</button>' });
    var renderIzin = function () {
      m.$('#ufIzin').innerHTML = Object.keys(izinKat).map(function (k) {
        var on = role === 'OWNER' || izin.indexOf(k) > -1;
        return '<label class="perm ' + (role === 'OWNER' ? '' : on ? '' : 'off') + '"><input type="checkbox" data-iz="' + k + '"' + (on ? ' checked' : '') + (role === 'OWNER' ? ' disabled' : '') + '><span class="grow">' + esc(izinKat[k]) + '</span><span class="st">' + (on ? 'AKTIF' : 'NONAKTIF') + '</span></label>';
      }).join('');
    };
    renderIzin();
    m.$('#ufIzin').onchange = function (e) { var k = e.target.dataset.iz; if (!k) return; if (e.target.checked) { if (izin.indexOf(k) < 0) izin.push(k); } else izin = izin.filter(function (x) { return x !== k; }); renderIzin(); };
    m.$('#ufPreset').onclick = function (e) { var b = e.target.closest('[data-p]'); if (!b || role === 'OWNER') return; izin = PRESET_IZIN[b.dataset.p].slice(); renderIzin(); var tg = m.$('#f_penugasan'); if (b.dataset.p === 'kasir' && !/kasir/i.test(tg.value)) tg.value = 'Kasir & Timbangan'; if (b.dataset.p === 'gudang' && !/gudang/i.test(tg.value)) tg.value = 'Admin Gudang / Cold Storage'; tg.dispatchEvent(new Event('input')); };
    m.$('#ufRole').onclick = function (e) { var b = e.target.closest('[data-r]'); if (!b) return; role = b.dataset.r; m.$$('#ufRole .choice').forEach(function (x) { x.classList.toggle('on', x === b); }); if (role === 'OWNER' && /kasir|gudang/i.test(m.$('#f_penugasan').value)) m.$('#f_penugasan').value = 'Superadmin'; renderIzin(); };
    m.$('#f_nama').oninput = function (e) { m.$('#ufAv').textContent = inisial(e.target.value || '?'); m.$('#ufNmPrev').textContent = e.target.value || 'Nama Staff'; };
    m.$('#f_penugasan').oninput = function (e) { m.$('#ufTgPrev').textContent = e.target.value; };
    m.$('#ufOk').onclick = function () {
      var f = formData(m.$('#uf')), b = m.$('#ufOk');
      if (f.nama.trim().length < 2) { m.$('#f_nama').classList.add('is-err'); return m.$('#f_nama').focus(); }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) { m.$('#f_email').classList.add('is-err'); return m.$('#f_email').focus(); }
      if (f.wa && !hpValid(f.wa)) return toast('Nomor WA tidak valid', '', 'err');
      if (f.sandi && f.sandi.length < 6) return toast('PIN terlalu pendek', 'Minimal 6 karakter.', 'err');
      var lanjut = role === 'OWNER' && u.role !== 'OWNER' ? konfirmasi('Jadikan ' + esc(f.nama) + ' Owner?', 'Owner punya akses penuh termasuk keuangan, pengaturan & menghapus data.', { ok: 'Ya, jadikan Owner' }) : Promise.resolve(true);
      lanjut.then(function (ok) {
        if (!ok) return; setBusy(b, true, 'Menyimpan…');
        api('users.save', { id: u.id || '', nama: f.nama.trim(), email: f.email.trim(), wa: hp08(f.wa), role: role, penugasan: f.penugasan, shift: f.shift, izin: izin, sandi: f.sandi, wajibGanti: f.wajibGanti, status: baru || f.aktif !== false ? (baru || f.aktif ? 'Aktif' : 'Nonaktif') : 'Nonaktif' }).then(function (r) {
          setBusy(b, false); if (!r.success) return toast('Gagal', r.message, 'err');
          m.close(); toast(r.message.split(' PIN awal')[0]);
          if (r.data.sandiAwal) self.infoPin(r.data.nama, r.data.email, r.data.sandiAwal);
          var box = document.querySelector('[data-panel="pengguna"]'); if (box) self.r_pengguna(box);
          if (u.id === AppState.user.id) App.segarkanBoot(true);
        });
      });
    };
  },

  /* ======================= TOKO & OPERASIONAL ======================= */
  SPEC_TOKO: [
    { judul: 'Identitas Usaha', ikon: 'store', sub: 'Tampil di struk, nota, kwitansi, tagihan & pesan WhatsApp', f: [['TOKO_NAMA', 'Nama usaha', 'teks'], ['LOKASI', 'Nama lokasi / pangkalan', 'teks'], ['TOKO_ALAMAT', 'Alamat lengkap', 'area', 'span-2'], ['TOKO_WA', 'WhatsApp usaha', 'hp', '', 'Tampil di kepala struk'], ['TOKO_EMAIL', 'Email usaha', 'email'], ['TOKO_REKENING', 'Info rekening transfer', 'area', 'span-2', 'mis. BCA 1234567890 a.n. Via Seafood — tampil di tagihan & pengingat piutang']] },
    { judul: 'Transaksi & Stok', ikon: 'receipt-text', sub: 'Aturan nota, tempo, pajak & target', f: [['ID_PREFIX', 'Awalan nomor nota', 'teks', '', 'Contoh ORD → ORD-261007-0001'], ['TEMPO_DEFAULT_HARI', 'Tempo hutang bawaan (hari)', 'angka'], ['STOK_MIN_DEFAULT', 'Batas stok menipis bawaan', 'angka'], ['JAM_TUTUP_BUKU', 'Jam tutup buku harian (0–23)', 'angka', '', 'Ringkasan harian dikirim ke Owner pada jam ini'],
      ['PAJAK_PERSEN', 'Pajak / retribusi (%)', 'angka', '', '0 = tanpa pajak'], ['PAJAK_LABEL', 'Label pajak di struk', 'teks'], ['TARGET_BULANAN', 'Target omzet bulanan', 'rp', 'span-2', 'Ditampilkan sebagai progres di Dashboard (0 = tidak dipakai)'],
      ['STOK_MINUS_BOLEH', 'Izinkan penjualan melebihi stok', 'saklar', 'span-2', 'Bila mati, pesanan ditolak saat stok tidak cukup (disarankan mati).']] },
    { judul: 'Daftar Pilihan', ikon: 'list', sub: 'Pilihan yang muncul di formulir produk, pelanggan & keuangan', f: [['KATEGORI_PRODUK', 'Kategori produk', 'list', 'span-2'], ['SATUAN_PRODUK', 'Satuan produk', 'list'], ['TIPE_PELANGGAN', 'Tipe pelanggan', 'list'], ['KATEGORI_KAS_MASUK', 'Kategori pemasukan manual', 'list', 'span-2'], ['KATEGORI_KAS_KELUAR', 'Kategori pengeluaran', 'list', 'span-2']] }
  ],
  p_toko: function (box) {
    var self = this;
    box.innerHTML = '<div class="skel mt" style="height:280px"></div>';
    this.muatSet().then(function (s) {
      box.innerHTML = self.renderSpec(self.SPEC_TOKO, s.nilai) + self.barSimpan('tkOk');
      box.querySelector('#tkOk').onclick = function () { self.simpanSet(self.bacaSpec(box, self.set.nilai), this); };
    }, function (r) { self.gagal(box, r, function () { self.p_toko(box); }); });
  },

  /* ======================= PRINTER & STRUK ======================= */
  p_printer: function (box) {
    var self = this;
    box.innerHTML = '<div class="skel mt" style="height:280px"></div>';
    this.muatSet().then(function (s) {
      var p = Object.assign({}, s.printer), struk = AppState.struk || [];
      var opsTpl = function (lebar) { return struk.filter(function (t) { return lebar === 80 ? t.lebar > 40 : t.lebar <= 40; }).map(function (t) { return { v: t.kode, l: t.nama + ' (' + t.kode + ')' }; }); };
      var sw = function (k, judul, desk) { return '<div class="sec-toggle"><div><div class="t">' + judul + '</div><div class="d">' + desk + '</div></div><label class="switch"><input type="checkbox" data-p="' + k + '"' + (p[k] ? ' checked' : '') + '><span></span></label></div>'; };
      box.innerHTML = '<div class="set-grid"><div><div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic('printer') + '</span><div><div class="t">Printer Thermal Bawaan</div><div class="muted" style="font-size:12.5px">Default semua kasir — tiap perangkat tetap bisa menyesuaikan di jendela cetak</div></div></div><div class="sec-body">' +
        '<div class="label-up mb-s">Lebar kertas</div><div class="grid-2" id="prLebar"><button type="button" class="choice' + (p.lebar !== 80 ? ' on' : '') + '" data-w="58"><span class="t">58 mm</span><div class="d">32 kolom • printer Bluetooth genggam</div></button><button type="button" class="choice' + (p.lebar === 80 ? ' on' : '') + '" data-w="80"><span class="t">80 mm</span><div class="d">48 kolom • printer kasir induk</div></button></div>' +
        '<div class="grid-2 mt">' + fld('Model struk 58 mm', '<select class="select" data-p="template58">' + selectOpts(opsTpl(58), p.template58) + '</select>') + fld('Model struk 80 mm', '<select class="select" data-p="template80">' + selectOpts(opsTpl(80), p.template80) + '</select>') +
        fld('Model ultra hemat', '<select class="select" data-p="templateHemat">' + selectOpts(opsTpl(58), p.templateHemat) + '</select>') + fld('Rangkap cetak', '<select class="select" data-p="salinan">' + selectOpts([{ v: 1, l: '1 lembar' }, { v: 2, l: '2 lembar (pelanggan + arsip)' }, { v: 3, l: '3 lembar' }], p.salinan) + '</select>') +
        fld('Kepekatan cetak', '<select class="select" data-p="density">' + selectOpts([{ v: 'normal', l: 'Normal' }, { v: 'pekat', l: 'Pekat (disarankan)' }], p.density) + '</select>') + '</div>' +
        '<div class="col mt" style="gap:10px">' + sw('hemat', 'Mode ultra hemat kertas', 'Sembunyikan QR & pakai model hemat.') + sw('headerRingkas', 'Header ringkas', 'Alamat usaha dipadatkan satu baris.') + sw('logo', 'Cetak logo', 'Logo struk (atur gambarnya di Tampilan & Branding).') + sw('qr', 'Cetak QR verifikasi', 'Pelanggan bisa cek keaslian struk.') +
        sw('rincianTimbang', 'Catatan timbangan digital', 'Baris jaminan timbangan resmi.') + sw('beep', 'Bunyi beep selesai', 'Untuk printer Bluetooth ESC/POS.') + sw('autoCut', 'Potong kertas otomatis', 'Bila printer mendukung pemotong.') + '</div></div></div>' +
        '<div class="save-bar"><button class="btn btn-outline" id="prUji">' + ic('printer', 'sm') + 'Uji cetak di perangkat ini</button><button class="btn btn-primary btn-lg" id="prOk">' + ic('save', 'sm') + 'Simpan Printer</button></div></div>' +
        '<div><div class="card card-pad" style="position:sticky;top:calc(var(--top-h) + 16px)"><div class="row" style="justify-content:space-between"><h3 class="card-title">Pratinjau Struk</h3><span class="badge b-info" id="prLbl"></span></div><div id="prPrev" class="mt" style="display:flex;justify-content:center;background:var(--cream);border-radius:14px;padding:18px;max-height:62vh;overflow:auto"></div>' +
        '<a class="btn btn-soft btn-block mt" href="#/dokumen/struk">' + ic('code-xml', 'sm') + 'Ubah Model / Tata Letak Struk</a><p class="muted mt-s" style="font-size:12px">Teks, urutan baris, dan isi struk diubah di menu <b>Dokumen & Struk</b> (editor dengan pratinjau langsung).</p></div></div></div>';
      var preview = function () {
        var o = { id: 'ORD-CONTOH-0001', kode: 'CONTOH1234', tanggal: hariIni(), waktu: '09:42', pelanggan: 'Restoran Nelayan Rasa', petugas: AppState.user.nama, alamat: 'Jl. Pluit Karang Blok B2', wa: '081298760001', items: [{ nama: 'Kakap Merah Segar', grade: 'Grade A', qty: 12.5, satuan: 'kg', harga: 95000, sub: 1187500 }, { nama: 'Udang Vaname 50', qty: 5, satuan: 'kg', harga: 90000, sub: 450000 }], subtotal: 1637500, total: 1637500, metode: 'Tunai', diterima: 1650000, kembalian: 12500, status: 'Lunas', berat: 17.5 };
        var h = Struk.baris(o, Object.assign({}, p, { kode: '' }));
        box.querySelector('#prPrev').innerHTML = Struk.html(h); box.querySelector('#prLbl').textContent = p.lebar + ' mm • ' + h.tpl.kode + ' • ±' + Struk.panjangCm(h) + ' cm';
      };
      box.querySelector('#prLebar').onclick = function (e) { var b = e.target.closest('[data-w]'); if (!b) return; p.lebar = +b.dataset.w; box.querySelectorAll('#prLebar .choice').forEach(function (x) { x.classList.toggle('on', x === b); }); preview(); };
      box.addEventListener('change', function (e) { var k = e.target.dataset.p; if (!k) return; p[k] = e.target.type === 'checkbox' ? e.target.checked : (k === 'salinan' ? +e.target.value : e.target.value); preview(); });
      box.querySelector('#prOk').onclick = function () { var b = this; self.simpanSet({ PRINTER: p }, b).then(function (r) { if (r) { s.printer = p; if (AppState.cfg) AppState.cfg.printer = p; } }); };
      box.querySelector('#prUji').onclick = function () { if (AppState.cfg) AppState.cfg.printer = Object.assign({}, AppState.cfg.printer, p); Pesanan.aturPrinter(); };
      preview();
    }, function (r) { self.gagal(box, r, function () { self.p_printer(box); }); });
  },

  /* ======================= TAMPILAN & BRANDING ======================= */
  p_tampilan: function (box) {
    var self = this;
    box.innerHTML = '<div class="skel mt" style="height:280px"></div>';
    this.muatSet().then(function (s) { self.renderTampilan(box, s); }, function (r) { self.gagal(box, r, function () { self.p_tampilan(box); }); });
  },
  renderTampilan: function (box, s) {
    var self = this, b = s.brand, n = s.nilai;
    var ikonOps = ['anchor', 'scale', 'truck', 'fish', 'package', 'store', 'users-round', 'receipt-text', 'banknote', 'ship', 'snowflake', 'star'].map(function (x) { return { v: x, l: x }; });
    var metrikOps = [{ v: 'stok_masuk', l: 'Stok masuk hari ini' }, { v: 'pesanan_hari', l: 'Pesanan & berat hari ini' }, { v: 'pelanggan_bulan', l: 'Pelanggan aktif bulan ini' }, { v: 'teks', l: 'Teks tetap (isi sendiri)' }];
    box.innerHTML = '<div class="set-grid"><div>' +
      '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic('image') + '</span><div><div class="t">Logo &amp; Gambar Latar</div><div class="muted" style="font-size:12.5px">Semua gambar bisa diganti. Diunggah ke folder Branding di Google Drive & dikompres otomatis.</div></div></div><div class="sec-body"><div class="brand-slots" id="tpSlots"></div></div></div>' +
      '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic('type') + '</span><div class="t">Nama &amp; Teks Aplikasi</div></div><div class="sec-body"><div class="grid-2" id="tpTeks">' +
      fld('Nama aplikasi', '<input class="input" data-b="APP_NAME" maxlength="80" value="' + esc(b.appName) + '">') + fld('Judul bilah atas', '<input class="input" data-b="APP_JUDUL" maxlength="80" value="' + esc(b.judul) + '">') +
      fld('Tagline di bawah logo', '<input class="input" data-b="APP_TAGLINE" maxlength="80" value="' + esc(b.tagline) + '">') + fld('Lokasi / pangkalan', '<input class="input" data-b="LOKASI" maxlength="80" value="' + esc(b.lokasi) + '">') +
      fld('Judul kecil halaman login', '<input class="input" data-b="loginJudul" maxlength="120" value="' + esc(b.loginJudul) + '">') + fld('Subjudul login', '<input class="input" data-b="loginSub" maxlength="200" value="' + esc(b.loginSub) + '">') +
      fld('Teks kaki halaman login', '<input class="input" data-b="footer" maxlength="200" value="' + esc(b.footer) + '">', { cls: 'span-2' }) + fld('Teks bantuan "Lupa sandi"', '<input class="input" data-b="bantuan" maxlength="300" value="' + esc(b.bantuan) + '" placeholder="mis. Hubungi Pak Budi 0812-xxxx">', { cls: 'span-2' }) +
      fld('Kegelapan lapisan login <b id="tpOvV">' + Math.round(b.overlay * 100) + '%</b>', '<input type="range" min="0" max="95" step="1" data-b="overlay" value="' + Math.round(b.overlay * 100) + '">') +
      fld('Kegelapan lapisan menu samping <b id="tpSovV">' + Math.round(b.sidebarOverlay * 100) + '%</b>', '<input type="range" min="0" max="98" step="1" data-b="sidebarOverlay" value="' + Math.round(b.sidebarOverlay * 100) + '">') + '</div></div></div>' +
      '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic('layout-grid') + '</span><div><div class="t">Kartu Foto Dashboard</div><div class="muted" style="font-size:12.5px">Gambarnya diatur di slot Kartu 1–3 di atas</div></div></div><div class="sec-body"><div class="grid-3" id="tpKartu">' +
      b.kartu.map(function (k, i) {
        return '<div class="box" style="padding:14px" data-kartu="' + i + '"><div class="label-up mb-s">Kartu ' + (i + 1) + '</div>' + fld('Badge', '<input class="input" data-kk="badge" maxlength="30" value="' + esc(k.badge) + '">') + fld('Judul', '<input class="input" data-kk="judul" maxlength="60" value="' + esc(k.judul) + '">', { cls: 'mt-s' }) + fld('Label', '<input class="input" data-kk="label" maxlength="80" value="' + esc(k.label) + '">', { cls: 'mt-s' }) +
          fld('Nilai yang ditampilkan', '<select class="select" data-kk="metrik">' + selectOpts(metrikOps, k.metrik) + '</select>', { cls: 'mt-s' }) + fld('Teks tetap', '<input class="input" data-kk="teks" maxlength="80" value="' + esc(k.teks || '') + '">', { cls: 'mt-s', hint: 'Dipakai bila nilai = teks tetap' }) + fld('Ikon', '<select class="select" data-kk="ikon">' + selectOpts(ikonOps, k.ikon) + '</select>', { cls: 'mt-s' }) + '</div>';
      }).join('') + '</div></div></div>' +
      '<div class="save-bar"><span class="muted grow" style="font-size:12.5px">' + ic('info', 'sm') + ' Gambar tersimpan langsung saat diunggah. Tombol ini menyimpan teks, kegelapan & kartu.</span><button class="btn btn-primary btn-lg" id="tpOk">' + ic('save', 'sm') + 'Simpan Tampilan</button></div></div>' +
      '<div><div class="card" style="overflow:hidden;position:sticky;top:calc(var(--top-h) + 16px)"><div class="card-head"><h3 class="card-title">Pratinjau Login</h3><span class="badge b-info">langsung</span></div>' +
      '<div style="position:relative;height:380px;margin:0 18px 18px;border-radius:14px;overflow:hidden;background:var(--teal-950)"><div id="tpPrevBg" style="position:absolute;inset:0;background-size:cover;background-position:center"></div><div id="tpPrevOv" style="position:absolute;inset:0;background:rgba(13,79,79,' + b.overlay + ')"></div>' +
      '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.62);width:400px;background:#fff;border-radius:20px;padding:24px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.4)"><div class="login-logo" style="margin-bottom:10px"><img id="tpPrevLogo" alt=""></div><div class="login-title" style="font-size:30px" id="tpPrevNm">' + esc(b.appName) + '</div><div class="login-kick" id="tpPrevKick">' + esc(b.loginJudul) + '</div><div class="login-sub" id="tpPrevSub">' + esc(b.loginSub) + '</div><div class="skel" style="height:40px;border-radius:10px"></div><div class="skel mt-s" style="height:40px;border-radius:10px"></div><div class="btn btn-accent btn-block mt-s">Masuk</div></div></div></div></div></div>';
    this.renderSlots(box);
    var prev = function () {
      App.pasangGambar(box.querySelector('#tpPrevBg'), App.gambar('loginBg')); App.pasangGambar(box.querySelector('#tpPrevLogo'), App.gambar('logo'));
    };
    prev();
    box.querySelector('#tpTeks').addEventListener('input', function (e) {
      var k = e.target.dataset.b; if (!k) return;
      if (k === 'overlay') { box.querySelector('#tpOvV').textContent = e.target.value + '%'; box.querySelector('#tpPrevOv').style.background = 'rgba(13,79,79,' + (e.target.value / 100) + ')'; }
      if (k === 'sidebarOverlay') { box.querySelector('#tpSovV').textContent = e.target.value + '%'; document.documentElement.style.setProperty('--side-ov', String(e.target.value / 100)); }
      if (k === 'APP_NAME') box.querySelector('#tpPrevNm').textContent = e.target.value; if (k === 'loginJudul') box.querySelector('#tpPrevKick').textContent = e.target.value; if (k === 'loginSub') box.querySelector('#tpPrevSub').textContent = e.target.value;
    });
    box.querySelector('#tpOk').onclick = function () {
      var d = {}, btn = this;
      box.querySelectorAll('#tpTeks [data-b]').forEach(function (x) { d[x.dataset.b] = x.type === 'range' ? x.value / 100 : x.value.trim(); });
      d.kartu = Array.prototype.map.call(box.querySelectorAll('[data-kartu]'), function (c) { var k = {}; c.querySelectorAll('[data-kk]').forEach(function (x) { k[x.dataset.kk] = x.value.trim(); }); return k; });
      setBusy(btn, true, 'Menyimpan…');
      api('brand.save', d).then(function (r) { setBusy(btn, false); if (!toastRes(r, 'Tampilan tersimpan')) return; self.pakaiBrand(r.data); App.muatPublik(); });
    };
    box.__prev = prev;
  },
  renderSlots: function (box) {
    var self = this, b = AppState.brand || {}, slot = (this.set && this.set.slot) || {};
    var wrap = box.querySelector('#tpSlots');
    wrap.innerHTML = Object.keys(slot).map(function (k) {
      var inf = SLOT_INFO[k] || { d: '' }, custom = !!(b.img && b.img[k]);
      return '<div class="slot"><div class="sp ' + (inf.contain ? 'contain' : '') + '" data-sp="' + k + '">' + (custom || IMG_DEFAULT[k] ? '' : '<div class="center muted" style="padding-top:44px;font-size:12px">Bawaan (tanpa gambar)</div>') + '</div><div class="sb"><div class="row" style="justify-content:space-between"><b>' + esc(slot[k]) + '</b><span class="badge ' + (custom ? 'b-lunas' : 'b-dark') + '" style="font-size:10.5px">' + (custom ? 'Custom' : 'Bawaan') + '</span></div><div class="d">' + esc(inf.d) + '</div>' +
        '<div class="row gap-s" style="flex-wrap:wrap"><button class="btn btn-primary btn-sm" data-up="' + k + '">' + ic('upload', 'sm') + 'Unggah</button><button class="btn btn-outline btn-sm" data-url="' + k + '">' + ic('link', 'sm') + 'URL</button>' + (custom ? '<button class="btn btn-ghost btn-sm" data-hapus="' + k + '" title="Kembalikan ke bawaan">' + ic('rotate-ccw', 'sm') + '</button>' : '') + '</div></div></div>';
    }).join('');
    wrap.querySelectorAll('[data-sp]').forEach(function (x) { var u = App.gambar(x.dataset.sp); if (u) App.pasangGambar(x, u); });
    if (wrap.__pasang) return; wrap.__pasang = true;
    wrap.addEventListener('click', function (e) {
      var up = e.target.closest('[data-up]'), ur = e.target.closest('[data-url]'), hp = e.target.closest('[data-hapus]');
      if (up) self.unggahSlot(box, up.dataset.up, up);
      if (ur) self.urlSlot(box, ur.dataset.url);
      if (hp) konfirmasi('Kembalikan ' + esc(((self.set || {}).slot || {})[hp.dataset.hapus]) + ' ke bawaan?', 'Gambar custom dihapus dari Drive dan diganti gambar bawaan aplikasi.', { ok: 'Kembalikan' }).then(function (ok) {
        if (!ok) return; api('brand.save', { hapus: hp.dataset.hapus }).then(function (r) { if (toastRes(r, 'Gambar dikembalikan')) { self.pakaiBrand(r.data); self.renderSlots(box); if (box.__prev) box.__prev(); } });
      });
    });
  },
  unggahSlot: function (box, slot, btn) {
    var self = this, inf = SLOT_INFO[slot] || { w: 1600 };
    pilihFile('image/*').then(function (f) {
      if (!f) return;
      if (f.size > 15 * 1024 * 1024) return toast('Berkas terlalu besar', 'Maksimal 15 MB sebelum dikompres.', 'err');
      setBusy(btn, true);
      kompresGambar(f, inf.w || 1600, 0.82, inf.png || /png|svg/.test(f.type) ? 'image/png' : 'image/jpeg').then(function (url) {
        if (url.length > 6.5e6) { setBusy(btn, false); return toast('Gambar masih terlalu besar', 'Gunakan resolusi lebih kecil.', 'err'); }
        return api('brand.upload', { slot: slot, dataUrl: url }).then(function (r) { setBusy(btn, false); if (!toastRes(r, 'Gambar diperbarui')) return; self.pakaiBrand(r.data.brand); self.renderSlots(box); if (box.__prev) box.__prev(); });
      });
    });
  },
  urlSlot: function (box, slot) {
    var self = this;
    var m = modal({ judul: 'Pakai gambar dari URL', ikon: 'link', sub: esc(((this.set || {}).slot || {})[slot] || slot), isi: fld('URL gambar (https://…)', '<input class="input" id="usU" placeholder="https://…/gambar.jpg" autofocus>', { hint: 'Gunakan tautan langsung ke berkas gambar (bisa dari hosting Anda sendiri). Tautan Google Drive sebaiknya diunggah langsung.' }),
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="usOk">Pakai</button>' });
    m.$('#usOk').onclick = function () {
      var u = m.$('#usU').value.trim(); if (!/^https:\/\/\S+$/.test(u)) return toast('URL tidak valid', 'Harus diawali https://', 'err');
      var b = m.$('#usOk'); setBusy(b, true);
      api('brand.save', { slot: slot, url: u }).then(function (r) { setBusy(b, false); if (!toastRes(r, 'Gambar diperbarui')) return; m.close(); self.pakaiBrand(r.data); self.renderSlots(box); if (box.__prev) box.__prev(); });
    };
  },

  /* ======================= KEAMANAN & BACKUP ======================= */
  SPEC_AMAN: [
    { judul: 'Keamanan & Akses', ikon: 'shield-check', sub: 'Berlaku untuk semua akun', f: [['APPROVAL_BATAL', 'Pembatalan nota hanya oleh Owner', 'saklar', 'span-2', 'Disarankan aktif. Staff tidak bisa membatalkan nota yang sudah tersimpan.'], ['NOTIF_KEAMANAN_OWNER', 'Peringatan keamanan ke Owner', 'saklar', 'span-2', 'Login gagal berulang, akun terkunci, PIN direset → WA/Email Owner.'],
      ['AUTO_LOCK_MENIT', 'Kunci layar otomatis (menit diam)', 'angka', '', '0 = tidak pernah'], ['GOOGLE_CLIENT_ID', 'Google OAuth Client ID (opsional)', 'teks', '', 'Untuk tombol "Masuk dengan Google"'], ['APP_URL', 'URL aplikasi (GitHub Pages)', 'teks', 'span-2', 'Terisi otomatis saat Owner login. Dipakai di tautan struk, QR & pesan WA.'],
      ['DEMO_MODE', 'Tampilkan akun demo di halaman login', 'saklar', 'span-2', 'Matikan sebelum dipakai operasional sungguhan.'], ['KEEP_WARM', 'Pemanas server tiap menit', 'saklar', 'span-2', 'Menjaga respons tetap cepat (memakai kuota trigger ringan).']] },
    { judul: 'Backup Otomatis', ikon: 'hard-drive', sub: 'Salinan lengkap spreadsheet ke folder Backup di Drive', f: [['BACKUP_AKTIF', 'Backup harian otomatis (±04:00)', 'saklar', 'span-2', ''], ['BACKUP_RETENSI', 'Jumlah backup disimpan', 'angka', '', '3–60, yang lama dihapus otomatis'], ['ARSIP_BULAN', 'Bulan data aktif sebelum diarsipkan', 'angka', '', 'Minimal 2 bulan']] }
  ],
  p_keamanan: function (box) {
    var self = this;
    box.innerHTML = '<div class="skel mt" style="height:280px"></div>';
    this.muatSet().then(function (s) {
      box.innerHTML = self.renderSpec(self.SPEC_AMAN, s.nilai) + self.barSimpan('kmOk') +
        '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic('history') + '</span><div class="t">Daftar Backup</div><span class="r"><button class="btn btn-primary btn-sm" id="bkNow">' + ic('hard-drive', 'sm') + 'Backup Sekarang</button></span></div><div class="sec-body" id="bkList"><div class="skel" style="height:120px"></div></div></div>' +
        '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm amber">' + ic('flask-conical') + '</span><div><div class="t">Data Demo (Uji Coba)</div><div class="muted" style="font-size:12.5px">Isi produk, pelanggan, pesanan 30 hari & piutang fiktif untuk latihan. Bisa dihapus bersih kapan saja.</div></div></div><div class="sec-body row gap-s" style="flex-wrap:wrap"><button class="btn btn-outline" id="dmSeed">' + ic('flask-conical', 'sm') + 'Buat Data Demo</button><button class="btn btn-danger" id="dmHapus">' + ic('trash-2', 'sm') + 'Hapus Data Demo</button><span class="muted" style="font-size:12.5px">Akun demo: kasir@demo.viaseafood.id / demo123</span></div></div>';
      box.querySelector('#kmOk').onclick = function () { self.simpanSet(self.bacaSpec(box.querySelector('.sec-card').parentNode, self.set.nilai), this); };
      box.querySelector('#bkNow').onclick = function () { var b = this; setBusy(b, true, 'Membuat backup…'); api('backup.now', {}).then(function (r) { setBusy(b, false); if (toastRes(r)) self.muatBackup(box); }); };
      box.querySelector('#dmSeed').onclick = function () { var b = this; konfirmasi('Buat data demo?', 'Menambah 10 produk, 8 pelanggan, ±30 hari pesanan, piutang & kas fiktif berawalan DMO/PRD-D/PLG-D. Data asli tidak diubah.', { ok: 'Buat Data Demo' }).then(function (ok) { if (!ok) return; setBusy(b, true, 'Membuat…'); api('demo.seed', { hari: 30 }).then(function (r) { setBusy(b, false); if (toastRes(r)) { swrStale(''); App.segarkanBoot(); } }); }); };
      box.querySelector('#dmHapus').onclick = function () { var b = this; konfirmasi('Hapus semua data demo?', 'Produk, pelanggan, pesanan, piutang, kas & akun demo dihapus. Data asli tidak tersentuh.', { bahaya: true, ok: 'Hapus Data Demo', ketik: 'HAPUS' }).then(function (ok) { if (!ok) return; setBusy(b, true, 'Menghapus…'); api('demo.hapus', {}).then(function (r) { setBusy(b, false); if (toastRes(r)) { swrStale(''); App.segarkanBoot(); } }); }); };
      self.muatBackup(box);
    }, function (r) { self.gagal(box, r, function () { self.p_keamanan(box); }); });
  },
  muatBackup: function (box) {
    var self = this;
    api('backup.list', {}).then(function (r) {
      var el = box.querySelector('#bkList'); if (!el) return;
      if (!r.success) { el.innerHTML = retryBox(r); return; }
      var d = r.data;
      el.innerHTML = '<div class="row gap-s mb" style="flex-wrap:wrap"><span class="pill-stat">' + ic(d.aktif ? 'circle-check' : 'circle-x', 'sm') + 'Otomatis ' + (d.aktif ? 'aktif' : 'mati') + '</span><span class="pill-stat">Simpan ' + d.retensi + ' terakhir</span><span class="pill-stat">Terakhir: ' + esc(d.terakhir || '-') + '</span><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(d.folder) + '">' + ic('external-link', 'sm') + 'Folder Backup</a></div>' +
        (d.rows.length ? '<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>Berkas</th><th class="hide-m">Dibuat</th><th class="r hide-m">Ukuran</th><th></th></tr></thead><tbody>' + d.rows.map(function (b) {
          return '<tr><td class="full-m"><b>' + esc(b.nama) + '</b><div class="sub">' + esc(b.dibuat) + '</div></td><td class="hide-m">' + esc(waktuRelatif(b.dibuat)) + '</td><td class="r hide-m num">' + angka(Math.round(b.ukuran / 1024)) + ' KB</td><td class="r nowrap"><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(b.url) + '">' + ic('external-link', 'sm') + 'Buka</a><button class="btn btn-outline btn-sm" data-pulih="' + esc(b.id) + '" data-nama="' + esc(b.nama) + '">' + ic('rotate-ccw', 'sm') + 'Pulihkan</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">Belum ada backup. Klik <b>Backup Sekarang</b>.</p>');
      el.querySelectorAll('[data-pulih]').forEach(function (b) { b.onclick = function () { self.pulihkan(b.dataset.pulih, b.dataset.nama); }; });
    });
  },
  pulihkan: function (fileId, nama) {
    konfirmasi('Pulihkan data dari backup?', '<b>' + esc(nama) + '</b><br>Seluruh data aplikasi saat ini akan <b>diganti</b> isi backup. Sistem otomatis membuat backup pra-pulih terlebih dahulu sehingga bisa dibatalkan.', { bahaya: true, ok: 'Pulihkan Sekarang', ketik: 'PULIHKAN' }).then(function (ok) {
      if (!ok) return;
      var m = modal({ judul: 'Memulihkan data…', ikon: 'rotate-ccw', tutupLuar: false, isi: '<div class="progress"><i id="plBar" style="width:3%"></i></div><div class="mt-s muted" id="plInfo">Membuat backup pra-pulih…</div><div class="note-amber mt">' + ic('triangle-alert', 'sm') + '<span>Jangan tutup halaman sampai selesai.</span></div>' });
      m.box.setAttribute('data-noesc', '1'); m.el.querySelector('.modal-x').remove();
      api('backup.restore', { fileId: fileId, konfirmasi: 'PULIHKAN', langkah: 'mulai' }, { timeout: 300000 }).then(function (r) {
        if (!r.success) { m.close(); return toast('Gagal', r.message, 'err'); }
        var sheets = r.data.sheets, i = 0;
        var lanjut = function () {
          if (i >= sheets.length) { m.close(); toast('Pemulihan selesai', sheets.length + ' sheet dipulihkan.'); swrStale(''); App.segarkanBoot(); return; }
          m.$('#plInfo').textContent = 'Memulihkan ' + sheets[i] + ' (' + (i + 1) + '/' + sheets.length + ')…'; m.$('#plBar').style.width = Math.round((i + 1) / sheets.length * 100) + '%';
          api('backup.restore', { fileId: fileId, konfirmasi: 'PULIHKAN', sheet: sheets[i], terakhir: i === sheets.length - 1 }, { timeout: 300000 }).then(function (x) { if (!x.success) { m.close(); return toast('Berhenti di ' + sheets[i], x.message + ' Backup pra-pulih tersedia di folder Backup.', 'err'); } i++; lanjut(); });
        };
        lanjut();
      });
    });
  },

  /* ======================= MIGRASI DATA ======================= */
  TARGET: [{ v: 'Produk', l: 'Produk & Stok' }, { v: 'Pelanggan', l: 'Pelanggan' }, { v: 'Users', l: 'Akun Staff' }, { v: 'Pesanan', l: 'Pesanan / Penjualan' }, { v: 'Piutang', l: 'Piutang' }, { v: 'Keuangan', l: 'Keuangan (kas)' }],
  tebakTarget: function (nama) {
    var n = String(nama).toLowerCase();
    return /produk|stok|barang|komoditas|ikan/.test(n) ? 'Produk' : /pelanggan|customer|konsumen|mitra/.test(n) ? 'Pelanggan' : /pesanan|penjualan|transaksi|order|nota|jual/.test(n) ? 'Pesanan' : /piutang|hutang|tagihan/.test(n) ? 'Piutang' : /kas|keuangan|pengeluaran|biaya|pemasukan/.test(n) ? 'Keuangan' : /user|staff|karyawan|akun|pegawai/.test(n) ? 'Users' : '';
  },
  p_migrasi: function (box) {
    var self = this;
    box.innerHTML = '<div class="note-teal mt">' + ic('info') + '<span><b>Pindahkan pembukuan lama tanpa ketik ulang.</b> Kolom dikenali otomatis dari nama header (mis. "Nama Ikan", "Harga/Kg", "No WA"). Selalu <b>Pindai</b> dulu (uji tanpa menulis), lalu <b>Impor</b>. Menjalankan ulang aman — data yang sama tidak dobel. Urutan disarankan: <b>Produk → Pelanggan → Akun → Pesanan → Piutang → Keuangan</b>.</span></div>' +
      '<div class="split" style="margin-top:var(--gut)"><div class="card sec-card" style="margin-top:0"><div class="sec-head"><span class="ic-box sm paid">' + ic('sheet') + '</span><div><div class="t">Dari Google Spreadsheet Lama</div><div class="muted" style="font-size:12.5px">Hanya DIBACA — spreadsheet lama tidak diubah</div></div></div><div class="sec-body">' +
      fld('URL / ID spreadsheet lama', '<input class="input" id="mgUrl" placeholder="https://docs.google.com/spreadsheets/d/…">', { hint: 'Spreadsheet harus bisa dibuka oleh akun Google pemilik Apps Script.' }) +
      '<div class="row gap-s mt" style="flex-wrap:wrap"><label class="filter-pill">Mode <select id="mgMode"><option value="isi">Tambah & lengkapi (aman)</option><option value="timpa">Timpa data yang sama</option></select></label><button class="btn btn-primary" id="mgScan">' + ic('scan-search', 'sm') + 'Pindai Spreadsheet</button></div></div></div>' +
      '<div class="card sec-card" style="margin-top:0"><div class="sec-head"><span class="ic-box sm amber">' + ic('file-spreadsheet') + '</span><div><div class="t">Dari Berkas Excel / CSV</div><div class="muted" style="font-size:12.5px">Dibaca di perangkat ini lalu dikirim bertahap</div></div></div><div class="sec-body"><div class="dropzone" id="mgDrop">' + ic('upload', 'lg') + '<div><b>Pilih / seret berkas .xlsx, .xls, .csv</b></div><div class="muted" style="font-size:12.5px">Setiap sheet bisa diimpor ke target berbeda</div></div></div></div></div>' +
      '<div id="mgHasil"></div>' +
      '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic('download') + '</span><div><div class="t">Ekspor Data ke Excel</div><div class="muted" style="font-size:12.5px">Unduh isi tabel apa pun sebagai .xlsx</div></div></div><div class="sec-body row gap-s" style="flex-wrap:wrap">' +
      '<select class="select" id="ekSheet" style="max-width:280px">' + selectOpts(['Produk', 'Pelanggan', 'Pesanan', 'LogStok', 'Piutang', 'Pembayaran_Piutang', 'Pengeluaran_Pemasukan', 'Rekap_Harian', 'Rekap_Pelanggan_Bulanan', 'CRM_Kontak', 'AntrianNotif', 'Log_Aktivitas', 'DE_Dokumen'].map(function (x) { return { v: x, l: x.replace(/_/g, ' ') }; })) + '</select>' +
      '<input type="month" class="input" id="ekPer" value="' + periodeIni() + '" style="max-width:180px" title="Periode (untuk Pesanan & LogStok)"><button class="btn btn-outline" id="ekOk">' + ic('download', 'sm') + 'Unduh .xlsx</button></div></div>';
    box.querySelector('#mgScan').onclick = function () {
      var url = box.querySelector('#mgUrl').value.trim(), b = this; if (!url) return toast('Tempel URL spreadsheet lama', '', 'warn');
      setBusy(b, true, 'Memindai…');
      api('migrasi.scan', { sumber: url, mode: box.querySelector('#mgMode').value }, { timeout: 300000 }).then(function (r) { setBusy(b, false); if (!r.success) return toast('Gagal memindai', r.message, 'err'); self.hasilScan(box, r.data, url); });
    };
    var dz = box.querySelector('#mgDrop');
    var baca = function (f) { if (!f) return; var t = toast('Membaca ' + f.name + '…', '', '', 20000); bacaBerkasTabel(f).then(function (sheets) { t.remove(); self.hasilBerkas(box, sheets, f.name); }).catch(function (e) { t.remove(); toast('Gagal membaca berkas', e.message, 'err'); }); };
    dz.onclick = function () { pilihFile('.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv').then(baca); };
    dz.ondragover = function (e) { e.preventDefault(); dz.classList.add('on'); }; dz.ondragleave = function () { dz.classList.remove('on'); };
    dz.ondrop = function (e) { e.preventDefault(); dz.classList.remove('on'); baca(e.dataTransfer.files[0]); };
    box.querySelector('#ekOk').onclick = function () {
      var b = this, sh = box.querySelector('#ekSheet').value; setBusy(b, true);
      api('ekspor.sheet', { sheet: sh, periode: box.querySelector('#ekPer').value }, { timeout: 300000 }).then(function (r) { setBusy(b, false); if (!r.success) return toast('Gagal', r.message, 'err'); if (!r.data.rows.length) return toast('Sheet kosong', r.data.nama, 'warn'); eksporXLSX(r.data.nama + '.xlsx', [{ nama: r.data.nama, kolom: r.data.kolom, rows: r.data.rows }]); });
    };
  },
  ringkasImpor: function (h) {
    return '<div class="row gap-s" style="flex-wrap:wrap"><span class="badge b-lunas">+' + angka(h.ditambah) + ' baru</span><span class="badge b-info">' + angka(h.diperbarui) + ' diperbarui</span><span class="badge b-dark">' + angka(h.dilewati) + ' dilewati</span>' + (h.catatan ? '<span class="muted" style="font-size:12px">' + esc(h.catatan) + '</span>' : '') + '</div>' +
      ((h.peringatan || []).length ? '<details class="mt-s"><summary class="muted" style="cursor:pointer;font-size:12.5px">' + h.peringatan.length + ' peringatan</summary><ul style="font-size:12px;color:var(--ink-2);margin:6px 0 0 18px">' + h.peringatan.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></details>' : '');
  },
  hasilScan: function (box, d, url) {
    var self = this, mode = box.querySelector('#mgMode').value;
    var out = box.querySelector('#mgHasil');
    out.innerHTML = '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm paid">' + ic('sheet') + '</span><div><div class="t">' + esc(d.sumber.nama) + '</div><div class="muted" style="font-size:12.5px">' + d.sheets.length + ' sheet terbaca</div></div></div><div class="sec-body col" style="gap:14px">' + d.sheets.map(function (s, i) {
      var t = s.target || '';
      return '<div class="box" data-i="' + i + '"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px"><div><b>' + esc(s.sheet) + '</b> <span class="muted">• ' + angka(s.baris) + ' baris • header baris ' + s.barisHeader + '</span></div><div class="row gap-s"><label class="filter-pill">Impor ke <select data-t>' + selectOpts(self.TARGET, t, '— lewati —') + '</select></label>' +
        '<label class="check" data-ks' + (t === 'Pesanan' ? '' : ' hidden') + '><input type="checkbox" data-kurangi> Kurangi stok</label><button class="btn btn-primary btn-sm" data-run' + (t ? '' : ' disabled') + '>' + ic('play', 'sm') + 'Impor</button></div></div>' +
        (t ? '<div class="mt-s" style="font-size:12.5px"><span class="label-up">Pemetaan kolom:</span> ' + Object.keys(s.peta).map(function (f) { return '<span class="chip chip-s" style="margin:2px">' + esc(f) + ' ← ' + esc(s.peta[f]) + '</span>'; }).join('') + '</div>' : '<div class="muted mt-s" style="font-size:12.5px">Target tidak terdeteksi. Kolom: ' + esc(s.headers.slice(0, 12).join(', ')) + '</div>') +
        (s.perkiraan ? '<div class="mt-s"><span class="label-up">Perkiraan:</span> ' + self.ringkasImpor(s.perkiraan) + '</div>' : '') + (s.galat ? '<div class="note-coral mt-s">' + ic('circle-alert', 'sm') + '<span>' + esc(s.galat) + '</span></div>' : '') +
        '<div class="progress mt-s" hidden><i style="width:0"></i></div><div class="hasil mt-s"></div></div>';
    }).join('') + '</div></div>';
    out.querySelectorAll('[data-i]').forEach(function (bx) {
      var s = d.sheets[+bx.dataset.i];
      bx.querySelector('[data-t]').onchange = function (e) { bx.querySelector('[data-run]').disabled = !e.target.value; bx.querySelector('[data-ks]').hidden = e.target.value !== 'Pesanan'; };
      bx.querySelector('[data-run]').onclick = function () {
        var b = this, target = bx.querySelector('[data-t]').value, kurangi = bx.querySelector('[data-kurangi]').checked;
        konfirmasi('Impor "' + esc(s.sheet) + '" ke ' + esc(target) + '?', angka(s.baris) + ' baris diproses bertahap per 2.000 baris. Aman dijalankan ulang (tidak dobel).', { ok: 'Mulai Impor' }).then(function (ok) {
          if (!ok) return; setBusy(b, true, 'Mengimpor…');
          var bar = bx.querySelector('.progress'), tot = { ditambah: 0, diperbarui: 0, dilewati: 0, peringatan: [] }; bar.hidden = false;
          var batch = 'MIG-' + Date.now().toString(36);
          var jalan = function (offset) {
            api('migrasi.run', { sumber: url, sheet: s.sheet, target: target, peta: target === s.target ? s.peta : null, offset: offset, limit: 2000, mode: mode, kurangiStok: kurangi, batchId: batch }, { timeout: 330000 }).then(function (r) {
              if (!r.success) { setBusy(b, false); bx.querySelector('.hasil').innerHTML = '<div class="note-coral">' + ic('circle-alert', 'sm') + '<span>' + esc(r.message) + '</span></div>'; return; }
              ['ditambah', 'diperbarui', 'dilewati'].forEach(function (k) { tot[k] += r.data[k]; }); tot.peringatan = tot.peringatan.concat(r.data.peringatan || []).slice(0, 40);
              bar.querySelector('i').style.width = Math.round(Math.min(r.data.next || r.data.total, r.data.total) / Math.max(1, r.data.total) * 100) + '%';
              bx.querySelector('.hasil').innerHTML = '<span class="label-up">Hasil:</span> ' + self.ringkasImpor(tot);
              if (r.data.next != null) jalan(r.data.next); else { setBusy(b, false); b.innerHTML = ic('check', 'sm') + 'Selesai'; toast('Impor ' + s.sheet + ' selesai', '+' + tot.ditambah + ' baru'); swrStale(''); App.segarkanBoot(true); }
            });
          };
          jalan(0);
        });
      };
    });
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  hasilBerkas: function (box, sheets, namaBerkas) {
    var self = this, mode = box.querySelector('#mgMode').value, out = box.querySelector('#mgHasil');
    sheets = sheets.filter(function (s) { return s.rows.length; });
    if (!sheets.length) { out.innerHTML = '<div class="card mt">' + emptyState('file-spreadsheet', 'Berkas kosong', 'Tidak ada baris data yang terbaca.') + '</div>'; return; }
    out.innerHTML = '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm amber">' + ic('file-spreadsheet') + '</span><div><div class="t">' + esc(namaBerkas) + '</div><div class="muted" style="font-size:12.5px">' + sheets.length + ' sheet berisi data</div></div></div><div class="sec-body col" style="gap:14px">' + sheets.map(function (s, i) {
      var t = self.tebakTarget(s.nama);
      return '<div class="box" data-i="' + i + '"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px"><div><b>' + esc(s.nama) + '</b> <span class="muted">• ' + angka(s.rows.length) + ' baris</span><div class="muted" style="font-size:12px">Kolom: ' + esc(s.kolom.slice(0, 10).join(', ')) + (s.kolom.length > 10 ? '…' : '') + '</div></div>' +
        '<div class="row gap-s" style="flex-wrap:wrap"><label class="filter-pill">Impor ke <select data-t>' + selectOpts(self.TARGET, t, '— pilih —') + '</select></label><label class="check" data-ks' + (t === 'Pesanan' ? '' : ' hidden') + '><input type="checkbox" data-kurangi> Kurangi stok</label><button class="btn btn-outline btn-sm" data-scan>' + ic('scan-search', 'sm') + 'Pindai</button><button class="btn btn-primary btn-sm" data-run>' + ic('play', 'sm') + 'Impor</button></div></div>' +
        '<div class="progress mt-s" hidden><i style="width:0"></i></div><div class="hasil mt-s"></div></div>';
    }).join('') + '</div></div>';
    out.querySelectorAll('[data-i]').forEach(function (bx) {
      var s = sheets[+bx.dataset.i], peta = null;
      var sel = bx.querySelector('[data-t]');
      sel.onchange = function () { peta = null; bx.querySelector('[data-ks]').hidden = sel.value !== 'Pesanan'; };
      var kirim = function (dry, b) {
        var target = sel.value; if (!target) return toast('Pilih target impor', '', 'warn');
        var kurangi = bx.querySelector('[data-kurangi]').checked, per = 1000, tot = { ditambah: 0, diperbarui: 0, dilewati: 0, peringatan: [] }, bar = bx.querySelector('.progress');
        var rows = dry ? s.rows.slice(0, 2000) : s.rows;
        setBusy(b, true, dry ? 'Memindai…' : 'Mengimpor…'); if (!dry) bar.hidden = false;
        var jalan = function (off) {
          var potong = rows.slice(off, off + per).map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { var v = r[k]; o[k] = v instanceof Date ? tglLokal(v) : v; }); return o; });
          api('migrasi.rows', { target: target, rows: potong, peta: peta, offset: off, dryRun: dry, mode: mode, kurangiStok: kurangi, namaBerkas: namaBerkas, terakhir: off + per >= rows.length }, { timeout: 330000 }).then(function (r) {
            if (!r.success) { setBusy(b, false); bx.querySelector('.hasil').innerHTML = '<div class="note-coral">' + ic('circle-alert', 'sm') + '<span>' + esc(r.message) + '</span></div>'; return; }
            peta = r.data.peta;
            ['ditambah', 'diperbarui', 'dilewati'].forEach(function (k) { tot[k] += r.data[k]; }); tot.peringatan = tot.peringatan.concat(r.data.peringatan || []).slice(0, 40);
            if (!dry) bar.querySelector('i').style.width = Math.round(Math.min(off + per, rows.length) / rows.length * 100) + '%';
            if (dry && s.rows.length > 2000) tot.catatan = 'Perkiraan dari 2.000 baris pertama.';
            bx.querySelector('.hasil').innerHTML = '<div style="font-size:12.5px" class="mb-s"><span class="label-up">Pemetaan:</span> ' + Object.keys(peta || {}).map(function (f) { return '<span class="chip chip-s" style="margin:2px">' + esc(f) + ' ← ' + esc(peta[f]) + '</span>'; }).join('') + '</div><span class="label-up">' + (dry ? 'Perkiraan' : 'Hasil') + ':</span> ' + self.ringkasImpor(tot);
            if (off + per < rows.length) jalan(off + per);
            else { setBusy(b, false); if (!dry) { b.innerHTML = ic('check', 'sm') + 'Selesai'; toast('Impor ' + s.nama + ' selesai', '+' + tot.ditambah + ' baru'); swrStale(''); App.segarkanBoot(true); } }
          });
        };
        jalan(0);
      };
      bx.querySelector('[data-scan]').onclick = function () { kirim(true, this); };
      bx.querySelector('[data-run]').onclick = function () { var b = this; konfirmasi('Impor ' + angka(s.rows.length) + ' baris ke ' + esc(sel.value || '?') + '?', 'Dikirim bertahap per 1.000 baris. Aman dijalankan ulang.', { ok: 'Mulai Impor' }).then(function (ok) { if (ok) kirim(false, b); }); };
    });
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  /* ======================= INTEGRASI SHEETS & DRIVE ======================= */
  p_sistem: function (box) { box.innerHTML = '<div class="skel mt" style="height:300px"></div>'; this.r_sistem(box); },
  r_sistem: function (box) {
    var self = this;
    api('sys.status', {}).then(function (r) {
      if (!r.success) return self.gagal(box, r, function () { self.r_sistem(box); });
      var d = r.data, f = d.folder, link = function (u, l, ik) { return u ? '<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="' + esc(u) + '">' + ic(ik || 'folder', 'sm') + esc(l) + '</a>' : ''; };
      box.innerHTML = '<div class="kpis" style="margin-top:var(--gut)">' +
        kpiHtml('Kapasitas Spreadsheet', angka(d.persenSel, 1) + '<small>%</small>', '<div style="width:100%"><div class="progress ' + (d.persenSel > 70 ? 'coral' : d.persenSel > 40 ? 'amber' : '') + '"><i style="width:' + Math.max(2, d.persenSel) + '%"></i></div><div class="mt-s">' + angka(d.sel) + ' dari 10 juta sel</div></div>', 'sheet', d.persenSel > 70 ? 'coral' : 'paid') +
        kpiHtml('Trigger Otomatis', d.triggerLengkap ? 'Lengkap' : 'Belum lengkap', d.trigger.length + ' trigger terpasang', 'timer', d.triggerLengkap ? 'paid' : 'coral', d.triggerLengkap ? '' : 'coral') +
        kpiHtml('Antrean Latar', String(d.rekapTertunda + d.logAntre), 'rekap tertunda ' + d.rekapTertunda + ' • log antre ' + d.logAntre + (d.antreanNotif ? ' • notif menunggu' : ''), 'list-checks', 'amber') +
        kpiHtml('Server', d.warm ? 'Hangat' : 'Dingin', d.warm ? 'dipanaskan ' + esc(waktuRelatif(d.warm.at)) : 'pemanas ' + (d.keepWarm === 'YA' ? 'aktif' : 'mati'), 'zap', d.warm ? 'paid' : 'amber') + '</div>' +
        '<div class="split" style="margin-top:var(--gut)"><div class="card card-pad"><h3 class="card-title">' + ic('database', 'sm') + ' Database Google Sheets</h3><p class="muted" style="font-size:13px">' + esc(d.nama) + ' • skema v' + esc(d.skema) + ' • aplikasi ' + esc(d.versi) + '</p>' +
        '<div class="row gap-s" style="flex-wrap:wrap">' + link(d.spreadsheet, 'Buka Spreadsheet', 'sheet') + '</div>' +
        '<div class="label-up mt">Folder Google Drive</div><div class="row gap-s mt-s" style="flex-wrap:wrap">' + link(f.root, 'Utama') + link(f.foto, 'Foto Produk', 'image') + link(f.bukti, 'Bukti Bayar', 'camera') + link(f.branding, 'Branding', 'palette') + link(f.dokumen, 'Dokumen', 'file-text') + link(f.backup, 'Backup', 'hard-drive') + link(f.arsip, 'Arsip', 'archive') + '</div>' +
        '<div class="label-up mt">Status lain</div><ul class="list-plain mt-s" style="font-size:13px;display:grid;gap:6px"><li>Kuota email harian tersisa: <b>' + angka(d.kuotaEmail) + '</b></li><li>Ukuran Script Properties: <b>' + d.ukuranProperti + ' KB</b> / 500 KB</li><li>Backup terakhir: <b>' + esc(d.backupTerakhir || '-') + '</b></li><li>Cache produk: <b>' + (d.cacheProduk ? 'hangat' : 'kosong') + '</b></li><li>Trigger: ' + esc(d.trigger.join(', ') || '-') + '</li></ul></div>' +
        '<div class="card card-pad"><h3 class="card-title">' + ic('wrench', 'sm') + ' Perawatan</h3>' +
        '<div class="sec-toggle mt"><div><div class="t">Sinkronkan ulang dari Sheets</div><div class="d">Pakai setelah mengedit data langsung di Google Sheets agar aplikasi membaca ulang.</div></div><button class="btn btn-outline btn-sm" id="syCache">' + ic('refresh-cw', 'sm') + 'Sinkronkan</button></div>' +
        '<div class="sec-toggle mt"><div><div class="t">Hitung ulang rekap bulan</div><div class="d">Rekap harian & pelanggan dihitung ulang dari data pesanan.</div></div><div class="row gap-s"><input type="month" class="input" id="syPer" value="' + periodeIni() + '" style="width:150px"><button class="btn btn-outline btn-sm" id="syRekap">' + ic('calculator', 'sm') + 'Hitung</button></div></div>' +
        '<div class="sec-toggle mt"><div><div class="t">Pasang ulang trigger</div><div class="d">Jalankan fungsi <code>setupAppEnvironment</code> di editor Apps Script bila trigger belum lengkap.</div></div><span class="badge ' + (d.triggerLengkap ? 'b-lunas' : 'b-hutang') + '">' + (d.triggerLengkap ? 'OK' : 'Perlu') + '</span></div></div></div>' +
        '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic('archive') + '</span><div><div class="t">Partisi Bulanan &amp; Arsip</div><div class="muted" style="font-size:12.5px">Pesanan & log stok disimpan per bulan. Bulan lama bisa dipindah ke spreadsheet arsip tahunan agar database tetap ringan — data tetap bisa dibaca.</div></div></div><div class="sec-body" id="syArsip"><div class="skel" style="height:100px"></div></div></div>' +
        '<div class="card sec-card"><div class="sec-head"><span class="ic-box sm">' + ic('table') + '</span><div class="t">Sheet Terbesar</div></div><div class="sec-body"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Sheet</th><th class="r">Baris data</th><th class="r">Sel terpakai</th></tr></thead><tbody>' + d.sheets.slice(0, 15).map(function (s) { return '<tr><td><b>' + esc(s.nama) + '</b></td><td class="r num">' + angka(s.baris) + '</td><td class="r num">' + angka(s.sel) + '</td></tr>'; }).join('') + '</tbody></table></div></div></div>';
      box.querySelector('#syCache').onclick = function () { var b = this; setBusy(b, true); api('sys.clearCache', {}).then(function (x) { setBusy(b, false); if (toastRes(x)) { swrStale(''); App.segarkanBoot(true); } }); };
      box.querySelector('#syRekap').onclick = function () {
        var b = this, per = box.querySelector('#syPer').value || periodeIni(); setBusy(b, true, 'Menghitung…');
        var jalan = function (mulai) { api('sys.rekapUlang', { periode: per, mulai: mulai }, { timeout: 330000 }).then(function (x) { if (!x.success) { setBusy(b, false); return toast('Gagal', x.message, 'err'); } if (x.data && x.data.sisa) return jalan(false); setBusy(b, false); toast(x.message); swrStale(''); }); };
        jalan(true);
      };
      self.muatArsip(box);
    });
  },
  muatArsip: function (box) {
    var self = this;
    api('arsip.status', {}).then(function (r) {
      var el = box.querySelector('#syArsip'); if (!el) return;
      if (!r.success) { el.innerHTML = retryBox(r); return; }
      var per = {}; r.data.rows.forEach(function (p) { var e = per[p.periode] || (per[p.periode] = { periode: p.periode, sheets: [], baris: 0, sel: 0, status: p.status, layak: p.layak }); e.sheets.push(p.sheet); e.baris += p.baris; e.sel += p.sel; if (p.status !== 'ARSIP') e.status = p.status; e.layak = e.layak || p.layak; });
      var list = Object.keys(per).sort().reverse().map(function (k) { return per[k]; });
      el.innerHTML = '<div class="muted mb-s" style="font-size:12.5px">Data aktif: ' + r.data.bulanAktif + ' bulan terakhir • periode sebelum <b>' + esc(r.data.batas) + '</b> disarankan diarsipkan.</div><div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>Periode</th><th class="hide-m">Sheet</th><th class="r">Baris</th><th class="c">Status</th><th></th></tr></thead><tbody>' + list.map(function (p) {
        return '<tr><td><b>' + periodeLabel(p.periode) + '</b></td><td class="hide-m muted">' + esc(p.sheets.join(', ')) + '</td><td class="r num">' + angka(p.baris) + '</td><td class="c">' + (p.status === 'ARSIP' ? '<span class="badge b-dark">Diarsipkan</span>' : '<span class="badge b-lunas">Aktif</span>') + '</td><td class="r">' + (p.status !== 'ARSIP' && p.periode < periodeGeser(periodeIni(), -1) ? '<button class="btn ' + (p.layak ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-arsip="' + p.periode + '">' + ic('archive', 'sm') + 'Arsipkan</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
      el.querySelectorAll('[data-arsip]').forEach(function (b) { b.onclick = function () {
        konfirmasi('Arsipkan ' + periodeLabel(b.dataset.arsip) + '?', 'Sheet pesanan & log stok bulan ini dipindah ke spreadsheet arsip tahunan (disalin & diverifikasi dulu). Data tetap terbaca di aplikasi.', { ok: 'Arsipkan' }).then(function (ok) {
          if (!ok) return; setBusy(b, true); api('arsip.run', { periode: b.dataset.arsip }, { timeout: 330000 }).then(function (x) { setBusy(b, false); if (toastRes(x)) self.muatArsip(box); });
        });
      }; });
    });
  }
};
registerPage('pengaturan', { auth: 'owner', judul: 'Pengaturan', template: function () { return Admin.template(); }, init: function (el) { Admin.init(el); }, show: function (el, p) { Admin.show(el, p); } });

/* =========================== LOG AKTIVITAS (AUDIT) =========================== */
var Audit = {
  st: { cari: '', kategori: '', email: '', dari: '', sampai: '', hal: 1, per: 25, data: null },
  WARNA: { 'TRANSAKSI POS': '', 'UPDATE STOK': 'amber', 'PIUTANG': 'coral', 'KEAMANAN & PIN': 'coral', 'KEUANGAN': '', 'AKUN': 'ink', 'PENGATURAN': 'ink', 'SISTEM': 'ink', 'MIGRASI': 'amber', 'DOKUMEN': '', 'NOTIFIKASI': '', 'PELANGGAN': '' },
  template: function () {
    return '<div class="page-head"><div><div class="eyebrow">Jejak Audit <span class="dot"></span><span class="loc">Tidak bisa diubah dari aplikasi</span></div><h1 class="page-title">Log Aktivitas</h1><p class="page-sub">Siapa melakukan apa, kapan, dan dari terminal mana</p></div><div class="page-actions"><button class="btn btn-outline" data-act="ekspor">' + ic('sheet', 'sm') + 'Ekspor</button><button class="btn btn-primary" data-act="muat">' + ic('refresh-cw', 'sm') + 'Segarkan</button></div></div>' +
      '<div class="card"><div class="filter-bar"><div class="searchbox grow" style="max-width:320px">' + ic('search') + '<input class="input soft" id="auCari" placeholder="Cari aksi, rincian, nota, terminal…"></div>' +
      '<label class="filter-pill">' + ic('filter', 'sm') + '<select id="auKat"><option value="">Semua kategori</option></select></label><label class="filter-pill">' + ic('user-round', 'sm') + '<select id="auUser"><option value="">Semua petugas</option></select></label>' +
      '<label class="filter-pill">' + ic('calendar', 'sm') + '<input type="date" id="auDari"></label><span class="muted">s/d</span><label class="filter-pill">' + ic('calendar', 'sm') + '<input type="date" id="auSampai"></label></div><div class="row gap-s" id="auChip" style="padding:0 16px 14px;flex-wrap:wrap"></div></div>' +
      '<div class="card" style="margin-top:var(--gut);overflow:hidden"><div class="tbl-wrap"><table class="tbl cards" id="auTbl"><thead><tr><th>Waktu</th><th>Petugas</th><th class="hide-m">Kategori</th><th>Aktivitas</th><th class="hide-m">Terminal</th></tr></thead><tbody>' + skeletonRows(8, 5) + '</tbody></table></div><div class="tbl-foot" id="auFoot"></div></div>';
  },
  init: function (el) {
    var self = this, st = this.st;
    el.querySelector('#auCari').oninput = debounce(function (e) { st.cari = e.target.value.trim(); st.hal = 1; self.muat(el); }, 450);
    ['auKat', 'auUser', 'auDari', 'auSampai'].forEach(function (id) { el.querySelector('#' + id).onchange = function () { st.kategori = el.querySelector('#auKat').value; st.email = el.querySelector('#auUser').value; st.dari = el.querySelector('#auDari').value; st.sampai = el.querySelector('#auSampai').value; st.hal = 1; self.muat(el); }; });
    el.querySelector('#auChip').onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; st.kategori = b.dataset.v; el.querySelector('#auKat').value = st.kategori; st.hal = 1; self.muat(el); };
    bindActs(el, { muat: function () { self.muat(el); }, hal: function (a) { st.hal = +a.dataset.h; self.render(el); }, ekspor: function () { self.ekspor(); } });
  },
  show: function (el) { this.muat(el); },
  muat: function (el) {
    var st = this.st, self = this;
    return api('audit.list', { cari: st.cari, kategori: st.kategori, email: st.email, dari: st.dari, sampai: st.sampai }).then(function (r) {
      if (!r.success) { el.querySelector('#auTbl tbody').innerHTML = '<tr><td colspan="5">' + retryBox(r) + '</td></tr>'; return; }
      st.data = r.data; self.render(el);
    });
  },
  render: function (el) {
    var st = this.st, d = st.data, self = this; if (!d) return;
    var ks = el.querySelector('#auKat'), us = el.querySelector('#auUser');
    ks.innerHTML = '<option value="">Semua kategori</option>' + d.kategori.map(function (k) { return '<option' + (k === st.kategori ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('');
    us.innerHTML = '<option value="">Semua petugas</option>' + d.petugas.map(function (p) { return '<option value="' + esc(p.email) + '"' + (p.email === st.email ? ' selected' : '') + '>' + esc(p.nama) + '</option>'; }).join('');
    el.querySelector('#auChip').innerHTML = chipSel([{ v: '', l: 'Semua' }].concat(d.kategori.map(function (k) { return { v: k, l: k }; })), st.kategori, 'style="height:30px"');
    var maxH = Math.max(1, Math.ceil(d.rows.length / st.per)); if (st.hal > maxH) st.hal = maxH;
    var rows = d.rows.slice((st.hal - 1) * st.per, st.hal * st.per);
    el.querySelector('#auTbl tbody').innerHTML = rows.length ? rows.map(function (r) {
      return '<tr><td class="nowrap"><b>' + esc(String(r.waktu).slice(11, 16)) + '</b><div class="sub">' + tglSingkat(String(r.waktu).slice(0, 10)) + '</div></td><td><div class="cust"><span class="avatar ' + avatarKelas(r.nama) + '" style="width:32px;height:32px;font-size:11px">' + inisial(r.nama || 'S') + '</span><div><b>' + esc(r.nama || 'Sistem') + '</b><div class="sub">' + esc(r.peran || r.role || '') + '</div></div></div></td>' +
        '<td class="hide-m"><span class="cat-badge ' + (self.WARNA[r.kategori] || '') + '">' + esc(r.kategori) + '</span></td><td class="full-m"><b style="font-size:13px">' + esc(String(r.aksi).replace(/_/g, ' ')) + '</b><div class="sub" style="white-space:normal">' + esc(r.rincian) + (r.ref ? ' • <span class="mono">' + esc(r.ref) + '</span>' : '') + '</div></td><td class="hide-m muted" style="font-size:12.5px">' + esc(r.terminal || '-') + '</td></tr>';
    }).join('') : '<tr><td colspan="5">' + emptyState('history', 'Tidak ada aktivitas', 'Ubah filter pencarian.') + '</td></tr>';
    el.querySelector('#auFoot').innerHTML = '<span><b>' + angka(d.total) + '</b> aktivitas cocok' + (d.total > d.rows.length ? ' (menampilkan ' + d.rows.length + ' terbaru)' : '') + '</span>' + pagerHtml(st.hal, d.rows.length, st.per);
  },
  ekspor: function () {
    var d = this.st.data; if (!d || !d.rows.length) return toast('Tidak ada data', '', 'warn');
    eksporXLSX('Log Aktivitas ' + hariIni() + '.xlsx', [{ nama: 'Log Aktivitas', kolom: ['Waktu', 'Nama', 'Email', 'Peran', 'Kategori', 'Aksi', 'Rincian', 'Ref', 'Terminal'], rows: d.rows.map(function (r) { return [r.waktu, r.nama, r.email, r.peran, r.kategori, r.aksi, r.rincian, r.ref, r.terminal]; }) }]);
  }
};
registerPage('audit', { auth: 'owner', judul: 'Log Aktivitas', template: function () { return Audit.template(); }, init: function (el) { Audit.init(el); }, show: function (el) { Audit.show(el); } });
