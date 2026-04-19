if (process.env.RUN_FROM_SH !== "1") {
    console.log("\n[!] Gunakan bot.sh\n");
    process.exit();
}

// 🔥 MATIKAN QR TOTAL
process.env.BAILEYS_NO_QR = "true";

console.clear();
console.log("🚀 Starting bot...\n");

/* =========================
🎨 COLOR
========================= */
const color = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m"
};

/* =========================
🔥 FILTER STDOUT
========================= */
const originalWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
    const str = chunk.toString();

    if (
        str.includes('Buffer') ||
        str.includes('SessionEntry') ||
        str.includes('Closing') ||
        str.includes('Decrypted') ||
        str.includes('_chains') ||
        str.includes('preKey') ||
        str.includes('pubKey') ||
        str.includes('privKey')
    ) return true;

    return originalWrite(chunk, encoding, callback);
};

/* =========================
IMPORT
========================= */
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const fs = require('fs');
const readline = require('readline');

const CONFIG = require('./config');
const { randomMessage } = require('./messages');
const { handleAuth } = require('./auth');

/* =========================
ANTI ERROR
========================= */
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

/* =========================
READLINE
========================= */
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (text) => new Promise(res => rl.question(text, res));

/* =========================
UTIL
========================= */
const delay = ms => new Promise(res => setTimeout(res, ms));
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/* =========================
MULTI AKUN
========================= */
const SESSION_NAME = process.env.SESSION || 'default';
const SESSION_PATH = `./sessions/${SESSION_NAME}`;

/* =========================
TARGET
========================= */
const HISTORY_FILE = './nomor_wa.txt';

function loadTargets() {
    if (!fs.existsSync(HISTORY_FILE)) return [];

    return fs.readFileSync(HISTORY_FILE, 'utf-8')
        .split('\n')
        .map(x => x.trim())
        .filter(x => x.length > 8)
        .map(x => {
            let nomor = x.replace(/[^0-9]/g, '');
            if (nomor.startsWith('0')) nomor = '62' + nomor.slice(1);
            return nomor + '@s.whatsapp.net';
        });
}

/* =========================
UI ENGINE
========================= */
let success = 0;
let failed = 0;
let total = 0;
let startTime = 0;

function renderUI(current) {
    const percent = Math.floor((current / total) * 100);
    const barLength = 20;
    const filled = Math.floor((percent / 100) * barLength);

    let colorBar = color.green;
    if (percent > 50) colorBar = color.yellow;
    if (percent > 80) colorBar = color.red;

    const bar = colorBar + '█'.repeat(filled) + color.reset +
        '░'.repeat(barLength - filled);

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const eta = current > 0 ? Math.floor((elapsed / current) * (total - current)) : 0;

    const line = `🚀 ${percent}% | ${bar} | ✔ ${success} ❌ ${failed} | ETA ${eta}s`;

    process.stdout.write('\x1b[2K');
    process.stdout.write('\r' + line);
}

/* =========================
SEND
========================= */
async function sendHuman(sock, jid) {
    for (let i = 0; i < CONFIG.retry; i++) {
        try {
            await sock.sendPresenceUpdate('composing', jid);
            await delay(randomDelay(...CONFIG.typingDelay));

            await sock.sendMessage(jid, {
                text: randomMessage()
            });

            await sock.sendPresenceUpdate('paused', jid);
            return true;
        } catch {
            await delay(2000);
        }
    }
    return false;
}

/* =========================
START BOT
========================= */
let isRunning = false;
global.started = false;

async function startBot() {
    if (isRunning) return;
    isRunning = true;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            browser: Browsers.windows('Chrome'), // 🔥 lebih stabil pairing
            auth: state,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            syncFullHistory: false
        });

        sock.ev.on('creds.update', saveCreds);

        // 🔥 AUTH PAIRING ONLY
        await handleAuth(sock, question, color);

        sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {

            if (connection === 'connecting') {
                console.log(color.yellow + '⏳ Menghubungkan...' + color.reset);
            }

            if (connection === 'open' && !global.started) {
                global.started = true;

                console.clear();
                console.log(color.green + `🚀 BOT CONNECTED (${SESSION_NAME})\n` + color.reset);

                console.log(color.cyan + "╔══════════════════════════════╗" + color.reset);
                console.log(color.cyan + "║       🚀 WA BOT PANEL        ║" + color.reset);
                console.log(color.cyan + "╚══════════════════════════════╝\n" + color.reset);

                startWarming(sock);
            }

            if (connection === 'close') {
                isRunning = false;

                const reason = lastDisconnect?.error?.output?.statusCode;

                console.log('\n' + color.red + `❌ Disconnect (${reason})` + color.reset);

                if (reason !== DisconnectReason.loggedOut) {
                    console.log(color.yellow + '🔄 Reconnect...\n' + color.reset);
                    setTimeout(startBot, 5000);
                } else {
                    console.log(color.red + '❌ Session logout, ulang pairing!\n');
                }
            }

        });

    } catch {
        isRunning = false;
        console.log(color.red + 'ERROR START BOT' + color.reset);
        setTimeout(startBot, 5000);
    }
}

/* =========================
MAIN LOOP
========================= */
async function startWarming(sock) {
    const targets = loadTargets();

    if (!targets.length) {
        console.log(color.red + '❌ Nomor kosong!' + color.reset);
        return;
    }

    total = targets.length;
    success = 0;
    failed = 0;
    startTime = Date.now();

    for (let i = 0; i < targets.length; i++) {
        const jid = targets[i];

        const result = await sendHuman(sock, jid);

        if (result) success++;
        else failed++;

        renderUI(i + 1);

        const baseDelay = randomDelay(CONFIG.minDelay, CONFIG.maxDelay);
        const humanFactor = Math.random() < 0.3
            ? randomDelay(4000, 12000)
            : 0;

        await delay(baseDelay + humanFactor);

        if ((i + 1) % 5 === 0) {
            process.stdout.write('\n');
            console.log('⏸️ Istirahat sebentar...\n');
            await delay(15000);
        }
    }

    process.stdout.write('\n');

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(color.green + '\n✅ SELESAI SEMUA TARGET' + color.reset);
    console.log(color.cyan + 'Kembali ke menu...\n' + color.reset);

    setTimeout(() => process.exit(0), 1500);
}

/* =========================
RUN
========================= */
startBot();
