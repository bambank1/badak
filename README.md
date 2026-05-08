# WA BOT PANEL PRO

WA BOT PANEL PRO adalah script bot WhatsApp berbasis Node.js dengan panel terminal sederhana untuk Termux dan Ubuntu/Linux. Bot mendukung login via Pairing Code atau QR Code, session tersimpan, pengiriman pesan ke nomor pribadi dan grup, multi akun, auto loop, log aktivitas, auto installer, serta update script dari repository.

## Fitur Utama

- Login WhatsApp menggunakan Pairing Code
- Login WhatsApp menggunakan QR Code
- Session tersimpan otomatis, tidak perlu login ulang jika session masih aktif
- Kirim pesan ke nomor WhatsApp pribadi
- Kirim pesan ke grup WhatsApp menggunakan JID grup `@g.us`
- Menu `LIST GROUP` untuk melihat daftar grup dan mengambil JID grup
- Auto Loop untuk mengirim pesan berulang tanpa reconnect setiap putaran
- Waktu Auto Loop random berdasarkan minimum dan maximum delay
- Multi Account Mode untuk menjalankan beberapa session akun
- Delay random antar session saat Multi Mode aktif
- Log aktivitas runtime yang rapi dan mudah dibaca
- Progress bar saat mengirim pesan dan menunggu delay
- Auto Installer untuk Termux dan Ubuntu/Linux
- Update Script otomatis dari repository
- Edit pesan, config, dan target langsung dari menu
- Clear session untuk login ulang
- Clean duplicate target
- Support target campuran: nomor pribadi dan grup

## Struktur File

```text
bot.sh          # Panel utama bot
index.js        # Core bot WhatsApp
auth.js         # Login pairing code / QR code
config.js       # Pengaturan delay, retry, dan mode pesan
messages.js     # Template pesan / AI lokal sederhana
nomor_wa.txt    # Daftar target nomor dan grup
sessions/       # Penyimpanan session akun
logs/           # Log aktivitas bot
```

## Persyaratan

- Node.js
- npm
- bash
- git
- curl
- Termux atau Ubuntu/Linux

## Cara Install

Clone atau upload semua file bot ke folder project, lalu jalankan:

```bash
chmod +x bot.sh
./bot.sh
```

Pilih menu:

```text
[13] AUTO INSTALLER
```

Auto Installer akan:

- Mengecek environment Termux atau Ubuntu/Linux
- Update package
- Install dependency dasar
- Install module Node.js
- Install PM2 jika tersedia
- Menyiapkan konfigurasi project

## Cara Menjalankan Bot

```bash
./bot.sh
```

Pilih menu:

```text
[1] RUN BOT
```

Jika belum ada session, bot akan meminta pilihan login:

```text
[1] Pairing Code
[2] QR Code
```

## Login Pairing Code

1. Pilih `Pairing Code`.
2. Masukkan nomor WhatsApp.
3. Bot akan menampilkan kode pairing.
4. Buka WhatsApp:

```text
Perangkat Tertaut > Tautkan Perangkat > Tautkan dengan nomor telepon
```

5. Masukkan kode pairing yang tampil di terminal.

## Login QR Code

1. Pilih `QR Code`.
2. Bot akan menampilkan QR di terminal.
3. Buka WhatsApp:

```text
Perangkat Tertaut > Tautkan Perangkat > Scan QR Code
```

4. Scan QR yang tampil.

## Menambahkan Target Nomor

Pilih menu:

```text
[7] TAMBAH TARGET
```

Contoh nomor:

```text
628123456789
08123456789
```

Nomor `08xxx` otomatis diubah menjadi format Indonesia `62xxx`.

## Mengirim Pesan ke Grup

Pilih menu:

```text
[15] LIST GROUP
```

Bot akan menampilkan daftar grup dan JID grup, contoh:

```text
1. Nama Grup
   120363xxxxxxxx@g.us
```

Masukkan JID grup tersebut ke menu:

```text
[7] TAMBAH TARGET
```

Contoh isi `nomor_wa.txt`:

```text
628123456789
08123456789
120363xxxxxxxx@g.us
```

## Auto Loop

Pilih menu:

```text
[2] AUTO LOOP
```

Bot akan meminta delay random:

```text
Loop random minimum seconds:
Loop random maximum seconds:
```

Contoh:

```text
60
180
```

Artinya setiap putaran selesai, bot akan menunggu random antara 60 sampai 180 detik sebelum mengirim lagi.

## Multi Account Mode

Pilih menu:

```text
[5] TOGGLE MULTI MODE
```

Saat diaktifkan, bot akan meminta delay antar session:

```text
Delay antar session minimum detik [30]:
Delay antar session maximum detik [120]:
```

Multi Mode akan menjalankan semua akun/session yang ada di folder `sessions/`, dengan jeda random antar akun agar tidak start bersamaan.

## Log Aktivitas

Bot menampilkan log ringkas di terminal, contoh:

```text
[12:10:13] 6076     INFO  ready
[12:10:13] 6076     INFO  round start
[6076] SEND 100% | #################### | OK 1 FAIL 0 | ETA 0s
[12:10:13] 6076     WARN  next loop 645s
[6076] Loop wait [#####-------------------] 35% | wait 377s
```

Log lengkap tersimpan di folder:

```text
logs/
```

## Menu Panel

```text
[1]  RUN BOT
[2]  AUTO LOOP
[3]  PILIH AKUN
[4]  CLEAR SESSION
[5]  TOGGLE MULTI MODE

[6]  VIEW TARGET
[7]  TAMBAH TARGET
[8]  HAPUS TARGET
[9]  CLEAN DUPLIKAT

[10] EDIT MESSAGE
[11] EDIT CONFIG
[12] EDIT TARGET

[13] AUTO INSTALLER
[14] UPDATE SCRIPT
[15] LIST GROUP

[0]  EXIT
```

## Update Script

Pilih menu:

```text
[14] UPDATE SCRIPT
```

Update Script akan mengambil versi terbaru dari repository yang sudah ditentukan, lalu memperbarui file utama tanpa menghapus:

```text
sessions/
logs/
nomor_wa.txt
```

## Catatan Penggunaan

- Gunakan target yang valid.
- Gunakan delay yang wajar.
- Jangan mengirim spam.
- Gunakan bot hanya untuk komunikasi yang diizinkan.
- Risiko penggunaan ditanggung oleh pengguna masing-masing.

## Disclaimer

Project ini dibuat untuk pembelajaran dan otomasi pribadi. Pengembang tidak bertanggung jawab atas penyalahgunaan, pemblokiran akun, atau pelanggaran kebijakan layanan pihak ketiga.