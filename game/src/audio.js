// audio.js — all sound and music is synthesized with WebAudio.
// No audio files, no network. Starts on the first user gesture.
SB.Audio = (function () {
  var ctx = null, master = null, musicGain = null, engineOsc = null,
    engineOsc2 = null, engineGain = null, sirenOsc = null, sirenGain = null,
    noiseBuf = null, musicTimer = null, muted = false, musicStep = 0,
    nextNoteTime = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return true;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch (e) { return false; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    // Shared noise buffer (1s white noise).
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Engine hum: two detuned saws through a lowpass, gain by speed.
    engineOsc = ctx.createOscillator(); engineOsc.type = "sawtooth"; engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = "square"; engineOsc2.frequency.value = 28;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(lp); engineOsc2.connect(lp);
    lp.connect(engineGain); engineGain.connect(master);
    engineOsc.start(); engineOsc2.start();
    // Police siren: two-tone square, gain by distance.
    sirenOsc = ctx.createOscillator(); sirenOsc.type = "triangle"; sirenOsc.frequency.value = 750;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();
    // Music bus.
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16;
    musicGain.connect(master);
    startMusic();
    return true;
  }

  // Synthwave bassline loop, 100 BPM, Am - F - C - G.
  var BASS = [55, 55, 55, 65.41, 55, 55, 43.65, 49, 55, 55, 55, 65.41, 55, 55, 87.31, 98];
  var LEAD = [220, 0, 261.63, 0, 329.63, 0, 261.63, 0, 196, 0, 246.94, 0, 293.66, 0, 329.63, 392];
  function startMusic() {
    nextNoteTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(function () {
      if (!ctx || muted) return;
      while (nextNoteTime < ctx.currentTime + 0.25) {
        scheduleStep(musicStep, nextNoteTime);
        musicStep = (musicStep + 1) % 16;
        nextNoteTime += 0.15; // 16th notes at ~100 BPM
      }
    }, 90);
  }
  function scheduleStep(step, t) {
    var bass = BASS[step];
    if (bass) blip("sawtooth", bass, t, 0.14, 0.5, musicGain);
    if (step % 4 === 0) kick(t);
    if (step % 4 === 2) hat(t);
    var lead = LEAD[step];
    if (lead && step % 2 === 0) blip("triangle", lead * 2, t, 0.1, 0.16, musicGain);
  }
  function blip(type, freq, t, dur, vol, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function kick(t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.16);
  }
  function hat(t) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 6000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(musicGain);
    s.start(t); s.stop(t + 0.05);
  }
  function burst(dur, vol, filterFreq, type) {
    if (!ctx) return;
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type || "lowpass"; f.frequency.value = filterFreq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(); s.stop(ctx.currentTime + dur + 0.02);
  }

  return {
    unlock: ensure,
    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    isMuted: function () { return muted; },
    setEngine: function (on, speedFrac) {
      if (!ctx) return;
      var t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on ? 0.05 + 0.06 * speedFrac : 0, t, 0.08);
      engineOsc.frequency.setTargetAtTime(50 + 130 * speedFrac, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(25 + 65 * speedFrac, t, 0.08);
    },
    setSiren: function (level) {
      if (!ctx) return;
      var t = ctx.currentTime;
      sirenGain.gain.setTargetAtTime(0.05 * level, t, 0.2);
      // Two-tone wail, period ~0.9s.
      var ph = (t % 0.9) < 0.45 ? 750 : 980;
      sirenOsc.frequency.setTargetAtTime(ph, t, 0.05);
    },
    shot: function () {
      if (!ctx) return;
      burst(0.12, 0.5, 1800);
      blip("sine", 160, ctx.currentTime, 0.09, 0.4);
    },
    enemyShot: function () { if (ctx) burst(0.1, 0.22, 1400); },
    explosion: function () {
      if (!ctx) return;
      burst(0.7, 0.9, 500);
      blip("sine", 70, ctx.currentTime, 0.5, 0.7);
    },
    crash: function (hard) { if (ctx) burst(hard ? 0.25 : 0.12, hard ? 0.6 : 0.3, 900); },
    pickup: function () {
      if (!ctx) return;
      blip("sine", 660, ctx.currentTime, 0.09, 0.3);
      blip("sine", 990, ctx.currentTime + 0.09, 0.14, 0.3);
    },
    jingle: function () {
      if (!ctx) return;
      var notes = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < notes.length; i++) blip("triangle", notes[i], ctx.currentTime + i * 0.11, 0.16, 0.32);
    },
    fail: function () {
      if (!ctx) return;
      var notes = [392, 311.13, 233.08];
      for (var i = 0; i < notes.length; i++) blip("sawtooth", notes[i], ctx.currentTime + i * 0.16, 0.22, 0.22);
    },
    phone: function () {
      if (!ctx) return;
      blip("sine", 1200, ctx.currentTime, 0.08, 0.25);
      blip("sine", 1200, ctx.currentTime + 0.14, 0.08, 0.25);
    },
  };
})();
