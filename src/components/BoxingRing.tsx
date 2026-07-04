"use client";
 
import React, { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { ROSTER_DATA } from "@/constants/roster";
 
interface BoxingRingProps {
  gravity: number;
  selectedCharacterId: string;
  selectedWeaponId: string;
  livelinessCallback: (count: number) => void;
  onResetRef: React.MutableRefObject<(() => void) | null>;
  muted: boolean;
  mode: "sandbox" | "pvp";
  p1CharacterId: string;
  p1WeaponId: string;
  p2CharacterId: string;
  p2WeaponId: string;
  onStartDuelRef: React.MutableRefObject<(() => void) | null>;
  isReelMode?: boolean;
  onPvpStateChange?: (
    p1: { hp: number; maxHp: number; character: any; ghostHp: number; flash: boolean } | null,
    p2: { hp: number; maxHp: number; character: any; ghostHp: number; flash: boolean } | null
  ) => void;
  onFightersChange?: (
    fighters: Array<{ id: string; charId: string; name: string; hp: number; maxHp: number }>
  ) => void;
}
 
interface HitSplash {
  x: number;
  y: number;
  text: string;
  color: string;
  createdAt: number;
  lifeTime: number;
}
 
interface TrailParticle {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  decay: number;
}
 
interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
  decay: number;
}
 
// 16x16 Pixel grids for dynamic sprite generation
const mrbeastGrid = [
  "....BBBBBBBB....",
  "...BBBBBBBBBB...",
  "..BWWBBBBWWB....",
  "..BKKBBBBKKB....",
  "..SSSSSSSSSS....",
  "..SSDDSSSSDDSS..",
  "..SSSSSSSSSS....",
  "..SSSDDDDDDSSSS.",
  ".SSSDDDDDDDDSSSS",
  ".SSSDDDDDDDDSSSS",
  ".SSSSSSSSSSSSSS.",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "...GGGGGGGGGG...",
  "....GGGGGGGG....",
  ".....GGGGGG....."
];
 
const ishowspeedGrid = [
  ".....KKKKKK.....",
  "....KKKKKKKK....",
  "...KKKKKKKKKK...",
  "..KKKKKKKKKKKK..",
  "..KSSWSSWSSK..",
  "..KSSKSSKSSK..",
  "..SSSSSSSSSS..",
  "..SSSRRRRSSS..",
  "..SSSRRRRSSS..",
  "..SSSSSSSSSS..",
  ".SSSSSSSSSSSS.",
  "..RRRRRRRRRR..",
  "..RRBRRBRRBR..",
  "..RRBRRBRRBR..",
  "...RRRRRRRR...",
  "....RRRRRR...."
];
 
const lightsaberGrid = [
  "..............GG",
  ".............GWG",
  "............GWG.",
  "...........GWG..",
  "..........GWG...",
  ".........GWG....",
  "........GWG.....",
  ".......GWG......",
  "......GWG.......",
  ".....GWG........",
  "....GWG.........",
  "...HGG..........",
  "..HDH...........",
  ".HDH............",
  "HDH.............",
  "D..............."
];
 
const boxingGloveGrid = [
  "......RRRR......",
  "....RRRRRRRR....",
  "...RRRRRRRRRR...",
  "..RRRRRRRRRRRR..",
  "..RRRRRRRRRRRR..",
  "..RRRDDRRRDRRR..",
  "..RRRDDRRRDRRR..",
  "...RRRRRRRRRR...",
  "....RRRRRRRR....",
  ".....WRRRRW.....",
  ".....WWBWWW.....",
  ".....WWWWWW.....",
  ".....WWWWWW.....",
  "......WWWW......",
  "................",
  "................"
];
 
function generateSpriteDataUrl(grid: string[], colorMap: Record<string, string>): string {
  if (typeof window === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
 
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const char = grid[r]?.[c] || ".";
      if (char !== ".") {
        ctx.fillStyle = colorMap[char] || "transparent";
        ctx.fillRect(c, r, 1, 1);
      }
    }
  }
  return canvas.toDataURL("image/png");
}
 
let audioCtx: AudioContext | null = null;
 
function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}
 
function playHitSound(relativeSpeed: number, muted: boolean) {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
 
  const now = ctx.currentTime;
  
  // Normalize speed factor between 0 (slowest impact) and 1 (fastest impact)
  // Low-speed threshold is 1.8. Let's map from 1.8 to 10.0
  const speedFactor = Math.min(1.0, Math.max(0.0, (relativeSpeed - 1.8) / 8.2));
  
  // 1. Oscillator for core punch thud/snap body
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  // Low-speed: deeper thud (triangle wave, ~100Hz -> 35Hz)
  // High-speed: crisp snap (sawtooth wave, ~550Hz -> 120Hz)
  const startFreq = 100 + speedFactor * 450;
  const endFreq = 35 + speedFactor * 85;
  const duration = 0.12 + (1 - speedFactor) * 0.08; // 0.12s (fast snap) to 0.20s (slow thud)
  
  osc.type = speedFactor > 0.6 ? "sawtooth" : (speedFactor > 0.3 ? "sine" : "triangle");
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
  
  const baseVolume = 0.2 + speedFactor * 0.2; // 0.20 to 0.40
  gain.gain.setValueAtTime(baseVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(now);
  osc.stop(now + duration);
 
  // 2. White noise burst with dynamic bandpass filter
  const noiseDuration = 0.05 + (1 - speedFactor) * 0.05; // shorter crunch at high speed, slightly longer at low speed
  const bufferSize = ctx.sampleRate * noiseDuration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  // Cutoff: 250Hz (muffled thud) to 2500Hz (bright crisp snap)
  noiseFilter.frequency.value = 250 + speedFactor * 2250;
  // Q factor: 1.0 (dull thud) to 7.0 (resonant metallic snap)
  noiseFilter.Q.value = 1.0 + speedFactor * 6.0;
  
  const noiseGain = ctx.createGain();
  const noiseVol = 0.1 + speedFactor * 0.2; // 0.10 to 0.30
  noiseGain.gain.setValueAtTime(noiseVol, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noiseDuration);
  
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  
  noise.start(now);
  noise.stop(now + noiseDuration);
}
 
function playClashSound(relativeSpeed: number, muted: boolean) {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
 
  const now = ctx.currentTime;
  // Normalize speed factor from 1.5 to 10.0
  const speedFactor = Math.min(1.0, Math.max(0.0, (relativeSpeed - 1.5) / 8.5));
  const duration = 0.08 + (1 - speedFactor) * 0.08; // 0.08s (high pitch snap) to 0.16s (deep clash)
 
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
 
  // High speed: bright snap (square/sine at ~1800Hz / ~2400Hz)
  // Low speed: deeper duller thud clash (square/sine at ~450Hz / ~600Hz)
  const baseFreq1 = 450 + speedFactor * 1350;
  const baseFreq2 = 600 + speedFactor * 1800;
  const endFreq1 = 150 + speedFactor * 250;
  const endFreq2 = 200 + speedFactor * 350;
 
  osc1.type = "square";
  osc1.frequency.setValueAtTime(baseFreq1, now);
  osc1.frequency.exponentialRampToValueAtTime(endFreq1, now + duration);
 
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(baseFreq2, now);
  osc2.frequency.exponentialRampToValueAtTime(endFreq2, now + duration);
 
  const vol = 0.1 + speedFactor * 0.15; // 0.10 to 0.25
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
 
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
 
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration);
  osc2.stop(now + duration);
}
 
function playSpawnSound(muted: boolean) {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
 
  const now = ctx.currentTime;
  const duration = 0.18;
 
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
 
  osc.type = "triangle";
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + duration);
 
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.linearRampToValueAtTime(0.01, now + duration);
 
  osc.connect(gain);
  gain.connect(ctx.destination);
 
  osc.start(now);
  osc.stop(now + duration);
}
 
function playKoSound(muted: boolean) {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
 
  const now = ctx.currentTime;
  const noteDuration = 0.15;
 
  const notes = [330, 294, 262, 196];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
 
    osc.type = "sawtooth";
    osc.frequency.value = freq;
 
    const startTime = now + idx * noteDuration;
    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration - 0.02);
 
    osc.connect(gain);
    gain.connect(ctx.destination);
 
    osc.start(startTime);
    osc.stop(startTime + noteDuration);
  });
}
 
