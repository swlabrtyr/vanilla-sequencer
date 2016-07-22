/*
Web Audio synthesizer and sequencer. Buttons and pitches are scheduled
using look-up tables and an event loop that listens for ntoes to
be scheduled.
*/

window.AudioContext = window.AudioContext || window.webkitAudioContext;

const audioContext = new AudioContext;
const destination = audioContext.destination;


// create a gain to be placed between audio nodes and destination

const output = audioContext.createGain();
output.gain.value = 0.9;

let futureTickTime = audioContext.currentTime;
let current16thNote = 1;
let tempo = 120;
let timerID, stopTime, pitch;


// choose oscillator waveform in HTML

let waveform, waveformChoice = 0;

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


  // calculate stop time and add a padding 0.1 to prevent any
  // oscillators from overlapping

  stopTime = time + atkTime + decTime + susTime + relTime + 0.1;
  console.log(stopTime);

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

  // console.log(gain);
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

  if (waveformChoice === 0) {
    waveform = "square";
  } else if (waveformChoice === 1) {
    waveform = "sawtooth";
  } else {
    waveform = "sine";
  }
  console.log(waveformChoice);

  /*

  create audio nodes

  */

  let osc = createOsc(waveform);
  osc.frequency.value = pitch;

  let lpFilter1 = createFilter("lowpass", 2050);

  let ampEnv = ampADSR(osc, 0.1, 0.1, 0.5, 1.3,
    0.7, 0.6, 0.6, 0.001);

  let filterEnv = filterADSR(lpFilter1, 0.5, 0.1, 0.5, 0.7,
    10000, 1000, 250, 100);

  let delay = delayFX(0.3, 0.5);

  console.log(stopTime);
  // make connections

  ampEnv.connect(filterEnv);

  filterEnv.connect(delay);

  // state change, connects delay to output then output to destination
  delay.connect(output);

  //filterEnv.connect(output);
  output.connect(destination);


  // generate and kill oscillators
  //console.log(stopTime);
  startOsc(osc, start);
  stopOsc(osc, start, stopTime);

};

function startOsc(osc, start) {
  osc.start(start);
  console.log("osc started");
}

function stopOsc(osc, start, stopTime) {
  osc.stop(start + stopTime);
  console.log("osc stopped");
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

          console.log(this);


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
  }
})();

initDivs.set(divs, "lightskyblue")


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
  }
})();


// schedule future ticks

function futureTick() {

  let secondsPerBeat = 60.0 / tempo;

  futureTickTime += 0.25 * secondsPerBeat; //future note
  current16thNote++;
  console.log(current16thNote);
  if (current16thNote > 32) {
    current16thNote = 1;
  }
};

function scheduleNote(beatDivisionNumber, start, stop) {

  for (let i = 0; i < buttonArray.length; i++) {

    if (beatDivisionNumber === buttonArray[i].ID &&
      buttonArray[i].state === "ON") {

      if (pitchArray.indexOf(pitchArray[i]) ===
        buttonArray.indexOf(buttonArray[i])) {

        pitch = pitchArray[i].value;
        console.log(pitch);
      }
      createAudioNodes(pitch, start, start + 0.1);
    }
  }
}

function scheduler() {

  // sequencer loop

  while (futureTickTime < audioContext.currentTime + 0.1) {

    scheduleNote(current16thNote, futureTickTime, 0);
    futureTick();

    nextDiv.divCount(divsArray);
  }


  timerID = window.setTimeout(scheduler, 25.0);
};


function buttonToggle(e) {

  if (e.target.id !== e.currentTarget.id) {

    let target = Number(e.target.id);

    for (let i = 0; i < buttonArray.length; i++) {

      if (target === buttonArray[i].ID && buttonArray[i].state === "OFF") {

        buttonArray[i].state = "ON";

        console.log(buttonArray[i].ID + "\n" +
          buttonArray[i].state);

      } else if (target === buttonArray[i].ID && buttonArray[i].state === "ON") {

        buttonArray[i].state = "OFF";

        console.log(buttonArray[i].ID + "\n" +
          buttonArray[i].state);
      }
    }
  }
}

function selectPitch(e) {

  if (e.target.id !== e.currentTarget.id) {

    for (let i = 0; i < pitchArray.length; i++) {

      for (let j = 0; j < pitchArray[i].notes.length; j++) {

        // noteChoice let is selected in index.html
        if (pitchArray[i].ID === e.target.id &&
          noteChoice === pitchArray[i].notes[j]) {

          pitchArray[i].value = notePicker(noteChoice);
          console.log("note choice: " + pitchArray[i].value);
        }
      }
    }
  }
}
//
// function selectPitch(e) {
//     if (e.target.id !== e.currentTarget.id) {
//         for (var i = 0; i < pitchArray.length; i++) {
//             for (var j = 0; j < pitchArray[i].notes.length; j++) {
//
//                 // noteChoice var is selected in index.html
//                 if (pitchArray[i].ID === e.target.id &&
//                     noteChoice === pitchArray[i].notes[j])
//                 {
//                     pitchArray[i].value = notePicker(noteChoice);
//                     console.log("note choice: " +  pitchArray[i].value);
//                 }
//             }
//         }
//     }
// }


function notePicker(value) {
  return Math.pow(2, (value + 1 * 69 - 69) / 12) * 110;
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

startBtn.addEventListener('click', () => {
  scheduler();
}, false);

stopBtn.addEventListener('click', () => {
  clearTimeout(timerID);
  console.log('stopping');
}, false);
//
// document.getElementById('start').addEventListener('click', function() {
//
//   let time = audioContext.currentTime;
//
//   console.log(time);
//   playNote("sawtooth", 440, time, time + 3, output);
// });
