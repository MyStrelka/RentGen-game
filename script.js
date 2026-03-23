/**
 * RentGen Runner - Vanilla JS Implementation
 */

// --- Audio Engine ---
class SynthEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isPlaying = false;
        this.nextNoteTime = 0;
        this.currentStep = 0;
        this.barCount = 0;
        this.timerId = null;

        this.bassPatterns = [
            [36, 0, 36, 36, 36, 0, 36, 36, 36, 0, 36, 36, 36, 0, 36, 36], // Standard
            [36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36], // High energy
            [36, 0, 0, 0, 36, 0, 0, 0, 36, 0, 0, 0, 36, 0, 0, 0], // Minimal
        ];

        this.leadPatterns = [
            [0, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 75, 0, 0, 0],
            [72, 0, 75, 0, 72, 0, 75, 0, 72, 0, 75, 0, 72, 75, 77, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Silent
        ];
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.15;
    }

    mtof(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    playOsc(freq, type, startTime, duration, vol) {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    playNoise(startTime, duration, vol) {
        if (!this.ctx || !this.masterGain) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, startTime);

        gain.gain.setValueAtTime(vol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        source.start(startTime);
        source.stop(startTime + duration);
    }

    scheduler() {
        if (!this.ctx || !this.isPlaying) return;
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleNote(this.currentStep, this.nextNoteTime);
            this.nextNoteTime += 0.125;
            this.currentStep = (this.currentStep + 1) % 16;
            if (this.currentStep === 0) {
                this.barCount = (this.barCount + 1) % 64;
            }
        }
        this.timerId = window.setTimeout(() => this.scheduler(), 25);
    }

    playKick(time) {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.15);

        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.15);
    }

    playHiHat(time, vol) {
        if (!this.ctx || !this.masterGain) return;
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'highpass';
        filter.frequency.setValueAtTime(8000, time);

        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        source.start(time);
        source.stop(time + 0.05);
    }

    playClap(time) {
        if (!this.ctx || !this.masterGain) return;
        this.playNoise(time, 0.08, 0.2);
        this.playOsc(200, 'triangle', time, 0.08, 0.1);
    }

    scheduleNote(step, time) {
        const filterCycle = (Math.sin(this.barCount * 0.2) + 1) / 2;
        const baseFilterFreq = 200 + filterCycle * 1500;

        if (step % 4 === 0) this.playKick(time);
        if (step % 8 === 4 && (this.barCount % 4 !== 0)) this.playClap(time);
        if (step % 2 === 1) this.playHiHat(time, 0.04 + filterCycle * 0.06);
        if (step % 4 === 2 && this.barCount % 8 > 3) this.playHiHat(time, 0.1);

        let bassIdx = 0;
        if (this.barCount % 16 > 12) bassIdx = 1;
        if (this.barCount % 16 < 4) bassIdx = 2;

        const bassNote = this.bassPatterns[bassIdx][step];
        if (bassNote > 0) {
            const freq = this.mtof(bassNote);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, time);
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(baseFilterFreq, time);
            filter.Q.setValueAtTime(5 + filterCycle * 10, time);

            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(time);
            osc.stop(time + 0.1);
        }

        let leadIdx = 0;
        if (this.barCount % 32 > 24) leadIdx = 1;
        if (this.barCount % 32 < 8) leadIdx = 2;

        const leadNote = this.leadPatterns[leadIdx][step];
        if (leadNote > 0) {
            const freq = this.mtof(leadNote);
            [0, 0.125, 0.25].forEach((delay, i) => {
                const oscTime = time + delay;
                const vol = (0.15 / (i + 1)) * (0.5 + filterCycle * 0.5);
                this.playOsc(freq, 'triangle', oscTime, 0.4, vol);
            });
        }
    }

    start() {
        if (this.isPlaying) return;
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.isPlaying = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        if (this.timerId) clearTimeout(this.timerId);
    }

    setVolume(v) {
        if (this.masterGain) this.masterGain.gain.value = v;
    }

    playShield() {
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        const notes = [60, 64, 67, 72];
        notes.forEach((n, i) => {
            this.playOsc(this.mtof(n), 'sawtooth', now + i * 0.05, 0.4, 0.2);
        });
    }

    playCrash() {
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        this.playNoise(now, 0.1, 0.5);
        this.playOsc(100, 'square', now, 0.1, 0.4);
    }

    playBoost() {
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    playGameOver() {
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        for (let i = 0; i < 8; i++) {
            const time = now + i * 0.15;
            const freq = i % 2 === 0 ? 440 : 330;
            this.playOsc(freq, 'square', time, 0.1, 0.3);
            this.playNoise(time, 0.05, 0.1);
        }
        const finalTime = now + 8 * 0.15;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, finalTime);
        osc.frequency.exponentialRampToValueAtTime(55, finalTime + 1.5);
        gain.gain.setValueAtTime(0.3, finalTime);
        gain.gain.exponentialRampToValueAtTime(0.001, finalTime + 1.5);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(finalTime);
        osc.stop(finalTime + 1.5);
    }
}

