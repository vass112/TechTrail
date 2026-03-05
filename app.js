// Main Application Logic - Google Auth + Local Storage Version
let html5QrcodeScanner = null;
let currentUser = null; // Firebase User object
let currentTeam = null;
let solvedClues = [];

// Local Storage Keys
const getStorageKey = (uid, type) => `techtrail_${uid}_${type}`;
const SETTINGS_KEY = 'techtrail_global_settings';
const DEFAULT_CLUES = {
    "CLUE1": "WELCOME TO TECHTRAIL. PROCEED TO THE OLD OAK TREE.",
    "CLUE2": "THE GEARS OF PROGRESS TURN IN THE MAIN HALLWAY.",
    "CLUE3": "KNOWLEDGE IS POWER. VISIT THE LIBRARY ENTRANCE.",
    "CLUE4": "THE FINAL CHALLENGE AWAITS AT THE NORTH GATE."
};

let localCluesCache = JSON.parse(localStorage.getItem('techtrail_clues')) || DEFAULT_CLUES;

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initAuth();
});

function initAuth() {
    if (!window.auth) {
        console.warn("Firebase Auth not initialized. Please set your config in index.html");
        return;
    }

    window.auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            checkTeamRegistration();
        } else {
            currentUser = null;
            currentTeam = null;
            switchView('view-login');
        }
    });
}

function checkTeamRegistration() {
    const savedTeam = localStorage.getItem(getStorageKey(currentUser.uid, 'team'));
    if (savedTeam) {
        currentTeam = savedTeam;
        loadProgress();
        updateProgressUI();
        switchView('view-home');
    } else {
        // Show Team Setup View
        document.getElementById('user-name').innerText = currentUser.displayName || 'Agent';
        document.getElementById('user-avatar').src = currentUser.photoURL || '';
        switchView('view-setup-team');
    }
}

function loadProgress() {
    const savedSolved = JSON.parse(localStorage.getItem(getStorageKey(currentUser.uid, 'solved'))) || [];
    solvedClues = savedSolved;
}

