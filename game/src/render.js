// render.js — draws the world, entities, effects, HUD and minimap.
// All art is drawn with canvas primitives; no image assets.
SB.Render = (function () {
  var canvas = null, ctx = null;
  var VIEW_W = 1280, VIEW_H = 720;

  function init(c) {
    canvas = c; ctx = c.getContext("2d");
  }
  function daylight(t) {
    // t: 0..1, 0 = 06:00. Noon at 0.25, midnight at 0.75.
    var b = Math.cos((t - 0.25) * Math.PI * 2);
    return SB.clamp(b, 0, 1);
  }
  function inView(S, x, y, m) {
    return x > S.cam.x - m && x < S.cam.x + VIEW_W + m && y > S.cam.y - m && y < S.cam.y + VIEW_H + m;
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawWorld(S) {
    var cam = S.cam, day = daylight(S.timeOfDay);
    // Ground.
    ctx.fillStyle = SB.COLORS.grass;
    ctx.fillRect(cam.x - 10, cam.y - 10, VIEW_W + 20, VIEW_H + 20);
    // District tints.
    for (var d = 0; d < SB.DISTRICTS.length; d++) {
      var D = SB.DISTRICTS[d];
      ctx.fillStyle = D.tint;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(D.x, D.y, D.w, D.h);
      ctx.globalAlpha = 1;
    }
    // Beach + water.
    ctx.fillStyle = SB.COLORS.sand;
    ctx.fillRect(0, SB.WATER_SOUTH - 130, SB.WATER_EAST, 130);
    ctx.fillStyle = SB.COLORS.water;
    ctx.fillRect(SB.WATER_EAST, 0, SB.WORLD_W - SB.WATER_EAST, SB.WORLD_H);
    ctx.fillRect(0, SB.WATER_SOUTH, SB.WORLD_W, SB.WORLD_H - SB.WATER_SOUTH);
    ctx.fillStyle = SB.COLORS.waterDeep;
    for (var w = 0; w < 40; w++) {
      var wx = (w * 173 + S.time * 20) % SB.WORLD_W;
      var wy = SB.WATER_SOUTH + 40 + (w * 97) % 180;
      if (inView(S, wx, wy, 60)) {
        ctx.globalAlpha = 0.5;
        ctx.fillRect(wx, wy, 60, 3);
        ctx.globalAlpha = 1;
      }
    }
    // Roads: asphalt bands + sidewalks.
    ctx.fillStyle = SB.COLORS.sidewalk;
    for (var i = 0; i < SB.V_ROADS.length; i++) {
      var vx = SB.V_ROADS[i];
      ctx.fillRect(vx - SB.ROAD_W / 2 - 8, 0, SB.ROAD_W + 16, SB.WATER_SOUTH);
    }
    for (var j = 0; j < SB.H_ROADS.length; j++) {
      var hy = SB.H_ROADS[j];
      ctx.fillRect(0, hy - SB.ROAD_W / 2 - 8, SB.WATER_EAST, SB.ROAD_W + 16);
    }
    ctx.fillStyle = SB.COLORS.road;
    for (var vi = 0; vi < SB.V_ROADS.length; vi++)
      ctx.fillRect(SB.V_ROADS[vi] - SB.ROAD_W / 2, 0, SB.ROAD_W, SB.WATER_SOUTH);
    for (var hj = 0; hj < SB.H_ROADS.length; hj++)
      ctx.fillRect(0, SB.H_ROADS[hj] - SB.ROAD_W / 2, SB.WATER_EAST, SB.ROAD_W);
    // Center dashes + crosswalks.
    ctx.fillStyle = SB.COLORS.roadLine;
    for (var vi2 = 0; vi2 < SB.V_ROADS.length; vi2++) {
      var vx2 = SB.V_ROADS[vi2];
      for (var y = 20; y < SB.WATER_SOUTH; y += 56)
        if (inView(S, vx2, y, 40)) ctx.fillRect(vx2 - 2, y, 4, 28);
    }
    for (var hj2 = 0; hj2 < SB.H_ROADS.length; hj2++) {
      var hy2 = SB.H_ROADS[hj2];
      for (var x = 20; x < SB.WATER_EAST; x += 56)
        if (inView(S, x, hy2, 40)) ctx.fillRect(x, hy2 - 2, 28, 4);
    }
    ctx.fillStyle = "rgba(230,230,230,0.5)";
    for (var ci = 0; ci < SB.V_ROADS.length; ci++)
      for (var cj = 0; cj < SB.H_ROADS.length; cj++) {
        var cx = SB.V_ROADS[ci], cy = SB.H_ROADS[cj];
        if (!inView(S, cx, cy, 120)) continue;
        for (var s = -3; s <= 3; s++) ctx.fillRect(cx + s * 12 - 3, cy - SB.ROAD_W / 2 + 6, 6, 14);
      }
    // Buildings.
    var bs = SB.World.buildings();
    for (var b = 0; b < bs.length; b++) {
      var B = bs[b];
      if (!inView(S, B.x + B.w / 2, B.y + B.h / 2, Math.max(B.w, B.h))) continue;
      // Drop shadow for tall towers.
      if (B.tall) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(B.x + 10, B.y + 12, B.w, B.h);
      }
      ctx.fillStyle = B.color;
      ctx.fillRect(B.x, B.y, B.w, B.h);
      ctx.fillStyle = B.roof;
      ctx.fillRect(B.x + 6, B.y + 6, B.w - 12, B.h - 12);
      // Windows: lit warm at night.
      var cols = Math.max(2, Math.floor(B.w / 26)), rows = Math.max(2, Math.floor(B.h / 26));
      for (var wx = 0; wx < cols; wx++) for (var wy = 0; wy < rows; wy++) {
        var lit = ((wx * 7 + wy * 13 + Math.floor(B.litSeed * 10)) % 5) < 2;
        ctx.fillStyle = lit && day < 0.6 ? "#ffd94c" : "rgba(20,26,40,0.55)";
        ctx.fillRect(B.x + 10 + wx * ((B.w - 20) / cols), B.y + 10 + wy * ((B.h - 20) / rows), 8, 10);
      }
      if (B.neon) {
        ctx.save();
        ctx.shadowColor = "#ff4fd8"; ctx.shadowBlur = 14;
        ctx.fillStyle = "#ff7fe8";
        ctx.fillRect(B.x + B.w / 2 - 14, B.y - 4, 28, 6);
        ctx.restore();
      }
    }
    // Trees.
    var ts = SB.World.trees();
    for (var t = 0; t < ts.length; t++) {
      if (!inView(S, ts[t].x, ts[t].y, 30)) continue;
      ctx.fillStyle = "#2f6b2f";
      ctx.beginPath(); ctx.arc(ts[t].x, ts[t].y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4c9a4c";
      ctx.beginPath(); ctx.arc(ts[t].x - 3, ts[t].y - 3, 8, 0, Math.PI * 2); ctx.fill();
    }
    // Neon signs downtown.
    var sg = SB.World.signs();
    ctx.textAlign = "center"; ctx.font = "bold 13px monospace";
    for (var si = 0; si < sg.length; si++) {
      if (!inView(S, sg[si].x, sg[si].y, 60)) continue;
      ctx.save();
      ctx.shadowColor = sg[si].color; ctx.shadowBlur = day < 0.5 ? 16 : 6;
      ctx.fillStyle = sg[si].color;
      ctx.fillText(sg[si].text, sg[si].x, sg[si].y);
      ctx.restore();
    }
    // Lamps (glow at night).
    if (day < 0.7) {
      var ls = SB.World.lamps();
      for (var li = 0; li < ls.length; li++) {
        if (!inView(S, ls[li].x, ls[li].y, 40)) continue;
        ctx.save();
        ctx.globalAlpha = (0.7 - day) * 0.8;
        ctx.fillStyle = "#ffe9a0";
        ctx.beginPath(); ctx.arc(ls[li].x, ls[li].y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawCar(S, c) {
    if (!inView(S, c.x, c.y, 80)) return;
    var day = daylight(S.timeOfDay);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    // Headlight cones at night.
    if (day < 0.5 && !c.wrecked) {
      ctx.save();
      ctx.globalAlpha = (0.5 - day) * 1.1;
      var g = ctx.createRadialGradient(c.len / 2, 0, 4, c.len / 2 + 60, 0, 90);
      g.addColorStop(0, "rgba(255,240,180,0.55)");
      g.addColorStop(1, "rgba(255,240,180,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.len / 2 + 60, 0, 90, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Wheels.
    ctx.fillStyle = "#111";
    ctx.fillRect(-c.len / 2 + 6, -c.wid / 2 - 3, 12, 6);
    ctx.fillRect(-c.len / 2 + 6, c.wid / 2 - 3, 12, 6);
    ctx.fillRect(c.len / 2 - 18, -c.wid / 2 - 3, 12, 6);
    ctx.fillRect(c.len / 2 - 18, c.wid / 2 - 3, 12, 6);
    // Body.
    ctx.fillStyle = c.wrecked ? "#222" : c.color;
    roundRect(-c.len / 2, -c.wid / 2, c.len, c.wid, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = c.wrecked ? "#1a1a1a" : "rgba(20,28,40,0.85)";
    roundRect(-c.len / 2 + 12, -c.wid / 2 + 5, c.len - 26, c.wid - 10, 5);
    ctx.fill();
    ctx.fillStyle = c.wrecked ? "#1a1a1a" : "rgba(140,190,230,0.5)";
    ctx.fillRect(c.len / 2 - 22, -c.wid / 2 + 6, 6, c.wid - 12);
    // Headlights / taillights.
    ctx.fillStyle = "#fff6c0";
    ctx.fillRect(c.len / 2 - 2, -c.wid / 2 + 3, 3, 5);
    ctx.fillRect(c.len / 2 - 2, c.wid / 2 - 8, 3, 5);
    ctx.fillStyle = "#ff2e3e";
    ctx.fillRect(-c.len / 2 - 1, -c.wid / 2 + 3, 3, 5);
    ctx.fillRect(-c.len / 2 - 1, c.wid / 2 - 8, 3, 5);
    if (c.driver === "police" && c.siren) {
      var ph = (S.time * 2.4) % 1 < 0.5;
      ctx.fillStyle = ph ? "#ff2e3e" : "#2e7dff";
      ctx.fillRect(-6, -c.wid / 2 - 1, 12, 5);
      ctx.fillStyle = ph ? "#2e7dff" : "#ff2e3e";
      ctx.fillRect(-6, c.wid / 2 - 4, 12, 5);
    }
    if (c.type === "taxi") {
      ctx.fillStyle = "#111";
      ctx.fillRect(-4, -c.wid / 2 - 1, 10, 4);
    }
    if (c.mission === "pickup" || c.mission === "kane") {
      ctx.fillStyle = "#ffd94c";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(c.mission === "kane" ? "KANE" : "STEAL ME", 0, -c.wid / 2 - 8);
    }
    ctx.restore();
    // Damage smoke handled by particles; wrecked ring.
    if (c.wrecked) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath(); ctx.arc(c.x, c.y, c.len / 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPerson(S, x, y, angle, color, opts) {
    if (!inView(S, x, y, 40)) return;
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    // Shadow.
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(0, 5, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    // Body.
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8b98a";
    ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    // Facing + gun.
    ctx.rotate(angle);
    ctx.fillStyle = "#222";
    ctx.fillRect(8, -2, opts.gun ? 16 : 8, 4);
    ctx.restore();
    if (opts.hp !== undefined && opts.hp < 100) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x - 14, y - 24, 28, 4);
      ctx.fillStyle = "#e83a4c";
      ctx.fillRect(x - 14, y - 24, 28 * (opts.hp / 100), 4);
    }
  }

  function drawEntities(S) {
    var E = SB.Entities;
    // Pickups.
    for (var i = 0; i < E.pickups.length; i++) {
      var pk = E.pickups[i];
      if (!inView(S, pk.x, pk.y, 40)) continue;
      var bob = Math.sin(pk.bob) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === "cash") {
        ctx.fillStyle = "#2fae4e";
        ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
        ctx.fillText("$", 0, 5);
      } else if (pk.kind === "health") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = "#e83a4c";
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else {
        ctx.fillStyle = "#222";
        ctx.fillRect(-14, -4, 28, 8);
        ctx.fillStyle = "#888";
        ctx.fillRect(10, -2, 10, 4);
      }
      ctx.restore();
    }
    // Cars (parked first, then driven).
    for (var c = 0; c < E.cars.length; c++) drawCar(S, E.cars[c]);
    // Peds.
    for (var p = 0; p < E.peds.length; p++) {
      var pd = E.peds[p];
      if (pd.state === "down") {
        ctx.save();
        ctx.translate(pd.x, pd.y);
        ctx.rotate(pd.angle + Math.PI / 2);
        ctx.fillStyle = pd.color;
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else drawPerson(S, pd.x, pd.y, pd.angle, pd.color, {});
    }
    // Enemies.
    for (var e = 0; e < E.enemies.length; e++) {
      var en = E.enemies[e];
      if (en.dead) {
        ctx.save();
        ctx.globalAlpha = SB.clamp(en.fadeT / 2, 0, 1);
        ctx.translate(en.x, en.y);
        ctx.rotate(en.angle + Math.PI / 2);
        ctx.fillStyle = "#7a1e26";
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else drawPerson(S, en.x, en.y, en.angle, "#a01824", { gun: true, hp: en.hp });
    }
    // Player.
    var pl = E.player;
    if (!pl.inCar) drawPerson(S, pl.x, pl.y, pl.angle, "#2e7dff", { gun: true });
    // Bullets.
    ctx.strokeStyle = "#ffe98a";
    ctx.lineWidth = 3;
    for (var b = 0; b < E.bullets.length; b++) {
      var bl = E.bullets[b];
      ctx.beginPath();
      ctx.moveTo(bl.x, bl.y);
      ctx.lineTo(bl.x - bl.vx * 0.02, bl.y - bl.vy * 0.02);
      ctx.stroke();
    }
    // Particles.
    for (var pt = 0; pt < E.particles.length; pt++) {
      var P = E.particles[pt];
      var a = SB.clamp(P.life / P.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = P.color;
      if (P.type === "smoke") {
        ctx.beginPath(); ctx.arc(P.x, P.y, P.size * (1.6 - a * 0.6), 0, Math.PI * 2); ctx.fill();
      } else if (P.type === "flash") {
        ctx.beginPath(); ctx.arc(P.x, P.y, P.size, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(P.x - P.size / 2, P.y - P.size / 2, P.size, P.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawObjectiveArrow(S, obj) {
    if (!obj) return;
    var pl = SB.Entities.player;
    var sx = obj.x - S.cam.x, sy = obj.y - S.cam.y;
    var onScreen = sx > 40 && sx < VIEW_W - 40 && sy > 40 && sy < VIEW_H - 40;
    // Marker diamond: at the real spot when visible, else clamped to the
    // screen edge — kept clear of the HUD corners (cash top-left, minimap
    // top-right, speed bottom-right).
    var mx = onScreen ? sx : SB.clamp(sx, 50, VIEW_W - 50);
    var my = onScreen ? sy : SB.clamp(sy, 130, VIEW_H - 60);
    var pulse = 1 + Math.sin(S.time * 5) * 0.15;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.PI / 4);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#ffd94c";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.restore();
    if (!onScreen) {
      var ang = Math.atan2(sy - (pl.y - S.cam.y), sx - (pl.x - S.cam.x));
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.fillStyle = "#ffd94c";
      ctx.beginPath();
      ctx.moveTo(18, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawMinimap(S) {
    var mw = 190, mh = 148, mx = VIEW_W - mw - 14, my = 14;
    var sx = mw / SB.WORLD_W, sy = mh / SB.WORLD_H;
    ctx.save();
    ctx.fillStyle = "rgba(10,14,22,0.85)";
    roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    // Water + districts.
    ctx.fillStyle = "#1d5f8a";
    ctx.fillRect(mx + SB.WATER_EAST * sx, my, mw - SB.WATER_EAST * sx, mh);
    ctx.fillRect(mx, my + SB.WATER_SOUTH * sy, mw, mh - SB.WATER_SOUTH * sy);
    // Roads.
    ctx.strokeStyle = "rgba(200,200,210,0.75)";
    ctx.lineWidth = 2;
    for (var i = 0; i < SB.V_ROADS.length; i++) {
      ctx.beginPath();
      ctx.moveTo(mx + SB.V_ROADS[i] * sx, my);
      ctx.lineTo(mx + SB.V_ROADS[i] * sx, my + SB.WATER_SOUTH * sy);
      ctx.stroke();
    }
    for (var j = 0; j < SB.H_ROADS.length; j++) {
      ctx.beginPath();
      ctx.moveTo(mx, my + SB.H_ROADS[j] * sy);
      ctx.lineTo(mx + SB.WATER_EAST * sx, my + SB.H_ROADS[j] * sy);
      ctx.stroke();
    }
    // Places.
    ctx.fillStyle = "#7dff5e";
    var P = SB.PLACES;
    ctx.fillRect(mx + P.safehouse.x * sx - 2, my + P.safehouse.y * sy - 2, 4, 4);
    // Mission marker.
    var obj = SB.Missions.objective();
    if (obj) {
      var pulse = 3 + Math.sin(S.time * 5) * 1.5;
      ctx.fillStyle = "#ffd94c";
      ctx.beginPath();
      ctx.arc(mx + obj.x * sx, my + obj.y * sy, pulse + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police.
    ctx.fillStyle = "#ff3b4c";
    var cars = SB.Entities.cars;
    for (var c = 0; c < cars.length; c++)
      if (cars[c].driver === "police") {
        ctx.beginPath();
        ctx.arc(mx + cars[c].x * sx, my + cars[c].y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    // Player arrow.
    var pl = SB.Entities.player;
    ctx.save();
    ctx.translate(mx + pl.x * sx, my + pl.y * sy);
    ctx.rotate(pl.angle);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawHUD(S) {
    var pl = SB.Entities.player;
    ctx.textAlign = "left";
    // Health bar.
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(14, 14, 220, 20, 6); ctx.fill();
    ctx.fillStyle = pl.hp > 30 ? "#3ec95e" : "#e83a4c";
    roundRect(16, 16, 216 * (pl.hp / 100), 16, 5); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px monospace";
    ctx.fillText("HP " + Math.ceil(pl.hp), 24, 28);
    // Cash.
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = "#7dff5e";
    ctx.fillText(SB.fmtMoney(pl.cash), 16, 62);
    // Weapon.
    ctx.font = "13px monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText(pl.weapon === "smg" ? "SMG  " + pl.ammo + " rds" : "PISTOL  ∞", 16, 84);
    // Wanted stars.
    var wx = 16, wy = 112;
    for (var s = 0; s < SB.TUNE.maxWanted; s++) {
      ctx.font = "26px sans-serif";
      ctx.fillStyle = s < pl.wanted ? "#ffd94c" : "rgba(255,255,255,0.25)";
      ctx.fillText("★", wx + s * 28, wy);
    }
    // Time + district (below the phone banner and minimap).
    ctx.textAlign = "right";
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText(SB.fmtTime(S.timeOfDay) + "  •  " + pl.district, VIEW_W - 218, 216);
    // Speed + car health when driving.
    if (pl.inCar) {
      var c = pl.inCar;
      ctx.textAlign = "right";
      ctx.font = "bold 26px monospace";
      ctx.fillStyle = "#fff";
      ctx.fillText(Math.round(Math.abs(c.speed) * 0.36) + " km/h", VIEW_W - 16, VIEW_H - 52);
      ctx.font = "13px monospace";
      ctx.fillStyle = c.hp > 30 ? "#9adfff" : "#ff7a7a";
      ctx.fillText(SB.CAR_TYPES[c.type].name + "  •  " + Math.ceil(c.hp) + "%", VIEW_W - 16, VIEW_H - 30);
    }
    drawMinimap(S);
    // Objective banner (top center).
    var obj = SB.Missions.objective();
    if (obj) {
      ctx.textAlign = "center";
      ctx.font = "bold 15px monospace";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      var tw = ctx.measureText(obj.text).width + 28;
      roundRect((VIEW_W - tw) / 2, 12, tw, 30, 8);
      ctx.fill();
      ctx.fillStyle = "#ffd94c";
      ctx.fillText("◆ " + obj.text, VIEW_W / 2, 33);
      var d = Math.round(SB.dist(pl.x, pl.y, obj.x, obj.y));
      ctx.font = "12px monospace";
      ctx.fillStyle = "#fff";
      ctx.fillText(d + "m", VIEW_W / 2, 56);
    }
    drawObjectiveArrow(S, obj);
    // Phone / job banner.
    if (S.banner && S.banner.t > 0) {
      ctx.textAlign = "center";
      var bw = 560, bh = 86, bx = (VIEW_W - bw) / 2, by = 120;
      ctx.fillStyle = "rgba(8,10,20,0.88)";
      roundRect(bx, by, bw, bh, 10); ctx.fill();
      ctx.strokeStyle = "#ffd94c"; ctx.lineWidth = 2;
      roundRect(bx, by, bw, bh, 10); ctx.stroke();
      ctx.fillStyle = "#ffd94c";
      ctx.font = "bold 16px monospace";
      ctx.fillText(S.banner.title, VIEW_W / 2, by + 28);
      ctx.fillStyle = "#fff";
      ctx.font = "13px monospace";
      wrapText(S.banner.text, VIEW_W / 2, by + 52, bw - 30, 17);
    }
    // Toast.
    if (S.toastT > 0) {
      ctx.globalAlpha = SB.clamp(S.toastT, 0, 1);
      ctx.textAlign = "center";
      ctx.font = "bold 15px monospace";
      ctx.fillStyle = "#fff";
      ctx.fillText(S.toastMsg, VIEW_W / 2, VIEW_H - 88);
      ctx.globalAlpha = 1;
    }
    // Hurt flash.
    if (S.hurtFlash > 0) {
      ctx.fillStyle = "rgba(220,20,30," + (S.hurtFlash * 0.45) + ")";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
  function wrapText(text, cx, y, maxW, lh) {
    var words = text.split(" ");
    var line = "", lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], cx, y + j * lh);
    return lines.length;
  }

  function drawFrame(S) {
    ctx.save();
    // Camera + shake.
    var shx = S.shake > 0 ? SB.rand(-S.shake, S.shake) : 0;
    var shy = S.shake > 0 ? SB.rand(-S.shake, S.shake) : 0;
    ctx.translate(-S.cam.x + shx, -S.cam.y + shy);
    drawWorld(S);
    drawEntities(S);
    ctx.restore();
    // Night / dusk tint over the world (not the HUD).
    var day = daylight(S.timeOfDay);
    if (day < 1) {
      ctx.fillStyle = "rgba(8,10,38," + ((1 - day) * 0.5) + ")";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (day > 0 && day < 0.45) {
      ctx.fillStyle = "rgba(255,110,40," + ((0.45 - day) * 0.25) + ")";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (!S.hideHUD) drawHUD(S);
  }

  return {
    init: init,
    drawFrame: drawFrame,
    daylight: daylight,
    VIEW_W: VIEW_W,
    VIEW_H: VIEW_H,
  };
})();
