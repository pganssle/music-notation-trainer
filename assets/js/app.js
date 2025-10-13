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
                enableKeyboardMode: true,
                enableNoteNameMode: false,
                enableStaffPositionMode: false,
            },
            sessionHistory: [],
            currentSession: {
                startTime: null,
                endTime: null,
                guesses: [], // Still keep for backward compatibility
                modeGuesses: {
                    keyboard: [],
                    noteName: [],
                    staffPosition: []
                }
            }
        }
    },
    currentNote: null,
    currentModes: [], // Array of active guessing modes for current note
    currentNoteGuesses: {}, // Track guesses for current note by mode
    noteStartTime: null,
};

document.addEventListener("DOMContentLoaded", function() {
    loadState();
    init();

    // Lock orientation to landscape for PWA
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(err => {
            console.log('Orientation lock failed:', err);
        });
    }

    // Alternative method for older browsers
    if (window.screen && window.screen.lockOrientation) {
        window.screen.lockOrientation('landscape');
    } else if (window.screen && window.screen.mozLockOrientation) {
        window.screen.mozLockOrientation('landscape');
    } else if (window.screen && window.screen.msLockOrientation) {
        window.screen.msLockOrientation('landscape');
    }
});

// Add resize handler for responsive VexFlow canvas
let resizeTimeout;
let currentNote = null;
let currentClef = null;

function handleResize() {
    if (currentNote && currentClef) {
        drawNote(currentClef, currentNote);
    }
}

window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 150); // Debounce resize events
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
        user.settings.enableKeyboardMode = document.getElementById("enable-keyboard-mode").checked;
        user.settings.enableNoteNameMode = document.getElementById("enable-note-name-mode").checked;
        user.settings.enableStaffPositionMode = document.getElementById("enable-staff-position-mode").checked;

        // Validate that at least one mode is enabled
        if (!user.settings.enableKeyboardMode && !user.settings.enableNoteNameMode && !user.settings.enableStaffPositionMode) {
            alert("At least one guessing mode must be enabled!");
            return;
        }

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
            handleUndo();
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


    // Service worker registration is handled in the HTML layout

    // Handle assessment buttons
    const assessmentButtons = document.getElementById("assessment-buttons");
    console.log("Assessment buttons:", assessmentButtons);

    if (assessmentButtons) {
        assessmentButtons.addEventListener("click", (event) => {
            if (event.target.tagName === "BUTTON") {
                const value = parseInt(event.target.dataset.value, 10);

                // Apply rating to all correct guesses for this note
                Object.keys(state.currentNoteGuesses).forEach(mode => {
                    const guess = state.currentNoteGuesses[mode];
                    if (guess && guess.correct) {
                        // Find the corresponding guess in the mode-specific array and add rating
                        const modeGuesses = state.users[state.currentUser].currentSession.modeGuesses[mode];
                        const lastModeGuess = modeGuesses[modeGuesses.length - 1];
                        if (lastModeGuess && lastModeGuess.note === state.currentNote) {
                            lastModeGuess.selfAssessment = value;
                        }

                        // Mark this guess as having a rating
                        guess.hasRating = true;
                    }
                });

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

    // Handle standalone next button
    const standaloneNextButton = document.getElementById("standalone-next-button");
    if (standaloneNextButton) {
        standaloneNextButton.addEventListener("click", () => {
            hideAllModeOverlays();
            startNewRound();
        });
    } else {
        console.error("Standalone next button not found");
    }

    // Setup note name interface
    setupNoteNameInterface();

    // Setup staff position interface
    setupStaffPositionInterface();

    // Setup mode-specific answer controls
    setupModeAnswerControls();

    // Setup feedback indicator click handlers
    setupFeedbackIndicatorClickHandlers();

    // Add debug test for modal (remove after testing)
    window.testModal = function() {
        console.log('Testing modal display...');
        const overlay = document.getElementById('note-name-overlay');
        const assessmentButtons = document.getElementById('note-name-assessment-buttons');
        const interfaceElement = document.getElementById('note-name-interface');

        // Position and show overlay
        positionOverlayOnInterface(overlay, interfaceElement);
        overlay.classList.remove('hidden');
        assessmentButtons.classList.remove('hidden');

        console.log('Modal should now be visible. Overlay:', overlay, 'Buttons:', assessmentButtons);
    };

    console.log('Added window.testModal() - call this in browser console to test');
}

function setupNoteNameInterface() {
    const noteLetterButtons = document.getElementById('note-letter-buttons');
    const accidentalButtons = document.getElementById('accidental-buttons');
    const submitButton = document.getElementById('note-name-submit');

    let selectedNote = '';
    let selectedAccidental = '';

    function updateSubmitButton() {
        submitButton.disabled = !selectedNote;
    }

    // Expose reset function
    window.resetNoteNameState = function() {
        selectedNote = '';
        selectedAccidental = '';
        updateSubmitButton();
    };

    // Expose setter for accidental (for syncing)
    window.setNoteNameAccidental = function(value) {
        selectedAccidental = value;
        updateSubmitButton();
    };

    function setupButtonGroup(container, onSelect, toggleable = false) {
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('selection-button')) {
                if (toggleable) {
                    // For toggleable groups, clicking selected button deselects it
                    if (e.target.classList.contains('selected')) {
                        e.target.classList.remove('selected');
                        onSelect('');
                    } else {
                        // Remove selected from all buttons in this group
                        container.querySelectorAll('.selection-button').forEach(btn =>
                            btn.classList.remove('selected')
                        );
                        // Add selected to clicked button
                        e.target.classList.add('selected');
                        onSelect(e.target.dataset.value);
                    }
                } else {
                    // Non-toggleable groups work as before
                    container.querySelectorAll('.selection-button').forEach(btn =>
                        btn.classList.remove('selected')
                    );
                    e.target.classList.add('selected');
                    onSelect(e.target.dataset.value);
                }
            }
        });
    }

    setupButtonGroup(noteLetterButtons, (value) => {
        selectedNote = value;
        updateSubmitButton();
    });

    setupButtonGroup(accidentalButtons, (value) => {
        selectedAccidental = value;
        updateSubmitButton();

        // Auto-set staff position accidental if neither mode is locked
        syncAccidentalToStaffPosition(value);
    }, true); // Make accidental buttons toggleable

    submitButton.addEventListener('click', () => {
        if (!selectedNote) return;

        // Construct the note name
        const octave = state.currentNote.note.slice(-1);
        const guessedNote = selectedNote + selectedAccidental + octave;

        handleGuess(guessedNote, 'noteName');
    });
}

