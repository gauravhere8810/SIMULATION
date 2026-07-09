export interface CharacterConfig {
  id: string;
  name: string;
  mass: number;       // Used for physics body mass scaling
  size: number;       // Dimensions or diameter for the canvas representation
  assetPath: string;  // Path to the character's pixel art sprite sheet/image
  baseHp: number;     // Starting health points for the arena combat
  trailColor: string; // Color of the movement trail
}

export interface WeaponConfig {
  id: string;
  name: string;
  damage: number;     // Attack power
  knockback: number;  // Force multiplier applied during physical collision
  assetPath: string;  // Path to the weapon's pixel art asset
  specialEffect: string; // Descriptor for special weapon mechanics (e.g. 'stun', 'energy_burn')
  sparkColor: string; // Color of the collision sparks
}

export interface RosterDataConfig {
  characters: CharacterConfig[];
  weapons: WeaponConfig[];
}

export const ROSTER_DATA: RosterDataConfig = {
  characters: [
    {
      id: "mrbeast",
      name: "India",
      mass: 1.2,
      size: 64,
      assetPath: "/images/characters/India.png",
      baseHp: 100,
      trailColor: "#ff9933", // India saffron trail
    },
    {
      id: "ishowspeed",
      name: "Pakistan",
      mass: 1.2,
      size: 64,
      assetPath: "/images/characters/Pakistan.png",
      baseHp: 100,
      trailColor: "#115c36", // Pakistan green trail
    },
  ],
  weapons: [
    {
      id: "lightsaber",
      name: "Lightsaber",
      damage: 25,
      knockback: 1.5,
      assetPath: "/images/weapons/lightsaber.png",
      specialEffect: "energy_burn",
      sparkColor: "#22c55e", // Lightsaber green sparks
    },
    {
      id: "boxing_glove",
      name: "Boxing Glove",
      damage: 10,
      knockback: 2.2,
      assetPath: "/images/weapons/boxing_glove.png",
      specialEffect: "heavy_kb",
      sparkColor: "#f43f5e", // Boxing glove rose/red sparks
    },
  ],
};