const audio = new SynthEngine();

// --- Constants ---
const LANES = 4;
const INITIAL_SPEED = 8;
const SPEED_INCREMENT = 0.001;
const SPAWN_RATE = 0.03;
const POWERUP_RATE = 0.005;
const PLAYER_RADIUS = 12;
const DUST_COUNT = 30;
const BUILDING_COUNT = 8;
const CONSTELLATION_COUNT = 3;

const WIRE_COLORS = [
    '#FF9800', // Orange
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#795548', // Brown
];

// --- Game State ---
let gameState = 'START';
let score = 0;
let highScore = parseInt(localStorage.getItem('rentgen_highscore')) || 0;
let hasShield = false;
let isRerouting = false;
let isMuted = false;
let showLevelUp = false;

const game = {
    playerLane: 1,
    playerWireIdx: 1,
    playerVisualX: 0,
    objects: [],
    particles: [],
    speed: INITIAL_SPEED,
    score: 0,
    nextId: 0,
    hasShield: false,
    glitchTimer: 0,
    flashTimer: 0,
    touchStart: { x: 0, y: 0 },
    time: 0,
    level: 1,
    lastTime: 0,
    dt: 1,
    buildings: [],
    constellations: [],
    dust: [],
    wireLanes: [0, 1, 2, 3],
    targetWireLanes: [0, 1, 2, 3],
    rerouteProgress: 1,
    rerouteTimer: 600,
};

// --- DOM Elements ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreVal = document.getElementById('score-val');
const levelVal = document.getElementById('level-val');
const highScoreVal = document.getElementById('high-score-val');
const shieldIndicator = document.getElementById('shield-indicator');
const rerouteWarning = document.getElementById('reroute-warning');
const levelUpEl = document.getElementById('level-up');
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const menuOverlay = document.getElementById('menu-overlay');
const finalScore = document.getElementById('final-score');
const finalHighScore = document.getElementById('final-high-score');
const muteBtn = document.getElementById('mute-btn');
const volOn = document.getElementById('vol-on');
const volOff = document.getElementById('vol-off');

// --- Helper Functions ---
function createDust(randomY = false) {
    return {
        x: Math.random() * canvas.width,
        y: randomY ? Math.random() * canvas.height : -10,
        speed: 1 + Math.random() * 3,
        size: 0.5 + Math.random() * 1.5,
        color: '#00d4ff',
        z: 0.1 + Math.random() * 0.5
    };
}

function createBuilding(layer, randomY = false) {
    return {
        x: Math.random() * canvas.width,
        y: randomY ? Math.random() * canvas.height : -300,
        w: 40 + Math.random() * 100,
        h: 100 + Math.random() * 300,
        layer
    };
}

function createConstellation() {
    const nodes = Array.from({ length: 5 + Math.floor(Math.random() * 5) }, () => ({
        x: Math.random() * 200 - 100,
        y: Math.random() * 200 - 100,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
    }));
    return {
        nodes,
        alpha: 0,
        targetAlpha: 0.1 + Math.random() * 0.2,
        x: Math.random() > 0.5 ? Math.random() * 100 : canvas.width - Math.random() * 100,
        y: Math.random() * canvas.height,
        timer: 100 + Math.random() * 300
    };
}

function createParticle(randomY = false) {
    return {
        x: Math.random() * canvas.width,
        y: randomY ? Math.random() * canvas.height : -10,
        speed: 2 + Math.random() * 10,
        size: 1 + Math.random() * 2,
        color: Math.random() > 0.5 ? '#00f2ff' : '#ffffff',
    };
}

