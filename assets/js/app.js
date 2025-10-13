import { Accidental, Factory, Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow';
import 'fork-awesome/css/fork-awesome.css';

const state = {
    currentUser: "default",
    users: {
        default: {
            settings: {
                bassClefRange: "B1-D4",
                trebleClefRange: "B3-D6",
                includeSharps: true,
                includeFlats: false,
            },
            sessionHistory: [],
            currentSession: {
                startTime: null,
                endTime: null,
                guesses: [],
            }
        }
    },
    currentNote: null,
    noteStartTime: null,
};

document.addEventListener("DOMContentLoaded", function() {
    init();
});

function init() {
    // Initialize current session if not started
    const user = state.users[state.currentUser];
    if (!user.currentSession.startTime) {
        user.currentSession.startTime = Date.now();
    }

    const piano = document.getElementById("piano");
    const startNote = "B1";
    const endNote = "D6";
    createPiano(piano, startNote, endNote);
    updateStats();
    startNewRound();

    const settingsModal = document.getElementById("settings-modal");
    const settingsButton = document.getElementById("settings-button");
    const closeButton = settingsModal.querySelector(".close-button");
    const saveButton = document.getElementById("save-settings");

    settingsButton.addEventListener("click", () => {
        settingsModal.style.display = "block";
    });

    closeButton.addEventListener("click", () => {
        settingsModal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
        if (event.target == settingsModal) {
            settingsModal.style.display = "none";
        }
    });

    saveButton.addEventListener("click", () => {
        const user = state.users[state.currentUser];
        user.settings.bassClefRange = document.getElementById("bass-clef-range").value;
        user.settings.trebleClefRange = document.getElementById("treble-clef-range").value;
        user.settings.includeSharps = document.getElementById("include-sharps").checked;
        user.settings.includeFlats = document.getElementById("include-flats").checked;

        const piano = document.getElementById("piano");
        piano.innerHTML = "";
        createPiano(piano, "B1", "D6"); // This needs to be dynamic based on the new range
        startNewRound();
        settingsModal.style.display = "none";
    });

    const historyModal = document.getElementById("history-modal");
    const historyButton = document.getElementById("history-button");
    const historyCloseButton = historyModal.querySelector(".close-button");

    historyButton.addEventListener("click", () => {
        historyModal.style.display = "block";
    });

    historyCloseButton.addEventListener("click", () => {
        historyModal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
        if (event.target == historyModal) {
            historyModal.style.display = "none";
        }
    });

    const undoButton = document.getElementById("undo-button");
    const nextButton = document.getElementById("next-button");

    undoButton.addEventListener("click", () => {
        if (state.previousNote) {
            state.currentNote = state.previousNote;
            state.previousNote = null;
            state.users.default.currentSession.guesses.pop();
            drawNote(state.currentNote.clef, state.currentNote.note);
            document.querySelectorAll(".key").forEach(key => {
                key.classList.remove("correct", "incorrect");
                key.addEventListener("click", handleKeyClick);
            });
            document.getElementById("feedback").textContent = "";
        }
    });

    nextButton.addEventListener("click", () => {
        console.log("Next button clicked");
        startNewRound();
    });

    const resetButton = document.getElementById("reset-session-button");
    resetButton.addEventListener("click", () => {
        resetSession();
    });


    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register(new URL('/sw.js', import.meta.url)).then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }

    const selfAssessment = document.getElementById("self-assessment");
    selfAssessment.addEventListener("click", (event) => {
        if (event.target.tagName === "BUTTON") {
            const value = parseInt(event.target.dataset.value, 10);
            const lastGuess = state.users.default.currentSession.guesses.slice(-1)[0];
            if (lastGuess) {
                lastGuess.selfAssessment = value;
            }
            selfAssessment.classList.add("hidden");
        }
    });
}

