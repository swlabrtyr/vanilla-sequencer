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
}

timerWorker = new Worker("js/sequencer-worker.js");

timerWorker.onmessage = function(e) {
    if (e.data === "tick") {
        // console.log("tick!");
        scheduler();
    } else
        console.log("message: " + e.data);
};

timerWorker.postMessage({
    "interval": lookahead
});

function notePicker(value) {
    return Math.pow(2, (value + 1 * 69 - 69) / 12) * 110;
}

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

var delay = delayFX(0.3, 0.7);
var verb = verbFX();

function delayFX(time, fbAmount) {
    var delay = audioContext.createDelay();
    delay.delayTime.value = time;

    var feedback = audioContext.createGain();
    feedback.gain.value = fbAmount;

    var filter = audioContext.createBiquadFilter();
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;
    
    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(filter);
    delay.connect(audioContext.destination);
    // slider
    document.getElementById('delay-t').addEventListener('input', function() {
        console.log('input received');
        delay.delayTime.value = this.value;
        console.log("delay time: " + this.value);
    });

    document.getElementById('fb-amnt').addEventListener('input', function() {
        feedback.gain.value = this.value;
        console.log("feedback ammount: " + this.value);
    });

    return filter;
}

function verbFX() {
    var verb = audioContext.createConvolver();
    
    var request = new XMLHttpRequest();
    request.open("GET",
                 "https://dl.dropboxusercontent.com/u/428242181/abernyte_grain_silo_ir_edit.wav",
                 true);
    request.responseType = "arraybuffer";

    request.onload = function() {
        console.log("reponse data: " + request.response);
        audioContext.decodeAudioData(request.response, function(buffer) {
            verb.buffer = buffer;
        }, function (e) {
            console.log("error decoding audio data: " + e.err);
        });
    };
    request.send();

    console.log(verb);
    return verb;
}

function scheduleNote(time, wave, note) {
    var osc1 = createOsc1(wave, note, 55);
    var osc2 = createOsc2(wave, note, 7);

    // amplitude envelope values
    var ampAtk = 0.1;
    var ampSus = 0.8;
    var ampDec = 1.0;

    // filter envelope values
    var filterAtk = 0.5;
    var filterSus = 0.3;
    var filterDec = 0.7;
    
    console.log("1st oscillator: " + osc1);
    console.log("2nd oscillator: " + osc2);
    osc1.start(time);
    osc2.start(time);
    
    var gain = audioContext.createGain();
    
    // amplitude envelope
    gain.gain.setValueAtTime(0.001, time);
    // gain.gain.setTargetAtTime(0.1, time + 0.01, 0.1);
    gain.gain.exponentialRampToValueAtTime(0.5, time + ampAtk);
    gain.gain.exponentialRampToValueAtTime(0.001, time + ampSus + ampDec);
    // add small padding at the end (0.01) to prevent clipping when oscillator stops
    osc1.stop(time + ampSus + ampDec + 0.1);
    osc2.stop(time + ampSus + ampDec + 0.1);

    var filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    
    // filter envelope
    filter.frequency.setValueAtTime(100, time);
    filter.frequency.exponentialRampToValueAtTime(3040, time + filterAtk);
    filter.frequency.exponentialRampToValueAtTime(0.01, time + filterSus + filterDec);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(delay);
    // delay.connect(audioContext.destination);
    // delay.connect(verb);
    // verb.connect(verbBus);
    var mainOut = audioContext.createGain();
    mainOut.gain.value = 0.8;
    delay.connect(mainOut);
    
    var verbBus = audioContext.createGain();
    verbBus.gain.value = 0.5;

    verbBus.connect(mainOut);
    mainOut.connect(audioContext.destination);
    console.log(time + endTime);
}
// using for loop
function scheduler() {
    if (waveformChoice === 0) {
        waveform = "square";
    } else if (waveformChoice === 1) {
        waveform = "sawtooth";
    } else {
        waveform = "sine";
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
                scheduleNote(nextNoteTime, waveform, pitch);
            }             
            nextNote();
        }
    }
}
// using .map
// function scheduler() {
//     if (waveformChoice === 0) {
//         waveform = "sine";
//     } else if (waveformChoice === 1) {
//         waveform = "sawtooth";
//     } else {
//         waveform = "square";
//     }

//     var currentTime = audioContext.currentTime;
    
//     if (nextNoteTime < currentTime + 0.1) {
//         buttonArray.map((item) => {
//             if (item.state === "ON") {
//                 console.log("button: " + item.ID);
//                 if ()
//             }
//         });
//     }
// }

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

// function buttonToggle(e) {
//     if (e.target.id !== e.currentTarget.id) {
//         var target = Number(e.target.id);
//         buttonArray.map((item) => {
//             if (target === item.id && item.state = "OFF") {
                
//             }
//         });
//     }
// }

var pitchSelector = document.getElementById("pitch-select-container");
pitchSelector.addEventListener("change", selectPitch);

// populate pitchSelectArray
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

function selectPitch(e) {
    if (e.target.id !== e.currentTarget.id) {
        for (var i = 0; i < pitchSelectArray.length; i++) {
            for (var j = 0; j < pitchSelectArray[i].notes.length; j++) {    

                // noteChoice var is selected in index.html
                if (pitchSelectArray[i].ID === e.target.id
                    && noteChoice === pitchSelectArray[i].notes[j]) 
                { 
                    pitchSelectArray[i].value = notePicker(noteChoice);
                    console.log("note choice: " +  pitchSelectArray[i].value);
                }
            }
        }
    }
}

// console.log(noteChoice); // globally noteChoice is undefined..? why? 
// using .map
// function selectPitch(e) {
//     if (e.target.id !== e.currentTarget.id) {
//         pitchSelectArray.map((item) => {
//             item.notes.map((item) => {
//                 if (item.ID === e.target.id
//                    && noteChoice === item.notes) {
//                     console.log(noteChoice);
//                     item.value = notePicker(noteChoice);
//                 }
//             });
//         });
//     }
//     console.log("noteChoice: " + noteChoice);
// }


var clickPlay = document.getElementById("play-button");
clickPlay.addEventListener("click", play, false);

function play() {
    isPlaying = !isPlaying;
    
    var currentTime = audioContext.currentTime;
    
    if (isPlaying) { 
        current16thNote = 0;
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















