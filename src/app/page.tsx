"use client";

import React, { useState, useRef, useEffect } from "react";
import BoxingRing from "@/components/BoxingRing";
import { ROSTER_DATA } from "@/constants/roster";
import { APP_CONFIG } from "@/constants/config";

export default function Home() {
  const [mode, setMode] = useState<"sandbox" | "pvp">("sandbox");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("mrbeast");
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>("lightsaber");

  // PvP selections
  const [p1CharacterId, setP1CharacterId] = useState<string>("mrbeast");
  const [p1WeaponId, setP1WeaponId] = useState<string>("lightsaber");
  const [p2CharacterId, setP2CharacterId] = useState<string>("ishowspeed");
  const [p2WeaponId, setP2WeaponId] = useState<string>("boxing_glove");

  const [gravity, setGravity] = useState<number>(0.8);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [wepDropdownOpen, setWepDropdownOpen] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  // Reel Mode States
  const [isReelMode, setIsReelMode] = useState<boolean>(false);
  const [subtitle, setSubtitle] = useState<string>("STREET FIGHT SIMULATOR");
  const [pvpP1State, setPvpP1State] = useState<any | null>(null);
  const [pvpP2State, setPvpP2State] = useState<any | null>(null);
  const [fighters, setFighters] = useState<Array<{ id: string; charId: string; name: string; hp: number; maxHp: number }>>([]);

  const onResetRef = useRef<(() => void) | null>(null);
  const onStartDuelRef = useRef<(() => void) | null>(null);

  // Manual / Automatic Recording refs and states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const onStartRecordingRef = useRef<(() => void) | null>(null);
  const onStopRecordingRef = useRef<(() => void) | null>(null);

  const [p1Wins, setP1Wins] = useState<number>(0);
  const [p2Wins, setP2Wins] = useState<number>(0);
  const duelFinishedRef = useRef<boolean>(false);

  useEffect(() => {
    if (mode === "pvp" && pvpP1State && pvpP2State) {
      if (pvpP1State.hp === 0 && pvpP2State.hp > 0) {
        if (!duelFinishedRef.current) {
          setP2Wins((prev) => prev + 1);
          duelFinishedRef.current = true;
        }
      } else if (pvpP2State.hp === 0 && pvpP1State.hp > 0) {
        if (!duelFinishedRef.current) {
          setP1Wins((prev) => prev + 1);
          duelFinishedRef.current = true;
        }
      } else if (pvpP1State.hp > 0 && pvpP2State.hp > 0) {
        duelFinishedRef.current = false;
      }
    }
  }, [pvpP1State?.hp, pvpP2State?.hp, mode]);

  // Determine the active weapon config details for Sandbox mode
  const selectedWeapon = ROSTER_DATA.weapons.find((w) => w.id === selectedWeaponId);

  // Determine the liveliness status based on the count of active bodies
  const getLivelinessStatus = (count: number) => {
    if (count === 0) return { text: "EMPTY", color: "text-zinc-500" };
    if (count <= 2) return { text: "CHILL", color: "text-green-400" };
    if (count <= 5) return { text: "DUEL", color: "neon-text-cyan" };
    if (count <= 10) return { text: "ROYALE", color: "neon-text-pink" };
    return { text: "MAYHEM", color: "neon-text-yellow animate-pulse" };
  };

  const status = getLivelinessStatus(activeCount);

  const handleModeChange = (newMode: "sandbox" | "pvp") => {
    setMode(newMode);
    // Brief delay to allow Matter.js scene to react and state properties to align
    setTimeout(() => {
      if (newMode === "pvp" && onStartDuelRef.current) {
        onStartDuelRef.current();
      } else if (newMode === "sandbox" && onResetRef.current) {
        onResetRef.current();
      }
    }, 60);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8 bg-[#04040a] relative overflow-hidden">
      {/* Background neon ambient overlay */}
      <div className="absolute inset-0 bg-radial-gradient-vibe pointer-events-none opacity-40" />

      {isReelMode ? (
        /* Reel Mode View */
        <div className="z-10 flex flex-col items-center justify-center min-h-screen py-4 w-full relative">

          {/* Floating Exit Button */}
          <button
            onClick={() => setIsReelMode(false)}
            className="pixel-btn font-pixel text-[8px] py-2.5 px-4 bg-red-950/80 text-red-400 border-red-800 hover:bg-red-900 active:bg-red-950 rounded transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] mb-6 flex-shrink-0"
          >
            ← EXIT REEL MODE
          </button>

          {/* Instagram Reel Phone Frame Mockup */}
          <div className="w-[350px] sm:w-[390px] h-[700px] sm:h-[780px] border-4 border-zinc-800 rounded-[40px] bg-[#090915] overflow-hidden flex flex-col items-center justify-center p-5 shadow-[0_0_60px_rgba(255,0,85,0.15),0_0_20px_rgba(0,240,255,0.1)] relative">

            {/* Reel Title Area */}
            <div className={`absolute left-5 right-5 flex flex-col items-center text-center z-20 ${mode === "pvp" ? "hidden" : "top-8"
              }`}>
              <h1 className="font-pixel text-[8px] uppercase tracking-widest text-pink-500/80 mb-1">
                {APP_CONFIG.title}
              </h1>
              <p className="font-pixel text-sm uppercase tracking-wider neon-text-cyan flicker">
                {subtitle}
              </p>
            </div>

            {/* The Arena Container - Full Bleed 9:16 background */}
            <div className="absolute inset-0 w-full h-full rounded-[36px] overflow-hidden z-0">
              <BoxingRing
                gravity={gravity}
                selectedCharacterId={selectedCharacterId}
                selectedWeaponId={selectedWeaponId}
                livelinessCallback={setActiveCount}
                onResetRef={onResetRef}
                muted={muted}
                mode={mode}
                p1CharacterId={p1CharacterId}
                p1WeaponId={p1WeaponId}
                p2CharacterId={p2CharacterId}
                p2WeaponId={p2WeaponId}
                onStartDuelRef={onStartDuelRef}
                isReelMode={true}
                onStartRecordingRef={onStartRecordingRef}
                onStopRecordingRef={onStopRecordingRef}
                onRecordingStateChange={setIsRecording}
                subtitle={subtitle}
                onPvpStateChange={(p1, p2) => {
                  setPvpP1State(p1);
                  setPvpP2State(p2);
                }}
                onFightersChange={(f) => {
                  setFighters(f);
                }}
              />
            </div>

            {/* Bottom HUD: Health Displays instead of general stats */}
            <div className="absolute bottom-8 left-5 right-5 flex flex-col items-center overflow-hidden z-20 w-[calc(100%-2.5rem)]">
              {mode === "pvp" ? (
                /* PvP Health display is now positioned above the ring */
                null
              ) : (
                /* Sandbox Mode Dynamic Health Display */
                <div className="w-full flex flex-col gap-2 bg-black/40 border-2 border-zinc-800 p-2.5 rounded-2xl flex-1 max-h-[110px] overflow-hidden">
                  <div className="border-b border-zinc-800 pb-1 flex justify-between items-center flex-shrink-0">
                    <span className="font-pixel text-[7px] text-[#ffea00]">ARENA POPULATION ({fighters.length})</span>
                    <span className="font-pixel text-[6px] text-zinc-500">SANDBOX</span>
                  </div>

                  {fighters.length === 0 ? (
                    <div className="font-pixel text-[7px] text-zinc-500 text-center py-4 my-auto">
                      💡 CLICK IN THE RING ABOVE<br />TO SPAWN FIGHTERS!
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                      {fighters.map((fighter) => (
                        <div key={fighter.id} className="flex flex-col gap-0.5">
                          <div className="flex justify-between items-baseline">
                            <span className="font-pixel text-[7px] text-zinc-300 font-bold uppercase truncate max-w-[65%]">
                              {fighter.name}
                            </span>
                            <span className="font-pixel text-[6px] text-zinc-400">
                              HP: {fighter.hp}/{fighter.maxHp}
                            </span>
                          </div>
                          <div className="h-1.5 bg-red-950 border border-zinc-800 rounded overflow-hidden relative">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 absolute left-0 top-0 transition-all duration-75"
                              style={{ width: `${(fighter.hp / fighter.maxHp) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action shortcuts / operations inside Reel Mode */}
              <div className="grid grid-cols-3 gap-2 w-full mt-3 flex-shrink-0">
                <button
                  onClick={() => {
                    if (mode === "pvp") {
                      if (onStartDuelRef.current) onStartDuelRef.current();
                    } else {
                      if (onResetRef.current) onResetRef.current();
                    }
                  }}
                  className="pixel-btn font-pixel text-[7px] py-2 bg-zinc-900 border-zinc-700 text-yellow-400 hover:border-yellow-500 transition-all text-center rounded"
                >
                  {mode === "pvp" ? "⚔️ DUEL AGAIN" : "⚠️ CLEAR RING"}
                </button>
                <button
                  onClick={() => setMuted(!muted)}
                  className="pixel-btn font-pixel text-[7px] py-2 bg-zinc-900 border-zinc-700 text-cyan-400 hover:border-cyan-500 transition-all text-center rounded"
                >
                  {muted ? "🔇 SOUND: OFF" : "🔊 SOUND: ON"}
                </button>
                <button
                  onClick={() => {
                    if (isRecording) {
                      if (onStopRecordingRef.current) onStopRecordingRef.current();
                    } else {
                      if (onStartRecordingRef.current) onStartRecordingRef.current();
                    }
                  }}
                  className={`pixel-btn font-pixel text-[7px] py-2 bg-zinc-900 border-zinc-700 transition-all text-center rounded ${
                    isRecording ? "text-red-500 hover:border-red-500 animate-pulse font-bold" : "text-emerald-400 hover:border-emerald-500"
                  }`}
                >
                  {isRecording ? "⏹️ STOP" : "🔴 RECORD"}
                </button>
              </div>
            </div>

            {/* Simulated Phone Bar Indicator */}
            <div className="absolute bottom-3 w-28 h-1 bg-zinc-850 rounded-full" />

          </div>
        </div>
      ) : (
        /* Original Desktop View */
        <>
          {/* Main Header */}
          <header className="z-10 flex flex-col items-center text-center mt-2 mb-6">
            <h1 className="font-pixel text-xs md:text-sm uppercase tracking-widest text-pink-500/80 mb-2">
              {APP_CONFIG.title}
            </h1>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value.toUpperCase())}
              className="font-pixel text-2xl md:text-4xl uppercase tracking-wider neon-text-cyan flicker bg-transparent border-none text-center outline-none focus:ring-1 focus:ring-cyan-500/30 rounded px-3 py-1 max-w-[95%] transition-all"
              placeholder="ENTER SUBTITLE"
            />
            <button
              onClick={() => setIsReelMode(true)}
              className="pixel-btn font-pixel text-[9px] px-3.5 py-2 mt-4 bg-gradient-to-r from-[#ff0055]/15 to-[#00f0ff]/15 border-zinc-700 text-[#ffea00] hover:scale-105 active:translate-y-0.5 transition-all shadow-[0_0_15px_rgba(255,0,85,0.2)] rounded"
            >
              🎬 ENTER INSTAGRAM REEL MODE
            </button>
          </header>

          {/* Game Layout Wrapper */}
          <div className="z-10 w-full max-w-5xl flex flex-col lg:flex-row gap-6 items-start justify-center px-2">
            {/* Floating Sidebar Panel */}
            <aside className="w-full lg:w-72 flex flex-col gap-5 p-5 rounded-2xl border-4 border-zinc-800 bg-[#0c0c16]/95 backdrop-blur-md shadow-2xl lg:sticky lg:top-6 z-20">
              {/* Panel Title */}
              <div className="border-b-4 border-zinc-800 pb-2 flex justify-between items-center">
                <h2 className="font-pixel text-xs text-[#ffea00] tracking-wider uppercase">
                  Control Deck
                </h2>
                <span className="font-pixel text-[8px] text-zinc-500">V1.2</span>
              </div>

              {/* Mode Selector */}
              <div className="flex flex-col gap-2">
                <span className="font-pixel text-[9px] text-zinc-400 tracking-wider">
                  GAME MODE:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleModeChange("sandbox")}
                    className={`pixel-btn font-pixel text-[8px] flex-1 py-2.5 rounded transition-all ${mode === "sandbox"
                      ? "bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                      : "bg-[#161622] text-zinc-400 border-zinc-700 hover:text-zinc-200"
                      }`}
                  >
                    🎮 SANDBOX
                  </button>
                  <button
                    onClick={() => handleModeChange("pvp")}
                    className={`pixel-btn font-pixel text-[8px] flex-1 py-2.5 rounded transition-all ${mode === "pvp"
                      ? "bg-[#ff0055]/20 text-[#ff0055] border-[#ff0055] shadow-[0_0_10px_rgba(255,0,85,0.3)]"
                      : "bg-[#161622] text-zinc-400 border-zinc-700 hover:text-zinc-200"
                      }`}
                  >
                    ⚔️ PVP DUEL
                  </button>
                </div>
              </div>

              {/* View Layout Toggle in Sidebar */}
              <div className="flex flex-col gap-2 border-t border-zinc-800/40 pt-3">
                <span className="font-pixel text-[9px] text-zinc-400 tracking-wider">
                  VIEW LAYOUT:
                </span>
                <button
                  onClick={() => setIsReelMode(true)}
                  className="pixel-btn font-pixel text-[8px] py-2.5 bg-gradient-to-r from-pink-950/40 to-cyan-950/40 text-yellow-400 border-zinc-700 hover:border-zinc-500 rounded transition-all"
                >
                  🎬 REEL MODE (9:16)
                </button>
              </div>

              {mode === "sandbox" ? (
                <>
                  {/* 1. Select YouTuber Grid */}
                  <div className="flex flex-col gap-2">
                    <span className="font-pixel text-[9px] text-zinc-400 tracking-wider">
                      1. SELECT YOUTUBER:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {ROSTER_DATA.characters.map((char) => (
                        <button
                          key={char.id}
                          onClick={() => setSelectedCharacterId(char.id)}
                          className={`pixel-btn font-pixel p-2 rounded text-center flex flex-col items-center justify-center gap-1 transition-all ${selectedCharacterId === char.id
                            ? "bg-[#1e40af]/30 text-white border-[#3b82f6] shadow-[0_0_12px_rgba(59,130,246,0.5)] scale-102"
                            : "bg-[#161622] text-zinc-400 border-zinc-700 hover:text-zinc-200"
                            }`}
                        >
                          <span className="text-lg leading-none">{char.id === "mrbeast" ? "🔵" : "🔴"}</span>
                          <span className="text-[8px] truncate max-w-full font-bold">{char.name}</span>
                          <span className="text-[6px] text-zinc-500">HP {char.baseHp}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Select Weapon Dropdown */}
                  <div className="flex flex-col gap-2 relative">
                    <span className="font-pixel text-[9px] text-zinc-400 tracking-wider">
                      2. SELECT WEAPON:
                    </span>
                    <button
                      onClick={() => setWepDropdownOpen(!wepDropdownOpen)}
                      className="pixel-btn font-pixel text-[10px] py-3 px-3 bg-[#161622] text-white border-zinc-700 hover:border-zinc-500 rounded flex justify-between items-center w-full"
                    >
                      <span>{selectedWeapon?.id === "lightsaber" ? "🟢 " : "🥊 "}{selectedWeapon?.name}</span>
                      <span className="text-[8px] text-zinc-400">{wepDropdownOpen ? "▲" : "▼"}</span>
                    </button>

                    {wepDropdownOpen && (
                      <div className="absolute top-[100%] left-0 w-full mt-2 bg-[#161622]/98 border-4 border-zinc-700 rounded-lg shadow-2xl z-30 flex flex-col p-1 backdrop-blur-md">
                        {ROSTER_DATA.weapons.map((wep) => (
                          <button
                            key={wep.id}
                            onClick={() => {
                              setSelectedWeaponId(wep.id);
                              setWepDropdownOpen(false);
                            }}
                            className={`font-pixel text-[9px] p-2.5 text-left rounded hover:bg-zinc-800 transition-all flex justify-between items-center ${selectedWeaponId === wep.id ? "text-[#00f0ff] bg-zinc-800/50" : "text-zinc-300"
                              }`}
                          >
                            <span>{wep.id === "lightsaber" ? "🟢 " : "🥊 "}{wep.name}</span>
                            <span className="text-[7px] text-zinc-500">DMG:{wep.damage}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* PVP Dual Player Configuration */}
                  <div className="flex flex-col gap-4 border-t-4 border-zinc-800 pt-3">
                    {/* Player 1 Selection */}
                    <div className="flex flex-col gap-2">
                      <span className="font-pixel text-[9px] text-cyan-400 tracking-wider">
                        P1 (LEFT PLAYER):
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ROSTER_DATA.characters.map((char) => (
                          <button
                            key={`p1-char-${char.id}`}
                            onClick={() => setP1CharacterId(char.id)}
                            className={`pixel-btn font-pixel p-1.5 rounded text-center flex flex-col items-center justify-center gap-0.5 transition-all ${p1CharacterId === char.id
                              ? "bg-[#00f0ff]/20 text-white border-cyan-500 shadow-[0_0_8px_rgba(0,240,255,0.4)]"
                              : "bg-[#161622] text-zinc-400 border-zinc-800 hover:text-zinc-200"
                              }`}
                          >
                            <span className="text-sm leading-none">{char.id === "mrbeast" ? "🔵" : "🔴"}</span>
                            <span className="text-[7px] truncate max-w-full font-bold">{char.name}</span>
                          </button>
                        ))}
                      </div>
                      {/* P1 Weapon Dropdown */}
                      <select
                        value={p1WeaponId}
                        onChange={(e) => setP1WeaponId(e.target.value)}
                        className="font-pixel text-[8px] py-2 px-2 bg-[#161622] text-white border-2 border-zinc-800 rounded outline-none cursor-pointer font-bold"
                      >
                        {ROSTER_DATA.weapons.map((wep) => (
                          <option key={`p1-wep-${wep.id}`} value={wep.id}>
                            {wep.id === "lightsaber" ? "🟢 " : "🥊 "}{wep.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Player 2 Selection */}
                    <div className="flex flex-col gap-2 border-t border-zinc-800/50 pt-2">
                      <span className="font-pixel text-[9px] text-red-400 tracking-wider">
                        P2 (RIGHT PLAYER):
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ROSTER_DATA.characters.map((char) => (
                          <button
                            key={`p2-char-${char.id}`}
                            onClick={() => setP2CharacterId(char.id)}
                            className={`pixel-btn font-pixel p-1.5 rounded text-center flex flex-col items-center justify-center gap-0.5 transition-all ${p2CharacterId === char.id
                              ? "bg-[#ff0055]/20 text-white border-red-500 shadow-[0_0_8px_rgba(255,0,85,0.4)]"
                              : "bg-[#161622] text-zinc-400 border-zinc-800 hover:text-zinc-200"
                              }`}
                          >
                            <span className="text-sm leading-none">{char.id === "mrbeast" ? "🔵" : "🔴"}</span>
                            <span className="text-[7px] truncate max-w-full font-bold">{char.name}</span>
                          </button>
                        ))}
                      </div>
                      {/* P2 Weapon Dropdown */}
                      <select
                        value={p2WeaponId}
                        onChange={(e) => setP2WeaponId(e.target.value)}
                        className="font-pixel text-[8px] py-2 px-2 bg-[#161622] text-white border-2 border-zinc-800 rounded outline-none cursor-pointer font-bold"
                      >
                        {ROSTER_DATA.weapons.map((wep) => (
                          <option key={`p2-wep-${wep.id}`} value={wep.id}>
                            {wep.id === "lightsaber" ? "🟢 " : "🥊 "}{wep.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Start Duel Action Button */}
                    <button
                      onClick={() => {
                        if (onStartDuelRef.current) {
                          onStartDuelRef.current();
                        }
                      }}
                      className="pixel-btn font-pixel text-[9px] py-2.5 px-2 bg-[#ffea00]/10 text-[#ffea00] border-[#ffea00] hover:bg-[#ffea00]/20 active:bg-[#ffea00]/30 rounded transition-all mt-1"
                    >
                      ⚔️ START DUEL
                    </button>
                  </div>
                </>
              )}

              {/* 3. Gravity Controls */}
              <div className="flex flex-col gap-2">
                <span className="font-pixel text-[9px] text-zinc-400 tracking-wider">
                  3. ARENA GRAVITY:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGravity(0)}
                    className={`pixel-btn font-pixel text-[8px] flex-1 py-2 rounded transition-all ${gravity === 0
                      ? "bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                      : "bg-[#161622] text-zinc-400 border-zinc-700 hover:text-zinc-200"
                      }`}
                  >
                    🛰️ ZERO-G
                  </button>
                  <button
                    onClick={() => setGravity(0.8)}
                    className={`pixel-btn font-pixel text-[8px] flex-1 py-2 rounded transition-all ${gravity === 0.8
                      ? "bg-[#ff0055]/20 text-[#ff0055] border-[#ff0055] shadow-[0_0_10px_rgba(255,0,85,0.3)]"
                      : "bg-[#161622] text-zinc-400 border-zinc-700 hover:text-zinc-200"
                      }`}
                  >
                    🌍 STREET G
                  </button>
                </div>
              </div>

              {/* 4. Action Operations */}
              <div className="mt-1 flex flex-col gap-2">
                <button
                  onClick={() => {
                    if (onResetRef.current) {
                      onResetRef.current();
                    }
                  }}
                  className="pixel-btn font-pixel text-[10px] py-3 px-2 bg-red-950/70 text-red-300 border-red-800 hover:bg-red-900 active:bg-red-950 rounded transition-all"
                >
                  ⚠️ CLEAR ARENA
                </button>
                <button
                  onClick={() => setMuted(!muted)}
                  className={`pixel-btn font-pixel text-[10px] py-3 px-2 rounded transition-all ${muted
                    ? "bg-zinc-850 text-zinc-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-500"
                    : "bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff] hover:bg-[#00f0ff]/20"
                    }`}
                >
                  {muted ? "🔇 SOUNDS: OFF" : "🔊 SOUNDS: ON"}
                </button>
              </div>

              {/* 5. Stats Integration */}
              <div className="mt-2 pt-3 border-t-4 border-zinc-800 flex flex-col gap-2">
                <div className="flex justify-between items-center bg-[#161622] p-2 border-2 border-zinc-800 rounded">
                  <span className="font-pixel text-[7px] text-zinc-400">ENTITIES:</span>
                  <span className="font-pixel text-[10px] text-white font-bold">{activeCount}</span>
                </div>
                <div className="flex justify-between items-center bg-[#161622] p-2 border-2 border-zinc-800 rounded">
                  <span className="font-pixel text-[7px] text-zinc-400">LIVELINESS:</span>
                  <span className={`font-pixel text-[10px] font-bold ${status.color}`}>
                    {status.text}
                  </span>
                </div>
              </div>

              {/* Quick Info */}
              <div className="mt-1 pt-3 border-t-4 border-zinc-800">
                <span className="font-pixel text-[7px] text-zinc-500 leading-normal block">
                  {mode === "sandbox"
                    ? "💡 CLICK ANYWHERE inside the canvas to spawn your selection at the cursor coordinates! Click and drag characters to slam them."
                    : "💡 Click and drag characters inside the ring to throw them. Configure the selections above and click 'START DUEL' to reset the battle!"}
                </span>
              </div>
            </aside>

            {/* Center: Matter.js Simulation Ring */}
            <section className="flex flex-col items-center justify-center">
              <BoxingRing
                gravity={gravity}
                selectedCharacterId={selectedCharacterId}
                selectedWeaponId={selectedWeaponId}
                livelinessCallback={setActiveCount}
                onResetRef={onResetRef}
                muted={muted}
                mode={mode}
                p1CharacterId={p1CharacterId}
                p1WeaponId={p1WeaponId}
                p2CharacterId={p2CharacterId}
                p2WeaponId={p2WeaponId}
                onStartDuelRef={onStartDuelRef}
                isReelMode={false}
                onStartRecordingRef={onStartRecordingRef}
                onStopRecordingRef={onStopRecordingRef}
                onRecordingStateChange={setIsRecording}
                subtitle={subtitle}
                onPvpStateChange={(p1, p2) => {
                  setPvpP1State(p1);
                  setPvpP2State(p2);
                }}
                onFightersChange={(f) => {
                  setFighters(f);
                }}
              />
            </section>
          </div>

          {/* Footer Branding */}
          <footer className="mt-8 z-10 flex flex-col items-center gap-1">
            <span className="font-pixel text-[8px] text-zinc-600 tracking-widest uppercase">
              Powered by Next.js & Matter.js
            </span>
          </footer>
        </>
      )}
    </main>
  );
}
