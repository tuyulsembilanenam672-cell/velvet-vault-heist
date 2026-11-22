// Velvet Vault — bootstrap, input, screens and the game loop. The game is
// a single canvas; menus are drawn on it and clicked by canvas coordinates.
(function (global) {
  'use strict';

  var ENGINE = global.VV_ENGINE;
  var RENDER = global.VV_RENDER;
  var AUDIO = global.VV_AUDIO;
  var LEVELS = global.VV_LEVELS;

  var canvas = null;
  var ctx = null;
  var screen = 'title'; // title | briefing | play | paused | levelcomplete | gameover | victory
  var titleT = 0;
  var lastTs = 0;
  var buttons = []; // {x,y,w,h,label,action} for the current screen
  var results = []; // per-level stats for the victory screen

  var input = { up: false, down: false, left: false, right: false, sneak: false, interact: false };
  var keys = {};

  function S() { return ENGINE.getState(); }

  function startGame() {
    results = [];
    ENGINE.createLevel(0, { lives: 3, score: 0 });
    screen = 'briefing';
    AUDIO.unlock();
    AUDIO.levelSting();
  }

  function beginLevel() {
    screen = 'play';
    AUDIO.unlock();
  }

  function nextLevel() {
    var st = S();
    results.push(st.stats);
    if (st.levelIndex + 1 >= LEVELS.length) {
      screen = 'victory';
      AUDIO.win();
    } else {
      ENGINE.createLevel(st.levelIndex + 1, { lives: st.lives, score: st.score });
      screen = 'briefing';
      AUDIO.levelSting();
    }
  }

  function retryLevel() {
    var st = S();
    // Score at the start of this level = total after the previous level.
    var keepScore = st.levelIndex > 0 ? results[st.levelIndex - 1].total : 0;
    ENGINE.createLevel(st.levelIndex, { lives: 3, score: keepScore });
    results = results.slice(0, st.levelIndex);
    screen = 'briefing';
  }

  function toCanvasCoords(e) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * 1280 / r.width,
      y: (e.clientY - r.top) * 720 / r.height
    };
  }

  function button(x, y, w, h, label, action) {
    buttons.push({ x: x, y: y, w: w, h: h, label: label, action: action });
  }

  function drawButton(b, hover) {
    ctx.fillStyle = hover ? '#e8d27a' : '#c9a94a';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#f5e6a8';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#14141f';
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 6);
  }

  var hoverBtn = null;

  function onKey(e, down) {
    var k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) {
      e.preventDefault();
    }
    keys[k] = down;
    if (k === 'm' && down) {
      AUDIO.toggleMute();
      return;
    }
    if (down && (k === 'enter' || k === ' ')) {
      if (screen === 'title') { startGame(); return; }
      if (screen === 'briefing') { beginLevel(); return; }
      if (screen === 'levelcomplete') { nextLevel(); return; }
      if (screen === 'gameover') { retryLevel(); return; }
      if (screen === 'victory') { startGame(); return; }
    }
    if (down && k === 'p') {
      if (screen === 'play') screen = 'paused';
      else if (screen === 'paused') screen = 'play';
      return;
    }
    if (down && k === 'escape' && screen === 'play') { screen = 'paused'; return; }
    input.up = !!(keys['w'] || keys['arrowup']);
    input.down = !!(keys['s'] || keys['arrowdown']);
    input.left = !!(keys['a'] || keys['arrowleft']);
    input.right = !!(keys['d'] || keys['arrowright']);
    input.sneak = !!keys['shift'];
    input.interact = !!(keys['e'] || keys[' ']) || input.mouseInteract;
  }

  function onMouseDown(e) {
    AUDIO.unlock();
    var p = toCanvasCoords(e);
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        AUDIO.click();
        b.action();
        return;
      }
    }
    if (screen === 'play') {
      input.mouseInteract = true;
      input.interact = true;
    }
  }

  function onMouseUp() {
    input.mouseInteract = false;
    input.interact = !!(keys['e'] || keys[' ']);
  }

  function onMouseMove(e) {
    var p = toCanvasCoords(e);
    hoverBtn = null;
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        hoverBtn = b;
        break;
      }
    }
  }

  function drawTitle() {
    var st = S();
    if (st) RENDER.drawWorld(ctx, st);
    RENDER.overlay(ctx, '', [], '#e8d27a');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8d27a';
    ctx.font = 'bold 64px "Segoe UI", Arial, sans-serif';
    ctx.fillText('VELVET VAULT', 640, 250);
    ctx.fillStyle = '#d8c98a';
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    ctx.fillText('A top-down heist in three acts — gallery, bank, penthouse.', 640, 292);
    ctx.font = '16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#9a938a';
    ctx.fillText('Dodge the cones. Hack the cameras. Lift the loot. Slip out clean.', 640, 322);
    ctx.fillText('WASD move · Shift sneak · hold E to pick locks · P pause · M mute', 640, 352);
    button(490, 400, 300, 56, 'BEGIN THE HEIST', startGame);
    drawButton(buttons[buttons.length - 1], hoverBtn === buttons[buttons.length - 1]);
    ctx.fillStyle = '#8d8570';
    ctx.font = '13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Three lives. Ghost bonus if no guard ever spots you.', 640, 490);
  }

  function drawBriefing() {
    var st = S();
    RENDER.drawWorld(ctx, st);
    RENDER.overlay(ctx, '', [], '#e8d27a');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8d27a';
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ctx.fillText(st.def.name, 640, 220);
    ctx.fillStyle = '#c9c2ae';
    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(st.def.sub, 640, 252);
    ctx.fillStyle = '#d8c98a';
    ctx.font = '17px "Segoe UI", Arial, sans-serif';
    var lines = RENDER.wrapText(ctx, st.def.briefing, 760);
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], 640, 300 + i * 28);
    var y = 300 + lines.length * 28 + 20;
    ctx.fillStyle = '#9a938a';
    ctx.font = '15px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Targets: ' + st.requiredTotal + '  ·  Par time ' +
      Math.floor(st.def.par / 60) + ':' + String(st.def.par % 60).padStart(2, '0') +
      '  ·  Lives ' + st.lives + '  ·  Score $' + st.score, 640, y);
    button(490, y + 30, 300, 56, 'START LEVEL', beginLevel);
    drawButton(buttons[buttons.length - 1], hoverBtn === buttons[buttons.length - 1]);
  }

  function drawLevelComplete() {
    var st = S();
    RENDER.drawWorld(ctx, st);
    var s = st.stats;
    var lines = [
      'Time ' + Math.floor(s.time / 60) + ':' + String(Math.floor(s.time % 60)).padStart(2, '0') +
        '  ·  Time bonus $' + s.timeBonus,
      'Ghost bonus $' + s.ghostBonus + (s.ghostBonus ? ' — never spotted!' : ' — spotted along the way'),
      'Loot lifted: ' + st.lootTaken + ' of ' + st.def.loot.length,
      'Score $' + s.total
    ];
    RENDER.overlay(ctx, 'CLEAN GETAWAY', lines, '#7dffab');
    var last = st.levelIndex + 1 >= LEVELS.length;
    button(490, 470, 300, 56, last ? 'SEE THE TAKE' : 'NEXT LEVEL', nextLevel);
    drawButton(buttons[buttons.length - 1], hoverBtn === buttons[buttons.length - 1]);
  }

  function drawGameOver() {
    var st = S();
    RENDER.overlay(ctx, 'BUSTED', [
      'The crew caught up with you in ' + st.def.name + '.',
      'Score $' + st.score,
      'The vault keeps its secrets — this time.'
    ], '#ff7070');
    button(490, 430, 300, 56, 'TRY AGAIN', retryLevel);
    drawButton(buttons[buttons.length - 1], hoverBtn === buttons[buttons.length - 1]);
  }

  function drawVictory() {
    var st = S();
    var total = st ? st.score : 0;
    var lines = ['All three jobs done. The Velvet Vault is empty — and so is the trail.'];
    for (var i = 0; i < results.length; i++) {
      lines.push(LEVELS[i].name + ': $' + results[i].total);
    }
    lines.push('Total take: $' + total);
    RENDER.overlay(ctx, 'THE PERFECT HEIST', lines, '#ffd76a');
    button(490, 300 + lines.length * 30 + 30, 300, 56, 'PLAY AGAIN', startGame);
    drawButton(buttons[buttons.length - 1], hoverBtn === buttons[buttons.length - 1]);
  }

  function drawPaused() {
    var st = S();
    if (st) {
      RENDER.drawWorld(ctx, st);
      RENDER.drawHUD(ctx, st);
    }
    RENDER.overlay(ctx, 'PAUSED', ['Press P to keep casing the joint.'], '#d8c98a');
  }

  function render() {
    buttons = [];
    ctx.clearRect(0, 0, 1280, 720);
    var st = S();
    if (screen === 'title') drawTitle();
    else if (screen === 'briefing') drawBriefing();
    else if (screen === 'play') {
      RENDER.drawWorld(ctx, st);
      RENDER.drawHUD(ctx, st);
    } else if (screen === 'paused') drawPaused();
    else if (screen === 'levelcomplete') drawLevelComplete();
    else if (screen === 'gameover') drawGameOver();
    else if (screen === 'victory') drawVictory();
  }

  function loop(ts) {
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    titleT += dt;
    var st = S();
    if (screen === 'title' && st) {
      // Living backdrop: guards walk their rounds behind the title.
      ENGINE.update({ up: false, down: false, left: false, right: false, sneak: false, interact: false }, dt);
    } else if (screen === 'play' && st) {
      ENGINE.update(input, dt);
      if (st.caughtPending) {
        var alive = ENGINE.applyCaught();
        if (!alive) {
          screen = 'gameover';
          AUDIO.lose();
        }
      }
      if (st.levelComplete && screen === 'play') screen = 'levelcomplete';
    }
    render();
    global.requestAnimationFrame(loop);
  }

  function init() {
    canvas = global.document.getElementById('game');
    ctx = canvas.getContext('2d');
    ENGINE.createLevel(0, { lives: 3, score: 0 });
    global.addEventListener('keydown', function (e) { onKey(e, true); });
    global.addEventListener('keyup', function (e) { onKey(e, false); });
    canvas.addEventListener('mousedown', onMouseDown);
    global.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    global.requestAnimationFrame(loop);
  }

  // Playtest hooks: the automated playtest drives the real game through these.
  // They only read or move state the same way input does; nothing here cheats
  // the scoring — loot still needs its hold time, the exit still needs the loot.
  global.VV = {
    screen: function () { return screen; },
    state: function () { return ENGINE.getState(); },
    startGame: startGame,
    beginLevel: beginLevel,
    startLevel: function (i, carry) {
      ENGINE.createLevel(i, carry || { lives: 3, score: 0 });
      screen = 'play';
    },
    teleport: function (x, y) {
      var st = S();
      st.player.x = x;
      st.player.y = y;
    },
    setAlarm: function (v) { S().alarm = v; },
    holdInteract: function (on) { input.interact = !!on; },
    pressKey: function (k, down) { onKey({ key: k, preventDefault: function () {} }, !!down); }
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
