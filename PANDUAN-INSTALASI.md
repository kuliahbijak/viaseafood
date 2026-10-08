# Panduan Instalasi — Via Seafood "Buku Kas Laut" v1.0.0

Aplikasi web pembukuan **pesanan harian, stok cold storage, piutang, keuangan, rekap pelanggan, WhatsApp & dokumen** untuk Via Seafood.
Backend: **Google Apps Script** (REST API) + **Google Sheets** sebagai database + **Google Drive** untuk berkas.
Frontend: halaman web statis di **GitHub Pages** (gratis, HTTPS).

> Disusun oleh **Kelas @khoirulfajarid** · khoirulfajar.abughazi@gmail.com

---

## Daftar Isi

1. [Isi paket](#1-isi-paket)
2. [Persiapan](#2-persiapan)
3. [Bagian A — Pasang backend (Apps Script)](#bagian-a--pasang-backend-apps-script)
4. [Bagian B — Unggah frontend ke GitHub Pages](#bagian-b--unggah-frontend-ke-github-pages)
5. [Bagian C — Login pertama & pengaturan awal](#bagian-c--login-pertama--pengaturan-awal)
6. [Bagian D — WhatsApp (Fonnte) & Email](#bagian-d--whatsapp-fonnte--email)
7. [Bagian E — Memindahkan data dari pembukuan lama](#bagian-e--memindahkan-data-dari-pembukuan-lama)
8. [Bagian F — Logo, gambar latar, model struk & dokumen](#bagian-f--logo-gambar-latar-model-struk--dokumen)
9. [Bagian G — Printer thermal](#bagian-g--printer-thermal)
10. [Bagian H — Backup, arsip & perawatan](#bagian-h--backup-arsip--perawatan)
11. [Bagian I — Cara memperbarui aplikasi](#bagian-i--cara-memperbarui-aplikasi)
12. [Batas kuota Google](#batas-kuota-google)
13. [Troubleshooting](#troubleshooting)
14. [Glosarium](#glosarium)

---

## 1. Isi paket

Paket diserahkan dalam **dua bentuk** — jangan dicampur:

### a) Berkas backend (diberikan satu per satu, untuk disalin-tempel ke Apps Script)

| Berkas | Isi |
|---|---|
| `Kode.gs` | Inti: router API, login & token, hak akses, database Sheets, cache, setup |
| `Modul.gs` | Produk & stok, pesanan, rekap, pelanggan, piutang, keuangan, dashboard, pengguna, pengaturan, branding |
| `Notifikasi.gs` | WhatsApp Fonnte + Email, antrean kirim, blast, pengingat jatuh tempo |
| `CRM.gs` | Buku kontak CRM (segmen, status WA, tag, opt-out, impor, gabung duplikat) |
| `Migrasi.gs` | Impor dari pembukuan lama / Excel, backup & pulihkan, arsip, data demo |
| `MesinDokumen.gs` | Mesin dokumen (Google Docs/Sheets → PDF/Word/Excel), verifikasi, cetak massal |
| `DokumenVS.gs` | Data & template bawaan: nota, kwitansi, tagihan, rekap, laporan, model struk |
| `DE_QrLib.gs` | Pustaka QR code (MIT) untuk QR verifikasi di dokumen |
| `appsscript.json` | Manifest: zona waktu, izin, layanan Drive API |

### b) `via-seafood-frontend.zip` (diunggah ke GitHub)

```
via-seafood-frontend/          ← folder hasil ekstrak = folder yang di-"git init"
├── index.html                 ← WAJIB ada di sini (root)
├── manifest.webmanifest
├── .nojekyll
├── README.md
├── PANDUAN-INSTALASI.md
├── css/
│   └── style.css
├── img/                       ← logo & gambar latar bawaan (bisa diganti dari aplikasi)
└── js/
    ├── config.js              ← SATU-SATUNYA berkas yang wajib diedit
    ├── core.js, app.js, struk.js, icons.js
    ├── pages-*.js
    └── vendor/qrcode.js
```

> ⚠️ Tidak ada berkas `.gs` di dalam ZIP — memang disengaja. Berkas backend hanya untuk Apps Script.

---

## 2. Persiapan

| Kebutuhan | Keterangan |
|---|---|
| **Akun Google pemilik** | Akun ini menjadi pemilik spreadsheet, folder Drive, dan otomatis menjadi akun **Owner** pertama. Disarankan akun khusus usaha (mis. `viaseafood.kas@gmail.com`) |
| **Komputer + Chrome** | Untuk instalasi. Operasional harian bisa di HP/tablet |
| **Git** | Unduh di <https://git-scm.com/downloads> (Windows: pilih "Git for Windows", semua opsi biarkan default) |
| **Akun GitHub** | Daftar gratis di <https://github.com/signup> |
| **Fonnte** (opsional) | Untuk WhatsApp otomatis — <https://fonnte.com>. Tanpa Fonnte, struk tetap bisa dikirim lewat tombol "Buka di WA Web" |

---

## Bagian A — Pasang backend (Apps Script)

### A1. Buat proyek Apps Script

1. Login ke Chrome dengan **akun Google pemilik**.
2. Buka <https://script.google.com> → klik **New project** (Proyek baru).
3. Klik judul "Untitled project" di kiri atas → ganti menjadi **Via Seafood API** → **Rename**.

### A2. Tampilkan berkas manifest

1. Klik ikon **⚙️ Project Settings** (Setelan project) di menu kiri.
2. Centang **Show "appsscript.json" manifest file in editor**.
3. Pastikan **Time zone** = `(GMT+07:00) Jakarta` (nanti juga diatur otomatis oleh manifest).
4. Kembali ke **< > Editor**.

### A3. Tempel semua berkas `.gs`

1. Di editor sudah ada `Code.gs`. Klik titik tiga di sebelahnya → **Rename** → ketik `Kode` (ekstensi `.gs` otomatis).
2. Hapus seluruh isinya, lalu tempel isi berkas **`Kode.gs`**.
3. Untuk setiap berkas lain: klik **+** (Add a file) → **Script** → beri nama **persis** (tanpa `.gs`): `Modul`, `Notifikasi`, `CRM`, `Migrasi`, `MesinDokumen`, `DokumenVS`, `DE_QrLib` → tempel isinya masing-masing.
4. Klik `appsscript.json` → hapus semua isinya → tempel isi **`appsscript.json`** dari paket.
5. Tekan **Ctrl + S** (simpan semua). Tidak boleh ada tanda merah/galat.

> 💡 Cara menyalin isi berkas: buka berkas `.gs` dengan Notepad/TextEdit → Ctrl+A → Ctrl+C → tempel di editor (Ctrl+V).

### A4. Aktifkan layanan Drive API

Manifest sudah mendaftarkannya. Pastikan di menu kiri bagian **Services** (Layanan) terlihat **Drive**. Bila belum: klik **+** di Services → pilih **Drive API** → versi **v3** → **Add**.
(Dipakai untuk mengonversi template Word/Excel yang Anda unggah.)

### A5. Jalankan setup (sekali saja)

1. Di bilah atas editor, pilih fungsi **`setupAppEnvironment`** pada dropdown → klik **▶ Run**.
2. Muncul **Authorization required** → **Review permissions** → pilih akun pemilik.
3. Bila muncul *"Google hasn't verified this app"*: klik **Advanced** → **Go to Via Seafood API (unsafe)** → **Allow**.
   (Aman — ini skrip milik Anda sendiri, bukan aplikasi pihak ketiga.)
4. Tunggu ±30–60 detik. Buka **Execution log** di bawah. Catat:
   - ✅ `Akun Owner: emailanda@gmail.com • sandi sementara: VS-XXXXXX` ← **simpan sandi sementara ini**
   - ✅ `Spreadsheet : https://docs.google.com/...` (database)
   - ✅ `Folder Drive: https://drive.google.com/...`
   - ✅ Trigger: `tugasMenit`, `tugasRekap`, `tugasHarian`, `tugasTutupBuku`

Setup otomatis membuat: spreadsheet database (semua sheet & kolom), folder Drive (Foto Produk, Bukti Bayar, Branding & Tampilan, Dokumen, Backup, Arsip, Ekspor), template dokumen & model struk bawaan, pengaturan awal, akun Owner, dan pekerja latar (trigger).

> Setup aman dijalankan ulang — tidak menimpa data yang sudah ada.

### A6. Deploy sebagai Web App

1. Klik tombol biru **Deploy** (kanan atas) → **New deployment**.
2. Klik ⚙️ di sebelah "Select type" → pilih **Web app**.
3. Isi:
   - **Description**: `v1.0.0`
   - **Execute as**: **Me** (akun pemilik)
   - **Who has access**: **Anyone**
4. Klik **Deploy** → salin **Web app URL** yang berakhiran **`/exec`**.

Uji: tempel URL itu di tab baru. Harus tampil teks seperti:
`{"success":true,"data":{"app":"Via Seafood API","v":"1.0.0",...}}`

> ⚠️ "Who has access: **Anyone**" wajib, karena aplikasi diakses dari GitHub Pages. Keamanan tetap terjaga: setiap permintaan data wajib membawa token login, dan hak akses diperiksa di server.

---

## Bagian B — Unggah frontend ke GitHub Pages

### B1. Ekstrak ZIP & isi URL backend

1. Ekstrak `via-seafood-frontend.zip`, misalnya ke `C:\Users\NamaAnda\Documents\via-seafood-frontend`.
2. Buka folder itu — Anda harus **langsung melihat `index.html`**, folder `css`, `img`, `js`.
3. Buka `js\config.js` dengan Notepad, ganti baris:
   ```js
   window.GAS_URL = 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec';
   ```
   dengan URL `/exec` dari langkah A6. Simpan.

> 📁 **Folder kerja Git = folder yang berisi `index.html`** (`via-seafood-frontend`). Jangan naik ke folder induknya, jangan masuk ke `js`.

### B2. Setel identitas Git (sekali per komputer)

Buka **PowerShell** di folder tadi (di File Explorer: klik address bar → ketik `powershell` → Enter), lalu:

```bash
git --version
git config --global user.name "Nama Anda"
git config --global user.email "email-github@anda.com"
```

### B3. Buat repository di GitHub

1. Buka <https://github.com/new>.
2. **Repository name**: `via-seafood` (huruf kecil, tanpa spasi).
3. Pilih **Public** (GitHub Pages gratis untuk repo publik). Kode frontend tidak berisi rahasia apa pun.
4. **Jangan** centang "Add a README" → klik **Create repository**.

### B4. Periksa isi folder, lalu push

Masih di PowerShell, di folder `via-seafood-frontend`:

```bash
dir
```
Pastikan terlihat `index.html`, `css`, `img`, `js`. Tidak boleh ada berkas `.gs`. Lalu jalankan **satu per satu**:

```bash
git init
git add .
git commit -m "Upload pertama Via Seafood"
git branch -M main
git remote add origin https://github.com/USERNAME/via-seafood.git
git push -u origin main
```

Saat `git push` meminta login:
- **Username**: username GitHub Anda
- **Password**: **Personal Access Token** (bukan sandi akun). Saat menempel token, layar memang tidak menampilkan apa pun — tekan Enter saja.

Membuat token: <https://github.com/settings/tokens> → **Generate new token (classic)** → Note: `via-seafood` → Expiration: `No expiration` atau `90 days` → centang **repo** → **Generate token** → salin `ghp_...` (hanya tampil sekali).

> Alternatif tanpa terminal: **GitHub Desktop** (<https://desktop.github.com>) → *Add local repository* → pilih folder `via-seafood-frontend` → *Publish repository*.

### B5. Aktifkan GitHub Pages

1. Di repo GitHub: **Settings** → **Pages** (menu kiri).
2. **Source**: *Deploy from a branch* · **Branch**: `main` · **/ (root)** → **Save**.
3. Centang **Enforce HTTPS**.
4. Tunggu 1–2 menit → muncul *"Your site is live at `https://USERNAME.github.io/via-seafood/`"*.

Buka alamat itu. Halaman login Via Seafood harus tampil dengan lencana hijau **"Server Operasional Normal"** di kanan atas. Bila lencana merah *"Server belum terhubung"*, periksa kembali `js/config.js`.

---

## Bagian C — Login pertama & pengaturan awal

1. Di halaman login pilih tab **Owner (Admin)** → isi **email akun Google pemilik** & **sandi sementara** dari Execution log → **Masuk**.
2. Aplikasi langsung meminta **ganti sandi** → buat sandi baru minimal 6 karakter.
3. Saat Owner login pertama, alamat GitHub Pages otomatis tersimpan sebagai **APP_URL** (dipakai untuk tautan struk, QR verifikasi & pesan WA).

Lalu buka **Pengaturan** (menu khusus Owner):

| Tab | Yang diatur |
|---|---|
| **Pengguna & Hak Akses** | Tambah akun **Staff** (kasir/gudang), PIN 6 digit, izin per modul (preset Kasir/Gudang), reset PIN, keluarkan dari semua perangkat, nonaktifkan akun |
| **Toko & Operasional** | Nama usaha, alamat, WA usaha, rekening (tampil di tagihan), awalan nomor nota, tempo hutang bawaan, batas stok menipis, pajak, target omzet bulanan, jam tutup buku, daftar kategori/satuan/tipe pelanggan/kategori kas |
| **Printer & Struk** | Lebar 58/80 mm, model struk, rangkap, QR, logo, mode ultra hemat |
| **Tampilan & Branding** | **Logo & semua gambar latar** (lihat Bagian F), nama aplikasi, teks login, kegelapan lapisan, kartu foto dashboard |
| **Keamanan & Backup** | Pembatalan nota hanya Owner, kunci layar otomatis, peringatan keamanan, Google Sign-In, mode demo, backup harian & pulihkan, data demo |
| **Migrasi Data** | Impor dari spreadsheet lama / Excel / CSV, ekspor tabel ke Excel |
| **Sheets & Drive** | Tautan spreadsheet & folder, kapasitas sel, status trigger, sinkron ulang cache, hitung ulang rekap, arsip bulan lama |

### Hak akses (RBAC)

| | Owner (Superadmin) | Staff (Admin Kasir/Gudang) |
|---|---|---|
| Dashboard omzet, Keuangan & Piutang, Pengaturan, WhatsApp & CRM, Dokumen & template, Log audit | ✅ | ❌ (ditolak di server) |
| Input pesanan & cetak struk, daftar pesanan, rekap pelanggan, produk & stok, pelanggan, kirim struk WA | ✅ | Sesuai izin yang dicentang Owner |
| Ubah harga saat input, input tanggal mundur | ✅ | Hanya bila izinnya diaktifkan |
| Membatalkan nota | ✅ | Hanya bila "Pembatalan nota hanya Owner" dimatikan |

### Ingin mencoba dulu dengan data contoh?

**Pengaturan → Keamanan & Backup → Buat Data Demo** → mengisi 10 produk, 8 pelanggan, ±30 hari pesanan, piutang & kas fiktif, serta akun demo `kasir@demo.viaseafood.id` / `demo123`.
Setelah selesai mencoba: **Hapus Data Demo** (ketik `HAPUS`) — data asli tidak tersentuh — lalu matikan **Mode demo**.

---

## Bagian D — WhatsApp (Fonnte) & Email

### D1. Hubungkan Fonnte

1. Daftar di <https://fonnte.com> → **Add device** → scan QR dengan WhatsApp nomor usaha.
2. Salin **Token** perangkat.
3. Di aplikasi: **WhatsApp & CRM → Gateway & Kanal** → tempel token → nyalakan saklar **WhatsApp** → **Simpan Konfigurasi**.
4. Kartu perangkat harus berwarna hijau *"Perangkat terhubung"*. Isi nomor tes → **Kirim Tes WA**.

Token disimpan di **Script Properties** (server) dan tidak pernah dikirim ke browser.

### D2. Email

Nyalakan saklar **Email** di tab yang sama. Email dikirim dari akun Google pemilik (kuota ±100 email/hari untuk akun Gmail biasa, 1.500 untuk Google Workspace).

### D3. Apa saja yang dikirim otomatis

Atur di **Matriks Notifikasi** (centang WA/Email per kejadian & ubah teksnya):

- Konfirmasi nota tempo/hutang → pelanggan
- Nota digital pesanan lunas → pelanggan (bawaan: email saja)
- **Pengingat jatuh tempo** H-1, hari H, dan diulang tiap N hari bila lewat tempo → pelanggan
- Kwitansi pembayaran piutang → pelanggan
- Stok menipis, peringatan keamanan, **ringkasan tutup buku harian** → Owner
- Info akun & PIN staff baru / PIN direset → staff

Semua pesan masuk **antrean** dan dikirim pekerja latar tiap 1 menit dengan jeda acak (kasir tidak perlu menunggu). Riwayatnya ada di **Antrean & Log** (bisa *Ulangi yang gagal*).

### D4. Blast promo & CRM

- **Kontak CRM** terisi otomatis dari Pelanggan & Staf (tombol *Sinkron*), bisa diberi tag, opt-out, catatan interaksi, gabung duplikat, impor dari Excel/CSV.
- **Blast WhatsApp**: pilih segmen/tag/langganan/punya piutang → tulis pesan dengan variabel `{nama} {toko} {link}` → batch 10/20/50 → **Buat & Mulai Blast**. Nomor ganda & opt-out dibuang otomatis. Blast tetap berjalan di latar walau halaman ditutup.

> Kirim blast hanya ke pelanggan yang mengenal usaha Anda, dan gunakan jeda acak (mis. `3-8` detik) agar nomor tidak diblokir WhatsApp.

---

## Bagian E — Memindahkan data dari pembukuan lama

**Pengaturan → Migrasi Data.** Kolom dikenali otomatis dari nama header (contoh: "Nama Ikan", "Harga/Kg", "No WA", "Tgl", "Status Bayar", "Detail Produk").

### Dari Google Spreadsheet lama
1. Pastikan spreadsheet lama bisa dibuka akun pemilik script (bagikan ke akun tersebut bila milik orang lain).
2. Tempel URL → **Pindai Spreadsheet**. Muncul tiap sheet: target terdeteksi, pemetaan kolom, dan **perkiraan** (+baru / diperbarui / dilewati) — belum ada yang ditulis.
3. Ubah target bila salah → klik **Impor** per sheet. Diproses bertahap per 2.000 baris.

### Dari Excel / CSV
Seret berkas ke kotak **Dari Berkas Excel / CSV** → pilih target per sheet → **Pindai** → **Impor**.

### Urutan yang disarankan
**Produk → Pelanggan → Akun Staff → Pesanan → Piutang → Keuangan.**

- Impor pesanan lama **tidak** mengurangi stok kecuali Anda mencentang **Kurangi stok**.
- Menjalankan ulang aman: baris yang sama tidak dobel (delta sync). Spreadsheet lama tidak pernah diubah.
- Nomor WA otomatis dirapikan (`62812…`, `+62 812…`, `812…` → `0812…`).

### Hari H peralihan (cutover)
1. Malam sebelumnya: impor ulang semua sheet (hanya selisih yang masuk).
2. Pagi hari H: input stok fisik pagi lewat **Produk & Stok → Penyesuaian Stok → Stok Opname**.
3. Sejak itu semua transaksi hanya dicatat di aplikasi.

---

## Bagian F — Logo, gambar latar, model struk & dokumen

### F1. Ganti logo & SEMUA gambar latar (Superadmin)

**Pengaturan → Tampilan & Branding → Logo & Gambar Latar.** Setiap slot punya tombol **Unggah** (dari HP/komputer, dikompres otomatis), **URL** (tautan gambar `https://`), dan **↺ Kembalikan ke bawaan**.

| Slot | Tampil di | Ukuran saran |
|---|---|---|
| Logo aplikasi | Menu samping, login, favicon, dokumen | Persegi PNG ±512 px |
| Latar halaman login | Halaman login | Lanskap ±1920×1080 |
| Latar menu samping | Sidebar | Potret ±600×1200 |
| Banner input pesanan | Kepala halaman Input Pesanan | ±1600×400 |
| Latar konten halaman | Latar semua halaman (sangat samar) | ±1920 px |
| Logo struk | Struk thermal (hitam-putih) | ±384 px kontras tinggi |
| Kartu dashboard 1–3 | Kartu foto di Dashboard | ±1200×600 |
| Foto produk bawaan | Produk yang belum punya foto | ±900 px |
| Spesimen tanda tangan Owner | Kwitansi & tagihan (bila dipilih) | PNG transparan |

Gambar tersimpan di folder **Branding & Tampilan** di Drive dan langsung berlaku di semua perangkat. Pratinjau login di sisi kanan berubah seketika. Di tab yang sama Anda juga bisa mengganti **nama aplikasi, judul, tagline, lokasi, teks login, kegelapan lapisan**, serta judul/label/ikon **kartu foto dashboard**.

> Bila folder Drive Anda tidak mengizinkan berbagi publik (akun kantor), aplikasi otomatis memakai jalur cadangan untuk menampilkan gambar.

### F2. Model struk (tanpa coding)

**Dokumen & Struk → Model Struk.** Editor teks dengan **pratinjau langsung** (contoh Lunas / Tempo / Batal) dan **kamus penanda** (klik untuk menyisipkan).

Perintah baris:

| Perintah | Fungsi |
|---|---|
| `[C]` `[R]` `[L]` | Rata tengah / kanan / kiri |
| `[B]` · `[2]` · `[H]` | Tebal · huruf 2× · tinggi 2× |
| `[LR]kiri\|\|kanan` | Kiri & kanan dalam satu baris (mis. `[LR]TOTAL\|\|{{TOTAL\|rp}}`) |
| `[-]` `[=]` | Garis pemisah |
| `[LOGO]` `[QR]` `[BOX]` | Logo struk · QR verifikasi · kotak status |
| `[FEED]` `[CUT]` | Baris kosong · potong kertas |
| `{{#ITEM}} … {{/ITEM}}` | Ulang per item belanja |
| `{{?TEMPO}} … {{/TEMPO}}` | Tampil hanya bila ada nilainya |
| `{{TOTAL\|rp}}` | Pengubah: `rp`, `angka`, `kapital`, `judul`, `terbilang`, `potong:20`, `bawaan:-`, `awal:`, `akhir:` |

Tersedia 3 model bawaan (80 mm, 58 mm, 58 mm Ultra Hemat). Gunakan **⋮ → Duplikat** untuk membuat variasi, **Pakai sebagai model 58/80 mm** untuk menjadikannya model kasir, **Riwayat versi** untuk mengembalikan, **Reset ke bawaan** bila perlu.

### F3. Dokumen PDF (nota A4, kwitansi, surat tagihan, rekap pelanggan, laporan kas, laporan harian)

**Dokumen & Struk → Template Dokumen.** Template berupa **Google Docs / Sheets** biasa:

1. Klik **Buka di Google** → ubah desain bebas (logo, warna, kop, kalimat) — **jangan hapus penanda** seperti `{{NAMA_PELANGGAN}}`, `{{#ITEM}}…{{/ITEM}}`.
2. Kembali ke aplikasi → **Pindai ulang**. Penanda yang tidak dikenal akan diperingatkan.
3. Atau **⋮ → Ganti berkas**: tempel URL Google Docs/Sheets lain, atau unggah `.docx`/`.xlsx` buatan sendiri.
4. Penanda tambahan yang tidak ada di kamus otomatis menjadi **isian manual** saat mencetak.
5. **Variabel & Penanda**: kamus lengkap per dokumen + variabel global `{{VAR.NAMA}}` (mis. syarat retur, info bank).

Setiap dokumen terbit memiliki **nomor otomatis**, **QR verifikasi** & **sidik SHA-256**. Siapa pun bisa memindai QR untuk mengecek keaslian di halaman verifikasi. Data yang sama dicetak ulang → memakai berkas yang sama (tidak membuat nomor baru). Dokumen bisa **ditarik** dari **Arsip Terbit**. **Cetak Nota Massal / Tagihan Massal** menghasilkan ZIP di Drive.

---

## Bagian G — Printer thermal

Di jendela **Preview Cetak Struk** (setelah simpan pesanan atau dari detail nota) pilih **Metode Cetak**:

| Metode | Untuk | Catatan |
|---|---|---|
| **Dialog cetak browser** | Semua printer yang terpasang di perangkat (USB/driver) | Atur kertas 58/80 mm, margin *None* |
| **Bluetooth langsung (ESC/POS)** | Printer thermal Bluetooth di **Chrome Android / Chrome desktop** | Klik *Hubungkan Printer Bluetooth*, pilih printer. Mendukung logo, QR, beep, potong kertas |
| **Aplikasi RawBT (Android)** | HP Android dengan aplikasi **RawBT** | Pasang RawBT dari Play Store, pasangkan printer di RawBT |

Pengaturan per perangkat (lebar, rangkap, hemat kertas) tersimpan di perangkat itu; default untuk semua kasir diatur di **Pengaturan → Printer & Struk**.

---

## Bagian H — Backup, arsip & perawatan

| Fitur | Cara |
|---|---|
| **Backup otomatis** | Tiap ±04.00 salinan lengkap spreadsheet disimpan di folder Backup (jumlah disimpan diatur di Keamanan & Backup) |
| **Backup manual** | Pengaturan → Keamanan & Backup → **Backup Sekarang** |
| **Pulihkan** | Pilih backup → **Pulihkan** → ketik `PULIHKAN`. Sistem membuat backup pra-pulih dulu sehingga bisa dibatalkan |
| **Arsip bulan lama** | Pengaturan → Sheets & Drive → Partisi Bulanan → **Arsipkan**. Pesanan & log stok bulan lama dipindah ke spreadsheet arsip tahunan agar database tetap ringan (batas Google 10 juta sel). Data tetap terbaca |
| **Edit langsung di Sheets** | Boleh (mis. koreksi alamat). Setelahnya klik **Sinkronkan** di Sheets & Drive agar aplikasi membaca ulang |
| **Hitung ulang rekap** | Sheets & Drive → pilih bulan → **Hitung** (bila rekap terasa tidak cocok setelah edit manual) |
| **Log aktivitas** | Menu **Log Aktivitas**: siapa melakukan apa, kapan, dari terminal mana — bisa diekspor |

Fungsi manual di editor Apps Script (pilih fungsi → ▶ Run):

| Fungsi | Kapan dipakai |
|---|---|
| `setupAppEnvironment` | Instalasi pertama / memperbaiki sheet, folder, template, trigger yang hilang |
| `upgradeSkema` | Setelah memperbarui berkas `.gs` ke versi baru |
| `resetSandiOwner` | Owner lupa sandi → sandi sementara tampil di Execution log |
| `pasangTrigger` | Trigger terhapus / pekerja latar tidak jalan |
| `cekPerforma` | Melihat status cache, pemanas server, antrean |
| `matikanKeepWarm` / `nyalakanKeepWarm` | Mematikan pemanas server bila kuota trigger mepet |

---

## Bagian I — Cara memperbarui aplikasi

**Backend** (berkas `.gs` versi baru):
1. Tempel isi berkas baru ke berkas yang sama di editor → Ctrl+S.
2. Jalankan `upgradeSkema` sekali.
3. **Deploy → Manage deployments → ✏️ Edit** (ikon pensil) → **Version: New version** → **Deploy**.
   ⚠️ Jangan memakai *New deployment* — itu membuat URL baru dan frontend harus diedit lagi.

**Frontend**:
1. Ganti berkas di folder `via-seafood-frontend` (jangan timpa `js/config.js` Anda).
2. Di PowerShell, dari folder itu:
   ```bash
   git add .
   git commit -m "Update ke versi baru"
   git push
   ```
3. Tunggu 1–2 menit. Bila tampilan belum berubah: **Ctrl + Shift + R** atau buka di jendela Incognito.

---

## Batas kuota Google

| Kuota | Akun Gmail biasa | Google Workspace |
|---|---|---|
| Waktu jalan trigger per hari | 90 menit | 6 jam |
| Email per hari | 100 | 1.500 |
| Panggilan UrlFetch (Fonnte) per hari | 20.000 | 100.000 |
| Waktu per eksekusi | 6 menit | 6 menit |
| Sel per spreadsheet | 10 juta | 10 juta |

Aplikasi dirancang hemat kuota: pekerja latar hanya bekerja bila ada antrean, data dibaca dari cache, rekap dihitung terjadwal (bukan per klik), pesanan disimpan per bulan. Untuk 50–1.000 pesanan per hari, akun Gmail biasa sudah cukup; bila usaha makin besar, disarankan Google Workspace.

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Lencana login merah "Server belum terhubung" | `GAS_URL` di `js/config.js` salah / masih XXXX | Tempel URL `/exec` yang benar, push ulang |
| "Server membalas HTTP 404/403 (bukan JSON)" | Deployment bukan *Anyone* atau URL `/dev` | Deploy ulang: Execute as **Me**, Who has access **Anyone**, pakai URL `/exec` |
| Halaman GitHub 404 | `index.html` tidak di root repo / Pages belum aktif | Buka repo di browser: `index.html` harus terlihat langsung. Settings → Pages: `main` / root |
| Tampilan tanpa warna (CSS hilang) | Folder `css`/`js` rata di root | Struktur harus `css/style.css`, `js/*.js` |
| Login: "Email atau kata sandi/PIN salah" | Salah ketik / CapsLock | 5× salah = terkunci 15 menit. Owner lupa sandi → jalankan `resetSandiOwner` |
| Staff lupa PIN | — | Owner: Pengaturan → Pengguna → ⋮ → **Reset PIN** (bisa dikirim ke WA) |
| "Sesi berakhir" | Token kedaluwarsa (12 jam; 30 hari bila "Ingat perangkat") atau akun dikeluarkan | Login ulang |
| Menu terkunci 🔒 untuk staff | Izin modul belum diaktifkan | Owner: Pengaturan → Pengguna → Edit → centang izin |
| "Stok tidak cukup" saat simpan pesanan | Stok di sistem lebih kecil dari timbangan | Catat stok masuk (Restock) atau Stok Opname dulu |
| Data yang diedit langsung di Sheets belum muncul | Aplikasi memakai cache | Sheets & Drive → **Sinkronkan** |
| WA tidak terkirim | Token Fonnte salah / perangkat terputus / saklar mati | Gateway & Kanal: cek kartu perangkat, kirim tes. Lihat Antrean & Log |
| Pengingat & ringkasan tidak jalan | Trigger hilang | Jalankan `pasangTrigger`; cek Sheets & Drive → Trigger "Lengkap" |
| Ganti berkas .docx gagal "butuh Drive API" | Layanan Drive belum ditambahkan | Langkah A4 |
| Gambar logo tidak tampil | Berbagi publik Drive dibatasi admin | Otomatis memakai jalur cadangan; bila tetap gagal, pakai tombol **URL** dengan gambar dari hosting lain |
| "Exceeded maximum execution time" / kuota trigger habis | Kuota harian akun Gmail | Jalankan `matikanKeepWarm`, pertimbangkan Google Workspace |
| Tampilan lama setelah update | Cache browser | Ctrl+Shift+R atau Incognito |

---

## Glosarium

- **Apps Script** — tempat kode server berjalan di Google, gratis.
- **Web App / URL `/exec`** — alamat API backend yang dipanggil aplikasi.
- **Deployment / New version** — menerbitkan versi kode baru tanpa mengganti URL.
- **Trigger** — pekerja latar terjadwal (kirim WA, hitung rekap, backup).
- **Repository (repo)** — folder proyek di GitHub.
- **Commit / Push** — menyimpan perubahan / mengirimnya ke GitHub.
- **Personal Access Token** — "sandi khusus" GitHub untuk terminal.
- **Fonnte** — layanan gateway WhatsApp Indonesia untuk mengirim pesan otomatis.
- **SHA-256** — sidik digital; berubah sedikit saja isinya, sidiknya berbeda — dipakai untuk membuktikan nota/dokumen asli.
- **ESC/POS** — bahasa perintah printer thermal.

---

**Butuh bantuan?** Kelas @khoirulfajarid · khoirulfajar.abughazi@gmail.com
