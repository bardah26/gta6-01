// menus.js — title screen, pause menu, how-to-play and end screens.
// All drawn on the canvas; mouse or keyboard (arrows + Enter) works.
SB.Menus = (function () {
  var W = 1280, H = 720;

  function button(ctx, S, x, y, w, h, label, selected) {
    var m = SB.Input.mouse;
    var hover = m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
    ctx.save();
    ctx.fillStyle = hover || selected ? "#ffd94c" : "rgba(10,14,24,0.85)";
    ctx.strokeStyle = "#ffd94c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = hover || selected ? "#111" : "#fff";
    ctx.font = "bold 17px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y + h / 2 + 6);
    ctx.restore();
    if (hover && SB.Input.mouseClicked) return true;
    if (selected && SB.Input.pressed("Enter")) return true;
    return false;
  }
  // Keyboard list navigation; returns the active index.
  function navList(S, n) {
    if (SB.Input.pressed("ArrowDown") || SB.Input.pressed("KeyS")) S.menuIndex = (S.menuIndex + 1) % n;
    if (SB.Input.pressed("ArrowUp") || SB.Input.pressed("KeyW")) S.menuIndex = (S.menuIndex - 1 + n) % n;
    return S.menuIndex;
  }
  function dim(ctx, a) {
    ctx.fillStyle = "rgba(5,8,18," + a + ")";
    ctx.fillRect(0, 0, W, H);
  }

  function drawTitle(ctx, S, saveExists) {
    dim(ctx, 0.55);
    // Neon title.
    ctx.save();
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff4fd8"; ctx.shadowBlur = 26;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px monospace";
    ctx.fillText("NEON STREETS", W / 2, 170);
    ctx.shadowColor = "#4ce8ff"; ctx.shadowBlur = 22;
    ctx.fillStyle = "#9adfff";
    ctx.font = "bold 34px monospace";
    ctx.fillText("OF SOLARA BAY", W / 2, 216);
    ctx.restore();
    ctx.fillStyle = "#ffd94c";
    ctx.font = "15px monospace";
    ctx.textAlign = "center";
    ctx.fillText("An open-world crime story  •  Dante Reyes is back in town", W / 2, 248);
    var items = saveExists
      ? ["Continue", "New Game", "How to Play", "Sound: " + (SB.Audio.isMuted() ? "Off" : "On")]
      : ["New Game", "How to Play", "Sound: " + (SB.Audio.isMuted() ? "Off" : "On")];
    navList(S, items.length);
    var bw = 320, bh = 46, bx = (W - bw) / 2, by = 300;
    for (var i = 0; i < items.length; i++) {
      if (button(ctx, S, bx, by + i * 58, bw, bh, items[i], S.menuIndex === i)) {
        if (items[i] === "Continue") return "continue";
        if (items[i] === "New Game") return "new";
        if (items[i] === "How to Play") return "howto";
        if (items[i].indexOf("Sound:") === 0) { SB.Audio.toggleMute(); return null; }
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "13px monospace";
    ctx.fillText("WASD move / drive  •  Mouse aim, Click shoot  •  E enter & steal cars  •  Esc pause", W / 2, 300 + items.length * 58 + 16);
    ctx.fillText("A fan-made original. Not affiliated with Rockstar Games.", W / 2, H - 18);
    return null;
  }

  function drawHowTo(ctx, S) {
    dim(ctx, 0.8);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd94c";
    ctx.font = "bold 30px monospace";
    ctx.fillText("HOW TO PLAY", W / 2, 90);
    var lines = [
      ["WASD / Arrows", "Move on foot, drive in a car"],
      ["Mouse", "Aim — Left Click shoots (pistol, or SMG if picked up)"],
      ["E", "Enter / exit a car — walk up to any car and take it"],
      ["Shift", "Sprint on foot"],
      ["Space", "Handbrake while driving"],
      ["P", "Save game (autosaves after every job)"],
      ["M", "Mute / unmute sound"],
      ["Esc", "Pause"],
      ["", ""],
      ["THE JOB", "Do jobs for La Jefa to clear your brother Leo."],
      ["", "Stealing cars and shooting in public raises your"],
      ["", "wanted stars — the SBPD will come for you."],
      ["", "Lose them, or reach a safehouse. Earn cash,"],
      ["", "buy nothing — just survive Solara Bay."],
    ];
    ctx.font = "15px monospace";
    var y = 140;
    for (var i = 0; i < lines.length; i++) {
      ctx.fillStyle = "#ffd94c";
      ctx.textAlign = "right";
      ctx.fillText(lines[i][0], W / 2 - 20, y);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.fillText(lines[i][1], W / 2 - 10, y);
      y += 26;
    }
    if (button(ctx, S, (W - 200) / 2, H - 90, 200, 46, "Back", false) || SB.Input.pressed("Escape")) return "back";
    return null;
  }

  function drawPause(ctx, S) {
    dim(ctx, 0.7);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 34px monospace";
    ctx.fillText("PAUSED", W / 2, 150);
    var items = ["Resume", "Save Game", "Restart Current Job", "How to Play", "Quit to Title"];
    navList(S, items.length);
    var bw = 320, bh = 46, bx = (W - bw) / 2, by = 210;
    for (var i = 0; i < items.length; i++) {
      if (button(ctx, S, bx, by + i * 58, bw, bh, items[i], S.menuIndex === i)) {
        if (items[i] === "Resume") return "resume";
        if (items[i] === "Save Game") return "save";
        if (items[i] === "Restart Current Job") return "restart";
        if (items[i] === "How to Play") return "howto";
        if (items[i] === "Quit to Title") return "quit";
      }
    }
    if (SB.Input.pressed("Escape")) return "resume";
    return null;
  }

  function drawEnd(ctx, S, kind) {
    dim(ctx, 0.75);
    ctx.textAlign = "center";
    if (kind === "wasted") {
      ctx.fillStyle = "#ff3b4c";
      ctx.font = "bold 72px monospace";
      ctx.fillText("WASTED", W / 2, 280);
      ctx.fillStyle = "#fff";
      ctx.font = "16px monospace";
      ctx.fillText("Dante woke up at Solara General, lighter by 10% of his cash.", W / 2, 330);
    } else if (kind === "busted") {
      ctx.fillStyle = "#4c9dff";
      ctx.font = "bold 72px monospace";
      ctx.fillText("BUSTED", W / 2, 280);
      ctx.fillStyle = "#fff";
      ctx.font = "16px monospace";
      ctx.fillText("The SBPD booked Dante. Bail cost 10% of his cash.", W / 2, 330);
    } else {
      ctx.fillStyle = "#ffd94c";
      ctx.font = "bold 56px monospace";
      ctx.fillText("LEO IS FREE", W / 2, 280);
      ctx.fillStyle = "#fff";
      ctx.font = "16px monospace";
      ctx.fillText("Kane is finished and the ledger clears Leo's name.", W / 2, 330);
      ctx.fillText("Solara Bay is yours now — free roam.", W / 2, 358);
    }
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "15px monospace";
    ctx.fillText("Press Enter to continue", W / 2, 430);
    if (SB.Input.pressed("Enter") || SB.Input.mouseClicked) return "continue";
    return null;
  }

  return {
    drawTitle: drawTitle,
    drawHowTo: drawHowTo,
    drawPause: drawPause,
    drawEnd: drawEnd,
  };
})();