function setupStaffPositionInterface() {
    const positionButtons = document.getElementById('position-buttons');
    const lineSpaceButtons = document.getElementById('line-space-buttons');
    const aboveBelowButtons = document.getElementById('above-below-buttons');
    const accidentalButtons = document.getElementById('staff-accidental-buttons');
    const submitButton = document.getElementById('staff-position-submit');

    let selectedPosition = '';
    let selectedLineSpace = '';
    let selectedAboveBelow = '';
    let selectedAccidental = '';

    function updateSubmitButton() {
        submitButton.disabled = !selectedPosition || !selectedLineSpace;
    }

    // Expose reset function
    window.resetStaffPositionState = function() {
        selectedPosition = '';
        selectedLineSpace = '';
        selectedAboveBelow = '';
        selectedAccidental = '';
        updateSubmitButton();
    };

    // Expose setter for accidental (for syncing)
    window.setStaffPositionAccidental = function(value) {
        selectedAccidental = value;
        updateSubmitButton();
    };

    function setupButtonGroup(container, onSelect, toggleable = false) {
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('selection-button')) {
                if (toggleable) {
                    // For toggleable groups, clicking selected button deselects it
                    if (e.target.classList.contains('selected')) {
                        e.target.classList.remove('selected');
                        onSelect('');
                    } else {
                        // Remove selected from all buttons in this group
                        container.querySelectorAll('.selection-button').forEach(btn =>
                            btn.classList.remove('selected')
                        );
                        // Add selected to clicked button
                        e.target.classList.add('selected');
                        onSelect(e.target.dataset.value);
                    }
                } else {
                    // Non-toggleable groups work as before
                    container.querySelectorAll('.selection-button').forEach(btn =>
                        btn.classList.remove('selected')
                    );
                    e.target.classList.add('selected');
                    onSelect(e.target.dataset.value);
                }
            }
        });
    }

    setupButtonGroup(positionButtons, (value) => {
        selectedPosition = value;
        updateSubmitButton();
    });

    setupButtonGroup(lineSpaceButtons, (value) => {
        selectedLineSpace = value;
        updateSubmitButton();
    });

    setupButtonGroup(aboveBelowButtons, (value) => {
        selectedAboveBelow = value;
        updateSubmitButton();
    }, true); // Make location buttons toggleable

    setupButtonGroup(accidentalButtons, (value) => {
        selectedAccidental = value;
        updateSubmitButton();

        // Auto-set note name accidental if neither mode is locked
        syncAccidentalToNoteName(value);
    }, true); // Make accidental buttons toggleable

    submitButton.addEventListener('click', () => {
        const staffGuess = constructStaffPositionGuess();
        if (staffGuess) {
            handleGuess(staffGuess, 'staffPosition');
        }
    });
}

function setupModeAnswerControls() {
    // Note name assessment buttons
    const noteNameAssessment = document.getElementById('note-name-assessment-buttons');
    if (noteNameAssessment) {
        console.log('Setting up note name assessment buttons:', noteNameAssessment);
        noteNameAssessment.addEventListener('click', (event) => {
            console.log('Note name assessment clicked:', event.target);
            if (event.target.tagName === 'BUTTON') {
                console.log('Assessment button clicked with value:', event.target.dataset.value);
                const value = parseInt(event.target.dataset.value, 10);
                handleModeAssessment('noteName', value);
            }
        });
    } else {
        console.error('Note name assessment buttons not found!');
    }

    // Staff position assessment buttons
    const staffPositionAssessment = document.getElementById('staff-position-assessment-buttons');
    if (staffPositionAssessment) {
        staffPositionAssessment.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON') {
                const value = parseInt(event.target.dataset.value, 10);
                handleModeAssessment('staffPosition', value);
            }
        });
    }
}

function setupFeedbackIndicatorClickHandlers() {
    // Add click handlers for each feedback indicator
    const indicators = [
        { id: 'keyboard-feedback', mode: 'keyboard' },
        { id: 'note-name-feedback', mode: 'noteName' },
        { id: 'staff-position-feedback', mode: 'staffPosition' }
    ];

    indicators.forEach(({ id, mode }) => {
        const indicator = document.getElementById(id);
        if (indicator) {
            indicator.addEventListener('click', () => {
                // Only show difficulty modal for correct answers
                const guess = state.currentNoteGuesses[mode];
                if (guess && guess.correct) {
                    showModeAssessmentModal(mode);
                }
            });
        }
    });

    // Add close button handlers for mode-specific overlays
    const noteNameOverlay = document.getElementById('note-name-overlay');
    const staffPositionOverlay = document.getElementById('staff-position-overlay');

    if (noteNameOverlay) {
        const closeBtn = noteNameOverlay.querySelector('.close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                noteNameOverlay.classList.add('hidden');
                document.getElementById('note-name-assessment-buttons').classList.add('hidden');
            });
        }
    }

    if (staffPositionOverlay) {
        const closeBtn = staffPositionOverlay.querySelector('.close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                staffPositionOverlay.classList.add('hidden');
                document.getElementById('staff-position-assessment-buttons').classList.add('hidden');
            });
        }
    }
}

function showModeAssessmentModal(mode) {
    const overlay = getModeOverlay(mode);
    const interfaceElement = getInterfaceElement(mode);

    if (overlay && interfaceElement) {
        // Position overlay to cover only the specific interface
        positionOverlayOnInterface(overlay, interfaceElement);

        // Show overlay with assessment buttons
        const assessmentButtons = overlay.querySelector(`#${getModePrefix(mode)}-assessment-buttons`);
        if (assessmentButtons) {
            assessmentButtons.classList.remove('hidden');
            overlay.classList.remove('hidden');
        }
    }
}

function handleModeAssessment(mode, value) {
    // Find the specific mode guess and add rating
    const guess = state.currentNoteGuesses[mode];
    if (guess && guess.correct) {
        // Find the corresponding guess in the mode-specific array and add rating
        const modeGuesses = state.users[state.currentUser].currentSession.modeGuesses[mode];
        const lastModeGuess = modeGuesses[modeGuesses.length - 1];
        if (lastModeGuess && lastModeGuess.note === state.currentNote) {
            lastModeGuess.selfAssessment = value;
        }

        // Mark this guess as having a rating
        guess.hasRating = true;

        // Update the feedback indicator to show it has been rated
        showModeFeedbackIndicator(mode, true, true);
    }

    // Hide this mode's overlay
    const overlay = getModeOverlay(mode);
    if (overlay) {
        overlay.classList.add('hidden');
        const assessmentButtons = overlay.querySelector(`#${getModePrefix(mode)}-assessment-buttons`);
        if (assessmentButtons) {
            assessmentButtons.classList.add('hidden');
        }
    }

    // Check if we should advance to next note
    checkAllModesComplete();
}

