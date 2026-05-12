module.exports = {
    minDelay: 1800000,       // 30 menit
    maxDelay: 2400000,       // 40 menit
    typingDelay: [5000, 15000],
    retry: 2,
    sendChance: 1,           // 1 = selalu kirim, 0.7 = 70% kirim
    presenceOnlyChance: 0,   // 0 = jangan skip pesan, 0.2 = 20% hanya online
    localAIMessage: true,    // true = pakai AI lokal offline
    localAITone: 'santai',   // santai, akrab, formal
    localAIMaxLength: 100,   // batas panjang pesan
    localAIJawaMixChance: 0.65, // peluang campuran Indonesia-Jawa
    forbiddenCooldownMin: 600000,      // 10 menit jika disconnect 403
    forbiddenCooldownMax: 1200000,     // 20 menit jika disconnect 403
    forbiddenLongCooldownMin: 1800000, // 30 menit setelah 403 berulang
    forbiddenLongCooldownMax: 3600000, // 60 menit setelah 403 berulang
    qrDisplay: 'auto',       // auto, terminal, file
    qrMinColumns: 90,        // tampilkan QR terminal jika kolom cukup
    qrMinRows: 42,           // tampilkan QR terminal jika tinggi cukup
    qrImageSize: 640,        // ukuran gambar QR fleksibel
    autoReadIncoming: true,  // centang biru untuk pesan masuk ke bot
    autoReadDelayMin: 800,   // jeda minimum sebelum pesan masuk dibaca
    autoReadDelayMax: 2500   // jeda maksimum sebelum pesan masuk dibaca
};