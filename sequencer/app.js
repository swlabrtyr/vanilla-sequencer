/*
 *
 *
 Web Audio synthesizer and sequencer. Buttons and pitches are scheduled
 using look-up tables and an event loop that listens for ntoes to
 be scheduled.
*
*
*/


window.AudioContext = window.AudioContext || window.webkitAudioContext;

const audioContext = new AudioContext;
const destination = audioContext.destination;


// create a gain to be placed between audio nodes and destination

const output = audioContext.createGain();
output.gain.value = 0.3;

let futureTickTime = audioContext.currentTime;
let current16thNote = 1;
let tempo = 120;
let timerID, pitch, secondsPerBeat;

let delayTime = 0;
let delayFeedback = 0;

let ampAtk = 0.1;
let ampDec = 0.1;
let ampSus = 0.5;
let ampRel = 1.3;
let killOscTime = 0.0;

let filterAtk = 0.5;
let filterDec = 0.1;
let filterSus = 0.5;
let filterRel = 0.7;

let end = 0.1;
let noteChoice;

// console.log("Delay Time: ", delayTime);
// console.log("Delay Feedback Amount: ", delayFeedback);

// choose oscillator waveform in HTML
let osc1waveform, osc2waveform, osc2waveformChoice, osc1waveformChoice = 0;

/*

 controllers

 */

const startBtn = document.getElementById("play-button");
const stopBtn = document.getElementById("stop-button");
const bpm = document.getElementById('bpm');
let divs = document.querySelectorAll('.box');

bpm.oninput = function() {

    this.type = "range";
    this.step = "1";
    this.max = "150";
    this.min = "5";

    tempo = this.value;

    bpm.innerHTML = tempo;

    return tempo;
};


// slice divs array to get a handle on each individual div

let divsArray = Array.prototype.slice.call(divs);

function createOsc(type) {

    let osc = audioContext.createOscillator();
    osc.type = type;

    return osc;
};

function createFilter(type, freq) {

    let filter = audioContext.createBiquadFilter();

    filter.frequency.value = freq;
    filter.type = type;

    return filter;
};

function ampADSR(src, atkTime, decTime, susTime, relTime,
                 atkVal, decVal, susVal, relVal) {

    let time = audioContext.currentTime;
    let gain = audioContext.createGain();

    src.connect(gain);

    // set starting value
    gain.gain.setValueAtTime(0.001, time);
    // attack
    gain.gain.exponentialRampToValueAtTime(atkVal, time + atkTime);
    // decay
    gain.gain.exponentialRampToValueAtTime(decVal, time + atkTime + decTime);
    // sustain
    gain.gain.exponentialRampToValueAtTime(susVal, time + atkTime + decTime + susTime);
    // release
    gain.gain.exponentialRampToValueAtTime(relVal, time + atkTime + decTime +
                                           susTime + relTime);

    killOscTime = ampAtk + ampDec + ampSus + ampRel + 0.1;
    
    // console.log("kill osc time: ", killOscTime);
    return gain;
}

function filterADSR(filter, atkTime, decTime, susTime, relTime,
                    atkVal, decVal, susVal, relVal) {

    let time = audioContext.currentTime;


    // calculate stop time and add a padding 0.1 to prevent any
    // oscillators from overlapping

    let stopTime = time + atkTime + decTime + susTime + relTime + 0.1;

    // set starting value
    filter.frequency.setValueAtTime(200, time);
    // attack
    filter.frequency.exponentialRampToValueAtTime(atkVal, time + atkTime);
    // console.log(atkTime);
    // decay
    filter.frequency.exponentialRampToValueAtTime(decVal, time + atkTime + decTime);
    // sustain
    filter.frequency.exponentialRampToValueAtTime(susVal, time + atkTime + decTime + susTime);
    // release
    filter.frequency.exponentialRampToValueAtTime(relVal, time + atkTime + decTime +
                                                  susTime + relTime + stopTime);

    return filter;
}

