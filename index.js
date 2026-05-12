if (process.env.RUN_FROM_SH !== "1") {
    console.log("\n[!] Gunakan bot.sh\n");
    process.exit(1);
}

process.env.BAILEYS_NO_QR = "true";

if (process.env.MULTI_RUN !== '1') console.clear();
console.log(`Starting bot [${process.env.SESSION || 'default'}]...\n`);

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
const { spawnSync } = require('child_process');
let qrcodeTerminal = null;
try {
    qrcodeTerminal = require('qrcode-terminal');
} catch {
    qrcodeTerminal = null;
}

let qrcodeImage = null;
try {
    qrcodeImage = require('qrcode');
} catch {
    qrcodeImage = null;
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
function getLoopDelayMs() {
    const fixed = Number(process.env.LOOP_DELAY || 0);
    const min = Math.max(1, Number(process.env.LOOP_DELAY_MIN || fixed || 60));
    const max = Math.max(min, Number(process.env.LOOP_DELAY_MAX || min));
    return randomDelay(min, max) * 1000;
}

function humanTypingDelay(text) {
    const base = 300;
    const variance = Math.random() * 2000;
    return Math.min(20000, text.length * base + variance);
}

async function randomHumanPause() {
    if (Math.random() < Number(CONFIG.presenceOnlyChance ?? 0)) {
        const delayTime = Math.floor(Math.random() * 600000) + 60000;
        await delay(delayTime);
    }
}

function shouldReply() {
    const chance = Number(CONFIG.sendChance ?? 1);
    return Math.random() < Math.max(0, Math.min(1, chance));
}

const lastChat = {};
const lastIncomingMessages = {};

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
const MULTI_RUN = process.env.MULTI_RUN === '1';
const LIST_GROUPS = process.env.LIST_GROUPS === '1';
const SESSION_PATH = `./sessions/${SESSION_NAME}`;
const HISTORY_FILE = './nomor_wa.txt';
const LOG_DIR = './logs';
const LOG_FILE = `${LOG_DIR}/${SESSION_NAME}.log`;

function nowStamp() {
    const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return wib.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
}

function maskJid(jid) {
    const raw = String(jid || '');
    const id = raw.replace(/@.*/, '');
    const suffix = raw.endsWith('@g.us') ? '@g' : '';
    if (id.length <= 6) return (id || '-') + suffix;
    return `${id.slice(0, 4)}***${id.slice(-3)}${suffix}`;
}

function compactActivity(message) {
    return String(message)
        .replace(/^Using saved session$/, 'session saved')
        .replace(/^Connected and ready$/, 'ready')
        .replace(/^Starting send round$/, 'round start')
        .replace(/^Loaded (\d+) target\(s\)$/, 'targets=$1')
        .replace(/^Processing target (\d+)\/(\d+): (.+)$/, 'target $1/$2 $3')
        .replace(/^Message sent: (.+)$/, 'sent $1')
        .replace(/^Round done\. OK (\d+), FAIL (\d+)$/, 'done ok=$1 fail=$2')
        .replace(/^Auto loop next round in (\d+) seconds$/, 'next loop $1s')
        .replace(/^Waiting next message base delay (\d+)s$/, 'wait next $1s')
        .replace(/^Disconnect (.+)$/, 'disconnect $1')
        .replace(/^Reconnect in (\d+) seconds \((.+)\)$/, 'reconnect $1s $2')
        .replace(/^Connecting\.\.\.$/, 'connecting');
}

function safeFileName(value) {
    return String(value || 'default').replace(/[^a-z0-9_-]/gi, '_');
}

function runDetached(command, args) {
    const result = spawnSync(command, args, {
        stdio: 'ignore',
        timeout: 2000
    });

    return !result.error && result.status === 0;
}

function openFileFlexible(filePath) {
    const openers = [
        ['termux-open', [filePath]],
        ['xdg-open', [filePath]],
        ['wslview', [filePath]]
    ];

    for (const [command, args] of openers) {
        if (runDetached(command, args)) return true;
    }

    return false;
}

function shouldShowTerminalQr() {
    const mode = String(CONFIG.qrDisplay || 'auto').toLowerCase();
    if (mode === 'terminal') return true;
    if (mode === 'file') return false;

    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 40;
    return cols >= Number(CONFIG.qrMinColumns || 90) && rows >= Number(CONFIG.qrMinRows || 42);
}

async function renderFlexibleQr(qr) {
    const baseName = `qr-login-${safeFileName(SESSION_NAME)}`;
    const txtFile = `${baseName}.txt`;
    const htmlFile = `${baseName}.html`;
    const pngFile = `${baseName}.png`;

    fs.writeFileSync(txtFile, qr + '\n');

    if (qrcodeImage) {
        const dataUrl = await qrcodeImage.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: Number(CONFIG.qrImageSize || 640)
        });
        const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>WA QR ${SESSION_NAME}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#eee;font-family:sans-serif}main{text-align:center;padding:16px}img{width:min(92vw,720px);height:auto;background:white;padding:12px;border-radius:8px}p{font-size:14px}</style></head><body><main><img src="${dataUrl}" alt="WA QR"><p>Scan dari WhatsApp &gt; Perangkat Tertaut &gt; Scan QR Code</p></main></body></html>`;
        fs.writeFileSync(htmlFile, html);
        const pngData = dataUrl.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(pngFile, Buffer.from(pngData, 'base64'));

        if (openFileFlexible(pngFile) || openFileFlexible(htmlFile)) {
            console.log(`QR dibuka fleksibel: ${pngFile}`);
        } else {
            console.log(`QR tersimpan: ${pngFile}`);
            console.log(`Jika tidak terbuka otomatis, buka file: ${htmlFile}`);
        }
    } else {
        console.log('Module qrcode belum terinstall untuk membuat gambar QR fleksibel.');
        console.log('Jalankan AUTO INSTALLER atau: npm install qrcode');
    }

    if (shouldShowTerminalQr() && qrcodeTerminal) {
        console.log('');
        qrcodeTerminal.generate(qr, { small: true });
    } else {
        console.log('Terminal sempit, QR terminal disembunyikan agar tidak kepotong.');
        console.log(`Raw QR tersimpan: ${txtFile}`);
    }
}
function logActivity(message, level = 'INFO') {
    const stamp = nowStamp();
    const fileLine = `[${stamp}] [${SESSION_NAME}] [${level}] ${message}`;
    const terminalLine = `[${stamp.slice(11)}] ${SESSION_NAME.padEnd(8).slice(0, 8)} ${level.padEnd(5).slice(0, 5)} ${compactActivity(message)}`;
    const terminalColor = level === 'ERROR' ? color.red : level === 'WARN' ? color.yellow : color.cyan;

    process.stdout.write('\x1b[2K');
    process.stdout.write('\r');
    console.log(terminalColor + terminalLine + color.reset);

    try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        fs.appendFileSync(LOG_FILE, fileLine + '\n');
    } catch {}
}

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

