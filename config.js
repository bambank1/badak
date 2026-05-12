module.exports = {
    minDelay: 1800000,       // 30 menit
    maxDelay: 2400000,       // 40 menit
    typingDelay: [5000, 15000],
    retry: 2,
    sendChance: 1,           // 1 = selalu kirim, 0.7 = 70% kirim
    presenceOnlyChance: 0,   // 0 = jangan skip pesan, 0.2 = 20% hanya online
    localAIMessage: true,    // true = pakai AI lokal offline
    localAITone: 'santai',   // santai, akrab, formal
    localAIMaxLength: 90,    // batas panjang pesan
    forbiddenCooldownMin: 600000,      // 10 menit jika disconnect 403
    forbiddenCooldownMax: 1200000,     // 20 menit jika disconnect 403
    forbiddenLongCooldownMin: 1800000, // 30 menit setelah 403 berulang
    forbiddenLongCooldownMax: 3600000  // 60 menit setelah 403 berulang
};