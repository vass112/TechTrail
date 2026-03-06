// Main Application Logic - Google Auth + Firestore Persistence
let html5QrcodeScanner = null;
let currentUser = null;
let currentTeam = null;
let solvedClues = [];
let isAdmin = false;
let adminTapCount = 0;

const DEFAULT_CLUES = {
    "CLUE1": "Every kingdom has a guardian, The first eyes that see every visitor. No one enters without their watchful gaze. Find the protector of the campus gate. Speak the password: 'Sentinel'",
    "CLUE2": "In silence he sits with folded hands, Watching the chaos of the world calmly. Wisdom carved in stone stands before the great block of knowledge. Seek the enlightened one.",
    "CLUE3": "Opposite the calm sits power and authority, Where wheels rest before journeys begin. A place reserved for the captain of the campus. Find where the leader parks their chariot.",
    "CLUE4": "After knowledge comes hunger, After lectures comes laughter. The aroma of spices fills the air, And students gather like bees to nectar. Follow the smell of food.",
    "CLUE5": "Books whisper louder than voices, Knowledge sleeps between endless pages. Posters hide secrets on silent walls. Seek the house of wisdom beside this feast. Password: 'Knowledge is Power'",
    "CLUE6": "Not stairs but a moving cage, Carrying minds between levels of learning. Inside the home of computers and code, A vertical journey awaits. Find the mechanical climber in Homi J Bhabha Block.",
    "CLUE7": "Back and forth I travel through air, Laughter once pushed me high. But now seek a creature who guards the waste, A playful face that swallows trash. He sits watching hungry engineers nearby.",
    "CLUE8": "From playful creatures to machines of war, Iron once rolled where soldiers stood proud. A silent warrior now rests nearby, Watching students instead of battlefields. Seek the armored giant beside the court of hoops.",
    "CLUE9": "You have crossed knowledge, food, machines and play, Yet the journey ends where every visitor begins. Return to the heart of the Main Block Reception.",
    "CLUE10": "🏆 Congratulations, Explorers! From the guardian of the gate to wisdom in stone, from machines and battle steel... You have unlocked every clue of the campus. The treasure belongs to those who seek, think, and never give up!"
};

let localCluesCache = DEFAULT_CLUES;

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initAuth();
});

async function initAuth() {
    if (!window.auth || !window.db) return;

    // Load Clues from Cloud
    try {
        const clueDoc = await window.db.collection('config').doc('game').get();
        if (clueDoc.exists) {
            localCluesCache = clueDoc.data().clues || DEFAULT_CLUES;
        }
    } catch (e) { console.warn("Cloud clues offline, using defaults"); }

    window.auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            checkTeamRegistration();
        } else {
            currentUser = null;
            currentTeam = null;
            isAdmin = false;
            switchView('view-login');
        }
    });
}

function checkTeamRegistration() {
    // If admin is active, do NOT touch the view
    if (isAdmin) return;

    window.db.collection('teams').doc(currentUser.uid).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            currentTeam = data.teamName;
            solvedClues = data.solved || [];
            updateProgressUI();
            switchView('view-home');
        } else {
            document.getElementById('user-name').innerText = currentUser.displayName || 'Agent';
            document.getElementById('user-avatar').src = currentUser.photoURL || '';
            switchView('view-setup-team');
        }
    }).catch(err => {
        console.error("Team check failed:", err);
        document.getElementById('login-error').innerText = "CONNECTION ERROR - CHECK DB RULES";
    });
}

function saveProgress() {
    if (currentUser && currentTeam) {
        window.db.collection('teams').doc(currentUser.uid).set({
            teamName: currentTeam,
            solved: solvedClues,
            solvedCount: solvedClues.length,
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            uid: currentUser.uid
        }, { merge: true });
    }
}