function parseTarget(line) {
    const raw = String(line || '').trim();
    if (!raw || raw.startsWith('#')) return null;

    const lower = raw.toLowerCase();
    if (lower.endsWith('@g.us')) {
        const groupId = raw.replace(/\s+/g, '');
        const groupNumber = groupId.replace(/@g\.us$/i, '').replace(/[^0-9-]/g, '');
        if (groupNumber.length < 8) return null;
        return groupNumber + '@g.us';
    }

    let nomor = raw.replace(/[^0-9]/g, '');
    if (nomor.startsWith('0')) nomor = '62' + nomor.slice(1);
    if (nomor.length < 9) return null;
    return nomor + '@s.whatsapp.net';
}

function loadTargets() {
    if (!fs.existsSync(HISTORY_FILE)) return [];

    return fs.readFileSync(HISTORY_FILE, 'utf-8')
        .split('\n')
        .map(parseTarget)
        .filter(Boolean);
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
    const prefix = `[${SESSION_NAME}] `;
    const line = `[${nowStamp().slice(11)}] ${prefix}SEND ${percent}% | ${bar} | OK ${success} FAIL ${failed} | ETA ${eta}s`;

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
        const prefix = `[${SESSION_NAME}] `;
        process.stdout.write(`\r[${nowStamp().slice(11)}] ${prefix}${label} [${bar}] ${percent}% | wait ${seconds}s`);

        if (remaining <= 0) break;
        await delay(Math.min(1000, remaining));
    }

    process.stdout.write('\x1b[2K');
    process.stdout.write('\r');
    return true;
}
async function printGroupList(sock) {
    logActivity('Loading group list');

    const groups = await sock.groupFetchAllParticipating();
    const list = Object.values(groups || {})
        .sort((a, b) => String(a.subject || '').localeCompare(String(b.subject || '')));

    console.log('');
    console.log('GROUP LIST');
    console.log('----------------------------------------');

    if (!list.length) {
        console.log('No joined group found for this account.');
        return;
    }

    list.forEach((group, index) => {
        const name = group.subject || '-';
        console.log(`${index + 1}. ${name}`);
        console.log(`   ${group.id}`);
    });

    console.log('');
    console.log('Tambahkan JID group ke menu TAMBAH TARGET atau nomor_wa.txt.');
}
function rememberIncomingMessage(message) {
    const jid = message?.key?.remoteJid;
    if (!jid || message?.key?.fromMe) return;
    lastIncomingMessages[jid] = message.key;
}

