/* ==========================================================================
   VIA SEAFOOD — core.js
   Fondasi SPA: penyimpanan lokal (SWR), panggilan API tahan jaringan HP
   (timeout, retry, reqId idempoten, dedupe, batch), router hash, komponen UI.
   ========================================================================== */
'use strict';
var VERSI_FE = '1.0.0';
var LS_PREFIX = 'vs:v1:';

var AppState = { token: '', user: null, boot: null, cfg: {}, brand: {}, produk: [], pelanggan: [], hariIni: '', online: true, tables: {} };

/* ---------- penyimpanan lokal (namespace per user + versi skema) ---------- */
var Store = {
  get: function (k, d) { try { var v = localStorage.getItem(LS_PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: function (k, v) {
    var s = JSON.stringify(v);
    try { localStorage.setItem(LS_PREFIX + k, s); }
    catch (e) {
      try {   // kuota penuh → buang cache data (bukan sesi/pengaturan) lalu coba lagi
        Object.keys(localStorage).filter(function (x) { return x.indexOf(LS_PREFIX + 'u:') === 0 && x.indexOf(':d:') > -1; }).forEach(function (x) { localStorage.removeItem(x); });
        localStorage.setItem(LS_PREFIX + k, s);
      } catch (e2) { }
    }
  },
  del: function (k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (e) { } },
  clearUser: function () { try { Object.keys(localStorage).filter(function (x) { return x.indexOf(LS_PREFIX + 'u:') === 0; }).forEach(function (x) { localStorage.removeItem(x); }); } catch (e) { } }
};
function userKey(k) { return 'u:' + ((AppState.user && AppState.user.email) || 'anon') + ':d:' + k; }
function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }

/* ---------- pengukur (Perf.table() di console) ---------- */
var Perf = {
  rows: [],
  add: function (action, total, server, cached) { this.rows.push({ action: action, total: total, server: server == null ? null : server, net: server == null ? null : total - server, cache: !!cached, at: new Date().toLocaleTimeString() }); if (this.rows.length > 300) this.rows.shift(); },
  table: function () { console.table(this.rows.slice(-40)); },
  summary: function () { var m = {}; this.rows.forEach(function (r) { var x = m[r.action] || (m[r.action] = { n: 0, total: 0, server: 0 }); x.n++; x.total += r.total; x.server += r.server || 0; }); Object.keys(m).forEach(function (k) { m[k].rataTotal = Math.round(m[k].total / m[k].n); m[k].rataServer = Math.round(m[k].server / m[k].n); delete m[k].total; delete m[k].server; }); console.table(m); }
};

/* ---------- API ---------- */
var WRITE_RE = /^(auth\.(logoutSemua|gantiSandi)|.*\.(save|create|update|batal|hapus|bayar|hapusBayar|ingatkan|adjust|foto|upload|status|resetSandi|logoutSemua|configSave|retry|processNow|test|validate|blastCreate|blastProcess|blastStop|kirimWA|sync|bulk|interaksi|import|merge|run|rows|now|restore|seed|templateSave|templateScan|templateGanti|templateKembalikan|templateDuplikat|templateHapus|templateReset|tarik|massal|massalProses|clearCache|rekapUlang))$/;
var _inflight = {}, _writeEpoch = 0, _apiBusy = 0;
function clientInfo() {
  var dev = Store.get('perangkat', '') || '';
  var ua = navigator.userAgent, nm = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : 'Perangkat';
  var br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return { dev: dev, ua: nm + ' ' + br, url: location.href.split('#')[0], v: VERSI_FE };
}
function reqIdBaru() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); }
function apiOnce(action, data, timeout, reqId) {
  var ctrl = window.AbortController ? new AbortController() : null, t0 = performance.now();
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeout);
  return fetch(window.GAS_URL, { method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // hindari CORS preflight
    body: JSON.stringify({ action: action, token: AppState.token || '', reqId: reqId || '', data: data || {}, client: clientInfo() }) })
    .then(function (res) {
      return res.text().then(function (text) {
        try { var j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms); return j; }
        catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429 || res.status === 0, message: 'Server membalas HTTP ' + res.status + ' (bukan JSON). Periksa URL GAS di js/config.js.' }; }
      });
    })
    .catch(function (err) { return { success: false, network: true, retryable: true, message: err && err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi terputus. Periksa internet.' }; })
    .then(function (r) { clearTimeout(timer); return r; });
}
function waitOnline(ms) { return new Promise(function (r) { if (navigator.onLine !== false) return r(); var t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); r(); } addEventListener('online', done); }); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function apiRun(action, data, opt, isRead) {
  opt = opt || {};
  var reqId = isRead ? '' : (opt.reqId || reqIdBaru()), tries = opt.tries || (isRead ? 3 : 2);
  _apiBusy++; LoadingBar.start();
  var run = function (i) {
    var t = isRead ? (i ? 40000 : 25000) : (opt.timeout || 120000);
    return apiOnce(action, data, t, reqId).then(function (res) {
      if (res.success || !res.retryable || i + 1 >= tries) return res;
      return sleep(1200 * (i + 1)).then(function () { return navigator.onLine === false ? waitOnline(15000) : null; }).then(function () { return run(i + 1); });
    });
  };
  return run(0).then(function (res) {
    _apiBusy--; LoadingBar.done();
    if (!res.success && res.data && res.data.code === 'AUTH' && action !== 'auth.login') { if (window.App) App.sesiBerakhir(); }
    if (res.network) setOnline(false); else setOnline(true);
    return res;
  });
}
/** Panggil API. Baca identik yang sedang berjalan menumpang (dedupe); tulis menaikkan epoch. */
function api(action, data, opt) {
  if (!window.GAS_URL || /XXXX/.test(window.GAS_URL)) return Promise.resolve({ success: false, message: 'URL backend belum diisi. Edit js/config.js → GAS_URL.' });
  var isRead = !WRITE_RE.test(action) || action === 'doc.print';
  if (!isRead) { _writeEpoch++; return apiRun(action, data, opt, false); }
  var k = _writeEpoch + '|' + action + '|' + JSON.stringify(data || {});
  if (_inflight[k]) return _inflight[k];
  var p = apiRun(action, data, opt, true); _inflight[k] = p;
  p.then(function () { delete _inflight[k]; }, function () { delete _inflight[k]; });
  return p;
}
/** Penggabung otomatis: beberapa api baca di tik yang sama → 1 eksekusi 'batch'. */
var Batcher = {
  q: null,
  add: function (action, data) {
    var self = this;
    return new Promise(function (res) { if (!self.q) { self.q = []; setTimeout(function () { self.flush(); }, 0); } self.q.push({ action: action, data: data || {}, res: res }); });
  },
  flush: function () {
    var q = this.q || []; this.q = null;
    var uniq = {}, list = [];
    q.forEach(function (x) { var k = x.action + '|' + JSON.stringify(x.data); if (!uniq[k]) { uniq[k] = { action: x.action, data: x.data, key: 'k' + list.length, waiters: [] }; list.push(uniq[k]); } uniq[k].waiters.push(x.res); });
    if (list.length === 1) { var u = list[0]; api(u.action, u.data).then(function (r) { u.waiters.forEach(function (w) { w(r); }); }); return; }
    for (var i = 0; i < list.length; i += 10) (function (chunk) {
      api('batch', { calls: chunk.map(function (c) { return { action: c.action, data: c.data, key: c.key }; }) }).then(function (r) {
        chunk.forEach(function (c) { var res = r.success ? (r.data[c.key] || { success: false, message: 'Tidak ada respons.' }) : r; c.waiters.forEach(function (w) { w(res); }); });
      });
    })(list.slice(i, i + 10));
  }
};
function apiQ(action, data) { return Batcher.add(action, data); }
/** Stale-while-revalidate: render dari cache seketika, segarkan bila lewat batas kesegaran, render ulang hanya bila berubah. */
function swr(key, action, payload, render, opt) {
  opt = opt || {};
  var fresh = opt.fresh == null ? 30000 : opt.fresh, c = Store.get(userKey(key), null);
  if (c && render) { try { render(c.data, true); } catch (e) { console.error(e); } }
  if (c && !opt.force && Date.now() - c.t < fresh) return Promise.resolve({ success: true, data: c.data, cached: true });
  return (opt.batch ? apiQ : api)(action, payload).then(function (res) {
    if (res.success) {
      var h = hashStr(JSON.stringify(res.data));
      if (!opt.noStore) Store.set(userKey(key), { t: Date.now(), h: h, data: res.data });
      if ((!c || c.h !== h) && render) { try { render(res.data, false); } catch (e) { console.error(e); } }
    } else if (!c && opt.onError) opt.onError(res);
    else if (!c && render === undefined) { }
    return res;
  });
}
function swrPeek(key) { var c = Store.get(userKey(key), null); return c ? c.data : null; }
function swrPut(key, data) { Store.set(userKey(key), { t: Date.now(), h: hashStr(JSON.stringify(data)), data: data }); }
function swrStale(prefix) { try { Object.keys(localStorage).forEach(function (x) { var k = LS_PREFIX + userKey(prefix); if (x.indexOf(k) === 0) { var c = JSON.parse(localStorage.getItem(x)); if (c) { c.t = 0; localStorage.setItem(x, JSON.stringify(c)); } } }); } catch (e) { } }
var _warmAt = {};
function warmUpServer(scope) {
  scope = scope || 'app';
  if (!window.GAS_URL || /XXXX/.test(window.GAS_URL)) return;
  if (window._preWarm && !_warmAt[scope] && Date.now() - window._preWarm < 240000) { _warmAt[scope] = window._preWarm; return; }
  if (Date.now() - (_warmAt[scope] || 0) < 240000) return; _warmAt[scope] = Date.now();
  try { fetch(window.GAS_URL + '?w=' + scope + '&t=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(function () { }); } catch (e) { }
}
function setOnline(v) { if (AppState.online === v) return; AppState.online = v; document.body.classList.toggle('is-offline', !v); var el = document.getElementById('sysStatus'); if (el) el.innerHTML = v ? '<b>Sistem Aktif</b>' : '<b style="color:var(--amber)">Koneksi bermasalah</b>'; }

/* ---------- format ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function rp(n, opt) { n = Math.round(Number(n) || 0); var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (n < 0 ? '-' : '') + 'Rp ' + s; }
function rpRingkas(n) { n = Number(n) || 0; var a = Math.abs(n); if (a >= 1e9) return 'Rp ' + angka(n / 1e9, 1) + ' M'; if (a >= 1e6) return 'Rp ' + angka(n / 1e6, 1) + ' Jt'; if (a >= 1e3) return 'Rp ' + angka(n / 1e3, 0) + ' rb'; return rp(n); }
function angka(n, des) { n = Number(n) || 0; if (des == null) des = Math.round(n) === n ? 0 : (Math.round(n * 10) === n * 10 ? 1 : 2); var s = n.toFixed(des).split('.'); return s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (s[1] && +s[1] ? ',' + s[1].replace(/0+$/, '') : ''); }
function parseAngka(v) { if (typeof v === 'number') return v; var s = String(v || '').replace(/[^0-9,.\-]/g, ''); if (/,\d{1,3}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/\.(?=\d{3}(\D|$))/g, ''); var n = parseFloat(s); return isFinite(n) ? n : 0; }
var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function tglLokal(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function hariIni() { return AppState.hariIni && AppState.hariIniAt && Date.now() - AppState.hariIniAt < 6 * 3600e3 ? AppState.hariIni : tglLokal(); }
function tglTambah(s, n) { var p = String(s).split('-'); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return d.toISOString().slice(0, 10); }
function tglSingkat(s) { if (!/^\d{4}-\d{2}-\d{2}/.test(s || '')) return s || '-'; var p = s.slice(0, 10).split('-'); return (+p[2]) + ' ' + BLN[+p[1] - 1] + ' ' + p[0]; }
function tglPanjang(s) { if (!/^\d{4}-\d{2}-\d{2}/.test(s || '')) return s || '-'; var p = s.slice(0, 10).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return HARI[d.getUTCDay()] + ', ' + (+p[2]) + ' ' + BULAN[+p[1] - 1] + ' ' + p[0]; }
function tglIndo(s) { if (!/^\d{4}-\d{2}-\d{2}/.test(s || '')) return s || '-'; var p = s.slice(0, 10).split('-'); return (+p[2]) + ' ' + BULAN[+p[1] - 1] + ' ' + p[0]; }
function periodeLabel(per) { return BULAN[+per.slice(5, 7) - 1] + ' ' + per.slice(0, 4); }
function waktuRelatif(s) {
  if (!s) return '-'; var d = new Date(String(s).replace(' ', 'T')); if (isNaN(d)) return s;
  var dt = (Date.now() - d.getTime()) / 1000, hari = tglLokal(d) === tglLokal() ? 'Hari ini' : tglLokal(d) === tglTambah(tglLokal(), -1) ? 'Kemarin' : tglSingkat(tglLokal(d));
  if (dt < 60) return 'Baru saja'; if (dt < 3600) return Math.floor(dt / 60) + ' menit lalu';
  return hari + ', ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' WIB';
}
function hp08(v) { var s = String(v == null ? '' : v).trim().replace(/[^0-9+]/g, '').replace(/^\+/, ''); if (!s) return ''; if (s.indexOf('62') === 0) s = '0' + s.slice(2); else if (s.indexOf('8') === 0) s = '0' + s; return s; }
function hpTampil(v) { var s = hp08(v); return s ? s.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3') : ''; }
function hpValid(v) { return /^08\d{8,12}$/.test(hp08(v)); }
function inisial(n) { var p = String(n || '?').replace(/\([^)]*\)/g, ' ').trim().split(/\s+/).filter(function (w) { return /^[A-Za-z0-9]/.test(w); }); if (!p.length) p = ['?']; return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : (p[0][1] || ''))).toUpperCase(); }
function avatarKelas(n) { var s = 0; String(n || '').split('').forEach(function (c) { s += c.charCodeAt(0); }); return 'a' + (s % 5 + 1); }
function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms || 300); }; }

/* ---------- ikon (subset lucide di js/icons.js) ---------- */
function ic(name, cls) {
  var b = (window.ICONS || {})[name];
  if (!b) return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24"></svg>';
  return '<svg class="ic ' + (cls || '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + b + '</svg>';
}

/* ---------- UI: loading bar, toast, modal, drawer, menu ---------- */
var LoadingBar = {
  el: null, n: 0, t: null,
  start: function () { this.n++; if (!this.el) { this.el = document.createElement('div'); this.el.className = 'loading-bar'; document.body.appendChild(this.el); } var el = this.el; clearTimeout(this.t); el.style.opacity = 1; el.style.width = '30%'; setTimeout(function () { if (LoadingBar.n) el.style.width = '72%'; }, 400); },
  done: function () { this.n = Math.max(0, this.n - 1); if (this.n || !this.el) return; var el = this.el; el.style.width = '100%'; this.t = setTimeout(function () { el.style.opacity = 0; setTimeout(function () { el.style.width = '0'; }, 400); }, 200); }
};
function toast(judul, isi, jenis, ms) {
  var box = document.querySelector('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  var el = document.createElement('div');
  el.className = 'toast ' + (jenis || '');
  el.innerHTML = '<div class="ti">' + ic(jenis === 'err' ? 'circle-alert' : jenis === 'warn' ? 'triangle-alert' : 'check', 'sm') + '</div><div class="grow"><div class="tt">' + esc(judul) + '</div>' + (isi ? '<div class="td">' + esc(isi) + '</div>' : '') + '</div><button class="tx" aria-label="Tutup">' + ic('x', 'sm') + '</button>';
  el.querySelector('.tx').onclick = function () { el.remove(); };
  box.appendChild(el);
  setTimeout(function () { el.style.transition = 'opacity .3s'; el.style.opacity = 0; setTimeout(function () { el.remove(); }, 300); }, ms || (jenis === 'err' ? 6500 : 3800));
  return el;
}
function toastRes(res, ok) { if (res && res.success) toast(ok || 'Berhasil', res.message || '', ''); else toast('Gagal', (res && res.message) || 'Terjadi kesalahan.', 'err'); return res && res.success; }
var _modalStack = [];
/** Modal umum. opt: {judul, sub, ikon, isi(html), lebar:'wide'|'xl'|'mid', foot(html), bar, onOpen(el), onClose, tutupLuar} */
function modal(opt) {
  var ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = '<div class="modal ' + (opt.lebar || '') + '" role="dialog" aria-modal="true">' + (opt.bar === false ? '' : '<div class="modal-bar ' + (opt.bar || '') + '"></div>') +
    (opt.judul ? '<div class="modal-head">' + (opt.ikon ? '<div class="ic-box ' + (opt.ikonKelas || '') + '">' + ic(opt.ikon) + '</div>' : '') + '<div class="grow"><h3>' + opt.judul + '</h3>' + (opt.sub ? '<div class="sub">' + opt.sub + '</div>' : '') + '</div><button class="modal-x" data-x aria-label="Tutup">' + ic('x') + '</button></div>' : '') +
    (opt.raw ? opt.isi : '<div class="modal-body">' + (opt.isi || '') + '</div>') + (opt.foot ? '<div class="modal-foot">' + opt.foot + '</div>' : '') + '</div>';
  document.body.appendChild(ov);
  var m = { el: ov, box: ov.querySelector('.modal'), close: function (v) { if (m.closed) return; m.closed = true; ov.remove(); _modalStack = _modalStack.filter(function (x) { return x !== m; }); if (opt.onClose) opt.onClose(v); }, $: function (s) { return ov.querySelector(s); }, $$: function (s) { return Array.prototype.slice.call(ov.querySelectorAll(s)); } };
  ov.addEventListener('click', function (e) { if (e.target === ov && opt.tutupLuar !== false) m.close(); if (e.target.closest('[data-x]')) m.close(); });
  _modalStack.push(m);
  if (opt.onOpen) opt.onOpen(m);
  var f = ov.querySelector('[autofocus]'); if (f) setTimeout(function () { f.focus(); }, 30);
  return m;
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && _modalStack.length) { var m = _modalStack[_modalStack.length - 1]; if (m.el.querySelector('[data-noesc]')) return; m.close(); } });
function drawer(opt) {
  var ov = document.createElement('div');
  ov.className = 'overlay drawer-wrap';
  ov.innerHTML = '<div class="drawer" role="dialog"><div class="drawer-head">' + (opt.ikon ? '<div class="ic-box">' + ic(opt.ikon) + '</div>' : '') + '<div class="grow"><h3>' + (opt.judul || '') + '</h3>' + (opt.sub ? '<div class="muted" style="font-size:13px">' + opt.sub + '</div>' : '') + '</div><button class="modal-x" data-x>' + ic('x') + '</button></div><div class="drawer-body">' + (opt.isi || '') + '</div>' + (opt.foot ? '<div class="drawer-foot">' + opt.foot + '</div>' : '') + '</div>';
  document.body.appendChild(ov);
  var m = { el: ov, close: function () { if (m.closed) return; m.closed = true; ov.remove(); _modalStack = _modalStack.filter(function (x) { return x !== m; }); if (opt.onClose) opt.onClose(); }, $: function (s) { return ov.querySelector(s); }, $$: function (s) { return Array.prototype.slice.call(ov.querySelectorAll(s)); },
    set: function (isi, foot) { ov.querySelector('.drawer-body').innerHTML = isi; if (foot !== undefined) { var f = ov.querySelector('.drawer-foot'); if (!f) { f = document.createElement('div'); f.className = 'drawer-foot'; ov.querySelector('.drawer').appendChild(f); } f.innerHTML = foot; } } };
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-x]')) m.close(); });
  _modalStack.push(m);
  if (opt.onOpen) opt.onOpen(m);
  return m;
}
function konfirmasi(judul, isi, opt) {
  opt = opt || {};
  return new Promise(function (res) {
    var m = modal({ judul: judul, ikon: opt.ikon || (opt.bahaya ? 'triangle-alert' : 'circle-help'), ikonKelas: opt.bahaya ? 'coral' : '', isi: '<p style="margin:0;color:var(--ink-2)">' + isi + '</p>' + (opt.alasan ? '<div class="field mt"><label>' + esc(opt.alasan) + '</label><textarea class="textarea" id="kfAlasan" placeholder="' + esc(opt.ph || 'Tulis alasan…') + '" autofocus></textarea></div>' : '') + (opt.ketik ? '<div class="field mt"><label>Ketik <b>' + esc(opt.ketik) + '</b> untuk melanjutkan</label><input class="input" id="kfKetik" autofocus></div>' : ''),
      foot: '<button class="btn btn-outline" data-x>Batal</button><button class="btn ' + (opt.bahaya ? 'btn-danger' : 'btn-primary') + '" id="kfOk">' + esc(opt.ok || 'Ya, lanjutkan') + '</button>', lebar: '', onClose: function (v) { res(v || false); } });
    m.$('#kfOk').onclick = function () {
      var al = m.$('#kfAlasan'), kt = m.$('#kfKetik');
      if (al && al.value.trim().length < (opt.minAlasan || 5)) { al.classList.add('is-err'); al.focus(); return; }
      if (kt && kt.value.trim() !== opt.ketik) { kt.classList.add('is-err'); kt.focus(); return; }
      m.close(al ? al.value.trim() : (kt ? kt.value.trim() : true));
    };
  });
}
function popMenu(anchor, items) {
  document.querySelectorAll('.pop').forEach(function (p) { p.remove(); });
  var p = document.createElement('div'); p.className = 'pop';
  p.innerHTML = items.map(function (it, i) { return it === '-' ? '<hr>' : '<button class="mi ' + (it.bahaya ? 'danger' : '') + '" data-i="' + i + '">' + (it.ikon ? ic(it.ikon, 'sm') : '') + '<span>' + esc(it.label) + '</span></button>'; }).join('');
  document.body.appendChild(p);
  var r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
  p.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
  p.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
  p.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; var it = items[+b.dataset.i]; p.remove(); if (it.fn) it.fn(); });
  setTimeout(function () { document.addEventListener('click', function tutup(e) { if (!p.contains(e.target)) { p.remove(); document.removeEventListener('click', tutup); } }); }, 0);
  return p;
}
function emptyState(ikon, judul, isi, aksi) { return '<div class="empty"><div class="ic-box">' + ic(ikon || 'inbox', 'lg') + '</div><b>' + esc(judul) + '</b>' + (isi ? '<div>' + isi + '</div>' : '') + (aksi || '') + '</div>'; }
function skeletonRows(n, cols) { var s = ''; for (var i = 0; i < n; i++) { s += '<tr>'; for (var j = 0; j < cols; j++) s += '<td><div class="skel" style="height:14px;width:' + (40 + ((i * 7 + j * 13) % 50)) + '%"></div></td>'; s += '</tr>'; } return s; }
function retryBox(res, fnName) { return '<div class="empty"><div class="ic-box coral">' + ic('wifi-off', 'lg') + '</div><b>Gagal memuat data</b><div>' + esc((res && res.message) || '') + '</div><button class="btn btn-outline mt" data-act="' + (fnName || 'muat') + '">' + ic('refresh-cw', 'sm') + 'Coba lagi</button></div>'; }
function setBusy(btn, busy, teks) {
  if (!btn) return;
  if (busy) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + (teks ? esc(teks) : ''); }
  else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}
