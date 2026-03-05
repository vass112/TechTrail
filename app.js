// Main Application Logic - Zero-Setup Local Version
let html5QrcodeScanner = null;
let currentTeam = null;
let solvedClues = [];

// Local Storage Keys
const STORAGE_KEYS = {
    CLUES: 'techtrail_clues',
    PROGRESS: 'techtrail_progress', // { team: '', solved: [] }
    SETTINGS: 'techtrail_settings' // { passcode: 'TECHTRAIL2025' }
};

const DEFAULT_SETTINGS = {
    passcode: 'TECHTRAIL2025'
};

const DEFAULT_CLUES = {
    "CLUE1": "WELCOME TO TECHTRAIL. PROCEED TO THE OLD OAK TREE.",
    "CLUE2": "THE GEARS OF PROGRESS TURN IN THE MAIN HALLWAY.",
    "CLUE3": "KNOWLEDGE IS POWER. VISIT THE LIBRARY ENTRANCE.",
    "CLUE4": "THE FINAL CHALLENGE AWAITS AT THE NORTH GATE."
};

let localCluesCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLUES)) || DEFAULT_CLUES;
let localSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || DEFAULT_SETTINGS;

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    loadProgress();
});

function loadProgress() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS));
    if (saved && saved.team) {
        currentTeam = saved.team;
        solvedClues = saved.solved || [];
        updateProgressUI();
        switchView('view-home');
    }
}

function saveProgress() {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify({
        team: currentTeam,
        solved: solvedClues
    }));
}

function initUI() {
    // Basic Routing
    document.querySelectorAll('[data-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetEl = e.target.closest('[data-target]');
            if (targetEl) {
                switchView(targetEl.dataset.target);
            }
        });
    });

    // Login logic
    document.getElementById('btn-login').addEventListener('click', () => {
        const team = document.getElementById('login-team').value.trim().toUpperCase();
        const password = document.getElementById('login-password').value.trim();
        const errEl = document.getElementById('login-error');

        if (!team || !password) {
            errEl.innerText = "ENTER CREDENTIALS";
            return;
        }

        // Special Admin check
        if (team === "ADMIN" && (password === "ananthan" || password === localSettings.passcode)) {
            refreshLeaderboard();
            document.getElementById('clue-editor-textarea').value = JSON.stringify(localCluesCache, null, 4);
            document.getElementById('new-event-passcode').value = localSettings.passcode;
            switchView('view-admin');
            return;
        }

        // Check if Event Passcode matches
        if (password.toUpperCase() === localSettings.passcode.toUpperCase()) {
            currentTeam = team;
            solvedClues = [];
            saveProgress();
            updateProgressUI();
            switchView('view-home');
        } else {
            errEl.innerText = "INVALID EVENT PASSCODE";
        }
    });

    // Scanner Triggers
    document.getElementById('btn-start').addEventListener('click', () => switchView('view-scanner'));
    document.getElementById('btn-resume').addEventListener('click', () => switchView('view-scanner'));

    const viewScanner = document.getElementById('view-scanner');
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.classList.contains('active')) {
                startScanner();
            } else {
                stopScanner();
            }
        });
    });
    observer.observe(viewScanner, { attributes: true, attributeFilter: ['class'] });

    // Clue Display Audio
    document.getElementById('btn-play-audio').addEventListener('click', playMorseAudio);

    // Admin Triggers
    document.getElementById('go-admin').addEventListener('click', () => {
        refreshLeaderboard();
        initQRGenerator();
        document.getElementById('clue-editor-textarea').value = JSON.stringify(localCluesCache, null, 4);
        document.getElementById('new-event-passcode').value = localSettings.passcode;
        switchView('view-admin');
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const newPass = document.getElementById('new-event-passcode').value.trim().toUpperCase();
        if (newPass) {
            localSettings.passcode = newPass;
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(localSettings));
            alert('Settings Saved! New Passcode: ' + newPass);
        }
    });

    document.getElementById('btn-save-clues').addEventListener('click', () => {
        try {
            const parsed = JSON.parse(document.getElementById('clue-editor-textarea').value);
            localCluesCache = parsed;
            localStorage.setItem(STORAGE_KEYS.CLUES, JSON.stringify(parsed));
            alert('Clues Updated!');
            initQRGenerator();
        } catch (e) {
            alert('Invalid JSON format!');
        }
    });

    document.getElementById('btn-reset-progress').addEventListener('click', () => {
        if (confirm('DANGER: Reset progress for THIS device?')) {
            localStorage.removeItem(STORAGE_KEYS.PROGRESS);
            solvedClues = [];
            currentTeam = null;
            updateProgressUI();
            location.reload();
        }
    });

    document.getElementById('btn-preview-audio').addEventListener('click', () => {
        const text = document.getElementById('morse-preview-input').value;
        const morse = window.MorseSynth.translateToMorse(text);
        document.getElementById('morse-preview-output').innerText = morse;
        window.MorseSynth.playSequence(morse);
    });

    document.getElementById('btn-download-qr').addEventListener('click', downloadQRCode);
}

