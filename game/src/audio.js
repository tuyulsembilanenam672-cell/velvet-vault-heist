// Velvet Vault — all sound is synthesized with WebAudio. No audio files.
// A tiny synth: tones, filtered noise and a two-tone alarm loop whose gain
// follows the alarm meter. Created lazily on the first user gesture so the
// browser's autoplay policy never blocks the page.
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var alarmNodes = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return ctx;
  }

  function tone(freq, dur, type, vol, delay, slideTo) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    var t0 = c.currentTime + (delay || 0);
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, delay) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    var t0 = c.currentTime + (delay || 0);
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource();
    src.buffer = buf;
    var f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 900;
    var g = c.createGain();
    g.gain.value = vol || 0.15;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
  }

  var api = {
    unlock: function () { ensure(); },
    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) api.stopAlarm();
      return muted;
    },
    isMuted: function () { return muted; },

    step: function (sneak) {
      // Soft cloth footstep; quieter while sneaking.
      noise(0.07, sneak ? 0.03 : 0.06, sneak ? 500 : 800);
    },
    pickup: function () {
      tone(660, 0.12, 'sine', 0.22);
      tone(880, 0.16, 'sine', 0.22, 0.09);
      tone(1320, 0.22, 'sine', 0.16, 0.18);
    },
    lockTick: function () { tone(1400, 0.04, 'square', 0.08); },
    lockOpen: function () {
      tone(520, 0.1, 'triangle', 0.2);
      tone(780, 0.18, 'triangle', 0.2, 0.08);
    },
    hack: function () { tone(980, 0.05, 'square', 0.07); },
    hackDone: function () {
      tone(740, 0.1, 'square', 0.12);
      tone(1108, 0.16, 'square', 0.12, 0.09);
    },
    vent: function () { noise(0.35, 0.18, 400); tone(180, 0.3, 'sine', 0.1, 0, 90); },
    doorOpen: function () {
      noise(0.4, 0.14, 300);
      tone(220, 0.35, 'triangle', 0.14, 0.05, 330);
    },
    spotted: function () {
      tone(196, 0.16, 'sawtooth', 0.18);
      tone(147, 0.24, 'sawtooth', 0.18, 0.14);
    },
    caught: function () {
      tone(320, 0.5, 'sawtooth', 0.25, 0, 60);
      noise(0.4, 0.2, 500);
    },
    laserZap: function () { tone(1800, 0.12, 'square', 0.12, 0, 300); },
    win: function () {
      var notes = [523, 659, 784, 1047, 1319];
      for (var i = 0; i < notes.length; i++) tone(notes[i], 0.28, 'triangle', 0.2, i * 0.11);
    },
    lose: function () {
      var notes = [392, 330, 262, 196];
      for (var i = 0; i < notes.length; i++) tone(notes[i], 0.34, 'sawtooth', 0.14, i * 0.16);
    },
    click: function () { tone(800, 0.05, 'sine', 0.12); },
    levelSting: function () {
      // Short low-key motif when a new level's briefing closes.
      tone(262, 0.18, 'triangle', 0.16);
      tone(392, 0.18, 'triangle', 0.16, 0.12);
      tone(523, 0.3, 'triangle', 0.18, 0.24);
    },

    startAlarm: function () {
      if (muted || alarmNodes) return;
      var c = ensure();
      if (!c) return;
      var o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = 620;
      var g = c.createGain();
      g.gain.value = 0.0;
      var lfo = c.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 1.6;
      var lfoGain = c.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(o.frequency);
      o.connect(g);
      g.connect(master);
      o.start();
      lfo.start();
      alarmNodes = { osc: o, lfo: lfo, gain: g };
    },
    setAlarmLevel: function (level) {
      // level 0..1 — the alarm loop fades in as the meter climbs.
      if (!alarmNodes) return;
      alarmNodes.gain.gain.setTargetAtTime(
        level > 0.55 ? 0.05 + 0.05 * (level - 0.55) / 0.45 : 0.0,
        ctx.currentTime, 0.15);
    },
    stopAlarm: function () {
      if (!alarmNodes) return;
      try { alarmNodes.osc.stop(); alarmNodes.lfo.stop(); } catch (e) {}
      alarmNodes = null;
    }
  };

  global.VV_AUDIO = api;
})(window);
