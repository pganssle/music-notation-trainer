# Music Notation Trainer

This is a progressive web app (PWA) designed to help you learn to read music with some spaced repetition features built in. Rather than taking the approach that Anki takes where cards are scheduled only when due — which I find tends to create memories where you can retrieve them after long intervals, but usually with a pause to pull them out from "long term storage" — this app shows you as many cards as you want, but with a frequency determined by how often you get them wrong and how difficult you found the retrieval. My hope is that this creates the kind of memory you would want for sight reading music: instantaneous recall, while focusing on the notes the you need to study the most.

The other advantage to using this over an [Anki deck like this one](https://ankiweb.net/shared/info/347130449) is rather niche: this app also provides an option to drill on the nomenclature used by [Reading Keyboard Music](https://www.readingkeyboardmusic.com/), where notes are named by their position on the staff.

## Installation

This works OK as a website but works better when installed as a progressive web app. To install as a PWA, visit the website in your browser (I have found this works much better with chrome) and you should see a little icon in the URL bar to install the page. [Here is the chrome documentation for how to install PWAs](https://support.google.com/chrome/answer/9658361), though as of October 2025 it does not describe anything I've ever done to install a PWA.

It is currently optimized for tablets but it should also work on computers (not sure if the keyboard will render at all properly on mobile).

## Usage

This section may get out of date as this project is rapidly changing.

### Getting Started

The best way to use this app is to install it as a PWA and then open that PWA. I would recommend creating a new user (Settings > Add User). You will also want to go into the settings and adjust how you want to use the app.

### Modes

There are three guessing modes, which can be used together and each keep track of the difficulty of each note separately:

- **Keyboard mode**: Select the note on a piano keyboard
- **Note name mode**: Choose the name of the note (e.g. A, B♯, G). There is no way to choose the octave in this mode.
- **Staff Position mode**: Choose the name of the note in the nomenclature of Reading Keyboard Music (e.g. on the treble clef F4 = bottom space).

### Data Storage

The data including users, session history, etc, is all stored locally in the `localStorage` of your browser. It is not sent anywhere and is not synced in any way. There is not currently any way within the app to download it or back it up.