function delayFX(delayAmount, fbAmount) {

    let delay = audioContext.createDelay();
    delay.delayTime.value = delayAmount;

    let feedback = audioContext.createGain();
    feedback.gain.value = fbAmount;


    // Add Lowpass Filter

    let filter = audioContext.createBiquadFilter();
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;

    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(filter);

    return delay;
}

function createAudioNodes(pitch, start, stop) {

    if (osc1waveformChoice === 0) {
        osc1waveform = "square";
    } else if (osc1waveformChoice === 1) {
        osc1waveform = "sawtooth";
    } else {
        osc1waveform = "sine";
    }
    if (osc2waveformChoice === 0) {
        osc2waveform = "square";
    } else if (osc2waveformChoice === 1) {
        osc2waveform = "sawtooth";
    } else {
        osc2waveform = "sine";
    }
    
    // console.log(osc1waveformChoice);

    /*

     create audio nodes

     */

    // let osc = createOsc(waveform);
    // osc.frequency.value = pitch;

    let osc1 = createOsc(osc1waveform);

    osc1.frequency.value = pitch;
    osc1.detune.value = 9;

    let osc2 = createOsc(osc2waveform);

    osc2.frequency.value = pitch;
    osc2.detune.value = 16;

    let oscMix = audioContext.createGain();

    oscMix.gain.value = 0.5;

    osc1.connect(oscMix);
    osc2.connect(oscMix);
    
    let lpFilter1 = createFilter("lowpass", 2050);

    // let ampEnv = ampADSR(oscMix, 0.1, 0.1, 0.5, 1.3,
    //                      0.7, 0.6, 0.6, 0.001);

    let ampEnv = ampADSR(oscMix, ampAtk, ampDec, ampSus, ampRel,
                        0.7, 0.6, 0.6, 0.001);

    // let filterEnv = filterADSR(lpFilter1, 0.5, 0.1, 0.5, 0.7,
    //                            10000, 1000, 250, 100);

    let filterEnv = filterADSR(lpFilter1, filterAtk, filterDec, filterSus, filterRel,
                                10000, 1000, 250, 100);
    
    let delay = delayFX(delayTime, delayFeedback);
    // console.log(delay);


    // make connections

    ampEnv.connect(filterEnv);
    
    // wet output
    filterEnv.connect(delay);
    // dry output
    filterEnv.connect(output);

    delay.connect(output);

    output.connect(destination);


    // generate and kill oscillators

    startOsc(osc1, start);
    startOsc(osc2, start);
    stopOsc(osc2, stop);
    stopOsc(osc1, stop);
}

function startOsc(osc, start) {
    osc.start(start);
    // console.log("osc started");
}


function stopOsc(osc, stopTime) {
    osc.stop(stopTime);
    // console.log("Osc Stopped " + stopTime);
}

/*

 Look-up tables

 */

let buttonArray = [];
let pitchArray = [];

for (let i = 0; i < 32; i++) {

    buttonArray.push({
        ID: i,
        state: "OFF"
    });

    pitchArray.push({
        ID: "select-" + i,
        notes: [],
        // initialize each note value to 220hz
        value: 220
    });

    for (let j = 0; j < 12; j++) {
        pitchArray[i].notes.push(j);
        //console.log(pitchArray[i].notes);
    }
};


// set initial sequencer state

let initDivs = (function() {

    return {

        set: function(array, color) {

            for (let i = 0; i < array.length; i++) {

                array[i].style.backgroundColor = "#2E9AFE";


                // change the color of the selected div

                array[i].addEventListener('click', function() {

                    let currColor = this.style.backgroundColor;
                    let darkblue = this.style.backgroundColor = "#2E9AFE";
                    let otherColors = this.style.backgroundColor = color;



                    // div color toggle

                    switch (currColor) {

                    case darkblue:
                        this.style.backgroundColor = color;

                        break;

                    case otherColors:
                        this.style.backgroundColor = "#2E9AFE";
                    }
                }, false);
            }
        }
    };
})();

