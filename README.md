# Placement Test Bahasa Inggris (Kelas 8 SMP)

Murid mengerjakan tes di browser HP atau tablet. Jawaban masuk ke **Google Spreadsheet** Anda, dan halaman guru menampilkan hasilnya langsung.

- Halaman murid dan halaman guru di-hosting gratis di **GitHub Pages**.
- Penghubung ke spreadsheet memakai **Google Apps Script** (gratis, tanpa server).
- Kunci jawaban hanya ada di Apps Script, tidak ada di repositori dan tidak dikirim ke gadget murid.

## Isi folder

| File | Fungsi |
| --- | --- |
| `index.html`, `app.js` | Halaman tes untuk murid |
| `guru.html`, `guru.js`, `scoring.js` | Halaman hasil untuk guru |
| `questions.json` | Soal (tanpa kunci jawaban) |
| `config.js` | Tempat menempel alamat Apps Script (langkah 3) |
| `apps-script/Code.gs` | Kode untuk ditempel ke Google Apps Script (langkah 2) |
| `Instrumen_Placement_Test_Bahasa_Inggris_Kelas8.pdf` | Rubrik menulis, pertanyaan wawancara berbicara, naskah menyimak |
| `audio/` | Opsional: rekaman menyimak sendiri (lihat catatan) |

## Langkah pemasangan (sekitar 15 menit)

### 1. Buat spreadsheet
Buka https://sheets.new dan beri nama, misalnya **Hasil Placement Test**.

### 2. Pasang kode Apps Script
1. Di spreadsheet, klik **Ekstensi > Apps Script**.
2. Hapus isi `Code.gs` yang ada, lalu tempel seluruh isi file `apps-script/Code.gs` dari folder ini.
3. Di baris atas, **ganti `TEACHER_PIN`** dengan PIN pilihan Anda (angka atau huruf). PIN ini dipakai untuk membuka halaman guru.
4. Klik ikon simpan.

### 3. Deploy dan salin alamatnya
1. Klik **Deploy > Deployment baru**. Pada ikon roda gigi pilih **Aplikasi web**.
2. Isi:
   - **Jalankan sebagai**: Saya (akun Anda)
   - **Yang memiliki akses**: **Siapa saja**
3. Klik **Deploy**, lalu **Beri otorisasi akses**. Pilih akun Anda. Jika muncul "Google belum memverifikasi aplikasi ini", klik **Lanjutan > Buka (tidak aman)**, lalu **Izinkan**. Ini aman karena kode itu milik Anda sendiri.
4. Salin **URL aplikasi web** (berakhiran `/exec`).
5. Buka file `config.js` dan ganti `PASTE_ALAMAT_WEB_APP_DI_SINI` dengan URL tersebut, tetap di dalam tanda kutip.

### 4. Unggah ke GitHub dan aktifkan Pages
1. Buat repositori baru di GitHub (misalnya `placement-test`), **Public**.
2. Klik **Add file > Upload files**, lalu unggah **semua isi folder ini** (bukan folder induknya) dan klik **Commit changes**.
3. Buka **Settings > Pages**. Pada *Build and deployment*, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
4. Tunggu 1 sampai 2 menit. Alamat situs Anda: `https://NAMA-GITHUB-ANDA.github.io/placement-test/`
   - **Untuk murid**: alamat di atas
   - **Untuk guru**: tambahkan `guru.html` di belakangnya, masuk dengan PIN dari langkah 2

### 5. Coba sendiri
Kerjakan tes sebagai murid percobaan, kirim, lalu buka halaman guru. Barisnya harus muncul, dan sheet **Hasil** di spreadsheet ikut terisi. Hapus baris percobaan lewat tombol *Hapus hasil* atau langsung dari spreadsheet.

## Cara pakai saat tes

- Murid mengerjakan dan mengirim. Nilai tata bahasa, membaca, dan menyimak langsung terhitung.
- Di halaman guru, klik *Detail* untuk membaca tulisan murid, nilai dengan rubrik di PDF (4 aspek, maksimal 16), lalu isi kolom *Menulis*. Lakukan wawancara berbicara langsung, lalu isi kolom *Berbicara* (maksimal 16).
- Setelah kelima nilai terisi, rata-rata level dan kelas muncul otomatis, dengan tanda *Perkuat* dan *Dekat batas level* jika perlu keputusan manual.
- Anda juga boleh mengisi nilai Menulis dan Berbicara langsung di spreadsheet. Kolom *Rata-rata level*, *Level CEFR*, dan *Kelas* di sheet terhitung otomatis dengan rumus.
- Tombol **Unduh CSV** di halaman guru mengekspor hasil. Spreadsheet sendiri sudah bisa dilihat, difilter, dan dibagikan seperti biasa.

## Catatan penting

- **Jika Anda mengubah `Code.gs`** (misalnya mengganti PIN) setelah deploy: klik **Deploy > Kelola deployment > ikon pensil > Versi: Versi baru > Deploy**. Alamat `/exec` tetap sama.
- Alamat Apps Script di `config.js` terlihat publik karena repositori Public. Itu tidak masalah: orang yang tahu alamatnya hanya bisa mengirim jawaban tes, dan hasil hanya terbuka dengan PIN. Pilih PIN yang tidak mudah ditebak, dan jangan menyimpan data murid di repositori.
- Halaman guru memperbarui hasil tiap 8 detik. Apps Script punya batas pemakaian harian untuk akun gratis, cukup untuk kelas kursus biasa.
- **Menyimak** diputar dengan suara bawaan gadget (maksimal 2 kali per rekaman), yang berbeda antar perangkat. Jika punya rekaman sendiri, simpan sebagai `audio/listening1.mp3` dan `audio/listening2.mp3` lalu unggah ulang ke GitHub, otomatis dipakai.
- Jika murid tidak sengaja menutup halaman, jawaban sementaranya tersimpan di gadget dan bisa dilanjutkan.
