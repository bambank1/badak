const CONFIG = require('./config');

const FALLBACK_MESSAGES = [
    'Lagi sibuk atau santai nih?',
    'Gimana kabarnya hari ini?',
    'Lagi dimana sekarang?',
    'Udah makan belum?',
    'Lagi ngapain nih?',
    'Hari ini aktivitasnya padat nggak?',
    'Masih online ya?',
    'Lagi kerja atau santai?',
    'Cuaca di sana gimana?',
    'Udah istirahat belum?',
    'Lagi dengerin musik apa?',
    'Suka begadang nggak sih?',
    'Lagi scroll-scroll ya?',
    'Besok ada rencana?',
    'Suka kopi atau teh?',
    'Hari ini capek nggak?',
    'Lagi nonton apa?',
    'Biasanya tidur jam berapa?',
    'Suka hujan atau panas?',
    'Lagi rebahan ya?'
];

const OPENERS = [
    '',
    'Halo, ',
    'Hai, ',
    'Eh, ',
    'Btw, ',
    'Oiya, '
];

const TIME_CONTEXT = {
    morning: ['pagi ini', 'dari pagi', 'hari ini'],
    noon: ['siang ini', 'hari ini', 'lagi siang begini'],
    afternoon: ['sore ini', 'menjelang malam', 'hari ini'],
    night: ['malam ini', 'malam begini', 'hari ini']
};

const INTENTS = [
    {
        topic: 'kabar',
        lines: [
            'gimana kabarnya {time}?',
            'semoga kabarnya baik ya {time}.',
            'lagi aman-aman aja kan {time}?'
        ]
    },
    {
        topic: 'aktivitas',
        lines: [
            'lagi sibuk apa santai {time}?',
            'aktivitasnya padat nggak {time}?',
            'lagi ngapain sekarang?'
        ]
    },
    {
        topic: 'ringan',
        lines: [
            'udah sempat istirahat belum?',
            'udah makan belum?',
            'lagi pegang HP sebentar ya?'
        ]
    },
    {
        topic: 'obrolan',
        lines: [
            'kalau lagi luang, kabarin ya.',
            'nanti kalau sempat balas ya.',
            'aku cuma mau nyapa sebentar.'
        ]
    }
];

const SOFTENERS = [
    '',
    ' hehe',
    ' ya',
    ' nih',
    ' aja'
];

const ENDINGS = [
    '',
    '?',
    '...',
    ' ya?'
];

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function timeBucket(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 4 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 15) return 'noon';
    if (hour >= 15 && hour < 18) return 'afternoon';
    return 'night';
}

function normalizeSpaces(text) {
    return text.replace(/\s+/g, ' ').replace(/\s+([?.!,])/g, '$1').trim();
}

function applyTone(text) {
    const tone = CONFIG.localAITone || 'santai';

    if (tone === 'formal') {
        return text
            .replace(/\bnggak\b/g, 'tidak')
            .replace(/\blagi\b/g, 'sedang')
            .replace(/\bkabarin\b/g, 'beri kabar');
    }

    if (tone === 'akrab') {
        const variants = [text, text + ' hehe', text.replace('gimana', 'gimana nih')];
        return pick(variants);
    }

    return text;
}

function trimLength(text) {
    const maxLength = Number(CONFIG.localAIMaxLength || 90);
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
}

function localAIMessage() {
    const bucket = timeBucket();
    const time = pick(TIME_CONTEXT[bucket]);
    const intent = pick(INTENTS);
    const base = pick(intent.lines).replace('{time}', time);
    const opener = pick(OPENERS);
    const softener = pick(SOFTENERS);
    const ending = base.endsWith('?') || base.endsWith('.') ? '' : pick(ENDINGS);

    let text = normalizeSpaces(`${opener}${base}${softener}${ending}`);
    text = applyTone(text);
    text = normalizeSpaces(text);
    return trimLength(text);
}

function fallbackMessage() {
    const base = pick(FALLBACK_MESSAGES);
    const styles = [
        base,
        base.toLowerCase(),
        base + ' hehe',
        base + ' btw',
        base.replace('?', '??'),
        base.split(' ').slice(0, 3).join(' '),
        base + '...',
        base + ' wkwk'
    ];

    return pick(styles);
}

function randomMessage() {
    if (CONFIG.localAIMessage === false) return fallbackMessage();
    return localAIMessage() || fallbackMessage();
}

module.exports = { randomMessage };