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

var notesInQueue = []; // the notes that have been put into the web audio,
// and may or may not have played yet. {note, time}
var timerWorker = null; // The Web Worker used to fire timer messages
var waveform, waveformChoice = 0;
var osc, gain, note, pitch = 440, noteChoice = 0;
var noteArray = [], buttonArray = [], noteChoiceArray = [], pitchSelectArray = [];

function createOsc(waveshape, note) {
    var sine = audioContext.createOscillator();
    sine.type = "sine";
    var saw = audioContext.createOscillator();
    saw.type = "sawtooth";
    var square = audioContext.createOscillator();
    square.type = "square";

    sine.frequency.value = note;
    saw.frequency.value = note;
    square.frequency.value = note;

    console.log("note: " + note);

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

    while (nextNoteTime < audioContext.currentTime + 0.1) {
        for (var i = 0; i < 16; i++) {
            if (buttonArray[i].state === "ON") {
                console.log("button: " + buttonArray[i].ID);
                console.log(pitch);
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

var pitchSelector = document.getElementById("pitch-select-container");
pitchSelector.addEventListener("change", selectPitch);

function scheduleNote(beatNumber, time, wave, note) {
    console.log(waveformChoice);

    osc = createOsc(wave, note);
    console.log(osc.type);

    console.log(pitch);
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(time);
    osc.stop(time + noteLength);

    return osc;

}

function nextNote() {
    var secondsPerBeat = 60.0 / tempo;
    nextNoteTime += 0.25 * secondsPerBeat; 

    current16thNote++; 
    if (current16thNote == 16) {
        current16thNote = 0;
    }
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
    // console.log(e.target.id);
    console.log(pitchSelectArray[e.target.id].value);
}

console.log(pitchSelectArray);

// function pitchToggle(e) {
//     for (var i = 0; i < pitchSelectArray.length; i++) {
//         if (pitchSelectArray.indexOf(pitchSelectArray[i]) ===
//             buttonArray.indexOf(buttonArray[i])) {
//             selectPitch(e);
//         }
//     }
// }

function selectPitch(e) {
    if (e.target.id !== e.currentTarget.id) {
        console.log("test");
        console.log(e.target.id);
        for (var i = 0; i < pitchSelectArray.length; i++) {
            // console.log("pitch index: " + pitchSelectArray.indexOf(pitchSelectArray[i]));
            // console.log("button index: " + buttonArray.indexOf(buttonArray[i]));
            
            for (var j = 0; j < pitchSelectArray[i].notes.length; j++) {
                
                if (pitchSelectArray[i].ID === e.target.id
                    && noteChoice === pitchSelectArray[i].notes[j]) {
                    pitchSelectArray[i].value = notePicker(noteChoice);
                    // console.log(pitchSelectArray[i]);
                    // console.log(pitchSelectArray[i].notes[j]);
                    // console.log(pitchSelectArray[i].value);
                    // console.log("value selected: " + noteChoice + "\n" +
                    //             "note selected " +  pitch);
                    //pitch = pitchSelectArray[i].value;
                    //console.log(pitchSelectArray[e.target.id].value;
                   // pitch = pitchSelectArray[i].value;
                    console.log(pitch);
                }
            }
        }
    }
}

console.log(pitch);

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
    
    // popluate pitch and button arrays

    for (var q = 0; q < 32; q++) {
        buttonArray.push(
            {
                ID: q,
                state: "OFF"
            });
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













