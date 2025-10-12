# Items to do

## MVP

- [ ] Fix issues with the non-keyboard modes, specifically:
    - in "staff notation mode", the "nth space above/below" seems to be off-by-one, and there are a few other broken answers
    - At least "F" on bass clef seems to be giving the wrong answer
- [X] Reset button is broken. Error is "Uncaught TypeError: can't access property "keyboard", user.currentSession.modeGuesses is undefined"

## Short term

- [ ] Make it so clicking "sharp" or "flat" in note name / staff position automatically sets the other one if neither of them are locked
- [ ] Change "correct" and "incorrect" to the same indicators we are using in CIM
- [ ] Fix session history display to show all three types of stats
- [ ] Clicking the correct / incorrect indicator should allow changing difficulty assessment
- [ ] Refactor interface
    - [ ] Settings indicator should be a gear
    - [ ] Remove settings panel and move it into a gear icon next to the "undo" and "reset" buttons
    - [ ] Session history icon should be a chart, move it to next to the other floating icons
    - [ ] Move stats display to be to the right of the staff
    - [ ] Move note name and staff position responses to above the keyboard
- [ ] Reduce vexflow whitespace:
    - [ ] Automatically set the stem direction to try to minimize distance above/below staff
    - [ ] Reposition staff within the canvas when the staff gets wider (rather than generating a canvas big enough to contain the entire staff always)
- [ ] Try to center the note(s) on staff
- [ ] Add solfedge support / mode

## Longer term
### Interface improvements
- [ ] Add dark mode
- [ ] Improve keyboard size auto-selection
- [ ] Don't give vexflow a fixed canvas calculated at first, it should be reflowable
- [ ] Better interface for choosing note ranges

### Functional improvements
- [ ] Allow specifying a subset of notes to practice instead of just a range (e.g. C4, E4, G4)
- [ ] Multiple notes: This might not be feasible without totally redoing the interface, though one possible option would be to add a "multi-mode" that shows a sequence of notes / chords and asks you to identify one of them in context
    - [ ] Chords
    - [ ] Note sequences
