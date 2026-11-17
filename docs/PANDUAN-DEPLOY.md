# Panduan Deploy — Shokuba Connect di Cloudflare Workers

Panduan ini menjelaskan cara menerbitkan Shokuba Connect ke internet
memakai **Cloudflare Workers**, langkah demi langkah, dari nol sampai
situs bisa dibuka. Ditulis untuk pembaca awam: setiap istilah teknis
dijelaskan saat pertama kali muncul.

Target deploy resmi proyek ini adalah Cloudflare Workers. Aplikasi
dijembatani ke Workers oleh **adaptor OpenNext** (paket
`@opennextjs/cloudflare`), dan perintah-perintah Cloudflare dijalankan
oleh alat bernama **Wrangler** (paket `wrangler`). Kode aplikasi sendiri
tidak berubah untuk deploy — yang berubah hanya lapisan konfigurasi
(`wrangler.jsonc` + adaptor). Karena itu panduan ini kebanyakan berisi
perintah terminal, bukan pengeditan kode.

---

## 1. Gambaran besar

Ada tiga tempat yang perlu dibedakan:

| Tempat | Isi |
|---|---|
| **Komputer Anda** | Folder proyek `shokuba-connect`. Di sini Anda menjalankan perintah build dan deploy. |
| **GitHub** | Tempat menyimpan kode sumber (riwayat perubahan). Deploy TIDAK lewat GitHub — GitHub hanya gudang kode. |
| **Cloudflare Workers** | Server tempat aplikasi berjalan dan bisa diakses publik lewat sebuah alamat web. |

Alur deploy-nya sederhana:

1. Anda menjalankan perintah deploy dari folder proyek di komputer.
2. Adaptor OpenNext mengemas aplikasi menjadi satu **Worker** (nama
   untuk program yang berjalan di Cloudflare).
3. Wrangler mengunggah Worker itu ke akun Cloudflare Anda.
4. Cloudflare menyajikan aplikasi di alamat
   `https://shokuba-connect.<subdomain-anda>.workers.dev`
   (dan di domain kustom bila Anda memasangnya, lihat bagian 7).

Tidak ada database dan tidak ada kunci rahasia milik aplikasi: setiap
operator memakai kunci OpenRouter-nya sendiri lewat gerbang aplikasi
(model BYOK). Jadi tidak ada "secret" aplikasi yang perlu diatur di
Cloudflare — satu-satunya kredensial adalah login akun Cloudflare Anda
sendiri.

---

## 2. Persiapan satu kali

### 2.1 Perangkat lunak di komputer

- **Node.js** sesuai berkas `.nvmrc` proyek (Node 26.x) dan npm 11+.
  Cek dengan `node --version`.
- Folder proyek hasil ekstrak ZIP, lalu pasang semua paket sekali:

```powershell
npm.cmd install
```

(Perintah di panduan ini ditulis untuk Windows/PowerShell dengan
`npm.cmd`. Di Mac/Linux, tulis `npm` saja. Untuk Wrangler, contoh
memakai `npx wrangler ...` agar selalu memakai versi Wrangler yang
terpaku di proyek, bukan versi global.)

### 2.2 Akun Cloudflare

1. Daftar di https://dash.cloudflare.com — gratis.
2. Setelah masuk, Cloudflare akan memberi Anda **subdomain
   workers.dev** (mis. `namaanda.workers.dev`). Alamat publik aplikasi
   akan menjadi `shokuba-connect.namaanda.workers.dev`. Nama ini bisa
   diganti nanti di dashboard; tidak mengikat.

### 2.3 Login Wrangler

Sekali saja per komputer:

```powershell
npx wrangler login
```

Peramban akan terbuka untuk meminta izin; setujui. Cek dengan
`npx wrangler whoami` — harus menampilkan akun Anda.

---

## 3. Variabel lingkungan (hanya dua)

Server hanya membaca dua variabel:

| Variabel | Nilai produksi | Arti |
|---|---|---|
| `LLM_MODE` | `openrouter` | Mode layanan AI. Nilai `mock` hanya untuk pengembangan lokal; build produksi **menolak** mode mock, jadi Worker yang terdeploy tidak akan pernah menyajikan hasil tiruan. |
| `OPENROUTER_MODEL` | id model bawaan di `wrangler.jsonc` | Model cadangan bila sebuah permintaan tidak membawa pilihan model. Nilainya harus salah satu id yang dikenal aplikasi. |

Nilai produksi kedua variabel ini **sudah tertulis** di `wrangler.jsonc`
pada bagian `vars`, jadi deploy pertama tidak perlu mengatur apa pun.
Mengubahnya kelak = mengedit `wrangler.jsonc`, lalu deploy ulang
(bagian 5).