function badgeStatus(status, piutangId) {
  if (status === 'Batal') return '<span class="badge b-batal">' + ic('ban', 'sm') + 'Batal</span>';
  if (status === 'Hutang') return '<span class="badge b-hutang">' + ic('clock-3', 'sm') + 'Hutang</span>';
  if (status === 'Lunas Sebagian') return '<span class="badge b-sebagian">' + ic('clock-3', 'sm') + 'Sebagian</span>';
  if (status === 'Belum Lunas') return '<span class="badge b-hutang">' + ic('clock-3', 'sm') + 'Belum Lunas</span>';
  return '<span class="badge b-lunas">' + ic('circle-check', 'sm') + (piutangId ? 'Lunas (Tempo)' : 'Lunas') + '</span>';
}
function selectOpts(list, val, kosong) { return (kosong !== undefined ? '<option value="">' + esc(kosong) + '</option>' : '') + list.map(function (x) { var v = typeof x === 'object' ? x.v : x, l = typeof x === 'object' ? x.l : x; return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join(''); }
function formData(root) {
  var o = {};
  root.querySelectorAll('[name]').forEach(function (el) {
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  });
  return o;
}

/* ---------- gambar: kompres di perangkat sebelum unggah ---------- */
function bacaFile(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); }); }
function kompresGambar(file, maxW, kualitas, mime) {
  return bacaFile(file).then(function (url) {
    if (/svg/.test(file.type)) return url;
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height, s = Math.min(1, (maxW || 1600) / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cv.width, cv.height);
        var out = cv.toDataURL(mime || 'image/jpeg', kualitas || 0.8);
        if (/png/.test(file.type) && mime === 'image/png') out = cv.toDataURL('image/png');
        res(out.length < url.length || s < 1 ? out : url);
      };
      img.onerror = function () { res(url); };
      img.src = url;
    });
  });
}
function pilihFile(accept, capture) {
  return new Promise(function (res) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept || 'image/*'; if (capture) inp.setAttribute('capture', 'environment');
    inp.onchange = function () { res(inp.files && inp.files[0] ? inp.files[0] : null); };
    inp.click();
  });
}
function unduhDataUrl(nama, dataUrl) { var a = document.createElement('a'); a.href = dataUrl; a.download = nama; document.body.appendChild(a); a.click(); a.remove(); }
function unduhTeks(nama, teks, mime) { var b = new Blob([teks], { type: mime || 'text/plain;charset=utf-8' }); var u = URL.createObjectURL(b); unduhDataUrl(nama, u); setTimeout(function () { URL.revokeObjectURL(u); }, 2000); }
function salinTeks(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return salinLama(t); });
  return Promise.resolve(salinLama(t));
  function salinLama(x) { var ta = document.createElement('textarea'); ta.value = x; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ta.remove(); return ok; }
}

