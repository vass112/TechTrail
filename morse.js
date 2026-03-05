// Morse Code Dictionary and Audio Synthesizer

const MORSE_DICT = {
    "A": ".-", "B": "-...", "C": "-.-.", "D": "-..", "E": ".", 
    "F": "..-.", "G": "--.", "H": "....", "I": "..", "J": ".---", 
    "K": "-.-", "L": ".-..", "M": "--", "N": "-.", "O": "---", 
    "P": ".--.", "Q": "--.-", "R": ".-.", "S": "...", "T": "-", 
    "U": "..-", "V": "...-", "W": ".--", "X": "-..-", "Y": "-.--", 
    "Z": "--..", "0": "-----", "1": ".----", "2": "..---", 
    "3": "...--", "4": "....-", "5": ".....", "6": "-....", 
    "7": "--...", "8": "---..", "9": "----.", " ": "   "
};

const DOT_DURATION = 100;
const DASH_DURATION = DOT_DURATION * 3;
const ELEMENT_GAP = DOT_DURATION;
const LETTER_GAP = DOT_DURATION * 3;
const WORD_GAP = DOT_DURATION * 7;

let audioCtx = null;

class MorseSynth {
    static translateToMorse(text) {
        return text.toUpperCase()
            .split('')
            .map(char => MORSE_DICT[char] || '')
            .join(' ');
    }

    static async playSequence(morseStr, onComplete = () => {}) {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        let time = audioCtx.currentTime;

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = 600; // 600 Hz

        gainNode.gain.value = 0;

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(time);

        for (let i = 0; i < morseStr.length; i++) {
            const char = morseStr[i];
            
            if (char === '.') {
                gainNode.gain.setValueAtTime(1, time);
                time += DOT_DURATION / 1000;
                gainNode.gain.setValueAtTime(0, time);
                time += ELEMENT_GAP / 1000;
            } else if (char === '-') {
                gainNode.gain.setValueAtTime(1, time);
                time += DASH_DURATION / 1000;
                gainNode.gain.setValueAtTime(0, time);
                time += ELEMENT_GAP / 1000;
            } else if (char === ' ') {
                time += LETTER_GAP / 1000;
            }
        }

        oscillator.stop(time);
        
        setTimeout(() => {
            onComplete();
        }, (time - audioCtx.currentTime) * 1000 + 100);
    }
}

window.MorseSynth = MorseSynth;
