/* ==========================================================================
   VIA SEAFOOD — app.js
   Shell aplikasi: sesi & bootstrap 1 panggilan, halaman login berbranding,
   menu samping/bawah per peran, branding custom (logo & semua gambar latar),
   pencarian ⌘K, lonceng peringatan, kunci layar otomatis, verifikasi publik.
   ========================================================================== */
'use strict';
var IMG_DEFAULT = {
  logo: 'img/logo.svg', loginBg: 'img/login-bg.svg', orderBanner: 'img/order-banner.svg', sidebarBg: '', pageBg: '',
  kartu1: 'img/kartu-1.svg', kartu2: 'img/kartu-2.svg', kartu3: 'img/kartu-3.svg', strukLogo: '', produkDefault: ''
};
var NAV = [
  { id: 'dashboard', label: 'Dashboard', ikon: 'layout-grid', owner: true },
  { id: 'pesanan', label: 'Pesanan Harian', ikon: 'receipt-text', perm: 'pesanan_lihat', alias: ['pesanan-baru'] },
  { id: 'produk', label: 'Produk & Stok', ikon: 'archive' },
  { id: 'pelanggan', label: 'Rekap Pelanggan', ikon: 'users-round', perm: 'rekap_lihat' },
  { id: 'keuangan', label: 'Keuangan & Piutang', ikon: 'wallet', owner: true, lock: true },
  { id: 'pengaturan', label: 'Pengaturan', ikon: 'settings', owner: true, lock: true },
  { grup: 'Administrasi Owner' },
  { id: 'notifikasi', label: 'WhatsApp & CRM', ikon: 'message-circle', owner: true },
  { id: 'dokumen', label: 'Dokumen & Struk', ikon: 'file-text', owner: true },
  { id: 'audit', label: 'Log Aktivitas', ikon: 'history', owner: true }
];

