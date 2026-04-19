async function handleAuth(sock, question, color) {
    if (!sock.authState.creds.registered) {

        console.log(color.yellow + '\n🔐 LOGIN PAIRING CODE\n');

        const nomor = await question('📱 Nomor (628xxx): ');

        try {
            console.log(color.cyan + '\n⏳ Mengambil pairing code...\n');

            const code = await sock.requestPairingCode(nomor);

            console.log(color.green + '━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(color.green + '🔑 PAIRING CODE ANDA:');
            console.log(color.yellow + `👉 ${code}`);
            console.log(color.green + '━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            console.log(color.cyan + '📲 Masukkan ke WhatsApp:\n');
            console.log(color.cyan + 'Linked Devices > Link a Device > Enter Code\n');

        } catch (err) {
            console.log(color.red + '❌ Gagal mendapatkan pairing code\n');
        }

        // 🔥 HANDLE CONNECTION STATUS (FIX)
        sock.ev.on('connection.update', ({ connection }) => {

            if (connection === 'connecting') {
                console.log(color.yellow + '⏳ Menghubungkan...\n');
            }

            if (connection === 'open') {
                console.log(color.green + '✅ Login berhasil!\n');
            }

            if (connection === 'close') {
                console.log(color.red + '❌ Koneksi terputus!\n');
            }

        });
    }
}

module.exports = { handleAuth };
