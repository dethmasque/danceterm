let speedMultiplier = 1.0;

const videoElement = document.getElementById('video');
const outputCanvas = document.getElementById('outputCanvas');
const hitCounterElement = document.getElementById('hitCounter');
const ctx = outputCanvas.getContext('2d');

// Set canvas size dynamically based on viewport
const BASE_WIDTH = 320;
const BASE_HEIGHT = 240;
const ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT;
const MAX_WIDTH = window.innerWidth * (window.devicePixelRatio || 1);
const WIDTH = Math.min(BASE_WIDTH, MAX_WIDTH);
const HEIGHT = Math.round(WIDTH / ASPECT_RATIO);
outputCanvas.width = WIDTH;
outputCanvas.height = HEIGHT;
videoElement.style.objectFit = 'contain'; // Prevent video stretching

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

// Musical instrument emojis and their names
const instruments = [{
        emoji: '🎸',
        name: 'guitar',
        oscillator: 'sawtooth'
    },
    {
        emoji: '🎹',
        name: 'piano',
        oscillator: 'square'
    },
    {
        emoji: '🥁',
        name: 'drums',
        oscillator: 'sine'
    },
    {
        emoji: '🎺',
        name: 'trumpet',
        oscillator: 'triangle'
    },
    {
        emoji: '🎻',
        name: 'violin',
        oscillator: 'square'
    },
    {
        emoji: '🎷',
        name: 'saxophone',
        oscillator: 'sawtooth'
    },
    {
        emoji: '🪕',
        name: 'banjo',
        oscillator: 'sine'
    },
    {
        emoji: '🪗',
        name: 'accordion',
        oscillator: 'square'
    },
    {
        emoji: '🎤',
        name: 'microphone',
        oscillator: 'triangle'
    },
    {
        emoji: '🎧',
        name: 'headphones',
        oscillator: 'triangle'
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
const COLUMNS = 88; // piano keys/
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
for (let {
        emoji
    }
    of instruments) {
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

// Web Audio API setup
const audioCtx = new(window.AudioContext || window.webkitAudioContext)();

// Resume AudioContext on user interaction
document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log('AudioContext resumed');
        });
    }
}, {
    once: true
});

let mediaStreamDest = audioCtx.createMediaStreamDestination();
let mediaRecorder = null;
let recordedChunks = [];

const recordBtn = document.getElementById('recordBtn');
recordBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recordBtn.textContent = 'Start Recording';
    } else {
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(mediaStreamDest.stream);
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, {
                type: 'audio/webm'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `instrument_recording_${Date.now()}.webm`;
            a.click();
            URL.revokeObjectURL(url);
        };
        mediaRecorder.start();
        recordBtn.textContent = 'Stop Recording';
    }
});


// Function to play instrument sound with pitch based on x-position
const playInstrumentSound = (instrumentName, xPos, instrumentOsc) => {
    try {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        const MIDI_START = 21; // A0
        const MIDI_END = 108; // C8
        const TOTAL_KEYS = MIDI_END - MIDI_START + 1; // 88 keys

        // Map xPos to MIDI note from 21 to 108
        const midiNote = MIDI_START + (xPos / (WIDTH - 1)) * (TOTAL_KEYS - 1);

        // Convert MIDI note to frequency
        const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

        oscillator.type = instrumentOsc
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        // Envelope for sound
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.01);
        if (instrumentName === 'drums') {
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        } else {
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        }

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.connect(mediaStreamDest); // Send to recorder
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + (instrumentName === 'drums' ? 0.1 : 0.3));
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
                                playInstrumentSound(drop.instrument.name, drop.x, drop.instrument.oscillator);
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

// Initialize camera with mobile-friendly constraints
const camera = new Camera(videoElement, {
    onFrame: async () => {
        try {
            if (videoElement.readyState >= 2) { // Check if video has data
                await pose.send({ image: videoElement });
                await selfieSegmentation.send({ image: videoElement });
            } else {
                console.warn('Video feed not ready, readyState: ' + videoElement.readyState);
            }
        } catch (err) {
            console.error(`Camera frame error: ${err.message}`);
        }
    },
    width: WIDTH,
    height: HEIGHT,
    frameRate: { ideal: 30 },
    facingMode: 'user' // Use front-facing camera for mobile
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