function getWireX(wireIdx, y, w, time, h) {
    const laneWidth = w / (LANES + 1);
    const startLane = game.wireLanes[wireIdx];
    const endLane = game.targetWireLanes[wireIdx];
    const waveOffset = (y / h) * 0.5;
    const t = Math.max(0, Math.min(1, game.rerouteProgress * 1.5 - waveOffset));
    const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
    const currentLane = startLane + (endLane - startLane) * smoothT;
    return (currentLane + 1) * laneWidth + Math.sin(time * 2 + wireIdx + y * 0.005) * 15;
}

// --- UI Management ---
function updateUI() {
    scoreVal.textContent = Math.floor(game.score);
    levelVal.textContent = `Lv.${game.level}`;
    highScoreVal.textContent = highScore;
    shieldIndicator.style.display = game.hasShield ? 'flex' : 'none';
    rerouteWarning.style.display = isRerouting ? 'block' : 'none';
    levelUpEl.style.display = showLevelUp ? 'block' : 'none';

    if (gameState === 'PLAYING') {
        menuOverlay.classList.remove('active');
        startScreen.classList.remove('active');
        pauseScreen.classList.remove('active');
        gameOverScreen.classList.remove('active');
    } else {
        menuOverlay.classList.add('active');
        if (gameState === 'START') {
            startScreen.classList.add('active');
            pauseScreen.classList.remove('active');
            gameOverScreen.classList.remove('active');
        } else if (gameState === 'PAUSED') {
            startScreen.classList.remove('active');
            pauseScreen.classList.add('active');
            gameOverScreen.classList.remove('active');
        } else if (gameState === 'GAMEOVER') {
            startScreen.classList.remove('active');
            pauseScreen.classList.remove('active');
            gameOverScreen.classList.add('active');
            finalScore.textContent = Math.floor(game.score);
            finalHighScore.textContent = highScore;
        }
    }
}

// --- Game Logic ---
function resetGame() {
    game.playerLane = 1;
    game.playerWireIdx = 1;
    game.playerVisualX = 0;
    game.objects = [];
    game.particles = Array.from({ length: 50 }, () => createParticle(true));
    game.dust = Array.from({ length: DUST_COUNT }, () => createDust(true));
    game.buildings = Array.from({ length: BUILDING_COUNT }, (_, i) => createBuilding(i < BUILDING_COUNT / 2 ? 0 : 1, true));
    game.constellations = Array.from({ length: CONSTELLATION_COUNT }, () => createConstellation());
    game.speed = INITIAL_SPEED;
    game.score = 0;
    game.nextId = 0;
    game.hasShield = false;
    game.glitchTimer = 0;
    game.flashTimer = 0;
    game.time = 0;
    game.level = 1;
    game.lastTime = performance.now();
    game.wireLanes = [0, 1, 2, 3];
    game.targetWireLanes = [0, 1, 2, 3];
    game.rerouteProgress = 1;
    game.rerouteTimer = 600;

    gameState = 'PLAYING';
    isRerouting = false;
    showLevelUp = false;
    audio.start();
    updateUI();
}

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        audio.stop();
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        audio.start();
    }
    updateUI();
}

function toggleMute() {
    isMuted = !isMuted;
    audio.setVolume(isMuted ? 0 : 0.15);
    volOn.style.display = isMuted ? 'none' : 'block';
    volOff.style.display = isMuted ? 'block' : 'none';
}

