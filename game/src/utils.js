// utils.js — small math and collision helpers.
SB.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
SB.lerp = function (a, b, t) { return a + (b - a) * t; };
SB.dist = function (x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
};
SB.dist2 = function (x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  return dx * dx + dy * dy;
};
SB.angleTo = function (x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); };
// Shortest signed turn from angle a to angle b, in (-PI, PI].
SB.angleDiff = function (a, b) {
  var d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
};
SB.rand = function (a, b) { return a + Math.random() * (b - a); };
SB.randInt = function (a, b) { return Math.floor(SB.rand(a, b + 1)); };
SB.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
SB.fmtMoney = function (n) {
  return "$" + Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
SB.fmtTime = function (t) {
  // t: 0..1 across the day, 0 = 06:00 dawn. Returns "HH:MM".
  var mins = Math.floor((6 * 60 + t * 24 * 60) % (24 * 60));
  var h = Math.floor(mins / 60), m = mins % 60;
  return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
};
// Circle vs axis-aligned rect: push circle center out, return true on hit.
SB.circleRectResolve = function (cx, cy, r, rx, ry, rw, rh) {
  var nx = SB.clamp(cx, rx, rx + rw), ny = SB.clamp(cy, ry, ry + rh);
  var dx = cx - nx, dy = cy - ny;
  var d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) {
    var d = Math.sqrt(d2);
    return { x: cx + (dx / d) * (r - d), y: cy + (dy / d) * (r - d) };
  }
  // Center inside rect: push out along the smallest penetration axis.
  var left = cx - rx, right = rx + rw - cx, top = cy - ry, bot = ry + rh - cy;
  var m = Math.min(left, right, top, bot);
  if (m === left) return { x: rx - r, y: cy };
  if (m === right) return { x: rx + rw + r, y: cy };
  if (m === top) return { x: cx, y: ry - r };
  return { x: cx, y: ry + rh + r };
};
// Point in rect.
SB.pointInRect = function (x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
};
// Segment (x1,y1)-(x2,y2) vs rect: true if the segment touches the rect.
SB.segmentHitsRect = function (x1, y1, x2, y2, rx, ry, rw, rh) {
  if (SB.pointInRect(x1, y1, rx, ry, rw, rh) || SB.pointInRect(x2, y2, rx, ry, rw, rh)) return true;
  var dx = x2 - x1, dy = y2 - y1;
  function cross(ox, oy, ex, ey) {
    var den = dx * (ey - oy) - dy * (ex - ox);
    if (Math.abs(den) < 1e-9) return false;
    var u = ((ox - x1) * dy - (oy - y1) * dx) / den;
    var s = ((ox - x1) * (ey - oy) - (oy - y1) * (ex - ox)) / den;
    return s >= 0 && s <= 1 && u >= 0 && u <= 1;
  }
  return cross(rx, ry, rx + rw, ry) || cross(rx + rw, ry, rx + rw, ry + rh) ||
    cross(rx + rw, ry + rh, rx, ry + rh) || cross(rx, ry + rh, rx, ry);
};