/* ---------- pemuat pustaka (lazy) ---------- */
var _scripts = {};
function loadScript(src) { if (_scripts[src]) return _scripts[src]; _scripts[src] = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = function () { res(); }; s.onerror = function () { delete _scripts[src]; rej(new Error('Gagal memuat ' + src)); }; document.head.appendChild(s); }); return _scripts[src]; }
function loadChart() { return window.Chart ? Promise.resolve(window.Chart) : loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js').then(function () { Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif"; Chart.defaults.color = '#64748B'; return window.Chart; }); }
function loadXLSX() { return window.XLSX ? Promise.resolve(window.XLSX) : loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js').then(function () { return window.XLSX; }); }
/** Ekspor .xlsx di browser: sheets = [{nama, kolom:[], rows:[[]]}] */
function eksporXLSX(namaBerkas, sheets) {
  return loadXLSX().then(function (X) {
    var wb = X.utils.book_new();
    sheets.forEach(function (s) { var ws = X.utils.aoa_to_sheet([s.kolom].concat(s.rows)); ws['!cols'] = s.kolom.map(function (k, i) { var mx = String(k).length; s.rows.slice(0, 200).forEach(function (r) { mx = Math.max(mx, String(r[i] == null ? '' : r[i]).length); }); return { wch: Math.min(48, mx + 2) }; }); X.utils.book_append_sheet(wb, ws, String(s.nama).slice(0, 31)); });
    X.writeFile(wb, namaBerkas);
  }).catch(function (e) { toast('Ekspor gagal', e.message, 'err'); });
}
function bacaBerkasTabel(file) {
  return loadXLSX().then(function (X) {
    return file.arrayBuffer().then(function (buf) {
      var wb = X.read(buf, { type: 'array', cellDates: true });
      return wb.SheetNames.map(function (n) {
        var rows = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true });
        var hi = 0, best = 0;
        rows.slice(0, 10).forEach(function (r, i) { var s = r.filter(function (x) { return typeof x === 'string' && x.trim(); }).length; if (s > best) { best = s; hi = i; } });
        var head = (rows[hi] || []).map(function (h) { return String(h).trim(); });
        var data = rows.slice(hi + 1).filter(function (r) { return r.join('').trim() !== ''; }).map(function (r) {
          var o = {}; head.forEach(function (h, i) { if (h) { var v = r[i]; o[h] = v instanceof Date ? tglLokal(v) : v; } }); return o; });
        return { nama: n, kolom: head.filter(String), rows: data };
      });
    });
  });
}

