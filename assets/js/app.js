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

    document.getElementById('note-name-submit').disabled = true;
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

    document.getElementById('staff-position-submit').disabled = true;
}

function constructStaffPositionGuess() {
    const position = document.querySelector('#position-buttons .selection-button.selected')?.dataset.value || '';
    const lineSpace = document.querySelector('#line-space-buttons .selection-button.selected')?.dataset.value || '';
    const aboveBelow = document.querySelector('#above-below-buttons .selection-button.selected')?.dataset.value || '';
    const accidental = document.querySelector('#staff-accidental-buttons .selection-button.selected')?.dataset.value || '';

    if (!position || !lineSpace) return null;

    // Convert staff position to note name based on clef
    const clef = state.currentNote.clef;
    const octave = state.currentNote.note.slice(-1);

    let noteName = getStaffPositionNote(clef, position, lineSpace, aboveBelow);
    if (!noteName) return null;

    return noteName + accidental + octave;
}

function getStaffPositionNote(clef, position, lineSpace, aboveBelow) {
    // Map staff positions to note names for treble and bass clef
    const treblePositions = {
        // On staff (bottom to top: bottom line, bottom space, second line, second space, middle line, middle space, fourth line, top space, top line)
        'bottom_line': 'E',
        'bottom_space': 'F',
        'second_line': 'G',
        'second_space': 'A',
        'middle_line': 'B',
        'middle_space': 'C',
        'fourth_line': 'D',
        'top_space': 'E',
        'top_line': 'F',
        // Below staff
        '1st_space_below': 'D',
        '1st_line_below': 'C',
        '2nd_space_below': 'B',
        '2nd_line_below': 'A',
        '3rd_space_below': 'G',
        '3rd_line_below': 'F',
        '4th_space_below': 'E',
        '4th_line_below': 'D',
        // Above staff
        '1st_line_above': 'G',
        '1st_space_above': 'A',
        '2nd_line_above': 'B',
        '2nd_space_above': 'C',
        '3rd_line_above': 'D',
        '3rd_space_above': 'E',
        '4th_line_above': 'F',
        '4th_space_above': 'G'
    };

    const bassPositions = {
        // On staff (bottom to top: bottom line, bottom space, second line, second space, middle line, middle space, fourth line, top space, top line)
        'bottom_line': 'G',
        'bottom_space': 'A',
        'second_line': 'B',
        'second_space': 'C',
        'middle_line': 'D',
        'middle_space': 'E',
        'fourth_line': 'F',
        'top_space': 'G',
        'top_line': 'A',
        // Below staff
        '1st_space_below': 'F',
        '1st_line_below': 'E',
        '2nd_space_below': 'D',
        '2nd_line_below': 'C',
        '3rd_space_below': 'B',
        '3rd_line_below': 'A',
        '4th_space_below': 'G',
        '4th_line_below': 'F',
        // Above staff
        '1st_line_above': 'B',
        '1st_space_above': 'C',
        '2nd_line_above': 'D',
        '2nd_space_above': 'E',
        '3rd_line_above': 'F',
        '3rd_space_above': 'G',
        '4th_line_above': 'A',
        '4th_space_above': 'B'
    };

    // Construct key for lookup
    let key;
    if (aboveBelow) {
        key = `${position}_${lineSpace}_${aboveBelow}`;
    } else {
        key = `${position}_${lineSpace}`;
    }

    const positions = clef === 'treble' ? treblePositions : bassPositions;
    return positions[key] || null;
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

function handleGuess(note, mode = 'keyboard') {
    const correctNote = state.currentNote.note;

    // Check if the guess is correct (including enharmonic equivalents)
    const isCorrect = note === correctNote || getCanonicalNoteName(note) === getCanonicalNoteName(correctNote);

    // Update UI feedback based on mode
    if (mode === 'keyboard') {
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
        guess: note,
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
        guess: note,
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

function getNoteStaffPosition(clef, note) {
    // Parse note to get base note and accidental
    const noteName = note.slice(0, -1).replace(/[#b]/, ''); // Remove octave and accidental
    const accidental = note.includes('#') ? '#' : note.includes('b') ? 'b' : '';

    // Reverse lookup from note to staff position
    const treblePositions = {
        'E': { position: 'bottom', lineSpace: 'line' },
        'F': { position: 'bottom', lineSpace: 'space' },
        'G': { position: 'second', lineSpace: 'line' },
        'A': { position: 'second', lineSpace: 'space' },
        'B': { position: 'middle', lineSpace: 'line' },
        'C': { position: 'middle', lineSpace: 'space' },
        'D': { position: 'fourth', lineSpace: 'line' },
        // Note: this is simplified - would need to handle ledger lines above/below
    };

    const bassPositions = {
        'G': { position: 'bottom', lineSpace: 'line' },
        'A': { position: 'bottom', lineSpace: 'space' },
        'B': { position: 'second', lineSpace: 'line' },
        'C': { position: 'second', lineSpace: 'space' },
        'D': { position: 'middle', lineSpace: 'line' },
        'E': { position: 'middle', lineSpace: 'space' },
        'F': { position: 'fourth', lineSpace: 'line' },
        // Note: this is simplified - would need to handle ledger lines above/below
    };

    const positions = clef === 'treble' ? treblePositions : bassPositions;
    const staffPos = positions[noteName];

    if (staffPos) {
        return {
            position: staffPos.position,
            lineSpace: staffPos.lineSpace,
            aboveBelow: '', // Simplified - not handling ledger lines for now
            accidental: accidental
        };
    }

    return null;
}

function drawNote(clef, note) {
    const musicScore = document.getElementById("music-score");

    // Create or get the VexFlow container
    let vexflowContainer = musicScore.querySelector('#vexflow-container');
    if (!vexflowContainer) {
        vexflowContainer = document.createElement('div');
        vexflowContainer.id = 'vexflow-container';
        vexflowContainer.style.width = '100%';
        vexflowContainer.style.flex = '1';
        vexflowContainer.style.display = 'flex';
        vexflowContainer.style.justifyContent = 'center';
        vexflowContainer.style.alignItems = 'center';
        vexflowContainer.style.minHeight = '200px';
        vexflowContainer.style.zIndex = '1'; // Lower z-index than modals
        // Insert as first child so it appears above the guessing interfaces
        musicScore.insertBefore(vexflowContainer, musicScore.firstChild);
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
