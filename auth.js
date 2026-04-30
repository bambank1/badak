let pairingRequested = false;

async function chooseLoginMethod(question, color) {
    while (true) {
        console.log(color.yellow + '\nPILIH LOGIN\n' + color.reset);
        console.log('[1] Pairing Code');
        console.log('[2] QR Code');
        console.log('');

        const pilih = (await question('Pilih login (1/2): ')).trim();

        if (pilih === '1') return 'pairing';
        if (pilih === '2') return 'qr';

        console.log(color.red + 'Pilihan tidak valid. Masukkan 1 atau 2.\n' + color.reset);
    }
}

async function handleAuth(sock, question, color, loginMethod = 'pairing') {
    if (sock.authState.creds.registered || loginMethod === 'session') {
        pairingRequested = false;
        return;
    }

    if (loginMethod === 'qr') {
        console.log(color.yellow + '\nMenunggu QR Code dari WhatsApp...\n' + color.reset);
        return;
    }

    if (pairingRequested) {
        console.log(color.yellow + '\nPairing code already created. Enter that code in WhatsApp, then wait for BOT CONNECTED.\n' + color.reset);
        return;
    }

    console.log(color.yellow + '\nLOGIN PAIRING CODE\n' + color.reset);

    const nomor = await question('Nomor (628xxx): ');
    const cleanNumber = nomor.replace(/[^0-9]/g, '');

    if (!cleanNumber) {
        console.log(color.red + 'Nomor kosong. Jalankan ulang bot lalu masukkan nomor.\n' + color.reset);
        return;
    }

    try {
        pairingRequested = true;
        console.log(color.cyan + '\nMengambil pairing code...\n' + color.reset);

        const code = await sock.requestPairingCode(cleanNumber);

        console.log(color.green + '==========================');
        console.log(color.green + 'PAIRING CODE ANDA:');
        console.log(color.yellow + `=> ${code}`);
        console.log(color.green + '==========================\n' + color.reset);

        console.log(color.cyan + 'Masukkan ke WhatsApp:');
        console.log(color.cyan + 'Perangkat Tertaut > Tautkan Perangkat > Tautkan dengan nomor telepon\n' + color.reset);
    } catch (err) {
        pairingRequested = false;
        console.log(color.red + 'Gagal mendapatkan pairing code: ' + (err?.message || err) + '\n' + color.reset);
    }
}

module.exports = { chooseLoginMethod, handleAuth };