/* ---------- router hash dengan halaman "hidup" ---------- */
var Pages = {}, _pageEls = {}, _current = null;
function registerPage(name, def) { Pages[name] = Object.assign({ auth: 'user' }, def); }
function go(path) { var h = '#/' + String(path).replace(/^#?\/?/, ''); if (location.hash === h) route(); else location.hash = h; }
function parseHash() { var h = location.hash.replace(/^#\/?/, '').split('?')[0]; var parts = h.split('/').map(decodeURIComponent); return { name: parts[0] || '', param: parts.slice(1).join('/') }; }
function route() {
  var r = parseHash();
  if (r.name === 'v') { if (window.App) App.tampilVerifikasi(r.param); return; }
  if (!AppState.token) { if (window.App) App.tampilLogin(); return; }
  if (window.App && !App.shellSiap) App.tampilShell();
  var name = r.name;
  if (!Pages[name] && !LAZY[name]) name = App.halamanAwal();
  if (!Pages[name] && LAZY[name]) {
    if (AppState.user.role !== 'OWNER') { toast('Akses ditolak', 'Menu ini khusus Owner.', 'warn'); location.hash = '#/' + App.halamanAwal(); return; }
    LoadingBar.start();
    muatLazy(name).then(function () { LoadingBar.done(); if (parseHash().name === r.name) route(); }, function () { LoadingBar.done(); toast('Gagal memuat halaman', 'Periksa koneksi internet lalu coba lagi.', 'err'); });
    return;
  }
  var def = Pages[name];
  if (def.auth === 'owner' && AppState.user.role !== 'OWNER') { toast('Akses ditolak', 'Menu ini khusus Owner.', 'warn'); name = App.halamanAwal(); def = Pages[name]; }
  if (def.perm && !App.izin(def.perm)) { toast('Akses ditolak', 'Izin modul belum diaktifkan Owner.', 'warn'); name = App.halamanAwal(); def = Pages[name]; }
  var host = document.getElementById('pageHost');
  var key = name + (def.perParam ? ':' + r.param : '');
  var el = _pageEls[key];
  if (!el) { el = document.createElement('section'); el.className = 'page'; el.dataset.page = key; el.innerHTML = def.template ? def.template(r.param) : ''; host.appendChild(el); _pageEls[key] = el; if (def.init) def.init(el, r.param); }
  Array.prototype.forEach.call(host.children, function (p) { p.hidden = p !== el; });
  if (_current && _current.def.hide && _current.key !== key) { try { _current.def.hide(_current.el); } catch (e) { } }
  _current = { name: name, key: key, def: def, el: el, param: r.param };
  App.tandaiNav(name);
  window.scrollTo(0, 0);
  if (def.show) { try { def.show(el, r.param); } catch (e) { console.error(e); } }
  document.title = (def.judul || 'Via Seafood') + ' — ' + ((AppState.brand && AppState.brand.appName) || 'Via Seafood');
}
function halamanAktif() { return _current; }
function buangHalaman(prefix) { Object.keys(_pageEls).forEach(function (k) { if (!prefix || k.indexOf(prefix) === 0) { _pageEls[k].remove(); delete _pageEls[k]; } }); }
addEventListener('hashchange', route);

/* ---------- aktivitas pengguna (polling hemat & kunci layar) ---------- */
var Activity = {
  at: Date.now(), last: {},
  init: function () { var self = this; ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'].forEach(function (ev) { addEventListener(ev, function () { self.at = Date.now(); }, { passive: true }); }); },
  idleMs: function () { return Date.now() - this.at; },
  due: function (key, aktifMs, idleMs) {
    if (document.visibilityState !== 'visible') return false;
    var batas = this.idleMs() > 120000 ? idleMs : aktifMs;
    if (Date.now() - (this.last[key] || 0) < batas - 500) return false;
    this.last[key] = Date.now(); return true;
  }
};
Activity.init();
/** Delegasi klik data-act → handler halaman. */
function bindActs(root, handlers) {
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'); if (!a || !root.contains(a)) return;
    var fn = handlers[a.dataset.act]; if (!fn) return;
    e.preventDefault(); fn(a, e);
  });
}
/** Tabel bisa diurutkan: kolom th[data-sort] */
function sortRows(rows, key, dir) {
  return rows.slice().sort(function (a, b) {
    var x = a[key], y = b[key];
    if (typeof x === 'number' || typeof y === 'number') return ((Number(x) || 0) - (Number(y) || 0)) * dir;
    return String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), 'id') * dir;
  });
}
function thSort(label, key, st, cls) { return '<th class="sortable ' + (cls || '') + (st.key === key ? ' sorted' : '') + '" data-act="sort" data-key="' + key + '">' + label + ' <span class="arr">' + (st.key === key ? (st.dir > 0 ? '▲' : '▼') : '↕') + '</span></th>'; }
function pagerHtml(hal, total, per) {
  var n = Math.max(1, Math.ceil(total / per)), out = '<div class="pager"><button data-act="hal" data-h="' + (hal - 1) + '"' + (hal <= 1 ? ' disabled' : '') + ' aria-label="Sebelumnya">' + ic('chevron-left', 'sm') + '</button>';
  var tampil = [];
  for (var i = 1; i <= n; i++) if (i === 1 || i === n || Math.abs(i - hal) <= 1) tampil.push(i); else if (tampil[tampil.length - 1] !== '…') tampil.push('…');
  tampil.forEach(function (i) { out += i === '…' ? '<span class="muted">…</span>' : '<button data-act="hal" data-h="' + i + '"' + (i === hal ? ' class="on"' : '') + '>' + i + '</button>'; });
  return out + '<button data-act="hal" data-h="' + (hal + 1) + '"' + (hal >= n ? ' disabled' : '') + '>Next ' + ic('chevron-right', 'sm') + '</button></div>';
}

/* ---------- pembantu formulir (dipakai semua halaman) ---------- */
/** Bungkus field: label + kontrol + petunjuk opsional. opt: {req, hint, cls, id} */
function fld(label, kontrol, opt) {
  opt = opt || {};
  return '<div class="field ' + (opt.cls || '') + '"' + (opt.id ? ' id="' + opt.id + '"' : '') + '><label' + (opt.untuk ? ' for="' + opt.untuk + '"' : '') + '><span>' + label + (opt.req ? ' <span class="req">*</span>' : '') + '</span>' + (opt.kanan || '') + '</label>' + kontrol + (opt.hint ? '<div class="hint">' + opt.hint + '</div>' : '') + '</div>';
}
function inp(name, val, attr) { return '<input class="input" name="' + name + '" id="f_' + name + '" value="' + esc(val == null ? '' : val) + '" ' + (attr || '') + '>'; }
function sel(name, list, val, attr, kosong) { return '<select class="select" name="' + name + '" id="f_' + name + '" ' + (attr || '') + '>' + selectOpts(list, val, kosong) + '</select>'; }
function txa(name, val, attr) { return '<textarea class="textarea" name="' + name + '" id="f_' + name + '" ' + (attr || '') + '>' + esc(val == null ? '' : val) + '</textarea>'; }
function sakelar(name, on, attr) { return '<label class="switch"><input type="checkbox" name="' + name + '" id="f_' + name + '"' + (on ? ' checked' : '') + ' ' + (attr || '') + '><span></span></label>'; }
function rpInp(name, val, attr) { return '<div class="affix"><span class="ad">Rp</span><input name="' + name + '" id="f_' + name + '" inputmode="numeric" data-rp value="' + (val ? angka(val) : '') + '" ' + (attr || '') + '></div>'; }
/** Format otomatis input rupiah (data-rp) saat diketik. */
document.addEventListener('input', function (e) {
  var t = e.target; if (!t.matches || !t.matches('input[data-rp]')) return;
  var pos = t.value.length - t.selectionStart, n = parseAngka(t.value);
  t.value = t.value.trim() === '' ? '' : angka(Math.round(n)); try { t.setSelectionRange(t.value.length - pos, t.value.length - pos); } catch (x) { }
});
function tabsHtml(list, aktif, cls) { return '<div class="tabs ' + (cls || '') + '" role="tablist">' + list.map(function (t) { return '<button type="button" role="tab" data-tab="' + t.id + '" class="' + (t.id === aktif ? 'on' : '') + '">' + (t.ikon ? ic(t.ikon, 'sm') : '') + esc(t.label) + (t.n ? '<span class="n">' + t.n + '</span>' : '') + '</button>'; }).join('') + '</div>'; }
function pasangTabs(root, fn) { root.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (!b || !root.contains(b)) return; var wrap = b.parentNode; wrap.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('on', x === b); }); fn(b.dataset.tab, b); }); }
function chipSel(list, aktif, attr) { return list.map(function (c) { return '<button type="button" class="chip' + (String(c.v) === String(aktif) ? ' on' : '') + '" data-v="' + esc(c.v) + '" ' + (attr || '') + '>' + esc(c.l) + (c.n != null ? ' <span class="n">' + c.n + '</span>' : '') + '</button>'; }).join(''); }
function periodeIni() { return hariIni().slice(0, 7); }
function periodeGeser(per, n) { var y = +per.slice(0, 4), m = +per.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + ('0' + (m + 1)).slice(-2); }
/** Buka/unduh berkas hasil doc.print: dataUrl → unduh; selain itu buka URL Drive. */
function bukaBerkas(d, unduh) {
  if (d.dataUrl && unduh !== false) { unduhDataUrl(d.nama || 'dokumen.pdf', d.dataUrl); return; }
  if (d.url) window.open(d.url, '_blank', 'noopener');
}

