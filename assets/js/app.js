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
    loadState();
    init();
});

function init() {
    // Initialize current session if not started
    const user = state.users[state.currentUser];
    if (!user.currentSession.startTime) {
        user.currentSession.startTime = Date.now();
    }

    // Initialize UI from saved state
    initializeUIFromState();

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
        saveState();
    });

    // User management
    setupUserManagement();

    const historyModal = document.getElementById("history-modal");
    const historyButton = document.getElementById("history-button");
    const historyCloseButton = historyModal.querySelector(".close-button");

    historyButton.addEventListener("click", () => {
        populateSessionHistory();
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
    const resetButton = document.getElementById("reset-session-button");

    if (undoButton) {
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
                document.getElementById("assessment-buttons").classList.add("hidden");
                document.getElementById("next-controls").classList.add("hidden");
                document.getElementById("answer-controls").classList.add("hidden");
            }
        });
    } else {
        console.error("Undo button not found");
    }

    if (resetButton) {
        resetButton.addEventListener("click", () => {
            resetSession();
        });
    } else {
        console.error("Reset button not found");
    }


    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register(new URL('/sw.js', import.meta.url)).then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }

    // Handle assessment buttons
    const assessmentButtons = document.getElementById("assessment-buttons");
    console.log("Assessment buttons:", assessmentButtons);

    if (assessmentButtons) {
        assessmentButtons.addEventListener("click", (event) => {
            if (event.target.tagName === "BUTTON") {
                const value = parseInt(event.target.dataset.value, 10);
                const lastGuess = state.users.default.currentSession.guesses.slice(-1)[0];
                if (lastGuess) {
                    lastGuess.selfAssessment = value;
                }
                assessmentButtons.classList.add("hidden");
                document.getElementById("answer-controls").classList.add("hidden");
                startNewRound();
            }
        });
    } else {
        console.error("Assessment buttons not found");
    }

    // Handle next button (for wrong answers)
    const nextButton = document.getElementById("next-button");
    console.log("Next button:", nextButton);

    if (nextButton) {
        nextButton.addEventListener("click", () => {
            document.getElementById("next-controls").classList.add("hidden");
            document.getElementById("answer-controls").classList.add("hidden");
            startNewRound();
        });
    } else {
        console.error("Next button not found");
    }
}

function startNewRound() {
    // Reset key colors and feedback
    document.querySelectorAll(".key").forEach(key => {
        key.classList.remove("correct", "incorrect");
        key.addEventListener("click", handleKeyClick);
    });
    document.getElementById("feedback").textContent = "";

    // Hide all answer controls
    document.getElementById("assessment-buttons").classList.add("hidden");
    document.getElementById("next-controls").classList.add("hidden");
    document.getElementById("answer-controls").classList.add("hidden");


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

    // Get the base note ranges (always using sharps for consistency)
    const bassNotes = getNoteRange(settings.bassClefRange.split('-')[0], settings.bassClefRange.split('-')[1]);
    const trebleNotes = getNoteRange(settings.trebleClefRange.split('-')[0], settings.trebleClefRange.split('-')[1]);

    // Helper function to get all possible note representations
    function getNotesForSelection(baseNotes) {
        const result = [];
        baseNotes.forEach(note => {
            const isAccidental = note.includes("#");

            if (!isAccidental) {
                // Natural notes are always included
                result.push(note);
            } else if (settings.includeSharps && settings.includeFlats) {
                // Include both sharp and flat versions
                result.push(note);
                const flatEquivalent = getEnharmonicEquivalent(note);
                if (flatEquivalent) {
                    result.push(flatEquivalent);
                }
            } else if (settings.includeSharps && !settings.includeFlats) {
                // Only sharps
                result.push(note);
            } else if (!settings.includeSharps && settings.includeFlats) {
                // Only flats
                const flatEquivalent = getEnharmonicEquivalent(note);
                if (flatEquivalent) {
                    result.push(flatEquivalent);
                }
            }
            // If neither sharps nor flats are included, accidentals are excluded
        });
        return result;
    }

    // Add bass clef notes
    getNotesForSelection(bassNotes).forEach(note => {
        notes.push({ clef: "bass", note });
    });

    // Add treble clef notes
    getNotesForSelection(trebleNotes).forEach(note => {
        notes.push({ clef: "treble", note });
    });

    return notes;
}

