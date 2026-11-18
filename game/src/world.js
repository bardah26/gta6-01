// world.js — Solara Bay city generation and spatial queries.
// The city is a road grid with building blocks, three districts plus a
// beach strip, and the bay water along the east and south edges.
SB.World = (function () {
  var buildings = [];   // {x,y,w,h,color,lit,neon,district,h}
  var trees = [];       // {x,y}
  var lamps = [];       // {x,y}
  var signs = [];       // {x,y,text,color} neon signs (downtown)
  var parkedSpots = []; // {x,y,angle,type}
  var pedSpots = [];

  var ROOF_COLORS = ["#4a4a58", "#5a4a52", "#46545a", "#54423a", "#3f4a3a"];
  var WALL_COLORS = ["#8a6f5c", "#7a6f8a", "#6f8a7a", "#9a8a6f", "#7a7a8a", "#a87f6f"];
  var NEON_TEXTS = ["TACOS", "BAR", "HOTEL", "24H", "CLUB", "CASINO", "PIZZA", "MOTEL"];

  function isWater(x, y) {
    return x > SB.WATER_EAST || y > SB.WATER_SOUTH;
  }
  function isBeach(x, y) {
    return y > SB.WATER_SOUTH - 130 && y <= SB.WATER_SOUTH && x <= SB.WATER_EAST;
  }
  function onRoad(x, y) {
    var hw = SB.ROAD_W / 2;
    for (var i = 0; i < SB.V_ROADS.length; i++)
      if (Math.abs(x - SB.V_ROADS[i]) <= hw && y >= 0 && y <= SB.WORLD_H) return "v";
    for (var j = 0; j < SB.H_ROADS.length; j++)
      if (Math.abs(y - SB.H_ROADS[j]) <= hw && x >= 0 && x <= SB.WORLD_W) return "h";
    return null;
  }
  function districtAt(x, y) {
    for (var i = 0; i < SB.DISTRICTS.length; i++) {
      var d = SB.DISTRICTS[i];
      if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
    }
    return SB.DISTRICTS[0];
  }
  // Nearest road center + axis for a point (used by traffic AI).
  function nearestRoad(x, y) {
    var best = null, bd = 1e12;
    for (var i = 0; i < SB.V_ROADS.length; i++) {
      var d = Math.abs(x - SB.V_ROADS[i]);
      if (d < bd) { bd = d; best = { axis: "v", center: SB.V_ROADS[i], dist: d }; }
    }
    for (var j = 0; j < SB.H_ROADS.length; j++) {
      var d2 = Math.abs(y - SB.H_ROADS[j]);
      if (d2 < bd) { bd = d2; best = { axis: "h", center: SB.H_ROADS[j], dist: d2 }; }
    }
    return best;
  }
  // Solid test: buildings and water block movement. Returns the building hit.
  function solidAt(x, y, r) {
    if (isWater(x, y)) return { water: true };
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }
  function resolveCircle(x, y, r) {
    if (isWater(x, y)) {
      // Push out of the water back toward land.
      if (x > SB.WATER_EAST) x = SB.WATER_EAST - r;
      if (y > SB.WATER_SOUTH) y = SB.WATER_SOUTH - r;
      return { x: x, y: y, hit: true };
    }
    var hit = false;
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      var p = SB.circleRectResolve(x, y, r, b.x, b.y, b.w, b.h);
      if (p) { x = p.x; y = p.y; hit = true; }
    }
    return { x: SB.clamp(x, r, SB.WORLD_W - r), y: SB.clamp(y, r, SB.WORLD_H - r), hit: hit };
  }
  // Line of sight for shooting: blocked by any building.
  function losBlocked(x1, y1, x2, y2) {
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (SB.segmentHitsRect(x1, y1, x2, y2, b.x, b.y, b.w, b.h)) return true;
    }
    return false;
  }
  function randomRoadPoint() {
    if (Math.random() < 0.5) {
      var vx = SB.pick(SB.V_ROADS);
      return { x: vx + SB.rand(-22, 22), y: SB.rand(120, SB.WORLD_H - 120), axis: "v" };
    }
    var hy = SB.pick(SB.H_ROADS);
    return { x: SB.rand(120, SB.WORLD_W - 120), y: hy + SB.rand(-22, 22), axis: "h" };
  }
  function randomSidewalkPoint() {
    var p = randomRoadPoint();
    var off = SB.ROAD_W / 2 + 14;
    if (p.axis === "v") return { x: p.x + (Math.random() < 0.5 ? -off : off), y: p.y };
    return { x: p.x, y: p.y + (Math.random() < 0.5 ? -off : off) };
  }

  function generate() {
    buildings = []; trees = []; lamps = []; signs = []; parkedSpots = []; pedSpots = [];
    var xs = [0].concat(SB.V_ROADS).concat([SB.WORLD_W]);
    var ys = [0].concat(SB.H_ROADS).concat([SB.WORLD_H]);
    // Blocks between roads get 1-4 buildings.
    for (var bi = 0; bi < xs.length - 1; bi++) {
      for (var bj = 0; bj < ys.length - 1; bj++) {
        var bx = xs[bi] + SB.ROAD_W / 2 + 18;
        var by = ys[bj] + SB.ROAD_W / 2 + 18;
        var bw = xs[bi + 1] - SB.ROAD_W / 2 - 18 - bx;
        var bh = ys[bj + 1] - SB.ROAD_W / 2 - 18 - by;
        if (bw < 90 || bh < 90) continue;
        if (bx + bw > SB.WATER_EAST || by + bh > SB.WATER_SOUTH) continue;
        var d = districtAt(bx + bw / 2, by + bh / 2);
        var downtown = d.name === "Neon Row";
        var n = downtown ? SB.randInt(2, 4) : SB.randInt(1, 3);
        var cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
        var cw = bw / cols, ch = bh / rows;
        for (var k = 0; k < n; k++) {
          var cx = bx + (k % cols) * cw, cy = by + Math.floor(k / cols) * ch;
          var w = cw * SB.rand(0.55, 0.8), h = ch * SB.rand(0.55, 0.8);
          var tall = downtown && Math.random() < 0.45;
          buildings.push({
            x: cx + (cw - w) / 2, y: cy + (ch - h) / 2, w: w, h: h,
            color: SB.pick(WALL_COLORS), roof: SB.pick(ROOF_COLORS),
            tall: tall, neon: downtown && Math.random() < 0.4,
            district: d.name, litSeed: Math.random(),
          });
        }
        // Trees on the block corners.
        if (Math.random() < 0.6) trees.push({ x: bx + 24, y: by + 24 });
        if (Math.random() < 0.5) trees.push({ x: bx + bw - 24, y: by + bh - 24 });
      }
    }
    // Lamps along roads.
    for (var i = 0; i < SB.V_ROADS.length; i++)
      for (var y = 200; y < SB.WORLD_H; y += 400)
        lamps.push({ x: SB.V_ROADS[i] + SB.ROAD_W / 2 + 6, y: y });
    for (var j = 0; j < SB.H_ROADS.length; j++)
      for (var x = 200; x < SB.WORLD_W; x += 400)
        lamps.push({ x: x, y: SB.H_ROADS[j] + SB.ROAD_W / 2 + 6 });
    // Neon signs downtown.
    for (var s = 0; s < 26; s++) {
      signs.push({
        x: SB.rand(1300, 2550), y: SB.rand(150, 1500),
        text: SB.pick(NEON_TEXTS), color: SB.pick(["#ff4fd8", "#4ce8ff", "#ffe14c", "#7dff5e"]),
      });
    }
    // Parked cars along road edges.
    var types = ["sedan", "sedan", "taxi", "sports", "pickup", "van"];
    for (var p = 0; p < 26; p++) {
      var rp = randomRoadPoint();
      var ang = rp.axis === "v" ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
                                : (Math.random() < 0.5 ? 0 : Math.PI);
      var px = rp.x, py = rp.y;
      if (rp.axis === "v") px += (Math.random() < 0.5 ? -68 : 68);
      else py += (Math.random() < 0.5 ? -68 : 68);
      if (!solidAt(px, py, 30) && !onRoad(px, py)) {
        parkedSpots.push({ x: px, y: py, angle: ang, type: SB.pick(types) });
      }
    }
    for (var q = 0; q < SB.TUNE.pedCount + 10; q++) pedSpots.push(randomSidewalkPoint());
  }

  return {
    generate: generate,
    buildings: function () { return buildings; },
    trees: function () { return trees; },
    lamps: function () { return lamps; },
    signs: function () { return signs; },
    parkedSpots: function () { return parkedSpots; },
    pedSpots: function () { return pedSpots; },
    isWater: isWater,
    isBeach: isBeach,
    onRoad: onRoad,
    districtAt: districtAt,
    nearestRoad: nearestRoad,
    solidAt: solidAt,
    resolveCircle: resolveCircle,
    losBlocked: losBlocked,
    randomRoadPoint: randomRoadPoint,
    randomSidewalkPoint: randomSidewalkPoint,
  };
})();
