if (process.env.RUN_FROM_SH !== "1") {
    console.log("\n[!] Gunakan bot.sh\n");
    process.exit(1);
}

process.env.BAILEYS_NO_QR = "true";

console.clear();
console.log("Starting bot...\n");

const color = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m"
};

const hiddenLogPatterns = [
    'Buffer',
    'SessionEntry',
    'Closing open session',
    'open session in favor of incoming prekey bundle',
    'Decrypted',
    '_chains',
    'preKey',
    'pubKey',
    'privKey'
];

function shouldHideLog(chunk) {
    const str = chunk.toString();
    return hiddenLogPatterns.some(pattern => str.includes(pattern));
}

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

process.stdout.write = (chunk, encoding, callback) => {
    if (shouldHideLog(chunk)) return true;
    return originalStdoutWrite(chunk, encoding, callback);
};

process.stderr.write = (chunk, encoding, callback) => {
    if (shouldHideLog(chunk)) return true;
    return originalStderrWrite(chunk, encoding, callback);
};

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
let qrcodeTerminal = null;
try {
    qrcodeTerminal = require('qrcode-terminal');
} catch {
    qrcodeTerminal = null;
}

const CONFIG = require('./config');
const { randomMessage } = require('./messages');
const { chooseLoginMethod, handleAuth } = require('./auth');

process.on('uncaughtException', (err) => {
    console.log(color.red + 'ERROR: ' + (err?.message || err) + color.reset);
});

process.on('unhandledRejection', (err) => {
    console.log(color.red + 'PROMISE ERROR: ' + (err?.message || err) + color.reset);
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let waitingForPairingInput = false;
const question = (text) => new Promise((resolve) => {
    waitingForPairingInput = true;
    rl.question(text, (answer) => {
        waitingForPairingInput = false;
        resolve(answer);
    });
});

const delay = ms => new Promise(res => setTimeout(res, ms));
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function humanTypingDelay(text) {
    const base = 300;
    const variance = Math.random() * 2000;
    return Math.min(20000, text.length * base + variance);
}

async function randomHumanPause() {
    if (Math.random() < 0.2) {
        const delayTime = Math.floor(Math.random() * 600000) + 60000;
        await delay(delayTime);
    }
}

function shouldReply() {
    const chance = Number(CONFIG.sendChance ?? 1);
    return Math.random() < Math.max(0, Math.min(1, chance));
}

const lastChat = {};

function canSend(jid) {
    const now = Date.now();

    if (!lastChat[jid]) {
        lastChat[jid] = now;
        return true;
    }

    const diff = now - lastChat[jid];
    if (diff < 3600000) return false;

    lastChat[jid] = now;
    return true;
}

const SESSION_NAME = process.env.SESSION || 'default';
const SESSION_PATH = `./sessions/${SESSION_NAME}`;
const HISTORY_FILE = './nomor_wa.txt';

function hasSavedSession() {
    try {
        const credsPath = `${SESSION_PATH}/creds.json`;
        if (!fs.existsSync(credsPath)) return false;

        const raw = fs.readFileSync(credsPath, 'utf-8');
        const creds = JSON.parse(raw);

        return Boolean(
            creds?.me ||
            creds?.account ||
            creds?.noiseKey ||
            creds?.signedIdentityKey ||
            creds?.signedPreKey
        );
    } catch {
        return false;
    }
}

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

let success = 0;
let failed = 0;
let total = 0;
let startTime = 0;

function renderUI(current) {
    const percent = total > 0 ? Math.floor((current / total) * 100) : 0;
    const barLength = 20;
    const filled = Math.floor((percent / 100) * barLength);

    let colorBar = color.green;
    if (percent > 50) colorBar = color.yellow;
    if (percent > 80) colorBar = color.red;

    const bar = colorBar + '#'.repeat(filled) + color.reset + '-'.repeat(barLength - filled);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const eta = current > 0 ? Math.floor((elapsed / current) * (total - current)) : 0;
    const line = `SEND ${percent}% | ${bar} | OK ${success} FAIL ${failed} | ETA ${eta}s`;

    process.stdout.write('\x1b[2K');
    process.stdout.write('\r' + line);
}

async function waitWithLoading(ms, label = 'Next message', keepRunning = () => true) {
    if (!ms || ms <= 0) return true;

    const started = Date.now();
    const barLength = 24;

    while (true) {
        if (!keepRunning()) {
            process.stdout.write('\x1b[2K');
            process.stdout.write('\r');
            return false;
        }

        const elapsed = Date.now() - started;
        const remaining = Math.max(0, ms - elapsed);
        const percent = Math.min(100, Math.floor((elapsed / ms) * 100));
        const filled = Math.floor((percent / 100) * barLength);
        const bar = '#'.repeat(filled) + '-'.repeat(barLength - filled);
        const seconds = Math.ceil(remaining / 1000);

        process.stdout.write('\x1b[2K');
        process.stdout.write(`\r${label} [${bar}] ${percent}% | wait ${seconds}s`);

        if (remaining <= 0) break;
        await delay(Math.min(1000, remaining));
    }

    process.stdout.write('\x1b[2K');
    process.stdout.write('\r');
    return true;
}
async function sendHuman(sock, jid) {
    if (!shouldReply()) return false;

    for (let i = 0; i < CONFIG.retry; i++) {
        try {
            const text = randomMessage();

            await randomHumanPause();
            await sock.sendPresenceUpdate('composing', jid);
            await delay(humanTypingDelay(text));
            await sock.sendMessage(jid, { text });
            await sock.sendPresenceUpdate('paused', jid);

            return true;
        } catch {
            await delay(3000 + Math.random() * 5000);
        }
    }

    return false;
}

let isRunning = false;
let reconnectTimer = null;
let reconnectCount = 0;
let selectedLoginMethod = null;
let activeRunId = 0;
let connectionAlive = false;

function scheduleReconnect(reason, customDelayMs) {
    if (reconnectTimer) return;

    isRunning = false;
    const delayMs = customDelayMs ?? Math.min(30000, 5000 + reconnectCount * 5000);
    reconnectCount++;

    console.log(color.yellow + `Reconnect in ${Math.floor(delayMs / 1000)} seconds... (${reason || 'unknown'})` + color.reset);

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startBot();
    }, delayMs);
}

