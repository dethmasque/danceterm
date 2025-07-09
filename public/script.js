let speedMultiplier = 1.0;

const videoElement = document.getElementById('video');
const outputCanvas = document.getElementById('outputCanvas');
const hitCounterElement = document.getElementById('hitCounter');
const ctx = outputCanvas.getContext('2d');

// Initialize MediaPipe Pose
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
});
pose.setOptions({
    modelComplexity: 0,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Initialize MediaPipe Selfie Segmentation
const selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`
});
selfieSegmentation.setOptions({
    modelSelection: 1 // General segmentation model
});

// Set canvas size
const WIDTH = 880; // or dynamically set with window.innerWidth
outputCanvas.width = WIDTH;
const HEIGHT = 240;
outputCanvas.height = HEIGHT;

// Musical instrument emojis and their names
const instruments = [{
        emoji: '🎸',
        name: 'guitar',
        synth: 'AMSynth' // Tone.js AMSynth for guitar-like sound
    },
    {
        emoji: '🎹',
        name: 'piano',
        synth: 'PolySynth' // Tone.js PolySynth for piano
    },
    {
        emoji: '🥁',
        name: 'drums',
        synth: 'MembraneSynth' // Tone.js MembraneSynth for drums
    },
    {
        emoji: '🎺',
        name: 'trumpet',
        synth: 'FMSynth' // Tone.js FMSynth for brass-like sound
    },
    {
        emoji: '🎻',
        name: 'violin',
        synth: 'AMSynth' // Tone.js AMSynth for string-like sound
    },
    {
        emoji: '🎷',
        name: 'saxophone',
        synth: 'MonoSynth' // Tone.js FMSynth for sax-like sound
    },
    {
        emoji: '🪕',
        name: 'banjo',
        synth: 'PluckSynth' // Tone.js PluckSynth for banjo
    },
    {
        emoji: '🪗',
        name: 'accordion',
        synth: 'PolySynth' // Tone.js PolySynth for accordion-like sound
    },
    {
        emoji: '🎤',
        name: 'microphone',
        synth: 'Synth' // Tone.js Synth for vocal-like sound
    },
    {
        emoji: '🎧',
        name: 'headphones',
        synth: 'Synth' // Tone.js Synth for electronic sound
    }
];

const selector = document.getElementById('instrument-selector');

instruments.forEach((instrument, index) => {
    const label = document.createElement('label');
    label.style.marginRight = '10px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = instrument.name;
    checkbox.checked = true;
    checkbox.dataset.index = index;

    label.appendChild(checkbox);
    label.append(` ${instrument.emoji} ${instrument.name}`);
    selector.appendChild(label);
});

function getSelectedInstruments() {
    const checkboxes = document.querySelectorAll('#instrument-selector input[type="checkbox"]');
    return Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => instruments[cb.dataset.index]);
}

// Falling emojis setup (split into background and foreground)
const CHAR_HEIGHT = 20;
const COLUMNS = 88; // piano keys
const CHAR_WIDTH = WIDTH / COLUMNS;
const fgDrops = []; // dynamic interactive emoji stream

const spawnFgDrop = () => {
    const selected = getSelectedInstruments();
    if (selected.length === 0) return;

    const columnIndex = Math.floor(Math.random() * COLUMNS);
    fgDrops.push({
        y: -CHAR_HEIGHT,
        instrument: selected[Math.floor(Math.random() * selected.length)],
        speed: 1 + Math.random() * 2,
        x: columnIndex * CHAR_WIDTH,
        hit: false
    });
};

// Track hits per instrument
const hitCounts = {};
for (let { emoji } of instruments) {
    hitCounts[emoji] = 0;
}

// Update hit counter display
const updateHitCounter = () => {
    const displayText = Object.entries(hitCounts)
        .map(([emoji, count]) => `${emoji}: ${count}`)
        .join(', ');
    hitCounterElement.textContent = displayText;
};
updateHitCounter(); // Initial display

// Tone.js setup
Tone.start(); // Initialize Tone.js context
const synths = {};
instruments.forEach(instrument => {
    let synth;
    switch (instrument.synth) {
        case 'AMSynth':
            synth = new Tone.AMSynth().toDestination();
            break;
        case 'PolySynth':
            synth = new Tone.PolySynth(Tone.Synth, {
				volume: -8,
				oscillator: {
					partials: [1, 2, 1],
				},
			}).toDestination(); 
            break;
        case 'MembraneSynth':
            synth = new Tone.MembraneSynth({
				envelope: {
					sustain: 0,
					attack: 0.02,
					decay: 0.8,
				},
				octaves: 10,
				pitchDecay: 0.01,
			}).toDestination();
            break;
        case 'FMSynth':
            synth = new Tone.FMSynth().toDestination();
            break;
        case 'PluckSynth':
            synth = new Tone.PluckSynth().toDestination();
            break;
        case 'MonoSynth':
            synth = new Tone.MonoSynth({
				volume: -10,
				envelope: {
					attack: 0.1,
					decay: 0.3,
					release: 2,
				},
				filterEnvelope: {
					attack: 0.001,
					decay: 0.01,
					sustain: 0.5,
					baseFrequency: 200,
					octaves: 2.6,
				},
			}).toDestination();
            break;
        case 'Synth':
            synth = new Tone.Synth().toDestination();
            break;
    }
    synths[instrument.name] = synth;
});

// Resume Tone.js context on user interaction
document.addEventListener('click', () => {
    if (Tone.context.state === 'suspended') {
        Tone.start().then(() => {
            console.log('Tone.js context resumed');
        });
    }
}, { once: true });

// Recording setup with Tone.js
let mediaRecorder = null;
let recordedChunks = [];
const recorder = new Tone.Recorder();

const recordBtn = document.getElementById('recordBtn');
recordBtn.addEventListener('click', async () => {
    if (recorder.state === 'started') {
        await recorder.stop();
        recordBtn.textContent = 'Start Recording';
        const recording = await recorder.stop();
        const url = URL.createObjectURL(recording);
        const a = document.createElement('a');
        a.href = url;
        a.download = `instrument_recording_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
    } else {
        await recorder.start();
        recordBtn.textContent = 'Stop Recording';
        // Connect all synths to recorder
        Object.values(synths).forEach(synth => synth.connect(recorder));
    }
});