function initQRGenerator() {
    const list = document.getElementById('qr-clue-list');
    if (!list) return;
    list.innerHTML = "";
    Object.keys(localCluesCache).forEach(id => {
        const btn = document.createElement('button');
        btn.className = "px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold hover:bg-primary/30 transition-colors";
        btn.innerText = id;
        btn.onclick = () => generateQRCode(id);
        list.appendChild(btn);
    });
}

function generateQRCode(text) {
    const container = document.getElementById('qrcode-container');
    const qrDiv = document.getElementById('qrcode');
    const label = document.getElementById('qr-label');
    const dlBtn = document.getElementById('btn-download-qr');

    qrDiv.innerHTML = "";
    new QRCode(qrDiv, {
        text: text,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    label.innerText = text;
    container.classList.remove('hidden');
    dlBtn.classList.remove('hidden');
}

function downloadQRCode() {
    const qrImg = document.querySelector('#qrcode img');
    if (!qrImg) return;
    const label = document.getElementById('qr-label').innerText;
    const link = document.createElement('a');
    link.download = `QR_${label}.png`;
    link.href = qrImg.src;
    link.click();
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function updateProgressUI() {
    document.getElementById('clues-solved').innerText = solvedClues.length;
    const hasProgress = solvedClues.length > 0;
    document.getElementById('btn-resume').style.display = hasProgress ? 'flex' : 'none';
    document.getElementById('btn-start').style.display = hasProgress ? 'none' : 'flex';
}

function refreshLeaderboard() {
    const list = document.getElementById('leaderboard-container');
    if (!list) return;
    list.innerHTML = `
        <div class="p-4 bg-black/60 rounded-xl border border-primary/20">
            <p class="text-xs text-primary uppercase font-bold mb-3">Local Session Summary</p>
            <div class="flex justify-between items-center mb-2">
                <span class="text-slate-100 font-bold">${currentTeam || 'NO TEAM'}</span>
                <span class="text-primary font-mono">${solvedClues.length} CLUES</span>
            </div>
            <p class="text-[10px] text-slate-500 italic mt-3 border-t border-primary/10 pt-2 text-center">
                * Zero-Backend Mode: Each device scales independently.
            </p>
        </div>
    `;
}

function startScanner() {
    if (html5QrcodeScanner) return;
    html5QrcodeScanner = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .catch(err => {
            document.getElementById('scanner-error').innerText = "Camera Permission Required";
            console.error(err);
        });
}

function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }).catch(err => console.error(err));
    }
}

function onScanSuccess(decodedText) {
    if (localCluesCache[decodedText]) {
        stopScanner();
        if (!solvedClues.includes(decodedText)) {
            solvedClues.push(decodedText);
            saveProgress();
            updateProgressUI();
        }
        displayClue(decodedText, localCluesCache[decodedText]);
        switchView('view-clue');
    } else {
        document.getElementById('scanner-error').innerText = "INVALID CLUE NODE";
        setTimeout(() => { if (document.getElementById('scanner-error')) document.getElementById('scanner-error').innerText = ""; }, 2500);
    }
}

function onScanFailure(error) { }

function displayClue(id, text) {
    document.getElementById('clue-id-display').innerText = id + " SECURED";
    const morse = window.MorseSynth.translateToMorse(text);
    document.getElementById('morse-display').innerText = morse;
    document.getElementById('morse-display').dataset.morse = morse;
}

function playMorseAudio() {
    const morse = document.getElementById('morse-display').dataset.morse;
    if (!morse) return;

    const btn = document.getElementById('btn-play-audio');
    btn.disabled = true;
    btn.classList.add('pulse-audio');
    btn.innerHTML = `<span class="material-symbols-outlined text-2xl font-bold animate-pulse">graphic_eq</span><span class="text-lg font-bold uppercase tracking-wider">TRANSMITTING...</span>`;

    window.MorseSynth.playSequence(morse, () => {
        btn.disabled = false;
        btn.classList.remove('pulse-audio');
        btn.innerHTML = `<span class="material-symbols-outlined text-2xl font-bold">graphic_eq</span><span class="text-lg font-bold uppercase tracking-wider">PLAY MORSE AUDIO</span>`;
    });
}
