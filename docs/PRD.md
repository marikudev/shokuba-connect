# PRD — 職場コネクト (Shokuba Connect)

| Item | Nilai |
|---|---|
| Produk | 職場コネクト (Shokuba Connect) — satu aplikasi web, dua produk penerjemah untuk tempat kerja Jepang |
| Produk 1 | 朝礼コネクト (Chourei Connect) — penerjemah pengumuman 朝礼 dan instruksi kerja |
| Produk 2 | 面談コネクト (Mendan Connect) — pendamping interpretasi suara dua arah untuk sesi 面談 |
| Bahasa dokumen | Bahasa Indonesia (string UI berbahasa Jepang dikelola di berkas string UI) |
| Status | Spesifikasi rancangan final; sumber kebenaran tunggal untuk pembangunan |

> Dokumen ini adalah satu-satunya sumber kebenaran spesifikasi. Bila kode dan dokumen ini berbeda, kode mengikuti dokumen ini.

## 1. Ringkasan dan posisi produk

職場コネクト (Shokuba Connect) adalah payung bagi dua produk yang melayani satu tujuan: merobohkan tembok bahasa antara staf Jepang dan pekerja asing di tempat kerja, terutama pabrik.

- **朝礼コネクト (Chourei Connect)** menerjemahkan pengumuman 朝礼, instruksi keselamatan kerja, dan instruksi tim pagi dari bahasa Jepang ke tujuh bahasa pekerja, untuk disiapkan sebelum 朝礼 dan ditampilkan saat 朝礼 berlangsung.
- **面談コネクト (Mendan Connect)** mendampingi percakapan dua arah antara staf Jepang dan satu pekerja asing — evaluasi kinerja, konsultasi masalah pribadi, dan pencegahan keluarnya pekerja — lewat suara dan teks. Produk ini adalah **pendamping interpretasi**, bukan pengganti juru bahasa manusia.

Kedua produk hidup dalam **satu aplikasi dan satu repo**, berbagi satu gerbang dan satu kunci API (bagian 4), satu daftar bahasa (bagian 5), dan satu lapisan pemeriksaan (bagian 6.6 dan 8).

Posisi produk:

1. Mutu dan perilaku sekelas produk enterprise: validasi ketat, pemeriksaan deterministik, penanganan error yang jelas, dan pengujian menyeluruh.
2. Kode sumber diterbitkan terbuka (open source) dan aplikasi dapat dipakai tanpa biaya langganan; ketentuan penggunaan ulang mengikuti berkas lisensi di repo.
3. Rilis dilakukan bertahap: 朝礼コネクト dirilis lebih dulu. 面談コネクト diaktifkan hanya setelah 朝礼コネクト rilis.

## 2. Prinsip yang mengikat

| ID | Prinsip |
|---|---|
| P-01 | **Privasi adalah identitas produk.** Aplikasi tidak menyimpan teks, hasil terjemahan, transkrip, atau audio di server — dalam bentuk apa pun, termasuk log. Teks hanya melintasi penyedia AI untuk diterjemahkan, dan data kerja hanya hidup di peramban pengguna. |
| P-02 | **BYOK (Bring Your Own Key).** Setiap operator memakai kunci API OpenRouter miliknya sendiri. Aplikasi tidak memiliki kunci bersama dan tidak menanggung biaya pemakaian operator. |
| P-03 | **Keputusan oleh kode, bukan oleh model.** Model AI hanya menghasilkan terjemahan dan daftar ketidakjelasan. Pemeriksaan yang dapat dilakukan secara deterministik (angka, larangan, bentuk keluaran, glosarium) dilakukan oleh kode. Peringatan hasil pemeriksaan adalah sinyal untuk ditinjau operator, bukan vonis bahwa terjemahan salah. |
| P-04 | **Terjemahan tidak boleh mengarang fakta.** Melengkapi bentuk kalimat agar alami di bahasa tujuan adalah kewajiban; menambahkan angka, nama, waktu, tempat, objek, atau alasan yang tidak ada di sumber adalah pelanggaran. Konteks yang kabur wajib ditandai untuk operator (bagian 6.6). |
| P-05 | **Prompt dijaga ramping.** Setiap token yang ditempel di setiap panggilan — termasuk glosarium — dibayar di setiap permintaan dan memperlambat jawaban. Penjelasan di dalam hasil dibatasi jumlah dan panjangnya karena token keluaran adalah penentu utama waktu tunggu. |
| P-06 | **Satu sumber data untuk hal yang berubah.** Daftar bahasa didefinisikan satu kali di kode. Daftar model AI, kebijakan tiap model, kalimat uji, dan kosakata uji hidup sebagai data/metadata yang dapat diedit; mengganti model atau kalimat uji tidak pernah mengharuskan perubahan logika kode. |
| P-07 | **Harness dipasang bertingkat.** Lapisan pemeriksaan dipasang mulai dari yang terbukti dan deterministik. Tidak ada alur per-kalimat yang menahan atau menerbitkan kalimat satu per satu di 朝礼コネクト, dan tidak ada terjemahan balik sebagai gerbang penayangan. |
| P-08 | **Nama model AI tidak ditulis di dokumen ini.** Model berganti secara berkala; dokumen ini hanya mengenal "model AI berbayar" dan "model AI gratis". Nama model yang sedang dipakai dicatat di README repo (bagian 13). |

## 3. Struktur aplikasi

Satu aplikasi web (satu deployment) dengan tiga area:

| Area | Isi |
|---|---|
| Beranda 職場コネクト | Pengenalan payung produk dan pintu masuk ke kedua produk: penjelasan tiap produk, cara kerja, dan tombol mulai menuju gerbang bersama. |
| 朝礼コネクト | Produk 1 (bagian 6). Aktif sejak rilis pertama. |
| 面談コネクト | Produk 2 (bagian 7). Ditampilkan sebagai produk yang akan datang sampai fase rilisnya; rute dan UI-nya diaktifkan pada fase rilis 面談コネクト. |

Navigasi antarproduk tidak mengakhiri sesi: gerbang dan kunci yang sama berlaku untuk kedua produk, dan operator tidak memasukkan kunci dua kali.

## 4. Gerbang dan sesi bersama

