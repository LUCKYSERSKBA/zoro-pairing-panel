const cluster = require('cluster');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// ============================================
// CLUSTER MASTER PROCESS (OPTIMIZED FOR ZERO LAG)
// ============================================
if (cluster.isPrimary || cluster.isMaster) {
    console.log('\n╔════════════════════════════════════╗');
    console.log('║  🛡️ ZORO MD SYSTEM MONITOR ACTIVE    ║');
    console.log('╚════════════════════════════════════╝\n');
    console.log(`✅ Master process (PID: ${process.pid}) is running...`);
    
    // Fork a single worker to prevent CPU overload and message lag
    cluster.fork();

    cluster.on('exit', (worker, code, signal) => {
        console.log(`\n⚠️ Bot worker process stopped. Restarting immediately...\n`);
        setTimeout(() => {
            cluster.fork();
        }, 1000);
    });

} else {
    // ============================================
    // WORKER PROCESS (LIGHTNING FAST EXECUTION)
    // ============================================

    const app = express();
    const PORT = process.env.SERVER_PORT || process.env.PORT || 8000;

    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const SESSIONS_DIR = path.join(__dirname, 'sessions');
    if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }

    // ============================================
    // MODULE UPDATER (NON-BLOCKING)
    // ============================================
    async function downloadAndExtractModules() {
        const settingsPath = path.join(__dirname, 'settings.js');
        const modulesInstalledFlag = path.join(__dirname, '.modules_installed');
        
        if (fs.existsSync(modulesInstalledFlag)) return true;
        if (!fs.existsSync(settingsPath)) return false;
        
        const settings = require('./settings');
        const zipUrl = settings.updateZipUrl;
        if (!zipUrl) return false;

        const TEMP_DIR = path.join(__dirname, 'temp_update');
        const ZIP_FILE = path.join(TEMP_DIR, 'modules.zip');
        const EXTRACT_DIR = path.join(TEMP_DIR, 'extracted');

        try {
            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

            const response = await axios({
                method: 'get',
                url: zipUrl,
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            fs.writeFileSync(ZIP_FILE, response.data);
            if (fs.existsSync(EXTRACT_DIR)) fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
            fs.mkdirSync(EXTRACT_DIR, { recursive: true });

            execSync(`unzip -o "${ZIP_FILE}" -d "${EXTRACT_DIR}"`, { stdio: 'pipe' });

            const extractedFolders = fs.readdirSync(EXTRACT_DIR);
            const moduleFolder = extractedFolders.find(f => f.includes('ZORO-MD-MODULES') || f.includes('MODULES'));
            
            if (!moduleFolder) return false;

            const sourcePath = path.join(EXTRACT_DIR, moduleFolder);
            const basePath = __dirname;
            const foldersToSync = ['lib', 'plugins', 'data', 'media'];
            const filesToSync = ['main.js', 'config.js'];

            for (const folder of foldersToSync) {
                const sourceFolder = path.join(sourcePath, folder);
                const destFolder = path.join(basePath, folder);
                if (fs.existsSync(sourceFolder)) {
                    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
                    fs.cpSync(sourceFolder, destFolder, { recursive: true, force: true });
                }
            }

            for (const file of filesToSync) {
                const sourceFile = path.join(sourcePath, file);
                const destFile = path.join(basePath, file);
                if (fs.existsSync(sourceFile)) fs.copyFileSync(sourceFile, destFile);
            }

            fs.rmSync(TEMP_DIR, { recursive: true, force: true });
            fs.writeFileSync(modulesInstalledFlag, new Date().toISOString());
            return true;
        } catch (error) {
            if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
            return false;
        }
    }

    // ============================================
    // FFMPEG CHECK
    // ============================================
    async function checkAndInstallFFmpeg() {
        const ffmpegDir = path.join(__dirname, 'ffmpeg_bin');
        const ffmpegPath = path.join(ffmpegDir, 'ffmpeg');
        
        try {
            execSync('ffmpeg -version', { stdio: 'pipe', encoding: 'utf8' });
            return true;
        } catch (error) {}
        
        if (fs.existsSync(ffmpegPath)) {
            process.env.PATH = `${ffmpegDir}:${process.env.PATH}`;
            return true;
        }
        return false;
    }

    // ============================================
    // QUEUE SYSTEM (OPTIMIZED 2s DELAY)
    // ============================================
    const sessionQueues = {};

    async function processQueue(phone, sock) {
        if (!sessionQueues[phone] || sessionQueues[phone].isProcessing) return;
        sessionQueues[phone].isProcessing = true;

        while (sessionQueues[phone].queue.length > 0) {
            const { currentSock, currentUpdate } = sessionQueues[phone].queue.shift();
            try {
                const mek = currentUpdate.messages[0];
                if (!mek.message) continue;
                
                const { handleMessages, handleStatus } = require('./main');
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    if (typeof handleStatus === 'function') await handleStatus(currentSock, currentUpdate);
                    continue;
                }
                if (typeof handleMessages === 'function') {
                    await handleMessages(currentSock, currentUpdate, true);
                }
            } catch (err) {}

            if (global.gc) {
                try { global.gc(); } catch (e) {}
            }

            // Optimized queue delay set to 2 seconds for smooth command execution
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        sessionQueues[phone].isProcessing = false;
    }

    // ============================================
    // MULTI-SESSION RUNNER
    // ============================================
    async function startZoroSession(phone, res = null) {
        const sessionName = `session_${phone}`;
        const sessionPath = path.join(SESSIONS_DIR, sessionName);

        if (!sessionQueues[phone]) {
            sessionQueues[phone] = { queue: [], isProcessing: false };
        }

        try {
            const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason } = require('@aadhixd777/baileys');
            const pino = require("pino");
            const NodeCache = require("node-cache");
            const store = require('./lib/lightweight_store');
            const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');

            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version } = await fetchLatestBaileysVersion();
            const msgRetryCounterCache = new NodeCache();

            const sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                msgRetryCounterCache,
            });

            if (store && store.bind) store.bind(sock.ev);
            sock.ev.on('creds.update', saveCreds);

            if (!sock.authState.creds.registered && res) {
                setTimeout(async () => {
                    try {
                        let code = await sock.requestPairingCode(phone);
                        code = code?.match(/.{1,4}/g)?.join("-") || code;
                        if (!res.headersSent) res.json({ code });
                    } catch (err) {
                        if (!res.headersSent) res.json({ error: 'Failed to request pairing code. Try again.' });
                    }
                }, 2000);
            }

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
                        try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (e) {}
                    } else {
                        setTimeout(() => startZoroSession(phone), 3000);
                    }
                }
            });

            sock.ev.on('messages.upsert', async chatUpdate => {
                try {
                    const mek = chatUpdate.messages[0];
                    if (!mek.message) return;
                    
                    const text = (
                        mek.message?.conversation || 
                        mek.message?.extendedTextMessage?.text || 
                        mek.message?.imageMessage?.caption || 
                        mek.message?.videoMessage?.caption || 
                        ''
                    ).toLowerCase().trim();

                    if (text.startsWith('.menu') || text.startsWith('.alive') || text.startsWith('.help')) {
                        if (!sessionQueues[phone]) sessionQueues[phone] = { queue: [], isProcessing: false };
                        sessionQueues[phone].queue.push({ currentSock: sock, currentUpdate: chatUpdate });
                        processQueue(phone, sock);
                    } else {
                        if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                            if (typeof handleStatus === 'function') await handleStatus(sock, chatUpdate);
                            return;
                        }
                        if (typeof handleMessages === 'function') await handleMessages(sock, chatUpdate, true);
                    }
                } catch (err) {}
            });

            sock.ev.on('group-participants.update', async (update) => {
                try {
                    if (typeof handleGroupParticipantUpdate === 'function') await handleGroupParticipantUpdate(sock, update);
                } catch (err) {}
            });

            return sock;
        } catch (e) {}
    }

    async function restoreExistingSessions() {
        if (fs.existsSync(SESSIONS_DIR)) {
            const sessionFolders = fs.readdirSync(SESSIONS_DIR);
            for (const folder of sessionFolders) {
                if (folder.startsWith('session_')) {
                    const phone = folder.replace('session_', '');
                    startZoroSession(phone);
                }
            }
        }
    }

    app.get('/', (req, res) => {
        res.send(`<!DOCTYPE html><html><head><title>Zoro MD</title></head><body style="background:#0f172a;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;"><div style="background:#1e293b;padding:30px;border-radius:12px;text-align:center;"><h2>Zoro MD Pairing</h2><form id="pairForm"><input type="text" id="phone" placeholder="919876543210" required style="padding:10px;margin-bottom:10px;width:100%;background:#0f172a;color:#fff;border:1px solid #334155;border-radius:5px;"><button type="submit" style="background:#0284c7;color:#fff;border:none;padding:10px;width:100%;border-radius:5px;cursor:pointer;">Get Code</button></form><div id="result" style="margin-top:10px;color:#4ade80;"></div></div><script>document.getElementById('pairForm').addEventListener('submit', async(e)=>{e.preventDefault();const p=document.getElementById('phone').value.trim();const r=document.getElementById('result');r.innerText="Loading...";const res=await fetch('/pair?phone='+p);const d=await res.json();if(d.code)r.innerHTML="Code: <h1 style='color:#f43f5e;'>"+d.code+"</h1>";else r.innerText="Error!";});</script></body></html>`);
    });

    app.get('/pair', async (req, res) => {
        let phone = req.query.phone;
        if (!phone) return res.json({ error: 'Phone required' });
        phone = phone.replace(/[^0-9]/g, '');
        const sessionPath = path.join(SESSIONS_DIR, `session_${phone}`);
        try {
            if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
            await startZoroSession(phone, res);
        } catch (e) {
            if (!res.headersSent) res.json({ error: 'Error' });
        }
    });

    async function startBot() {
        app.listen(PORT, () => {});
        await downloadAndExtractModules();
        await checkAndInstallFFmpeg();
        await restoreExistingSessions();
    }

    startBot().catch(error => process.exit(1));
}
