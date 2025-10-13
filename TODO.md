# Items to do

## Short term

- [ ] When keyboard mode goes first it is auto-advancing
- [ ] Disable zooming
- [ ] Make it possible to disable bass and treble clefs
- [ ] Fix session history display to show all three types of stats
- [ ] Fix duration in session history to be the minimum duration from first rated to last rated
- [ ] Add "Bass" and "Treble" clef as optional selector in staff position mode
- [ ] Clicking the correct / incorrect indicator should allow changing difficulty assessment
- [ ] Refactor user switching to be more like CIM
- [ ] Move "x" button in modals to float in the top right
- [X] 1st space above is still wrong for some reason
- [X] Change "correct" and "incorrect" to the same indicators we are using in CIM
- [X] Refactor interface
    - [X] Settings indicator should be a gear
    - [X] Session history icon should be a chart, move it to next to the other floating icons
    - [X] Remove settings panel and move it into a gear icon next to the "undo" and "reset" buttons
    - [X] Move stats display to be to the right of the staff
    - [X] Move note name and staff position responses to above the keyboard
- [ ] Reduce vexflow whitespace:
    - [X] Automatically set the stem direction to try to minimize distance above/below staff
    - [ ] Reposition staff within the canvas when the staff gets taller (rather than generating a canvas big enough to contain the entire staff always)
- [ ] Try to center the note(s) on staff
- [ ] Add solfedge support / mode
- [ ] Ensure that no scrolling is necessary by increasing use of relative layouts
- [ ] Try getting this looking good on a phone
- [ ] Release as an android app

## Longer term
### Interface improvements
- [ ] Add dark mode
- [ ] Improve keyboard size auto-selection
- [X] Don't give vexflow a fixed canvas calculated at first, it should be reflowable
- [ ] Better interface for choosing note ranges

### Functional improvements
- [ ] Allow specifying a subset of notes to practice instead of just a range (e.g. C4, E4, G4)
- [ ] Multiple notes: This might not be feasible without totally redoing the interface, though one possible option would be to add a "multi-mode" that shows a sequence of notes / chords and asks you to identify one of them in context
    - [ ] Chords
    - [ ] Note sequences