Untuk menjalankan Worker **di komputer sendiri** (pratinjau lokal,
bagian 4), salin `.dev.vars.example` menjadi `.dev.vars` — berkas itu
menimpa `vars` hanya untuk mesin lokal (di dalamnya `LLM_MODE=mock`
untuk pengembangan) dan tidak pernah ikut ter-commit ke GitHub
(sudah masuk `.gitignore`).

> Jangan pernah menulis kunci API OpenRouter siapa pun ke berkas
> proyek atau ke Cloudflare. Aplikasi memang dirancang tanpa kunci
> milik server: kunci selalu datang dari operator lewat gerbang.

---

## 4. Pratinjau lokal di runtime Workers

Sebelum deploy, aplikasi bisa dicoba di runtime yang sama persis
dengan produksi (program bernama **workerd**, mesin Workers di
komputer Anda):

```powershell
npm.cmd run preview:cf
```

Perintah ini membangun Worker (`build:cf`) lalu menjalankannya di
http://localhost:8787. Hentikan dengan Ctrl+C.

Catatan jujur tentang pratinjau lokal:

- Halaman, gerbang, dan semua rute API berjalan penuh.
- Panggilan keluar ke OpenRouter dari workerd lokal bergantung pada
  jaringan komputer Anda; bila jaringan kantor memakai proksi yang
  tidak bersahabat dengan workerd, pemeriksaan kunci bisa menjawab
  "layanan tidak terjangkau" (`llm_failed`) di lokal padahal di
  produksi normal. Itu batas lingkungan lokal, bukan kerusakan
  aplikasi — buktinya: jawaban yang sama dari pemeriksaan kunci
  tampil benar saat rute dipanggil dari Node biasa.
- Uji tuntas mode mock (terjemahan tiruan berhasil, meter tiruan)
  dijalankan lewat server pengembangan Next.js biasa
  (`npm.cmd run dev`), karena build produksi — termasuk build
  Workers — memang menolak mode mock secara desain. Yang dibuktikan
  di pratinjau Workers adalah: halaman tampil, rute menjawab sesuai
  kontrak, throttle verify bekerja, dan penolakan mock di produksi
  benar-benar aktif.

---

## 5. Deploy

Pastikan dulu seluruh pemeriksaan proyek hijau di komputer Anda:

```powershell
npm.cmd run check
```

Lalu satu perintah:

```powershell
npm.cmd run deploy:cf
```

Perintah ini (1) membangun Worker lewat adaptor OpenNext, lalu
(2) mengunggahnya dengan Wrangler. Saat pertama kali, Wrangler
membuat Worker bernama `shokuba-connect` di akun Anda. Di akhir proses
Wrangler mencetak alamat `workers.dev` aplikasi Anda — buka alamat
itu dan jalankan **cek asap pascadeploy** (bagian 6).

Deploy berikutnya (setiap ada perubahan kode atau `wrangler.jsonc`)
cukup mengulang dua perintah di atas. Setiap deploy membuat **versi
Worker baru**; versi lama tidak hilang — ia tersimpan dan bisa
dipulihkan (bagian 8).

### Mengukur ukuran Worker (checkpoint paket gratis)

Paket gratis Workers membatasi ukuran Worker terkompresi **3 MB**.
Ukur dari build terakhir dengan:

```powershell
npx wrangler deploy --dry-run
```

Baris `Total Upload: ... / gzip: ...` adalah angkanya. Pada build
yang terverifikasi saat panduan ini ditulis, ukurannya **1.314,00 KiB
gzip (±1,28 MiB)** — jauh di bawah batas. Aset statis (gambar, berkas
CSS/JS peramban) tidak dihitung dalam batas ini; Cloudflare
menyajikannya gratis tanpa batas jumlah.

---

## 6. Cek asap pascadeploy (wajib, ±3 menit)

1. Buka alamat `workers.dev` aplikasi. Halaman depan Shokuba Connect
   tampil (bukan halaman error Cloudflare).
2. Lencana **mock tidak boleh tampil** di pojok layar. Bila tampil,
   berarti `LLM_MODE` bukan `openrouter` — jangan lanjutkan, periksa
   `vars` di `wrangler.jsonc` lalu deploy ulang.
3. Buka 朝礼コネクト, lewati gerbang dengan kunci OpenRouter Anda
   sendiri, dan jalankan **satu terjemahan nyata** pendek. Hasil
   terjemahan tampil di panel.