function initUI() {
    // Secret Admin Toggle (5 taps on IDENTITY NODE)
    const adminTrigger = document.getElementById('admin-trigger');
    if (adminTrigger) {
        adminTrigger.addEventListener('click', () => {
            adminTapCount++;
            if (adminTapCount >= 5) {
                document.getElementById('admin-section').classList.remove('hidden');
                adminTrigger.innerText = "OVERRIDE ACTIVE";
                adminTrigger.classList.add('text-primary');
            }
        });
    }

    // Basic Routing with GUARD
    document.querySelectorAll('[data-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetEl = e.target.closest('[data-target]');
            if (targetEl) {
                const target = targetEl.dataset.target;
                if (target === 'view-admin' && !isAdmin) {
                    alert('ADMIN AUTHORIZATION REQUIRED');
                    return;
                }
                switchView(target);
            }
        });
    });

    // Google Login
    document.getElementById('btn-google-login').addEventListener('click', () => {
        window.auth.signInWithPopup(window.googleProvider).catch(err => {
            document.getElementById('login-error').innerText = err.message;
        });
    });

    // Admin Override Login
    document.getElementById('btn-admin-login').addEventListener('click', () => {
        const idInput = document.getElementById('admin-login-id');
        const passInput = document.getElementById('admin-login-pass');

        if (!idInput || !passInput) return;

        const id = idInput.value.trim().toLowerCase();
        const pass = passInput.value.trim().toLowerCase();

        if (id === "admin" && pass === "ananthan") {
            isAdmin = true;
            initLeaderboardListener();
            document.getElementById('clue-editor-textarea').value = JSON.stringify(localCluesCache, null, 4);
            switchView('view-admin');
        } else {
            document.getElementById('login-error').innerText = "INVALID ADMIN CREDENTIALS";
        }
    });

    // Team Finalization
    document.getElementById('btn-finalize-setup').addEventListener('click', () => {
        const teamName = document.getElementById('setup-team-name').value.trim().toUpperCase();
        if (!teamName) {
            document.getElementById('setup-error').innerText = "ENTER A TEAM NAME";
            return;
        }
        currentTeam = teamName;
        solvedClues = [];
        saveProgress();
        updateProgressUI();
        switchView('view-home');
    });

    // Home Actions
    document.getElementById('btn-start').addEventListener('click', () => switchView('view-scanner'));
    document.getElementById('btn-resume').addEventListener('click', () => switchView('view-scanner'));

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        if (confirm("Sign out of TechTrail?")) {
            isAdmin = false;
            adminTapCount = 0;
            window.auth.signOut();
        }
    });

    // Admin Close — sign out of Google so onAuthStateChanged sends to login cleanly
    const btnCloseAdmin = document.getElementById('btn-close-admin');
    if (btnCloseAdmin) {
        btnCloseAdmin.addEventListener('click', () => {
            const adminTrigger = document.getElementById('admin-trigger');
            if (adminTrigger) adminTrigger.innerText = "OR ADMIN ACCESS";
            document.getElementById('admin-section').classList.add('hidden');
            adminTapCount = 0;

            if (currentUser) {
                // User was also Google-logged-in; sign them out cleanly
                isAdmin = false;
                window.auth.signOut(); // onAuthStateChanged will switch to view-login
            } else {
                // Pure admin override, no Google session
                isAdmin = false;
                switchView('view-login');
            }
        });
    }

    document.getElementById('btn-save-clues').addEventListener('click', () => {
        try {
            const parsed = JSON.parse(document.getElementById('clue-editor-textarea').value);
            localCluesCache = parsed;
            window.db.collection('config').doc('game').set({ clues: parsed });
            alert('Clues Syncronized to Cloud!');
            initQRGenerator();
        } catch (e) {
            alert('Invalid JSON format!');
        }
    });

    document.getElementById('btn-reset-progress').addEventListener('click', () => {
        if (confirm('Permanently Delete Progress for this account?')) {
            if (currentUser) {
                window.db.collection('teams').doc(currentUser.uid).delete();
                window.auth.signOut();
            }
            location.reload();
        }
    });

    document.getElementById('btn-play-audio').addEventListener('click', playMorseAudio);
    document.getElementById('btn-download-qr').addEventListener('click', downloadQRCode);

    document.getElementById('btn-preview-audio').addEventListener('click', () => {
        const text = document.getElementById('morse-preview-input').value;
        const morse = window.MorseSynth.translateToMorse(text);
        document.getElementById('morse-preview-output').innerText = morse;
        window.MorseSynth.playSequence(morse);
    });

    const viewScanner = document.getElementById('view-scanner');
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.classList.contains('active')) startScanner();
            else stopScanner();
        });
    });
    observer.observe(viewScanner, { attributes: true, attributeFilter: ['class'] });
}

function switchView(viewId) {
    // SECURITY GUARD: Prevents Admins from entering game views
    const gameViews = ['view-home', 'view-scanner', 'view-clue', 'view-setup-team'];
    if (isAdmin && gameViews.includes(viewId)) {
        console.warn("ADMIN ATTEMPTED TO ENTER GAME VIEW - BLOCKED");
        return;
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function updateProgressUI() {
    document.getElementById('clues-solved').innerText = solvedClues.length;
    const hasProgress = solvedClues.length > 0;
    document.getElementById('btn-resume').style.display = hasProgress ? 'flex' : 'none';
    document.getElementById('btn-start').style.display = hasProgress ? 'none' : 'flex';
}

function initLeaderboardListener() {
    const list = document.getElementById('leaderboard-container');
    if (!list) return;

    window.db.collection('teams').onSnapshot(snapshot => {
        list.innerHTML = "";
        if (snapshot.empty) {
            list.innerHTML = '<div class="text-center text-primary/50 text-sm py-4">No agents deployed yet</div>';
            return;
        }

        const teams = [];
        snapshot.forEach(doc => teams.push(doc.data()));
        teams.sort((a, b) => (b.solvedCount || 0) - (a.solvedCount || 0));

        teams.forEach(team => {
            const isMe = currentUser && team.uid === currentUser.uid;
            const card = document.createElement('div');
            card.className = `p-3 rounded-lg border flex items-center justify-between transition-all ${isMe ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(255,59,48,0.3)]' : 'bg-black/40 border-primary/20 hover:border-primary/40'}`;
            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${team.photoURL || 'https://via.placeholder.com/40'}" class="w-8 h-8 rounded-full border border-primary/40">
                    <div>
                        <p class="text-slate-100 font-bold text-sm uppercase">${team.teamName}</p>
                        <p class="text-[10px] text-slate-500 font-mono">${team.email || 'Anonymous'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-primary font-bold text-lg leading-tight">${team.solved?.length || 0}</p>
                    <p class="text-[8px] text-primary/60 font-mono uppercase">Nodes Found</p>
                </div>
            `;
            list.appendChild(card);
        });
    });
}

function startScanner() {
    if (html5QrcodeScanner) return;
    html5QrcodeScanner = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .catch(err => {
            document.getElementById('scanner-error').innerText = "Camera Denied";
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
        document.getElementById('scanner-error').innerText = "INVALID NODE";
        setTimeout(() => { document.getElementById('scanner-error').innerText = ""; }, 2500);
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
    const btn = document.getElementById('btn-play-audio');
    if (!morse) return;
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
        btn.className = "px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold hover:bg-primary/30";
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