/* ---------- grafik SVG ringan tanpa pustaka (dashboard, keuangan, pelanggan) ---------- */
var Grafik = {
  _n: 0,
  skala: function (maks) {
    if (!(maks > 0)) return { maks: 4, langkah: 1 };
    var p = Math.pow(10, Math.floor(Math.log(maks) / Math.LN10)), m = maks / p;
    var s = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 8 ? 8 : 10;
    return { maks: s * p, langkah: s * p / 4 };
  },
  /** opt: {tipe:'garis'|'batang', labels:[], labelTip:[], series:[{nama, data:[], warna}], fmt(v), fmtSumbu(v)} */
  render: function (el, opt) {
    el.__g = opt;
    if (!el.__ro && window.ResizeObserver) { el.__ro = new ResizeObserver(debounce(function () { Grafik.gambar(el); }, 120)); el.__ro.observe(el); }
    this.gambar(el);
  },
  gambar: function (el) {
    var opt = el.__g; if (!opt) return;
    var W = el.clientWidth, H = el.clientHeight || 260; if (W < 60) return;
    var fmt = opt.fmt || rp, fmtS = opt.fmtSumbu || function (v) { return rpRingkas(v).replace('Rp ', ''); };
    var pl = opt.kiri || 48, pr = 8, pt = 12, pb = 26, w = W - pl - pr, h = H - pt - pb, n = opt.labels.length, maks = 0;
    opt.series.forEach(function (s) { s.data.forEach(function (v) { if (v > maks) maks = v; }); });
    var sk = this.skala(maks * 1.04), id = 'g' + (++this._n), batang = opt.tipe === 'batang';
    var y = function (v) { return pt + h - (Math.max(0, v) / sk.maks) * h; };
    var lebarGrup = n ? w / n : w, x = function (i) { return batang ? pl + lebarGrup * (i + 0.5) : pl + (n <= 1 ? w / 2 : w * i / (n - 1)); };
    var s = '<svg class="gsvg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.judul || 'Grafik') + '"><defs>';
    opt.series.forEach(function (se, k) { s += '<linearGradient id="' + id + 'f' + k + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + se.warna + '" stop-opacity=".28"/><stop offset="1" stop-color="' + se.warna + '" stop-opacity="0"/></linearGradient>'; });
    s += '</defs>';
    for (var g = 0; g <= 4; g++) { var gy = Math.round(y(sk.langkah * g)) + 0.5; s += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '"/><text x="' + (pl - 8) + '" y="' + (gy + 4) + '" text-anchor="end">' + esc(fmtS(sk.langkah * g)) + '</text>'; }
    var step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 58))));
    for (var i = 0; i < n; i++) if ((n - 1 - i) % step === 0) s += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(opt.labels[i]) + '</text>';
    if (batang) {
      var m = opt.series.length, bw = Math.max(3, Math.min(26, lebarGrup * 0.72 / m));
      opt.series.forEach(function (se, k) {
        se.data.forEach(function (v, i) { var bx = x(i) - (bw * m) / 2 + k * bw, by = y(v), bh = pt + h - by; if (bh > 0.5) s += '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + (bw - (m > 1 ? 2 : 0)).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="3" fill="' + se.warna + '"/>'; });
      });
    } else {
      opt.series.forEach(function (se, k) {
        var pts = se.data.map(function (v, i) { return [x(i), y(v)]; }); if (!pts.length) return;
        var d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L');
        if (k === 0) s += '<path d="' + d + ' L' + pts[pts.length - 1][0].toFixed(1) + ',' + (pt + h) + ' L' + pts[0][0].toFixed(1) + ',' + (pt + h) + ' Z" fill="url(#' + id + 'f' + k + ')"/>';
        s += '<path d="' + d + '" fill="none" stroke="' + se.warna + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"' + (se.putus ? ' stroke-dasharray="5 5"' : '') + '/>';
        var last = pts[pts.length - 1]; s += '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4.5" fill="#fff" stroke="' + se.warna + '" stroke-width="2.5"/>';
      });
    }
    s += '<line class="guide" x1="0" x2="0" y1="' + pt + '" y2="' + (pt + h) + '" visibility="hidden"/></svg><div class="gtip" hidden></div>';
    el.innerHTML = s;
    var svg = el.querySelector('svg'), guide = el.querySelector('.guide'), tip = el.querySelector('.gtip');
    var pindah = function (e) {
      var r = svg.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      var i = batang ? Math.floor((px - pl) / lebarGrup) : Math.round((px - pl) / (n <= 1 ? 1 : w / (n - 1)));
      i = Math.max(0, Math.min(n - 1, i)); if (!n) return;
      guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = '<div class="k">' + esc((opt.labelTip || opt.labels)[i]) + '</div>' + opt.series.map(function (se) { return '<div><i style="background:' + se.warna + '"></i>' + esc(se.nama) + ': <b>' + esc(fmt(se.data[i])) + '</b></div>'; }).join('') + (opt.ekstra ? opt.ekstra(i) : '');
      var tx = Math.max(tip.offsetWidth / 2 + 4, Math.min(W - tip.offsetWidth / 2 - 4, x(i)));
      var ty = Math.min.apply(null, opt.series.map(function (se) { return y(se.data[i]); }));
      tip.style.left = tx + 'px'; tip.style.top = Math.max(tip.offsetHeight + 6, ty) + 'px';
    };
    svg.addEventListener('pointermove', pindah); svg.addEventListener('pointerdown', pindah);
    svg.addEventListener('pointerleave', function () { guide.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  }
};