export default function BoxingRing({
  gravity,
  selectedCharacterId,
  selectedWeaponId,
  livelinessCallback,
  onResetRef,
  muted,
  mode,
  p1CharacterId,
  p1WeaponId,
  p2CharacterId,
  p2WeaponId,
  onStartDuelRef,
  isReelMode = false,
  onPvpStateChange,
  onFightersChange,
}: BoxingRingProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const splashesRef = useRef<HitSplash[]>([]);
  const trailParticlesRef = useRef<TrailParticle[]>([]);
  const burstParticlesRef = useRef<BurstParticle[]>([]);
 
  // Health states for PvP HUD overlay
  const [p1State, setP1State] = useState<{ hp: number; maxHp: number; character: any } | null>(null);
  const [p2State, setP2State] = useState<{ hp: number; maxHp: number; character: any } | null>(null);
 
  // Time dilation visual overlay state
  const [isTimeDilated, setIsTimeDilated] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const shakeTimeoutRef = useRef<any>(null);
 
  const triggerShake = () => {
    setIsShaking(false);
    if (shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current);
    }
    shakeTimeoutRef.current = setTimeout(() => {
      setIsShaking(true);
      shakeTimeoutRef.current = null;
    }, 30);
  };
 
  const triggerShakeRef = useRef(triggerShake);
  useEffect(() => {
    triggerShakeRef.current = triggerShake;
  }, [triggerShake]);

  // PvP dynamic HUD state hooks
  const [p1GhostHp, setP1GhostHp] = useState<number>(0);
  const [p1Flash, setP1Flash] = useState<boolean>(false);
  const p1PrevHpRef = useRef<number>(0);

  const [p2GhostHp, setP2GhostHp] = useState<number>(0);
  const [p2Flash, setP2Flash] = useState<boolean>(false);
  const p2PrevHpRef = useRef<number>(0);
 
  const characterIdRef = useRef(selectedCharacterId);
  const weaponIdRef = useRef(selectedWeaponId);
  const mutedRef = useRef(muted);
 
  // PvP input tracking refs
  const modeRef = useRef(mode);
  const p1CharacterIdRef = useRef(p1CharacterId);
  const p1WeaponIdRef = useRef(p1WeaponId);
  const p2CharacterIdRef = useRef(p2CharacterId);
  const p2WeaponIdRef = useRef(p2WeaponId);
  const onFightersChangeRef = useRef(onFightersChange);
  const onPvpStateChangeRef = useRef(onPvpStateChange);
 
  // Keep references updated
  useEffect(() => {
    onFightersChangeRef.current = onFightersChange;
  }, [onFightersChange]);

  useEffect(() => {
    onPvpStateChangeRef.current = onPvpStateChange;
  }, [onPvpStateChange]);

  useEffect(() => {
    characterIdRef.current = selectedCharacterId;
  }, [selectedCharacterId]);
 
  useEffect(() => {
    weaponIdRef.current = selectedWeaponId;
  }, [selectedWeaponId]);
 
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
 
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
 
  useEffect(() => {
    p1CharacterIdRef.current = p1CharacterId;
  }, [p1CharacterId]);
 
  useEffect(() => {
    p1WeaponIdRef.current = p1WeaponId;
  }, [p1WeaponId]);
 
  useEffect(() => {
    p2CharacterIdRef.current = p2CharacterId;
  }, [p2CharacterId]);
 
  useEffect(() => {
    p2WeaponIdRef.current = p2WeaponId;
  }, [p2WeaponId]);
 
  // Keep gravity updated
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.gravity.y = gravity;
    }
  }, [gravity]);

  // Synchronize Player 1 dynamic HUD effects
  useEffect(() => {
    if (!p1State) {
      setP1GhostHp(0);
      setP1Flash(false);
      p1PrevHpRef.current = 0;
      return;
    }

    const currentHp = p1State.hp;
    const prevHp = p1PrevHpRef.current;

    // Initialize if it was 0 or just loaded
    if (prevHp === 0) {
      p1PrevHpRef.current = currentHp;
      setP1GhostHp(currentHp);
      return;
    }

    if (currentHp < prevHp) {
      // Trigger flash
      setP1Flash(true);
      const flashTimeout = setTimeout(() => {
        setP1Flash(false);
      }, 100);

      // Trigger ghost hp drain after 500ms
      const ghostTimeout = setTimeout(() => {
        setP1GhostHp(currentHp);
      }, 500);

      p1PrevHpRef.current = currentHp;

      return () => {
        clearTimeout(flashTimeout);
        clearTimeout(ghostTimeout);
      };
    } else if (currentHp > prevHp) {
      // If healed or reset
      setP1GhostHp(currentHp);
      p1PrevHpRef.current = currentHp;
    }
  }, [p1State?.hp]);

  // Synchronize Player 2 dynamic HUD effects
  useEffect(() => {
    if (!p2State) {
      setP2GhostHp(0);
      setP2Flash(false);
      p2PrevHpRef.current = 0;
      return;
    }

    const currentHp = p2State.hp;
    const prevHp = p2PrevHpRef.current;

    // Initialize if it was 0 or just loaded
    if (prevHp === 0) {
      p2PrevHpRef.current = currentHp;
      setP2GhostHp(currentHp);
      return;
    }

    if (currentHp < prevHp) {
      // Trigger flash
      setP2Flash(true);
      const flashTimeout = setTimeout(() => {
        setP2Flash(false);
      }, 100);

      // Trigger ghost hp drain after 500ms
      const ghostTimeout = setTimeout(() => {
        setP2GhostHp(currentHp);
      }, 500);

      p2PrevHpRef.current = currentHp;

      return () => {
        clearTimeout(flashTimeout);
        clearTimeout(ghostTimeout);
      };
    } else if (currentHp > prevHp) {
      // If healed or reset
      setP2GhostHp(currentHp);
      p2PrevHpRef.current = currentHp;
    }
  }, [p2State?.hp]);

  // Synchronize PvP state changes with parent component
  useEffect(() => {
    if (onPvpStateChangeRef.current) {
      onPvpStateChangeRef.current(
        p1State ? { ...p1State, ghostHp: p1GhostHp, flash: p1Flash } : null,
        p2State ? { ...p2State, ghostHp: p2GhostHp, flash: p2Flash } : null
      );
    }
  }, [p1State, p1GhostHp, p1Flash, p2State, p2GhostHp, p2Flash]);

 
  // Dynamic Sprite Asset Preloading
  useEffect(() => {
    const cache: Record<string, HTMLImageElement> = {};
 
    const preloadImage = (id: string, assetPath: string, grid: string[], colorMap: Record<string, string>) => {
      const img = new Image();
      img.onerror = () => {
        img.onerror = null;
        console.warn(`Failed to load asset for ${id} from ${assetPath}, falling back to pixel art.`);
        img.src = generateSpriteDataUrl(grid, colorMap);
      };
      img.src = assetPath;
      cache[id] = img;
    };
 
    const characterMrBeast = ROSTER_DATA.characters.find((c) => c.id === "mrbeast");
    const characterSpeed = ROSTER_DATA.characters.find((c) => c.id === "ishowspeed");
 
    preloadImage("mrbeast", characterMrBeast?.assetPath || "/images/characters/mrbeast.png", mrbeastGrid, {
      B: "#1e40af", S: "#ffdbac", W: "#ffffff", K: "#000000", G: "#16a34a", D: "#5c4033", Y: "#facc15"
    });
 
    preloadImage("ishowspeed", characterSpeed?.assetPath || "/images/characters/ishowspeed.png", ishowspeedGrid, {
      K: "#09090b", S: "#78350f", W: "#ffffff", R: "#dc2626", B: "#000000"
    });
 
    const preloadWeapon = (id: string, grid: string[], colorMap: Record<string, string>) => {
      const img = new Image();
      img.src = generateSpriteDataUrl(grid, colorMap);
      cache[id] = img;
    };
 
    preloadWeapon("lightsaber", lightsaberGrid, {
      H: "#94a3b8", D: "#475569", G: "#22c55e", W: "#ffffff"
    });
 
    preloadWeapon("boxing_glove", boxingGloveGrid, {
      R: "#f43f5e", D: "#9f1239", W: "#ffffff", B: "#000000"
    });
 
    imageCacheRef.current = cache;
  }, []);
 
  useEffect(() => {
    if (!canvasRef.current || !sceneRef.current) return;
 
    const {
      Engine,
      Render,
      Runner,
      Bodies,
      Composite,
      Mouse,
      MouseConstraint,
      Events,
      Body,
    } = Matter;
 
    // 1. Create Engine
    const engine = Engine.create({
      gravity: { x: 0, y: gravity, scale: 0.001 },
    });
    engineRef.current = engine;
 
    const width = 800;
    const height = 600;
 
    const ringSize = 400;
    const ringLeft = width / 2 - ringSize / 2; // 200
    const ringRight = width / 2 + ringSize / 2; // 600
    const ringTop = height / 2 - ringSize / 2; // 100
    const ringBottom = height / 2 + ringSize / 2; // 500
    const borderThickness = 24;

    const activeTimeouts: NodeJS.Timeout[] = [];

    const resetPowerUp = (entityBody: Matter.Body, entity: any) => {
      const prevType = entity.activePowerUp;
      if (!prevType) return;

      entity.activePowerUp = null;

      if (prevType === "giant") {
        const weaponPart = entityBody.parts.find((p) => p.label === "weapon");
        if (weaponPart && entity.weaponScale) {
          Matter.Body.scale(weaponPart, 1 / entity.weaponScale, 1 / entity.weaponScale);
        }
        entity.weaponScale = 1.0;
        entity.damageMultiplier = 1.0;
        entity.knockbackMultiplier = 1.0;
      } 
      else if (prevType === "fire") {
        entity.isOnFire = false;
        entity.damageMultiplier = 1.0;
      } 
      else if (prevType === "zerog") {
        entityBody.frictionAir = entity.originalFrictionAir !== undefined ? entity.originalFrictionAir : 0.005;
        entity.initialSpeed = entity.originalSpeed !== undefined ? entity.originalSpeed : 4.5;
        entity.initialAngularVelocity = entity.originalAngular !== undefined ? entity.originalAngular : 0.06;
      }

      // Sync React state for PvP HUD
      if (entity.isPlayer1) {
        setP1State((prev) => prev ? { ...prev, activePowerUp: null } : null);
      } else if (entity.isPlayer2) {
        setP2State((prev) => prev ? { ...prev, activePowerUp: null } : null);
      }
      
      updateLiveliness();
    };

    const applyPowerUp = (entityBody: Matter.Body, entity: any, type: string) => {
      if (entity.powerUpTimeout) {
        clearTimeout(entity.powerUpTimeout);
      }
      resetPowerUp(entityBody, entity);

      entity.activePowerUp = type;

      if (type === "giant") {
        const weaponPart = entityBody.parts.find((p) => p.label === "weapon");
        if (weaponPart) {
          Matter.Body.scale(weaponPart, 1.8, 1.8);
        }
        entity.weaponScale = 1.8;
        entity.damageMultiplier = 1.5;
        entity.knockbackMultiplier = 1.6;
      } 
      else if (type === "fire") {
        entity.isOnFire = true;
        entity.damageMultiplier = 1.8;
      } 
      else if (type === "zerog") {
        entity.originalFrictionAir = entityBody.frictionAir;
        entity.originalSpeed = entity.initialSpeed;
        entity.originalAngular = entity.initialAngularVelocity;

        entityBody.frictionAir = 0.0001;
        entity.initialSpeed = 7.5;
        entity.initialAngularVelocity = entity.initialAngularVelocity * 2.0;
      }

      // Sync React state for PvP HUD
      if (entity.isPlayer1) {
        setP1State((prev) => prev ? { ...prev, activePowerUp: type } : null);
      } else if (entity.isPlayer2) {
        setP2State((prev) => prev ? { ...prev, activePowerUp: type } : null);
      }

      const timeoutId = setTimeout(() => {
        resetPowerUp(entityBody, entity);
      }, 6000);
      entity.powerUpTimeout = timeoutId;
      activeTimeouts.push(timeoutId);

      updateLiveliness();
    };

    const collectCrate = (entityBody: Matter.Body, entity: any, type: string, crateBody: Matter.Body) => {
      Composite.remove(engine.world, crateBody);
      playSpawnSound(mutedRef.current);

      // Spawn floating splash text
      const textColors: Record<string, string> = {
        giant: "#ffea00",
        fire: "#ef4444",
        zerog: "#00f0ff"
      };
      const textLabels: Record<string, string> = {
        giant: "GIANT WEAPON!",
        fire: "FIRE WEAPON!",
        zerog: "ZERO-G BOOST!"
      };

      splashesRef.current.push({
        x: crateBody.position.x,
        y: crateBody.position.y,
        text: textLabels[type] || "POWER UP!",
        color: textColors[type] || "#ffffff",
        createdAt: Date.now(),
        lifeTime: 850,
      });

      // Sparks burst
      const burstColor = textColors[type] || "#ffffff";
      for (let j = 0; j < 12; j++) {
        const angle = (j / 12) * Math.PI * 2 + Matter.Common.random(-0.2, 0.2);
        const speed = Matter.Common.random(2, 5);
        burstParticlesRef.current.push({
          x: crateBody.position.x,
          y: crateBody.position.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Matter.Common.random(3, 6),
          color: burstColor,
          opacity: 1.0,
          decay: Matter.Common.random(0.02, 0.04),
        });
      }

      applyPowerUp(entityBody, entity, type);
    };

    const spawnCrate = () => {
      const allBodies = Composite.allBodies(engine.world);
      const currentCrates = allBodies.filter((b) => b.label === "weapon_drop").length;
      if (currentCrates >= 2) return;

      const x = Matter.Common.random(width / 2 - 120, width / 2 + 120);
      const y = ringTop + 20;
      
      const crate = Bodies.rectangle(x, y, 22, 22, {
        label: "weapon_drop",
        restitution: 0.4,
        friction: 0.1,
        frictionAir: 0.01,
        density: 0.0005,
        render: { visible: false }
      });

      crate.plugin = {
        crate: {
          type: Matter.Common.choose(["giant", "fire", "zerog"]),
          createdAt: Date.now()
        }
      };

      Matter.Body.setVelocity(crate, { x: Matter.Common.random(-1, 1), y: 1.5 });
      Composite.add(engine.world, crate);
    };
 
    // 2. Create Renderer
    const render = Render.create({
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width: width,
        height: height,
        background: "transparent",
        wireframes: false,
        showVelocity: false,
        showAngleIndicator: false,
      },
    });
 
    Render.run(render);
 
    // 3. Create Runner
    const runner = Runner.create();
    Runner.run(runner, engine);
 
    // 4. Create Boxing Ring Boundaries
    const wallOptions: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      restitution: 0.8, // high elasticity
      friction: 0.0,    // zero friction
      frictionStatic: 0.0,
      label: "ring_wall",
      render: { visible: false },
    };
 
    const topWall = Bodies.rectangle(width / 2, ringTop - borderThickness / 2, ringSize, borderThickness, wallOptions);
    const bottomWall = Bodies.rectangle(width / 2, ringBottom + borderThickness / 2, ringSize, borderThickness, wallOptions);
    const leftWall = Bodies.rectangle(ringLeft - borderThickness / 2, height / 2, borderThickness, ringSize, wallOptions);
    const rightWall = Bodies.rectangle(ringRight + borderThickness / 2, height / 2, borderThickness, ringSize, wallOptions);
 
    Composite.add(engine.world, [topWall, bottomWall, leftWall, rightWall]);
 
    // 5. Add Mouse Drag Constraint
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.15,
        render: {
          visible: true,
          lineWidth: 2,
          strokeStyle: "rgba(0, 255, 242, 0.5)",
        },
      },
    });
 
    Composite.add(engine.world, mouseConstraint);
    render.mouse = mouse;
 
    // Core Spawn Entity Function
    // Core Spawn Entity Function (creates a compound body with circular YouTuber and custom shaped weapon)
    const spawnEntity = (characterId: string, weaponId: string, x: number, y: number) => {
      const character = ROSTER_DATA.characters.find((c) => c.id === characterId);
      const weapon = ROSTER_DATA.weapons.find((w) => w.id === weaponId);
 
      if (!character || !weapon) return;
 
      const radius = character.size / 2;
 
      // Create main character circle (set rendering invisible, we render pixel art in afterRender hook)
      const mainCircle = Bodies.circle(x, y, radius, {
        label: "character",
        render: { visible: false },
      });
 
      // Calculate relative coordinates and orientation of weapon colliders
      const r = radius;
      const cxLocal = (1.9 * r - 2) * Math.SQRT1_2;
      const cyLocal = (1.9 * r - 2) * Math.SQRT1_2;
 
      let weaponPart: Matter.Body;
 
      // Scaled up weapon colliders for much more responsive and satisfying hits
      if (weaponId === "lightsaber") {
        const wepLength = 4.2 * r * Math.SQRT1_2; // Increased length factor
        const wepThickness = Math.max(12, 0.4 * r); // Increased thickness
        weaponPart = Bodies.rectangle(x + cxLocal, y + cyLocal, wepLength, wepThickness, {
          label: "weapon",
          angle: 0,
          render: { visible: false },
        });
      } else {
        // Boxing Glove
        const wepLength = 2.2 * r; // Increased length factor
        const wepThickness = Math.max(16, 0.6 * r); // Increased thickness
        weaponPart = Bodies.rectangle(x + cxLocal, y + cyLocal, wepLength, wepThickness, {
          label: "weapon",
          angle: -Math.PI / 4,
          render: { visible: false },
        });
      }
 
      // Options for the parent compound body
      const bodyOptions: Matter.IChamferableBodyDefinition = {
        restitution: 0.8,
        friction: 0.0,
        frictionAir: 0.005,
        density: 0.001 * character.mass,
        label: "entity",
      };
 
      // Combine parts into compound body
      const compoundBody = Body.create({
        parts: [mainCircle, weaponPart],
        ...bodyOptions,
      });
 
      // Manually set circleRadius so the original render loop doesn't shrink the character sprites
      (compoundBody as any).circleRadius = radius;
 
      // Attach dynamic combat and config properties to the parent compound body
      const initialAngularVelocity = Matter.Common.random(0.04, 0.08) * (Math.random() > 0.5 ? 1 : -1);
      const initialSpeed = Matter.Common.random(3.5, 5.5);
       compoundBody.plugin = {
        entity: {
          character,
          weapon,
          currentHp: character.baseHp,
          maxHp: character.baseHp,
          lastHitTime: 0,
          isKo: false,
          initialAngularVelocity,
          initialSpeed,
          activePowerUp: null,
          weaponScale: 1.0,
          isOnFire: false,
          damageMultiplier: 1.0,
          knockbackMultiplier: 1.0,
        },
      };
 
      const spawnAngle = Matter.Common.random(0, Math.PI * 2);
      Matter.Body.setVelocity(compoundBody, {
        x: Math.cos(spawnAngle) * initialSpeed,
        y: Math.sin(spawnAngle) * initialSpeed,
      });
 
      Matter.Body.setAngularVelocity(compoundBody, initialAngularVelocity);
 
      Composite.add(engine.world, compoundBody);
      playSpawnSound(mutedRef.current);
      updateLiveliness();
    };
 
    // Canvas click spawn handler
    Events.on(mouseConstraint, "mousedown", (event: any) => {
      const mousePosition = event.mouse.position;
 
      const clickedInsideCanvas =
        mousePosition.x >= 0 &&
        mousePosition.x <= width &&
        mousePosition.y >= 0 &&
        mousePosition.y <= height;
 
      if (clickedInsideCanvas && !mouseConstraint.body) {
        // Only spawn in sandbox mode
        if (modeRef.current === "sandbox") {
          spawnEntity(characterIdRef.current, weaponIdRef.current, mousePosition.x, mousePosition.y);
        }
      }
    });
 
    // Continuous Rotation Enforcer Loop
    Events.on(engine, "beforeUpdate", () => {
      // Continuous Rotation Enforcer Loop
      const allBodies = Composite.allBodies(engine.world);
      allBodies.forEach((body) => {
        if (body.label !== "entity") return;
        const entityData = body.plugin?.entity;
        if (!entityData || entityData.isKo) return;
 
        const targetW = entityData.initialAngularVelocity || 0.05;
        const currentW = body.angularVelocity;
 
        const targetMag = Math.abs(targetW);
        const currentMag = Math.abs(currentW);
 
        // Gradually decay high spin rates back to target, and prevent dropping below the target spin rate
        if (currentMag > targetMag) {
          const newMag = currentMag - (currentMag - targetMag) * 0.015;
          const sign = Math.sign(currentW) || Math.sign(targetW) || 1;
          Matter.Body.setAngularVelocity(body, sign * newMag);
        } else if (currentMag < targetMag) {
          const sign = Math.sign(currentW) || Math.sign(targetW) || 1;
          Matter.Body.setAngularVelocity(body, sign * targetMag);
        }
 
        // Continuous Linear Velocity Regulation (Simulation Speed)
        const targetSpeed = entityData.initialSpeed || 4.5;
        const currentVelocity = body.velocity;
        const currentSpeed = Matter.Vector.magnitude(currentVelocity);
 
        if (currentSpeed > targetSpeed) {
          // Decay high velocities (e.g. from knockback) gradually back to target speed
          const newSpeed = currentSpeed - (currentSpeed - targetSpeed) * 0.015;
          if (currentSpeed > 0.01) {
            Matter.Body.setVelocity(body, {
              x: (currentVelocity.x / currentSpeed) * newSpeed,
              y: (currentVelocity.y / currentSpeed) * newSpeed,
            });
          }
        } else if (currentSpeed < targetSpeed) {
          // Enforce minimum speed to keep the entity moving in the simulation
          if (currentSpeed > 0.1) {
            Matter.Body.setVelocity(body, {
              x: (currentVelocity.x / currentSpeed) * targetSpeed,
              y: (currentVelocity.y / currentSpeed) * targetSpeed,
            });
          } else {
            // Choose a random direction if it gets stuck or stops completely
            const randAngle = Matter.Common.random(0, Math.PI * 2);
            Matter.Body.setVelocity(body, {
              x: Math.cos(randAngle) * targetSpeed,
              y: Math.sin(randAngle) * targetSpeed,
            });
          }
        }
      });
    });
 
    const updateLiveliness = () => {
      const allBodies = Composite.allBodies(engine.world);
      const active = allBodies.filter((b) => b.label === "entity" && !b.plugin.entity.isKo);
      livelinessCallback(active.length);
      
      if (onFightersChangeRef.current) {
        const fighters = active.map((b) => ({
          id: b.id.toString(),
          charId: b.plugin.entity.character.id,
          name: b.plugin.entity.character.name,
          hp: b.plugin.entity.currentHp,
          maxHp: b.plugin.entity.maxHp,
        }));
        onFightersChangeRef.current(fighters);
      }
    };
 
    // Reset handler
    onResetRef.current = () => {
      lastTimeDilationTime = 0;
      isDilationActive = false;
      activeTimeouts.forEach(clearTimeout);
      activeTimeouts.length = 0;

      const allBodies = Composite.allBodies(engine.world);
      const toRemove = allBodies.filter((b) => b.label === "entity" || b.label === "weapon_drop");
      toRemove.forEach((b) => {
        if (b.plugin?.entity?.powerUpTimeout) {
          clearTimeout(b.plugin.entity.powerUpTimeout);
        }
        Composite.remove(engine.world, b);
      });
      splashesRef.current = [];
      trailParticlesRef.current = [];
      burstParticlesRef.current = [];
      setP1State(null);
      setP2State(null);
      livelinessCallback(0);
      if (onFightersChangeRef.current) {
        onFightersChangeRef.current([]);
      }
    };
 
    // PvP Duel Spawner
    const spawnDuel = () => {
      lastTimeDilationTime = 0;
      isDilationActive = false;
      activeTimeouts.forEach(clearTimeout);
      activeTimeouts.length = 0;

      // Clear arena first
      const allBodies = Composite.allBodies(engine.world);
      const toRemove = allBodies.filter((b) => b.label === "entity" || b.label === "weapon_drop");
      toRemove.forEach((b) => {
        if (b.plugin?.entity?.powerUpTimeout) {
          clearTimeout(b.plugin.entity.powerUpTimeout);
        }
        Composite.remove(engine.world, b);
      });
      splashesRef.current = [];
      trailParticlesRef.current = [];
      burstParticlesRef.current = [];
 
      // Retrieve selections
      const char1 = ROSTER_DATA.characters.find((c) => c.id === p1CharacterIdRef.current) || ROSTER_DATA.characters[0];
      const wep1 = ROSTER_DATA.weapons.find((w) => w.id === p1WeaponIdRef.current) || ROSTER_DATA.weapons[0];
      const char2 = ROSTER_DATA.characters.find((c) => c.id === p2CharacterIdRef.current) || ROSTER_DATA.characters[1];
      const wep2 = ROSTER_DATA.weapons.find((w) => w.id === p2WeaponIdRef.current) || ROSTER_DATA.weapons[1];
 
      // Set React state for HUD
      setP1State({ hp: char1.baseHp, maxHp: char1.baseHp, character: char1 });
      setP2State({ hp: char2.baseHp, maxHp: char2.baseHp, character: char2 });
 
      // Helper to spawn a duelist
      const createDuelist = (char: any, wep: any, spawnX: number, spawnY: number, isP1: boolean) => {
        const radius = char.size / 2;
 
        const mainCircle = Bodies.circle(spawnX, spawnY, radius, {
          label: "character",
          render: { visible: false },
        });
 
        const r = radius;
        const cxLocal = (1.9 * r - 2) * Math.SQRT1_2;
        const cyLocal = (1.9 * r - 2) * Math.SQRT1_2;
 
        let weaponPart: Matter.Body;
 
        if (wep.id === "lightsaber") {
          const wepLength = 4.2 * r * Math.SQRT1_2;
          const wepThickness = Math.max(12, 0.4 * r);
          // Mirror weapon direction for P2
          weaponPart = Bodies.rectangle(spawnX + (isP1 ? cxLocal : -cxLocal), spawnY + cyLocal, wepLength, wepThickness, {
            label: "weapon",
            angle: isP1 ? 0 : Math.PI,
            render: { visible: false },
          });
        } else {
          const wepLength = 2.2 * r;
          const wepThickness = Math.max(16, 0.6 * r);
          // Mirror weapon direction for P2
          weaponPart = Bodies.rectangle(spawnX + (isP1 ? cxLocal : -cxLocal), spawnY + cyLocal, wepLength, wepThickness, {
            label: "weapon",
            angle: isP1 ? -Math.PI / 4 : -3 * Math.PI / 4,
            render: { visible: false },
          });
        }
 
        const bodyOptions: Matter.IChamferableBodyDefinition = {
          restitution: 0.8,
          friction: 0.0,
          frictionAir: 0.005,
          density: 0.001 * char.mass,
          label: "entity",
        };
 
        const compoundBody = Body.create({
          parts: [mainCircle, weaponPart],
          ...bodyOptions,
        });
 
        (compoundBody as any).circleRadius = radius;
 
        const initialAngularVelocity = Matter.Common.random(0.04, 0.08) * (isP1 ? 1 : -1);
        const initialSpeed = Matter.Common.random(3.5, 5.5);
 
        compoundBody.plugin = {
          entity: {
            character: char,
            weapon: wep,
            currentHp: char.baseHp,
            maxHp: char.baseHp,
            lastHitTime: 0,
            isKo: false,
            initialAngularVelocity,
            initialSpeed,
            isPlayer1: isP1,
            isPlayer2: !isP1,
            activePowerUp: null,
            weaponScale: 1.0,
            isOnFire: false,
            damageMultiplier: 1.0,
            knockbackMultiplier: 1.0,
          },
        };
 
        // Velocity directed toward each other
        Matter.Body.setVelocity(compoundBody, {
          x: isP1 ? initialSpeed : -initialSpeed,
          y: Matter.Common.random(-1, 1),
        });
 
        Matter.Body.setAngularVelocity(compoundBody, initialAngularVelocity);
        Composite.add(engine.world, compoundBody);
      };
 
      // Spawn left (P1) and right (P2) duelist
      createDuelist(char1, wep1, width / 2 - 120, height / 2, true);
      createDuelist(char2, wep2, width / 2 + 120, height / 2, false);
 
      playSpawnSound(mutedRef.current);
      updateLiveliness();
    };
 
    onStartDuelRef.current = spawnDuel;
 
    // Time Dilation variables
    let lastTimeDilationTime = 0;
    let isDilationActive = false;
 
    // Continuous Time-Dilation Tracker Hook
    Events.on(engine, "beforeUpdate", () => {
      const now = Date.now();
      const allBodies = Composite.allBodies(engine.world);
      
      // Cooldown limit: trigger once every 3 seconds max to prevent frame-spamming
      if (!isDilationActive && now - lastTimeDilationTime > 3000) {
        let shouldDilate = false;
        const entities = allBodies.filter((b) => b.label === "entity");
 
        for (let i = 0; i < entities.length; i++) {
          const entityA = entities[i];
          const dataA = entityA.plugin?.entity;
          if (!dataA || dataA.isKo) continue;
 
          const hpPercentA = dataA.currentHp / dataA.maxHp;
          if (hpPercentA < 0.15) {
            // Locate circular character body part
            const charPartA = entityA.parts.find((p) => p.label === "character") || entityA;
 
            // Scan for opposing weapon colliders
            for (let j = 0; j < entities.length; j++) {
              if (i === j) continue;
              const entityB = entities[j];
              const dataB = entityB.plugin?.entity;
              if (!dataB || dataB.isKo) continue;
 
              const weaponPartB = entityB.parts.find((p) => p.label === "weapon");
              if (!weaponPartB) continue;
 
              const distVector = Matter.Vector.sub(charPartA.position, weaponPartB.position);
              const dist = Matter.Vector.magnitude(distVector);
 
              // Within 70 pixels proximity (widened for consistency)
              if (dist < 70) {
                shouldDilate = true;
                break;
              }
            }
          }
          if (shouldDilate) break;
        }
 
        if (shouldDilate) {
          isDilationActive = true;
          lastTimeDilationTime = now;
          engine.timing.timeScale = 0.3;
          setIsTimeDilated(true);
          console.log("TIME DILATION TRIGGERED (Slow-mo 0.3x)!");
 
          setTimeout(() => {
            engine.timing.timeScale = 1.0;
            isDilationActive = false;
            setIsTimeDilated(false);
            console.log("TIME DILATION ENDED.");
          }, 300);
        }
      }
    });
 
    // 6. Collision Combat Handler
    Events.on(engine, "collisionStart", (event) => {
      const pairs = event.pairs;
      const now = Date.now();
 
      pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
 
        // Retrieve top-level parent compound bodies
        const parentA = bodyA.parent;
        const parentB = bodyB.parent;

        // Check for weapon crate collection
        const checkCrate = (bodyX: Matter.Body, bodyY: Matter.Body) => {
          if (bodyX.parent && bodyX.parent.label === "entity" && bodyY.label === "weapon_drop") {
            const entity = bodyX.parent.plugin?.entity;
            const crateData = bodyY.plugin?.crate;
            if (entity && !entity.isKo && crateData) {
              collectCrate(bodyX.parent, entity, crateData.type, bodyY);
            }
          }
        };
        checkCrate(bodyA, bodyB);
        checkCrate(bodyB, bodyA);
 
        if (parentA.label === "entity" && parentB.label === "entity") {
          const entityA = parentA.plugin?.entity;
          const entityB = parentB.plugin?.entity;
 
          if (!entityA || !entityB || entityA.isKo || entityB.isKo) return;
 
          // Calculate relative speed of the collision based on parent velocities
          const relativeVelocity = Matter.Vector.sub(parentA.velocity, parentB.velocity);
          const relativeSpeed = Matter.Vector.magnitude(relativeVelocity);
 
          // Get contact position for spawning clashing/hit particles
          const contact = pair.contacts[0];
          const contactX = contact ? contact.vertex.x : (bodyA.position.x + bodyB.position.x) / 2;
          const contactY = contact ? contact.vertex.y : (bodyA.position.y + bodyB.position.y) / 2;
 
          // Helper to register character damage, knockback and visual effects
          const registerHit = (
            attackerParent: Matter.Body,
            victimParent: Matter.Body,
            attackerEntity: any,
            victimEntity: any
          ) => {
            // Invincibility check (400ms)
            if (now - victimEntity.lastHitTime < 400) return;

            // Trigger screen shake on hits
            if (triggerShakeRef.current) {
              triggerShakeRef.current();
            }
 
            // Play Hit audio
            playHitSound(relativeSpeed, mutedRef.current);
 
            // Apply damage (multiplied if powerup is active)
            const damage = attackerEntity.weapon.damage * (attackerEntity.damageMultiplier || 1.0);
            victimEntity.currentHp = Math.max(0, victimEntity.currentHp - Math.round(damage));
            victimEntity.lastHitTime = now;
 
            // Sync with React state for PvP HUD
            if (modeRef.current === "pvp") {
              if (victimEntity.isPlayer1) {
                setP1State(prev => prev ? { ...prev, hp: victimEntity.currentHp } : null);
              } else if (victimEntity.isPlayer2) {
                setP2State(prev => prev ? { ...prev, hp: victimEntity.currentHp } : null);
              }
            }
 
            console.log(`Weapon hit: ${attackerEntity.character.name} -> ${victimEntity.character.name}, damage ${Math.round(damage)}`);
 
            // Apply weapon-based knockback force to victim parent body
            const vectorSub = Matter.Vector.sub(victimParent.position, attackerParent.position);
            const distance = Matter.Vector.magnitude(vectorSub) || 1;
            const collisionNormal = { x: vectorSub.x / distance, y: vectorSub.y / distance };
            const kbForce = 0.035 * attackerEntity.weapon.knockback * (attackerEntity.knockbackMultiplier || 1.0);
 
            Matter.Body.applyForce(victimParent, victimParent.position, {
              x: collisionNormal.x * kbForce * victimParent.mass,
              y: collisionNormal.y * kbForce * victimParent.mass,
            });
 
            // Trigger dramatic slow-motion elimination finish on HP hitting 0
            if (victimEntity.currentHp <= 0) {
              victimEntity.isKo = true;
              
              // Trigger final slow-mo KO finish (0.15x speed)
              engine.timing.timeScale = 0.15;
              isDilationActive = true;
              setIsTimeDilated(true);
              lastTimeDilationTime = Date.now(); // trigger cooldown

              // Apply an extra large knockback force to blast them away in slow-mo
              const finalBlastKb = kbForce * 2.5;
              Matter.Body.applyForce(victimParent, victimParent.position, {
                x: collisionNormal.x * finalBlastKb * victimParent.mass,
                y: collisionNormal.y * finalBlastKb * victimParent.mass,
              });

              // Disable physics collisions on the defeated body so they fly through boundaries
              victimParent.collisionFilter.mask = 0;
              victimParent.parts.forEach((p) => {
                p.collisionFilter.mask = 0;
              });

              playKoSound(mutedRef.current);
              console.log(`${victimEntity.character.name} was eliminated!`);

              // Schedule body removal after the slow-mo finish ends
              const koTimeout = setTimeout(() => {
                Composite.remove(engine.world, victimParent);
                engine.timing.timeScale = 1.0;
                isDilationActive = false;
                setIsTimeDilated(false);
              }, 1200);
              activeTimeouts.push(koTimeout);
            }
 
            // Spawn floating text
            const combatTexts = ["HIT!", "POW!", "SMASH!", "WHACK!", "BOOM!"];
            splashesRef.current.push({
              x: contactX,
              y: contactY,
              text: combatTexts[Math.floor(Math.random() * combatTexts.length)],
              color: Math.random() > 0.5 ? "#ff0055" : "#00f0ff",
              createdAt: now,
              lifeTime: 700,
            });
 
             // Spawn quick particle burst of 10 small pixel squares flying outward
             const weaponColor = attackerEntity.isOnFire ? "#ef4444" : (attackerEntity.weapon.sparkColor || "#ffea00");
             const victimColor = victimEntity.weapon.sparkColor || "#00f0ff";
             for (let j = 0; j < 10; j++) {
               const angle = (j / 10) * Math.PI * 2 + Matter.Common.random(-0.3, 0.3);
               const speed = Matter.Common.random(2, 6);
               const color = j % 2 === 0 
                 ? weaponColor 
                 : (attackerEntity.isOnFire && Math.random() > 0.5 ? "#f97316" : victimColor);
              burstParticlesRef.current.push({
                x: contactX,
                y: contactY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Matter.Common.random(4, 7),
                color: color,
                opacity: 1.0,
                decay: Matter.Common.random(0.025, 0.05),
              });
            }
 
            updateLiveliness();
          };
 
          // Case 1: Weapon A hits Character B
          if (bodyA.label === "weapon" && bodyB.label === "character") {
            if (relativeSpeed > 1.8) {
              registerHit(parentA, parentB, entityA, entityB);
            }
          }
          // Case 2: Weapon B hits Character A
          else if (bodyB.label === "weapon" && bodyA.label === "character") {
            if (relativeSpeed > 1.8) {
              registerHit(parentB, parentA, entityB, entityA);
            }
          }
          // Case 3: Weapon A hits Weapon B (Clash!)
          else if (bodyA.label === "weapon" && bodyB.label === "weapon") {
            // Check clash cooldown on the engine to prevent duplicate event spam
            const clashKey = `clash_${parentA.id}_${parentB.id}`;
            const lastClashTime = (engine as any)[clashKey] || 0;
 
            if (now - lastClashTime > 300 && relativeSpeed > 1.5) {
              (engine as any)[clashKey] = now;
 
              // Play Clash audio
              playClashSound(relativeSpeed, mutedRef.current);
 
              // Apply small recoil force to both parents to push them back
              const vectorSub = Matter.Vector.sub(parentB.position, parentA.position);
              const distance = Matter.Vector.magnitude(vectorSub) || 1;
              const collisionNormal = { x: vectorSub.x / distance, y: vectorSub.y / distance };
              const recoilForce = 0.005;
 
              Matter.Body.applyForce(parentA, parentA.position, {
                x: -collisionNormal.x * recoilForce * parentA.mass,
                y: -collisionNormal.y * recoilForce * parentA.mass,
              });
 
              Matter.Body.applyForce(parentB, parentB.position, {
                x: collisionNormal.x * recoilForce * parentB.mass,
                y: collisionNormal.y * recoilForce * parentB.mass,
              });
 
              splashesRef.current.push({
                x: contactX,
                y: contactY,
                text: "CLASH!",
                color: "#ffea00",
                createdAt: now,
                lifeTime: 500,
              });
 
              // Sparks burst
              const weaponAColor = entityA.weapon.sparkColor || "#ffea00";
              const weaponBColor = entityB.weapon.sparkColor || "#00f0ff";
              for (let j = 0; j < 8; j++) {
                const angle = (j / 8) * Math.PI * 2 + Matter.Common.random(-0.4, 0.4);
                const speed = Matter.Common.random(3, 7);
                const color = j % 2 === 0 ? weaponAColor : weaponBColor;
                burstParticlesRef.current.push({
                  x: contactX,
                  y: contactY,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  size: Matter.Common.random(3, 6),
                  color: color,
                  opacity: 1.0,
                  decay: Matter.Common.random(0.03, 0.06),
                });
              }
            }
          }
        }
      });
    });
 
    // Spawn initial entities based on mode
    if (modeRef.current === "pvp") {
      spawnDuel();
    } else {
      spawnEntity("mrbeast", "lightsaber", width / 2 - 80, height / 2 - 80);
      spawnEntity("ishowspeed", "boxing_glove", width / 2 + 80, height / 2 - 80);
      spawnEntity("mrbeast", "boxing_glove", width / 2, height / 2 + 60);
    }
 
    // 7. Canvas Custom Drawing (afterRender Hook)
    Events.on(render, "afterRender", () => {
      const ctx = render.context;
      if (!ctx) return;
 
      // Disable image smoothing for pixel-art
      ctx.imageSmoothingEnabled = false;
      // @ts-ignore
      ctx.mozImageSmoothingEnabled = false;
      // @ts-ignore
      ctx.webkitImageSmoothingEnabled = false;
      // @ts-ignore
      ctx.msImageSmoothingEnabled = false;

      // Draw Retro Arcade Scanlines on the background (behind characters and UI)
      ctx.save();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1;
      for (let y = 0; y < render.canvas.height; y += 2) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(render.canvas.width, y);
        ctx.stroke();
      }
      ctx.restore();
 
      // A. DRAW RING FLOOR OVERLAY
      ctx.save();
      ctx.fillStyle = "rgba(10, 10, 22, 0.4)";
      ctx.fillRect(ringLeft, ringTop, ringSize, ringSize);
 
      // Draw Grid Lines
      ctx.strokeStyle = "rgba(0, 255, 242, 0.08)";
      ctx.lineWidth = 2;
      const gridSize = 40;
      for (let x = ringLeft; x <= ringRight; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, ringTop);
        ctx.lineTo(x, ringBottom);
        ctx.stroke();
      }
      for (let y = ringTop; y <= ringBottom; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(ringLeft, y);
        ctx.lineTo(ringRight, y);
        ctx.stroke();
      }
 
      // Draw glowing central "VS" logo
      ctx.font = 'normal 48px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
 
      ctx.shadowColor = "#ff007f";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#ff0055";
      ctx.fillText("VS", width / 2, height / 2);
 
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.fillText("VS", width / 2 - 2, height / 2 - 2);
      ctx.restore();
 
      // B. DRAW ROPES
      ctx.save();
      const ropeSpacing = 6;
      const ropeColors = ["#ff003c", "#ffffff", "#0084ff"];
 
      ropeColors.forEach((color, idx) => {
        const offset = idx * ropeSpacing;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
 
        if (color !== "#ffffff") {
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
        } else {
          ctx.shadowBlur = 0;
        }
 
        ctx.strokeRect(
          ringLeft - offset,
          ringTop - offset,
          ringSize + offset * 2,
          ringSize + offset * 2
        );
      });
      ctx.restore();
 
      // C. DRAW CORNER POSTS
      const drawCornerPost = (px: number, py: number, side: "left" | "right") => {
        ctx.save();
        const postW = 16;
        const postH = 40;
 
        ctx.fillStyle = "#1e1e2e";
        ctx.fillRect(px - postW / 2 - 4, py - postH / 2 + 10, postW + 8, postH - 10);
 
        const gradient = ctx.createLinearGradient(px - postW / 2, py, px + postW / 2, py);
        gradient.addColorStop(0, "#2c2c35");
        gradient.addColorStop(0.3, "#4f4f5a");
        gradient.addColorStop(0.5, "#ffffff");
        gradient.addColorStop(0.7, "#4f4f5a");
        gradient.addColorStop(1, "#111115");
 
        ctx.fillStyle = gradient;
        ctx.fillRect(px - postW / 2, py - postH / 2, postW, postH);
 
        ctx.beginPath();
        const capColor = side === "left" ? "#ff0055" : "#00f0ff";
        ctx.arc(px, py - postH / 2, 7, 0, Math.PI * 2);
        ctx.fillStyle = capColor;
        ctx.shadowColor = capColor;
        ctx.shadowBlur = 12;
        ctx.fill();
 
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#888888";
        ctx.fillRect(px - postW / 2 - 2, py - 10, postW + 4, 3);
        ctx.fillRect(px - postW / 2 - 2, py + 5, postW + 4, 3);
 
        ctx.restore();
      };
 
      drawCornerPost(ringLeft, ringTop, "left");
      drawCornerPost(ringRight, ringTop, "right");
      drawCornerPost(ringLeft, ringBottom, "left");
      drawCornerPost(ringRight, ringBottom, "right");
 
      // Draw Weapon Drop Crates
      const activeBodies = Composite.allBodies(engine.world);
      const allCrates = activeBodies.filter((b) => b.label === "weapon_drop");
      allCrates.forEach((crate) => {
        const { x, y } = crate.position;
        const angle = crate.angle;
        const crateData = crate.plugin?.crate;
        if (!crateData) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Outer Pixel Crate Frame
        ctx.fillStyle = "#161622";
        ctx.fillRect(-12, -12, 24, 24);

        // Core Crate Color depending on type
        const typeColor: Record<string, string> = {
          giant: "#ffea00",
          fire: "#ef4444",
          zerog: "#00f0ff"
        };
        ctx.fillStyle = typeColor[crateData.type] || "#facc15";
        ctx.fillRect(-10, -10, 20, 20);

        // Planks texture
        ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
        ctx.lineWidth = 2;
        ctx.strokeRect(-8, -8, 16, 16);
        ctx.beginPath();
        ctx.moveTo(-8, -8);
        ctx.lineTo(8, 8);
        ctx.stroke();

        // Symbol letter in middle
        ctx.font = 'bold 10px "Press Start 2P", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = typeColor[crateData.type] || "#ffffff";
        ctx.shadowBlur = 8;
        
        const symbol: Record<string, string> = {
          giant: "G",
          fire: "F",
          zerog: "Z"
        };
        ctx.fillText(symbol[crateData.type] || "?", 0, 0);

        ctx.restore();
      });

      // Spawning Trail Particles for fast-moving entities
      activeBodies.forEach((body) => {
        if (body.label !== "entity") return;
        const entityData = body.plugin?.entity;
        if (!entityData || entityData.isKo) return;

        // Spawning Trail Particles for fast-moving entities has been disabled to remove motion blur

        // Spawn weapon-tip fire embers if on fire
        if (entityData.isOnFire && Math.random() > 0.3) {
          const rotationAngle = body.angle;
          const weaponAngleOffset = entityData.isPlayer2 ? (3 * Math.PI / 4) : (Math.PI / 4);
          const finalAngle = rotationAngle + weaponAngleOffset;
          
          const radius = body.circleRadius || 18;
          const weaponLength = radius * 2 * 0.9 * (entityData.weaponScale || 1.0);
          
          const tipX = body.position.x + Math.cos(finalAngle) * (radius + weaponLength * 0.7);
          const tipY = body.position.y + Math.sin(finalAngle) * (radius + weaponLength * 0.7);
          
          for (let k = 0; k < Math.floor(Matter.Common.random(1, 3)); k++) {
            trailParticlesRef.current.push({
              x: tipX + Matter.Common.random(-5, 5),
              y: tipY + Matter.Common.random(-5, 5),
              size: Matter.Common.random(4, 9),
              color: Math.random() > 0.4 ? "#f97316" : (Math.random() > 0.5 ? "#ef4444" : "#eab308"),
              opacity: 0.8,
              decay: Matter.Common.random(0.02, 0.05)
            });
          }
        }
      });
 
      // Update and Draw Trail Particles
      trailParticlesRef.current = trailParticlesRef.current.filter((p) => {
        p.opacity -= p.decay;
        return p.opacity > 0;
      });
 
      trailParticlesRef.current.forEach((p) => {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        // Dynamically shrink the size of the pixel blocks as they decay (based on opacity)
        const currentSize = Math.max(1, p.size * (p.opacity / 0.5));
        ctx.fillRect(p.x - currentSize / 2, p.y - currentSize / 2, currentSize, currentSize);
        ctx.restore();
      });
 
      // Update and Draw Burst Particles
      burstParticlesRef.current = burstParticlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.opacity -= p.decay;
        return p.opacity > 0;
      });
 
      burstParticlesRef.current.forEach((p) => {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.restore();
      });
 
      // D. DRAW DYNAMIC PIXEL SPRITES WITH HP BARS AND KO FADE
      const bodies = Composite.allBodies(engine.world);
      bodies.forEach((body) => {
        if (body.label !== "entity") return;
 
        const { x, y } = body.position;
        const angle = body.angle;
        const entityData = body.plugin?.entity;
        if (!entityData) return;
 
        const { character, weapon, currentHp, maxHp, lastHitTime, isKo } = entityData;
        const radius = body.circleRadius || 18;
        const size = radius * 2;
 
        const now = Date.now();
        const isInvincible = now - lastHitTime < 400;
        // Flickering transparency during invincibility frames
        const flashOn = isInvincible && Math.floor((now - lastHitTime) / 50) % 2 === 0;
 
        ctx.save();
 
        // Render transparency for invincibility flash or KO fading
        if (isKo) {
          ctx.globalAlpha = Math.max(0, 1 - (now - entityData.lastHitTime) / 2000);
        } else if (flashOn) {
          ctx.globalAlpha = 0.35;
        }
 
        const charImg = imageCacheRef.current[character.id];
        if (charImg) {
          ctx.save();
          const drawX = Math.round(body.position.x);
          const drawY = Math.round(body.position.y);
          ctx.translate(drawX, drawY);
          ctx.rotate(angle);
 
          // Draw rotating character sprite (clipped to a perfect circle)
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.clip();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          (ctx as any).mozImageSmoothingEnabled = true;
          (ctx as any).webkitImageSmoothingEnabled = true;
          (ctx as any).msImageSmoothingEnabled = true;
          ctx.drawImage(charImg, -size / 2, -size / 2, size, size);
          ctx.restore();
 
          // Draw a glowing thematic circular border around the character
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
          const themeColor = character.id === "mrbeast" ? "#00f0ff" : "#ef4444";
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 3;
          ctx.shadowColor = themeColor;
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.restore();
 
          // Draw weapon extending from the character
          const wepImg = imageCacheRef.current[weapon.id];
          if (wepImg) {
            ctx.save();
            const weaponAngleOffset = entityData.isPlayer2 ? (3 * Math.PI / 4) : (Math.PI / 4);
            ctx.rotate(weaponAngleOffset); // weapon offset angle
 
            const scale = entityData.weaponScale || 1.0;
            const wepSize = size * 0.9 * scale;
            ctx.drawImage(wepImg, radius - 2, -wepSize / 2, wepSize, wepSize);

            // Draw glowing flame effect overlay if weapon is on fire
            if (entityData.isOnFire) {
              const flameCount = 5;
              const startX = radius - 2;
              
              for (let i = 0; i < flameCount; i++) {
                const t = i / (flameCount - 1);
                const fx = startX + t * wepSize * 0.95;
                
                const timeFactor = Date.now() * 0.02 + i * 1.5;
                const flickerY = Math.sin(timeFactor) * 3;
                const flickerSize = Math.max(4, (Math.sin(Date.now() * 0.015 + i * 2.2) + 1.0) * 3.5 + 2);
                
                ctx.save();
                
                // Outer glowing orange flame tongue
                ctx.shadowColor = "#ef4444";
                ctx.shadowBlur = 8;
                ctx.fillStyle = "#f97316";
                ctx.fillRect(fx - flickerSize / 2, flickerY - flickerSize / 2, flickerSize, flickerSize);
                
                // Mid yellow flame tongue
                ctx.shadowBlur = 0;
                const midSize = flickerSize * 0.65;
                ctx.fillStyle = "#eab308";
                ctx.fillRect(fx - midSize / 2, flickerY - midSize / 2, midSize, midSize);
                
                // Hot white inner core
                const coreSize = flickerSize * 0.3;
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(fx - coreSize / 2, flickerY - coreSize / 2, coreSize, coreSize);
                
                ctx.restore();
              }
            }
            ctx.restore();
          }
 
          // Render KO dizzy icon if knocked out
          if (isKo) {
            ctx.font = 'normal 12px "Press Start 2P", monospace';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#ffea00";
            ctx.fillText("💫", 0, -radius * 0.5);
          }
 
          ctx.restore();
        }
 
        // Draw Health bar & name tag above character (does not rotate, only in sandbox mode)
        if (!isKo && modeRef.current === "sandbox") {
          ctx.save();
          ctx.translate(x, y);
 
          const barW = size * 1.1;
          const barH = 5;
          const barX = -barW / 2;
          const barY = -radius - 12;
 
          // Health bar bg
          ctx.fillStyle = "#27272a";
          ctx.fillRect(barX, barY, barW, barH);
 
          // HP value fill
          const hpPercent = Math.max(0, currentHp / maxHp);
          ctx.fillStyle = hpPercent > 0.45 ? "#22c55e" : hpPercent > 0.2 ? "#eab308" : "#ef4444";
          ctx.fillRect(barX, barY, barW * hpPercent, barH);
 
          // HP border
          ctx.strokeStyle = "#09090b";
          ctx.lineWidth = 1;
          ctx.strokeRect(barX, barY, barW, barH);
 
           // Name Tag text
           ctx.font = 'normal 7px "Press Start 2P", monospace';
           ctx.textAlign = "center";
           ctx.fillStyle = "#f4f4f5";
           const suffix = entityData.activePowerUp ? ` [${entityData.activePowerUp.toUpperCase()}]` : "";
           ctx.fillText(character.name + suffix, 0, barY - 5);
 
          ctx.restore();
        }
 
        ctx.restore();
      });
 
      // E. DRAW FLOATING ARCADE SPLASH TEXTS
      const nowMs = Date.now();
      splashesRef.current = splashesRef.current.filter((s) => nowMs - s.createdAt < s.lifeTime);
 
      splashesRef.current.forEach((s) => {
        const elapsed = nowMs - s.createdAt;
        const progress = elapsed / s.lifeTime;
 
        ctx.save();
        ctx.translate(s.x, s.y - progress * 24); // float text up
 
        ctx.font = 'normal 13.5px "Press Start 2P", monospace';
        ctx.textAlign = "center";
 
        // Neon floating text outline/shadow
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = s.color;
        ctx.fillText(s.text, 0, 0);
 
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(s.text, -1, -1);
        ctx.restore();
      });
 
      updateLiveliness();
    });
 
    // Spawn drop crate loop (every 8 seconds)
    const spawnIntervalId = setInterval(() => {
      spawnCrate();
    }, 8000);

    return () => {
      clearInterval(spawnIntervalId);
      activeTimeouts.forEach(clearTimeout);
      Render.stop(render);
      Runner.stop(runner);
      Engine.clear(engine);
    };
  }, []);
 
  return (
    <div
      ref={sceneRef}
      onAnimationEnd={() => setIsShaking(false)}
      className={`relative flex items-center justify-center overflow-hidden rounded-xl border-4 border-zinc-800 bg-[#07070f] p-1 shadow-[0_0_30px_rgba(0,0,0,0.8)] ${
        isReelMode ? "w-full aspect-square max-w-full" : "w-[610px] md:w-[810px] max-w-full"
      } ${isShaking ? "animate-shake" : ""}`}
      style={{ imageRendering: "pixelated" }}
    >
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-radial-gradient-vibe opacity-20" />
 
      {/* Time Dilation Vignette */}
      {isTimeDilated && (
        <div 
          className="pointer-events-none absolute inset-0 z-30 animate-pulse transition-all duration-200" 
          style={{ boxShadow: "inset 0 0 60px rgba(234, 179, 8, 0.5)" }}
        />
      )}
 
      {/* Retro Arcade HUD Overlay at the top */}
      {mode === "pvp" && p1State && p2State && !isReelMode && (
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none select-none font-pixel w-[calc(100%-2rem)]">
          {/* PLAYER 1 (LEFT) */}
          <div className="flex items-center gap-3 flex-1 max-w-[42%] bg-black/60 backdrop-blur-md border-2 border-zinc-800 p-2 rounded-lg shadow-2xl">
            {/* Avatar Plate */}
            <div className={`relative w-10 h-10 md:w-12 md:h-12 bg-zinc-950 border-2 rounded overflow-hidden flex-shrink-0 flex items-center justify-center transition-all duration-300 ${
              (p1State.hp / p1State.maxHp) < 0.25
                ? "border-red-500 animate-critical-glow"
                : "border-cyan-500 shadow-[0_0_8px_rgba(0,240,255,0.4)]"
            }`}>
              {p1State.character && imageCacheRef.current[p1State.character.id] ? (
                <img
                  src={imageCacheRef.current[p1State.character.id]?.src}
                  alt={p1State.character.name}
                  className="w-full h-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <span className="text-xs">🔵</span>
              )}
              {/* P1 Badge */}
              <span className="absolute bottom-0 right-0 bg-cyan-500 text-black text-[6px] font-bold px-0.5 rounded-tl font-sans">
                P1
              </span>
            </div>
            
            {/* Name & Health Bar */}
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex justify-between items-baseline">
                <span className="text-[8px] md:text-[9px] text-cyan-400 font-bold uppercase tracking-wider">
                  {p1State.character.name}
                </span>
                <span className="text-[7px] md:text-[8px] text-zinc-400 font-bold">
                  {Math.round((p1State.hp / p1State.maxHp) * 100)}%
                </span>
              </div>
              {/* Health Bar Outer */}
              <div className={`h-3 md:h-3.5 bg-red-950 border-2 rounded overflow-hidden relative shadow-inner transition-all duration-300 ${
                (p1State.hp / p1State.maxHp) < 0.25
                  ? "border-red-500 animate-critical-glow"
                  : "border-zinc-950"
              }`}>
                {/* Ghost damage bar (Behind main bar) */}
                <div
                  className="h-full bg-red-600 absolute left-0 top-0 transition-all duration-500 ease-out"
                  style={{ width: `${(p1GhostHp / p1State.maxHp) * 100}%` }}
                />
                {/* Health Fill (Yellow to Red Gradient) */}
                <div
                  className="h-full bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-400 absolute left-0 top-0 transition-all duration-75 ease-out z-10"
                  style={{ width: `${(p1State.hp / p1State.maxHp) * 100}%` }}
                />
                {/* White Impact Flash Overlay */}
                {p1Flash && (
                  <div className="absolute inset-0 bg-white z-20" />
                )}
              </div>
            </div>
          </div>

          {/* VS CENTER PLATE */}
          <div className="px-3.5 py-1.5 bg-[#161622]/90 border-2 border-zinc-800 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.65)] mx-2">
            <span className="text-xs font-bold neon-text-pink animate-pulse">VS</span>
          </div>

          {/* PLAYER 2 (RIGHT) */}
          <div className="flex items-center gap-3 flex-1 max-w-[42%] flex-row-reverse bg-black/60 backdrop-blur-md border-2 border-zinc-800 p-2 rounded-lg shadow-2xl">
            {/* Avatar Plate */}
            <div className={`relative w-10 h-10 md:w-12 md:h-12 bg-zinc-950 border-2 rounded overflow-hidden flex-shrink-0 flex items-center justify-center transition-all duration-300 ${
              (p2State.hp / p2State.maxHp) < 0.25
                ? "border-red-500 animate-critical-glow"
                : "border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
            }`}>
              {p2State.character && imageCacheRef.current[p2State.character.id] ? (
                <img
                  src={imageCacheRef.current[p2State.character.id]?.src}
                  alt={p2State.character.name}
                  className="w-full h-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <span className="text-xs">🔴</span>
              )}
              {/* P2 Badge */}
              <span className="absolute bottom-0 left-0 bg-red-500 text-white text-[6px] font-bold px-0.5 rounded-tr font-sans">
                P2
              </span>
            </div>
            
            {/* Name & Health Bar */}
            <div className="flex-1 flex flex-col gap-1 text-right">
              <div className="flex justify-between items-baseline flex-row-reverse">
                <span className="text-[8px] md:text-[9px] text-red-400 font-bold uppercase tracking-wider">
                  {p2State.character.name}
                </span>
                <span className="text-[7px] md:text-[8px] text-zinc-400 font-bold">
                  {Math.round((p2State.hp / p2State.maxHp) * 100)}%
                </span>
              </div>
              {/* Health Bar Outer */}
              <div className={`h-3 md:h-3.5 bg-red-950 border-2 rounded overflow-hidden relative shadow-inner transition-all duration-300 ${
                (p2State.hp / p2State.maxHp) < 0.25
                  ? "border-red-500 animate-critical-glow"
                  : "border-zinc-950"
              }`}>
                {/* Ghost damage bar (Behind main bar) */}
                <div
                  className="h-full bg-red-600 absolute right-0 top-0 transition-all duration-500 ease-out"
                  style={{ width: `${(p2GhostHp / p2State.maxHp) * 100}%` }}
                />
                {/* Health Fill (Mirrored: align to right) */}
                <div
                  className="h-full bg-gradient-to-l from-amber-600 via-yellow-500 to-amber-400 absolute right-0 top-0 transition-all duration-75 ease-out z-10"
                  style={{ width: `${(p2State.hp / p2State.maxHp) * 100}%` }}
                />
                {/* White Impact Flash Overlay */}
                {p2Flash && (
                  <div className="absolute inset-0 bg-white z-20" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

 
      <canvas
        ref={canvasRef}
        className={
          isReelMode
            ? "absolute h-[120%] w-auto max-w-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-cover bg-center"
            : "block h-[450px] w-[600px] max-w-full rounded-lg bg-cover bg-center md:h-[600px] md:w-[800px]"
        }
        style={{
          backgroundImage: "url('/images/street_fight_background.png')",
        }}
      />
    </div>
  );
}