function update(dt) {
    if (gameState !== 'PLAYING') return;

    const w = canvas.width;
    const h = canvas.height;
    
    game.time += 0.02 * dt;
    game.speed += SPEED_INCREMENT * dt;
    if (game.glitchTimer > 0) game.glitchTimer -= dt;
    if (game.flashTimer > 0) game.flashTimer -= dt;
    
    game.buildings.forEach(b => {
        const parallaxSpeed = b.layer === 0 ? 0.3 : 0.6;
        b.y += game.speed * parallaxSpeed * dt;
        if (b.y > h) Object.assign(b, createBuilding(b.layer));
    });

    game.dust = game.dust.filter(d => {
        d.y += game.speed * (d.z || 0.5) * dt;
        return d.y <= h + 20;
    });
    while (game.dust.length < DUST_COUNT) game.dust.push(createDust());

    game.constellations.forEach(c => {
        c.timer -= dt;
        if (c.timer <= 0) {
            c.targetAlpha = c.targetAlpha === 0 ? 0.1 + Math.random() * 0.2 : 0;
            c.timer = 100 + Math.random() * 300;
        }
        c.alpha += (c.targetAlpha - c.alpha) * 0.01 * dt;
        c.nodes.forEach(n => {
            n.x += n.vx * dt; n.y += n.vy * dt;
            if (Math.abs(n.x) > 100) n.vx *= -1;
            if (Math.abs(n.y) > 100) n.vy *= -1;
        });
    });

    const currentLevel = Math.floor(game.score / 200) + 1;
    if (currentLevel > game.level) {
        game.level = currentLevel;
        game.speed += 1.5;
        showLevelUp = true;
        audio.playBoost();
        setTimeout(() => { showLevelUp = false; updateUI(); }, 2000);
    }

    if (game.rerouteProgress < 1.5) {
        game.rerouteProgress += 0.006 * dt;
        if (game.rerouteProgress >= 1.5) {
            game.wireLanes = [...game.targetWireLanes];
            game.rerouteTimer = 600 + Math.random() * 300;
            isRerouting = false;
        }
    } else {
        game.rerouteTimer -= dt;
        if (game.rerouteTimer <= 0) {
            game.rerouteProgress = 0;
            isRerouting = true;
            const newLanes = [0, 1, 2, 3];
            for (let i = newLanes.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newLanes[i], newLanes[j]] = [newLanes[j], newLanes[i]];
            }
            game.targetWireLanes = newLanes;
        }
    }

    const playerY_fixed = h - 150;
    const targetX = getWireX(game.playerWireIdx, playerY_fixed, w, game.time, h);
    if (game.playerVisualX === 0) game.playerVisualX = targetX;
    game.playerVisualX += (targetX - game.playerVisualX) * 0.25 * dt;

    game.particles = game.particles.filter(p => {
        p.y += (p.speed + game.speed * 0.5) * dt;
        return p.y <= h + 20;
    });
    while (game.particles.length < 50) game.particles.push(createParticle());

    const dynamicSpawnRate = (SPAWN_RATE + (game.level - 1) * 0.005) * dt;
    const spawnWaveT = Math.max(0, Math.min(1, game.rerouteProgress * 1.5 - (-50 / h) * 0.5));
    const isSpawnCrossing = Math.abs(spawnWaveT - 0.5) < 0.2;

    if (Math.random() < dynamicSpawnRate && !isSpawnCrossing) {
        game.objects.push({ id: game.nextId++, wireIdx: Math.floor(Math.random() * LANES), y: -50, type: 'virus', size: 25 + Math.random() * 15 });
    } else if (Math.random() < (POWERUP_RATE * dt) && !game.hasShield) {
        game.objects.push({ id: game.nextId++, wireIdx: Math.floor(Math.random() * LANES), y: -50, type: 'shield', size: 30 });
    }
    
    game.objects = game.objects.filter(obj => {
        obj.y += game.speed * dt;
        const playerY = h - 150;
        const playerX = game.playerVisualX;
        const objX = getWireX(obj.wireIdx, obj.y, w, game.time, h);
        const waveOffset = (obj.y / h) * 0.5;
        const t = Math.max(0, Math.min(1, game.rerouteProgress * 1.5 - waveOffset));
        const isCrossing = Math.abs(t - 0.5) < 0.15;
        const dist = Math.sqrt((playerX - objX) ** 2 + (playerY - obj.y) ** 2);
        
        if (dist < PLAYER_RADIUS + obj.size / 2) {
            if (obj.type === 'shield') {
                game.hasShield = true;
                game.flashTimer = 15;
                audio.playShield();
                return false;
            } else if (obj.type === 'virus') {
                if (isCrossing) return true;
                if (game.hasShield) {
                    game.hasShield = false;
                    game.glitchTimer = 10;
                    audio.playCrash();
                    return false;
                } else {
                    game.glitchTimer = 30;
                    gameState = 'GAMEOVER';
                    audio.playGameOver();
                    if (game.score > highScore) {
                        highScore = Math.floor(game.score);
                        localStorage.setItem('rentgen_highscore', highScore);
                    }
                    updateUI();
                    return false;
                }
            }
        }
        return obj.y < h + 50;
    });
    
    game.score += (game.speed / 20) * dt;
    updateUI();
}

