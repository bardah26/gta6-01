// input.js — keyboard and mouse state, with edge-triggered "pressed".
SB.Input = (function () {
  var keys = {};
  var pressedKeys = {};
  var mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, clicked: false, clickX: 0, clickY: 0 };
  var canvas = null;

  function attach(c) {
    canvas = c;
    window.addEventListener("keydown", function (e) {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "ArrowDown" ||
          e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Tab") e.preventDefault();
      if (!keys[e.code]) pressedKeys[e.code] = true;
      keys[e.code] = true;
      SB.Audio.unlock();
    });
    window.addEventListener("keyup", function (e) { keys[e.code] = false; });
    window.addEventListener("blur", function () { keys = {}; });
    canvas.addEventListener("mousemove", function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener("mousedown", function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      mouse.down = true;
      mouse.clicked = true;
      mouse.clickX = mouse.x; mouse.clickY = mouse.y;
      SB.Audio.unlock();
    });
    window.addEventListener("mouseup", function () { mouse.down = false; });
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }
  function down(code) { return !!keys[code]; }
  function pressed(code) { return !!pressedKeys[code]; }
  function endFrame() {
    pressedKeys = {};
    mouse.clicked = false;
  }
  return {
    attach: attach,
    down: down,
    pressed: pressed,
    endFrame: endFrame,
    mouse: mouse,
    get mouseDown() { return mouse.down; },
    get mouseClicked() { return mouse.clicked; },
  };
})();