var App = {
  shellSiap: false, pub: null,
  init: function () {
    var pub = Store.get('pub', null); if (pub) { this.pub = pub; this.terapkanBrand(pub.brand); }
    var sesi = Store.get('sesi', null);
    if (sesi && sesi.token && sesi.user) {
      AppState.token = sesi.token; AppState.user = sesi.user;
      var boot = Store.get(userKey('boot'), null);
      if (boot && boot.data) this.terapkanBoot(boot.data);
      this.segarkanBoot();
    }
    this.muatPublik();
    route();
    if (this.owner()) setTimeout(function () { (window.requestIdleCallback || setTimeout)(function () { muatSemuaOwner(); }); }, 2500);
    warmUpServer(AppState.token ? 'app' : 'pub');
    setInterval(function () { App.tick(); }, 5000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Date.now() - (App._hiddenAt || Date.now()) > 120000) { warmUpServer(AppState.token ? 'app' : 'pub'); App.segarkanBoot(true); } if (document.visibilityState === 'hidden') App._hiddenAt = Date.now(); });
    addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && AppState.token) { e.preventDefault(); App.cari(); }
    });
  },
  muatPublik: function () {
    return api('publicConfig', {}).then(function (r) {
      var pill = document.getElementById('srvPill');
      if (r.success) {
        App.pub = r.data; Store.set('pub', r.data); App.terapkanBrand(r.data.brand);
        if (pill) { pill.className = 'srv-pill'; pill.innerHTML = '<i></i>' + esc(r.data.server || 'Server Operasional Normal'); }
        if (!AppState.token && parseHash().name !== 'v') { App.isiLogin(); }
      } else if (pill) { pill.className = 'srv-pill off'; pill.innerHTML = '<i></i>Server belum terhubung'; pill.title = r.message; }
    });
  },
  segarkanBoot: function (diam) {
    if (!AppState.token) return Promise.resolve();
    return api('bootstrap', {}).then(function (r) {
      if (r.success) { Store.set(userKey('boot'), { t: Date.now(), data: r.data }); App.terapkanBoot(r.data); App.perbaruiShell(); }
      else if (!diam && !(r.data && r.data.code === 'AUTH')) toast('Gagal menyegarkan data', r.message, 'warn');
    });
  },
  terapkanBoot: function (b) {
    AppState.boot = b; AppState.cfg = b.cfg || {}; AppState.produk = b.produk || []; AppState.struk = b.struk || [];
    AppState.pelanggan = (b.pelanggan || []).map(function (p) { return { id: p[0], nama: p[1], tipe: p[2], wa: p[3], alamat: p[4], langganan: !!p[5], tempo: p[6], email: p[7], trx: p[8] || 0 }; });
    AppState.hariIni = b.hariIni; AppState.hariIniAt = Date.now();
    if (b.me) { AppState.user = Object.assign({}, AppState.user, b.me); var s = Store.get('sesi', {}); s.user = AppState.user; Store.set('sesi', s); }
    if (b.brand) this.terapkanBrand(b.brand);
    if (b.dashboard) swrPut('dashboard', b.dashboard);
  },
  izin: function (p) { var u = AppState.user; return !!u && (u.role === 'OWNER' || (u.izin || []).indexOf(p) > -1); },
  owner: function () { return AppState.user && AppState.user.role === 'OWNER'; },
  halamanAwal: function () { if (this.owner()) return 'dashboard'; if (this.izin('pesanan_lihat')) return 'pesanan'; if (this.izin('pesanan_input')) return 'pesanan-baru'; return 'produk'; },

  /* ---------- branding custom ---------- */
  gambar: function (slot) { var b = AppState.brand || {}; return (b.img && b.img[slot]) || IMG_DEFAULT[slot] || ''; },
  terapkanBrand: function (b) {
    if (!b) return; AppState.brand = b;
    var root = document.documentElement;
    var side = this.gambar('sidebarBg'), page = this.gambar('pageBg');
    this.cssGambar('--side-img', side); root.style.setProperty('--side-ov', String(b.sidebarOverlay == null ? 0.86 : b.sidebarOverlay));
    this.cssGambar('--order-img', this.gambar('orderBanner'));
    root.style.setProperty('--login-ov', String(b.overlay == null ? 0.72 : b.overlay));
    var main = document.querySelector('.main'); if (main) main.style.backgroundImage = page ? 'linear-gradient(rgba(250,247,242,.92), rgba(250,247,242,.92)), url("' + page + '")' : '';
    document.querySelectorAll('[data-brand-img]').forEach(function (el) { App.pasangGambar(el, App.gambar(el.dataset.brandImg)); });
    document.querySelectorAll('[data-brand-txt]').forEach(function (el) { var k = el.dataset.brandTxt; if (b[k] !== undefined) el.textContent = b[k]; });
    var fav = document.querySelector('link[rel=icon]'); if (fav) fav.href = this.gambar('logo');
  },
  cssGambar: function (vari, url) { var root = document.documentElement; if (!url) { root.style.setProperty(vari, 'none'); return; } this.urlAman(url, function (u) { if (!/^(https?:|data:|blob:)/.test(u)) { try { u = new URL(u, location.href).href; } catch (e) { } } root.style.setProperty(vari, 'url("' + u + '")'); }); },
  pasangGambar: function (el, url) {
    if (!url) return;
    if (el.tagName === 'IMG') { el.onerror = function () { el.onerror = null; App.cadanganGambar(url, function (u) { if (u) el.src = u; }); }; el.src = url; }
    else this.urlAman(url, function (u) { el.style.backgroundImage = 'url("' + u + '")'; });
  },
  _cadangan: {},
  /** Uji gambar Drive; bila diblokir (berbagi publik dimatikan) ambil lewat mode cadangan server. */
  urlAman: function (url, cb) {
    if (!/drive\.google\.com\/thumbnail/.test(url)) return cb(url);
    if (this._cadangan[url]) return cb(this._cadangan[url]);
    var img = new Image(); img.onload = function () { cb(url); }; img.onerror = function () { App.cadanganGambar(url, function (u) { if (u) cb(u); }); }; img.src = url;
  },
  cadanganGambar: function (url, cb) {
    var m = String(url).match(/id=([\w-]+)/); if (!m || !window.GAS_URL) return cb(null);
    if (this._cadangan[url]) return cb(this._cadangan[url]);
    fetch(window.GAS_URL + '?action=img&id=' + m[1]).then(function (r) { return r.json(); }).then(function (j) { if (j.success) { App._cadangan[url] = j.data.dataUrl; cb(j.data.dataUrl); } else cb(null); }).catch(function () { cb(null); });
  },
  fotoProduk: function (p) {
    if (p && p.foto) return p.foto;
    var d = this.gambar('produkDefault'); if (d) return d;
    var tebak = function (n) { n = String(n || '').toLowerCase(); return /udang|lobster|vaname|jerbung/.test(n) ? 'p-udang' : /cumi|sotong|gurita/.test(n) ? 'p-cumi' : /kepiting|rajungan/.test(n) ? 'p-kepiting' : /kerang|tiram|simping|remis/.test(n) ? 'p-kerang' : /ikan|kakap|kerapu|bawal|tuna|tongkol|gurame|kembung|bandeng|tenggiri/.test(n) ? 'p-ikan' : ''; };
    return 'img/' + (tebak(p && p.nama) || tebak(p && p.kategori) || 'p-ikan') + '.svg';
  },

  /* ---------- login ---------- */
  tampilLogin: function () {
    this.shellSiap = false; buangHalaman();
    var b = AppState.brand || {}, pub = this.pub || {};
    document.getElementById('app').innerHTML =
      '<div class="login-page"><div class="login-bg" data-brand-img="loginBg"></div><div class="login-ov"></div>' +
      '<div class="login-top"><div class="loc"><span class="ic-box">' + ic('anchor', 'sm') + '</span><span data-brand-txt="lokasi">' + esc(b.lokasi || 'Pangkalan Dermaga') + '</span></div>' +
      '<span class="srv-pill wait" id="srvPill"><i></i>Menghubungkan server…</span></div>' +
      '<form class="login-card" id="loginForm" autocomplete="on"><div class="lbar"></div><div class="lbody">' +
      '<div class="login-logo"><img data-brand-img="logo" alt="Logo"></div>' +
      '<div class="login-title" data-brand-txt="appName">' + esc(b.appName || 'Via Seafood') + '</div>' +
      '<div class="login-kick" data-brand-txt="loginJudul">' + esc(b.loginJudul || 'Sistem Pembukuan & Operasional') + '</div>' +
      '<div class="login-sub" data-brand-txt="loginSub">' + esc(b.loginSub || '') + '</div>' +
      '<div class="role-tabs"><button type="button" class="on" data-role="OWNER">' + ic('star', 'sm') + 'Owner (Admin)</button><button type="button" data-role="STAFF">' + ic('id-card', 'sm') + 'Staff Kasir / Gudang</button></div>' +
      '<div class="role-desc" id="roleDesc">Akses penuh: laba/rugi, piutang, persetujuan nota & pengaturan sistem</div>' +
      '<div id="gWrap" hidden><div id="gBtn"></div><div class="divider">ATAU GUNAKAN KREDENSIAL</div></div>' +
      '<div class="field"><label for="lgEmail">Email Akun / ID Pengguna</label><div class="with-ic">' + ic('user-round') + '<input class="input soft" id="lgEmail" type="email" autocomplete="username" placeholder="nama@viaseafood.id" required></div></div>' +
      '<div class="field mt"><label for="lgPw"><span>Kata Sandi / PIN 6 Digit</span><a href="#" id="lgLupa" style="font-weight:500;font-size:12.5px">Lupa sandi?</a></label><div class="with-ic" style="position:relative">' + ic('lock') + '<input class="input soft" id="lgPw" type="password" autocomplete="current-password" placeholder="••••••" required style="padding-right:44px"><button type="button" class="btn btn-ghost btn-icon btn-sm" id="lgEye" style="position:absolute;right:4px;top:5px" aria-label="Tampilkan sandi">' + ic('eye', 'sm') + '</button></div></div>' +
      '<label class="check mt"><input type="checkbox" id="lgIngat" checked> Ingat perangkat kasir ini (30 hari)</label>' +
      '<button class="btn btn-accent btn-lg btn-block mt" id="lgBtn" type="submit">Masuk ke Sistem Pembukuan ' + ic('arrow-right', 'sm') + '</button>' +
      '<div id="lgErr" class="note-coral mt" hidden></div>' +
      '<div id="demoBox"></div>' +
      '</div><div class="login-foot"><span class="row gap-s">' + ic('check', 'sm') + 'Sheets & Drive Cloud Sync Aktif</span><span class="v">v' + VERSI_FE + '-GAS Engine</span></div></form>' +
      '<div class="page-foot" data-brand-txt="footer">' + esc(b.footer || '') + '</div></div>';
    this.terapkanBrand(b);
    var root = document.getElementById('app');
    root.querySelectorAll('.role-tabs button').forEach(function (bt) {
      bt.onclick = function () { root.querySelectorAll('.role-tabs button').forEach(function (x) { x.classList.toggle('on', x === bt); });
        document.getElementById('roleDesc').textContent = bt.dataset.role === 'OWNER' ? 'Akses penuh: laba/rugi, piutang, persetujuan nota & pengaturan sistem' : 'Akses operasional: input pesanan, cetak struk, cek & sesuaikan stok';
        document.getElementById('lgPw').placeholder = bt.dataset.role === 'OWNER' ? '••••••••' : 'PIN 6 digit'; document.getElementById('lgPw').inputMode = bt.dataset.role === 'OWNER' ? 'text' : 'numeric'; };
    });
    document.getElementById('lgEye').onclick = function () { var p = document.getElementById('lgPw'); p.type = p.type === 'password' ? 'text' : 'password'; };
    document.getElementById('lgLupa').onclick = function (e) { e.preventDefault(); modal({ judul: 'Lupa sandi / PIN?', ikon: 'key-round', isi: '<p>Untuk <b>Staff</b>: minta Owner membuka <b>Pengaturan → Manajemen Pengguna</b> lalu pilih <b>Reset PIN</b>. PIN baru bisa dikirim otomatis ke WhatsApp Anda.</p><p>Untuk <b>Owner</b>: buka editor Apps Script, pilih fungsi <code>resetSandiOwner</code> lalu klik ▶ Run. Sandi sementara tampil di Execution log.</p>' + (b.bantuan ? '<p class="muted">' + esc(b.bantuan) + '</p>' : ''), foot: '<button class="btn btn-primary" data-x>Mengerti</button>' }); };
    var lastEmail = Store.get('lastEmail', ''); if (lastEmail) document.getElementById('lgEmail').value = lastEmail;
    document.getElementById('loginForm').onsubmit = function (e) { e.preventDefault(); App.login(); };
    this.isiLogin();
    if (!this.pub) this.muatPublik(); else { var pill = document.getElementById('srvPill'); pill.className = 'srv-pill'; pill.innerHTML = '<i></i>' + esc(this.pub.server || 'Server Operasional Normal'); this.muatPublik(); }
  },
  isiLogin: function () {
    var pub = this.pub || {}, box = document.getElementById('demoBox'); if (!box) return;
    box.innerHTML = pub.demo ? '<div class="demo-box"><div class="row"><span class="row gap-s">' + ic('info', 'sm') + '<b>Akses Cepat Pengujian:</b></span><span class="badge b-info b-mono">Demo Mode</span></div><div class="row mt-s" style="justify-content:space-between;flex-wrap:wrap"><span class="muted">Kasir: <code data-demo="' + esc(pub.demo.staff) + '">' + esc(pub.demo.staff) + '</code></span><span class="muted">Sandi: <code>' + esc(pub.demo.sandi) + '</code></span></div></div>' : '';
    box.querySelectorAll('[data-demo]').forEach(function (c) { c.onclick = function () { document.getElementById('lgEmail').value = c.dataset.demo; document.getElementById('lgPw').value = pub.demo.sandi; }; });
    var cid = window.GOOGLE_CLIENT_ID || pub.googleClientId;
    if (cid && !this._gis) {
      this._gis = true;
      loadScript('https://accounts.google.com/gsi/client').then(function () {
        if (!window.google || !document.getElementById('gBtn')) return;
        google.accounts.id.initialize({ client_id: cid, callback: function (r) { App.login(r.credential); } });
        google.accounts.id.renderButton(document.getElementById('gBtn'), { theme: 'outline', size: 'large', width: 370, text: 'signin_with', locale: 'id' });
        document.getElementById('gWrap').hidden = false;
      }).catch(function () { App._gis = false; });
    } else if (cid && window.google && document.getElementById('gBtn')) {
      try { google.accounts.id.renderButton(document.getElementById('gBtn'), { theme: 'outline', size: 'large', width: 370 }); document.getElementById('gWrap').hidden = false; } catch (e) { }
    }
  },
  login: function (credential) {
    var btn = document.getElementById('lgBtn'), err = document.getElementById('lgErr'), email = document.getElementById('lgEmail').value.trim(), pw = document.getElementById('lgPw').value, ingat = document.getElementById('lgIngat').checked;
    err.hidden = true; setBusy(btn, true, 'Memverifikasi…');
    var p = credential ? api('auth.google', { credential: credential, ingat: ingat }) : api('auth.login', { email: email, password: pw, ingat: ingat });
    p.then(function (r) {
      setBusy(btn, false);
      if (!r.success) { err.hidden = false; err.innerHTML = ic('circle-alert', 'sm') + '<span>' + esc(r.message) + '</span>'; return; }
      Store.set('lastEmail', r.data.user.email);
      App.mulaiSesi(r.data);
    });
  },
  mulaiSesi: function (d) {
    AppState.token = d.token; AppState.user = d.user;
    Store.set('sesi', { token: d.token, user: d.user, at: Date.now() });
    if (d.boot) { Store.set(userKey('boot'), { t: Date.now(), data: d.boot }); this.terapkanBoot(d.boot); }
    buangHalaman(); this.shellSiap = false;
    var tujuan = '#/' + this.halamanAwal();
    if ((location.hash.replace(/^#\/?/, '') === '' || parseHash().name === 'login') && location.hash !== tujuan) location.hash = tujuan; else route();
    toast('Selamat datang, ' + d.user.nama + '!', d.user.role === 'OWNER' ? 'Akses penuh Owner aktif.' : 'Akses ' + (d.user.penugasan || 'Staff') + '.', '');
    if (d.user.wajibGanti) setTimeout(function () { App.gantiSandi(true); }, 400);
    setTimeout(function () { App.prefetch(); }, 1500);
    if (d.user.role === 'OWNER') setTimeout(function () { muatSemuaOwner(); }, 2500);
  },
  sesiBerakhir: function () {
    if (!AppState.token) return;
    AppState.token = ''; var s = Store.get('sesi', {}); delete s.token; Store.set('sesi', s);
    _modalStack.slice().forEach(function (m) { m.close(); });
    toast('Sesi berakhir', 'Silakan masuk kembali.', 'warn');
    this.tampilLogin();
  },
  logout: function (semua) {
    var t = AppState.token;
    if (semua) api('auth.logoutSemua', {}); else api('auth.logout', {});
    setTimeout(function () { if (t === AppState.token) { } }, 0);
    AppState.token = ''; AppState.user = null; Store.del('sesi'); Store.clearUser(); buangHalaman();
    location.hash = '#/login'; this.tampilLogin();
  },
  gantiSandi: function (wajib) {
    var m = modal({ judul: wajib ? 'Ganti Sandi / PIN Awal' : 'Ganti Sandi / PIN', ikon: 'key-round', tutupLuar: !wajib, sub: wajib ? 'Demi keamanan, ganti sandi sementara Anda sebelum mulai bekerja.' : '',
      isi: (wajib ? '' : '<div class="field"><label>Sandi / PIN lama</label><input class="input" type="password" id="gsLama" autocomplete="current-password"></div>') +
        '<div class="field mt"><label>Sandi / PIN baru <span class="hint">minimal 6 karakter (kasir: 6 digit angka)</span></label><input class="input" type="password" id="gsBaru" autocomplete="new-password" autofocus></div>' +
        '<div class="field mt"><label>Ulangi sandi baru</label><input class="input" type="password" id="gsUlang" autocomplete="new-password"></div>',
      foot: (wajib ? '' : '<button class="btn btn-outline" data-x>Batal</button>') + '<button class="btn btn-primary" id="gsOk">' + ic('check', 'sm') + 'Simpan Sandi</button>' });
    if (wajib) m.el.querySelector('.modal-x').remove(), m.box.setAttribute('data-noesc', '1');
    m.$('#gsOk').onclick = function () {
      var baru = m.$('#gsBaru').value, ul = m.$('#gsUlang').value;
      if (baru.length < 6) return toast('Sandi terlalu pendek', 'Minimal 6 karakter.', 'err');
      if (baru !== ul) return toast('Sandi tidak sama', 'Ulangi sandi baru dengan benar.', 'err');
      var b = m.$('#gsOk'); setBusy(b, true);
      api('auth.gantiSandi', { lama: m.$('#gsLama') ? m.$('#gsLama').value : '', baru: baru }).then(function (r) {
        setBusy(b, false);
        if (!r.success) return toast('Gagal', r.message, 'err');
        AppState.token = r.data.token; AppState.user = Object.assign(AppState.user, r.data.user);
        Store.set('sesi', { token: r.data.token, user: AppState.user, at: Date.now() });
        m.close(); toast('Sandi diganti', 'Sesi di perangkat lain otomatis keluar.');
      });
    };
  },

  /* ---------- shell ---------- */
  tampilShell: function () {
    var u = AppState.user, b = AppState.brand || {};
    document.getElementById('app').innerHTML =
      '<div class="shell"><aside class="side" id="side"><div class="brand"><div class="brand-logo"><img data-brand-img="logo" alt=""></div><div class="brand-text"><div class="brand-name" data-brand-txt="appName">' + esc(b.appName || 'Via Seafood') + '</div><div class="brand-tag" data-brand-txt="tagline">' + esc(b.tagline || 'Buku Kas Laut') + '</div></div></div>' +
      '<div class="nav-label"><span>Navigasi Operasional</span><i class="dot"></i></div><nav class="nav" id="nav"></nav>' +
      '<div class="side-foot"><span class="live-dot"></span><div class="sf-text"><span id="sysStatus"><b>Sistem Aktif</b></span><div>' + esc((u.role === 'OWNER' ? 'Owner' : (u.penugasan || 'Staff')) + ' • ' + (b.lokasi || '')) + '</div><div class="v">v' + VERSI_FE + '</div></div></div></aside>' +
      '<div class="main"><header class="topbar"><button class="btn btn-ghost btn-icon menu-btn" id="menuBtn" aria-label="Menu">' + ic('menu') + '</button><div class="app-title" data-brand-txt="judul">' + esc(b.judul || 'Via Seafood Ledger') + '</div>' +
      '<div class="gsearch" id="gsearch" role="button" tabindex="0">' + ic('search', 'sm') + '<span>Cari transaksi, nota, stok…</span><span class="kbd">⌘K</span></div>' +
      '<div class="top-right"><button class="bell" id="bellBtn" aria-label="Peringatan">' + ic('bell') + '<span class="dot" id="bellDot" hidden></span></button>' +
      '<button class="userbtn" id="userBtn"><span class="avatar">' + esc(u.inisial || inisial(u.nama)) + '</span><span><div class="nm">' + esc(u.nama) + '</div><div class="rl">' + (u.role === 'OWNER' ? 'Owner' : esc(u.penugasan || 'Staff')) + '</div></span></button></div></header>' +
      '<div class="content" id="pageHost"></div></div></div><nav class="bottom-nav" id="bottomNav"></nav>';
    this.shellSiap = true;
    this.renderNav();
    this.terapkanBrand(AppState.brand);
    document.getElementById('menuBtn').onclick = function (e) { e.stopPropagation(); document.getElementById('side').classList.toggle('open'); };
    document.addEventListener('click', function (e) { var s = document.getElementById('side'); if (s && s.classList.contains('open') && !s.contains(e.target) && e.target.id !== 'menuBtn') s.classList.remove('open'); });
    document.getElementById('gsearch').onclick = function () { App.cari(); };
    document.getElementById('bellBtn').onclick = function (e) { App.tampilAlert(e.currentTarget); };
    document.getElementById('userBtn').onclick = function (e) { App.menuUser(e.currentTarget); };
    this.muatAlert();
  },
  perbaruiShell: function () { if (!this.shellSiap) return; this.renderNav(); var c = halamanAktif(); if (c) this.tandaiNav(c.name); },
  renderNav: function () {
    var owner = this.owner(), html = '';
    NAV.forEach(function (n) {
      if (n.grup) { if (owner) html += '<div class="nav-label" style="padding-left:12px;padding-right:12px"><span>' + esc(n.grup) + '</span></div>'; return; }
      if (n.owner && !owner && !n.lock) return;
      var terkunci = (n.owner && !owner) || (n.perm && !App.izin(n.perm));
      html += '<a href="#/' + n.id + '" data-nav="' + n.id + '" class="' + (terkunci ? 'locked' : '') + '" title="' + esc(n.label) + '">' + ic(n.ikon) + '<span>' + esc(n.label) + '</span>' + (n.lock || terkunci ? '<i class="lock">' + ic('lock', 'sm') + '</i>' : '') + '</a>';
    });
    var nav = document.getElementById('nav'); if (!nav) return;
    nav.innerHTML = html;
    nav.querySelectorAll('a.locked').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); toast('Menu terkunci', a.dataset.nav === 'keuangan' || a.dataset.nav === 'pengaturan' ? 'Khusus Owner (Superadmin).' : 'Izin modul belum diaktifkan Owner.', 'warn'); }; });
    var bn = [];
    if (App.izin('pesanan_lihat')) bn.push({ id: 'pesanan', l: 'Pesanan', i: 'receipt-text' });
    bn.push({ id: 'produk', l: 'Stok', i: 'archive' });
    if (App.izin('pesanan_input')) bn.push({ id: 'pesanan-baru', l: 'Baru', i: 'plus', fab: true });
    if (owner) bn.push({ id: 'dashboard', l: 'Ringkasan', i: 'layout-grid' }); else if (App.izin('rekap_lihat')) bn.push({ id: 'pelanggan', l: 'Rekap', i: 'users-round' });
    bn.push({ id: '__menu', l: 'Menu', i: 'menu' });
    if (bn.length > 5) bn.splice(4, bn.length - 5);
    var fab = bn.filter(function (x) { return x.fab; })[0]; if (fab) { bn = bn.filter(function (x) { return !x.fab; }); bn.splice(2, 0, fab); }
    document.getElementById('bottomNav').innerHTML = bn.map(function (x) { return '<a href="' + (x.id === '__menu' ? '#' : '#/' + x.id) + '" data-bn="' + x.id + '" class="' + (x.fab ? 'fab' : '') + '">' + (x.fab ? '<span class="fi">' + ic(x.i) + '</span>' : ic(x.i)) + '<span>' + x.l + '</span></a>'; }).join('');
    var mb = document.querySelector('[data-bn="__menu"]'); if (mb) mb.onclick = function (e) { e.preventDefault(); e.stopPropagation(); document.getElementById('side').classList.add('open'); };
  },
  tandaiNav: function (name) {
    document.querySelectorAll('[data-nav]').forEach(function (a) { var n = NAV.filter(function (x) { return x.id === a.dataset.nav; })[0]; a.classList.toggle('on', !!(a.dataset.nav === name || (n && n.alias && n.alias.indexOf(name) > -1))); });
    document.querySelectorAll('[data-bn]').forEach(function (a) { a.classList.toggle('on', a.dataset.bn === name); });
    var s = document.getElementById('side'); if (s) s.classList.remove('open');
  },
  menuUser: function (anchor) {
    var dev = Store.get('perangkat', '');
    popMenu(anchor, [
      { label: 'Ganti sandi / PIN', ikon: 'key-round', fn: function () { App.gantiSandi(false); } },
      { label: 'Nama terminal: ' + (dev || 'belum diatur'), ikon: 'tablet-smartphone', fn: function () { App.aturPerangkat(); } },
      { label: 'Kunci layar sekarang', ikon: 'lock', fn: function () { App.kunciLayar(); } },
      { label: 'Segarkan data dari server', ikon: 'refresh-cw', fn: function () { swrStale(''); App.segarkanBoot().then(function () { route(); toast('Data disegarkan'); }); } },
      '-',
      { label: 'Keluar dari semua perangkat', ikon: 'monitor-x', fn: function () { konfirmasi('Keluar dari semua perangkat?', 'Semua sesi akun Anda (termasuk perangkat ini) akan berakhir.').then(function (ok) { if (ok) App.logout(true); }); } },
      { label: 'Keluar', ikon: 'log-out', bahaya: true, fn: function () { App.logout(false); } }
    ]);
  },
  aturPerangkat: function () {
    var m = modal({ judul: 'Nama Terminal Perangkat Ini', ikon: 'tablet-smartphone', sub: 'Tercatat di log audit & struk, mis. "Samsung Tab A9 (POS Dermaga 04)".', isi: '<input class="input" id="devNama" maxlength="60" autofocus value="' + esc(Store.get('perangkat', '')) + '" placeholder="Tablet Kasir Dermaga 04">',
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" id="devOk">Simpan</button>' });
    m.$('#devOk').onclick = function () { Store.set('perangkat', m.$('#devNama').value.trim()); m.close(); toast('Nama terminal disimpan'); };
  },

  /* ---------- peringatan (lonceng) ---------- */
  _alerts: [],
  muatAlert: function () {
    return apiQ('alerts', {}).then(function (r) { if (!r.success) return; App._alerts = r.data; var d = document.getElementById('bellDot'); if (d) d.hidden = !r.data.length; });
  },
  tampilAlert: function (anchor) {
    document.querySelectorAll('.pop').forEach(function (p) { p.remove(); });
    var p = document.createElement('div'); p.className = 'pop alert-list';
    var list = this._alerts;
    p.innerHTML = '<div class="row" style="padding:8px 10px;justify-content:space-between"><b>Peringatan</b><span class="muted" style="font-size:12px">' + list.length + ' item</span></div>' + (list.length ? list.map(function (a) {
      return '<div class="alert-item" data-link="' + esc(a.link) + '"><span class="ic-box sm ' + (a.level === 'danger' ? 'coral' : 'amber') + '">' + ic(a.jenis === 'stok' ? 'package' : 'clock-3', 'sm') + '</span><div class="grow"><b style="font-size:13.5px">' + esc(a.judul) + '</b><div class="muted" style="font-size:12px">' + esc(a.isi) + '</div></div></div>'; }).join('') : '<div class="empty" style="padding:24px">' + ic('bell-off') + '<div>Tidak ada peringatan.</div></div>');
    document.body.appendChild(p);
    var r = anchor.getBoundingClientRect(); p.style.top = (r.bottom + 6) + 'px'; p.style.left = Math.max(8, Math.min(r.right - p.offsetWidth, innerWidth - p.offsetWidth - 8)) + 'px';
    p.onclick = function (e) { var it = e.target.closest('[data-link]'); if (it) { p.remove(); location.hash = it.dataset.link; } };
    setTimeout(function () { document.addEventListener('click', function tutup(e) { if (!p.contains(e.target)) { p.remove(); document.removeEventListener('click', tutup); } }); }, 0);
    this.muatAlert();
  },

  /* ---------- pencarian ⌘K ---------- */
  cari: function () {
    var m = modal({ judul: '', bar: false, lebar: 'cmdk', raw: true, isi: '<div style="padding:16px 18px 6px"><div class="searchbox">' + ic('search') + '<input class="input" id="cmdkQ" placeholder="Cari nomor nota, pelanggan, produk…" autofocus autocomplete="off"></div></div><div class="res" id="cmdkRes"><div class="muted" style="padding:14px 10px">Ketik minimal 2 huruf. Tekan <span class="kbd">Enter</span> untuk membuka hasil pertama.</div></div>' });
    var q = m.$('#cmdkQ'), res = m.$('#cmdkRes'), hasil = [];
    function render(r) {
      hasil = [];
      var html = '';
      function grp(nama, items, fn) { if (!items.length) return; html += '<div class="grp">' + nama + '</div>'; items.forEach(function (it) { hasil.push(it); html += fn(it, hasil.length - 1); }); }
      grp('Nota', r.pesanan || [], function (o, i) { return '<div class="it" data-i="' + i + '">' + ic('receipt-text') + '<div class="grow"><b>' + esc(o.id) + '</b> <span class="muted">' + esc(o.pelanggan) + ' • ' + tglSingkat(o.tanggal) + '</span></div>' + badgeStatus(o.status, o.piutangId) + '</div>'; });
      grp('Pelanggan', r.pelanggan || [], function (p, i) { return '<div class="it" data-i="' + i + '"><span class="avatar ' + avatarKelas(p.nama) + '" style="width:28px;height:28px;font-size:11px">' + inisial(p.nama) + '</span><div class="grow"><b>' + esc(p.nama) + '</b> <span class="muted">' + esc(p.tipe || '') + ' ' + hpTampil(p.wa) + '</span></div></div>'; });
      grp('Produk', r.produk || [], function (p, i) { return '<div class="it" data-i="' + i + '">' + ic('fish') + '<div class="grow"><b>' + esc(p.nama) + '</b> <span class="muted">' + esc(p.sku || '') + ' • stok ' + angka(p.stok) + ' ' + esc(p.satuan) + '</span></div><span class="muted">' + rp(p.harga) + '</span></div>'; });
      res.innerHTML = html || '<div class="muted" style="padding:14px 10px">Tidak ada hasil.</div>';
    }
    function buka(i) {
      var it = hasil[i]; if (!it) return; m.close();
      if (it.status !== undefined) Pesanan.detail(it.id);
      else if (it.tipe !== undefined && it.harga === undefined) location.hash = '#/pelanggan/' + encodeURIComponent(it.id);
      else location.hash = '#/produk';
    }
    var cariLokal = function (s) {
      s = s.toLowerCase();
      return { pelanggan: AppState.pelanggan.filter(function (p) { return (p.nama + ' ' + p.wa).toLowerCase().indexOf(s) > -1; }).slice(0, 5),
        produk: AppState.produk.filter(function (p) { return p.aktif && (p.nama + ' ' + p.sku).toLowerCase().indexOf(s) > -1; }).slice(0, 5), pesanan: [] };
    };
    var jalan = debounce(function () {
      var s = q.value.trim(); if (s.length < 2) return;
      var lok = cariLokal(s); render(lok);
      api('pesanan.cari', { q: s }).then(function (r) { if (r.success && q.value.trim() === s) { lok.pesanan = r.data.pesanan; render(lok); } });
    }, 250);
    q.oninput = jalan;
    q.onkeydown = function (e) { if (e.key === 'Enter') buka(0); };
    res.onclick = function (e) { var it = e.target.closest('[data-i]'); if (it) buka(+it.dataset.i); };
  },

  /* ---------- kunci layar otomatis ---------- */
  kunciLayar: function () {
    if (document.getElementById('lockScr') || !AppState.user) return;
    var u = AppState.user, el = document.createElement('div');
    el.id = 'lockScr'; el.className = 'lock-screen';
    el.innerHTML = '<form class="login-card" style="max-width:380px"><div class="lbar"></div><div class="lbody" style="text-align:center"><span class="avatar lg" style="margin:0 auto 12px;background:var(--teal);color:#fff">' + esc(u.inisial || inisial(u.nama)) + '</span><div class="login-title" style="font-size:24px">' + esc(u.nama) + '</div><div class="login-sub">Layar terkunci karena tidak ada aktivitas. Masukkan sandi/PIN untuk melanjutkan.</div>' +
      '<input class="input" type="password" id="unlockPw" placeholder="Sandi / PIN" autocomplete="current-password" style="text-align:center;font-size:18px" autofocus><button class="btn btn-primary btn-block mt" type="submit">' + ic('lock-open', 'sm') + 'Buka Kunci</button><button class="btn btn-ghost btn-block mt-s" type="button" id="unlockOut">Keluar & ganti akun</button></div></form>';
    document.body.appendChild(el);
    setTimeout(function () { var i = document.getElementById('unlockPw'); if (i) i.focus(); }, 50);
    el.querySelector('form').onsubmit = function (e) {
      e.preventDefault(); var pw = document.getElementById('unlockPw'), b = el.querySelector('button[type=submit]'); setBusy(b, true);
      api('auth.unlock', { password: pw.value }).then(function (r) { setBusy(b, false); if (r.success) { el.remove(); Activity.at = Date.now(); } else { pw.value = ''; pw.classList.add('is-err'); toast('Gagal membuka', r.message, 'err'); } });
    };
    document.getElementById('unlockOut').onclick = function () { el.remove(); App.logout(false); };
  },
  tick: function () {
    if (!AppState.token || !this.shellSiap) return;
    var menit = Number((AppState.cfg || {}).autoLock) || 0;
    if (menit > 0 && Activity.idleMs() > menit * 60000 && document.visibilityState === 'visible') this.kunciLayar();
    if (document.getElementById('lockScr')) return;
    var c = halamanAktif(); if (c && c.def.tick && Activity.due('page:' + c.name, c.def.tickMs || 20000, c.def.tickIdleMs || 60000)) { try { c.def.tick(c.el); } catch (e) { } }
    if (Activity.due('alerts', 120000, 300000)) this.muatAlert();
  },
  /** Prefetch menu yang sering dibuka dalam 1 eksekusi (batch) saat perangkat idle. */
  prefetch: function () {
    var run = function () {
      if (!AppState.token) return;
      var calls = [{ k: 'pesanan:' + hariIni(), a: 'pesanan.list', d: { tanggal: hariIni() }, ok: App.izin('pesanan_lihat') }, { k: 'produk', a: 'produk.list', d: {}, ok: true }];
      if (App.owner()) calls.push({ k: 'piutang:aktif', a: 'piutang.list', d: { status: 'aktif' }, ok: true }, { k: 'kas:bulan', a: 'kas.list', d: {}, ok: true });
      if (App.izin('rekap_lihat')) calls.push({ k: 'rekap:' + hariIni().slice(0, 7), a: 'pelanggan.rekap', d: { periode: hariIni().slice(0, 7) }, ok: true });
      calls = calls.filter(function (c) { return c.ok && !swrPeek(c.k); });
      if (!calls.length) return;
      api('batch', { calls: calls.map(function (c) { return { action: c.a, data: c.d, key: c.k }; }) }).then(function (r) {
        if (!r.success) return; calls.forEach(function (c) { var x = r.data[c.k]; if (x && x.success) swrPut(c.k, x.data); });
      });
    };
    if (window.requestIdleCallback) setTimeout(function () { requestIdleCallback(run, { timeout: 4000 }); }, 1200); else setTimeout(run, 1200);
  },
  /** Perbarui daftar produk lokal setelah tulis (respons server membawa produk terbaru). */
  updateProduk: function (list) {
    if (!list || !list.length) return;
    var map = {}; AppState.produk.forEach(function (p, i) { map[p.id] = i; });
    list.forEach(function (p) { if (map[p.id] !== undefined) AppState.produk[map[p.id]] = p; else AppState.produk.push(p); });
    var b = Store.get(userKey('boot'), null); if (b && b.data) { b.data.produk = AppState.produk; Store.set(userKey('boot'), b); }
    var pk = swrPeek('produk'); if (pk) { pk.produk = AppState.produk.slice(); swrPut('produk', pk); }
  },
  tambahPelangganLokal: function (p) {
    if (!p || !p.id) return;
    var ada = AppState.pelanggan.filter(function (x) { return x.id === p.id; })[0];
    if (ada) Object.assign(ada, p); else AppState.pelanggan.push(Object.assign({ tipe: '', wa: '', alamat: '', langganan: false, tempo: 0, trx: 0 }, p));
  },

  /* ---------- verifikasi publik ---------- */
  tampilVerifikasi: function (kode) {
    this.shellSiap = false;
    var b = AppState.brand || {};
    document.getElementById('app').innerHTML = '<div class="verif-page"><div class="verif-card"><div class="row" style="justify-content:center;margin-bottom:18px"><div class="brand-logo" style="background:var(--foam)"><img data-brand-img="logo" alt=""></div><div><div class="serif" style="font-size:24px;font-weight:700;color:var(--teal)" data-brand-txt="appName">' + esc(b.appName || 'Via Seafood') + '</div><div class="muted" style="font-size:13px">Verifikasi keaslian struk & dokumen</div></div></div><div class="card card-pad" id="vfBox"><div class="skel" style="height:60px"></div><div class="skel mt" style="height:180px"></div></div><p class="center muted mt" style="font-size:12.5px">Halaman ini memeriksa catatan resmi di sistem. Data pribadi pelanggan disamarkan.</p></div></div>';
    this.terapkanBrand(b);
    api('verifikasi', { kode: kode }).then(function (r) {
      var box = document.getElementById('vfBox'); if (!box) return;
      if (!r.success) { box.innerHTML = '<div class="verif-badge bad">' + ic('shield-x', 'xl') + '<div>TIDAK TERCATAT<div style="font-size:13px;font-weight:500">' + esc(r.message) + '</div></div></div>'; return; }
      var d = r.data, sah = d.status === 'SAH';
      var rows = d.jenis === 'STRUK' ? [['Nomor nota', d.nomor], ['Tanggal', d.tanggal + ' WIB'], ['Pelanggan', d.pelanggan], ['Total', rp(d.total)], ['Item', d.item + ' produk • ' + angka(d.berat) + ' kg'], ['Pembayaran', d.bayar], ['Kasir', d.petugas], ['Diterbitkan oleh', d.toko.nama]]
        : [['Jenis dokumen', d.judul], ['Nomor', d.nomor], ['Diterbitkan', d.tanggal], ['Pihak', d.pelanggan || '-'], ['Nilai', d.total != null ? rp(d.total) : '-'], ['Keterangan', d.keterangan || '-'], ['Penerbit', d.toko.nama]];
      box.innerHTML = '<div class="verif-badge ' + (sah ? '' : 'bad') + '">' + ic(sah ? 'shield-check' : 'shield-alert', 'xl') + '<div>' + (sah ? 'SAH — tercatat di sistem' : d.status) + '<div style="font-size:13px;font-weight:500">' + (sah ? 'Data cocok dengan catatan resmi ' + esc(d.toko.nama) + '.' : esc(d.alasan || (d.status === 'TIDAK COCOK' ? 'Sidik data tidak cocok — catatan diubah di luar aplikasi.' : 'Dokumen ini sudah tidak berlaku.'))) + '</div></div></div>' +
        '<table class="tbl mt" style="font-size:14px"><tbody>' + rows.map(function (x) { return '<tr><td class="muted" style="width:40%">' + esc(x[0]) + '</td><td><b>' + esc(x[1]) + '</b></td></tr>'; }).join('') + '</tbody></table>' +
        '<div class="mt"><div class="label-up">Sidik SHA-256</div><div class="hash mt-s">' + esc(d.hash || '-') + '</div></div>' +
        (d.jenis === 'DOKUMEN' ? '<div class="dropzone mt" id="vfDrop">' + ic('file-search') + '<div><b>Cek berkas PDF</b> — pilih/seret PDF yang Anda terima untuk mencocokkan sidiknya.</div></div><div id="vfHasil" class="mt"></div>' : '');
      var dz = document.getElementById('vfDrop');
      if (dz) {
        var cek = function (f) { f.arrayBuffer().then(function (buf) { return crypto.subtle.digest('SHA-256', buf); }).then(function (h) { var hex = Array.from(new Uint8Array(h)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); document.getElementById('vfHasil').innerHTML = hex === d.hash ? '<div class="note-teal">' + ic('circle-check') + '<span><b>Berkas cocok.</b> Isi PDF sama persis dengan yang diterbitkan.</span></div>' : '<div class="note-coral">' + ic('circle-x') + '<span><b>Berkas tidak cocok.</b> PDF ini berbeda dari yang diterbitkan (mungkin diubah atau versi lain).</span></div>'; }); };
        dz.onclick = function () { pilihFile('application/pdf').then(function (f) { if (f) cek(f); }); };
        dz.ondragover = function (e) { e.preventDefault(); dz.classList.add('on'); }; dz.ondragleave = function () { dz.classList.remove('on'); };
        dz.ondrop = function (e) { e.preventDefault(); dz.classList.remove('on'); if (e.dataTransfer.files[0]) cek(e.dataTransfer.files[0]); };
      }
    });
  }
};

/* ---------- helper bersama untuk halaman ---------- */
/** Combobox pencarian (pelanggan/produk). opt: {el, items(), render(it), label(it), onPick(it), placeholder, footer} */
function Combo(opt) {
  var wrap = opt.el, list = null, aktif = 0, hasil = [];
  wrap.classList.add('combo');
  var inp = wrap.querySelector('input');
  function tutup() { if (list) { list.remove(); list = null; } }
  function buka() {
    var q = inp.value.trim().toLowerCase();
    hasil = opt.items().filter(function (it) { return !q || opt.cari(it).toLowerCase().indexOf(q) > -1; }).slice(0, 40);
    if (!list) { list = document.createElement('div'); list.className = 'combo-list'; wrap.appendChild(list); list.addEventListener('mousedown', function (e) { e.preventDefault(); var it = e.target.closest('[data-i]'); if (it) pilih(+it.dataset.i); var f = e.target.closest('[data-foot]'); if (f && opt.onFooter) { tutup(); opt.onFooter(inp.value.trim()); } }); }
    aktif = 0;
    list.innerHTML = (hasil.length ? hasil.map(function (it, i) { return '<div class="combo-item' + (i === 0 ? ' on' : '') + '" data-i="' + i + '">' + opt.render(it) + '</div>'; }).join('') : '<div class="muted" style="padding:10px">Tidak ditemukan.</div>') + (opt.footer ? '<div class="combo-item" data-foot="1" style="color:var(--teal);font-weight:700">' + opt.footer(inp.value.trim()) + '</div>' : '');
  }
  function pilih(i) { var it = hasil[i]; if (!it) return; tutup(); opt.onPick(it); }
  inp.addEventListener('click', buka);   // dibuka saat diketuk/diketik — tidak menutupi chip cepat saat fokus otomatis
  inp.addEventListener('input', buka);
  inp.addEventListener('blur', function () { setTimeout(tutup, 120); });
  inp.addEventListener('keydown', function (e) {
    if (!list && (e.key === 'ArrowDown')) { buka(); return; }
    if (!list) return;
    var items = list.querySelectorAll('[data-i]');
    if (e.key === 'ArrowDown') { e.preventDefault(); aktif = Math.min(aktif + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); aktif = Math.max(aktif - 1, 0); }
    else if (e.key === 'Enter') { if (hasil.length) { e.preventDefault(); pilih(aktif); } else if (opt.onFooter) { e.preventDefault(); tutup(); opt.onFooter(inp.value.trim()); } return; }
    else if (e.key === 'Escape') { tutup(); return; }
    else return;
    items.forEach(function (x, i) { x.classList.toggle('on', i === aktif); }); if (items[aktif]) items[aktif].scrollIntoView({ block: 'nearest' });
  });
  return { tutup: tutup, buka: buka, input: inp };
}

document.addEventListener('DOMContentLoaded', function () { App.init(); });