// Function to play instrument sound with pitch based on x-position
const playInstrumentSound = (instrumentName, xPos) => {
    try {
        const synth = synths[instrumentName];
        const MIDI_START = 21; // A0
        const MIDI_END = 108; // C8
        const TOTAL_KEYS = MIDI_END - MIDI_START + 1; // 88 keys

        // Map xPos to MIDI note from 21 to 108
        const midiNote = MIDI_START + (xPos / (WIDTH - 1)) * (TOTAL_KEYS - 1);

        // Convert MIDI note to frequency
        const frequency = Tone.Midi(midiNote).toFrequency();

        // Trigger attack and release
        if (instrumentName === 'drums') {
            synth.triggerAttackRelease(frequency, '8n');
        } else {
            synth.triggerAttackRelease(frequency, '4n');
        }
    } catch (err) {
        console.error(`Error playing sound for ${instrumentName}: ${err.message}`);
    }
};

// Debounce parameters
const DEBOUNCE_MS = 150;
let lastUpdateTime = 0;

// Log hit or miss to console
const logMessage = (message) => {
    const now = Date.now();
    if (now - lastUpdateTime < DEBOUNCE_MS) return;
    lastUpdateTime = now;
    console.log(`${new Date().toLocaleTimeString()}: ${message}`);
};

// Background and foreground canvases
const bgCanvas = document.createElement('canvas');
bgCanvas.width = WIDTH;
bgCanvas.height = HEIGHT;
const bgCtx = bgCanvas.getContext('2d');

const fgCanvas = document.createElement('canvas');
fgCanvas.width = WIDTH;
fgCanvas.height = HEIGHT;
const fgCtx = fgCanvas.getContext('2d');

const tempCanvas = document.createElement('canvas');
tempCanvas.width = WIDTH;
tempCanvas.height = HEIGHT;
const tempCtx = tempCanvas.getContext('2d');

// Render frame with layered compositing
let segmentationMask = null;
const renderFrame = () => {
    try {
        // Draw piano keys
        const whiteKeyWidth = WIDTH / 88;
        const whiteKeyHeight = HEIGHT;
        const blackKeyHeight = HEIGHT * 0.6;
        const blackKeys = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#

        bgCtx.clearRect(0, 0, WIDTH, HEIGHT);

        // Draw white keys
        for (let i = 0; i < 88; i++) {
            bgCtx.fillStyle = 'white';
            bgCtx.fillRect(i * whiteKeyWidth, 0, whiteKeyWidth, whiteKeyHeight);
            bgCtx.strokeStyle = 'black';
            bgCtx.strokeRect(i * whiteKeyWidth, 0, whiteKeyWidth, whiteKeyHeight);
        }

        // Draw black keys (skip where black keys don't exist)
        for (let i = 0; i < 88; i++) {
            if (blackKeys.includes(i % 12)) {
                bgCtx.fillStyle = 'black';
                bgCtx.fillRect(i * whiteKeyWidth + whiteKeyWidth * 0.65, 0, whiteKeyWidth * 0.7, blackKeyHeight);
            }
        }

        // Clear canvases
        fgCtx.clearRect(0, 0, WIDTH, HEIGHT);

        // Update and draw interactive drops
        fgCtx.font = `${CHAR_HEIGHT}px sans-serif`;
        for (let i = fgDrops.length - 1; i >= 0; i--) {
            const drop = fgDrops[i];
            if (!drop.hit) {
                drop.y += drop.speed * speedMultiplier;
                if (drop.y > HEIGHT) {
                    logMessage(`Missed ${drop.instrument.name}`);
                    fgDrops.splice(i, 1); // remove it
                    continue;
                }
                fgCtx.fillText(drop.instrument.emoji, drop.x, drop.y);
            } else {
                fgDrops.splice(i, 1); // remove after hit too
            }
        }

        // Composite: background → user → foreground
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        ctx.drawImage(bgCanvas, 0, 0);

        if (segmentationMask) {
            tempCtx.clearRect(0, 0, WIDTH, HEIGHT);
            tempCtx.drawImage(videoElement, 0, 0, WIDTH, HEIGHT);
            tempCtx.globalCompositeOperation = 'destination-in';
            tempCtx.drawImage(segmentationMask, 0, 0, WIDTH, HEIGHT);
            tempCtx.globalCompositeOperation = 'source-over';
            ctx.drawImage(tempCanvas, 0, 0);
        } else {
            ctx.drawImage(videoElement, 0, 0, WIDTH, HEIGHT);
            console.warn('No segmentation mask, using fallback video');
        }

        ctx.drawImage(fgCanvas, 0, 0);
    } catch (err) {
        console.error(`Render error: ${err.message}`);
    }
};

