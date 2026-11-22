// Velvet Vault — engine. Movement, collision, line of sight, guard AI,
// cameras, lasers, the alarm meter and interactions. Pure game logic; all
// drawing lives in render.js, all sound in audio.js.
(function (global) {
  'use strict';

  var B = global.VV_BOUNDS;
  var LEVELS = global.VV_LEVELS;
  var AUDIO = global.VV_AUDIO;

  var TAU = Math.PI * 2;
  var PLAYER_R = 14;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
  function angDiff(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return d;
  }
  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }
  // Sampled segment-vs-rect test: cheap, and exact enough for sight lines.
  function segHitsRect(x1, y1, x2, y2, r) {
    var d = Math.hypot(x2 - x1, y2 - y1);
    var steps = Math.max(1, Math.ceil(d / 6));
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      if (pointInRect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r)) return true;
    }
    return false;
  }
  function losClear(x1, y1, x2, y2, solids) {
    for (var i = 0; i < solids.length; i++) {
      if (segHitsRect(x1, y1, x2, y2, solids[i])) return false;
    }
    return true;
  }
  function pointSegDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    var t = len2 === 0 ? 0 : clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }
  function inShadow(x, y, shadows) {
    for (var i = 0; i < shadows.length; i++) {
      if (pointInRect(x, y, shadows[i])) return true;
    }
    return false;
  }

  // Push a circle out of a rect; returns true when a push happened.
  function pushOut(p, r, rect) {
    var cx = clamp(p.x, rect.x, rect.x + rect.w);
    var cy = clamp(p.y, rect.y, rect.y + rect.h);
    var dx = p.x - cx, dy = p.y - cy;
    var d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return false;
    if (d2 > 0.0001) {
      var d = Math.sqrt(d2);
      p.x = cx + dx / d * r;
      p.y = cy + dy / d * r;
    } else {
      // Centre inside the rect: push out along the smallest penetration.
      var pl = p.x - rect.x, pr = rect.x + rect.w - p.x;
      var pt = p.y - rect.y, pb = rect.y + rect.h - p.y;
      var m = Math.min(pl, pr, pt, pb);
      if (m === pl) p.x = rect.x - r;
      else if (m === pr) p.x = rect.x + rect.w + r;
      else if (m === pt) p.y = rect.y - r;
      else p.y = rect.y + rect.h + r;
    }
    return true;
  }

  var S = null; // the live level state; main.js reads it every frame

  function solidsOf(def) {
    return def.walls.concat(def.crates);
  }

  function createLevel(idx, carry) {
    var def = LEVELS[idx];
    var requiredTotal = 0;
    for (var i = 0; i < def.loot.length; i++) {
      if (def.loot[i].required) requiredTotal++;
    }
    S = {
      levelIndex: idx,
      def: def,
      solids: solidsOf(def),
      time: 0,
      levelTime: 0,
      player: {
        x: def.playerStart.x, y: def.playerStart.y, r: PLAYER_R,
        dir: -Math.PI / 2, sneak: false, moving: false,
        stepT: 0, invuln: 0, ventCool: 0, inShadow: false
      },
      guards: def.guards.map(function (g) {
        return {
          x: g.x, y: g.y, r: 14, angle: 0, speed: g.speed, wait: g.wait,
          waypoints: g.waypoints, wp: 0, waitT: 0,
          state: 'patrol', suspicion: 0, loseT: 0, searchT: 0,
          lastSeen: { x: g.x, y: g.y }, scanDir: 1
        };
      }),
      cameras: def.cameras.map(function (c) {
        return {
          x: c.x, y: c.y, baseAngle: c.baseAngle, sweep: c.sweep,
          speed: c.speed, range: c.range, halfAngle: 0.5,
          angle: c.baseAngle, disabled: 0, seeing: false, hackProg: 0
        };
      }),
      lasers: def.lasers.map(function (l) {
        return {
          x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2,
          period: l.period, on: l.on, phase: l.phase, cool: 0, onNow: true
        };
      }),
      loot: def.loot.map(function (l) {
        return {
          x: l.x, y: l.y, kind: l.kind, value: l.value,
          required: l.required, label: l.label, taken: false
        };
      }),
      alarm: 0,
      lockdown: 0,
      lives: carry ? carry.lives : 3,
      score: carry ? carry.score : 0,
      lootTaken: 0,
      requiredTaken: 0,
      requiredTotal: requiredTotal,
      spotted: false,
      exitOpen: false,
      levelComplete: false,
      caughtPending: false,
      interact: null, // {kind:'loot'|'camera'|'vent', ref, prog, need, label}
      msg: '',
      msgT: 0,
      stats: null
    };
    return S;
  }

  function moveCircle(p, dx, dy, solids) {
    // Axis-separated movement so circles slide along walls instead of sticking.
    p.x += dx;
    for (var i = 0; i < solids.length; i++) pushOut(p, p.r, solids[i]);
    p.y += dy;
    for (var j = 0; j < solids.length; j++) pushOut(p, p.r, solids[j]);
    p.x = clamp(p.x, B.LEFT + p.r, B.RIGHT - p.r);
    p.y = clamp(p.y, B.TOP + p.r, B.BOT - p.r);
  }

  function guardSees(g, range, halfAngle) {
    var p = S.player;
    var d = dist(g.x, g.y, p.x, p.y);
    if (d > range) return 0;
    var ang = Math.atan2(p.y - g.y, p.x - g.x);
    if (Math.abs(angDiff(ang, g.angle)) > halfAngle) return 0;
    if (!losClear(g.x, g.y, p.x, p.y, S.solids)) return 0;
    // Visibility: close and moving is obvious; sneaking in shadow is not.
    var vis = 1 - (d / range) * 0.6;
    if (p.sneak) vis *= 0.55;
    if (p.inShadow) vis *= 0.45;
    if (p.moving) vis *= 1.15;
    return clamp(vis, 0.08, 1);
  }

  function say(text, secs) {
    S.msg = text;
    S.msgT = secs || 2.5;
  }

  function updateGuard(g, dt) {
    var p = S.player;
    var vis = guardSees(g, 175, 0.62);
    var seen = vis > 0;
    if (seen) {
      g.suspicion += 1.15 * vis * dt;
      g.lastSeen.x = p.x;
      g.lastSeen.y = p.y;
    } else {
      g.suspicion -= 0.45 * dt;
    }
    g.suspicion = clamp(g.suspicion, 0, 1);

    if (g.state === 'patrol') {
      if (g.suspicion >= 1) {
        g.state = 'alerted';
        g.loseT = 0;
        S.spotted = true;
        AUDIO.spotted();
        say('SPOTTED! Run — break line of sight!', 2.5);
      } else if (g.waitT > 0) {
        g.waitT -= dt;
      } else {
        var wp = g.waypoints[g.wp];
        var d = dist(g.x, g.y, wp[0], wp[1]);
        if (d < 12) {
          g.wp = (g.wp + 1) % g.waypoints.length;
          g.waitT = g.wait;
        } else {
          var ang = Math.atan2(wp[1] - g.y, wp[0] - g.x);
          g.angle = ang;
          var step = { x: g.x, y: g.y, r: g.r };
          moveCircle(step, Math.cos(ang) * g.speed * dt, Math.sin(ang) * g.speed * dt, S.solids);
          g.x = step.x;
          g.y = step.y;
        }
      }
      if (seen && g.suspicion >= 0.55) g.angle = Math.atan2(p.y - g.y, p.x - g.x);
    } else if (g.state === 'alerted') {
      if (seen) {
        g.loseT = 0;
        S.alarm = clamp(S.alarm + 10 * dt, 0, 100);
        g.angle = Math.atan2(p.y - g.y, p.x - g.x);
      } else {
        g.loseT += dt;
        if (g.loseT > 3) {
          g.state = 'search';
          g.searchT = 0;
        }
      }
      var d2 = dist(g.x, g.y, p.x, p.y);
      if (d2 > 30) {
        var a2 = Math.atan2(p.y - g.y, p.x - g.x);
        g.angle = a2;
        var st = { x: g.x, y: g.y, r: g.r };
        moveCircle(st, Math.cos(a2) * g.speed * 1.9 * dt, Math.sin(a2) * g.speed * 1.9 * dt, S.solids);
        g.x = st.x;
        g.y = st.y;
      }
      if (d2 < 26 && p.invuln <= 0) S.caughtPending = true;
    } else if (g.state === 'search') {
      var dl = dist(g.x, g.y, g.lastSeen.x, g.lastSeen.y);
      if (dl > 14) {
        var a3 = Math.atan2(g.lastSeen.y - g.y, g.lastSeen.x - g.x);
        g.angle = a3;
        var st2 = { x: g.x, y: g.y, r: g.r };
        moveCircle(st2, Math.cos(a3) * g.speed * 1.25 * dt, Math.sin(a3) * g.speed * 1.25 * dt, S.solids);
        g.x = st2.x;
        g.y = st2.y;
      } else {
        g.searchT += dt;
        g.angle += g.scanDir * 1.6 * dt;
        if (g.searchT > 3.5) {
          g.state = 'patrol';
          g.suspicion = 0.3;
          g.searchT = 0;
        }
      }
      if (seen && g.suspicion >= 1) {
        g.state = 'alerted';
        g.loseT = 0;
      }
    }
    // A guard that gets stuck against a wall while chasing still counts as
    // dangerous: touching the thief at close range ends the run for a life.
    if (g.state === 'alerted' && dist(g.x, g.y, p.x, p.y) < 24 && p.invuln <= 0) {
      S.caughtPending = true;
    }
  }

  function updateCameras(dt) {
    var p = S.player;
    for (var i = 0; i < S.cameras.length; i++) {
      var c = S.cameras[i];
      if (c.disabled > 0) {
        c.disabled -= dt;
        c.seeing = false;
        continue;
      }
      c.angle = c.baseAngle + Math.sin(S.time * c.speed) * c.sweep;
      var d = dist(c.x, c.y, p.x, p.y);
      var seeing = false;
      if (d < c.range) {
        var ang = Math.atan2(p.y - c.y, p.x - c.x);
        if (Math.abs(angDiff(ang, c.angle)) <= c.halfAngle &&
            losClear(c.x, c.y, p.x, p.y, S.solids)) {
          seeing = true;
        }
      }
      c.seeing = seeing;
      if (seeing) {
        var vis = 1 - (d / c.range) * 0.5;
        if (p.sneak) vis *= 0.6;
        if (p.inShadow) vis *= 0.5;
        S.alarm = clamp(S.alarm + 16 * vis * dt, 0, 100);
        S.spotted = true;
      }
    }
  }

  function updateLasers(dt) {
    var p = S.player;
    for (var i = 0; i < S.lasers.length; i++) {
      var l = S.lasers[i];
      l.onNow = ((S.time + l.phase) % l.period) < l.on;
      if (l.cool > 0) l.cool -= dt;
      if (l.onNow && l.cool <= 0 &&
          pointSegDist(p.x, p.y, l.x1, l.y1, l.x2, l.y2) < p.r + 2 &&
          p.invuln <= 0) {
        l.cool = 1.0;
        S.alarm = clamp(S.alarm + 25, 0, 100);
        AUDIO.laserZap();
        say('LASER TRIPPED! The alarm spikes!', 2.5);
        for (var j = 0; j < S.guards.length; j++) {
          var g = S.guards[j];
          if (g.state === 'patrol') {
            g.suspicion = Math.max(g.suspicion, 0.7);
            g.lastSeen.x = p.x;
            g.lastSeen.y = p.y;
          }
        }
      }
    }
  }

  function nearestInteractable() {
    var p = S.player;
    var best = null;
    var bestD = 60;
    for (var i = 0; i < S.loot.length; i++) {
      var l = S.loot[i];
      if (l.taken) continue;
      var d = dist(p.x, p.y, l.x, l.y);
      if (d < bestD) {
        bestD = d;
        best = { kind: 'loot', ref: l, need: 1.2, label: 'Lift ' + l.label };
      }
    }
    for (var j = 0; j < S.cameras.length; j++) {
      var c = S.cameras[j];
      if (c.disabled > 0) continue;
      var dc = dist(p.x, p.y, c.x, c.y);
      if (dc < 78 && dc < bestD + 20) {
        bestD = dc;
        best = { kind: 'camera', ref: c, need: 2.0, label: 'Hack camera' };
      }
    }
    var def = S.def;
    for (var k = 0; k < def.vents.length; k++) {
      var v = def.vents[k];
      var cx = v.x + v.w / 2, cy = v.y + v.h / 2;
      if (dist(p.x, p.y, cx, cy) < 46) {
        return { kind: 'vent', ref: v, need: 0, label: 'Crawl through vent' };
      }
    }
    return best;
  }

  function updateInteract(dt, held) {
    var target = nearestInteractable();
    if (!target) {
      S.interact = null;
      return;
    }
    if (target.kind === 'vent') {
      S.interact = target;
      if (held && S.player.ventCool <= 0) {
        S.player.x = target.ref.tx;
        S.player.y = target.ref.ty;
        S.player.ventCool = 1.0;
        AUDIO.vent();
        say('Through the vent…', 1.5);
      }
      return;
    }
    if (!S.interact || S.interact.ref !== target.ref) {
      S.interact = { kind: target.kind, ref: target.ref, prog: 0, need: target.need, label: target.label };
    }
    if (held) {
      S.interact.prog += dt;
      if (S.interact.kind === 'loot' && Math.floor(S.interact.prog * 5) !== Math.floor((S.interact.prog - dt) * 5)) {
        AUDIO.lockTick();
      }
      if (S.interact.kind === 'camera' && Math.floor(S.interact.prog * 4) !== Math.floor((S.interact.prog - dt) * 4)) {
        AUDIO.hack();
      }
      if (S.interact.prog >= S.interact.need) {
        if (S.interact.kind === 'loot') {
          var l = S.interact.ref;
          l.taken = true;
          S.lootTaken++;
          if (l.required) S.requiredTaken++;
          S.score += l.value;
          AUDIO.pickup();
          say(l.label + ' secured! (+$' + l.value + ')', 2.5);
          if (S.requiredTaken === S.requiredTotal) {
            AUDIO.doorOpen();
            say('All targets lifted — the exit is open!', 3.5);
          }
        } else {
          S.interact.ref.disabled = 20;
          AUDIO.hackDone();
          say('Camera disabled for 20s.', 2.5);
        }
        S.interact = null;
      }
    } else {
      S.interact.prog = Math.max(0, S.interact.prog - dt * 2);
    }
  }

  function updateAlarm(dt, anySeen) {
    if (S.lockdown > 0) {
      S.lockdown -= dt;
      S.alarm = 100;
      if (S.lockdown <= 0) {
        S.alarm = 45;
        say('Lockdown lifted. Move — quietly.', 3);
      }
      return;
    }
    if (!anySeen) S.alarm = clamp(S.alarm - 2.5 * dt, 0, 100);
    if (S.alarm >= 100) {
      S.lockdown = 6;
      S.exitOpen = false;
      AUDIO.spotted();
      say('LOCKDOWN! Every guard is coming for you!', 3.5);
      for (var i = 0; i < S.guards.length; i++) {
        var g = S.guards[i];
        g.state = 'alerted';
        g.loseT = 0;
        g.lastSeen.x = S.player.x;
        g.lastSeen.y = S.player.y;
      }
    }
  }

  function update(input, dt) {
    if (!S) return S;
    S.time += dt;
    S.levelTime += dt;
    var p = S.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.ventCool > 0) p.ventCool -= dt;
    if (S.msgT > 0) S.msgT -= dt;

    // --- player movement ---
    var mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    p.sneak = !!input.sneak;
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) {
      var len = Math.hypot(mx, my);
      var speed = p.sneak ? 95 : 168;
      p.dir = Math.atan2(my / len, mx / len);
      moveCircle(p, mx / len * speed * dt, my / len * speed * dt, S.solids);
      p.stepT -= dt;
      if (p.stepT <= 0) {
        AUDIO.step(p.sneak);
        p.stepT = p.sneak ? 0.45 : 0.32;
      }
    }
    p.inShadow = inShadow(p.x, p.y, S.def.shadows);

    // --- world systems ---
    var anySeen = false;
    for (var i = 0; i < S.guards.length; i++) {
      updateGuard(S.guards[i], dt);
      if (S.guards[i].state === 'alerted') anySeen = true;
    }
    updateCameras(dt);
    for (var j = 0; j < S.cameras.length; j++) {
      if (S.cameras[j].seeing) anySeen = true;
    }
    updateLasers(dt);
    updateInteract(dt, !!input.interact);
    updateAlarm(dt, anySeen);

    S.exitOpen = S.requiredTaken === S.requiredTotal && S.lockdown <= 0;

    // --- alarm audio follows the meter ---
    if (S.alarm > 55) AUDIO.startAlarm();
    else AUDIO.stopAlarm();
    AUDIO.setAlarmLevel(S.alarm / 100);

    // --- reaching the open exit ends the level ---
    var e = S.def.exit;
    if (S.exitOpen && p.x > e.x - 6 && p.x < e.x + e.w + 6 &&
        p.y > e.y - 6 && p.y < e.y + e.h + 6 && !S.levelComplete) {
      S.levelComplete = true;
      var timeBonus = Math.max(0, Math.round((S.def.par - S.levelTime) * 10));
      var ghostBonus = S.spotted ? 0 : 500;
      S.stats = {
        time: S.levelTime,
        timeBonus: timeBonus,
        ghostBonus: ghostBonus,
        lootValue: S.lootTaken,
        total: S.score + timeBonus + ghostBonus
      };
      S.score += timeBonus + ghostBonus;
      AUDIO.stopAlarm();
      AUDIO.win();
    }
    return S;
  }

  function applyCaught() {
    // Called by main.js when a guard catches the thief.
    S.lives--;
    S.caughtPending = false;
    AUDIO.caught();
    if (S.lives <= 0) return false;
    var p = S.player;
    p.x = S.def.playerStart.x;
    p.y = S.def.playerStart.y;
    p.invuln = 2.0;
    S.alarm = 35;
    S.lockdown = 0;
    for (var i = 0; i < S.guards.length; i++) {
      var g = S.guards[i];
      var home = S.def.guards[i];
      g.x = home.x;
      g.y = home.y;
      g.state = 'patrol';
      g.suspicion = 0;
      g.wp = 0;
      g.waitT = 0;
    }
    say('Caught! ' + S.lives + (S.lives === 1 ? ' life' : ' lives') + ' left.', 3);
    return true;
  }

  global.VV_ENGINE = {
    createLevel: createLevel,
    update: update,
    applyCaught: applyCaught,
    getState: function () { return S; },
    setState: function (s) { S = s; },
    pointInRect: pointInRect,
    losClear: losClear,
    segHitsRect: segHitsRect,
    dist: dist,
    clamp: clamp
  };
})(window);