| ID | Persyaratan |
|---|---|
| GC-01 | Sebelum memakai produk mana pun, operator memasukkan kunci API OpenRouter miliknya sendiri di gerbang. Gerbang memuat: panduan singkat memperoleh kunci beserta tautan ke halaman kunci OpenRouter, panduan penanganan kunci, penjelasan penanganan data (P-01), dan kotak persetujuan yang wajib dicentang sebelum tombol mulai aktif. Kolom kunci punya tombol tampil/sembunyikan. |
| GC-02 | Kunci diperiksa satu kali ke endpoint kunci OpenRouter (pemeriksaan ini tidak mengurangi kredit). Kunci sah membuka sesi; kunci salah menampilkan pesan kesalahan yang sama dan tidak membuka aplikasi. Pemeriksaan dibatasi rem percobaan: 20 kegagalan dalam 15 menit memicu blokir 5 menit per alamat IP. |
| GC-03 | Kunci yang sah disimpan sebagai cookie httpOnly (SameSite=Strict, Secure pada HTTPS) berisi kunci itu sendiri. Server tidak menyimpan kunci di tempat lain dan tidak pernah menuliskannya ke log atau respons. Sesi berlaku 24 jam; pengingat tampil pada 60 menit terakhir. Kunci tersimpan membuat operator tidak perlu menempel ulang; tab baru hanya memerlukan persetujuan ulang. |
| GC-04 | Tombol 「セッションを削除」 menghapus cookie kunci, seluruh kartu dan draf di peramban, serta status persetujuan, lalu mengembalikan aplikasi ke gerbang. Penghapusan ini disengaja untuk PC bersama: tidak ada sisa data kerja operator sebelumnya. |
| GC-05 | **Meter pemakaian** selalu terlihat di bilah konteks kedua produk. Meter membaca angka nyata akun operator dari endpoint kunci OpenRouter dan menampilkan pemakaian hari ini dalam USD dan JPY (kurs tetap ¥150/$). Bila kunci operator memiliki batas belanja, meter menampilkan sisa jatah kunci itu — berlabel キー残枠 agar tidak terbaca sebagai saldo akun — dalam USD dan JPY; bila sisa habis, tombol terjemah nonaktif dengan pesan yang jelas. Respons endpoint kunci juga membawa `is_free_tier` (apakah akun pernah membeli kredit); bila nilainya true, meter tidak menampilkan sisa jatah sebagai kredit yang bisa dibelanjakan. Bila model gratis yang aktif, meter menampilkan hitungan permintaan harian model gratis (sisa/batas). Bila data tidak tersedia, meter disembunyikan tanpa error. |
| GC-06 | **Lantai kredit $1 dan sisa yang terverifikasi.** Model AI berbayar hanya boleh dipakai selama sisa kredit operator yang *terverifikasi* berada di atas $1, agar saldo tidak pernah menjadi negatif. Sisa terverifikasi didefinisikan berlapis: (1) akun yang belum pernah membeli kredit (`is_free_tier` true pada endpoint kunci) terbukti bersaldo berbayar $0 — model berbayar dinonaktifkan di pemilih dan ditolak di jalur terjemahan dengan pemeriksaan ulang sisi server, berapapun batas kuncinya, sementara model gratis tetap tersedia; (2) untuk akun yang pernah membeli kredit dengan kunci berbatas, sisa = `limit_remaining` dan lantai $1 ditegakkan padanya; kunci tanpa batas tidak menampilkan angka sisa yang dikarang — meter hanya menampilkan pemakaian, dan panduan gerbang menyarankan operator memasang batas kunci sebagai pagu anggaran; (3) bila panggilan berbayar tetap dikembalikan 402, model berbayar dikunci untuk sisa sesi itu. Pada setiap lapisan, aplikasi menampilkan pemberitahuan yang mengarahkan operator untuk menambah kredit atau beralih ke model AI gratis. Saldo akun yang sebenarnya tidak dapat dibaca dengan kunci API biasa (endpoint kredit mensyaratkan kunci manajemen, yang tidak pernah diminta aplikasi), sehingga aturan ini ditegakkan pada sinyal terkuat yang dapat diverifikasi dari endpoint kunci (GC-05). |
| GC-07 | Pengunjung yang belum menyimpan kunci melihat beranda (bagian 3) sebelum gerbang; operator dengan kunci tersimpan langsung menuju gerbang/aplikasi. |

## 5. Bahasa dan model AI

### 5.1 Bahasa

Bahasa sumber adalah bahasa Jepang. Bahasa target ada tujuh, didefinisikan satu kali di `lib/languages.ts` dan dipakai oleh UI, validasi server, prompt, dan glosarium:

| Kode | Nama untuk model | Nama tampil di panel | Nama di UI Jepang | Tag suara (BCP-47) |
|---|---|---|---|---|
| id | Indonesian | Bahasa Indonesia | インドネシア語 | id-ID |
| my | Burmese (Myanmar) | မြန်မာဘာသာ | ミャンマー語 | my-MM |
| pt | Brazilian Portuguese | Português | ポルトガル語 | pt-BR |
| en | American English | English | 英語 | en-US |
| vi | Vietnamese | Tiếng Việt | ベトナム語 | vi-VN |
| fil | Filipino | Filipino | タガログ語 | fil-PH |
| zh | Simplified Chinese | 中文 | 中国語 | zh-CN |

Di dalam prose berbahasa Indonesia, bahasa `fil` disebut Tagalog, bahasa `my` disebut Burma, dan bahasa `zh` adalah Mandarin Sederhana.

### 5.2 Model AI

| ID | Persyaratan |
|---|---|
| GC-08 | Aplikasi menawarkan pilihan model AI berbayar dan satu model AI gratis melalui OpenRouter. Semua panggilan model berjalan lewat satu abstraksi klien LLM di server; tidak ada panggilan model dari peramban. |
| GC-09 | Pemilih model adalah daftar pilihan kaya (listbox) yang menampilkan nama ramah model, lencana berbayar/gratis, dan catatan harga relatif bila ada. Pemilih **mulai tanpa pilihan**: tombol terjemah nonaktif sampai operator memilih model. Model bawaan hanya berlaku sebagai cadangan server bila permintaan datang tanpa pilihan model. |
| GC-10 | Perilaku tiap model digerakkan oleh metadata model (satu sumber data, P-06): status berbayar/gratis, kebijakan pengumpulan data, daftar bahasa yang tidak didukung, dan kebijakan reasoning. Model yang tidak dikenal metadata-nya diperlakukan dengan kebijakan paling ketat. |
| GC-11 | **Kebijakan data per model.** Untuk model berbayar, setiap permintaan mengirim penolakan pengumpulan data (`provider.data_collection: "deny"`). Untuk model gratis, parameter itu tidak dikirim (endpoint model gratis menolaknya); sebagai gantinya, selama model gratis aktif, strip peringatan penggunaan model gratis selalu terlihat di layar utama, dan catatan gerbang menyebut pengecualian ini. |
| GC-12 | **Bahasa yang tidak didukung per model.** Metadata model gratis menyatakan bahasa yang tidak didukungnya: Burma dan Tagalog. Pemblokiran ditegakkan di empat lapis: opsi bahasa nonaktif di dropdown, panel yang memilihnya menampilkan pemberitahuan pemblokiran menggantikan area hasil, klien menyaringnya dari permintaan, dan server menolak permintaan yang tetap memuatnya. Hasil lama dari model lain tetap boleh ditampilkan. |
| GC-13 | **Reasoning.** Bila reasoning model dapat dimatikan, reasoning dikirim dalam keadaan mati. Bila model masa depan tidak dapat mematikan reasoning sepenuhnya, metadata model menyetelnya ke tingkat rendah atau memberi batas token reasoning; reasoning tidak pernah dibiarkan pada bawaan penuh. |
| GC-14 | Semua model menerima system prompt yang sama persis. Tidak ada tambahan prompt per model. |