/* ---------- halaman khusus Owner dimuat lazy (HP staff tidak mengunduhnya) ---------- */
var LAZY = { dashboard: 'js/pages-dashboard.js', keuangan: 'js/pages-keuangan.js', pengaturan: 'js/pages-admin.js', audit: 'js/pages-admin.js', notifikasi: 'js/pages-notif.js', dokumen: 'js/pages-dokumen.js' };
function muatLazy(nama) { return loadScript(LAZY[nama] + '?v=' + VERSI_FE); }
function muatSemuaOwner() { var u = {}; Object.keys(LAZY).forEach(function (k) { u[LAZY[k]] = k; }); return Promise.all(Object.keys(u).map(function (f) { return muatLazy(u[f]); })); }
/** Stub: modul cetak dokumen dipakai juga oleh staff (nota & rekap) — dimuat saat pertama dipakai. */
var Dokumen = { _stub: true };
['cetak', 'massal', 'hasil', 'pantauMassal'].forEach(function (fn) {
  Dokumen[fn] = function () { var a = arguments, btn = fn === 'cetak' ? a[2] : null; setBusy(btn, true); return muatLazy('dokumen').then(function () { setBusy(btn, false); return Dokumen[fn].apply(Dokumen, a); }, function () { setBusy(btn, false); toast('Gagal memuat modul dokumen', 'Periksa koneksi lalu coba lagi.', 'err'); }); };
});
var Keuangan = { _stub: true, bayar: function () { var a = arguments; return muatLazy('keuangan').then(function () { return Keuangan.bayar.apply(Keuangan, a); }); } };
