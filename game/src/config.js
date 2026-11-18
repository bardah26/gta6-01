// config.js — constants for Neon Streets of Solara Bay.
// All names, places and story are original. No Rockstar content.
var SB = {};

SB.TITLE = "Neon Streets of Solara Bay";
SB.SAVE_KEY = "solara-bay-save-v1";

// World dimensions (pixels) and road grid.
SB.WORLD_W = 3600;
SB.WORLD_H = 2800;
SB.ROAD_W = 96;
SB.V_ROADS = [300, 800, 1300, 1800, 2300, 2800, 3300]; // x centers
SB.H_ROADS = [300, 800, 1300, 1800, 2300];             // y centers
SB.WATER_EAST = 3420;  // bay water starts east of this x
SB.WATER_SOUTH = 2580; // bay water starts south of this y

// Districts (name, rect, palette accent).
SB.DISTRICTS = [
  { name: "Barrio del Sol", x: 0, y: 0, w: 1250, h: 1400, accent: "#e8a34c", tint: "#2a1f14" },
  { name: "Neon Row", x: 1250, y: 0, w: 1350, h: 1600, accent: "#ff4fd8", tint: "#1a1030" },
  { name: "Portside", x: 2600, y: 0, w: 1000, h: 2600, accent: "#4cc9e8", tint: "#0e1c22" },
  { name: "Palmera Beach", x: 0, y: 2300, w: 3420, h: 500, accent: "#ffd94c", tint: "#241f10" },
];

// Key places (world coords).
SB.PLACES = {
  jefasBar: { x: 560, y: 560, label: "La Jefa's Bar" },
  garage: { x: 3050, y: 1050, label: "Rico's Garage" },
  safehouse: { x: 1050, y: 2050, label: "Safehouse" },
  hospital: { x: 1550, y: 550, label: "Solara General" },
  policeHQ: { x: 2050, y: 1050, label: "SBPD HQ" },
  docks: { x: 3100, y: 2050, label: "Portside Docks" },
  beach: { x: 900, y: 2450, label: "Palmera Beach" },
};

// Car types: name, color, top speed, accel, handling, size.
SB.CAR_TYPES = {
  sedan:   { name: "Vesper",   color: "#7fa8c9", top: 330, accel: 260, grip: 2.6, len: 52, wid: 26, price: 0 },
  taxi:    { name: "Metro Cab",color: "#f2c230", top: 310, accel: 250, grip: 2.6, len: 52, wid: 26, price: 0 },
  sports:  { name: "Comet GT", color: "#e83a4c", top: 470, accel: 380, grip: 3.4, len: 54, wid: 26, price: 0 },
  pickup:  { name: "Bison",    color: "#5d8a4c", top: 350, accel: 280, grip: 2.4, len: 58, wid: 28, price: 0 },
  van:     { name: "Hauler",   color: "#c9c9c9", top: 280, accel: 200, grip: 2.2, len: 62, wid: 28, price: 0 },
  police:  { name: "SBPD Patrol", color: "#2b3a55", top: 430, accel: 360, grip: 3.2, len: 54, wid: 26, price: 0 },
  armored: { name: "Kane's Rhino", color: "#1c1c22", top: 380, accel: 300, grip: 2.8, len: 60, wid: 30, price: 0 },
};

// Tuning.
SB.TUNE = {
  playerRun: 235,        // on-foot speed px/s
  playerSprint: 330,
  walkAccel: 1800,
  bulletSpeed: 900,
  bulletRange: 460,
  pistolRate: 0.22,      // seconds between shots
  pistolDamage: 34,
  smgRate: 0.09,
  smgDamage: 22,
  enemyHealth: 100,
  enemyRate: 0.9,
  enemyDamage: 7,
  policeRamDamage: 18,
  carRamDamage: 12,
  maxWanted: 5,
  wantedDecayDelay: 25,  // seconds without crime before stars fall
  wantedDecayStep: 12,   // seconds per star lost
  bustTime: 2.5,         // seconds pinned by police on foot = busted
  dayLength: 240,        // seconds for a full day/night cycle
  trafficCount: 10,
  pedCount: 18,
  pickupRadius: 34,
  saveVersion: 1,
};

// Colors.
SB.COLORS = {
  grass: "#3d7a3a",
  grassDark: "#356b33",
  road: "#33363e",
  roadLine: "#c9c46a",
  sidewalk: "#6f6f74",
  water: "#1d5f8a",
  waterDeep: "#154a6e",
  sand: "#d9c27a",
  buildingRoof: "#4a4a58",
  nightTint: "rgba(8,10,38,0.55)",
  duskTint: "rgba(60,20,60,0.28)",
};