function draw() {
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = game.flashTimer > 0 ? '#003366' : '#010206';
    ctx.fillRect(0, 0, w, h);

    if (game.flashTimer > 0) {
        ctx.fillStyle = `rgba(0, 212, 255, ${game.flashTimer / 15})`;
        ctx.fillRect(0, 0, w, h);
    }

    ctx.save();
    game.buildings.forEach(b => {
        const alpha = b.layer === 0 ? 0.05 : 0.1;
        ctx.fillStyle = `rgba(0, 51, 102, ${alpha})`;
        ctx.strokeStyle = `rgba(0, 212, 255, ${alpha * 2})`;
        ctx.lineWidth = 1;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.beginPath();
        for (let i = 1; i < 4; i++) {
            ctx.moveTo(b.x, b.y + (b.h / 4) * i);
            ctx.lineTo(b.x + b.w, b.y + (b.h / 4) * i);
        }
        ctx.stroke();
    });
    ctx.restore();

    ctx.save();
    game.dust.forEach(d => {
        ctx.fillStyle = 'rgba(0, 212, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();

    ctx.save();
    game.constellations.forEach(c => {
        if (c.alpha <= 0.01) return;
        ctx.translate(c.x, c.y);
        ctx.strokeStyle = `rgba(0, 212, 255, ${c.alpha})`;
        ctx.fillStyle = `rgba(0, 212, 255, ${c.alpha})`;
        ctx.beginPath();
        c.nodes.forEach((n, i) => {
            ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
            c.nodes.forEach((n2, j) => {
                if (i === j) return;
                const d = Math.sqrt((n.x - n2.x) ** 2 + (n.y - n2.y) ** 2);
                if (d < 80) {
                    ctx.moveTo(n.x, n.y);
                    ctx.lineTo(n2.x, n2.y);
                }
            });
        });
        ctx.stroke();
        const sparkT = (game.time * 2) % 1;
        const node1 = c.nodes[0];
        const node2 = c.nodes[1 % c.nodes.length];
        const sx = node1.x + (node2.x - node1.x) * sparkT;
        const sy = node1.y + (node2.y - node1.y) * sparkT;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    });
    ctx.restore();

    game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;

    const pulse = 1 + Math.sin(game.time * 4) * 0.15;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let wireIdx = 0; wireIdx < LANES; wireIdx++) {
        const color = WIRE_COLORS[wireIdx];
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 + pulse;
        ctx.beginPath();
        for (let y = 0; y <= h; y += 50) {
            const x = getWireX(wireIdx, y, w, game.time, h);
            if (y === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();

    const playerY = h - 150;
    const playerX = game.playerVisualX;

    game.objects.forEach(obj => {
        const x = getWireX(obj.wireIdx, obj.y, w, game.time, h);
        const waveOffset = (obj.y / h) * 0.5;
        const t = Math.max(0, Math.min(1, game.rerouteProgress * 1.5 - waveOffset));
        const isCrossing = Math.abs(t - 0.5) < 0.15;
        const distToPlayer = Math.sqrt((playerX - x) ** 2 + (playerY - obj.y) ** 2);
        const isNear = distToPlayer < 300;

        if (obj.type === 'virus') {
            if (isCrossing) ctx.globalAlpha = 0.2;
            if (isNear) {
                ctx.fillStyle = 'rgba(255, 0, 85, 0.2)';
                ctx.beginPath();
                ctx.arc(x, obj.y, obj.size * 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#ff0055';
            const offset = Math.sin(Date.now() / 50) * 5;
            ctx.fillRect(x - obj.size/2 + offset, obj.y - obj.size/2, obj.size, obj.size);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x - obj.size/4 - offset, obj.y - obj.size/4, obj.size/2, obj.size/2);
            if (isCrossing) ctx.globalAlpha = 1.0;
        } else {
            if (isNear) {
                ctx.fillStyle = 'rgba(0, 212, 255, 0.2)';
                ctx.beginPath();
                ctx.arc(x, obj.y, obj.size * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#00d4ff';
            ctx.beginPath();
            ctx.arc(x, obj.y, (obj.size/2) * (1 + Math.sin(game.time * 5) * 0.2), 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 5, obj.y - 5, 10, 10);
        }
    });

    ctx.fillStyle = 'rgba(0, 242, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(playerX, playerY, PLAYER_RADIUS * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(playerX, playerY, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    
    if (game.hasShield) {
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(playerX, playerY, PLAYER_RADIUS + 10 + Math.sin(game.time * 10) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (game.glitchTimer > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(0, 212, 255, ${game.glitchTimer / 60})`;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 15; i++) {
            const gx = Math.random() * w;
            const gy = Math.random() * h;
            const gw = Math.random() * 300;
            const gh = Math.random() * 30;
            ctx.fillStyle = Math.random() > 0.5 ? '#00f2ff' : '#0088ff';
            ctx.fillRect(gx, gy, gw, gh);
        }
        ctx.restore();
    }
}

function loop(timestamp) {
    if (!game.lastTime) game.lastTime = timestamp;
    const elapsed = timestamp - game.lastTime;
    game.lastTime = timestamp;
    
    // Normalize dt to 60 FPS (16.67ms per frame)
    const dt = elapsed / (1000 / 60);
    // Limit dt to prevent huge jumps if tab was inactive
    const limitedDt = Math.min(dt, 3);

    if (gameState === 'PLAYING') {
        update(limitedDt);
        draw();
    } else {
        // Still draw background and elements in START, PAUSED, GAMEOVER
        draw();
    }
    requestAnimationFrame(loop);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// --- Inputs ---
window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'Escape') {
        togglePause();
        return;
    }
    if (gameState !== 'PLAYING') return;

    const w = canvas.width;
    const h = canvas.height;
    const playerY = h - 150;
    const wirePositions = WIRE_COLORS.map((_, idx) => ({
        idx,
        x: getWireX(idx, playerY, w, game.time, h)
    })).sort((a, b) => a.x - b.x);

    const currentWireRank = wirePositions.findIndex(p => p.idx === game.playerWireIdx);

    if ((e.key === 'ArrowLeft' || e.key === 'a') && currentWireRank > 0) {
        game.playerWireIdx = wirePositions[currentWireRank - 1].idx;
    } else if ((e.key === 'ArrowRight' || e.key === 'd') && currentWireRank < LANES - 1) {
        game.playerWireIdx = wirePositions[currentWireRank + 1].idx;
    }
});

window.addEventListener('touchstart', (e) => {
    game.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
});

window.addEventListener('touchend', (e) => {
    if (gameState !== 'PLAYING') return;
    const dx = e.changedTouches[0].clientX - game.touchStart.x;
    const dy = e.changedTouches[0].clientY - game.touchStart.y;
    
    const w = canvas.width;
    const h = canvas.height;
    const playerY = h - 150;
    const wirePositions = WIRE_COLORS.map((_, idx) => ({
        idx,
        x: getWireX(idx, playerY, w, game.time, h)
    })).sort((a, b) => a.x - b.x);

    const currentWireRank = wirePositions.findIndex(p => p.idx === game.playerWireIdx);

    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0 && currentWireRank > 0) {
            game.playerWireIdx = wirePositions[currentWireRank - 1].idx;
        } else if (dx > 0 && currentWireRank < LANES - 1) {
            game.playerWireIdx = wirePositions[currentWireRank + 1].idx;
        }
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        const touchX = e.changedTouches[0].clientX;
        const relativeX = touchX / window.innerWidth;
        const targetLane = Math.floor(relativeX * LANES);
        if (targetLane >= 0 && targetLane < LANES && wirePositions[targetLane]) {
            game.playerWireIdx = wirePositions[targetLane].idx;
        }
    }
});

// --- Event Listeners ---
document.getElementById('start-game-btn').addEventListener('click', resetGame);
document.getElementById('restart-btn').addEventListener('click', resetGame);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('mute-btn').addEventListener('click', toggleMute);

window.addEventListener('resize', resize);

// --- Init ---
resize();
updateUI();
game.lastTime = performance.now();
requestAnimationFrame(loop);
