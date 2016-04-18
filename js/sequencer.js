// Web Audio Sequencer

var audioContext = null;
var isPlaying = false; // Are we currently playing?
var startTime; // The start time of the entire sequence.
var current16thNote; // What note is currently last scheduled?
var tempo = 120.0; // tempo (in beats per minute)
var lookahead = 25.0; // How frequently to call scheduling function
// (in milliseconds)

var nextNoteTime = 0.0; // when the next note is due.
var noteLength = 0.05; // length of "beep" (in seconds)
var canvas, // the canvas element
    canvasContext; // canvasContext is the canvas' context 2D
var last16thNoteDrawn = -1; // the last "box" we drew on the screen
var notesInQueue = []; // the notes that have been put into the web audio,
// and may or may not have played yet. {note, time}
var timerWorker = null; // The Web Worker used to fire timer messages
var waveform, waveformChoice = 0;
var osc, gain, note, pitch, noteChoice = 0,
    noteArray = [], buttonArray = [], noteChoiceArray = [], pitchSelectArray = [];

// var selecteNote = document.getElementById("first-select");
// selecteNote.addEventListener("onchange", function() {
//     noteChoice = this.selectedIndex;
// });

// var selectWaveform = document.getElementById("select-waveform");
// selectWaveform.addEventListener("onchange", function() {
//     waveformChoice = this.selectedIndex;
// });

function createOsc(waveshape) {
    var sine = audioContext.createOscillator();
    sine.type = "sine";
    var saw = audioContext.createOscillator();
    saw.type = "sawtooth";
    var square = audioContext.createOscillator();
    square.type = "square";
    
    // sine.frequency.value = Math.pow(2, (pitch + 1 * 69 - 69) / 12) * 440;
    // saw.frequency.value = Math.pow(2, (pitch + 1 * 69 - 69) / 12) * 440;
    // square.frequency.value = Math.pow(2, (pitch + 1 * 69 - 69) / 12) * 440;

    if (waveshape === "sine") {
        return sine;
    } else if (waveshape === "sawtooth") {
        return saw;
    } else
        return square;
}

function notePicker(value) {
    return Math.pow(2, (value + 1 * 69 - 69) / 12) * 440;
}

function scheduler() {
    if (waveformChoice === 0) {
        waveform = "sine";
    } else if (waveformChoice === 1) {
        waveform = "sawtooth";
    } else {
        waveform = "square";
    }

    // while (nextNoteTime < audioContext.currentTime + 0.1) {
    //     for (var i = 0; i < buttonArray.length; i++) {
    //         if (buttonArray[i].state === "ON") {

    //             scheduleNote(current16thNote, nextNoteTime, waveform, pitch);
                
    //             // console.log("Current 16th note: " + current16thNote + "\n" +
    //             //             "Next note time: " + nextNoteTime + "\n" +
    //             //             pitch);
                
    //             nextNote();
    //         }
    //     }
    // }
}

function scheduleNote(beatNumber, time, wave, pitch) {

    console.log(waveformChoice);

    // create an oscillator
    osc = createOsc(wave);
    console.log(osc.type);

    osc.frequency.value = pitch;
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(time);
    osc.stop(time + noteLength);
}

function nextNote() {
    var secondsPerBeat = 60.0 / tempo;
    nextNoteTime += 0.25 * secondsPerBeat; 

    current16thNote++; 
    if (current16thNote == 16) {
        current16thNote = 0;
    }
}

for (var q = 0; q < 32; q++) {
    buttonArray.push(
        {
            ID: q,
            state: "OFF",
            note: null
        });
}

var container = document.getElementById("container");
container.addEventListener("mousedown", buttonToggle, false);

for (var r = 0; r < 12; r++) {
    noteArray.push(r);
}

function buttonToggle(e) {
    if (e.target.id !== e.currentTarget.id) {
        var target = Number(e.target.id);
        for (var i = 0; i < buttonArray.length; i++) {
            if (target === buttonArray[i].ID
                && buttonArray[i].state === "OFF") {

                buttonArray[i].state = "ON";
                document.getElementById(e.target.id).innerHTML = "X";

                console.log(buttonArray[i].ID + "\n" +
                            buttonArray[i].state);

            } else if (target === buttonArray[i].ID
                       && buttonArray[i].state === "ON") {

                buttonArray[i].state = "OFF";
                document.getElementById(e.target.id).innerHTML = "";

                console.log(buttonArray[i].ID + "\n" +
                            buttonArray[i].state);
            }
        }
    }
}

for (var i = 0; i < 16; i++) {
    pitchSelectArray.push(
        {ID: "select-" + i,
         notes: [],
         value: 440
        });
    for (var j = 0; j < 12; j++) {
        pitchSelectArray[i].notes.push(j);
    }
}

console.log(pitchSelectArray);

// var pitchSelector = document.getElementById("pitch-select-container");
// pitchSelector.addEventListener("change", selectPitch);

function selectPitch(e) {
    if (e.target.id !== e.currentTarget.id) {
        console.log("test");
        console.log(e.target.id);
        for (var i = 0; i < pitchSelectArray.length; i++) {
            for (var j = 0; j < pitchSelectArray[i].notes.length; j++) {
                if (pitchSelectArray[i].ID === e.target.id
                    && noteChoice === pitchSelectArray[i].notes[j]) {
                    pitch = pitchSelectArray[i].value = notePicker(noteChoice);
                    // console.log(pitchSelectArray[i]);
                    // console.log(pitchSelectArray[i].notes[j]);
                    console.log("value selected: " + noteChoice + "\n" +
                                "note selected " +  pitch + "\n" +
                                "pitch log: " + pitchSelectArray[i].value);
                }
            }
        }
    }
}

var clickPlay = document.getElementById("play-button");
clickPlay.addEventListener("click", play, false);

function play() {
    isPlaying = !isPlaying;

    if (isPlaying) { 
        current16thNote = 0;
        nextNoteTime = audioContext.currentTime;

        clickPlay.innerHTML = "stop";

        timerWorker.postMessage("start");
        return "stop";
    } else {
        clickPlay.innerHTML = "start";

        timerWorker.postMessage("stop");
        return "play";
    }
}

function init() {
    var container = document.createElement('div');

    container.className = "container";

    audioContext = new AudioContext();
    gain = audioContext.createGain();
    gain.gain.value = 0.5;
    // if we wanted to load audio files, etc., this is where we should do it.

    // window.onorientationchange = resetCanvas;
    // window.onresize = resetCanvas;

    // requestAnimationFrame(draw); // start the drawing loop.

    timerWorker = new Worker("js/sequencer-worker.js");

    timerWorker.onmessage = function(e) {
        if (e.data == "tick") {
            // console.log("tick!");
            scheduler();
        } else
            console.log("message: " + e.data);
    };

    timerWorker.postMessage({
        "interval": lookahead
    });
}

window.addEventListener("load", init);













