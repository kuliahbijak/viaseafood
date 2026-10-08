# Via Seafood — Buku Kas Laut (Frontend)

Aplikasi web pembukuan pesanan harian, stok cold storage, piutang, keuangan, rekap pelanggan, WhatsApp & dokumen.
Frontend statis untuk **GitHub Pages**; backend **Google Apps Script** (REST API) + Google Sheets.

## Mulai cepat
1. Edit `js/config.js` → isi `GAS_URL` dengan URL Web App Apps Script (akhiran `/exec`).
2. Unggah **isi folder ini** (yang berisi `index.html`) ke repository GitHub, aktifkan **Settings → Pages → main / root**.
3. Buka `https://USERNAME.github.io/NAMA-REPO/` dan login sebagai Owner.

Panduan lengkap (backend, GitHub, WhatsApp, migrasi, branding, printer, troubleshooting): **PANDUAN-INSTALASI.md**.

## Struktur
| Berkas | Isi |
|---|---|
| `index.html` | Halaman tunggal (SPA, router hash) |
| `css/style.css` | Desain "Coastal Ledger" |
| `js/config.js` | URL backend — satu-satunya berkas yang wajib diedit |
| `js/core.js` | API tahan jaringan (timeout, retry, idempoten, batch), cache SWR, router, komponen UI, grafik |
| `js/app.js` | Login, menu per peran, branding custom, pencarian ⌘K, kunci layar, verifikasi publik |
| `js/struk.js` | Mesin model struk 58/80 mm, cetak browser/Bluetooth ESC/POS/RawBT, teks WhatsApp |
| `js/pages-*.js` | Halaman: pesanan, produk, pelanggan (semua peran); dashboard, keuangan, pengaturan, WhatsApp & CRM, dokumen (Owner — dimuat lazy) |
| `js/icons.js` | Subset ikon Lucide (ISC) · `js/vendor/qrcode.js` — qrcode-generator (MIT) |
| `img/` | Logo & ilustrasi bawaan — semuanya bisa diganti Owner dari **Pengaturan → Tampilan & Branding** |

Disusun oleh **Kelas @khoirulfajarid** · khoirulfajar.abughazi@gmail.com