async function startBot() {
    if (isRunning) return;
    isRunning = true;
    const runId = ++activeRunId;
    connectionAlive = false;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
        const sessionAvailable = state.creds.registered || hasSavedSession();
        const loginMethod = sessionAvailable
            ? 'session'
            : (selectedLoginMethod || await chooseLoginMethod(question, color));
        selectedLoginMethod = loginMethod === 'session' ? null : loginMethod;
        if (loginMethod === 'session') {
            console.log(color.cyan + 'Using saved session (' + SESSION_NAME + ')...' + color.reset);
        }
        process.env.BAILEYS_NO_QR = loginMethod === 'qr' ? 'false' : 'true';

        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            browser: Browsers.windows('Chrome'),
            auth: state,
            keepAliveIntervalMs: 10000,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            retryRequestDelayMs: 250,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            printQRInTerminal: false
        });

        sock.ev.on('creds.update', saveCreds);
        let warmingStarted = false;
        let authReady = sock.authState.creds.registered;
        let lastQr = '';

        sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
            const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;

            if (qr && loginMethod === 'qr' && qr !== lastQr) {
                lastQr = qr;
                console.clear();
                console.log(color.yellow + 'LOGIN QR CODE' + color.reset);
                console.log('Scan QR ini dari WhatsApp:');
                console.log('Perangkat Tertaut > Tautkan Perangkat > Scan QR Code\n');

                if (qrcodeTerminal) {
                    qrcodeTerminal.generate(qr, { small: true });
                } else {
                    console.log(color.red + 'Module qrcode-terminal belum terinstall.' + color.reset);
                    console.log('Jalankan AUTO INSTALLER atau: npm install qrcode-terminal');
                    console.log(qr);
                }
            }

            if (connection === 'connecting' && authReady && !waitingForPairingInput) {
                console.log(color.yellow + 'Connecting...' + color.reset);
            }

            if (connection === 'open') {
                authReady = true;
                selectedLoginMethod = null;
                connectionAlive = true;
                isRunning = true;
                reconnectCount = 0;

                if (warmingStarted) return;
                warmingStarted = true;

                console.clear();
                console.log(color.green + `BOT CONNECTED (${SESSION_NAME})\n` + color.reset);

                startWarming(sock, runId).catch((err) => {
                    console.log(color.red + 'BOT ERROR: ' + (err?.message || err) + color.reset);
                    scheduleReconnect('warming error');
                });
            }

            if (connection === 'close') {
                isRunning = false;
                connectionAlive = false;
                activeRunId++;
                warmingStarted = false;

                console.log('\n' + color.red + `Disconnect (${reason || 'unknown'})` + color.reset);

                if (reason === DisconnectReason.loggedOut || reason === 401) {
                    selectedLoginMethod = null;
                    console.log(color.red + 'Session logout. Delete this session and pair again.\n' + color.reset);
                    return;
                }

                if (reason === DisconnectReason.restartRequired || reason === 515) {
                    console.log(color.yellow + 'Restarting connection, keep scanning/waiting...\n' + color.reset);
                    scheduleReconnect('restart required', 1000);
                    return;
                }

                scheduleReconnect(reason);
            }
        });

        await handleAuth(sock, question, color, loginMethod);
        authReady = sock.authState.creds.registered;
    } catch (err) {
        isRunning = false;
        console.log(color.red + 'ERROR START BOT: ' + (err?.message || err) + color.reset);
        scheduleReconnect('start error');
    }
}

