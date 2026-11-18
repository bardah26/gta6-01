// missions.js — the story: six jobs for La Jefa, in order.
// Dante Reyes is back in Solara Bay to clear his brother Leo, framed
// for a dock heist by kingpin Silas Kane. Each job pays and moves the
// story toward Kane.
SB.Missions = (function () {
  var E = null; // SB.Entities, bound at init
  var S = null; // game state
  var current = null; // {def, stage, data}
  var index = -1;     // index into DEFS of the current mission
  var storyDone = false;

  function callLaJefa(text) {
    S.banner = { title: "Incoming call — La Jefa", text: text, t: 5 };
    SB.Audio.phone();
  }

  var DEFS = [
    {
      id: "welcome-home", title: "Welcome Home", reward: 100,
      intro: "Dante. You're back. Leo's in a cell for a job he never pulled. Come see me at the bar — we start tonight.",
      setup: function () {},
      objective: function () { return { text: "Go to La Jefa's Bar in Barrio del Sol", x: SB.PLACES.jefasBar.x, y: SB.PLACES.jefasBar.y }; },
      update: function () {
        if (SB.dist(E.player.x, E.player.y, SB.PLACES.jefasBar.x, SB.PLACES.jefasBar.y) < 80) return "done";
        return null;
      },
    },
    {
      id: "the-pickup", title: "The Pickup", reward: 250,
      intro: "A Comet GT is parked on Neon Row. 'Borrow' it and bring it to Rico's Garage. Try not to get seen.",
      setup: function (m) {
        var c = E.makeCar(1560, 1080, 0, "sports", "parked");
        c.mission = "pickup"; c.color = "#e83a4c";
        m.data.car = c;
        m.data.spot = { x: 1560, y: 1080 };
      },
      objective: function (m) {
        if (m.stage === 0) return { text: "Steal the red Comet GT on Neon Row (E to enter)", x: m.data.spot.x, y: m.data.spot.y };
        return { text: "Deliver the Comet GT to Rico's Garage", x: SB.PLACES.garage.x, y: SB.PLACES.garage.y };
      },
      update: function (m) {
        if (m.stage === 0 && E.player.inCar === m.data.car) { m.stage = 1; S.toast("Nice ride. Now get it to the garage."); }
        if (m.stage === 1 && E.player.inCar === m.data.car &&
            SB.dist(E.player.x, E.player.y, SB.PLACES.garage.x, SB.PLACES.garage.y) < 90) return "done";
        return null;
      },
    },
    {
      id: "debt-collection", title: "Debt Collection", reward: 0, paidByPickup: true,
      intro: "Tommy Fingers owes me forty grand and he is hiding in the Barrio with two friends. Collect. In cash. Use whatever language he understands.",
      setup: function (m) {
        var base = { x: 700, y: 1150 };
        m.data.base = base;
        m.data.crew = [
          E.spawnEnemy(base.x, base.y, 100),
          E.spawnEnemy(base.x + 60, base.y + 40, 100),
          E.spawnEnemy(base.x - 50, base.y + 50, 100),
        ];
        m.data.paid = false;
      },
      objective: function (m) {
        var alive = m.data.crew.filter(function (e) { return !e.dead; }).length;
        if (alive > 0) return { text: "Deal with Tommy Fingers and his crew (" + alive + " left)", x: m.data.base.x, y: m.data.base.y };
        return { text: "Grab the cash Tommy was sitting on", x: m.data.base.x, y: m.data.base.y };
      },
      update: function (m) {
        var alive = m.data.crew.filter(function (e) { return !e.dead; }).length;
        if (alive === 0 && !m.data.paid) {
          m.data.paid = true;
          m.data.cashBefore = E.player.cash;
          E.addPickup(m.data.base.x, m.data.base.y, "cash", 400);
          S.toast("That's the money. Grab it.");
        }
        if (m.data.paid && E.player.cash > m.data.cashBefore) return "done";
        return null;
      },
    },
    {
      id: "hot-pursuit", title: "Hot Pursuit", reward: 500,
      intro: "The job went loud, Dante. SBPD is all over you. Lose them and get to the safehouse — do NOT lead them to my door.",
      setup: function () {
        E.addWanted(3);
        E.spawnPoliceCar(); E.spawnPoliceCar();
        S.toast("WANTED: 3 stars — lose the cops!");
      },
      objective: function () { return { text: "Escape the police — reach the Safehouse", x: SB.PLACES.safehouse.x, y: SB.PLACES.safehouse.y }; },
      update: function () {
        if (SB.dist(E.player.x, E.player.y, SB.PLACES.safehouse.x, SB.PLACES.safehouse.y) < 90) {
          E.player.wanted = 0;
          return "done";
        }
        return null;
      },
    },
    {
      id: "dockside-deal", title: "Dockside Deal", reward: 0, paidByPickup: true,
      intro: "Kane's crew is moving product through the Portside docks tonight. Hit them, take the ledger. That book clears Leo.",
      setup: function (m) {
        var base = { x: SB.PLACES.docks.x, y: SB.PLACES.docks.y };
        m.data.base = base;
        m.data.crew = [];
        for (var i = 0; i < 5; i++)
          m.data.crew.push(E.spawnEnemy(base.x + SB.rand(-140, 140), base.y + SB.rand(-110, 110), 100));
        E.addPickup(base.x + 180, base.y - 60, "smg", 0);
        m.data.ledger = false;
      },
      objective: function (m) {
        var alive = m.data.crew.filter(function (e) { return !e.dead; }).length;
        if (alive > 0) return { text: "Take down Kane's dock crew (" + alive + " left)", x: m.data.base.x, y: m.data.base.y };
        return { text: "Grab the ledger from the dock office", x: m.data.base.x, y: m.data.base.y };
      },
      update: function (m) {
        var alive = m.data.crew.filter(function (e) { return !e.dead; }).length;
        if (alive === 0 && !m.data.ledger) {
          m.data.ledger = true;
          m.data.cashBefore = E.player.cash;
          E.addPickup(m.data.base.x, m.data.base.y, "cash", 800);
          S.toast("Crew's down. Grab the ledger and the cash.");
        }
        if (m.data.ledger && E.player.cash > m.data.cashBefore) return "done";
        return null;
      },
    },
    {
      id: "kingpins-fall", title: "Kingpin's Fall", reward: 1500,
      intro: "This is it. Kane is running the docks in his armored Rhino. Wreck that car, then finish it face to face. For Leo.",
      setup: function (m) {
        var c = E.makeCar(3050, 1550, Math.PI / 2, "armored", "traffic");
        c.mission = "kane"; c.cruise = 300; c.hp = 320;
        m.data.car = c;
        m.data.kane = null;
        m.data.lastPos = { x: c.x, y: c.y };
      },
      objective: function (m) {
        if (!m.data.kane) {
          var c = m.data.car;
          return { text: "Destroy Kane's armored Rhino", x: c.x, y: c.y };
        }
        return { text: "Finish it — take down Silas Kane", x: m.data.kane.x, y: m.data.kane.y };
      },
      update: function (m) {
        var c = m.data.car;
        var alive = E.cars.indexOf(c) >= 0;
        if (alive) m.data.lastPos = { x: c.x, y: c.y };
        if (!alive && !m.data.kane) {
          // The Rhino is wrecked: Kane bails out fighting.
          m.data.kane = E.spawnEnemy(m.data.lastPos.x, m.data.lastPos.y, 150);
          S.toast("Kane's out of the car! He's armed!");
          SB.Audio.explosion();
        }
        if (m.data.kane && m.data.kane.dead) return "done";
        return null;
      },
    },
  ];

  function startMission(i) {
    index = i;
    var def = DEFS[i];
    current = { def: def, stage: 0, data: {} };
    def.setup(current);
    callLaJefa(def.intro);
    S.missionTitle = def.title;
  }
  function startNext() {
    if (index + 1 < DEFS.length) startMission(index + 1);
    else {
      storyDone = true;
      S.banner = { title: "Story complete", text: "Leo is free. Solara Bay is yours, Dante — free roam.", t: 8 };
      SB.Audio.jingle();
    }
  }
  function completeCurrent() {
    var def = current.def;
    var reward = def.paidByPickup ? 0 : def.reward;
    if (reward > 0) E.player.cash += reward;
    S.banner = {
      title: "Job done — " + def.title,
      text: reward > 0 ? "La Jefa paid " + SB.fmtMoney(reward) + "." : "You kept the cash. La Jefa is pleased.",
      t: 6,
    };
    SB.Audio.jingle();
    S.events.push("missionComplete");
    if (def.id === "kingpins-fall") S.events.push("storyComplete");
    current = null;
    S.nextMissionT = 4; // next job rings in a few seconds
  }
  function failCurrent(reason) {
    if (!current) return;
    S.banner = { title: "Job failed — " + current.def.title, text: reason + " The job is waiting when you're ready.", t: 6 };
    SB.Audio.fail();
    current = null;
    S.nextMissionT = 6;
  }
  function restartCurrent() {
    if (index >= 0 && index < DEFS.length) startMission(index);
  }
  function update(dt) {
    if (!current) return;
    var res = current.def.update(current, dt);
    if (res === "done") completeCurrent();
  }
  function objective() {
    if (!current) return null;
    return current.def.objective(current);
  }
  function init(entities, state) {
    E = entities; S = state;
  }

  return {
    init: init,
    startMission: startMission,
    startNext: startNext,
    completeCurrent: completeCurrent,
    failCurrent: failCurrent,
    restartCurrent: restartCurrent,
    update: update,
    objective: objective,
    get current() { return current; },
    get index() { return index; },
    get storyDone() { return storyDone; },
    get count() { return DEFS.length; },
    setIndex: function (i) { index = i; },
    setStoryDone: function (v) { storyDone = v; },
    get defs() { return DEFS; },
  };
})();
