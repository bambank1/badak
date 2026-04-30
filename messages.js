const MESSAGES = [

"Lagi sibuk atau santai nih?",

"Gimana kabarnya hari ini?",

"Lagi dimana sekarang?",

"Udah makan belum?",

"Lagi ngapain nih?",

"Hari ini aktivitasnya padat nggak?",

"Masih online ya?",

"Lagi kerja atau santai?",

"Cuaca di sana gimana?",

"Udah istirahat belum?",

"Lagi dengerin musik apa?",

"Suka begadang nggak sih?",

"Lagi scroll-scroll ya?",

"Besok ada rencana?",

"Suka kopi atau teh?",

"Hari ini capek nggak?",

"Lagi nonton apa?",

"Biasanya tidur jam berapa?",

"Suka hujan atau panas?",

"Lagi rebahan ya?"

];



function randomMessage() {

    const base = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];



    const styles = [

        base,

        base.toLowerCase(),

        base + " 😄",

        base + " hehe",

        base + " btw",

        base.replace("?", "??"),

        base.split(" ").slice(0, 3).join(" "),

        base + "...",

        base + " wkwk"

    ];



    return styles[Math.floor(Math.random() * styles.length)];

}



module.exports = { randomMessage };
