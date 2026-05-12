const CONFIG = require('./config');

const FALLBACK_MESSAGES = [
    'Piye kabare? aman ta?',
    'Lagi ngopo saiki? santai po sibuk?',
    'Wis mangan durung? jangan telat lho.',
    'Mugo-mugo harimu lancar yo.',
    'Aku cuma nyapa bentar, piye kabarmu?',
    'Nek lagi selo, kabari ya.',
    'Capek nggak hari ini? ojo lali istirahat.',
    'Lagi santai po lagi akeh gawean?',
    'Semoga sehat terus yo.',
    'Wis ngopi durung? hehe',
    'Neng kono cuacane piye?',
    'Kalau sempat bales, santai wae.',
    'Malam begini masih melek ta?',
    'Hari ini lumayan rame nggak aktivitasmu?',
    'Lagi pengin ngobrol sebentar nggak?'
];

const OPENERS = [
    '',
    'Halo, ',
    'Hai, ',
    'Eh, ',
    'Oiya, ',
    'Btw, ',
    'Yo, ',
    'Lha, '
];

const TIME_CONTEXT = {
    morning: ['pagi iki', 'pagi ini', 'dari pagi', 'isuk-isuk ngene'],
    noon: ['siang iki', 'siang ini', 'lagi awan ngene', 'hari ini'],
    afternoon: ['sore iki', 'sore ini', 'menjelang malam', 'bar aktivitas seharian'],
    night: ['malam iki', 'malam ini', 'bengi ngene', 'malam-malam begini']
};

const HUMAN_INTENTS = [
    [
        'piye kabare {time}? aman ta?',
        'kabarmu gimana {time}? mugo-mugo apik yo.',
        'hari ini lancar kan? piye ceritane?',
        'semoga kamu baik-baik wae {time}.'
    ],
    [
        'lagi ngopo {time}? sibuk po santai?',
        'aktivitasmu padat nggak {time}? ojo lali ngaso.',
        'wis rampung urusane belum?',
        'lagi akeh gawean ta? pelan-pelan wae yo.'
    ],
    [
        'wis mangan durung? jangan sampai telat.',
        'udah sempat ngopi belum? ben rada seger.',
        'istirahat sek kalau capek, ojo dipaksa terus.',
        'minum dulu, ben nggak lemes hehe.'
    ],
    [
        'nek lagi selo, kabari ya.',
        'kalau belum sempat bales, santai wae.',
        'aku cuma nyapa bentar kok.',
        'nanti kalau ada waktu, bales ya.'
    ],
    [
        'rasane hari ini gimana? rame po biasa aja?',
        'lagi mood ngobrol nggak? nek nggak ya gapapa.',
        'aku kepikiran nyapa, makane chat sebentar.',
        'semoga urusanmu dimudahkan yo.'
    ]
];

const HUMAN_SUFFIXES = [
    '',
    ' hehe',
    ' ya',
    ' yo',
    ' lho',
    ' nih',
    ' wae',
    ' rek',
    ' mas',
    ' mbak'
];

const MICRO_VARIATIONS = [
    text => text,
    text => text.replace(/gimana/g, 'gimana nih'),
    text => text.replace(/lagi/g, 'lagi agak'),
    text => text.replace(/semoga/g, 'mugo-mugo'),
    text => text.replace(/santai/g, 'santai wae'),
    text => text.replace(/capek/g, 'kesel'),
    text => text.replace(/bales/g, 'mbales')
];

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function chance(value) {
    return Math.random() < value;
}

function timeBucket(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 4 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 15) return 'noon';
    if (hour >= 15 && hour < 18) return 'afternoon';
    return 'night';
}

function normalizeSpaces(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\s+([?.!,])/g, '$1')
        .replace(/([?.!,])\1{2,}/g, '$1$1')
        .trim();
}

function applyTone(text) {
    const tone = CONFIG.localAITone || 'santai';

    if (tone === 'formal') {
        return text
            .replace(/\bnggak\b/g, 'tidak')
            .replace(/\bngopo\b/g, 'sedang apa')
            .replace(/\bpiye\b/g, 'bagaimana')
            .replace(/\bwis\b/g, 'sudah')
            .replace(/\bwae\b/g, 'saja')
            .replace(/\byo\b/g, 'ya')
            .replace(/\bta\b/g, 'ya');
    }

    if (tone === 'akrab') {
        const variants = [
            text,
            text + ' hehe',
            text.replace('ya', 'yo'),
            text.replace('nih', 'iki')
        ];
        return pick(variants);
    }

    return text;
}

function trimLength(text) {
    const maxLength = Number(CONFIG.localAIMaxLength || 100);
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
}
function appendHumanSuffix(base, suffix) {
    if (!suffix) return base;

    const plainSuffix = suffix.trim();
    const lower = base.toLowerCase();
    if (lower.endsWith(` ${plainSuffix}`) || lower.endsWith(` ${plainSuffix}.`) || lower.endsWith(` ${plainSuffix}?`)) {
        return base;
    }

    const match = base.match(/^(.+?)([?.!]+)$/);
    if (match) return `${match[1]} ${plainSuffix}${match[2]}`;
    return `${base} ${plainSuffix}`;
}

function localAIMessage() {
    const bucket = timeBucket();
    const time = pick(TIME_CONTEXT[bucket]);
    const group = pick(HUMAN_INTENTS);
    let base = pick(group).replace('{time}', time);

    if (chance(Number(CONFIG.localAIJawaMixChance ?? 0.65))) {
        base = pick(MICRO_VARIATIONS)(base);
    }

    const opener = chance(0.65) ? pick(OPENERS) : '';
    const suffix = chance(0.45) ? pick(HUMAN_SUFFIXES) : '';
    base = appendHumanSuffix(base, suffix);
    const ending = /[?.!]$/.test(base) ? '' : pick(['?', '.', '...']);

    let text = normalizeSpaces(`${opener}${base}${ending}`);
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
        base + ' yo',
        base.replace('?', '??'),
        base + '...',
        base.replace('kamu', 'sampeyan'),
        base.replace('lagi', 'sek lagi')
    ];

    return trimLength(normalizeSpaces(pick(styles)));
}

function randomMessage() {
    if (CONFIG.localAIMessage === false) return fallbackMessage();
    return localAIMessage() || fallbackMessage();
}

module.exports = { randomMessage };