function checkAllModesComplete() {
    // Check if all modes have either been guessed and rated (if correct) or just guessed (if wrong)
    const allModesComplete = state.currentModes.every(mode => {
        const guess = state.currentNoteGuesses[mode];
        if (!guess) return false; // Mode not guessed yet
        if (guess.correct && !guess.hasRating) return false; // Correct guess needs rating
        return true; // Wrong guess or rated correct guess
    });

    if (allModesComplete) {
        startNewRound();
    }
}

function hideAllModeOverlays() {
    // Hide overlays
    document.getElementById('note-name-overlay').classList.add('hidden');
    document.getElementById('staff-position-overlay').classList.add('hidden');

    // Hide assessment buttons
    document.getElementById('note-name-assessment-buttons').classList.add('hidden');
    document.getElementById('staff-position-assessment-buttons').classList.add('hidden');

    // Remove answered state from interfaces
    document.getElementById('note-name-interface').classList.remove('answered');
    document.getElementById('staff-position-interface').classList.remove('answered');

    // Clear correct answer highlighting
    document.querySelectorAll('.selection-button.correct-answer').forEach(btn => {
        btn.classList.remove('correct-answer');
    });
}

function handleUndo() {
    // Check if current note has any guesses to undo
    const currentNoteHasGuesses = Object.keys(state.currentNoteGuesses).length > 0;

    if (currentNoteHasGuesses) {
        // Undo the most recent guess for current note
        undoLastGuessForCurrentNote();
    } else if (state.previousNote) {
        // No guesses for current note, go to previous note
        goToPreviousNote();
    }
    // If no guesses and no previous note, do nothing
}

function undoLastGuessForCurrentNote() {
    const user = state.users[state.currentUser];

    // Find the most recent guess for the current note from any mode
    let lastGuessMode = null;
    let lastGuessTime = 0;

    state.currentModes.forEach(mode => {
        if (state.currentNoteGuesses[mode]) {
            const modeGuesses = user.currentSession.modeGuesses[mode];
            const lastModeGuess = modeGuesses[modeGuesses.length - 1];
            if (lastModeGuess && lastModeGuess.note === state.currentNote && lastModeGuess.endTime > lastGuessTime) {
                lastGuessMode = mode;
                lastGuessTime = lastModeGuess.endTime;
            }
        }
    });

    if (lastGuessMode) {
        // Remove the guess from currentNoteGuesses
        delete state.currentNoteGuesses[lastGuessMode];

        // Remove the guess from the mode-specific array
        const modeGuesses = user.currentSession.modeGuesses[lastGuessMode];
        const lastModeGuess = modeGuesses[modeGuesses.length - 1];
        if (lastModeGuess && lastModeGuess.note === state.currentNote) {
            modeGuesses.pop();
        }

        // Remove from legacy guesses array (find the matching guess)
        for (let i = user.currentSession.guesses.length - 1; i >= 0; i--) {
            const guess = user.currentSession.guesses[i];
            if (guess.note === state.currentNote && guess.mode === lastGuessMode && guess.endTime === lastGuessTime) {
                user.currentSession.guesses.splice(i, 1);
                break;
            }
        }

        // Reset UI for the undone mode
        resetModeUI(lastGuessMode);

        // Hide mode feedback indicator for this mode
        showModeFeedbackIndicator(lastGuessMode, false);
        document.getElementById(getModeUIFeedbackId(lastGuessMode)).classList.add('hidden');

        // Re-enable the interface for this mode
        const interfaceElement = getInterfaceElement(lastGuessMode);
        if (interfaceElement) {
            interfaceElement.classList.remove('answered');
        }

        // Re-enable selection buttons and submit buttons
        document.querySelectorAll('.selection-button').forEach(btn => {
            btn.disabled = false;
        });

        // Reset submit button states properly
        if (lastGuessMode === 'noteName') {
            document.getElementById('note-name-submit').disabled = true; // Will be enabled when selections are made
        } else if (lastGuessMode === 'staffPosition') {
            document.getElementById('staff-position-submit').disabled = true; // Will be enabled when selections are made
        }

        // Hide mode-specific overlays for the undone mode
        const overlay = getModeOverlay(lastGuessMode);
        if (overlay) {
            overlay.classList.add('hidden');
            const assessmentButtons = overlay.querySelector(`#${getModePrefix(lastGuessMode)}-assessment-buttons`);
            if (assessmentButtons) {
                assessmentButtons.classList.add('hidden');
            }
        }

        // Check if we need to hide assessment controls
        const hasCorrectGuesses = Object.values(state.currentNoteGuesses).some(g => g.correct);
        if (!hasCorrectGuesses) {
            document.getElementById("assessment-buttons").classList.add("hidden");
            document.getElementById("next-controls").classList.add("hidden");
            document.getElementById("answer-controls").classList.add("hidden");
        }

        // Update stats and feedback
        updateStats();
        updateGlobalFeedback();
    }
}

function goToPreviousNote() {
    if (state.previousNote) {
        state.currentNote = state.previousNote;
        state.previousNote = null;

        // Remove the last guess from legacy array (for backward compatibility)
        const user = state.users[state.currentUser];
        if (user.currentSession.guesses.length > 0) {
            user.currentSession.guesses.pop();
        }

        drawNote(state.currentNote.clef, state.currentNote.note);

        // Reset all UI elements
        resetAllInterfacesAndState();
    }
}

function resetModeUI(mode) {
    if (mode === 'keyboard') {
        // Reset keyboard UI
        document.querySelectorAll(".key").forEach(key => {
            key.classList.remove("correct", "incorrect");
            key.addEventListener("click", handleKeyClick);
        });
    } else if (mode === 'noteName') {
        resetNoteNameInterface();
        // Also reset the internal state variables
        if (window.resetNoteNameState) {
            window.resetNoteNameState();
        }
    } else if (mode === 'staffPosition') {
        resetStaffPositionInterface();
        // Also reset the internal state variables
        if (window.resetStaffPositionState) {
            window.resetStaffPositionState();
        }
    }

    // Clear correct answer highlighting for this mode
    document.querySelectorAll('.selection-button.correct-answer').forEach(btn => {
        btn.classList.remove('correct-answer');
    });
}

function getModeUIFeedbackId(mode) {
    switch (mode) {
        case 'keyboard': return 'keyboard-feedback';
        case 'noteName': return 'note-name-feedback';
        case 'staffPosition': return 'staff-position-feedback';
        default: return '';
    }
}