4. Meter pemakaian di panel input tampil (angka pemakaian hari ini),
   dan model berbayar mengikuti aturan lantai kredit seperti biasa.
5. Klik セッションを削除 di bilah konteks; aplikasi kembali ke
   gerbang/beranda. Selesai — deploy sehat.

---

## 7. Domain kustom (opsional)

Bila Anda punya domain sendiri yang DNS-nya dikelola Cloudflare:

1. Dashboard Cloudflare → **Workers & Pages** → pilih Worker
   `shokuba-connect` → **Settings** → **Domains & Routes** →
   **Add** → **Custom Domain**.
2. Isi nama domain/subdomain, simpan. Cloudflare mengatur DNS dan
   sertifikat HTTPS secara otomatis; biasanya aktif dalam beberapa
   menit.
3. Aplikasi kini bisa dibuka dari domain itu; alamat `workers.dev`
   tetap aktif juga.

---

## 8. Rollback: memulihkan versi Worker sebelumnya

Setiap deploy tersimpan sebagai versi bernomor di dashboard. Bila
rilis terbaru bermasalah:

**Lewat dashboard:** Workers & Pages → `shokuba-connect` →
**Deployments** → temukan versi sebelumnya yang sehat → menu
titik-tiga → **Rollback**. Produksi langsung kembali ke versi itu.

**Lewat terminal:**

```powershell
npx wrangler deployments list
npx wrangler rollback <VERSION_ID>
```

(isikan id versi dari daftar). Rollback tidak menghapus versi yang
bermasalah — Anda bisa maju lagi ke versi itu kapan pun dengan cara
yang sama, jadi pemulihan ini aman dicoba.

---

## 9. Melihat pemakaian dan log

- **Jumlah pemakaian** (untuk laporan berkala): dashboard Cloudflare →
  Worker `shokuba-connect` → **Metrics**. Angka permintaan (requests)
  adalah bahan pengukuran pemakaian proyek: permintaan ke
  `/api/verify` ≈ sesi yang dimulai, ke `/api/translate` ≈ aksi
  terjemahan, ke `/api/usage` diabaikan (itu panggilan meter).
- **Log langsung** saat menguji: `npx wrangler tail` menampilkan
  keluaran Worker secara waktu-nyata di terminal. Aplikasi ini
  memang tidak mencatat isi teks apa pun, jadi log hanya berisi
  lalu-lintas teknis.

---

## 10. Batas paket gratis — dan kapan paket $5 perlu

Batas paket **gratis** Workers yang relevan untuk aplikasi ini:

| Batas | Paket gratis | Keadaan aplikasi ini |
|---|---|---|
| Permintaan | 100.000 per hari | Jauh di atas kebutuhan (satu sesi朝礼 hanya beberapa permintaan). |
| Ukuran Worker | 3 MB terkompresi (gzip) | Terukur ±1,28 MiB. |
| Waktu CPU | 10 milidetik per permintaan | Sebagian besar waktu aplikasi adalah *menunggu* jawaban OpenRouter (tidak dihitung CPU). Render halaman memakan CPU; untuk aplikasi ini masih dalam batas, tetapi inilah batas yang paling mungkin tersentuh lebih dulu bila halaman makin berat. |
| Memori | 128 MB | Cukup untuk aplikasi ini. |

Gejala batas CPU tersentuh adalah error **1102** (Worker exceeded CPU
time limit) pada sebagian permintaan. Bila itu terjadi — atau
permintaan harian mendekati 100.000, atau ukuran Worker melewati
3 MB — naik ke paket **Workers Paid ($5/bulan)**: batas ukuran naik
ke 10 MB, waktu CPU bawaan naik ke 30 detik per permintaan, dan
termasuk 10 juta permintaan per bulan. Tidak ada perubahan kode atau
konfigurasi untuk naik paket; cukup berlangganan di dashboard, Worker
yang sama langsung memakai batas baru.

---

## 11. Protokol upgrade Next.js (prosedur tetap)

Adaptor OpenNext menjembatani Next.js ke Workers, jadi versi Next.js
tidak boleh naik sembarangan. Versi Next.js dan versi adaptor
**dipatok persis** di `package.json` (tanpa tanda `^`), dan keduanya
hanya berubah lewat prosedur ini. Aturan yang sama berlaku untuk
upgrade besar (mis. 16 → 17) maupun kecil (mis. 16.4 → 16.5).