async function markChatReadBeforeTyping(sock, jid) {
    const key = lastIncomingMessages[jid];
    if (!key || typeof sock.readMessages !== 'function') return false;

    await sock.readMessages([key]);
    logActivity(`Marked read before typing: ${maskJid(jid)}`);
    await delay(randomDelay(800, 2500));
    return true;
}
function isGroupJid(jid) {
    return String(jid || '').endsWith('@g.us');
}

async function ensureGroupReady(sock, jid) {
    if (!isGroupJid(jid)) return;

    try {
        await sock.groupMetadata(jid);
    } catch (err) {
        throw new Error(`Group not found or this account is not a member: ${err?.message || err}`);
    }
}

async function sendHuman(sock, jid) {
    if (!shouldReply()) return false;

    for (let i = 0; i < CONFIG.retry; i++) {
        try {
            const text = randomMessage();
            const groupTarget = isGroupJid(jid);

            await ensureGroupReady(sock, jid);
            await randomHumanPause();
            await markChatReadBeforeTyping(sock, jid);

            if (!groupTarget) await sock.sendPresenceUpdate('composing', jid);
            await delay(humanTypingDelay(text));
            await sock.sendMessage(jid, { text });
            if (!groupTarget) await sock.sendPresenceUpdate('paused', jid);

            return true;
        } catch (err) {
            logActivity(`Retry ${i + 1}/${CONFIG.retry} failed ${maskJid(jid)}: ${err?.message || err}`, 'WARN');
            await delay(3000 + Math.random() * 5000);
        }
    }

    return false;
}

let isRunning = false;
let reconnectTimer = null;
let reconnectCount = 0;
let forbiddenCount = 0;
let selectedLoginMethod = null;
let activeRunId = 0;
let connectionAlive = false;

function getForbiddenCooldownMs() {
    const shortMin = Number(CONFIG.forbiddenCooldownMin || 600000);
    const shortMax = Number(CONFIG.forbiddenCooldownMax || 1200000);
    const longMin = Number(CONFIG.forbiddenLongCooldownMin || 1800000);
    const longMax = Number(CONFIG.forbiddenLongCooldownMax || 3600000);

    if (forbiddenCount >= 3) return randomDelay(longMin, longMax);
    return randomDelay(shortMin, shortMax);
}