## 6. 朝礼コネクト (Chourei Connect)

### 6.1 Alur pemakaian

1. Operator lolos gerbang (bagian 4).
2. Operator memilih 業種 (wajib; hanya 自動車 yang aktif, pilihan lain tampil sebagai 準備中 dan tidak dapat dipilih), mengisi 部署 (maks. 50 karakter) dan 話題 (maks. 100 karakter) — keduanya wajib sebelum menerjemahkan, agar model selalu menerima konteks — lalu mengetik teks Jepang (maks. 300 karakter).
3. Operator memilih model (GC-09), jumlah panel 1–4, dan bahasa tiap panel.
4. Operator menekan 翻訳する: satu permintaan untuk semua bahasa yang sedang tampil.
5. Operator meninjau hasil dan daftar 確認が必要な点, memperbaiki input bila perlu, lalu menyimpan ke kartu, menyalin, atau menampilkannya layar penuh saat 朝礼.

Menyimpan kartu tidak digerbang oleh kewajiban konteks atau model; yang digerbang hanya aksi terjemah.

### 6.2 Bilah konteks dan kolom input

| ID | Persyaratan |
|---|---|
| CHO-01 | Bilah konteks memuat: pemilih 業種， kolom 部署, kolom 話題, pemilih jumlah panel, tombol sembunyi/tampil kolom input (CHO-12), meter pemakaian (GC-05), pengingat sisa sesi, dan tombol hapus sesi (GC-04). |
| CHO-02 | Kolom input memuat: pemilih model, kolom teks sumber berlabel tetap 日本語 dengan penghitung karakter per code point, teks bantu tetap 「個人情報・社内機密は入力しないでください」, tombol 翻訳する, dan tombol 保存・編集. Di atas tombol terjemah tampil kalimat larangan memasukkan data pribadi dan rahasia perusahaan, dan kalimat yang sama tampil berwarna merah di dalam kotak persetujuan gerbang. |
| CHO-03 | Tombol 翻訳する nonaktif bila: teks kosong atau melewati 300 karakter, 業種/部署/話題 belum terisi, model belum dipilih, atau model berbayar terblokir oleh salah satu lapisan GC-06 (akun belum pernah membeli kredit, sisa jatah kunci mencapai lantai $1, atau kunci sesi pasca-402). Teks tidak pernah dipotong otomatis. |
| CHO-04 | Selama permintaan berjalan tampil status 「翻訳中…」 dan tombol batal; klik ganda dicegah; hasil dari permintaan lama yang inputnya sudah berubah dibuang. Tidak ada percobaan ulang otomatis. |

### 6.3 Panel terjemahan

