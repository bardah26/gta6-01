// main.js — game loop, state machine, camera, save/load, screenshot hooks.
// Modes: title, howto, play, pause, end (wasted / busted / story).
(function () {
  var canvas = document.getElementById("game");
  var E = SB.Entities, M = SB.Missions, R = SB.Render, I = SB.Input;

  var S = {
    mode: "title",
    prevMode: "title",
    time: 0,
    timeOfDay: 0.08, // morning
    cam: { x: 0, y: 0 },
    shake: 0,
    hurtFlash: 0,
    banner: null,
    toastMsg: "",
    toastT: 0,
    events: [],
    menuIndex: 0,
    nextMissionT: 0,
    retryMission: false,
    decayT: 0,
    lastPedCrime: -99,
    missionTitle: "",
    endKind: null,
    autopilot: false,
    autoSteer: 0,
    autoStuckT: 0,
    autoReverseT: 0,
    hideHUD: false,
    saveExists: false,
  };
  S.toast = function (msg) { S.toastMsg = msg; S.toastT = 3.5; };

  function saveGame() {
    try {
      var p = E.player;
      localStorage.setItem(SB.SAVE_KEY, JSON.stringify({
        version: SB.TUNE.saveVersion,
        cash: p.cash, hp: p.hp, wanted: p.wanted,
        missionIndex: M.index, storyDone: M.storyDone,
        x: p.x, y: p.y, timeOfDay: S.timeOfDay,
        weapon: p.weapon, ammo: p.ammo,
      }));
      S.saveExists = true;
    } catch (e) { /* storage unavailable: play on without saving */ }
  }
  function loadSave() {
    try {
      var raw = localStorage.getItem(SB.SAVE_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || d.version !== SB.TUNE.saveVersion) return null;
      return d;
    } catch (e) { return null; }
  }
  function applySave(d) {
    var p = E.player;
    p.cash = d.cash; p.hp = d.hp; p.wanted = d.wanted;
    p.x = d.x; p.y = d.y;
    p.weapon = d.weapon || "pistol"; p.ammo = d.ammo || 0;
    S.timeOfDay = d.timeOfDay || 0.08;
    M.setStoryDone(!!d.storyDone);
    if (d.storyDone) {
      S.toast("Welcome back, Dante. Solara Bay is yours.");
    } else if (d.missionIndex >= 0) {
      M.startMission(d.missionIndex);
    } else {
      M.startMission(0);
    }
  }
  function newGame() {
    E.reset(S);
    M.init(E, S);
    M.setStoryDone(false);
    M.startMission(0);
    S.mode = "play";
    S.timeOfDay = 0.08;
  }
  function continueGame() {
    E.reset(S);
    M.init(E, S);
    var d = loadSave();
    if (d) applySave(d);
    else M.startMission(0);
    S.mode = "play";
  }
  function respawn(place) {
    var p = E.player;
    if (p.inCar) { p.inCar.driver = "parked"; p.inCar = null; }
    p.x = place.x; p.y = place.y;
    p.hp = 100;
    p.wanted = 0;
    p.cash = Math.floor(p.cash * 0.9);
  }
  function processEvents() {
    for (var i = 0; i < S.events.length; i++) {
      var ev = S.events[i];
      if (ev === "wasted") {
        M.failCurrent("Dante got wasted.");
        respawn(SB.PLACES.hospital);
        S.endKind = "wasted";
        S.mode = "end";
        SB.Audio.fail();
      } else if (ev === "busted") {
        M.failCurrent("Dante got busted.");
        respawn(SB.PLACES.policeHQ);
        S.endKind = "busted";
        S.mode = "end";
        SB.Audio.fail();
      } else if (ev === "missionComplete") {
        saveGame();
      } else if (ev === "storyComplete") {
        S.endKind = "story";
        S.mode = "end";
        SB.Audio.jingle();
      }
    }
    S.events.length = 0;
  }

  // Autopilot for screenshot hooks: drives the player's car along roads.
  // It holds its current axis (long straight runs) and only turns when
  // the road ahead runs out near the map edge. Speed is capped so turns
  // stay tight and the car does not wedge itself into corners.
  function autoInput(car) {
    var headingEast = Math.cos(car.angle) >= 0;
    var headingSouth = Math.sin(car.angle) >= 0;
    var axisV = Math.abs(Math.sin(car.angle)) > 0.7;
    var target = car.angle;
    if (axisV) {
      target = headingSouth ? Math.PI / 2 : -Math.PI / 2;
      // Near the north/south edge, turn toward the map center.
      if (headingSouth && car.y > SB.WATER_SOUTH - 260) target = car.x < 1800 ? 0 : Math.PI;
      if (!headingSouth && car.y < 260) target = car.x < 1800 ? 0 : Math.PI;
    } else {
      target = headingEast ? 0 : Math.PI;
      // Near the east/west edge, turn toward the map center.
      if (headingEast && car.x > 3200) target = car.y < 1400 ? Math.PI / 2 : -Math.PI / 2;
      if (!headingEast && car.x < 260) target = car.y < 1400 ? Math.PI / 2 : -Math.PI / 2;
    }
    var diff = SB.angleDiff(car.angle, target);
    S.autoSteer = SB.clamp(diff * 2.5, -1, 1);
    // Wait if another car is right ahead (avoid intersection pile-ups).
    // Police cars do not count: in a chase you push straight through them.
    var blocked = false;
    var fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    for (var i = 0; i < E.cars.length; i++) {
      var o = E.cars[i];
      if (o === car || o.driver === "police") continue;
      var dx = o.x - car.x, dy = o.y - car.y;
      var along = dx * fx + dy * fy;
      var side = Math.abs(-dx * fy + dy * fx);
      if (along > 0 && along < 95 && side < 32) { blocked = true; break; }
    }
    var reversing = S.autoReverseT > 0;
    var cruising = Math.abs(car.speed) > 240; // coast at cruise speed
    return {
      down: function (code) {
        if (reversing) {
          if (code === "KeyS" || code === "ArrowDown") return true;
          if ((code === "KeyA" || code === "ArrowLeft") && S.autoSteer > 0.15) return true;
          if ((code === "KeyD" || code === "ArrowRight") && S.autoSteer < -0.15) return true;
          return false;
        }
        if ((code === "KeyW" || code === "ArrowUp") && !blocked && !cruising) return true;
        if ((code === "KeyA" || code === "ArrowLeft") && S.autoSteer < -0.15) return true;
        if ((code === "KeyD" || code === "ArrowRight") && S.autoSteer > 0.15) return true;
        return false;
      },
      pressed: function () { return false; },
      mouseDown: false,
      mouse: I.mouse,
    };
  }

  function updateCamera(dt) {
    var p = E.player;
    var tx = SB.clamp(p.x - R.VIEW_W / 2, 0, SB.WORLD_W - R.VIEW_W);
    var ty = SB.clamp(p.y - R.VIEW_H / 2, 0, SB.WORLD_H - R.VIEW_H);
    S.cam.x += (tx - S.cam.x) * Math.min(1, dt * 5);
    S.cam.y += (ty - S.cam.y) * Math.min(1, dt * 5);
    // District name for the HUD.
    p.district = SB.World.districtAt(p.x, p.y).name;
  }

  function updatePlay(dt) {
    // Next job rings in after a delay.
    if (S.nextMissionT > 0) {
      S.nextMissionT -= dt;
      if (S.nextMissionT <= 0) {
        if (S.retryMission) { S.retryMission = false; M.restartCurrent(); }
        else M.startNext();
      }
    }
    var input = I;
    if (S.autopilot && E.player.inCar) {
      // Unstick: reversing briefly when pinned at ~0 speed.
      if (Math.abs(E.player.inCar.speed) < 30) S.autoStuckT += dt;
      else S.autoStuckT = 0;
      if (S.autoStuckT > 1.2) { S.autoStuckT = 0; S.autoReverseT = 0.9; }
      if (S.autoReverseT > 0) S.autoReverseT -= dt;
      input = autoInput(E.player.inCar);
    }
    var mouse = { wx: I.mouse.x + S.cam.x, wy: I.mouse.y + S.cam.y, down: I.mouseDown };
    E.update(dt, input, mouse);
    M.update(dt);
    updateCamera(dt);
    processEvents();
    if (I.pressed("KeyP")) { saveGame(); S.toast("Game saved."); }
    if (I.pressed("KeyM")) SB.Audio.toggleMute();
    if (I.pressed("Escape")) {
      S.mode = "pause";
      S.menuIndex = 0;
    }
  }

  function updateTitle(dt) {
    // Slow pan across the city behind the menu.
    S.cam.x = (S.time * 36) % (SB.WORLD_W - R.VIEW_W);
    S.cam.y = 200 + Math.sin(S.time * 0.05) * 180;
  }

  var last = 0;
  function frame(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    S.time += dt;
    S.timeOfDay = (S.timeOfDay + dt / SB.TUNE.dayLength) % 1;
    if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
    if (S.toastT > 0) S.toastT -= dt;
    if (S.hurtFlash > 0) S.hurtFlash -= dt * 1.6;
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 22);

    var ctx = canvas.getContext("2d");
    if (S.mode === "title") {
      updateTitle(dt);
      S.hideHUD = true;
      R.drawFrame(S);
      S.hideHUD = false;
      var titleAction = SB.Menus.drawTitle(ctx, S, S.saveExists);
      if (titleAction === "new") newGame();
      else if (titleAction === "continue") continueGame();
      else if (titleAction === "howto") { S.prevMode = "title"; S.mode = "howto"; S.menuIndex = 0; }
    } else if (S.mode === "howto") {
      R.drawFrame(S);
      var back = SB.Menus.drawHowTo(ctx, S);
      if (back === "back") { S.mode = S.prevMode; S.menuIndex = 0; }
    } else if (S.mode === "play") {
      updatePlay(dt);
      if (S.mode === "play") R.drawFrame(S);
      else if (S.mode === "pause") { R.drawFrame(S); }
    } else if (S.mode === "pause") {
      R.drawFrame(S);
      var act = SB.Menus.drawPause(ctx, S);
      if (act === "resume") S.mode = "play";
      else if (act === "save") { saveGame(); S.toast("Game saved."); S.mode = "play"; }
      else if (act === "restart") {
        if (M.current) M.restartCurrent();
        S.mode = "play";
      } else if (act === "howto") { S.prevMode = "pause"; S.mode = "howto"; S.menuIndex = 0; }
      else if (act === "quit") { S.mode = "title"; S.menuIndex = 0; }
    } else if (S.mode === "end") {
      R.drawFrame(S);
      var cont = SB.Menus.drawEnd(ctx, S, S.endKind);
      if (cont === "continue") {
        if (S.endKind === "story") { S.mode = "play"; }
        else { S.mode = "play"; }
        S.endKind = null;
      }
    }
    I.endFrame();
    requestAnimationFrame(frame);
  }

  // Screenshot hooks: ?shot=start|drive|chase|mission
  // They set up a live scene with the real game running.
  function applyShotHook() {
    var q = new URLSearchParams(location.search);
    var shot = q.get("shot");
    if (!shot) return;
    if (shot === "start") return; // title screen is the default
    E.reset(S);
    M.init(E, S);
    if (shot === "drive") {
      S.timeOfDay = 0.12;
      var car = E.makeCar(1800, 1300, 0, "sports", "player");
      E.player.inCar = car;
      E.player.x = car.x; E.player.y = car.y;
      car.speed = 180;
      S.autopilot = true;
      S.mode = "play";
      M.startMission(0);
    } else if (shot === "chase") {
      S.timeOfDay = 0.78; // night
      var car2 = E.makeCar(1800, 800, 0, "sports", "player");
      E.player.inCar = car2;
      E.player.x = car2.x; E.player.y = car2.y;
      car2.speed = 180;
      E.addWanted(3);
      E.spawnPoliceCar(); E.spawnPoliceCar();
      S.autopilot = true;
      S.mode = "play";
      M.startMission(0);
    } else if (shot === "mission") {
      S.timeOfDay = 0.48; // dusk
      M.startMission(4);
      var p = E.player;
      p.x = SB.PLACES.docks.x - 260; p.y = SB.PLACES.docks.y + 40;
      p.weapon = "smg"; p.ammo = 120;
      S.mode = "play";
    }
    updateCamera(1);
  }

  function init() {
    R.init(canvas);
    I.attach(canvas);
    SB.World.generate();
    E.reset(S);
    M.init(E, S);
    S.saveExists = !!loadSave();
    applyShotHook();
    requestAnimationFrame(frame);
  }
  init();
})();