// Process pose results for swat detection
pose.onResults((results) => {
    try {
        if (results.poseLandmarks) {
            const landmarks = results.poseLandmarks;

            const hands = {
                'left_hand': landmarks[19], // LEFT_INDEX
                'right_hand': landmarks[20] // RIGHT_INDEX
            };

            Object.keys(hands).forEach((part) => {
                const landmark = hands[part];
                console.log(`${part} visibility: ${landmark.visibility.toFixed(2)}`);
                if (landmark && landmark.visibility > 0.2) {
                    const x = landmark.x * WIDTH;
                    const y = landmark.y * HEIGHT;

                    // Check collisions with foreground emojis
                    fgDrops.forEach((drop) => {
                        if (!drop.hit) {
                            if (x >= drop.x &&
                                x <= drop.x + CHAR_WIDTH &&
                                y >= drop.y - CHAR_HEIGHT &&
                                y <= drop.y
                            ) {
                                logMessage(`Hit ${drop.instrument.name} with ${part}`);
                                hitCounts[drop.instrument.emoji]++;
                                updateHitCounter();
                                playInstrumentSound(drop.instrument.name, drop.x);
                                drop.y = -CHAR_HEIGHT;
                                drop.instrument = instruments[Math.floor(Math.random() * instruments.length)];
                                drop.speed = 1 + Math.random() * 2;
                                drop.x = Math.floor(Math.random() * COLUMNS) * CHAR_WIDTH;
                                drop.hit = true;
                            }
                        }
                    });
                } else {
                    console.log("Pose landmarks:", results.poseLandmarks);
                    // console.warn(`No valid ${part} landmark detected`);
                }
            });
        } else {
            console.warn('No pose landmarks detected');
        }
    } catch (err) {
        console.error(`Pose processing error: ${err.message}`);
    }
});

// Process segmentation results
selfieSegmentation.onResults((results) => {
    try {
        segmentationMask = results.segmentationMask || null;
        if (!segmentationMask) {
            console.warn('No segmentation mask received');
        }
    } catch (err) {
        console.error(`Segmentation processing error: ${err.message}`);
    }
});

// Initialize camera
const camera = new Camera(videoElement, {
    onFrame: async () => {
        try {
            if (videoElement.readyState >= 2) { // Check if video has data
                await pose.send({
                    image: videoElement
                });
                await selfieSegmentation.send({
                    image: videoElement
                });
            } else {
                console.warn('Video feed not ready, readyState: ' + videoElement.readyState);
            }
        } catch (err) {
            console.error(`Camera frame error: ${err.message}`);
        }
    },
    width: WIDTH,
    height: HEIGHT,
    frameRate: 30
});

// Retry initialization for pose
const initializePoseWithRetry = async (retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await pose.initialize();
            console.log('Pose initialized successfully');
            return;
        } catch (err) {
            console.error(`Pose initialization attempt ${i + 1} failed: ${err.message}`);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    console.warn('Pose initialization failed after retries, continuing without pose detection');
};

// Start the camera
camera.start().catch((err) => {
    console.error(`Error starting camera: ${err.message}`);
});

// Initialize pose and segmentation
Promise.all([
    initializePoseWithRetry(),
    selfieSegmentation.initialize().catch((err) => {
        console.error(`Error initializing segmentation: ${err.message}`);
        return Promise.resolve(); // Continue despite error
    })
]).then(() => {
    console.log('Initialization complete, starting animation loop');
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');

    speedSlider.addEventListener('input', () => {
        speedMultiplier = parseFloat(speedSlider.value);
        speedValue.textContent = `${speedMultiplier.toFixed(1)}x`;
    });

    const dropRateSlider = document.getElementById('dropRateSlider');
    const dropRateValue = document.getElementById('dropRateValue');
    let dropsPerSecond = parseInt(dropRateSlider.value);

    dropRateSlider.addEventListener('input', () => {
        dropsPerSecond = parseInt(dropRateSlider.value);
        dropRateValue.textContent = dropsPerSecond;
    });
    setInterval(() => {
        for (let i = 0; i < dropsPerSecond; i++) {
            spawnFgDrop();
        }
    }, 100); // run every second

    // Animation loop
    function animate() {
        renderFrame();
        requestAnimationFrame(animate);
    }
    animate();
}).catch((err) => {
    console.error(`Initialization error: ${err.message}`);
});