function scheduleReconnect(reason, customDelayMs) {
    if (reconnectTimer) return;

    isRunning = false;
    const delayMs = customDelayMs ?? Math.min(300000, 5000 + reconnectCount * 15000);
    reconnectCount++;

    logActivity(`Reconnect in ${Math.floor(delayMs / 1000)} seconds (${reason || 'unknown'})`, 'WARN');

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
            logActivity('Using saved session');
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
        sock.ev.on('messages.upsert', ({ messages }) => {
            for (const message of messages || []) rememberIncomingMessage(message);
        });
        let warmingStarted = false;
        let authReady = sock.authState.creds.registered;
        let lastQr = '';

        sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
            const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;

            if (qr && loginMethod === 'qr' && qr !== lastQr) {
                lastQr = qr;
                if (!MULTI_RUN) console.clear();
                console.log(color.yellow + 'LOGIN QR CODE' + color.reset);
                logActivity('QR code generated, waiting for scan');
                console.log('Scan QR ini dari WhatsApp:');
                console.log('Perangkat Tertaut > Tautkan Perangkat > Scan QR Code\n');

                renderFlexibleQr(qr).catch((err) => {
                    console.log(color.red + 'QR ERROR: ' + (err?.message || err) + color.reset);
                    if (qrcodeTerminal) qrcodeTerminal.generate(qr, { small: true });
                    else console.log(qr);
                });
            }

            if (connection === 'connecting' && authReady && !waitingForPairingInput) {
                logActivity('Connecting...', 'WARN');
            }

            if (connection === 'open') {
                authReady = true;
                selectedLoginMethod = null;
                connectionAlive = true;
                isRunning = true;
                reconnectCount = 0;
                forbiddenCount = 0;

                if (warmingStarted) return;
                warmingStarted = true;

                if (!MULTI_RUN) console.clear();
                console.log(color.green + `[${nowStamp().slice(11)}] BOT CONNECTED [${SESSION_NAME}]\n` + color.reset);
                logActivity('Connected and ready');

                if (LIST_GROUPS) {
                    printGroupList(sock)
                        .catch((err) => console.log(color.red + 'LIST GROUP ERROR: ' + (err?.message || err) + color.reset))
                        .finally(() => setTimeout(() => process.exit(0), 500));
                    return;
                }

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

                logActivity(`Disconnect ${reason || 'unknown'}`, 'ERROR');

                if (reason === DisconnectReason.loggedOut || reason === 401) {
                    selectedLoginMethod = null;
                    logActivity('Session logout. Delete this session and pair again.', 'ERROR');
                    return;
                }

                if (reason === DisconnectReason.restartRequired || reason === 515) {
                    logActivity('Restarting connection, keep scanning/waiting...', 'WARN');
                    scheduleReconnect('restart required', 1000);
                    return;
                }

                if (reason === 403) {
                    forbiddenCount++;
                    const cooldown = getForbiddenCooldownMs();
                    logActivity(`403 cooldown ${Math.floor(cooldown / 1000)}s. Account may need rest or session check.`, 'WARN');
                    scheduleReconnect('403 cooldown', cooldown);
                    return;
                }

                scheduleReconnect(reason);
            }
        });

        await handleAuth(sock, question, color, loginMethod);
        authReady = sock.authState.creds.registered;
    } catch (err) {
        isRunning = false;
        logActivity('ERROR START BOT: ' + (err?.message || err), 'ERROR');
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

    logActivity('Starting send round');

    try {
        await sock.sendPresenceUpdate('available');
    } catch {}

    const targets = loadTargets();

    if (!targets.length) {
        logActivity('nomor_wa.txt is empty', 'WARN');
        if (process.env.LOOP_MODE === '1') {
            const loopDelay = getLoopDelayMs();
            const ok = await waitWithLoading(loopDelay, 'Loop wait', () => isCurrentConnection(runId));
            if (!ok) return;
            return startWarming(sock, runId);
        }
        return;
    }

    total = targets.length;
    logActivity(`Loaded ${total} target(s)`);
    success = 0;
    failed = 0;
    startTime = Date.now();

    for (let i = 0; i < targets.length; i++) {
        if (!isCurrentConnection(runId)) return;

        const jid = targets[i];
        logActivity(`Processing target ${i + 1}/${targets.length}: ${maskJid(jid)}`);

        if (!canSend(jid)) {
            logActivity(`Skipped cooldown: ${maskJid(jid)}`, 'WARN');
            renderUI(i + 1);
            continue;
        }

        try {
            if (Math.random() < Number(CONFIG.presenceOnlyChance ?? 0)) {
                await sock.sendPresenceUpdate('available', jid);
                logActivity(`Presence only: ${maskJid(jid)}`);
                renderUI(i + 1);
                {
                    const ok = await waitWithLoading(5000 + Math.random() * 10000, 'Next target', () => isCurrentConnection(runId));
                    if (!ok) return;
                }
                continue;
            }

            const result = await sendHuman(sock, jid);
            if (result) {
                success++;
                logActivity(`Message sent: ${maskJid(jid)}`);
            } else {
                failed++;
                logActivity(`Message skipped by sendChance: ${maskJid(jid)}`, 'WARN');
            }
        } catch (err) {
            failed++;
            logActivity(`Failed target ${maskJid(jid)}: ${err?.message || err}`, 'ERROR');
        }

        renderUI(i + 1);

        const isLastTarget = i === targets.length - 1;

        if (!isLastTarget) {
            const baseDelay = randomDelay(CONFIG.minDelay, CONFIG.maxDelay);
            logActivity(`Waiting next message base delay ${Math.floor(baseDelay / 1000)}s`);
            const chaos = Math.random() < 0.4 ? randomDelay(10000, 60000) : 0;
            {
                const ok = await waitWithLoading(baseDelay + chaos, 'Next message', () => isCurrentConnection(runId));
                if (!ok) return;
            }
        }

        if (!isLastTarget && (i + 1) % 5 === 0) {
            process.stdout.write('\n');
            logActivity('Resting after 5 targets');
            {
                const ok = await waitWithLoading(30000 + Math.random() * 60000, 'Resting', () => isCurrentConnection(runId));
                if (!ok) return;
            }
            process.stdout.write('\n');
        }
    }

    process.stdout.write('\n');
    if (!MULTI_RUN) {
        console.log('------------------------------');
        console.log(color.green + '\nDONE ALL TARGETS' + color.reset);
    }
    logActivity(`Round done. OK ${success}, FAIL ${failed}`);

    if (process.env.LOOP_MODE === '1') {
        const loopDelay = getLoopDelayMs();
        logActivity(`Auto loop next round in ${Math.floor(loopDelay / 1000)} seconds`, 'WARN');
        const ok = await waitWithLoading(loopDelay, 'Loop wait', () => isCurrentConnection(runId));
        if (!ok) return;
        return startWarming(sock, runId);
    }

    setTimeout(() => process.exit(0), 1500);
}

startBot();