1. **Periksa matriks dukungan adaptor dulu.** Buka catatan rilis /
   dokumentasi `@opennextjs/cloudflare` dan temukan versi Next.js
   tertinggi yang didukung adaptor versi terbaru. **Jangan pernah
   menaikkan Next.js melampaui yang didukung adaptor.** Bila dukungan
   belum ada: naikkan adaptornya dulu (bila itu membantu) atau tunda
   upgrade Next.js. Memaksakan kombinasi yang tidak didukung adalah
   penyebab utama deploy Workers rusak.
2. **Satu langkah, di cabang terpisah.** Buat cabang khusus
   (mis. `upgrade/next-16.5`) dan naikkan **satu** langkah versi saja
   di sana. Tidak pernah dua loncatan sekaligus, tidak pernah
   langsung di cabang utama.
3. **Jalankan gerbang wajib di cabang itu** (semua harus hijau):
   - `npm.cmd run check` (lint + typecheck + seluruh uji),
   - `npm.cmd run build` (build Next.js biasa),
   - `npm.cmd run build:cf` (build OpenNext),
   - ukur ulang ukuran Worker (`npx wrangler deploy --dry-run`) —
     harus tetap di bawah batas paket yang dipakai,
   - uji asap di pratinjau Workers (`npm.cmd run preview:cf`):
     halaman gerbang dan workspace tampil (200), rute
     verify/translate/usage menjawab sesuai kontrak, throttle verify
     bekerja, jalur error tampil benar, dan mode mock terbukti
     ditolak build produksi.
   
   **Satu saja merah → upgrade ditolak.** Buang cabangnya, produksi
   tidak disentuh, coba lagi lain waktu. Tidak ada "perbaiki sambil
   jalan" di produksi.
4. **`compatibility_date` tidak ikut diubah.** Tanggal di
   `wrangler.jsonc` itu menentukan perilaku runtime Workers; ia hanya
   boleh dimajukan sebagai langkah tersendiri yang disengaja, setelah
   gerbang di atas hijau — tidak pernah sebagai efek samping upgrade.
5. **Gabung dan deploy dari build yang lulus.** Setelah cabang hijau
   dan digabung ke utama, deploy seperti biasa (bagian 5) dan
   jalankan cek asap pascadeploy (bagian 6). Bila ada yang salah,
   rollback (bagian 8) — versi Worker sebelumnya selalu tersedia.

### Target cadangan: Vercel

Kode aplikasi netral platform (tidak memakai API khas Cloudflare),
jadi **Vercel tetap menjadi target cadangan yang terdokumentasi**:
bila suatu hari Workers tidak lagi cocok, aplikasi yang sama bisa
dideploy ke Vercel dari repo yang sama tanpa mengubah kode aplikasi —
cukup impor repo di dashboard Vercel, atur dua variabel lingkungan
yang sama (`LLM_MODE=openrouter` dan `OPENROUTER_MODEL`), dan deploy.
`wrangler.jsonc` dan skrip `*:cf` cukup diabaikan di sana. Target
aktif proyek tetap Cloudflare Workers; bagian ini hanya catatan
jalur keluar.

---

## 12. Pemecahan masalah singkat

| Gejala | Penyebab paling mungkin | Obat |
|---|---|---|
| Lencana mock tampil di situs produksi | `LLM_MODE` di `vars` bukan `openrouter` | Perbaiki `wrangler.jsonc`, deploy ulang. |
| Gerbang menjawab "APIキーが正しくありません" padahal kunci benar | Kunci tertempel dengan spasi, atau kunci sudah dicabut | Tempel ulang kunci dengan bersih; buat kunci baru di OpenRouter bila perlu. |
| Terjemahan menjawab `llm_failed` terus-menerus | OpenRouter sedang gangguan, atau kredit akun habis (jalur 402 tampil sebagai banner kredit di aplikasi) | Cek status OpenRouter dan saldo akun pemilik kunci. |
| Deploy gagal: Worker melebihi batas ukuran | Bundle melewati 3 MB (gratis) | Lihat bagian 10 — naik paket $5 (batas 10 MB) atau periksa apa yang membuat bundle membengkak. |
| Halaman tampil versi lama setelah deploy | Cache peramban | Muat ulang paksa (Ctrl+F5). |
| `wrangler login` gagal / kedaluwarsa | Sesi login berakhir | Jalankan lagi `npx wrangler login`. |
| Error 1102 di sebagian permintaan | Batas CPU paket gratis tersentuh | Naik ke Workers Paid (bagian 10). |

---

*Panduan ini adalah dokumen hidup di repo (`docs/PANDUAN-DEPLOY.md`):
bila langkah Cloudflare berubah, perbarui berkas ini pada commit yang
sama dengan perubahan konfigurasinya.*
