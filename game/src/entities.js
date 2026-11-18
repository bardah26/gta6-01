// entities.js — player, cars, traffic AI, pedestrians, police, bullets,
// particles and pickups. All gameplay simulation lives here.
SB.Entities = (function () {
  var S = null; // game state, set by main.js each frame (SB.state)

  var player = null;
  var cars = [];
  var peds = [];
  var enemies = [];
  var bullets = [];
  var particles = [];
  var pickups = [];
  var bustTimer = 0;

  function reset(state) {
    S = state;
    player = {
      // Dante starts at his safehouse: the first job is a real trip
      // across town to La Jefa's bar (not an instant auto-complete).
      x: SB.PLACES.safehouse.x + 40, y: SB.PLACES.safehouse.y + 40,
      angle: 0, hp: 100, cash: 150, wanted: 0, lastCrime: -999,
      inCar: null, weapon: "pistol", ammo: 0, fireT: 0,
      speed: 0, moving: false, district: "",
    };
    cars = []; peds = []; enemies = []; bullets = []; particles = []; pickups = [];
    bustTimer = 0;
    spawnParkedCars();
    for (var i = 0; i < SB.TUNE.trafficCount; i++) spawnTrafficCar(true);
    for (var j = 0; j < SB.TUNE.pedCount; j++) spawnPed();
  }

  // ---------- cars ----------
  function makeCar(x, y, angle, type, driver) {
    var t = SB.CAR_TYPES[type];
    var c = {
      x: x, y: y, angle: angle, speed: 0, type: type, color: t.color,
      top: t.top, accel: t.accel, grip: t.grip, len: t.len, wid: t.wid,
      hp: 100, driver: driver || "parked", lane: Math.random() < 0.5 ? 1 : -1,
      cruise: SB.rand(140, 220), turnT: 0, stuckT: 0, wrecked: false,
      explodeT: 0, siren: false, targetSpeed: 0, shootT: SB.rand(0.5, 1.5),
      mission: false, label: "",
    };
    cars.push(c);
    return c;
  }
  function spawnParkedCars() {
    var spots = SB.World.parkedSpots();
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      makeCar(s.x, s.y, s.angle, s.type, "parked");
    }
  }
  function spawnTrafficCar(anywhere) {
    for (var tries = 0; tries < 8; tries++) {
      var p = SB.World.randomRoadPoint();
      if (!anywhere && player && SB.dist(p.x, p.y, player.x, player.y) < 500) continue;
      // Do not spawn on top of another car.
      var clear = true;
      for (var i = 0; i < cars.length; i++)
        if (SB.dist(p.x, p.y, cars[i].x, cars[i].y) < 90) { clear = false; break; }
      if (!clear) continue;
      var ang = p.axis === "v" ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
                               : (Math.random() < 0.5 ? 0 : Math.PI);
      var c = makeCar(p.x, p.y, ang, SB.pick(["sedan", "sedan", "taxi", "pickup", "van", "sports"]), "traffic");
      c.speed = c.cruise * SB.rand(0.7, 1);
      return c;
    }
    return null;
  }
  function spawnPoliceCar() {
    // On a road 550-750px from the player, not on top of another car.
    for (var tries = 0; tries < 12; tries++) {
      var p = SB.World.randomRoadPoint();
      var d = SB.dist(p.x, p.y, player.x, player.y);
      if (d > 520 && d < 800) {
        var clear = true;
        for (var i = 0; i < cars.length; i++)
          if (SB.dist(p.x, p.y, cars[i].x, cars[i].y) < 90) { clear = false; break; }
        if (!clear) continue;
        var ang = p.axis === "v" ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
                                 : (Math.random() < 0.5 ? 0 : Math.PI);
        var c = makeCar(p.x, p.y, ang, "police", "police");
        c.siren = true;
        return c;
      }
    }
    return null;
  }
  function policeCount() {
    var n = 0;
    for (var i = 0; i < cars.length; i++) if (cars[i].driver === "police") n++;
    return n;
  }
  function nearestCar(x, y, maxD, filter) {
    var best = null, bd = maxD;
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (filter && !filter(c)) continue;
      var d = SB.dist(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function addWanted(n) {
    player.wanted = SB.clamp(player.wanted + n, 0, SB.TUNE.maxWanted);
    player.lastCrime = S.time;
  }
  function carCorners(c) {
    var cs = Math.cos(c.angle), sn = Math.sin(c.angle);
    var hl = c.len / 2, hw = c.wid / 2;
    return [
      { x: c.x + cs * hl - sn * hw, y: c.y + sn * hl + cs * hw },
      { x: c.x + cs * hl + sn * hw, y: c.y + sn * hl - cs * hw },
      { x: c.x - cs * hl - sn * hw, y: c.y - sn * hl + cs * hw },
      { x: c.x - cs * hl + sn * hw, y: c.y - sn * hl - cs * hw },
    ];
  }
  function damageCar(c, dmg, srcX, srcY) {
    if (c.wrecked) return;
    c.hp -= dmg;
    spawnSparks(c.x, c.y, 4);
    if (c.hp <= 0) {
      c.wrecked = true; c.explodeT = 1.2; c.speed = 0;
      if (c.driver === "player") {
        // Player auto-ejects from a dying car.
        exitCar(true);
        damagePlayer(20);
      }
    }
  }
  function explodeCar(c) {
    SB.Audio.explosion();
    spawnExplosion(c.x, c.y);
    S.shake = Math.max(S.shake, 10);
    var idx = cars.indexOf(c);
    if (idx >= 0) cars.splice(idx, 1);
    if (player.inCar === c) player.inCar = null;
    // Radius damage.
    if (SB.dist(player.x, player.y, c.x, c.y) < 130 && !player.inCar) damagePlayer(45);
    for (var i = enemies.length - 1; i >= 0; i--)
      if (SB.dist(enemies[i].x, enemies[i].y, c.x, c.y) < 130) damageEnemy(enemies[i], 120);
  }

  // Move a circle in two axis steps so it slides along walls instead of
  // sticking to them.
  function moveWithCollision(e, dx, dy, r) {
    e.x += dx;
    var a = SB.World.resolveCircle(e.x, e.y, r);
    e.x = a.x; e.y = a.y;
    e.y += dy;
    var b = SB.World.resolveCircle(e.x, e.y, r);
    e.x = b.x; e.y = b.y;
  }

  // ---------- player ----------
  function damagePlayer(dmg) {
    if (S.mode !== "play") return;
    player.hp -= dmg;
    S.hurtFlash = Math.max(S.hurtFlash, 0.45);
    if (player.hp <= 0) {
      player.hp = 0;
      S.events.push("wasted");
    }
  }
  function enterCar(c) {
    var witnessed = false;
    for (var i = 0; i < peds.length; i++)
      if (SB.dist(peds[i].x, peds[i].y, c.x, c.y) < 260) witnessed = true;
    for (var j = 0; j < cars.length; j++)
      if (cars[j].driver === "police" && SB.dist(cars[j].x, cars[j].y, c.x, c.y) < 320) witnessed = true;
    if (c.driver === "traffic") {
      // Yank the driver out; they flee on foot.
      var d = spawnPedAt(c.x + 40, c.y + 40);
      if (d) { d.state = "flee"; d.fleeT = 4; }
      if (witnessed) addWanted(1);
      S.toast("Car jacked! " + (witnessed ? "Witnessed — wanted +1" : ""));
    } else if (c.driver === "parked" && witnessed) {
      addWanted(1);
      S.toast("Stolen in plain sight — wanted +1");
    }
    c.driver = "player";
    player.inCar = c;
    player.x = c.x; player.y = c.y;
    SB.Audio.pickup();
  }
  function exitCar(forced) {
    var c = player.inCar;
    if (!c) return;
    if (!forced && Math.abs(c.speed) > 130) {
      damagePlayer(10);
      S.toast("Bailed out at speed!");
    }
    c.driver = "parked";
    c.speed = 0;
    player.inCar = null;
    // Step out to the side of the car.
    var side = c.angle + Math.PI / 2;
    player.x = c.x + Math.cos(side) * 34;
    player.y = c.y + Math.sin(side) * 34;
    var r = SB.World.resolveCircle(player.x, player.y, 14);
    player.x = r.x; player.y = r.y;
  }
  function tryEnterCar() {
    if (player.inCar) { exitCar(false); return; }
    var c = nearestCar(player.x, player.y, 64, function (cc) {
      return !cc.wrecked && cc.driver !== "player";
    });
    if (c) enterCar(c);
  }

  function shoot(fromX, fromY, angle, dmg, from) {
    var b = {
      x: fromX + Math.cos(angle) * 20, y: fromY + Math.sin(angle) * 20,
      vx: Math.cos(angle) * SB.TUNE.bulletSpeed, vy: Math.sin(angle) * SB.TUNE.bulletSpeed,
      life: SB.TUNE.bulletRange / SB.TUNE.bulletSpeed, dmg: dmg, from: from,
    };
    bullets.push(b);
    spawnMuzzle(fromX + Math.cos(angle) * 22, fromY + Math.sin(angle) * 22);
  }

  // ---------- pedestrians ----------
  function spawnPedAt(x, y) {
    var p = {
      x: x, y: y, angle: SB.rand(0, Math.PI * 2), speed: SB.rand(45, 75),
      state: "walk", fleeT: 0, downT: 0, target: null, color: SB.pick(["#e8c85c", "#c95c8a", "#5c9ac9", "#7ac95c", "#c96a4c", "#9a5cc9"]),
    };
    peds.push(p);
    return p;
  }
  function spawnPed() {
    var s = SB.World.randomSidewalkPoint();
    spawnPedAt(s.x, s.y);
  }
  function updatePeds(dt) {
    for (var i = peds.length - 1; i >= 0; i--) {
      var p = peds[i];
      if (p.state === "down") {
        p.downT -= dt;
        if (p.downT <= 0) peds.splice(i, 1);
        continue;
      }
      if (p.state === "flee") {
        p.fleeT -= dt;
        if (p.fleeT <= 0) p.state = "walk";
        p.speed = 190;
      } else p.speed = SB.rand(45, 75);
      if (!p.target || SB.dist(p.x, p.y, p.target.x, p.target.y) < 24) {
        // Pick a nearby sidewalk point to walk to.
        var s = SB.World.randomSidewalkPoint();
        if (SB.dist(s.x, s.y, p.x, p.y) > 700) { p.target = { x: p.x + SB.rand(-300, 300), y: p.y + SB.rand(-300, 300) }; }
        else p.target = s;
      }
      // Dodge a fast car bearing down on the sidewalk crossing.
      for (var ci = 0; ci < cars.length; ci++) {
        var cc = cars[ci];
        if (Math.abs(cc.speed) > 150 && SB.dist(cc.x, cc.y, p.x, p.y) < 130) {
          p.state = "flee"; p.fleeT = 1.5;
          var ax = p.x - cc.x, ay = p.y - cc.y;
          var al = Math.sqrt(ax * ax + ay * ay) || 1;
          p.target = { x: p.x + (ax / al) * 220, y: p.y + (ay / al) * 220 };
          break;
        }
      }
      var want = SB.angleTo(p.x, p.y, p.target.x, p.target.y);
      p.angle += SB.angleDiff(p.angle, want) * Math.min(1, dt * 6);
      moveWithCollision(p, Math.cos(p.angle) * p.speed * dt, Math.sin(p.angle) * p.speed * dt, 10);
      // Run over by a fast car?
      if (player.inCar && player.inCar.speed > 140 && SB.dist(p.x, p.y, player.x, player.y) < 34) {
        p.state = "down"; p.downT = 6;
        spawnBlood(p.x, p.y);
        if (S.time - (S.lastPedCrime || -99) > 5) {
          S.lastPedCrime = S.time;
          addWanted(1);
          S.toast("Pedestrian hit! Wanted +1");
        }
      }
    }
    // Keep the crowd topped up near the player.
    if (peds.length < SB.TUNE.pedCount && Math.random() < dt * 2) {
      var s2 = SB.World.randomSidewalkPoint();
      if (SB.dist(s2.x, s2.y, player.x, player.y) < 700 && SB.dist(s2.x, s2.y, player.x, player.y) > 300)
        spawnPedAt(s2.x, s2.y);
    }
  }
  function scarePeds(x, y, radius) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.state !== "down" && SB.dist(p.x, p.y, x, y) < radius) {
        p.state = "flee"; p.fleeT = 3;
        p.target = { x: p.x + (p.x - x), y: p.y + (p.y - y) };
      }
    }
  }

  // ---------- enemies (mission shooters) ----------
  function spawnEnemy(x, y, hp) {
    var e = { x: x, y: y, hp: hp || SB.TUNE.enemyHealth, angle: 0, shootT: SB.rand(0.4, 1.2), dead: false, fadeT: 0 };
    enemies.push(e);
    return e;
  }
  function damageEnemy(e, dmg) {
    e.hp -= dmg;
    spawnBlood(e.x, e.y);
    if (e.hp <= 0 && !e.dead) {
      e.dead = true; e.fadeT = 5;
      if (Math.random() < 0.5) addPickup(e.x, e.y, "cash", SB.randInt(40, 120));
      else if (Math.random() < 0.4) addPickup(e.x, e.y, "health", 40);
      S.events.push("enemyDown");
    }
  }
  function updateEnemies(dt) {
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (e.dead) {
        e.fadeT -= dt;
        if (e.fadeT <= 0) enemies.splice(i, 1);
        continue;
      }
      var d = SB.dist(e.x, e.y, player.x, player.y);
      e.angle = SB.angleTo(e.x, e.y, player.x, player.y);
      if (d < 460 && !SB.World.losBlocked(e.x, e.y, player.x, player.y)) {
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = SB.TUNE.enemyRate * SB.rand(0.8, 1.3);
          var err = SB.rand(-0.14, 0.14);
          shoot(e.x, e.y, e.angle + err, SB.TUNE.enemyDamage, "enemy");
          SB.Audio.enemyShot();
        }
      } else if (d > 200) {
        // Close in on the player.
        moveWithCollision(e, Math.cos(e.angle) * 85 * dt, Math.sin(e.angle) * 85 * dt, 12);
      }
    }
  }

  // ---------- pickups ----------
  function addPickup(x, y, kind, amount) {
    pickups.push({ x: x, y: y, kind: kind, amount: amount, bob: Math.random() * 6 });
  }
  function updatePickups(dt) {
    for (var i = pickups.length - 1; i >= 0; i--) {
      var pk = pickups[i];
      pk.bob += dt * 3;
      var d = SB.dist(pk.x, pk.y, player.x, player.y);
      if (d < SB.TUNE.pickupRadius) {
        if (pk.kind === "cash") {
          player.cash += pk.amount;
          S.toast("+" + SB.fmtMoney(pk.amount));
        } else if (pk.kind === "health") {
          player.hp = Math.min(100, player.hp + pk.amount);
          S.toast("Health +40");
        } else if (pk.kind === "smg") {
          player.weapon = "smg"; player.ammo = 120;
          S.toast("SMG picked up — 120 rounds");
        }
        SB.Audio.pickup();
        pickups.splice(i, 1);
      }
    }
  }

  // ---------- particles ----------
  function addParticle(p) { particles.push(p); if (particles.length > 400) particles.splice(0, particles.length - 400); }
  function spawnSparks(x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = SB.rand(0, Math.PI * 2), s = SB.rand(60, 260);
      addParticle({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35, max: 0.35, color: "#ffd94c", size: 2.5, type: "spark" });
    }
  }
  function spawnMuzzle(x, y) {
    addParticle({ x: x, y: y, vx: 0, vy: 0, life: 0.06, max: 0.06, color: "#ffe98a", size: 9, type: "flash" });
  }
  function spawnBlood(x, y) {
    for (var i = 0; i < 8; i++) {
      var a = SB.rand(0, Math.PI * 2), s = SB.rand(30, 160);
      addParticle({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5, color: "#a01824", size: 3, type: "blood" });
    }
  }
  function spawnExplosion(x, y) {
    for (var i = 0; i < 26; i++) {
      var a = SB.rand(0, Math.PI * 2), s = SB.rand(40, 320);
      addParticle({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: SB.rand(0.4, 0.9), max: 0.9, color: SB.pick(["#ff8a3c", "#ffc93c", "#ff4c2e", "#5a5a5a"]), size: SB.rand(4, 9), type: "fire" });
    }
    for (var j = 0; j < 10; j++) {
      var a2 = SB.rand(0, Math.PI * 2), s2 = SB.rand(10, 60);
      addParticle({ x: x, y: y, vx: Math.cos(a2) * s2, vy: Math.sin(a2) * s2 - 30, life: SB.rand(1, 2), max: 2, color: "#666", size: SB.rand(8, 16), type: "smoke" });
    }
  }
  function spawnSmoke(x, y) {
    addParticle({ x: x, y: y, vx: SB.rand(-12, 12), vy: SB.rand(-50, -25), life: SB.rand(0.8, 1.4), max: 1.4, color: "#555", size: SB.rand(6, 12), type: "smoke" });
  }
  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - dt * 2); p.vy *= (1 - dt * 2);
    }
  }

  // ---------- bullets ----------
  function updateBullets(dt) {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.life -= dt;
      var nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      var dead = b.life <= 0;
      // Building hit.
      if (!dead && SB.World.solidAt(nx, ny, 2)) {
        spawnSparks(nx, ny, 3);
        dead = true;
      }
      if (!dead && b.from === "player") {
        for (var e = 0; e < enemies.length; e++) {
          var en = enemies[e];
          if (!en.dead && SB.dist(nx, ny, en.x, en.y) < 16) { damageEnemy(en, b.dmg); dead = true; break; }
        }
        if (!dead) for (var c = 0; c < cars.length; c++) {
          var car = cars[c];
          if (car.driver === "player" || car.wrecked) continue;
          if (SB.dist(nx, ny, car.x, car.y) < 26) {
            damageCar(car, b.dmg, b.x, b.y);
            if (car.driver === "police") addWanted(1);
            dead = true; break;
          }
        }
        if (!dead) for (var p = 0; p < peds.length; p++) {
          var pd = peds[p];
          if (pd.state !== "down" && SB.dist(nx, ny, pd.x, pd.y) < 13) {
            pd.state = "down"; pd.downT = 6; spawnBlood(pd.x, pd.y);
            addWanted(1); S.toast("Civilian hit! Wanted +1");
            dead = true; break;
          }
        }
      }
      if (!dead && b.from === "enemy") {
        if (player.inCar) {
          if (SB.dist(nx, ny, player.inCar.x, player.inCar.y) < 26) {
            damageCar(player.inCar, b.dmg, b.x, b.y);
            dead = true;
          }
        } else if (SB.dist(nx, ny, player.x, player.y) < 14) {
          damagePlayer(b.dmg);
          dead = true;
        }
      }
      if (dead) { bullets.splice(i, 1); continue; }
      b.x = nx; b.y = ny;
    }
  }

  // ---------- player update ----------
  function updatePlayer(dt, input, mouse) {
    var p = player;
    p.fireT -= dt;
    if (p.inCar) {
      var c = p.inCar;
      p.x = c.x; p.y = c.y; p.angle = c.angle;
      p.speed = Math.abs(c.speed);
      // Drive-by shooting.
      if (input.mouseDown && p.fireT <= 0) {
        p.fireT = p.weapon === "smg" ? SB.TUNE.smgRate : SB.TUNE.pistolRate;
        var aim = Math.atan2(mouse.wy - p.y, mouse.wx - p.x);
        shoot(p.x, p.y, aim, p.weapon === "smg" ? SB.TUNE.smgDamage : SB.TUNE.pistolDamage, "player");
        if (p.weapon === "smg") { p.ammo--; if (p.ammo <= 0) p.weapon = "pistol"; }
        SB.Audio.shot();
        addWanted(0); // shooting from a car is loud: keeps the heat on
        scarePeds(p.x, p.y, 260);
      }
      if (input.pressed("KeyE")) tryEnterCar();
      return;
    }
    // On foot.
    var mx = (input.down("KeyD") || input.down("ArrowRight") ? 1 : 0) - (input.down("KeyA") || input.down("ArrowLeft") ? 1 : 0);
    var my = (input.down("KeyS") || input.down("ArrowDown") ? 1 : 0) - (input.down("KeyW") || input.down("ArrowUp") ? 1 : 0);
    var sprint = input.down("ShiftLeft") || input.down("ShiftRight");
    var spd = sprint ? SB.TUNE.playerSprint : SB.TUNE.playerRun;
    var len = Math.sqrt(mx * mx + my * my);
    p.moving = len > 0;
    if (len > 0) {
      moveWithCollision(p, (mx / len) * spd * dt, (my / len) * spd * dt, 14);
      p.speed = spd;
    } else p.speed = 0;
    p.angle = Math.atan2(mouse.wy - p.y, mouse.wx - p.x);
    if (input.mouseDown && p.fireT <= 0) {
      p.fireT = p.weapon === "smg" ? SB.TUNE.smgRate : SB.TUNE.pistolRate;
      shoot(p.x, p.y, p.angle, p.weapon === "smg" ? SB.TUNE.smgDamage : SB.TUNE.pistolDamage, "player");
      if (p.weapon === "smg") { p.ammo--; if (p.ammo <= 0) p.weapon = "pistol"; }
      SB.Audio.shot();
      addWanted(0); // firing a gun in public draws eyes
      scarePeds(p.x, p.y, 300);
      if (player.wanted === 0) { /* first shot: nearby peds call it in */ }
    }
    if (input.pressed("KeyE")) tryEnterCar();
  }

  // ---------- car update (player-driven + AI) ----------
  function carBlockedAt(x, y, c) {
    if (SB.World.solidAt(x, y, 20)) return true;
    var noseX = x + Math.cos(c.angle) * (c.len / 2 - 4);
    var noseY = y + Math.sin(c.angle) * (c.len / 2 - 4);
    return !!SB.World.solidAt(noseX, noseY, 8);
  }
  function driveCar(c, dt, throttle, steer) {
    var t = SB.CAR_TYPES[c.type];
    if (throttle > 0) c.speed += t.accel * throttle * dt;
    else if (throttle < 0) c.speed += t.accel * throttle * 0.7 * dt;
    else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 240 * dt);
    // Drag + reverse cap.
    c.speed -= c.speed * 0.25 * dt;
    c.speed = SB.clamp(c.speed, -t.top * 0.45, t.top);
    var spdFrac = Math.abs(c.speed) / t.top;
    c.angle += steer * t.grip * spdFrac * dt * (c.speed < 0 ? -1 : 1);
    var nx = c.x + Math.cos(c.angle) * c.speed * dt;
    var ny = c.y + Math.sin(c.angle) * c.speed * dt;
    // Building / water collision, per axis so the car scrapes along walls.
    var hit = false;
    if (!carBlockedAt(nx, ny, c)) { c.x = nx; c.y = ny; }
    else if (!carBlockedAt(nx, c.y, c)) { c.x = nx; hit = true; }
    else if (!carBlockedAt(c.x, ny, c)) { c.y = ny; hit = true; }
    else hit = true;
    if (hit) {
      if (Math.abs(c.speed) > 150) {
        damageCar(c, Math.abs(c.speed) * 0.06, c.x, c.y);
        SB.Audio.crash(Math.abs(c.speed) > 260);
        spawnSparks(nx, ny, 6);
        S.shake = Math.max(S.shake, 4);
      }
      c.speed *= -0.25;
    }
    // Off-road slows the car.
    if (!SB.World.onRoad(c.x, c.y) && !SB.World.isBeach(c.x, c.y)) c.speed *= (1 - 0.35 * dt);
    if (c.hp < 45 && Math.random() < dt * 6) spawnSmoke(c.x - Math.cos(c.angle) * 10, c.y - Math.sin(c.angle) * 10);
  }
  function carAheadBlocked(c, dist) {
    var fx = c.x + Math.cos(c.angle), fy = c.y + Math.sin(c.angle);
    for (var i = 0; i < cars.length; i++) {
      var o = cars[i];
      if (o === c) continue;
      var dx = o.x - c.x, dy = o.y - c.y;
      var along = dx * fx + dy * fy;
      var side = Math.abs(-dx * fy + dy * fx);
      if (along > 0 && along < dist && side < 30) return true;
      // Nose check: stop for any car right in front of the bumper,
      // even one crossing the intersection sideways.
      var nx = c.x + Math.cos(c.angle) * 46, ny = c.y + Math.sin(c.angle) * 46;
      if (SB.dist(o.x, o.y, nx, ny) < 42) return true;
    }
    var pd = SB.dist(player.x, player.y, c.x, c.y);
    if (player.inCar !== c && pd < dist && pd > 0) {
      var dx2 = player.x - c.x, dy2 = player.y - c.y;
      var along2 = dx2 * fx + dy2 * fy;
      if (along2 > 0 && along2 < dist) return true;
    }
    return false;
  }
  function updateTrafficCar(c, dt) {
    c.turnT -= dt;
    var road = SB.World.nearestRoad(c.x, c.y);
    var wantSpeed = carAheadBlocked(c, 80) ? 0 : c.cruise;
    var throttle = wantSpeed > Math.abs(c.speed) ? 1 : 0;
    if (wantSpeed === 0) throttle = c.speed > 20 ? -0.6 : 0;
    // Lane keeping: pull toward the road center + lane offset.
    var laneOff = c.lane * 22;
    var axisV = Math.abs(Math.sin(c.angle)) > 0.7;
    if (axisV) {
      var targetX = road.axis === "v" ? road.center + laneOff : c.x;
      c.x += SB.clamp(targetX - c.x, -60 * dt, 60 * dt);
    } else {
      var targetY = road.axis === "h" ? road.center + laneOff : c.y;
      c.y += SB.clamp(targetY - c.y, -60 * dt, 60 * dt);
    }
    // At an intersection, maybe turn.
    var onCross = false;
    if (axisV) {
      for (var j = 0; j < SB.H_ROADS.length; j++)
        if (Math.abs(c.y - SB.H_ROADS[j]) < 26) onCross = true;
    } else {
      for (var i = 0; i < SB.V_ROADS.length; i++)
        if (Math.abs(c.x - SB.V_ROADS[i]) < 26) onCross = true;
    }
    if (onCross && c.turnT <= 0 && Math.random() < dt * 1.2) {
      c.turnT = 3;
      var r = Math.random();
      if (r < 0.18) { // turn left
        c.angle += Math.PI / 2 * (axisV ? (Math.sin(c.angle) > 0 ? 1 : -1) : (Math.cos(c.angle) > 0 ? -1 : 1));
      } else if (r < 0.36) { // turn right
        c.angle -= Math.PI / 2 * (axisV ? (Math.sin(c.angle) > 0 ? 1 : -1) : (Math.cos(c.angle) > 0 ? -1 : 1));
      }
      c.angle = Math.round(c.angle / (Math.PI / 2)) * (Math.PI / 2);
    }
    driveCar(c, dt, throttle, 0);
    // Respawn far-away traffic near the player.
    if (SB.dist(c.x, c.y, player.x, player.y) > 1100) {
      var p = SB.World.randomRoadPoint();
      if (SB.dist(p.x, p.y, player.x, player.y) < 900 && SB.dist(p.x, p.y, player.x, player.y) > 450) {
        c.x = p.x; c.y = p.y;
        c.angle = p.axis === "v" ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI);
      }
    }
  }
  function updatePoliceCar(c, dt) {
    var tx = player.x, ty = player.y;
    var d = SB.dist(c.x, c.y, tx, ty);
    var want = SB.angleTo(c.x, c.y, tx, ty);
    var throttle = 1;
    if (d < 60) {
      // In contact: reverse out instead of grinding against the player.
      want = SB.angleTo(tx, ty, c.x, c.y);
      throttle = -0.8;
    } else if (d < 90) {
      // Too close: swing around for another pass instead of pinning the player.
      want = SB.angleTo(c.x, c.y, tx, ty) + Math.PI * 0.75;
      throttle = 0.7;
    } else if (d < 170) throttle = 0.5;
    var diff = SB.angleDiff(c.angle, want);
    var steer = SB.clamp(diff * 2.2, -1, 1);
    driveCar(c, dt, throttle, steer);
    // Unstick: if barely moving while trying, respawn on a nearby road.
    if (Math.abs(c.speed) < 15 && throttle > 0) {
      c.stuckT += dt;
      if (c.stuckT > 2.5) {
        c.stuckT = 0;
        var p = SB.World.randomRoadPoint();
        if (SB.dist(p.x, p.y, player.x, player.y) > 400 && SB.dist(p.x, p.y, player.x, player.y) < 750) {
          c.x = p.x; c.y = p.y; c.speed = 0;
        }
      }
    } else c.stuckT = 0;
    // Ram damage, with a cooldown so a chase does not shred a car in seconds.
    if (d < 46 && Math.abs(c.speed) > 60 && S.time - (c.lastRam || -99) > 1.5) {
      c.lastRam = S.time;
      if (player.inCar) damageCar(player.inCar, 12, c.x, c.y);
      else damagePlayer(12);
      S.shake = Math.max(S.shake, 3);
    }
    // Cops shoot at 3+ stars when close with line of sight.
    if (player.wanted >= 3 && d < 380 && !SB.World.losBlocked(c.x, c.y, player.x, player.y)) {
      c.shootT -= dt;
      if (c.shootT <= 0) {
        c.shootT = SB.rand(0.9, 1.6);
        shoot(c.x, c.y, want + SB.rand(-0.2, 0.2), SB.TUNE.enemyDamage, "enemy");
        SB.Audio.enemyShot();
      }
    }
    // Busted: pinned on foot by a close police car.
    if (!player.inCar && player.wanted > 0 && d < 52 && player.speed < 40) {
      bustTimer += dt;
      if (bustTimer > SB.TUNE.bustTime) S.events.push("busted");
    } else bustTimer = Math.max(0, bustTimer - dt * 2);
  }
  function updateCars(dt, input) {
    // Player car.
    if (player.inCar) {
      var c = player.inCar;
      var throttle = 0;
      if (input.down("KeyW") || input.down("ArrowUp")) throttle = 1;
      else if (input.down("KeyS") || input.down("ArrowDown")) throttle = -1;
      var steer = 0;
      if (input.down("KeyA") || input.down("ArrowLeft")) steer = -1;
      else if (input.down("KeyD") || input.down("ArrowRight")) steer = 1;
      if (input.down("Space")) { c.speed *= (1 - 2.4 * dt); }
      driveCar(c, dt, throttle, steer);
      SB.Audio.setEngine(true, Math.abs(c.speed) / c.top);
    } else SB.Audio.setEngine(false, 0);
    for (var i = cars.length - 1; i >= 0; i--) {
      var car = cars[i];
      if (car.wrecked) {
        car.explodeT -= dt;
        if (Math.random() < dt * 8) spawnSmoke(car.x, car.y);
        if (car.explodeT <= 0) { explodeCar(car); continue; }
        continue;
      }
      if (car.driver === "traffic") updateTrafficCar(car, dt);
      else if (car.driver === "police") updatePoliceCar(car, dt);
    }
    // Car-car collisions (circle approx).
    for (var a = 0; a < cars.length; a++) {
      for (var b = a + 1; b < cars.length; b++) {
        var ca = cars[a], cb = cars[b];
        var dx = cb.x - ca.x, dy = cb.y - ca.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        var min = 38;
        if (d > 0.01 && d < min) {
          var push = (min - d) / 2;
          var nx2 = dx / d, ny2 = dy / d;
          ca.x -= nx2 * push; ca.y -= ny2 * push;
          cb.x += nx2 * push; cb.y += ny2 * push;
          var rel = Math.abs(ca.speed - cb.speed);
          if (rel > 120) {
            damageCar(ca, rel * 0.05, cb.x, cb.y);
            damageCar(cb, rel * 0.05, ca.x, ca.y);
            SB.Audio.crash(rel > 260);
            spawnSparks((ca.x + cb.x) / 2, (ca.y + cb.y) / 2, 4);
            // Hard hit: both lose some speed, but each keeps its own
            // momentum (no swap — a swap stops the faster car dead).
            ca.speed *= 0.7; cb.speed *= 0.7;
          }
        }
      }
    }
    // Wanted: keep police numbers matched to stars.
    var want = player.wanted;
    var have = policeCount();
    if (want > 0 && have < Math.min(want, 4) && Math.random() < dt * 1.5) spawnPoliceCar();
    if (want === 0 && have > 0 && Math.random() < dt * 0.5) {
      for (var k = cars.length - 1; k >= 0; k--) {
        if (cars[k].driver === "police" && SB.dist(cars[k].x, cars[k].y, player.x, player.y) > 500) {
          cars.splice(k, 1); break;
        }
      }
    }
    // Siren volume by nearest police distance.
    var nearest = 1e9;
    for (var s = 0; s < cars.length; s++)
      if (cars[s].driver === "police") nearest = Math.min(nearest, SB.dist(cars[s].x, cars[s].y, player.x, player.y));
    SB.Audio.setSiren(nearest < 600 ? 1 - nearest / 600 : 0);
    // Wanted decay.
    if (want > 0 && S.time - player.lastCrime > SB.TUNE.wantedDecayDelay) {
      if (!S.decayT) S.decayT = 0;
      S.decayT += dt;
      if (S.decayT > SB.TUNE.wantedDecayStep) {
        S.decayT = 0;
        player.wanted--;
        if (player.wanted === 0) S.toast("You lost the cops.");
      }
    } else S.decayT = 0;
    // Keep traffic topped up.
    var traffic = 0;
    for (var t = 0; t < cars.length; t++) if (cars[t].driver === "traffic") traffic++;
    if (traffic < SB.TUNE.trafficCount && Math.random() < dt * 1.2) spawnTrafficCar(false);
  }

  function update(dt, input, mouse) {
    updatePlayer(dt, input, mouse);
    updateCars(dt, input);
    updatePeds(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateParticles(dt);
    updatePickups(dt);
  }

  return {
    reset: reset,
    update: update,
    get player() { return player; },
    get cars() { return cars; },
    get peds() { return peds; },
    get enemies() { return enemies; },
    get bullets() { return bullets; },
    get particles() { return particles; },
    get pickups() { return pickups; },
    makeCar: makeCar,
    spawnEnemy: spawnEnemy,
    spawnPoliceCar: spawnPoliceCar,
    addPickup: addPickup,
    addWanted: addWanted,
    damagePlayer: damagePlayer,
    damageEnemy: damageEnemy,
    damageCar: damageCar,
    nearestCar: nearestCar,
    tryEnterCar: tryEnterCar,
    exitCar: exitCar,
    scarePeds: scarePeds,
    spawnExplosion: spawnExplosion,
    spawnSparks: spawnSparks,
    carCorners: carCorners,
  };
})();
