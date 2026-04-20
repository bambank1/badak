const MESSAGES = [
"Lagi sibuk atau santai nih? 😊",
"Gimana kabarnya hari ini?",
"Lagi dimana sekarang?",
"Udah makan belum? 🍜",
"Lagi ngapain nih?",
"Hari ini aktivitasnya padat nggak?",
"Masih online ya? 👋",
"Lagi kerja atau lagi santai?",
"Cuaca di sana lagi gimana?",
"Udah istirahat belum?",
"Lagi dengerin musik apa sekarang? 🎵",
"Suka begadang nggak sih? 😄",
"Lagi main HP terus ya?",
"Besok ada rencana kemana?",
"Suka kopi atau teh nih? ☕",
"Udah mandi belum? 😆",
"Hari ini capek nggak?",
"Lagi nonton apa sekarang?",
"Biasanya tidur jam berapa?",
"Suka hujan atau panas?",
"Lagi rebahan ya sekarang? 😄",
"Udah minum belum hari ini?",
"Lagi sendiri atau rame-rame?",
"Kalau libur biasanya ngapain?",
"Suka makanan pedas nggak? 🌶️",
"Lagi scroll-scroll doang ya?",
"Masih melek sampai sekarang?",
"Kalau weekend biasanya kemana?",
"Lagi mood ngobrol nggak?",
"Lagi cari kesibukan ya? 😊"
];

function randomMessage() {
    return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

module.exports = { randomMessage };