| ID | Persyaratan |
|---|---|
| CHO-05 | Jumlah panel dapat dipilih 1 sampai 4; bawaan saat sesi baru adalah 2. Pada 4 panel, panel tersusun sebagai grid 2×2; pada jumlah lain panel bertumpuk vertikal. Mengurangi jumlah panel hanya menyembunyikan panel; hasil panel tersembunyi tidak hilang. |
| CHO-06 | Tiap panel punya dropdown berisi opsi awal 言語を選択 (belum memilih) ditambah tujuh bahasa; bahasa yang sedang dipakai panel lain yang tampil nonaktif di dropdown ini. Panel yang belum dipilih bahasanya tidak pernah diterjemahkan. |
| CHO-07 | Mengganti bahasa di dropdown tidak pernah memanggil API secara otomatis. Bila bahasa baru belum punya hasil untuk input saat ini, panel menampilkan 未翻訳 dan tombol untuk menerjemahkan bahasa itu saja (satu permintaan baru untuk satu bahasa itu). Bahasa yang gagal dalam suatu respons ditandai gagal dan dapat diulang sendiri lewat tombol 再試行 pada panelnya. |
| CHO-08 | Tiap panel memuat: tombol Salin (teks hasil saja, dengan pesan jelas bila izin clipboard ditolak), tombol layar penuh (Fullscreen API pada kontainer panel; teks besar berkontras tinggi dengan font yang benar per bahasa; tombol disembunyikan bila perangkat tidak mendukung layar penuh), dan tombol ukuran font per panel (A+ sampai maksimal 2rem). |
| CHO-09 | **Hemat biaya (hasil tidak diterjemahkan ulang).** Bila input (teks, 部署， 話題） tidak berubah dan semua bahasa terpilih yang tampil sudah punya hasil untuk input itu **dari model yang sedang dipilih**, tombol 翻訳する tampil sebagai 「翻訳済み」 dan nonaktif: tidak ada panggilan model. Mengganti model mempersenjatai ulang tombol 翻訳する agar operator dapat menerjemahkan ulang dengan model baru. Aturan yang sama berlaku untuk kartu: kartu yang sudah diterjemahkan tidak diterjemahkan ulang selama sumber dan modelnya tidak berubah. |

### 6.4 Kartu persiapan

| ID | Persyaratan |
|---|---|
| CHO-10 | Tersedia 20 slot kartu. Kartu tersimpan di `localStorage` peramban dan tersinkron langsung antar-tab; draf input, pilihan panel, keadaan kolom input, dan status persetujuan hidup di `sessionStorage`. Kartu selamat dari penutupan tab dan dari berakhirnya sesi 24 jam; hapus sesi (GC-04) menghapus kartu juga. |
| CHO-11 | Tombol 保存・編集 membuka dialog penyimpanan: judul kartu **wajib** (maks. 20 karakter); memilih slot yang sudah terisi meminta konfirmasi timpa; ada tombol kosongkan slot. Dialog hanya membawa hasil dari panel yang sedang tampil. Klik kartu memuat teks, 部署， 話題, dan seluruh hasil tersimpannya **tanpa memanggil API**, lalu mengatur jumlah panel dan dropdown panel mengikuti bahasa yang punya hasil pada kartu itu. |
| CHO-12 | Status kartu diturunkan hanya dari data tersimpan kartu itu sendiri, ditandai ikon **dan** teks: ○ 空 (slot kosong), ● 保存済み（未翻訳） (tersimpan, belum punya hasil), ✓ 翻訳済み (punya hasil dan sumber tersimpan sama persis dengan sumber yang menghasilkan hasil itu), ⚠ 要再翻訳 (punya hasil tetapi sumber tersimpan tidak lagi sama dengan sumber hasil itu). Status tidak pernah ditandai hanya dengan warna. |
| CHO-13 | **Mode tampil.** Kolom input dapat disembunyikan lewat tombol di bilah konteks. Saat tersembunyi, yang tersisa di samping panel hanyalah **rel kartu selebar ±64px** berisi nomor slot 01–20 beserta ikon statusnya; klik nomor memuat kartu itu. Keadaan sembunyi/tampil tersimpan di draf sesi. Strip peringatan model gratis dan kotak 確認が必要な点 tetap terlihat pada mode tampil. |
| CHO-14 | Kartu dapat **diekspor ke berkas JSON dan diimpor kembali dari JSON** sebagai cadangan dan untuk berpindah perangkat. Kartu juga dapat **diekspor ke PDF** untuk dibagikan atau dicetak; PDF bersifat satu arah (tidak ada impor dari PDF). |

### 6.5 Kontrak terjemahan

| ID | Persyaratan |
|---|---|
| CHO-15 | Satu klik 翻訳する mengirim **satu** permintaan ke server berisi teks, 部署， 話題， pilihan model, dan 1–4 bahasa unik yang sedang tampil. Server memanggil model satu kali dan menerima **satu objek JSON** berisi terjemahan per kode bahasa dan daftar ketidakjelasan (bagian 6.6); tidak ada panggilan terpisah per bahasa dan tidak ada panggilan paralel per bahasa. |
| CHO-16 | Aturan terjemahan (system prompt, sama untuk semua model — GC-14): bahasa sederhana yang dipahami peserta pelatihan dan pekerja asing tanpa menyederhanakan atau membuang isi; istilah teknis benar menurut konteks 業種・部署・話題； angka, waktu, tanggal, jumlah, larangan, syarat, peringatan, dan urutan langkah tetap identik; tidak ada tambahan penjelasan, saran, sapaan, atau peringatan di luar sumber (kecuali penjelasan istilah pada CHO-18); setiap terjemahan adalah kalimat lengkap yang alami di bahasa tujuan (P-04). |
| CHO-17 | Data pengguna (teks, 部署， 話題） hanya masuk sebagai data di pesan pengguna di dalam pembatas, tidak pernah ke system prompt, dan disanitasi sebelum disisipkan (karakter kontrol dibuang, `<` dan `>` diganti padanan lebar penuh). Instruksi apa pun di dalam data diperlakukan sebagai teks yang diterjemahkan, bukan perintah. |
| CHO-18 | **Istilah tanpa padanan.** Bila istilah teknis Jepang tidak ada di glosarium dan bahasa tujuan tidak punya padanan baku, model menulis istilah Jepang itu diikuti penjelasan sangat singkat dalam tanda kurung tentang apa itu / fungsinya / di mana atau kapan dipakai (untuk jargon ditambah contoh sangat singkat), maksimal 10 kata — untuk Burma dan Mandarin maksimal 90 code point. Penjelasan hanya pada kemunculan pertama; kemunculan berikutnya cukup istilah Jepangnya. Bila model tidak yakin, istilah diterjemahkan seliteral mungkin dan dimasukkan ke daftar ketidakjelasan. Penjelasan istilah di luar glosarium dibuat oleh model dan dapat keliru; satu-satunya jaminan untuk istilah tertentu adalah entri glosarium berstatus `verified` (bagian 8). |
| CHO-19 | Keluaran model divalidasi sebelum dipakai: objek JSON pertama diambil (pagar kode dibuang); tiap bahasa yang diminta harus string tidak kosong maksimal 3.000 karakter; daftar ketidakjelasan maksimal 5 entri, masing-masing maksimal 200 karakter; kunci selain bahasa yang diminta dibuang. Bahasa yang kuncinya hilang atau tidak valid ditandai gagal secara individual; JSON yang tidak dapat diparsing menandai semua bahasa gagal. Kegagalan satu bahasa tidak merusak bahasa lain. |

### 6.6 Pemeriksaan deterministik dan daftar ketidakjelasan

| ID | Persyaratan |
|---|---|
| CHO-20 | **Pemeriksaan angka (kode).** Digit dinormalkan (angka lebar penuh dan digit Burma ke ASCII; pemisah ribuan/desimal di antara angka dihapus; angka kanji sederhana dibaca nilainya; format jam tidak ditandai palsu), lalu multiset digit sumber dan hasil dibandingkan. Ketidakcocokan menampilkan peringatan 「数字が原文と一致しない可能性があります」 pada panel terkait. Pemeriksaan hanya memperingatkan; tidak pernah menyatakan hasil benar. |
| CHO-21 | **Pemeriksaan larangan (kode), dua arah.** Sisi sumber: sumber ditandai bila memuat ungkapan larangan (mis. 禁止, てはいけません, てはならない, ないでください, ないこと, 厳禁, 不可）. Sisi hasil: tiap bahasa punya daftar penanda larangan berpresisi tinggi; bila sumber berlarangan tetapi hasil suatu bahasa tidak memuat penandanya, panel bahasa itu menampilkan peringatan bahwa larangan mungkin tidak tersampaikan. Daftar penanda Tagalog, Mandarin, dan Burma berstatus minimal dan wajib divalidasi penutur asli; peringatan tetap sinyal kecurigaan untuk operator, bukan vonis. |
| CHO-22 | **Daftar 確認が必要な点.** Daftar ketidakjelasan dari model tampil sebagai kotak mencolok (bingkai merah 2px, latar merah muda, teks merah tua) **di atas panel, sejajar baris pemilih model**, agar staf Jepang memperbaikinya lebih dulu sebelum hasil dibaca pekerja. Kotak tampil hanya bila daftar tidak kosong. |
| CHO-23 | **Penjaga bahasa daftar ketidakjelasan (kode).** Setiap entri wajib berbahasa Jepang karena hanya dibaca operator Jepang. Kode memeriksa tiap entri dengan heuristik kana: entri tanpa hiragana/katakana dianggap berbahasa asing dan **diganti** (tidak pernah ditampilkan, tidak pernah dibuang diam-diam) dengan kalimat fallback berbahasa Jepang yang mempertahankan frasa sumber yang dikutip model di dalam entri itu; bila tidak ada frasa yang dikutip, dipakai fallback generik. Duplikat fallback disatukan. |
| CHO-24 | Isi daftar ketidakjelasan mengikuti aturan prompt: entri mengutip frasa sumber persis seperti tertulis, menyatakan dalam bahasa Jepang bagaimana model menafsirkannya dan apa persisnya yang harus dipastikan atau dilengkapi operator (objek, bagian, atau cakupan yang dimaksud). Daftar boleh kosong hanya bila tidak ada yang kabur di sumber. |

### 6.7 Baca lantang (TTS)

| ID | Persyaratan |
|---|---|
| CHO-25 | Tiap panel hasil punya tombol 読み上げ yang membacakan terjemahan panel itu dengan **suara bawaan peramban** (Web Speech API, sepenuhnya sisi klien: tanpa panggilan server, tanpa kunci tambahan, tanpa biaya). Tombol hanya tampil bila perangkat memiliki suara untuk bahasa panel itu; bahasa tanpa suara di perangkat itu tidak mendapat tombol sama sekali. Microsoft Edge adalah peramban baku di PC pabrik karena membawa suara Burma daring yang tidak terpasang di Windows. |
| CHO-26 | Teks diucapkan per kalimat (termasuk penutup kalimat Burma "။"). Hanya satu panel bersuara pada satu waktu; menekan tombol panel yang sedang bersuara menghentikannya; hasil yang diganti atau panel yang ditutup menghentikan ucapannya. Tombol tetap tersedia dalam tampilan layar penuh panel. Teks tetap sumber kebenaran untuk angka dan larangan; audio hanya pelengkap. |

### 6.8 Tingkat harness 朝礼コネクト

| Tingkat | Isi |
|---|---|
| Tingkat 1 (rilis pertama) | Seluruh perilaku terbukti pada bagian 6.1–6.7: kontrak JSON satu panggilan, pemeriksaan angka dan larangan oleh kode, penjaga bahasa daftar ketidakjelasan, pencocokan dan pemeriksaan glosarium 安全衛生 (bagian 8). |
| Tingkat 2 (bertahap setelah rilis pertama, tiap butir lewat persetujuan pemilik produk) | Sinyal bantuan model tambahan — misalnya penajaman deteksi kekaburan konteks — yang masuk ke permukaan operator yang sama (kotak 確認が必要な点 dan peringatan panel). Tingkat 2 tidak mengubah alur dasar: satu panggilan per klik, tanpa penahanan per kalimat, tanpa terjemahan balik sebagai gerbang, tanpa pencatatan isi (P-01, P-07). |

## 7. 面談コネクト (Mendan Connect)

### 7.1 Tujuan dan prinsip pengatur

面談コネクト mendampingi sesi 面談 antara staf Jepang dan satu pekerja asing: evaluasi kinerja, konsultasi masalah pribadi, dan pembicaraan untuk mencegah pekerja keluar. Satu sesi melayani satu bahasa pekerja yang dipilih dari tujuh bahasa (bagian 5.1) dan dikunci selama sesi berjalan.

| ID | Prinsip |
|---|---|
| MND-P1 | **Persetujuan kedua pihak sebelum sesi.** Sesi hanya dimulai setelah kedua pihak menyetujui pemberitahuan dalam bahasa masing-masing, yang menyatakan: percakapan diterjemahkan oleh AI; audio diproses oleh layanan peramban/Microsoft untuk pengenalan suara; dan aplikasi tidak merekam serta tidak menyimpan apa pun (P-01). |
| MND-P2 | **Saran eskalasi ke juru bahasa manusia tampil sebagai peringatan sistem.** Bila konteks menyentuh keputusan formal — evaluasi kinerja yang berdampak pada kontrak, teguran, atau pemutusan hubungan kerja — sistem menampilkan peringatan bergaya 確認が必要な点 yang menyarankan kedua pihak memastikan hal itu dengan juru bahasa manusia, karena hal tersebut sensitif dan tidak boleh keliru. Mekanismenya adalah peringatan, bukan tombol panggilan. |
| MND-P3 | **Bingkai produk adalah pendamping interpretasi.** Teks antarmuka dan pemberitahuan tidak pernah menyatakan produk ini menggantikan juru bahasa manusia, terutama untuk urusan formal. |

### 7.2 Tata letak

| ID | Persyaratan |
|---|---|
| MND-01 | Halaman sesi memakai bilah konteks bersama (bagian 4 dan 6.2): 部署， 話題， pemilih model, meter pemakaian — ditambah **info sesi**: bahasa pekerja yang terkunci dan tombol akhiri sesi. |
| MND-02 | Di bawah bilah konteks terdapat **strip status khusus**: zona untuk tanda ketidakjelasan, pertanyaan klarifikasi, konfirmasi bacaan hasil tangkapan suara, pemberitahuan giliran yang tertahan, dan peringatan keputusan formal (MND-P2). Strip memakai warna dan ikon yang jelas berbeda dari elemen lain dan tampil dalam **kedua bahasa** (Jepang dan bahasa pekerja). |
| MND-03 | Di bawah strip status terdapat **dua kolom arah yang cermin**: kolom kiri untuk arah Jepang → bahasa pekerja, kolom kanan untuk arah bahasa pekerja → Jepang. Tiap kolom memuat **panel keluaran di atas** dan **panel masukan di bawah**, dengan proporsi tinggi keluaran : masukan sekitar 60 : 40. |
| MND-04 | Tiap sisi punya tiga tombol: label bahasa sumber (penanda tetap, bukan pengalih), tombol masukan suara (target sentuh terbesar di sisi itu), dan tombol 翻訳. Label bahasa kedua sisi adalah penanda tetap yang mengikuti bahasa sesi; bahasa tidak dapat diganti di tengah sesi. |
| MND-05 | Panel keluaran menampilkan **transkrip kronologis** sesi (giliran demi giliran, bukan hanya giliran terakhir). Tiap keluaran punya tombol baca lantang sendiri (MND-09), dan tersedia pilihan baca otomatis untuk keluaran baru. |
| MND-06 | Pemilih model **terkunci selama sesi aktif**; mengganti model hanya dapat dilakukan di luar sesi. |

### 7.3 Alur sesi dan giliran

| ID | Persyaratan |
|---|---|
| MND-07 | Memulai sesi: operator memilih bahasa pekerja, kedua pihak membaca dan menyetujui pemberitahuan (MND-P1), lalu sesi dimulai. Mengakhiri sesi lewat tombol akhiri sesi di bilah konteks; transkrip sesi tidak disimpan oleh aplikasi setelah sesi berakhir (P-01). |
| MND-08 | Satu giliran berjalan begini: penutur berbicara lewat tombol masukan suara → hasil tangkapan tampil sebagai pratinjau di panel masukan sisi itu (hasil tangkapan **parsial tidak pernah diterjemahkan dan tidak pernah dibacakan sebagai hasil final**) → penutur/operator menekan 翻訳 → hanya ucapan final yang diterjemahkan dalam satu panggilan model → terjemahan tampil di panel keluaran arah sebaliknya dan dibacakan bila baca otomatis aktif atau tombol bacanya ditekan. Panel masukan dengan demikian merangkap permukaan pratinjau dan konfirmasi bacaan: pemberitahuan konfirmasi dan ketidakjelasan yang menyangkut giliran itu tampil di strip status (MND-02). |
| MND-09 | **Pengucapan (TTS)** memakai suara bawaan peramban lewat Microsoft Edge, diuji untuk ketujuh bahasa pekerja dan bahasa Jepang. Bila perangkat tidak memiliki suara untuk suatu bahasa, tombol baca untuk bahasa itu tidak tampil dan sesi tetap berjalan sebagai teks. |
| MND-10 | **Pengenalan suara (ASR)** memakai pengenalan suara bawaan Microsoft Edge (Web Speech API) sebagai penyedia bawaan: tanpa kunci API dan tanpa biaya. Karena implementasi Edge memproses audio lewat layanan cloud Microsoft, fakta ini dinyatakan di dalam pemberitahuan persetujuan (MND-P1). Penyedia ASR berada di belakang abstraksi penyedia yang dapat dikonfigurasi, setara pola abstraksi klien LLM (GC-08). Opsi cadangan yang tercatat untuk masa depan — di luar cakupan rilis pertama 面談コネクト — adalah layanan ucapan awan tingkat gratis dan pengenalan Whisper yang berjalan di perangkat. |
| MND-11 | Aturan terjemahan giliran sama dengan 朝礼コネクト: kalimat lengkap yang alami, tanpa mengarang fakta (P-04), ketidakjelasan ditandai dan ditampilkan di strip status dalam kedua bahasa, dan pemeriksaan angka serta larangan oleh kode berlaku untuk teks giliran (CHO-20, CHO-21). |
| MND-12 | Bila pengenalan suara atau panggilan model gagal, sistem menampilkan kegagalan secara jelas di strip status, menahan giliran itu, dan tidak membacakan terjemahan parsial. Bila penutur berbicara saat pembacaan lantang berjalan, pembacaan berhenti dan giliran baru mulai ditangkap. |
| MND-13 | Sebelum 面談コネクト dirilis, akurasi pengenalan suara untuk bahasa Burma wajib diuji di PC pabrik, sebagaimana suara bacanya telah diuji. 面談コネクト juga mematuhi lantai kredit (GC-06) dan seluruh aturan gerbang bersama (bagian 4). |

## 8. Glosarium 安全衛生

Satu-satunya glosarium dalam sistem adalah glosarium 安全衛生 (keselamatan dan kesehatan kerja), tersimpan sebagai data di `data/glossary/anzen.json`.

| ID | Persyaratan |
|---|---|
| GLO-01 | Berkas produksi `anzen.json` terbit **kosong** (`"terms": []`). Entri ditambahkan hanya dari terjemahan yang telah diverifikasi penerjemah atau penutur asli untuk istilah keselamatan yang kritis. Tidak ada glosarium untuk kosakata umum atau istilah teknis di luar 安全衛生； istilah di luar glosarium ditangani model menurut aturan CHO-18. |
| GLO-02 | Skema entri: `ja` (istilah Jepang, unik, wajib), `reading` (bacaan kana, tidak dikirim), `domain` (label pengelompokan, tidak dikirim), `style` (`term` atau `explain`, wajib), `meaning` (penjelas konteks berbahasa Inggris; wajib untuk entri `verified`; dikirim untuk semua entri terpilih), `note` (catatan pengembang; **tidak pernah** dikirim ke prompt atau permintaan API — ada uji otomatis yang membuktikannya), kolom padanan per bahasa target (boleh kosong), dan `status` (`draft` atau `verified`). Validasi skema menolak kunci tak dikenal, `ja` duplikat, dan entri `verified` tanpa `meaning` atau tanpa satu pun padanan. |
| GLO-03 | Hanya entri `verified` yang dipakai, dan hanya kolom bahasa target yang terisi. Entri terpilih bila istilahnya muncul di teks input (sesudah normalisasi NFKC) atau di konteks; urutan penyisipan dari istilah terpanjang. Anggaran per permintaan: maksimal 30 entri dan 2.500 karakter teks glosarium; entri yang tidak muat dilewati, dihitung, dan dilaporkan ke UI sebagai pemberitahuan bahwa sebagian glosarium tidak diterapkan. |
| GLO-04 | Format baris prompt: entri `term` dikirim sebagai padanan wajib per bahasa; entri `explain` dikirim sebagai teks akhir berbentuk `{istilah Jepang} ({penjelasan singkat})` dan dipakai pada kemunculan pertama. Untuk entri `explain`, penjelasan dibatasi maksimal 10 kata untuk id, pt, en, vi, fil dan maksimal 90 code point untuk my dan zh. Prinsip isi penjelasan: jelaskan fungsi atau karakteristiknya; untuk benda, di mana/kapan/untuk apa dipakai; untuk istilah khusus, beri contoh sangat singkat. |
| GLO-05 | Glosarium dimuat dan divalidasi di server; isinya tidak dikirim ke klien. Aplikasi tetap berjalan penuh dengan glosarium kosong. |

## 9. Kontrak API

Semua rute berjalan di runtime Node.js. Respons error tidak pernah memuat teks input. Taksonomi error tunggal: `invalid_input` (400), `unauthorized` (401), `credits_or_quota` (402), `too_large` (413), metode salah (405), `rate_limited` (429, meneruskan `Retry-After` bila ada), `llm_failed` (502), `timeout` (504).

| Rute | Kontrak |
|---|---|
| `POST /api/verify` | Body `{ "apiKey": string }`. Server memeriksa kunci satu kali ke `GET https://openrouter.ai/api/v1/key` (tanpa biaya kredit): sah → 204 + cookie sesi (GC-03); salah → 401 yang selalu sama. Tanpa `apiKey` (atau `GET`): jalur lanjut sesi — 204 bila cookie kunci yang masuk akal ada, 401 bila tidak. Tunduk pada rem percobaan GC-02. |
| `GET /api/usage` | Kunci operator dari cookie (atau header `x-api-key` untuk skrip evaluasi/pengujian). Server memanggil endpoint kunci OpenRouter **dengan kunci operator itu** dan mengembalikan angka pemakaian hari ini, batas dan sisa bila kunci berbatas, serta hitungan permintaan harian model gratis. Bila data tidak ada atau panggilan gagal: `{ "unavailable": true }`. |
| `POST /api/translate` | Autentikasi cookie kunci (atau header `x-api-key`); `content-type: application/json`; body maksimal 4 KB. Body: `{ "text": string, "division": string, "topic": string, "langs": kode[], "model": id? }`. Validasi server (SEC-03): teks 1–300 code point dan mengandung huruf Jepang; 部署 maks. 50; 話題 maks. 100; `langs` unik, hanya kode di `lib/languages.ts`, 1–4 elemen; `model`, bila ada, harus model yang dikenal metadata (GC-10). Kunci operator dipakai hanya untuk permintaan ini. Respons 200: `{ "results": { per bahasa: { "ok", "text"?, "numberMismatch"?, "prohibitionMissing"?, "error"? } }, "uncertain": string[], "sourceFlags": { "prohibition": boolean }, "glossarySkipped": number }`. |
| `POST /api/logout` | Menghapus cookie sesi. |

Pemanggilan model di balik `/api/translate`: satu permintaan per panggilan rute, tanpa percobaan ulang otomatis; badan permintaan memuat model pilihan operator (atau bawaan server), pesan system lalu user, `temperature` 0,1, batas token keluaran, dan format respons JSON object; parameter kebijakan penyedia dan reasoning ditambahkan hanya sesuai metadata model (GC-11, GC-13). Hanya teks dari `choices[0].message.content` yang diambil; keluaran dengan `finish_reason: "length"` dianggap terpotong dan gagal. Pemetaan error penyedia: 401/403 dari penyedia → sesi kembali ke gerbang (`unauthorized`), 402 → `credits_or_quota`, 429 → `rate_limited`, 502/503 → `llm_failed`, 408/504 → `timeout`; error di dalam badan respons 200 diperlakukan sama.

## 10. Keamanan dan privasi

| ID | Persyaratan |
|---|---|
| SEC-01 | Aplikasi tidak memiliki rahasia server. Kunci operator tidak pernah ada di repo, berkas proyek, unggahan, log, atau respons; kunci hanya hidup di cookie httpOnly peramban operator itu sendiri. `.env.local` masuk `.gitignore`; `.env.example` hanya berisi nama variabel tanpa nilai. Kunci yang pernah terpapar wajib dicabut dan diganti. |
| SEC-02 | Kunci salah atau berbentuk mustahil selalu membalas 401 yang sama di `/api/verify`, `/api/translate`, dan `/api/usage`. |
| SEC-03 | Validasi server seperti pada kontrak `/api/translate` (bagian 9); metode POST untuk rute tulis, GET hanya untuk `/api/usage` dan jalur lanjut sesi. |
| SEC-04 | Pertahanan prompt injection: instruksi hanya di system prompt; data pengguna hanya di pesan pengguna dalam pembatas dan disanitasi; model tanpa alat, tanpa akses web, tanpa rahasia. |
| SEC-05 | Keluaran model dirender sebagai teks biasa. Dilarang `dangerouslySetInnerHTML` dan perender Markdown untuk keluaran model. |
| SEC-06 | Teks input, hasil, transkrip, dan audio tidak ditulis ke log (P-01). Log hanya berisi jenis error dan kode status. |
| SEC-07 | Rem laju bawaan adalah throttle pemeriksaan kunci (GC-02); selain itu berlaku batas laju dan saldo kredit di sisi OpenRouter pada akun operator. Dilarang mengakali batas dengan akun atau kunci tambahan. |
| SEC-08 | Peringatan privasi berlapis: teks bantu di atas tombol terjemah (CHO-02), kalimat larangan di kotak persetujuan gerbang, dan penjelasan penanganan data di gerbang serta README. Peringatan tidak mencegah pengiriman dan tidak dinyatakan sebagai perlindungan. |
| SEC-09 | Kolom glosarium selain `ja`, `style`, `meaning`, dan kolom bahasa target tidak pernah masuk prompt (GLO-02). |
| SEC-10 | Mode mock LLM hanya untuk pengembangan dan pengujian; mode mock ditolak saat aplikasi berjalan sebagai produksi, dan lencana penanda mode mock tidak pernah tampil di produksi. |
| SEC-11 | Risiko sisa prompt injection dan pengiriman teks ke pihak ketiga (OpenRouter dan penyedia model yang melayani permintaan, yang dapat berubah) didokumentasikan dengan jujur di README. Pengaturan akun OpenRouter untuk pemakaian masukan/keluaran dibiarkan mati; aplikasi mengirim penolakan pengumpulan data pada model berbayar (GC-11). |

## 11. Teknologi dan struktur

| Aspek | Keputusan |
|---|---|
| Framework | Next.js (App Router), TypeScript strict, Tailwind CSS. Tanpa pustaka komponen UI. Semua string UI berbahasa Jepang terpusat di satu berkas string (`lib/i18n/ja.ts`) dan ditinjau penutur Jepang. |
| Hosting | Cloudflare Workers lewat adaptor OpenNext (paket gratis mengizinkan pemakaian komersial). Kode aplikasi netral platform: target deploy adalah lapisan konfigurasi (adaptor dan `wrangler.jsonc`), bukan kode — kode aplikasi tidak memakai API khas platform mana pun, dan variabel lingkungan tetap hanya `LLM_MODE` dan `OPENROUTER_MODEL`. |
| LLM | OpenRouter lewat abstraksi `LlmClient` (implementasi OpenRouter dan mock), dipilih oleh `LLM_MODE`. Variabel lingkungan server hanya `LLM_MODE` dan `OPENROUTER_MODEL` (cadangan yang divalidasi ke metadata model). |
| Penyimpanan | Hanya peramban operator: kartu di `localStorage`, draf dan status persetujuan di `sessionStorage`, kunci di cookie httpOnly. Tidak ada database. |
| API sisi klien | `sessionStorage`/`localStorage`, Fullscreen API, clipboard, dan Web Speech API hanya dipakai di komponen klien; penyimpanan dibaca di `useEffect`. |
| Struktur repo | `app/` (beranda payung, rute kedua produk, `api/verify`, `api/translate`, `api/usage`, `api/logout`), `components/`, `hooks/`, `lib/` (bahasa, model, prompt, glosarium, pemeriksaan, kartu, sesi, tts, asr, i18n), `data/glossary/anzen.json`, `tests/`, `scripts/`, `docs/`. |
| Pengujian | Vitest untuk logika murni, komponen penting, dan rute (LLM dimock). Skrip npm wajib: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `check` (= lint + typecheck + test), `eval`, dan skrip deploy Workers `build:cf`, `preview:cf`, `deploy:cf`. CI menjalankan `npm ci` dan `npm run check` tanpa rahasia pada setiap push. |

### 11.1 Protokol upgrade Next.js

Versi Next.js dan versi adaptor OpenNext dipatok persis (tanpa rentang melayang) di `package.json` dan berkas kunci. Upgrade diatur oleh protokol tetap berikut:

1. **Periksa dukungan adaptor lebih dulu.** Sebelum menaikkan Next.js, periksa matriks dukungan adaptor OpenNext: Next.js tidak pernah dinaikkan melampaui versi tertinggi yang didukung adaptor yang terpasang. Bila dukungan belum ada, adaptor dinaikkan lebih dulu atau upgrade ditunda.
2. **Satu langkah, di cabang terpisah.** Upgrade berjalan satu langkah versi pada cabang khusus upgrade; tidak pernah dua loncatan versi sekaligus dan tidak pernah langsung di cabang utama.
3. **Gerbang wajib di cabang itu.** Seluruh rangkaian harus hijau di cabang upgrade sebelum penggabungan: uji otomatis + lint + typecheck, build Next.js, build OpenNext, pengukuran ulang ukuran bundle Worker terhadap batas paket yang berlaku, dan uji asap di preview Workers — halaman gerbang dan workspace tampil, rute `verify`/`translate`/`usage` menjawab sesuai kontrak (termasuk jalur error kredit dan throttle verify), dan mode mock terbukti ditolak oleh build produksi. Satu saja merah berarti upgrade ditolak: cabang dibuang dan produksi tidak disentuh.
4. **`compatibility_date` hanya dimajukan dengan sengaja**, sebagai langkah tersendiri setelah gerbang di atas hijau — tidak pernah diubah sekalian dalam perubahan lain.
5. **Produksi hanya menerima build yang lulus gerbang.** Versi Worker sebelumnya selalu menjadi jalur rollback: deploy ulang versi itu memulihkan produksi.
6. **Target cadangan terdokumentasi.** Karena kode aplikasi netral platform, Vercel adalah target cadangan: beralih ke sana adalah pekerjaan konfigurasi platform, bukan perubahan kode aplikasi. Target aktif tetap Cloudflare Workers.

## 12. Pengujian, evaluasi, dan ritual mutu

1. **Uji otomatis** mencakup: tabel bahasa dan penolakan kode di luar daftar; validasi input (kosong, 300 vs 301 karakter, tanpa huruf Jepang, karakter kontrol, bahasa duplikat atau lebih dari 4); skema dan pemilihan glosarium (termasuk bukti `note` tidak pernah masuk prompt); format prompt; parser keluaran model (pagar kode, JSON rusak, kunci hilang, keluaran terpotong); pemetaan error rute; pemeriksaan angka (lebar penuh, digit Burma, pemisah, angka kanji, format jam) dan larangan dua arah; penjaga bahasa daftar ketidakjelasan; turunan status kartu; komponen gerbang, panel, dan mode tampil; serta penolakan mode mock di produksi.
2. **Skrip evaluasi** (`npm run eval`) berjalan manual **hanya dengan persetujuan eksplisit pemilik produk**, memakai kredit nyata dalam jumlah kecil, tidak di CI. Skrip memeriksa saldo lebih dulu dan menolak berjalan bila kredit tidak cukup, menjeda antarpermintaan, dan melaporkan kepatuhan bentuk JSON, angka terjaga, larangan terdeteksi, dan kemunculan teks glosarium `verified`. Skrip tidak menilai mutu terjemahan secara menyeluruh; penilaiannya adalah baterai ritual di bawah.
3. **Ritual mutu setiap 2–3 bulan** adalah satu irama tunggal yang menyatukan: evaluasi `eval.mjs`, uji baterai tetap, dan pembaruan jajaran model (berbayar dan gratis). Tujuh kelompok uji baterai: (1) *smoke* — model hidup dan melayani semua bahasa; (2) *reasoning A/B* — hanya untuk model baru atau model yang setelannya berubah; (3) *ambiguitas* — kepatuhan penandaan konteks kabur, dijalankan per model pada bahasa sasaran yang ditetapkan; (4) *angka & larangan*; (5) *istilah 安全衛生 dan istilah tanpa padanan*; (6) *konsistensi & kontaminasi* antar bahasa; (7) *kontrak* — kepatuhan bentuk dan penguraian JSON.
4. **Aturan templat (P-06) berlaku penuh di perkakas uji:** daftar model yang diuji, kalimat uji, dan kosakata uji adalah berkas data konfigurasi; mengganti model atau kalimat uji cukup dengan mengedit data itu. Kalimat uji hidup di `tests/fixtures/sentences.json`.
5. **Setiap perubahan prompt atau jajaran model adalah rilis bergaris gerbang:** baterai dijalankan dan dinilai lebih dulu, dan perubahan hanya diteruskan bila hasilnya lulus. Panggilan model nyata di luar ritual pun memerlukan persetujuan eksplisit pemilik produk.

## 13. Dokumentasi dan pengukuran

1. **README repo** memuat pernyataan kejujuran produk: alat bantu terjemahan mesin, bukan terjemahan resmi; hasil tiap bahasa belum divalidasi penutur asli kecuali istilah glosarium berstatus `verified`; penjelasan istilah di luar glosarium dibuat model dan dapat keliru; jangan memasukkan data pribadi atau rahasia perusahaan; teks dikirim ke OpenRouter dan penyedia model yang melayani (dapat berubah) dengan penolakan pengumpulan data untuk model berbayar; biaya per permintaan ditanggung pemilik kunci; layanan dapat gagal atau lambat; risiko sisa prompt injection dan keterbatasan pemeriksaan angka; dan tanpa klaim akurasi.
2. **README memuat bagian model terkini** yang menyebutkan nama model AI berbayar dan gratis yang sedang dipakai aplikasi. Bagian ini diperbarui pada setiap ritual pembaruan model (bagian 12 butir 3). Dokumen spesifikasi ini tidak menyebutkan nama model (P-08); README adalah catatan hidupnya.
3. **Pengukuran pemakaian** dilakukan tanpa analitik di dalam aplikasi: metrik permintaan Workers di dashboard Cloudflare dibaca sebagai perkiraan — permintaan ke `/api/verify` ≈ sesi yang dimulai, permintaan ke `/api/translate` ≈ aksi terjemahan yang dijalankan, permintaan ke `/api/usage` diabaikan karena dipanggil meter pemakaian. Angka dicatat berkala oleh pemilik produk sebagai bahan laporan.

## 14. Di luar cakupan

- Akun pengguna, login selain gerbang kunci, database, dan histori di server.
- Penyimpanan atau pencatatan isi teks, hasil, transkrip, atau audio dalam bentuk apa pun (P-01).
- Alur penahanan atau penerbitan per kalimat di 朝礼コネクト, dan terjemahan balik sebagai gerbang penayangan (P-07).
- Glosarium di luar 安全衛生 (GLO-01).
- Kategori industri selain 自動車 yang aktif; pilihan industri lain hanya tampil sebagai 準備中.
- Bahasa di luar tujuh bahasa pada bagian 5.1, dan bahasa sumber selain Jepang.
- Penyedia ASR/TTS awan berbayar atau berkunci API pada rilis pertama kedua produk; TTS dan ASR memakai kemampuan bawaan peramban (CHO-25, MND-09, MND-10).
- やさしい日本語 sebagai langkah terpisah, furigana, mode penayangan terpisah di luar layar penuh panel, deteksi otomatis data pribadi, pembayaran, dan analitik di dalam aplikasi.
- Pemanggilan model paralel per bahasa dan percobaan ulang otomatis.
- Klaim bahwa 面談コネクト menggantikan juru bahasa manusia (MND-P3).

## 15. Kriteria selesai rilis 朝礼コネクト

1. Seluruh persyaratan Wajib pada bagian 4, 5, 6, 8, 9, dan 10 berjalan; `npm run check` dan `npm run build` lulus dari ekstrak bersih repo.
2. Berkas `data/glossary/anzen.json` terbit kosong dan aplikasi berjalan penuh dengannya.
3. Tidak ada nama model AI di dokumen spesifikasi dan kode di luar metadata model serta README; tidak ada kunci atau rahasia apa pun di repo.
4. README memenuhi bagian 13, termasuk bagian model terkini.
5. Uji manual lulus: refresh mempertahankan data, hapus sesi mengosongkan semuanya dan kembali ke gerbang, mengganti bahasa panel tidak memanggil API, mode tampil dan rel kartu bekerja, layar penuh panel terbaca di monitor tujuan, teks Burma dan diakritik Vietnam tampil benar, dan baca lantang tampil hanya untuk bahasa yang suaranya tersedia di perangkat uji.