function resetLastChat() {
    for (const jid of Object.keys(lastChat)) delete lastChat[jid];
}

function isCurrentConnection(runId) {
    return connectionAlive && runId === activeRunId;
}

async function startWarming(sock, runId = activeRunId) {
    if (!isCurrentConnection(runId)) return;

    if (process.env.LOOP_MODE === '1') resetLastChat();

    try {
        await sock.sendPresenceUpdate('available');
    } catch {}

    const targets = loadTargets();

    if (!targets.length) {
        console.log(color.red + 'Nomor kosong. Isi nomor_wa.txt dulu.' + color.reset);
        if (process.env.LOOP_MODE === '1') {
            const loopDelay = Math.max(1, Number(process.env.LOOP_DELAY || 60)) * 1000;
            const ok = await waitWithLoading(loopDelay, 'Loop wait', () => isCurrentConnection(runId));
            if (!ok) return;
            return startWarming(sock, runId);
        }
        return;
    }

    total = targets.length;
    success = 0;
    failed = 0;
    startTime = Date.now();

    for (let i = 0; i < targets.length; i++) {
        if (!isCurrentConnection(runId)) return;

        const jid = targets[i];

        if (!canSend(jid)) {
            renderUI(i + 1);
            continue;
        }

        try {
            if (Math.random() < 0.2) {
                await sock.sendPresenceUpdate('available', jid);
                renderUI(i + 1);
                {
                    const ok = await waitWithLoading(5000 + Math.random() * 10000, 'Next target', () => isCurrentConnection(runId));
                    if (!ok) return;
                }
                continue;
            }

            const result = await sendHuman(sock, jid);
            if (result) success++;
            else failed++;
        } catch (err) {
            failed++;
            console.log('\n' + color.red + `Gagal proses ${jid}: ${err?.message || err}` + color.reset);
        }

        renderUI(i + 1);

        const baseDelay = randomDelay(CONFIG.minDelay, CONFIG.maxDelay);
        const chaos = Math.random() < 0.4 ? randomDelay(10000, 60000) : 0;
        {
            const ok = await waitWithLoading(baseDelay + chaos, 'Next message', () => isCurrentConnection(runId));
            if (!ok) return;
        }

        if ((i + 1) % 5 === 0) {
            process.stdout.write('\n');
            console.log('Resting...');
            {
                const ok = await waitWithLoading(30000 + Math.random() * 60000, 'Resting', () => isCurrentConnection(runId));
                if (!ok) return;
            }
            process.stdout.write('\n');
        }
    }

    process.stdout.write('\n');
    console.log('------------------------------');
    console.log(color.green + '\nDONE ALL TARGETS' + color.reset);

    if (process.env.LOOP_MODE === '1') {
        const loopDelay = Math.max(1, Number(process.env.LOOP_DELAY || 60)) * 1000;
        console.log(color.yellow + `\nAUTO LOOP: next round without reconnect in ${Math.floor(loopDelay / 1000)} seconds.` + color.reset);
        const ok = await waitWithLoading(loopDelay, 'Loop wait', () => isCurrentConnection(runId));
        if (!ok) return;
        return startWarming(sock, runId);
    }

    setTimeout(() => process.exit(0), 1500);
}

startBot();
