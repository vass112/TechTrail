/**
 * FIREBASE INITIAL DATA SEED SCRIPT
 * Run this in your browser console while on your hosted site 
 * (after you've pasted your firebaseConfig and the site has loaded).
 */

async function seedTechTrail() {
    const db = window.db;
    if (!db) {
        console.error("Firebase not initialized! Paste your config first.");
        return;
    }

    const initialClues = {
        "CLUE1": "WELCOME TO TECHTRAIL. PROCEED TO THE OLD OAK TREE.",
        "CLUE2": "THE GEARS OF PROGRESS TURN IN THE MAIN HALLWAY.",
        "CLUE3": "KNOWLEDGE IS POWER. VISIT THE LIBRARY ENTRANCE.",
        "CLUE4": "THE FINAL CHALLENGE AWAITS AT THE NORTH GATE."
    };

    console.log("Seeding clues...");
    const batch = db.batch();
    for (const [id, text] of Object.entries(initialClues)) {
        batch.set(db.collection('clues').doc(id), { text: text });
    }

    await batch.commit();
    console.log("Clues seeded successfully! Refresh the page.");
}

// To run: seedTechTrail();