function getEnharmonicEquivalent(note) {
    // Map sharps to their flat equivalents
    const enharmonicMap = {
        'C#': 'Db',
        'D#': 'Eb',
        'F#': 'Gb',
        'G#': 'Ab',
        'A#': 'Bb'
    };

    const noteName = note.slice(0, -1); // Remove octave
    const octave = note.slice(-1);

    if (enharmonicMap[noteName]) {
        return enharmonicMap[noteName] + octave;
    }

    return null;
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

    state.noteAnswered = true;

    // Show appropriate controls based on answer correctness
    if (note === correctNote) {
        // Correct answer: show difficulty assessment buttons
        document.getElementById("assessment-buttons").classList.remove("hidden");
        document.getElementById("answer-controls").classList.remove("hidden");
    } else {
        // Wrong answer: show only next button
        document.getElementById("next-controls").classList.remove("hidden");
        document.getElementById("answer-controls").classList.remove("hidden");
    }

    // Update stats
    updateStats();
}

function drawNote(clef, note) {
    const musicScore = document.getElementById("music-score");

    // Create or get the VexFlow container
    let vexflowContainer = musicScore.querySelector('#vexflow-container');
    if (!vexflowContainer) {
        vexflowContainer = document.createElement('div');
        vexflowContainer.id = 'vexflow-container';
        vexflowContainer.style.position = 'absolute';
        vexflowContainer.style.top = '0';
        vexflowContainer.style.left = '0';
        vexflowContainer.style.width = '100%';
        vexflowContainer.style.height = '100%';
        vexflowContainer.style.display = 'flex';
        vexflowContainer.style.justifyContent = 'center';
        vexflowContainer.style.alignItems = 'center';
        vexflowContainer.style.zIndex = '1';
        musicScore.appendChild(vexflowContainer);
    } else {
        vexflowContainer.innerHTML = '';
    }

    try {
        // Get container dimensions
        const containerWidth = musicScore.clientWidth;
        const containerHeight = musicScore.clientHeight;

        // Create a compact staff - just enough width for clef + note + time signature
        const baseStaveWidth = 120; // Minimal width for clef, note, and time signature
        const baseHeight = 180; // Taller height to accommodate ledger lines above and below

        // Calculate scale factor to fit container while maintaining aspect ratio
        const scaleX = (containerWidth - 40) / (baseStaveWidth + 40);
        const scaleY = (containerHeight - 100) / baseHeight; // Leave space for controls
        const scale = Math.min(scaleX, scaleY, 3); // Cap maximum scale at 3x

        const scaledWidth = (baseStaveWidth + 40) * scale;
        const scaledHeight = baseHeight * scale;

        // Create VexFlow renderer
        const renderer = new Renderer(vexflowContainer, Renderer.Backends.SVG);
        renderer.resize(scaledWidth, scaledHeight);
        const context = renderer.getContext();

        // Apply scaling to the context
        context.scale(scale, scale);

        // Create a compact stave - center it vertically in the canvas
        const staveY = (baseHeight - 100) / 2; // Center the staff vertically
        const stave = new Stave(20, staveY, baseStaveWidth);
        stave.addClef(clef).addTimeSignature("1/4");
        stave.setContext(context).draw();

        // Create the note - convert format from "C4" to "c/4" for VexFlow
        let vfNote = note.toLowerCase();
        if (vfNote.includes('#')) {
            vfNote = vfNote.replace('#', '#');
        } else if (vfNote.includes('b')) {
            vfNote = vfNote.replace('b', 'b');
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

        // Format and justify the notes to the compact stave
        const formatter = new Formatter().joinVoices([voice]).format([voice], baseStaveWidth - 40);

        // Render voice
        voice.draw(context, stave);
    } catch (error) {
        console.error("VexFlow rendering error:", error);
        vexflowContainer.innerHTML = `<p style="color: red; padding: 20px;">Error rendering note: ${note} on ${clef} clef<br>Error: ${error.message}</p>`;
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
  return note.includes("#") || note.includes("b");
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
        // Include settings information in the session record
        const sessionRecord = {
            ...user.currentSession,
            settings: {
                bassClefRange: user.settings.bassClefRange,
                trebleClefRange: user.settings.trebleClefRange,
                includeSharps: user.settings.includeSharps,
                includeFlats: user.settings.includeFlats
            }
        };
        user.sessionHistory.push(sessionRecord);
        saveState(); // Save after adding to history
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

function populateSessionHistory() {
    const user = state.users[state.currentUser];
    const historyList = document.getElementById("session-history-list");

    // Clear existing history
    historyList.innerHTML = "";

    if (user.sessionHistory.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "No session history yet. Complete some practice sessions to see your progress here!";
        emptyMessage.style.color = "#666";
        emptyMessage.style.fontStyle = "italic";
        emptyMessage.style.textAlign = "center";
        emptyMessage.style.padding = "20px";
        historyList.appendChild(emptyMessage);
        return;
    }

    // Sort sessions by most recent first
    const sortedSessions = [...user.sessionHistory].sort((a, b) => b.endTime - a.endTime);

    sortedSessions.forEach(session => {
        const sessionDiv = document.createElement("div");
        sessionDiv.classList.add("session-history-item");
        sessionDiv.style.cssText = `
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            background: #f9f9f9;
        `;

        // Calculate session stats
        const totalGuesses = session.guesses.length;
        const correctGuesses = session.guesses.filter(guess => guess.correct).length;
        const percentage = totalGuesses > 0 ? Math.round((correctGuesses / totalGuesses) * 100) : 0;

        // Format dates
        const startDate = new Date(session.startTime);
        const endDate = new Date(session.endTime);
        const duration = Math.round((session.endTime - session.startTime) / 1000 / 60); // minutes

        // Get settings info (with fallback for older sessions)
        const settings = session.settings || {
            bassClefRange: "B1-D4",
            trebleClefRange: "B3-D6",
            includeSharps: true,
            includeFlats: false
        };

        sessionDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="color: #333;">${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong>
                <span style="color: ${percentage >= 80 ? '#4CAF50' : percentage >= 60 ? '#FF9800' : '#F44336'}; font-weight: bold;">
                    ${correctGuesses}/${totalGuesses} (${percentage}%)
                </span>
            </div>
            <div style="color: #666; font-size: 0.9em; margin-bottom: 8px;">
                Duration: ${duration} minute${duration !== 1 ? 's' : ''}
            </div>
            <div style="color: #666; font-size: 0.9em;">
                <div>Bass: ${settings.bassClefRange} | Treble: ${settings.trebleClefRange}</div>
                <div>Accidentals: ${settings.includeSharps ? 'Sharps' : ''}${settings.includeSharps && settings.includeFlats ? ' & ' : ''}${settings.includeFlats ? 'Flats' : ''}${!settings.includeSharps && !settings.includeFlats ? 'None' : ''}</div>
            </div>
        `;

        historyList.appendChild(sessionDiv);
    });
}

function saveState() {
    try {
        localStorage.setItem('music-trainer-state', JSON.stringify(state));
    } catch (error) {
        console.error('Failed to save state to localStorage:', error);
    }
}

function loadState() {
    try {
        const savedState = localStorage.getItem('music-trainer-state');
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            // Merge saved state with default state to handle new properties
            Object.assign(state, parsedState);

            // Ensure current user exists
            if (!state.users[state.currentUser]) {
                state.currentUser = "default";
            }

            // Ensure user has all required properties
            const user = state.users[state.currentUser];
            if (!user.settings) {
                user.settings = {
                    bassClefRange: "B1-D4",
                    trebleClefRange: "B3-D6",
                    includeSharps: true,
                    includeFlats: false,
                };
            }
            if (!user.sessionHistory) {
                user.sessionHistory = [];
            }
            if (!user.currentSession) {
                user.currentSession = {
                    startTime: null,
                    endTime: null,
                    guesses: [],
                };
            }
        }
    } catch (error) {
        console.error('Failed to load state from localStorage:', error);
    }
}

function initializeUIFromState() {
    // Update UI elements to reflect loaded state
    const user = state.users[state.currentUser];
    const settings = user.settings;

    document.getElementById("bass-clef-range").value = settings.bassClefRange;
    document.getElementById("treble-clef-range").value = settings.trebleClefRange;
    document.getElementById("include-sharps").checked = settings.includeSharps;
    document.getElementById("include-flats").checked = settings.includeFlats;

    // Update user dropdown
    populateUserDropdown();
}

function setupUserManagement() {
    const addUserModal = document.getElementById("add-user-modal");
    const addUserButton = document.getElementById("add-user-button");
    const deleteUserButton = document.getElementById("delete-user-button");
    const createUserButton = document.getElementById("create-user-button");
    const cancelUserButton = document.getElementById("cancel-user-button");
    const currentUserSelect = document.getElementById("current-user-select");
    const newUserNameInput = document.getElementById("new-user-name");

    // Show add user modal
    addUserButton.addEventListener("click", () => {
        newUserNameInput.value = "";
        addUserModal.style.display = "block";
    });

    // Cancel adding user
    cancelUserButton.addEventListener("click", () => {
        addUserModal.style.display = "none";
    });

    // Close modal when clicking X
    addUserModal.querySelector(".close-button").addEventListener("click", () => {
        addUserModal.style.display = "none";
    });

    // Close modal when clicking outside
    window.addEventListener("click", (event) => {
        if (event.target === addUserModal) {
            addUserModal.style.display = "none";
        }
    });

    // Create new user
    createUserButton.addEventListener("click", () => {
        const userName = newUserNameInput.value.trim();
        if (!userName) {
            alert("Please enter a user name.");
            return;
        }

        if (state.users[userName]) {
            alert("A user with this name already exists.");
            return;
        }

        // Create new user
        state.users[userName] = {
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
        };

        // Switch to new user
        state.currentUser = userName;
        saveState();

        // Update UI
        populateUserDropdown();
        initializeUIFromState();
        updateStats();
        startNewRound();

        addUserModal.style.display = "none";
        alert(`User "${userName}" created and selected.`);
    });

    // Switch user
    currentUserSelect.addEventListener("change", (event) => {
        const newUser = event.target.value;
        if (newUser !== state.currentUser) {
            state.currentUser = newUser;
            saveState();

            // Update UI for new user
            initializeUIFromState();
            updateStats();
            startNewRound();
        }
    });

    // Delete user
    deleteUserButton.addEventListener("click", () => {
        if (state.currentUser === "default") {
            alert("Cannot delete the default user.");
            return;
        }

        if (Object.keys(state.users).length <= 1) {
            alert("Cannot delete the last user.");
            return;
        }

        if (confirm(`Are you sure you want to delete user "${state.currentUser}"? This will permanently delete all their session history.`)) {
            delete state.users[state.currentUser];

            // Switch to default user
            state.currentUser = "default";
            saveState();

            // Update UI
            populateUserDropdown();
            initializeUIFromState();
            updateStats();
            startNewRound();

            alert("User deleted successfully.");
        }
    });
}

function populateUserDropdown() {
    const select = document.getElementById("current-user-select");
    const currentUser = state.currentUser;

    // Clear existing options
    select.innerHTML = "";

    // Add all users
    Object.keys(state.users).forEach(userName => {
        const option = document.createElement("option");
        option.value = userName;
        option.textContent = userName === "default" ? "Default User" : userName;
        if (userName === currentUser) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}