initDivs.set(divs, "lightskyblue");


// change each div color on the 16th note beat

let nextDiv = (function() {

    let countOtherDiv = -1;
    let countCurrentDiv = 0;
    let currentDiv;
    let notCurrentDiv;

    return {

        divCount: function(array) {

            notCurrentDiv = array[++countOtherDiv % array.length];
            currentDiv = array[++countCurrentDiv % array.length];

            currentDiv.style.borderRadius = "1000px";
            notCurrentDiv.style.borderRadius = "25px";

            if (countCurrentDiv > 31) {
                countOtherDiv = -1;
                countCurrentDiv = 0;
            };
        }
    };
})();

function scheduleNote(beatDivisionNumber, start, stop) {

    for (let i = 0; i < buttonArray.length; i++) {
        
        if (beatDivisionNumber === buttonArray[i].ID &&
            buttonArray[i].state === "ON") {

            if (pitchArray.indexOf(pitchArray[i]) === buttonArray.indexOf(buttonArray[i])) {

                pitch = pitchArray[i].value;

            }
            
            createAudioNodes(pitch, start, stop);
        }
    }
}


// schedule future ticks

function futureTick() {

    secondsPerBeat = 60.0 / tempo;
    
    futureTickTime += 0.25 * secondsPerBeat; // future note
    
};

function scheduler() {

    // sequencer loop

    while (futureTickTime < audioContext.currentTime + 0.1) {
        current16thNote++;
        
        if (current16thNote === 32) {
            current16thNote = 0;
        }

        scheduleNote(current16thNote, futureTickTime, futureTickTime + killOscTime);
        futureTick();
        
        nextDiv.divCount(divsArray);
    }

    
    timerID = window.setTimeout(scheduler, 25.0);
};


function buttonToggle(e) {

    if (e.target.id !== e.currentTarget.id) {

        let target = Number(e.target.id);

        for (let i = 0; i < buttonArray.length; i++) {

            if (target === buttonArray[i].ID
                && buttonArray[i].state === "OFF") {

                buttonArray[i].state = "ON";

                // console.log(buttonArray[i].ID + "\n" +
                //             buttonArray[i].state);

            } else if (target === buttonArray[i].ID
                       && buttonArray[i].state === "ON") {

                buttonArray[i].state = "OFF";

                // console.log(buttonArray[i].ID + "\n" +
                //             buttonArray[i].state);
            }
        }
    }
}

function selectPitch(e) {
    var noteSelected = notePicker(noteChoice);
    // console.log(noteSelected);
    if (e.target.id !== e.currentTarget.id) {

        for (let i = 0; i < pitchArray.length; i++) {

            for (let j = 0; j < pitchArray[i].notes.length; j++) {

                // noteChoice let is selected in index.html
                if (pitchArray[i].ID === e.target.id &&
                    noteChoice === pitchArray[i].notes[j]) {

                    pitchArray[i].value = noteSelected;
                    // console.log("note choice: " + pitchArray[i].value);
                }
            }
        }
    }
}

function notePicker(value) {
    var notePicked = Math.pow(2, (noteChoice + 1 * 69 - 69) / 12) * 110;

    return notePicked;
};


// event handlers

let btnContainers = document.querySelectorAll(".button-container");

for (let i = 0; i < btnContainers.length; i++) {
    btnContainers[i].addEventListener("click", buttonToggle);
}

let pitchSelectors = document.querySelectorAll(".pitch-select-container");

for (let i = 0; i < pitchSelectors.length; i++) {
    pitchSelectors[i].addEventListener("click", selectPitch);
}

// show tempo number (secondsPerBeat)
// document.getElementById('showTempo').innerHTML = bpm;

startBtn.addEventListener('click', () => {
    scheduler();

}, false);

stopBtn.addEventListener('click', () => {
    clearTimeout(timerID);
    
    console.log('stopping');

}, false);