function startNewRound() {
    // Reset key colors and feedback
    document.querySelectorAll(".key").forEach(key => {
        key.classList.remove("correct", "incorrect");
        key.addEventListener("click", handleKeyClick);
    });
    document.getElementById("feedback").textContent = "";

    // Reset next button
    const nextButton = document.getElementById("next-button");
    nextButton.classList.remove("fa-forward");
    nextButton.classList.add("fa-arrow-right");

    state.previousNote = state.currentNote;
    const lastNote = state.currentNote;
    if (state.noteAnswered) {
        state.lastAnsweredNote = lastNote;
    }
    state.noteAnswered = false;


    const possibleNotes = getPossibleNotes();
    const weights = calculateWeights(possibleNotes);
    const selectedNote = selectNote(possibleNotes, weights);

    state.currentNote = selectedNote;
    state.noteStartTime = Date.now();
    drawNote(selectedNote.clef, selectedNote.note);
}

function getPossibleNotes() {
    const user = state.users[state.currentUser];
    const settings = user.settings;
    const notes = [];

    const bassNotes = getNoteRange(settings.bassClefRange.split('-')[0], settings.bassClefRange.split('-')[1]);
    bassNotes.forEach(note => {
        if (!note.includes("#") || settings.includeSharps) {
            notes.push({ clef: "bass", note });
        }
    });

    const trebleNotes = getNoteRange(settings.trebleClefRange.split('-')[0], settings.trebleClefRange.split('-')[1]);
    trebleNotes.forEach(note => {
        if (!note.includes("#") || settings.includeSharps) {
            notes.push({ clef: "treble", note });
        }
    });

    return notes;
}

function getScoreForTime(seconds) {
    if (seconds < 30) return 1;
    if (seconds < 45) return 0.9;
    if (seconds < 60) return 0.8;
    if (seconds < 90) return 0.7;
    return 0.5;
}

function calculateWeights(possibleNotes) {
    const user = state.users[state.currentUser];
    const history = user.sessionHistory.flatMap(session => session.guesses);
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recentHistory = history.filter(guess => guess.startTime > twoWeeksAgo);

    const noteStats = {};
    possibleNotes.forEach(note => {
        const noteId = `${note.clef}-${note.note}`;
        noteStats[noteId] = { seen: 0, correct: 0 };
    });

    recentHistory.forEach(guess => {
        const noteId = `${guess.note.clef}-${guess.note.note}`;
        if (noteStats[noteId]) {
            noteStats[noteId].seen++;
            if (guess.correct) {
                const timeTaken = (guess.endTime - guess.startTime) / 1000;
                noteStats[noteId].correct += getScoreForTime(timeTaken);
            }
        }
    });

    const weights = possibleNotes.map(note => {
        const noteId = `${note.clef}-${note.note}`;
        const stats = noteStats[noteId];

        if ((note.clef === state.currentNote?.clef && note.note === state.currentNote?.note) ||
            (note.clef === state.lastAnsweredNote?.clef && note.note === state.lastAnsweredNote?.note)) {
            return 0;
        }

        if (stats.seen < 10) {
            return 1;
        }

        const successRate = stats.correct / stats.seen;
        const baseWeight = 1 - successRate;
        const minWeight = 1 / (5 * possibleNotes.length);

        return Math.max(baseWeight, minWeight);
    });

    return weights;
}

function selectNote(possibleNotes, weights) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const randomValue = Math.random() * totalWeight;
    let weightSum = 0;

    for (let i = 0; i < possibleNotes.length; i++) {
        weightSum += weights[i];
        if (randomValue < weightSum) {
            return possibleNotes[i];
        }
    }

    return possibleNotes[possibleNotes.length - 1];
}

function handleGuess(note) {
    const correctNote = state.currentNote.note;
    const key = document.querySelector(`.key[data-note="${note}"]`);
    if (note === correctNote) {
        key.classList.add("correct");
        document.getElementById("feedback").textContent = "✅";
    } else {
        key.classList.add("incorrect");
        const correctKey = document.querySelector(`.key[data-note="${correctNote}"]`);
        correctKey.classList.add("correct");
        document.getElementById("feedback").textContent = "❌";
    }

    // Record the guess
    state.users.default.currentSession.guesses.push({
        note: state.currentNote,
        guess: note,
        startTime: state.noteStartTime,
        endTime: Date.now(),
        correct: note === correctNote,
    });

    // Disable keys until the next round
    document.querySelectorAll(".key").forEach(key => {
        key.removeEventListener("click", handleKeyClick);
    });

    // Change next button to skip button
    const nextButton = document.getElementById("next-button");
    nextButton.classList.remove("fa-arrow-right");
    nextButton.classList.add("fa-forward");
    state.noteAnswered = true;

    // Show self-assessment buttons
    const selfAssessment = document.getElementById("self-assessment");
    selfAssessment.classList.remove("hidden");

    // Update stats
    updateStats();
}