function updateGlobalFeedback() {
    // Update the main feedback based on remaining guesses
    const hasAnyGuess = Object.keys(state.currentNoteGuesses).length > 0;
    if (!hasAnyGuess) {
        document.getElementById("feedback").textContent = "";
    } else {
        // Show general feedback if there are still guesses
        const hasCorrect = Object.values(state.currentNoteGuesses).some(g => g.correct);
        const hasIncorrect = Object.values(state.currentNoteGuesses).some(g => !g.correct);
        if (hasCorrect && hasIncorrect) {
            document.getElementById("feedback").textContent = "✅❌";
        } else if (hasCorrect) {
            document.getElementById("feedback").textContent = "✅";
        } else if (hasIncorrect) {
            document.getElementById("feedback").textContent = "❌";
        }
    }
}

function resetAllInterfacesAndState() {
    // Reset all interface states
    resetNoteNameInterface();
    resetStaffPositionInterface();

    // Reset keyboard UI
    document.querySelectorAll(".key").forEach(key => {
        key.classList.remove("correct", "incorrect");
        key.addEventListener("click", handleKeyClick);
    });

    // Reset state
    state.currentNoteGuesses = {};
    state.noteAnswered = false;

    // Reset UI elements
    document.getElementById("feedback").textContent = "";
    document.getElementById("assessment-buttons").classList.add("hidden");
    document.getElementById("next-controls").classList.add("hidden");
    document.getElementById("answer-controls").classList.add("hidden");

    // Re-enable guessing interfaces
    document.querySelectorAll('.selection-button').forEach(btn => {
        btn.disabled = false;
    });
    document.getElementById('note-name-submit').disabled = true;
    document.getElementById('staff-position-submit').disabled = true;

    // Remove answered state from interfaces
    document.getElementById('note-name-interface').classList.remove('answered');
    document.getElementById('staff-position-interface').classList.remove('answered');

    // Hide all mode feedback indicators
    hideAllModeFeedbackIndicators();

    // Hide all mode overlays
    hideAllModeOverlays();
}