function saveProgress() {
    if (currentUser) {
        localStorage.setItem(getStorageKey(currentUser.uid, 'solved'), JSON.stringify(solvedClues));
    }
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

    // Google Login
    document.getElementById('btn-google-login').addEventListener('click', () => {
        if (!window.auth) {
            alert("Firebase not configured. Check index.html lines 20-27.");
            return;
        }
        window.auth.signInWithPopup(window.googleProvider).catch(err => {
            document.getElementById('login-error').innerText = err.message;
        });
    });

    // Team Finalization
    document.getElementById('btn-finalize-setup').addEventListener('click', () => {
        const teamName = document.getElementById('setup-team-name').value.trim().toUpperCase();
        if (!teamName) {
            document.getElementById('setup-error').innerText = "ENTER A team NAME";
            return;
        }

        currentTeam = teamName;
        localStorage.setItem(getStorageKey(currentUser.uid, 'team'), teamName);
        solvedClues = [];
        saveProgress();
        updateProgressUI();
        switchView('view-home');
    });

    // Admin Login (Override)
    document.getElementById('btn-admin-login').addEventListener('click', () => {
        const id = document.getElementById('login-team').value.trim();
        const pass = document.getElementById('login-password').value.trim();

        if (id === "admin" && pass === "ananthan") {
            refreshLeaderboard();
            document.getElementById('clue-editor-textarea').value = JSON.stringify(localCluesCache, null, 4);
            switchView('view-admin');
        } else {
            document.getElementById('login-error').innerText = "INVALID ADMIN CREDENTIALS";
        }
    });

    // Home Actions
    document.getElementById('btn-start').addEventListener('click', () => switchView('view-scanner'));
    document.getElementById('btn-resume').addEventListener('click', () => switchView('view-scanner'));

    // Admin Panel
    document.getElementById('go-admin').addEventListener('click', () => {
        refreshLeaderboard();
        initQRGenerator();
        document.getElementById('clue-editor-textarea').value = JSON.stringify(localCluesCache, null, 4);
        switchView('view-admin');
    });

    document.getElementById('btn-save-clues').addEventListener('click', () => {
        try {
            const parsed = JSON.parse(document.getElementById('clue-editor-textarea').value);
            localCluesCache = parsed;
            localStorage.setItem('techtrail_clues', JSON.stringify(parsed));
            alert('Clues Updated!');
            initQRGenerator();
        } catch (e) {
            alert('Invalid JSON format!');
        }
    });

    document.getElementById('btn-reset-progress').addEventListener('click', () => {
        if (confirm('DANGER: Reset progress for THIS account?')) {
            if (currentUser) {
                localStorage.removeItem(getStorageKey(currentUser.uid, 'solved'));
                localStorage.removeItem(getStorageKey(currentUser.uid, 'team'));
                window.auth.signOut();
            }
            location.reload();
        }
    });

    // Audio / Morse
    document.getElementById('btn-play-audio').addEventListener('click', playMorseAudio);

    document.getElementById('btn-preview-audio').addEventListener('click', () => {
        const text = document.getElementById('morse-preview-input').value;
        const morse = window.MorseSynth.translateToMorse(text);
        document.getElementById('morse-preview-output').innerText = morse;
        window.MorseSynth.playSequence(morse);
    });

    document.getElementById('btn-download-qr').addEventListener('click', downloadQRCode);

    // Scanner Observer
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
            <p class="text-xs text-primary uppercase font-bold mb-3">Identity Context</p>
            <div class="flex items-center gap-4 mb-4">
                <img src="${currentUser?.photoURL || ''}" class="w-10 h-10 rounded-full border border-primary/40">
                <div>
                    <p class="text-slate-100 font-bold">${currentTeam || 'UNINITIALIZED'}</p>
                    <p class="text-slate-500 text-[10px] font-mono">${currentUser?.email || 'OFFLINE'}</p>
                </div>
            </div>
            <div class="flex justify-between items-center pt-3 border-t border-primary/10">
                <span class="text-primary font-mono text-sm">PROGRESS</span>
                <span class="text-slate-100 font-bold">${solvedClues.length} NODES</span>
            </div>
        </div>
    `;
}

function startScanner() {
    if (html5QrcodeScanner) return;
    html5QrcodeScanner = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .catch(err => {
            document.getElementById('scanner-error').innerText = "Access Denied";
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
        document.getElementById('scanner-error').innerText = "NODE NOT RECOGNIZED";
        setTimeout(() => { if (document.getElementById('scanner-error')) document.getElementById('scanner-error').innerText = ""; }, 2000);
    }
}

function onScanFailure(error) { }

function displayClue(id, text) {
    document.getElementById('clue-id-display').innerText = id + " SYNCED";
    const morse = window.MorseSynth.translateToMorse(text);
    document.getElementById('morse-display').innerText = morse;
    document.getElementById('morse-display').dataset.morse = morse;
}

function playMorseAudio() {
    const morse = document.getElementById('morse-display').dataset.morse;
    const btn = document.getElementById('btn-play-audio');
    btn.disabled = true;
    btn.classList.add('pulse-audio');
    btn.innerHTML = `<span class="material-symbols-outlined text-2xl font-bold animate-pulse">graphic_eq</span><span class="text-lg font-bold uppercase tracking-wider">SYNCING...</span>`;

    window.MorseSynth.playSequence(morse, () => {
        btn.disabled = false;
        btn.classList.remove('pulse-audio');
        btn.innerHTML = `<span class="material-symbols-outlined text-2xl font-bold">graphic_eq</span><span class="text-lg font-bold uppercase tracking-wider">PLAY MORSE AUDIO</span>`;
    });
}

function initQRGenerator() {
    const list = document.getElementById('qr-clue-list');
    if (!list) return;
    list.innerHTML = "";
    Object.keys(localCluesCache).forEach(id => {
        const btn = document.createElement('button');
        btn.className = "px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold";
        btn.innerText = id;
        btn.onclick = () => generateQRCode(id);
        list.appendChild(btn);
    });
}

function generateQRCode(text) {
    const container = document.getElementById('qrcode-container');
    const qrDiv = document.getElementById('qrcode');
    const label = document.getElementById('qr-label');
    qrDiv.innerHTML = "";
    new QRCode(qrDiv, { text: text, width: 256, height: 256 });
    label.innerText = text;
    container.classList.remove('hidden');
    document.getElementById('btn-download-qr').classList.remove('hidden');
}

function downloadQRCode() {
    const qrImg = document.querySelector('#qrcode img');
    if (!qrImg) return;
    const link = document.createElement('a');
    link.download = `QR_${document.getElementById('qr-label').innerText}.png`;
    link.href = qrImg.src;
    link.click();
}
