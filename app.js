// Main Application Logic
let html5QrcodeScanner = null;
let currentTeam = null;
let currentClueId = null;
let solvedClues = [];
let localCluesCache = {};

// Helper to check if Firebase is initialized
const getDB = () => window.db;

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    // Wait a bit for Firebase to initialize from index.html script
    setTimeout(fetchClues, 500);
});

async function fetchClues() {
    const db = getDB();
    if (!db) {
        console.warn("Firebase not initialized. Use local defaults if needed.");
        return;
    }
    try {
        const snapshot = await db.collection('clues').get();
        localCluesCache = {};
        snapshot.forEach(doc => {
            localCluesCache[doc.id] = doc.data().text;
        });
        initQRGenerator();
    } catch (e) {
        console.error("Failed to load clues from Firestore", e);
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

    // Login logic
    document.getElementById('btn-login').addEventListener('click', async () => {
        const team = document.getElementById('login-team').value.trim().toUpperCase();
        const password = document.getElementById('login-password').value.trim();
        const errEl = document.getElementById('login-error');

        if (!team || !password) {
            errEl.innerText = "ENTER CREDENTIALS";
            return;
        }

        if (!getDB()) {
            errEl.innerText = "FIREBASE NOT EXECUTED";
            return;
        }

        const btn = document.getElementById('btn-login');
        btn.innerText = "AUTHENTICATING...";

        try {
            // Special Admin check
            if (team === "ADMIN" && password === "ananthan") {
                refreshLeaderboard();
                document.getElementById('clue-editor-textarea').value = JSON.stringify(localCluesCache, null, 4);
                switchView('view-admin');
            } else {
                const doc = await getDB().collection('teams').doc(team).get();
                if (doc.exists && doc.data().password === password) {
                    currentTeam = team;
                    solvedClues = doc.data().solved || [];
                    updateProgressUI();
                    switchView('view-home');
                } else {
                    errEl.innerText = "ACCESS DENIED";
                }
            }
        } catch (e) {
            errEl.innerText = "AUTH ERROR";
            console.error(e);
        }
        btn.innerText = "INITIALIZE";
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
        switchView('view-admin');
    });

    document.getElementById('btn-refresh-leaderboard').addEventListener('click', refreshLeaderboard);

    document.getElementById('btn-create-team').addEventListener('click', async () => {
        const team = document.getElementById('new-team-name').value.trim().toUpperCase();
        const password = document.getElementById('new-team-pass').value.trim();
        const msg = document.getElementById('team-create-msg');

        if (!team || !password) {
            msg.innerText = "Fill all fields"; return;
        }

        try {
            await getDB().collection('teams').doc(team).set({
                password: password,
                solved: []
            });
            msg.innerText = "Team Created!";
            document.getElementById('new-team-name').value = '';
            document.getElementById('new-team-pass').value = '';
            refreshLeaderboard();
        } catch (e) {
            msg.innerText = "Error creating team";
        }
        setTimeout(() => msg.innerText = "", 3000);
    });

    document.getElementById('btn-save-clues').addEventListener('click', async () => {
        try {
            const parsed = JSON.parse(document.getElementById('clue-editor-textarea').value);
            const batch = getDB().batch();

            // Delete old clues? For simplicity, we just set the new ones.
            // In a real app, you might want to clear the collection first.
            for (const [id, text] of Object.entries(parsed)) {
                const ref = getDB().collection('clues').doc(id);
                batch.set(ref, { text: text });
            }

            await batch.commit();
            alert('Global Clues Updated!');
            fetchClues();
        } catch (e) {
            alert('Error updating clues or invalid JSON!');
            console.error(e);
        }
    });

    document.getElementById('btn-reset-progress').addEventListener('click', async () => {
        if (confirm('DANGER: Reset progress for ALL teams globally?')) {
            try {
                const snapshot = await getDB().collection('teams').get();
                const batch = getDB().batch();
                snapshot.forEach(doc => {
                    batch.update(doc.ref, { solved: [] });
                });
                await batch.commit();

                if (currentTeam) solvedClues = [];
                updateProgressUI();
                refreshLeaderboard();
                alert('Global Progress Reset.');
            } catch (e) {
                alert('Reset failed.');
            }
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
    if (solvedClues.length > 0) {
        document.getElementById('btn-resume').style.display = 'flex';
        document.getElementById('btn-start').style.display = 'none';
        document.getElementById('btn-resume').querySelector('span:nth-child(2)').innerText = 'RESUME HUNT';
    } else {
        document.getElementById('btn-resume').style.display = 'none';
        document.getElementById('btn-start').style.display = 'flex';
    }
}

async function refreshLeaderboard() {
    const list = document.getElementById('leaderboard-container');
    if (!list) return;
    list.innerHTML = `<div class="text-center text-primary/50 text-sm py-4">Loading...</div>`;
    try {
        const snapshot = await getDB().collection('teams').get();
        const data = [];
        snapshot.forEach(doc => {
            data.push({
                team: doc.id,
                score: (doc.data().solved || []).length
            });
        });

        // Sort descending
        data.sort((a, b) => b.score - a.score);

        list.innerHTML = "";
        data.forEach((r, i) => {
            const div = document.createElement('div');
            div.className = "flex justify-between items-center bg-black/60 p-2 rounded border border-primary/10 text-sm";
            div.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-primary/60 font-bold">#${i + 1}</span>
                    <span class="font-bold text-slate-100">${r.team}</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-primary font-mono">${r.score} Clues</span>
                    <button onclick="confirmDeleteTeam('${r.team}')" class="text-red-500/50 hover:text-red-500 transition-colors">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            `;
            list.appendChild(div);
        });

        if (data.length === 0) list.innerHTML = `<div class="text-center text-primary/50 text-sm py-4">No teams found.</div>`;
    } catch (e) {
        list.innerHTML = `<div class="text-center text-red-500 text-sm py-4">Error loading data.</div>`;
    }
}

async function confirmDeleteTeam(teamName) {
    if (confirm(`Are you sure you want to delete team "${teamName}"? All their progress will be lost.`)) {
        try {
            await getDB().collection('teams').doc(teamName).delete();
            refreshLeaderboard();
        } catch (e) {
            alert("Failed to delete team.");
        }
    }
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

async function onScanSuccess(decodedText) {
    if (localCluesCache[decodedText]) {
        stopScanner();

        // Sync progress with Firestore
        try {
            const teamRef = getDB().collection('teams').doc(currentTeam);
            await getDB().runTransaction(async (transaction) => {
                const teamDoc = await transaction.get(teamRef);
                if (!teamDoc.exists) return;

                let solved = teamDoc.data().solved || [];
                if (!solved.includes(decodedText)) {
                    solved.push(decodedText);
                    transaction.update(teamRef, { solved: solved });
                    solvedClues = solved;
                }
            });
            updateProgressUI();
        } catch (e) {
            console.error("Failed to sync progress to Firestore", e);
        }

        currentClueId = decodedText;
        displayClue(decodedText, localCluesCache[decodedText]);
        switchView('view-clue');
    } else {
        document.getElementById('scanner-error').innerText = "INVALID CLUE NODE";
        setTimeout(() => { document.getElementById('scanner-error').innerText = ""; }, 2500);
    }
}

function onScanFailure(error) {
    // Ignore frame failures
}

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
