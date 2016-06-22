// Web Audio Sequencer
window.AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = new AudioContext();
var isPlaying = false; // Are we currently playing?

var current16thNote; // What note is currently last scheduled?
var tempo = 120.0; // tempo (in beats per minute)

var nextNoteTime = 0.0; // when the next note is due.
var startTime = 0.25;
var endTime = startTime + 1.5;
var notesInQueue = []; // the notes that have been put into the web audio,
// and may or may not have played yet. {note, time}
var timerWorker = null; // The Web Worker used to fire timer messages
var waveform, waveformChoice = 0;
var pitch;
var buttonArray = [], noteChoiceArray = [], pitchSelectArray = [];

function init() {
    var currentTime = audioContext.currentTime;
    
    var container = document.createElement('div');

    container.className = "container";
    
    //populate pitch and button arrays
    for (var q = 0; q < 32; q++) {

        buttonArray.push(
            {
                ID: q,
                state: "OFF"
            }
        );
    }
    
    for (var i = 0; i < 32; i++) {

        pitchSelectArray.push(
            {
                ID: "select-" + i,
                notes: [],
                // initial note value
                value: 110
            }
        );
        // populate notes array
        for (var j = 0; j < 12; j++) {
            pitchSelectArray[i].notes.push(j);
        }
    }
    
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

function notePicker(value) {
    return Math.pow(2, (value + 1 * 69 - 69) / 12) * 110;
}

var pitchSelector = document.getElementById("pitch-select-container");
pitchSelector.addEventListener("change", selectPitch);

var lookahead = startTime + 0.1; // How frequently to call scheduling function
// (in milliseconds)

function createOsc1(waveshape, note, detune) {
    var osc1 = audioContext.createOscillator();
    osc1.type = waveshape;    
    osc1.frequency.value = note;
    osc1.detune.value = detune;
    return osc1;
}    

function createOsc2(waveshape, note, detune) {
    var osc2 = audioContext.createOscillator();
    osc2.type = waveshape;    
    osc2.frequency.value = note;
    osc2.detune.value = detune;
    return osc2;
}    

function scheduleNote(beatNumber, time, wave, note) {
    var osc1 = createOsc1(wave, note, 3);
    var osc2 = createOsc2(wave, note, 10);
    var attack = 0.1;
    var decay = 0.8;
    var sustain = 0.8;
    
    console.log("1st oscillator: " + osc1);
    console.log("2nd oscillator: " + osc2);
    osc1.start(time);
    osc2.start(time);
    
    var gain = audioContext.createGain();
    osc1.connect(gain);
    osc2.connect(gain);
    // envelope
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.5, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, time + sustain + decay);
    // add small padding at the end (0.01) to prevent clipping when oscillator stops
    osc1.stop(time + sustain + decay + 0.1);
    osc2.stop(time + sustain + decay + 0.1);
    gain.connect(audioContext.destination);
    
    console.log(time + endTime);
}

function scheduler() {
    if (waveformChoice === 0) {
        waveform = "sine";
    } else if (waveformChoice === 1) {
        waveform = "sawtooth";
    } else {
        waveform = "square";
    }
    
    var currentTime = audioContext.currentTime;
    
    while (nextNoteTime < currentTime + 0.1) {
        for (var i = 0; i < 32; i++) {
            if (buttonArray[i].state === "ON") {
                console.log("button: " + buttonArray[i].ID);
                if (pitchSelectArray.indexOf(pitchSelectArray[i]) ===
                    buttonArray.indexOf(buttonArray[i])) {
                    pitch = pitchSelectArray[i].value;
                }
                scheduleNote(current16thNote, nextNoteTime, waveform, pitch);
            }             
            nextNote();
        }
    }
}

function nextNote() {
    var secondsPerBeat = 60.0 / tempo;
    nextNoteTime += startTime * secondsPerBeat;
    // console.log("nextNoteTime: " + nextNoteTime);

    current16thNote++; 
    if (current16thNote == 16) {
        current16thNote = 0;
    }
}

var container = document.getElementById("container");
container.addEventListener("mousedown", buttonToggle, false);

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
    console.log(pitchSelectArray[e.target.id].value);
}

console.log(pitchSelectArray);

function selectPitch(e) {
    if (e.target.id !== e.currentTarget.id) {
        for (var i = 0; i < pitchSelectArray.length; i++) {
            for (var j = 0; j < pitchSelectArray[i].notes.length; j++) {    

                if (pitchSelectArray[i].ID === e.target.id
                    && noteChoice === pitchSelectArray[i].notes[j]) {
                    pitchSelectArray[i].value = notePicker(noteChoice);
                }
            }
        }
    }
}

var clickPlay = document.getElementById("play-button");
clickPlay.addEventListener("click", play, false);

function play() {
    isPlaying = !isPlaying;
    
    var currentTime = audioContext.currentTime;
    
    if (isPlaying) { 
        current16thNote = 0;
        console.log(audioContext);
        nextNoteTime = currentTime;

        clickPlay.innerHTML = "stop";

        timerWorker.postMessage("start");
        return "stop";
    } else {
        clickPlay.innerHTML = "start";

        timerWorker.postMessage("stop");
        return "play";
    }
}

window.addEventListener("load", init);