function drawNote(clef, note) {
    const musicScore = document.getElementById("music-score");
    musicScore.innerHTML = "";

    try {
        // Create VexFlow renderer
        const renderer = new Renderer(musicScore, Renderer.Backends.SVG);
        renderer.resize(400, 200);
        const context = renderer.getContext();

        // Create a stave
        const stave = new Stave(10, 40, 350);
        stave.addClef(clef).addTimeSignature("1/4");
        stave.setContext(context).draw();

        // Create the note - convert format from "C4" to "c/4" for VexFlow
        let vfNote = note.toLowerCase();
        if (vfNote.includes('#')) {
            vfNote = vfNote.replace('#', '#');
        }
        // Split note name and octave
        const noteName = vfNote.slice(0, -1);
        const octave = vfNote.slice(-1);
        const vfNoteString = `${noteName}/${octave}`;

        // Create notes
        const notes = [
            new StaveNote({
                clef: clef,
                keys: [vfNoteString],
                duration: "q"
            })
        ];

        const voice = new Voice({ num_beats: 1, beat_value: 4 });
        voice.addTickables(notes);
        voice.setStrict(false); // Allow less than 4 notes
        Accidental.applyAccidentals([voice], `C`);

        // Format and justify the notes to 300 pixels
        const formatter = new Formatter().joinVoices([voice]).format([voice]);//, 300);

        // Render voice
        voice.draw(context, stave);
    } catch (error) {
        console.error("VexFlow rendering error:", error);
        musicScore.innerHTML = `<p style="color: red; padding: 20px;">Error rendering note: ${note} on ${clef} clef<br>Error: ${error.message}</p>`;
    }
}

function createPiano(pianoContainer, startNote, endNote) {
    const notes = getNoteRange(startNote, endNote);
    notes.forEach(note => {
        const key = document.createElement("div");
        key.classList.add("key");
        if (isBlackKey(note)) {
            key.classList.add("black");
        } else {
            key.classList.add("white");
        }
        if (note === "C4") {
            key.classList.add("middle-c");
        }
        key.dataset.note = note;
        pianoContainer.appendChild(key);

        key.addEventListener("click", handleKeyClick);
    });
}

function handleKeyClick(event) {
    handleGuess(event.target.dataset.note);
}

function getNoteRange(start, end) {
    const allNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const range = [];
    const startOctave = parseInt(start.slice(-1));
    const endOctave = parseInt(end.slice(-1));
    const startNoteName = start.slice(0, -1);
    const endNoteName = end.slice(0, -1);

    for (let octave = startOctave; octave <= endOctave; octave++) {
        let notesInOctave = allNotes;
        if (octave === startOctave) {
            notesInOctave = allNotes.slice(allNotes.indexOf(startNoteName));
        }
        if (octave === endOctave) {
            notesInOctave = notesInOctave.slice(0, allNotes.indexOf(endNoteName) + 1);
        }

        for (const noteName of notesInOctave) {
            if (octave === endOctave && noteName === endNoteName) {
                range.push(noteName + octave);
                break;
            }
            range.push(noteName + octave);
        }
    }
    return range;
}

function isBlackKey(note) {
  return note.includes("#");
}

function updateStats() {
    const user = state.users[state.currentUser];
    const currentGuesses = user.currentSession.guesses;
    const total = currentGuesses.length;
    const correct = currentGuesses.filter(guess => guess.correct).length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    const statsDisplay = document.getElementById("stats-display");
    statsDisplay.textContent = `${correct} / ${total} (${percentage}%)`;
}

function resetSession() {
    const user = state.users[state.currentUser];

    // Save current session to history if it has guesses
    if (user.currentSession.guesses.length > 0) {
        user.currentSession.endTime = Date.now();
        user.sessionHistory.push({ ...user.currentSession });
    }

    // Start new session
    user.currentSession = {
        startTime: Date.now(),
        endTime: null,
        guesses: []
    };

    // Reset UI
    updateStats();
    document.getElementById("feedback").textContent = "";
    startNewRound();
}
