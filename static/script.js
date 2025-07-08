const videoElement = document.getElementById('video');
const outputCanvas = document.getElementById('outputCanvas');
const outputElement = document.getElementById('output');
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
const WIDTH = 320;
const HEIGHT = 240;
outputCanvas.width = WIDTH;
outputCanvas.height = HEIGHT;

// Falling characters setup (split into background and foreground)
const CHAR_WIDTH = 10;
const CHAR_HEIGHT = 15;
const COLUMNS = Math.floor(WIDTH / CHAR_WIDTH);
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const bgDrops = Array(Math.floor(COLUMNS / 2)).fill(0).map(() => ({
    y: Math.random() * -CHAR_HEIGHT,
    char: characters[Math.floor(Math.random() * characters.length)],
    speed: 1 + Math.random() * 2,
    x: Math.floor(Math.random() * COLUMNS) * CHAR_WIDTH
}));
const fgDrops = Array(Math.floor(COLUMNS / 2)).fill(0).map(() => ({
    y: Math.random() * -CHAR_HEIGHT,
    char: characters[Math.floor(Math.random() * characters.length)],
    speed: 1 + Math.random() * 2,
    x: Math.floor(Math.random() * COLUMNS) * CHAR_WIDTH,
    hit: false
}));

// Debounce parameters
const DEBOUNCE_MS = 150;
let lastUpdateTime = 0;

// Log hit or miss
const logMessage = (message) => {
    const now = Date.now();
    if (now - lastUpdateTime < DEBOUNCE_MS) return;
    lastUpdateTime = now;

    const p = document.createElement('p');
    p.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    outputElement.appendChild(p);
    outputElement.scrollTop = outputElement.scrollHeight;
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
    // Clear canvases
    bgCtx.fillStyle = 'black';
    bgCtx.fillRect(0, 0, WIDTH, HEIGHT);
    fgCtx.clearRect(0, 0, WIDTH, HEIGHT);

    // Draw background characters
    bgCtx.font = `${CHAR_HEIGHT}px monospace`;
    bgCtx.fillStyle = '#00FF00';
    bgDrops.forEach((drop) => {
        drop.y += drop.speed;
        if (drop.y > HEIGHT) {
            drop.y = -CHAR_HEIGHT;
            drop.char = characters[Math.floor(Math.random() * characters.length)];
            drop.speed = 1 + Math.random() * 2;
            drop.x = Math.floor(Math.random() * COLUMNS) * CHAR_WIDTH;
        }
        bgCtx.fillText(drop.char, drop.x, drop.y);
    });

    // Draw foreground characters (interactive)
    fgCtx.font = `${CHAR_HEIGHT}px monospace`;
    fgCtx.fillStyle = '#00FF00';
    fgDrops.forEach((drop) => {
        if (!drop.hit) {
            drop.y += drop.speed;
            if (drop.y > HEIGHT) {
                logMessage(`Missed character '${drop.char}'`);
                drop.y = -CHAR_HEIGHT;
                drop.char = characters[Math.floor(Math.random() * characters.length)];
                drop.speed = 1 + Math.random() * 2;
                drop.x = Math.floor(Math.random() * COLUMNS) * CHAR_WIDTH;
                drop.hit = false;
            }
            fgCtx.fillText(drop.char, drop.x, drop.y);
        }
    });

    // Composite: background → user → foreground
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(bgCanvas, 0, 0); // Draw background characters

    if (segmentationMask) {
        // Draw video on temp canvas
        tempCtx.clearRect(0, 0, WIDTH, HEIGHT);
        tempCtx.drawImage(videoElement, 0, 0, WIDTH, HEIGHT);

        // Apply segmentation mask to isolate user
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(segmentationMask, 0, 0, WIDTH, HEIGHT);
        tempCtx.globalCompositeOperation = 'source-over';

        // Draw user on main canvas
        ctx.drawImage(tempCanvas, 0, 0);
    } else {
        ctx.drawImage(videoElement, 0, 0, WIDTH, HEIGHT); // Fallback
    }

    // Draw foreground characters
    ctx.drawImage(fgCanvas, 0, 0);
};

// Process pose results for swat detection
pose.onResults((results) => {
    if (results.poseLandmarks) {
        const landmarks = results.poseLandmarks;

        // Track wrist landmarks for swatting
        const wrists = {
            'left_wrist': landmarks[15],
            'right_wrist': landmarks[16]
        };

        Object.keys(wrists).forEach((part) => {
            const landmark = wrists[part];
            if (landmark && landmark.visibility > 0.5) {
                const x = landmark.x * WIDTH;
                const y = landmark.y * HEIGHT;

                // Check collisions with foreground characters
                fgDrops.forEach((drop) => {
                    if (!drop.hit) {
                        const charX = drop.x + CHAR_WIDTH / 2;
                        const charY = drop.y;
                        const dist = Math.sqrt((x - charX) ** 2 + (y - charY) ** 2);
                        if (dist < CHAR_WIDTH * 1.5) {
                            logMessage(`Hit character '${drop.char}' with ${part}`);
                            drop.y = -CHAR_HEIGHT;
                            drop.char = characters[Math.floor(Math.random() * characters.length)];
                            drop.speed = 1 + Math.random() * 2;
                            drop.x = Math.floor(Math.random() * COLUMNS) * CHAR_WIDTH;
                            drop.hit = true;
                        }
                    }
                });
            }
        });
    }
});

// Process segmentation results
selfieSegmentation.onResults((results) => {
    segmentationMask = results.segmentationMask;
});

// Initialize camera
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await pose.send({ image: videoElement });
        await selfieSegmentation.send({ image: videoElement });
    },
    width: WIDTH,
    height: HEIGHT,
    frameRate: 30
});

// Start the camera
camera.start().catch((err) => {
    logMessage(`Error starting camera: ${err.message}`);
});

// Initialize pose and segmentation
Promise.all([
    pose.initialize().catch((err) => {
        logMessage(`Error initializing pose detection: ${err.message}`);
    }),
    selfieSegmentation.initialize().catch((err) => {
        logMessage(`Error initializing segmentation: ${err.message}`);
    })
]).then(() => {
    // Animation loop
    function animate() {
        renderFrame();
        requestAnimationFrame(animate);
    }
    animate();
});