function startNewRound() {
    // Reset key colors and feedback
    document.querySelectorAll(".key").forEach(key => {
        key.classList.remove("correct", "incorrect");
    });
    document.getElementById("feedback").textContent = "";

    // Clear correct answer highlights from all selection buttons
    document.querySelectorAll(".selection-button").forEach(button => {
        button.classList.remove("correct-answer");
    });

    // Hide all answer controls
    document.getElementById("assessment-buttons").classList.add("hidden");
    document.getElementById("next-controls").classList.add("hidden");
    document.getElementById("answer-controls").classList.add("hidden");

    // Disable standalone next button at start of new round
    const standaloneNext = document.getElementById("standalone-next-button");
    if (standaloneNext) {
        standaloneNext.disabled = true;
    }

    // Hide all mode overlays
    hideAllModeOverlays();

    // Hide all mode feedback indicators
    hideAllModeFeedbackIndicators();

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

    // Initialize current modes and reset guesses for the new note
    const user = state.users[state.currentUser];
    state.currentModes = [];
    if (user.settings.enableKeyboardMode) state.currentModes.push('keyboard');
    if (user.settings.enableNoteNameMode) state.currentModes.push('noteName');
    if (user.settings.enableStaffPositionMode) state.currentModes.push('staffPosition');

    // Reset current note guesses
    state.currentNoteGuesses = {};

    // Show appropriate guessing interfaces based on enabled modes
    showGuessingInterfaces();

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

function getCanonicalNoteName(note) {
    // Map flats to their sharp equivalents (canonical form used by piano keys)
    const flatToSharpMap = {
        'Db': 'C#',
        'Eb': 'D#',
        'Gb': 'F#',
        'Ab': 'G#',
        'Bb': 'A#'
    };

    const noteName = note.slice(0, -1); // Remove octave
    const octave = note.slice(-1);

    if (flatToSharpMap[noteName]) {
        return flatToSharpMap[noteName] + octave;
    }

    return note; // Return original note if no mapping needed
}

function getActiveModes() {
    const user = state.users[state.currentUser];
    const settings = user.settings;
    const modes = [];

    if (settings.enableKeyboardMode) modes.push('keyboard');
    if (settings.enableNoteNameMode) modes.push('noteName');
    if (settings.enableStaffPositionMode) modes.push('staffPosition');

    return modes;
}

function showGuessingInterfaces() {
    const activeModes = getActiveModes();

    // Hide all interfaces first
    document.getElementById('note-name-interface').classList.add('hidden');
    document.getElementById('staff-position-interface').classList.add('hidden');

    // Show keyboard if enabled
    const piano = document.getElementById('piano');
    if (activeModes.includes('keyboard')) {
        piano.style.display = 'flex';
        // Enable piano key clicks
        document.querySelectorAll('.key').forEach(key => {
            key.addEventListener('click', handleKeyClick);
        });
    } else {
        piano.style.display = 'none';
    }

    // Show other interfaces
    if (activeModes.includes('noteName')) {
        document.getElementById('note-name-interface').classList.remove('hidden');
        resetNoteNameInterface();
    }

    if (activeModes.includes('staffPosition')) {
        document.getElementById('staff-position-interface').classList.remove('hidden');
        resetStaffPositionInterface();
    }

    // Re-enable all selection buttons
    document.querySelectorAll('.selection-button').forEach(btn => {
        btn.disabled = false;
    });

    state.currentModes = activeModes;
}

function resetNoteNameInterface() {
    // Reset all selections
    document.querySelectorAll('#note-letter-buttons .selection-button').forEach(btn =>
        btn.classList.remove('selected')
    );
    document.querySelectorAll('#accidental-buttons .selection-button').forEach(btn =>
        btn.classList.remove('selected')
    );

    // Reset state variables
    if (window.resetNoteNameState) {
        window.resetNoteNameState();
    }
}

function resetStaffPositionInterface() {
    // Reset all selections
    document.querySelectorAll('#position-buttons .selection-button').forEach(btn =>
        btn.classList.remove('selected')
    );
    document.querySelectorAll('#line-space-buttons .selection-button').forEach(btn =>
        btn.classList.remove('selected')
    );
    document.querySelectorAll('#above-below-buttons .selection-button').forEach(btn =>
        btn.classList.remove('selected')
    );
    document.querySelectorAll('#staff-accidental-buttons .selection-button').forEach(btn =>
        btn.classList.remove('selected')
    );

    // Reset state variables
    if (window.resetStaffPositionState) {
        window.resetStaffPositionState();
    }
}

function constructStaffPositionGuess() {
    const position = document.querySelector('#position-buttons .selection-button.selected')?.dataset.value || '';
    const lineSpace = document.querySelector('#line-space-buttons .selection-button.selected')?.dataset.value || '';
    const aboveBelow = document.querySelector('#above-below-buttons .selection-button.selected')?.dataset.value || '';
    const accidental = document.querySelector('#staff-accidental-buttons .selection-button.selected')?.dataset.value || '';

    if (!position || !lineSpace) return null;

    // Instead of guessing the note name, compare the staff position directly
    // This returns a staff position object that can be compared with the correct answer
    return {
        position: position,
        lineSpace: lineSpace,
        aboveBelow: aboveBelow,
        accidental: accidental
    };
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
    const activeModes = getActiveModes();
    const history = user.sessionHistory.flatMap(session => session.guesses);
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recentHistory = history.filter(guess => guess.startTime > twoWeeksAgo);

    // Initialize note statistics for each mode
    const noteStats = {};
    possibleNotes.forEach(note => {
        const noteId = `${note.clef}-${note.note}`;
        noteStats[noteId] = {};
        activeModes.forEach(mode => {
            noteStats[noteId][mode] = { seen: 0, correct: 0 };
        });
    });

    // Collect statistics from history
    recentHistory.forEach(guess => {
        const noteId = `${guess.note.clef}-${guess.note.note}`;
        const mode = guess.mode || 'keyboard'; // Default to keyboard for older data

        if (noteStats[noteId] && noteStats[noteId][mode]) {
            noteStats[noteId][mode].seen++;
            if (guess.correct) {
                const timeTaken = (guess.endTime - guess.startTime) / 1000;
                noteStats[noteId][mode].correct += getScoreForTime(timeTaken);
            }
        }
    });

    const weights = possibleNotes.map(note => {
        const noteId = `${note.clef}-${note.note}`;
        const stats = noteStats[noteId];

        // Don't repeat the same note
        if ((note.clef === state.currentNote?.clef && note.note === state.currentNote?.note) ||
            (note.clef === state.lastAnsweredNote?.clef && note.note === state.lastAnsweredNote?.note)) {
            return 0;
        }

        // Calculate combined weight across all active modes
        let combinedWeight = 0;
        let totalModes = 0;

        activeModes.forEach(mode => {
            const modeStats = stats[mode];
            if (modeStats.seen < 10) {
                // Not enough data, prioritize this note
                combinedWeight += 1;
            } else {
                const successRate = modeStats.correct / modeStats.seen;
                const modeWeight = 1 - successRate;
                combinedWeight += modeWeight;
            }
            totalModes++;
        });

        // Average the weights across active modes
        const avgWeight = combinedWeight / totalModes;
        const minWeight = 1 / (5 * possibleNotes.length);

        return Math.max(avgWeight, minWeight);
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

function handleGuess(noteOrStaffPosition, mode = 'keyboard') {
    const correctNote = state.currentNote.note;
    let isCorrect = false;

    if (mode === 'staffPosition') {
        // Handle staff position guess - compare staff position objects
        const clef = state.currentNote.clef;
        const correctStaffPosition = getNoteStaffPosition(clef, correctNote);

        console.log(`Staff position validation for ${correctNote} on ${clef} clef:`);
        console.log('User guess:', noteOrStaffPosition);
        console.log('Correct position:', correctStaffPosition);

        isCorrect = compareNoteStaffPositions(noteOrStaffPosition, correctStaffPosition);
    } else {
        // Handle note name guess (original logic)
        const note = noteOrStaffPosition;
        isCorrect = note === correctNote || getCanonicalNoteName(note) === getCanonicalNoteName(correctNote);
    }

    // Update UI feedback based on mode
    if (mode === 'keyboard') {
        const note = noteOrStaffPosition; // For keyboard mode, it's still a note string
        const key = document.querySelector(`.key[data-note="${note}"]`);
        if (isCorrect) {
            key.classList.add("correct");
        } else {
            key.classList.add("incorrect");
            // Use canonical note name to find the correct key (piano keys use sharp names)
            const canonicalCorrectNote = getCanonicalNoteName(correctNote);
            const correctKey = document.querySelector(`.key[data-note="${canonicalCorrectNote}"]`);
            if (correctKey) {
                correctKey.classList.add("correct");
            }
        }
    }

    // Show feedback
    document.getElementById("feedback").textContent = isCorrect ? "✅" : "❌";

    // Enable standalone next button once any answer is given
    const standaloneNext = document.getElementById("standalone-next-button");
    if (standaloneNext) {
        standaloneNext.disabled = false;
    }

    // Record the guess in both legacy and mode-specific arrays
    const guessData = {
        note: state.currentNote,
        guess: noteOrStaffPosition,
        mode: mode,
        startTime: state.noteStartTime,
        endTime: Date.now(),
        correct: isCorrect,
    };

    // Add to legacy array for backward compatibility
    state.users[state.currentUser].currentSession.guesses.push(guessData);

    // Add to mode-specific array
    state.users[state.currentUser].currentSession.modeGuesses[mode].push(guessData);

    // Track this guess for the current note
    state.currentNoteGuesses[mode] = {
        guess: noteOrStaffPosition,
        correct: isCorrect,
        hasRating: false
    };

    // Show feedback indicator for this mode
    showModeFeedbackIndicator(mode, isCorrect);

    // Disable the specific interface that was guessed
    const interfaceElement = getInterfaceElement(mode);
    if (interfaceElement) {
        interfaceElement.classList.add('answered');
    }

    // Check if this was the last active mode to guess
    const allModesGuessed = state.currentModes.every(m => state.currentNoteGuesses[m]);

    if (allModesGuessed) {
        // All modes have been guessed, disable all interfaces
        disableGuessingInterfaces();
        state.noteAnswered = true;

        // Check if any guesses were correct
        const hasCorrectGuess = Object.values(state.currentNoteGuesses).some(g => g.correct);

        if (hasCorrectGuess) {
            // Show assessment buttons for correct answers only
            document.getElementById("assessment-buttons").classList.remove("hidden");
            document.getElementById("answer-controls").classList.remove("hidden");
        } else {
            // All wrong, show correct answers for all modes and show next button
            Object.keys(state.currentNoteGuesses).forEach(mode => {
                if (mode !== 'keyboard') {
                    showCorrectAnswer(mode, correctNote);
                }
            });
            document.getElementById("next-controls").classList.remove("hidden");
            document.getElementById("answer-controls").classList.remove("hidden");
        }
    } else {
        // More modes to guess, show mode-specific overlay only for correct answers
        if (isCorrect) {
            const overlay = getModeOverlay(mode);
            if (overlay) {
                // Position overlay to cover only the specific interface
                positionOverlayOnInterface(overlay, interfaceElement);

                // Show overlay with assessment buttons
                const assessmentButtons = overlay.querySelector(`#${getModePrefix(mode)}-assessment-buttons`);
                if (assessmentButtons) {
                    assessmentButtons.classList.remove('hidden');
                    overlay.classList.remove('hidden');
                }
            } else if (mode === 'keyboard') {
                // For keyboard mode, show main assessment buttons since it doesn't have a mode-specific overlay
                document.getElementById("assessment-buttons").classList.remove("hidden");
                document.getElementById("answer-controls").classList.remove("hidden");
            }
        } else {
            // Show correct answer for wrong guesses
            if (mode !== 'keyboard') {
                showCorrectAnswer(mode, correctNote);
            }
        }
    }

    // Update stats
    updateStats();
}

function showModeFeedbackIndicator(mode, isCorrect, hasRating = false) {
    const feedbackId = mode === 'keyboard' ? 'keyboard-feedback' :
                      mode === 'noteName' ? 'note-name-feedback' : 'staff-position-feedback';

    const indicator = document.getElementById(feedbackId);
    if (indicator) {
        if (isCorrect) {
            indicator.textContent = hasRating ? '✅' : '?';
            indicator.title = hasRating ? 'Click to change difficulty rating' : 'Click to rate difficulty';
        } else {
            indicator.textContent = '❌';
            indicator.title = 'Incorrect answer';
        }
        indicator.classList.remove('hidden', 'correct', 'incorrect');
        indicator.classList.add(isCorrect ? 'correct' : 'incorrect');
    }
}

function hideAllModeFeedbackIndicators() {
    const indicators = ['keyboard-feedback', 'note-name-feedback', 'staff-position-feedback'];
    indicators.forEach(id => {
        const indicator = document.getElementById(id);
        if (indicator) {
            indicator.classList.add('hidden');
            indicator.classList.remove('correct', 'incorrect');
        }
    });
}

function getInterfaceElement(mode) {
    switch (mode) {
        case 'keyboard':
            return document.getElementById('piano');
        case 'noteName':
            return document.getElementById('note-name-interface');
        case 'staffPosition':
            return document.getElementById('staff-position-interface');
        default:
            return null;
    }
}

function getModeOverlay(mode) {
    switch (mode) {
        case 'noteName':
            return document.getElementById('note-name-overlay');
        case 'staffPosition':
            return document.getElementById('staff-position-overlay');
        default:
            return null;
    }
}

function getModePrefix(mode) {
    switch (mode) {
        case 'noteName':
            return 'note-name';
        case 'staffPosition':
            return 'staff-position';
        default:
            return mode;
    }
}

function disableGuessingInterfaces() {
    // Disable keyboard
    document.querySelectorAll(".key").forEach(key => {
        key.removeEventListener("click", handleKeyClick);
    });

    // Disable submit buttons and selection buttons
    document.getElementById('note-name-submit').disabled = true;
    document.getElementById('staff-position-submit').disabled = true;

    // Disable all selection buttons
    document.querySelectorAll('.selection-button').forEach(btn => {
        btn.disabled = true;
    });
}

function positionOverlayOnInterface(overlay, interfaceElement) {
    // Get the interface element's position and size
    const rect = interfaceElement.getBoundingClientRect();

    // Position the overlay to cover exactly the interface
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    console.log(`Positioned overlay at:`, {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
    });
}

function showCorrectAnswer(mode, correctNote) {
    if (mode === 'noteName') {
        showCorrectNoteNameAnswer(correctNote);
    } else if (mode === 'staffPosition') {
        showCorrectStaffPositionAnswer(correctNote);
    }
}

function showCorrectNoteNameAnswer(correctNote) {
    // Parse the correct note
    const noteName = correctNote.slice(0, -1).replace(/[#b]/, ''); // Remove octave and accidental
    const accidental = correctNote.includes('#') ? '#' : correctNote.includes('b') ? 'b' : '';

    // Highlight the correct note letter
    const correctNoteButton = document.querySelector(`#note-letter-buttons .selection-button[data-value="${noteName}"]`);
    if (correctNoteButton) {
        correctNoteButton.classList.add('correct-answer');
    }

    // Highlight the correct accidental if any
    if (accidental) {
        const correctAccidentalButton = document.querySelector(`#accidental-buttons .selection-button[data-value="${accidental}"]`);
        if (correctAccidentalButton) {
            correctAccidentalButton.classList.add('correct-answer');
        }
    }
}

function showCorrectStaffPositionAnswer(correctNote) {
    const clef = state.currentNote.clef;
    const staffPosition = getNoteStaffPosition(clef, correctNote);

    if (staffPosition) {
        const { position, lineSpace, aboveBelow, accidental } = staffPosition;

        // Highlight correct position
        const correctPositionButton = document.querySelector(`#position-buttons .selection-button[data-value="${position}"]`);
        if (correctPositionButton) {
            correctPositionButton.classList.add('correct-answer');
        }

        // Highlight correct line/space
        const correctLineSpaceButton = document.querySelector(`#line-space-buttons .selection-button[data-value="${lineSpace}"]`);
        if (correctLineSpaceButton) {
            correctLineSpaceButton.classList.add('correct-answer');
        }

        // Highlight correct above/below if applicable
        if (aboveBelow) {
            const correctAboveBelowButton = document.querySelector(`#above-below-buttons .selection-button[data-value="${aboveBelow}"]`);
            if (correctAboveBelowButton) {
                correctAboveBelowButton.classList.add('correct-answer');
            }
        }

        // Highlight correct accidental if applicable
        if (accidental && accidental !== '') {
            const correctAccidentalButton = document.querySelector(`#staff-accidental-buttons .selection-button[data-value="${accidental}"]`);
            if (correctAccidentalButton) {
                correctAccidentalButton.classList.add('correct-answer');
            }
        }
    }
}

// Diatonic absolute indexing system
// Based on natural notes: C0=0, D0=1, E0=2, F0=3, G0=4, A0=5, B0=6, C1=7, etc.
// Accidentals are handled separately
function noteToDiatonicIndex(note) {
    const naturalNotes = ["C", "D", "E", "F", "G", "A", "B"];
    const octave = parseInt(note.slice(-1));
    const noteName = note.slice(0, -1).replace(/[#b]/, ''); // Remove accidental
    const accidental = note.includes('#') ? '#' : note.includes('b') ? 'b' : '';

    const noteIndex = naturalNotes.indexOf(noteName);
    if (noteIndex === -1) return null;

    return {
        diatonicIndex: octave * 7 + noteIndex,
        accidental: accidental
    };
}

function diatonicIndexToNote(diatonicIndex, accidental = '') {
    const naturalNotes = ["C", "D", "E", "F", "G", "A", "B"];
    const octave = Math.floor(diatonicIndex / 7);
    const noteIndex = diatonicIndex % 7;

    return naturalNotes[noteIndex] + accidental + octave;
}

function getStaffPositionFromDiatonicIndex(clef, diatonicIndex, accidental = '') {
    // Define reference positions for each clef (diatonic index of bottom line)
    const clefReferences = {
        treble: 30, // E4 = (4 * 7) + 2 = 30 (E is index 2 in natural notes)
        bass: 18   // G2 = (2 * 7) + 4 = 18 (G is index 4 in natural notes)
    };

    const referenceIndex = clefReferences[clef];
    const staffPosition = diatonicIndex - referenceIndex;

    console.log(`Calculating position: diatonicIndex=${diatonicIndex}, reference=${referenceIndex}, staffPosition=${staffPosition}`);

    // Staff position names and types (0 = bottom line)
    const positionNames = [
        "bottom",
        "bottom",
        "2nd",
        "2nd",
        "middle",
        "middle",
        "4th",
        "top",
        "top"
    ];
    const ordinalText = ['0th', '1st', '2nd', '3rd', '4th'];


    let aboveBelow = '';
    let lineSpace = (diatonicIndex % 2 === 0) ? 'line' : 'space';
    let position;

    if (staffPosition < 0 || staffPosition > positionNames.length) {
        let count;
        if (staffPosition > positionNames.length) {
            aboveBelow = 'above';
            count = staffPosition - positionNames.length + 1;
        } else {
            aboveBelow = 'below';
            count = Math.abs(staffPosition);
        }
        position = ordinalText[Math.ceil(count / 2)];
    } else {
        position = positionNames[staffPosition];
    }

    return { position, lineSpace, aboveBelow, accidental };
}

function getNoteStaffPosition(clef, note) {
    // Use the new diatonic indexing system for accurate positioning
    const diatonicData = noteToDiatonicIndex(note);
    if (diatonicData === null) return null;

    return getStaffPositionFromDiatonicIndex(clef, diatonicData.diatonicIndex, diatonicData.accidental);
}

function compareNoteStaffPositions(position1, position2) {
    return (
        position1.position == position2.position &&
        position1.lineSpace == position2.lineSpace &&
        position1.aboveBelow == position2.aboveBelow &&
        position1.accidental == position2.accidental
    );
}

function drawNote(clef, note) {
    // Store current note and clef for resize handling
    currentNote = note;
    currentClef = clef;

    const musicScore = document.getElementById("music-score");

    // Create or get the VexFlow container
    let vexflowContainer = musicScore.querySelector('#vexflow-container');
    if (!vexflowContainer) {
        vexflowContainer = document.createElement('div');
        vexflowContainer.id = 'vexflow-container';
        // Insert as first child so it appears above the guessing interfaces
        musicScore.insertBefore(vexflowContainer, musicScore.firstChild);
    } else {
        vexflowContainer.innerHTML = '';
    }

    try {
        // Get container dimensions with minimum constraints
        const containerWidth = Math.max(musicScore.clientWidth, 200);
        const containerHeight = Math.max(musicScore.clientHeight, 150);

        // Get diatonic data first for all calculations
        const diatonicData = noteToDiatonicIndex(note);
        const clefReferences = {
            treble: 30, // E4 bottom line
            bass: 18   // G2 bottom line
        };
        const middleLineOffset = 2; // Middle line is 2 positions above bottom line
        const middleLineDiatonic = clefReferences[clef] + middleLineOffset;

        // Create the note first to calculate its position requirements
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

        // Calculate how many ledger lines this note needs
        const calculateLedgerLines = (clef, noteName, octave) => {
            const staffPositions = {
                'treble': {
                    // Staff lines from bottom to top: E4, G4, B4, D5, F5
                    center: 4, // B4 is the middle line
                    bottomLine: 2, // E4
                    topLine: 6  // F5
                },
                'bass': {
                    // Staff lines from bottom to top: G2, B2, D3, F3, A3
                    center: 3, // D3 is the middle line
                    bottomLine: 1, // G2
                    topLine: 5  // A3
                }
            };

            const noteNumbers = {
                'c': 0, 'd': 1, 'e': 2, 'f': 3, 'g': 4, 'a': 5, 'b': 6
            };

            const staffInfo = staffPositions[clef];
            if (!staffInfo) return 0;

            // Calculate absolute note position (C4 = 40, D4 = 41, etc.)
            const baseNote = noteName.charAt(0).toLowerCase();
            const absolutePosition = (parseInt(octave) * 7) + noteNumbers[baseNote];

            let referencePosition;
            if (clef === 'treble') {
                referencePosition = (4 * 7) + noteNumbers['b']; // B4 = 46
            } else {
                referencePosition = (3 * 7) + noteNumbers['d']; // D3 = 22
            }

            const positionDiff = absolutePosition - referencePosition;
            return Math.max(0, Math.abs(positionDiff) - 2); // 2 staff lines in either direction before needing ledgers
        };

        const ledgerLinesNeeded = calculateLedgerLines(clef, noteName, parseInt(octave));

        // Create a compact staff - adjust height based on note requirements
        const baseStaveWidth = 120; // Minimal width for clef, note, and time signature
        const baseStaffHeight = 100; // Height of just the staff
        const ledgerLineSpace = 10; // Additional space per ledger line
        const baseHeight = baseStaffHeight + (ledgerLinesNeeded * ledgerLineSpace * 2); // Space above and below

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

        // Make SVG responsive
        const svg = vexflowContainer.querySelector('svg');
        if (svg) {
            svg.setAttribute('viewBox', `0 0 ${scaledWidth} ${scaledHeight}`);
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.style.cssText = 'width: 100%; height: 100%; max-width: 100%; max-height: 100%;';
        }

        // Apply scaling to the context
        context.scale(scale, scale);

        // Position staff off-center based on note position
        // If note is high, move staff down; if note is low, move staff up
        const isNoteHigh = (clef, noteName, octave) => {
            if (clef === 'treble') return octave > 4 || (octave === 4 && ['b', 'a', 'g'].includes(noteName.charAt(0)));
            if (clef === 'bass') return octave > 3 || (octave === 3 && ['a', 'g', 'f', 'e'].includes(noteName.charAt(0)));
            return false;
        };

        const noteIsHigh = isNoteHigh(clef, noteName, parseInt(octave));
        const staffOffset = noteIsHigh ? (ledgerLinesNeeded * 5) : -(ledgerLinesNeeded * 5);
        const staveY = (baseHeight - baseStaffHeight) / 2 + staffOffset;

        const stave = new Stave(20, staveY, baseStaveWidth);
        stave.addClef(clef)
        stave.setContext(context).draw();

        // Determine stem direction based on diatonic staff position
        const stemDown = diatonicData.diatonicIndex >= middleLineDiatonic;

        // Create notes
        const staveNote = new StaveNote({
            clef: clef,
            keys: [vfNoteString],
            duration: "q",
            align_center: true
        });

        // Set stem direction using VexFlow's method
        staveNote.setStemDirection(stemDown ? -1 : 1);

        const notes = [staveNote];

        const voice = new Voice({ num_beats: 1, beat_value: 1 });
        voice.addTickables(notes);
        voice.setStrict(false); // Allow less than 4 notes
        Accidental.applyAccidentals([voice], `C`);

        // Format and justify the notes to the compact stave
        const formatter = new Formatter().joinVoices([voice]).format([voice], baseStaveWidth - 140);

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
    handleGuess(event.target.dataset.note, 'keyboard');
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
    const statsDisplay = document.getElementById("stats-display");

    // Calculate stats for each active mode
    const modeStats = [];
    const activeModes = ['keyboard', 'noteName', 'staffPosition'].filter(mode => {
        const settingKey = mode === 'keyboard' ? 'enableKeyboardMode' :
                          mode === 'noteName' ? 'enableNoteNameMode' : 'enableStaffPositionMode';
        return user.settings[settingKey];
    });

    activeModes.forEach(mode => {
        const modeGuesses = user.currentSession.modeGuesses[mode];
        const total = modeGuesses.length;
        const correct = modeGuesses.filter(guess => guess.correct).length;
        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

        const modeLabel = mode === 'keyboard' ? 'K' :
                         mode === 'noteName' ? 'N' : 'S';
        modeStats.push(`${modeLabel}: ${correct}/${total} (${percentage}%)`);
    });

    if (modeStats.length > 0) {
        statsDisplay.innerHTML = modeStats.join('<br>');
    } else {
        statsDisplay.textContent = '0 / 0 (0%)';
    }
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
        guesses: [],
        modeGuesses: {
            keyboard: [],
            noteName: [],
            staffPosition: []
        }
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

            // Migrate all users to ensure they have the proper structure
            Object.keys(state.users).forEach(userName => {
                const user = state.users[userName];

                if (!user.settings) {
                    user.settings = {
                        bassClefRange: "B1-D4",
                        trebleClefRange: "B3-D6",
                        includeSharps: true,
                        includeFlats: false,
                        enableKeyboardMode: true,
                        enableNoteNameMode: false,
                        enableStaffPositionMode: false,
                    };
                }
                // Add new settings with defaults if they don't exist
                if (user.settings.enableKeyboardMode === undefined) user.settings.enableKeyboardMode = true;
                if (user.settings.enableNoteNameMode === undefined) user.settings.enableNoteNameMode = false;
                if (user.settings.enableStaffPositionMode === undefined) user.settings.enableStaffPositionMode = false;

                if (!user.sessionHistory) {
                    user.sessionHistory = [];
                }

                if (!user.currentSession) {
                    user.currentSession = {
                        startTime: null,
                        endTime: null,
                        guesses: [],
                        modeGuesses: {
                            keyboard: [],
                            noteName: [],
                            staffPosition: []
                        }
                    };
                }
                // Ensure modeGuesses exists for existing sessions
                if (!user.currentSession.modeGuesses) {
                    user.currentSession.modeGuesses = {
                        keyboard: [],
                        noteName: [],
                        staffPosition: []
                    };
                }
            });
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
    document.getElementById("enable-keyboard-mode").checked = settings.enableKeyboardMode;
    document.getElementById("enable-note-name-mode").checked = settings.enableNoteNameMode;
    document.getElementById("enable-staff-position-mode").checked = settings.enableStaffPositionMode;

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
                enableKeyboardMode: true,
                enableNoteNameMode: false,
                enableStaffPositionMode: false,
            },
            sessionHistory: [],
            currentSession: {
                startTime: null,
                endTime: null,
                guesses: [],
                modeGuesses: {
                    keyboard: [],
                    noteName: [],
                    staffPosition: []
                }
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

function isModeLockedForCurrentNote(mode) {
    // A mode is locked if a guess has been submitted for it for the current note
    return state.currentNoteGuesses[mode] !== undefined;
}

function syncAccidentalToStaffPosition(accidentalValue) {
    // Only sync if staff position mode is active and not locked
    const activeModes = getActiveModes();
    if (!activeModes.includes('staffPosition') || isModeLockedForCurrentNote('staffPosition')) {
        return;
    }

    // Set the accidental in staff position interface
    const staffAccidentalButtons = document.getElementById('staff-accidental-buttons');

    // First clear all selected accidentals in staff position
    staffAccidentalButtons.querySelectorAll('.selection-button').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Then select the matching accidental if one was provided
    if (accidentalValue) {
        const matchingButton = staffAccidentalButtons.querySelector(`[data-value="${accidentalValue}"]`);
        if (matchingButton) {
            matchingButton.classList.add('selected');
        }
    }

    // Update the internal state variable
    if (window.setStaffPositionAccidental) {
        window.setStaffPositionAccidental(accidentalValue);
    }
}

function syncAccidentalToNoteName(accidentalValue) {
    // Only sync if note name mode is active and not locked
    const activeModes = getActiveModes();
    if (!activeModes.includes('noteName') || isModeLockedForCurrentNote('noteName')) {
        return;
    }

    // Set the accidental in note name interface
    const noteAccidentalButtons = document.getElementById('accidental-buttons');

    // First clear all selected accidentals in note name
    noteAccidentalButtons.querySelectorAll('.selection-button').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Then select the matching accidental if one was provided
    if (accidentalValue) {
        const matchingButton = noteAccidentalButtons.querySelector(`[data-value="${accidentalValue}"]`);
        if (matchingButton) {
            matchingButton.classList.add('selected');
        }
    }

    // Update the internal state variable
    if (window.setNoteNameAccidental) {
        window.setNoteNameAccidental(accidentalValue);
    }
}
