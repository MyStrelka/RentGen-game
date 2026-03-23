/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Play, RotateCcw, Activity, Cpu, Volume2, VolumeX } from 'lucide-react';

// --- Audio Engine ---
class SynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private nextNoteTime = 0;
  private currentStep = 0;
  private barCount = 0;
  private timerId: number | null = null;

  private bassPatterns = [
    [36, 0, 36, 36, 36, 0, 36, 36, 36, 0, 36, 36, 36, 0, 36, 36], // Standard
    [36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36], // High energy
    [36, 0, 0, 0, 36, 0, 0, 0, 36, 0, 0, 0, 36, 0, 0, 0], // Minimal
  ];
  
  private leadPatterns = [
    [0, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 75, 0, 0, 0],
    [72, 0, 75, 0, 72, 0, 75, 0, 72, 0, 75, 0, 72, 75, 77, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Silent
  ];

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.15;
  }

  private mtof(midi: number) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private playOsc(freq: number, type: OscillatorType, startTime: number, duration: number, vol: number) {
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

  private playNoise(startTime: number, duration: number, vol: number) {
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

  private scheduler() {
    if (!this.ctx) return;
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

  private playKick(time: number) {
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

  private playHiHat(time: number, vol: number) {
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

  private playClap(time: number) {
    if (!this.ctx || !this.masterGain) return;
    this.playNoise(time, 0.08, 0.2);
    this.playOsc(200, 'triangle', time, 0.08, 0.1);
  }

  private scheduleNote(step: number, time: number) {
    // Dynamic Filter Frequency (opens/closes over 32 bars)
    const filterCycle = (Math.sin(this.barCount * 0.2) + 1) / 2;
    const baseFilterFreq = 200 + filterCycle * 1500;

    // Kick on every beat
    if (step % 4 === 0) {
      this.playKick(time);
    }

    // Clap on 2 and 4 (only in even bars)
    if (step % 8 === 4 && (this.barCount % 4 !== 0)) {
      this.playClap(time);
    }

    // Hi-hats
    if (step % 2 === 1) {
      this.playHiHat(time, 0.04 + filterCycle * 0.06);
    }
    
    // Open Hat on off-beats (energy build up)
    if (step % 4 === 2 && this.barCount % 8 > 3) {
      this.playHiHat(time, 0.1);
    }

    // Bass Variation
    let bassIdx = 0;
    if (this.barCount % 16 > 12) bassIdx = 1; // High energy
    if (this.barCount % 16 < 4) bassIdx = 2; // Minimal
    
    const bassNote = this.bassPatterns[bassIdx][step];
    if (bassNote > 0) {
      const freq = this.mtof(bassNote);
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

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
      gain.connect(this.masterGain!);

      osc.start(time);
      osc.stop(time + 0.1);
    }

    // Lead Variation
    let leadIdx = 0;
    if (this.barCount % 32 > 24) leadIdx = 1; // Arp
    if (this.barCount % 32 < 8) leadIdx = 2; // Silent
    
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
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    this.isPlaying = true;
    this.nextNoteTime = this.ctx!.currentTime;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) clearTimeout(this.timerId);
  }

  setVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  playShield() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [60, 64, 67, 72]; // C4, E4, G4, C5
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
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playGameOver() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    
    // Mocking "Ha-ha-ha-ha" synthetic laugh
    // Two sequences of rapid staccato notes
    for (let i = 0; i < 8; i++) {
      const time = now + i * 0.15;
      const freq = i % 2 === 0 ? 440 : 330; // Alternating A4 and E4
      this.playOsc(freq, 'square', time, 0.1, 0.3);
      
      // Add a little noise "puff" for each laugh syllable
      this.playNoise(time, 0.05, 0.1);
    }
    
    // Final sliding "fail" note
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
const GLOW_STRENGTH = 30;
const DUST_COUNT = 30;
const BUILDING_COUNT = 8;
const CONSTELLATION_COUNT = 3;

const WIRE_COLORS = [
  '#FF9800', // Orange
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#795548', // Brown
];

type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

interface GameObject {
  id: number;
  wireIdx: number; // Attached to a specific wire color
  y: number; // Progress along the wire (top to bottom)
  type: 'virus' | 'shield';
  size: number;
}

interface Particle {
  x: number;
  y: number;
  speed: number;
  size: number;
  color: string;
  z?: number; // Depth for parallax
}

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number; // 0 (far), 1 (near)
}

interface NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Constellation {
  nodes: NetworkNode[];
  alpha: number;
  targetAlpha: number;
  x: number;
  y: number;
  timer: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  
  const gameRef = useRef({
    playerLane: 1,
    playerWireIdx: 1,
    playerVisualX: 0,
    objects: [] as GameObject[],
    particles: [] as Particle[],
    speed: INITIAL_SPEED,
    score: 0,
    nextId: 0,
    hasShield: false,
    glitchTimer: 0,
    flashTimer: 0,
    touchStart: { x: 0, y: 0 },
    time: 0,
    level: 1,
    buildings: [] as Building[],
    constellations: [] as Constellation[],
    dust: [] as Particle[],
    // Rerouting State
    wireLanes: [0, 1, 2, 3], // Current lane index for each wire color
    targetWireLanes: [0, 1, 2, 3],
    rerouteProgress: 1, // 0 to 1
    rerouteTimer: 600, // frames until next reroute
  });

  const resetGame = () => {
    const w = canvasRef.current?.width || 600;
    const h = canvasRef.current?.height || 1000;

    gameRef.current = {
      playerLane: 1,
      playerWireIdx: 1,
      playerVisualX: 0,
      objects: [],
      particles: Array.from({ length: 50 }, () => createParticle(true)),
      dust: Array.from({ length: DUST_COUNT }, () => createDust(true)),
      buildings: Array.from({ length: BUILDING_COUNT }, (_, i) => createBuilding(i < BUILDING_COUNT / 2 ? 0 : 1, true)),
      constellations: Array.from({ length: CONSTELLATION_COUNT }, () => createConstellation()),
      speed: INITIAL_SPEED,
      score: 0,
      nextId: 0,
      hasShield: false,
      glitchTimer: 0,
      flashTimer: 0,
      touchStart: { x: 0, y: 0 },
      time: 0,
      level: 1,
      wireLanes: [0, 1, 2, 3],
      targetWireLanes: [0, 1, 2, 3],
      rerouteProgress: 1,
      rerouteTimer: 600,
    };
    setScore(0);
    setHasShield(false);
    setIsRerouting(false);
    setGameState('PLAYING');
  };

  const createDust = (randomY = false): Particle => ({
    x: Math.random() * (canvasRef.current?.width || 600),
    y: randomY ? Math.random() * (canvasRef.current?.height || 1000) : -10,
    speed: 1 + Math.random() * 3,
    size: 0.5 + Math.random() * 1.5,
    color: '#00d4ff',
    z: 0.1 + Math.random() * 0.5
  });

  const createBuilding = (layer: number, randomY = false): Building => {
    const w = canvasRef.current?.width || 600;
    const h = canvasRef.current?.height || 1000;
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -300,
      w: 40 + Math.random() * 100,
      h: 100 + Math.random() * 300,
      layer
    };
  };

  const createConstellation = (): Constellation => {
    const w = canvasRef.current?.width || 600;
    const h = canvasRef.current?.height || 1000;
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
      x: Math.random() > 0.5 ? Math.random() * 100 : w - Math.random() * 100,
      y: Math.random() * h,
      timer: 100 + Math.random() * 300
    };
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audio.setVolume(newMuted ? 0 : 0.15);
  };

  const createParticle = (randomY = false): Particle => ({
    x: Math.random() * (canvasRef.current?.width || 600),
    y: randomY ? Math.random() * (canvasRef.current?.height || 1000) : -10,
    speed: 2 + Math.random() * 10,
    size: 1 + Math.random() * 2,
    color: Math.random() > 0.5 ? '#00f2ff' : '#ffffff',
  });

  const togglePause = () => {
    if (gameState === 'PLAYING') setGameState('PAUSED');
    else if (gameState === 'PAUSED') setGameState('PLAYING');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'p' || e.key === 'Escape') {
      togglePause();
      return;
    }
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const playerY = h - 150;
    const { time } = gameRef.current;

    // Get wires sorted by their current X position at player's Y
    const wirePositions = WIRE_COLORS.map((_, idx) => ({
      idx,
      x: getWireX(idx, playerY, w, time, h)
    })).sort((a, b) => a.x - b.x);

    const currentWireRank = wirePositions.findIndex(p => p.idx === gameRef.current.playerWireIdx);

    if ((e.key === 'ArrowLeft' || e.key === 'a') && currentWireRank > 0) {
      gameRef.current.playerWireIdx = wirePositions[currentWireRank - 1].idx;
    } else if ((e.key === 'ArrowRight' || e.key === 'd') && currentWireRank < LANES - 1) {
      gameRef.current.playerWireIdx = wirePositions[currentWireRank + 1].idx;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    gameRef.current.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;
    const dx = e.changedTouches[0].clientX - gameRef.current.touchStart.x;
    const dy = e.changedTouches[0].clientY - gameRef.current.touchStart.y;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const playerY = h - 150;
    const { time } = gameRef.current;

    // Get wires sorted by their current X position at player's Y
    const wirePositions = WIRE_COLORS.map((_, idx) => ({
      idx,
      x: getWireX(idx, playerY, w, time, h)
    })).sort((a, b) => a.x - b.x);

    const currentWireRank = wirePositions.findIndex(p => p.idx === gameRef.current.playerWireIdx);

    // Swipe detection
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && currentWireRank > 0) {
        gameRef.current.playerWireIdx = wirePositions[currentWireRank - 1].idx;
      } else if (dx > 0 && currentWireRank < LANES - 1) {
        gameRef.current.playerWireIdx = wirePositions[currentWireRank + 1].idx;
      }
    } 
    // Tap detection for lane jumping
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const rect = canvas.getBoundingClientRect();
      const touchX = e.changedTouches[0].clientX - rect.left;
      const relativeX = touchX / rect.width;
      const targetLane = Math.floor(relativeX * LANES);
      
      // Find wire that is currently in this lane (or closest to it)
      if (targetLane >= 0 && targetLane < LANES) {
        // Find the wire whose rank matches the target lane
        if (wirePositions[targetLane]) {
          gameRef.current.playerWireIdx = wirePositions[targetLane].idx;
        }
      }
    }
  };

  const getWireX = (wireIdx: number, y: number, w: number, time: number, h: number) => {
    const { wireLanes, targetWireLanes, rerouteProgress } = gameRef.current;
    const laneWidth = w / (LANES + 1);
    
    const startLane = wireLanes[wireIdx];
    const endLane = targetWireLanes[wireIdx];
    
    // Wave effect: reroute happens from top to bottom
    // rerouteProgress goes 0 -> 1.5 to allow the wave to clear the screen
    const waveOffset = (y / h) * 0.5;
    const t = Math.max(0, Math.min(1, rerouteProgress * 1.5 - waveOffset));
    
    const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
    const currentLane = startLane + (endLane - startLane) * smoothT;
    
    return (currentLane + 1) * laneWidth + Math.sin(time * 2 + wireIdx + y * 0.005) * 15;
  };

  useEffect(() => {
    if (gameState === 'PLAYING') {
      audio.start();
    } else if (gameState === 'PAUSED' || gameState === 'GAMEOVER' || gameState === 'START') {
      audio.stop();
    }
  }, [gameState]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const update = () => {
      const { current: game } = gameRef;
      const w = canvas.width;
      const h = canvas.height;
      const laneWidth = w / (LANES + 1);
      
      game.time += 0.02;
      game.speed += SPEED_INCREMENT;
      if (game.glitchTimer > 0) game.glitchTimer--;
      if (game.flashTimer > 0) game.flashTimer--;
      
      // Update Background Elements
      game.buildings.forEach(b => {
        const parallaxSpeed = b.layer === 0 ? 0.3 : 0.6;
        b.y += game.speed * parallaxSpeed;
        if (b.y > h) {
          Object.assign(b, createBuilding(b.layer));
        }
      });

      game.dust = game.dust.filter(d => {
        d.y += game.speed * (d.z || 0.5);
        return d.y <= h + 20;
      });
      while (game.dust.length < DUST_COUNT) {
        game.dust.push(createDust());
      }

      game.constellations.forEach(c => {
        c.timer--;
        if (c.timer <= 0) {
          c.targetAlpha = c.targetAlpha === 0 ? 0.1 + Math.random() * 0.2 : 0;
          c.timer = 100 + Math.random() * 300;
        }
        c.alpha += (c.targetAlpha - c.alpha) * 0.01;
        
        c.nodes.forEach(n => {
          n.x += n.vx;
          n.y += n.vy;
          if (Math.abs(n.x) > 100) n.vx *= -1;
          if (Math.abs(n.y) > 100) n.vy *= -1;
        });
      });

      // Difficulty Scaling
      const currentLevel = Math.floor(game.score / 200) + 1;
      if (currentLevel > game.level) {
        game.level = currentLevel;
        game.speed += 1.5; // Significant jump
        setShowLevelUp(true);
        audio.playBoost();
        setTimeout(() => setShowLevelUp(false), 2000);
      }

      // Handle Rerouting Logic
      if (game.rerouteProgress < 1.5) {
        game.rerouteProgress += 0.006; // Slightly slower for the wave effect
        if (game.rerouteProgress >= 1.5) {
          game.wireLanes = [...game.targetWireLanes];
          game.rerouteTimer = 600 + Math.random() * 300; // 10-15 seconds
          setIsRerouting(false);
        }
      } else {
        game.rerouteTimer--;
        if (game.rerouteTimer <= 0) {
          // Trigger Reroute
          game.rerouteProgress = 0;
          setIsRerouting(true);
          // Shuffle lanes
          const newLanes = [0, 1, 2, 3];
          for (let i = newLanes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newLanes[i], newLanes[j]] = [newLanes[j], newLanes[i]];
          }
          game.targetWireLanes = newLanes;
        }
      }

      // Smooth Player X (Attached to Wire)
      const playerY_fixed = h - 150;
      const targetX = getWireX(game.playerWireIdx, playerY_fixed, w, game.time, h);
      
      if (game.playerVisualX === 0) game.playerVisualX = targetX;
      game.playerVisualX += (targetX - game.playerVisualX) * 0.25;

      // Update Particles
      game.particles = game.particles.filter(p => {
        p.y += p.speed + game.speed * 0.5;
        return p.y <= h + 20;
      });
      while (game.particles.length < 50) {
        game.particles.push(createParticle());
      }

      // Spawn Objects
      const dynamicSpawnRate = SPAWN_RATE + (game.level - 1) * 0.005;
      
      // Don't spawn if the top of the screen is currently crossing
      const spawnWaveT = Math.max(0, Math.min(1, game.rerouteProgress * 1.5 - (-50 / h) * 0.5));
      const isSpawnCrossing = Math.abs(spawnWaveT - 0.5) < 0.2;

      if (Math.random() < dynamicSpawnRate && !isSpawnCrossing) {
        game.objects.push({
          id: game.nextId++,
          wireIdx: Math.floor(Math.random() * LANES),
          y: -50,
          type: 'virus',
          size: 25 + Math.random() * 15,
        });
      } else if (Math.random() < POWERUP_RATE && !game.hasShield) {
        game.objects.push({
          id: game.nextId++,
          wireIdx: Math.floor(Math.random() * LANES),
          y: -50,
          type: 'shield',
          size: 30,
        });
      }
      
      // Update Objects
      game.objects = game.objects.filter(obj => {
        obj.y += game.speed;
        
        // Collision
        const playerY = h - 150;
        const playerX = game.playerVisualX;
        
        // Object X is tied to its wire's current position
        const objX = getWireX(obj.wireIdx, obj.y, w, game.time, h);
        
        // Check if object is in a "crossing" state (safe zone)
        const waveOffset = (obj.y / h) * 0.5;
        const t = Math.max(0, Math.min(1, game.rerouteProgress * 1.5 - waveOffset));
        const isCrossing = Math.abs(t - 0.5) < 0.15;

        const dist = Math.sqrt((playerX - objX) ** 2 + (playerY - obj.y) ** 2);
        
        if (dist < PLAYER_RADIUS + obj.size / 2) {
          if (obj.type === 'shield') {
            game.hasShield = true;
            setHasShield(true);
            game.flashTimer = 15; // Trigger flash
            audio.playShield();
            return false;
          } else if (obj.type === 'virus') {
            // Safe zone check: viruses don't kill while crossing
            if (isCrossing) return true;

            if (game.hasShield) {
              game.hasShield = false;
              setHasShield(false);
              game.glitchTimer = 10;
              audio.playCrash();
              return false;
            } else {
              game.glitchTimer = 30;
              setGameState('GAMEOVER');
              audio.playGameOver();
              if (game.score > highScore) setHighScore(Math.floor(game.score));
              return false;
            }
          }
        }
        
        return obj.y < h + 50;
      });
      
      game.score += game.speed / 20;
      setScore(Math.floor(game.score));
    };

    const draw = () => {
      const { current: game } = gameRef;
      const w = canvas.width;
      const h = canvas.height;
      const laneWidth = w / (LANES + 1);

      // Background
      ctx.fillStyle = game.flashTimer > 0 ? '#003366' : '#010206';
      ctx.fillRect(0, 0, w, h);

      if (game.flashTimer > 0) {
        ctx.fillStyle = `rgba(0, 212, 255, ${game.flashTimer / 15})`;
        ctx.fillRect(0, 0, w, h);
      }

      // Cyber City Buildings (Parallax)
      ctx.save();
      game.buildings.forEach(b => {
        const alpha = b.layer === 0 ? 0.05 : 0.1;
        ctx.fillStyle = `rgba(0, 51, 102, ${alpha})`;
        ctx.strokeStyle = `rgba(0, 212, 255, ${alpha * 2})`;
        ctx.lineWidth = 1;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        
        // Schematic lines
        ctx.beginPath();
        for (let i = 1; i < 4; i++) {
          ctx.moveTo(b.x, b.y + (b.h / 4) * i);
          ctx.lineTo(b.x + b.w, b.y + (b.h / 4) * i);
        }
        ctx.stroke();
      });
      ctx.restore();

      // Neon Dust
      ctx.save();
      game.dust.forEach(d => {
        ctx.fillStyle = 'rgba(0, 212, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Global Network Constellations
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
        
        // Sparks (No shadowBlur here for performance)
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

      // Particles (Existing ones, maybe keep for extra detail)
      game.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });
      ctx.globalAlpha = 1.0;

      // Draw Twisted Pair Lines
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
      ctx.shadowBlur = 0;

      // Draw Objects (Attached to Wires)
      const playerY = h - 150;
      const playerX = game.playerVisualX;

      game.objects.forEach(obj => {
        const x = getWireX(obj.wireIdx, obj.y, w, game.time, h);
        
        // Safe zone visual effect
        const waveOffset = (obj.y / h) * 0.5;
        const t = Math.max(0, Math.min(1, game.rerouteProgress * 1.5 - waveOffset));
        const isCrossing = Math.abs(t - 0.5) < 0.15;

        // Selective glow for nearby objects
        const distToPlayer = Math.sqrt((playerX - x) ** 2 + (playerY - obj.y) ** 2);
        const isNear = distToPlayer < 300;

        if (obj.type === 'virus') {
          if (isCrossing) {
            ctx.globalAlpha = 0.2;
          }
          if (isNear) {
            // Simple circle glow instead of dynamic radial gradient creation
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
          if (isCrossing) {
            ctx.globalAlpha = 1.0;
          }
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
      ctx.shadowBlur = 0;

      // Draw Player (Data Packet)
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
      ctx.shadowBlur = 0;

      // Full Screen Glitch Effect
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
    };

    const loop = () => {
      if (gameState === 'PLAYING') {
        update();
        draw();
        animationFrameId = requestAnimationFrame(loop);
      } else if (gameState === 'PAUSED') {
        draw(); // Keep drawing the static frame
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    const resize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    animationFrameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [gameState, highScore]);

  return (
    <div 
      className="relative w-full h-screen bg-[#02040a] overflow-hidden font-sans text-white select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8 pointer-events-none flex items-center gap-4 md:gap-6">
        <div className="flex flex-col">
          <span className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-cyan-400 opacity-50 font-mono mb-1">Packet Stream</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-5xl font-black tracking-tighter tabular-nums">{score}</span>
            <span className="text-[10px] md:text-xs font-bold text-cyan-400/50 uppercase tracking-widest">Lv.{gameRef.current.level}</span>
          </div>
        </div>
        {hasShield && (
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            className="bg-cyan-500/20 border border-cyan-500 p-1.5 md:p-2 rounded-lg text-cyan-400 flex items-center gap-1.5 md:gap-2"
          >
            <Shield size={16} className="md:w-5 md:h-5" />
            <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest">RentGen VPN Active</span>
          </motion.div>
        )}
      </div>

      <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center gap-4 md:gap-8">
        <div className="pointer-events-none text-right">
          <span className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-cyan-500 opacity-50 font-mono mb-1">Max Throughput</span>
          <div className="text-xl md:text-2xl font-bold tracking-tighter tabular-nums">{highScore}</div>
        </div>
        
        {gameState === 'PLAYING' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleMute}
              className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button 
              onClick={togglePause}
              className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors"
            >
              <div className="flex gap-1">
                <div className="w-1 h-4 bg-white rounded-full" />
                <div className="w-1 h-4 bg-white rounded-full" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Rerouting Warning */}
      <AnimatePresence>
        {isRerouting && gameState === 'PLAYING' && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 bg-cyan-600/20 border border-cyan-500 px-4 md:px-6 py-1.5 md:py-2 rounded-full backdrop-blur-md z-20 w-max max-w-[90vw]"
          >
            <div className="flex items-center gap-2 md:gap-3">
              <Activity className="text-cyan-500 animate-pulse w-4 h-4 md:w-[18px] md:h-[18px]" />
              <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.4em] text-cyan-500 truncate">Rerouting Protocol</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Up Notification */}
      <AnimatePresence>
        {showLevelUp && gameState === 'PLAYING' && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 w-full text-center px-4"
          >
            <div className="flex flex-col items-center">
              <div className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">Speed Boost</div>
              <div className="text-[10px] md:text-sm font-mono uppercase tracking-[0.3em] md:tracking-[0.5em] text-white/50 mt-2">Bandwidth Increased</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screens */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-10 p-6"
          >
            <div className="flex flex-col items-center gap-2 mb-8 px-4 text-center">
              <Cpu className="text-cyan-400" size={48} />
              <h1 className="text-4xl md:text-7xl font-georgia tracking-tighter uppercase italic">RentGen Runner</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 max-w-md text-center px-6">
              <div className="p-4 border border-white/10 bg-white/5">
                <div className="text-cyan-400 font-bold mb-1 uppercase text-[10px] tracking-widest">RentGen VPN</div>
                <div className="text-xs text-white/60">Collect nodes for temporary protection</div>
              </div>
              <div className="p-4 border border-white/10 bg-white/5">
                <div className="text-pink-500 font-bold mb-1 uppercase text-[10px] tracking-widest">Rerouting</div>
                <div className="text-xs text-white/60">Wires swap lanes dynamically</div>
              </div>
            </div>
            
            <button
              onClick={resetGame}
              className="group relative flex items-center gap-3 px-16 py-5 bg-white text-black font-bold uppercase tracking-[0.2em] rounded-none hover:bg-cyan-400 transition-all hover:scale-105 active:scale-95"
            >
              <Play size={20} fill="currentColor" />
              Start Game
              <div className="absolute -inset-1 border border-white/20 group-hover:border-cyan-400/50 transition-colors" />
            </button>
            
            <div className="mt-16 text-white/30 font-mono text-[10px] uppercase tracking-[0.2em] flex flex-col md:flex-row gap-8 md:gap-12 items-center">
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">A</kbd>
                  <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded">D</kbd>
                </div>
                <span>Navigate</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="px-4 py-1 bg-white/5 border border-white/10 rounded italic">Swipe or Tap Lanes</div>
                <span>Touch</span>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'PAUSED' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-30"
          >
            <div className="bg-[#0a0a0a] border border-white/10 p-12 flex flex-col items-center gap-8 shadow-2xl shadow-cyan-500/10">
              <div className="flex flex-col items-center gap-2">
                <h2 className="text-4xl font-black tracking-tighter uppercase italic">Link Paused</h2>
                <p className="text-white/40 font-mono text-[10px] uppercase tracking-widest">Data Stream Suspended</p>
              </div>
              
              <button
                onClick={togglePause}
                className="group relative flex items-center gap-3 px-12 py-4 bg-white text-black font-bold uppercase tracking-[0.2em] rounded-none hover:bg-cyan-400 transition-all hover:scale-105 active:scale-95"
              >
                <Play size={20} fill="currentColor" />
                Resume Link
                <div className="absolute -inset-1 border border-white/20 group-hover:border-cyan-400/50 transition-colors" />
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-xl z-20"
          >
            <Activity className="text-red-500 mb-6 animate-pulse" size={64} />
            <h2 className="text-6xl font-black tracking-tighter text-red-500 uppercase italic mb-2">Link Severed</h2>
            <p className="text-red-400/60 font-mono text-xs uppercase tracking-[0.3em] mb-12">Connection Timeout • Packet Loss Detected</p>
            
            <div className="flex gap-16 mb-16">
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Throughput</div>
                <div className="text-5xl font-bold tracking-tighter">{score}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Peak Rate</div>
                <div className="text-5xl font-bold tracking-tighter text-cyan-400">{highScore}</div>
              </div>
            </div>

            <button
              onClick={resetGame}
              className="group relative flex items-center gap-4 px-16 py-5 bg-white text-black font-bold uppercase tracking-[0.2em] rounded-none hover:bg-red-500 hover:text-white transition-all hover:scale-105 active:scale-95"
            >
              <RotateCcw size={20} />
              Reconnect
              <div className="absolute -inset-1 border border-white/20 group-hover:border-red-500/50 transition-colors" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
