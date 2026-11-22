// Velvet Vault — renderer. Every pixel is procedural canvas drawing: no
// images, no fonts loaded over the network. Vision cones are raycast so
// they stop at walls exactly the way the engine's line of sight does.
(function (global) {
  'use strict';

  var ENGINE = global.VV_ENGINE;
  var LEVELS = global.VV_LEVELS;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Raycast a vision cone: march each ray until it hits a solid or the range.
  function conePoints(x, y, angle, halfAngle, range, solids) {
    var pts = [[x, y]];
    var steps = 26;
    for (var i = 0; i <= steps; i++) {
      var a = angle - halfAngle + (2 * halfAngle * i) / steps;
      var r = range;
      for (var d = 8; d <= range; d += 6) {
        var px = x + Math.cos(a) * d;
        var py = y + Math.sin(a) * d;
        var hit = false;
        for (var s = 0; s < solids.length; s++) {
          if (ENGINE.pointInRect(px, py, solids[s])) { hit = true; break; }
        }
        if (hit) { r = d; break; }
      }
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    return pts;
  }

  function fillCone(ctx, x, y, angle, halfAngle, range, solids, color) {
    var pts = conePoints(x, y, angle, halfAngle, range, solids);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawFloor(ctx, S) {
    var th = S.def.theme;
    ctx.fillStyle = th.floorA;
    ctx.fillRect(0, 64, 1280, 656);
    ctx.fillStyle = th.floorB;
    var tile = 40;
    for (var y = 64; y < 720; y += tile) {
      for (var x = 0; x < 1280; x += tile) {
        if (((x / tile) + (y / tile)) % 2 === 0) ctx.fillRect(x, y, tile, tile);
      }
    }
    // Soft vignette so the room reads as a lit interior.
    var vg = ctx.createRadialGradient(640, 392, 240, 640, 392, 760);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 64, 1280, 656);
  }

  function drawWalls(ctx, S) {
    var th = S.def.theme;
    for (var i = 0; i < S.def.walls.length; i++) {
      var w = S.def.walls[i];
      ctx.fillStyle = th.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = th.trim;
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
    }
    for (var j = 0; j < S.def.crates.length; j++) {
      var c = S.def.crates[j];
      ctx.fillStyle = c.kind === 'pedestal' ? '#3a3345' : '#4d3d24';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#6b5a35';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      ctx.beginPath();
      ctx.moveTo(c.x + 4, c.y + 4);
      ctx.lineTo(c.x + c.w - 4, c.y + c.h - 4);
      ctx.moveTo(c.x + c.w - 4, c.y + 4);
      ctx.lineTo(c.x + 4, c.y + c.h - 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();
    }
  }

  function drawShadowsAndVents(ctx, S) {
    var th = S.def.theme;
    for (var i = 0; i < S.def.shadows.length; i++) {
      var sh = S.def.shadows[i];
      ctx.fillStyle = th.shadow;
      rr(ctx, sh.x, sh.y, sh.w, sh.h, 18);
      ctx.fill();
    }
    for (var j = 0; j < S.def.vents.length; j++) {
      var v = S.def.vents[j];
      ctx.fillStyle = '#15151f';
      rr(ctx, v.x, v.y, v.w, v.h, 6);
      ctx.fill();
      ctx.strokeStyle = '#55556e';
      ctx.lineWidth = 2;
      for (var k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(v.x + 5, v.y + k * v.h / 4);
        ctx.lineTo(v.x + v.w - 5, v.y + k * v.h / 4);
        ctx.stroke();
      }
    }
  }

  function drawLasers(ctx, S) {
    for (var i = 0; i < S.lasers.length; i++) {
      var l = S.lasers[i];
      var pulse = 0.55 + 0.35 * Math.sin(S.time * 6);
      ctx.strokeStyle = l.onNow
        ? 'rgba(255,60,70,' + pulse.toFixed(2) + ')'
        : 'rgba(255,60,70,0.12)';
      ctx.lineWidth = l.onNow ? 3 : 1.5;
      ctx.setLineDash(l.onNow ? [] : [6, 8]);
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#c33';
      ctx.fillRect(l.x1 - 5, l.y1 - 6, 10, 12);
      ctx.fillRect(l.x2 - 5, l.y2 - 6, 10, 12);
    }
  }

  function drawExit(ctx, S) {
    var e = S.def.exit;
    var open = S.exitOpen;
    var glow = open ? 'rgba(80,255,140,' + (0.25 + 0.15 * Math.sin(S.time * 4)).toFixed(2) + ')'
      : 'rgba(255,80,80,0.10)';
    ctx.fillStyle = glow;
    ctx.fillRect(e.x - 8, e.y - 8, e.w + 16, e.h + 16);
    ctx.fillStyle = open ? '#12351d' : '#2a1214';
    rr(ctx, e.x, e.y, e.w, e.h, 6);
    ctx.fill();
    ctx.strokeStyle = open ? '#4dff88' : '#8a2f35';
    ctx.lineWidth = 3;
    rr(ctx, e.x, e.y, e.w, e.h, 6);
    ctx.stroke();
    ctx.fillStyle = open ? '#7dffab' : '#c05a5a';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'EXIT OPEN' : 'LOCKED', e.x + e.w / 2, e.y + e.h / 2 - 2);
    ctx.font = '9px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#9a938a';
    ctx.fillText(e.label, e.x + e.w / 2, e.y + e.h / 2 + 12);
  }

  function drawLoot(ctx, S) {
    for (var i = 0; i < S.loot.length; i++) {
      var l = S.loot[i];
      if (l.taken) continue;
      var pulse = 0.5 + 0.3 * Math.sin(S.time * 3 + i * 1.7);
      ctx.save();
      ctx.shadowColor = '#ffd76a';
      ctx.shadowBlur = 18 * pulse;
      if (l.kind === 'painting') {
        ctx.fillStyle = '#8a6d2f';
        ctx.fillRect(l.x - 26, l.y - 18, 52, 36);
        ctx.fillStyle = '#2a4a6b';
        ctx.fillRect(l.x - 21, l.y - 13, 42, 26);
        ctx.fillStyle = '#e8c85a';
        ctx.beginPath();
        ctx.arc(l.x, l.y, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (l.kind === 'gold') {
        ctx.fillStyle = '#d8a920';
        ctx.fillRect(l.x - 14, l.y - 6, 28, 12);
        ctx.fillStyle = '#f5d64a';
        ctx.fillRect(l.x - 10, l.y - 12, 20, 8);
        ctx.fillStyle = '#b8890f';
        ctx.fillRect(l.x - 14, l.y + 2, 28, 4);
      } else if (l.kind === 'jewel') {
        ctx.fillStyle = '#37c8a0';
        ctx.beginPath();
        ctx.moveTo(l.x, l.y - 14);
        ctx.lineTo(l.x + 12, l.y);
        ctx.lineTo(l.x, l.y + 14);
        ctx.lineTo(l.x - 12, l.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.moveTo(l.x, l.y - 14);
        ctx.lineTo(l.x + 12, l.y);
        ctx.lineTo(l.x, l.y);
        ctx.closePath();
        ctx.fill();
      } else if (l.kind === 'diamond') {
        ctx.fillStyle = '#b48ce8';
        ctx.beginPath();
        ctx.moveTo(l.x, l.y - 18);
        ctx.lineTo(l.x + 16, l.y - 4);
        ctx.lineTo(l.x + 10, l.y + 14);
        ctx.lineTo(l.x - 10, l.y + 14);
        ctx.lineTo(l.x - 16, l.y - 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#efe6ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(l.x - 16, l.y - 4);
        ctx.lineTo(l.x + 16, l.y - 4);
        ctx.moveTo(l.x, l.y - 18);
        ctx.lineTo(l.x, l.y + 14);
        ctx.stroke();
      } else { // relic
        ctx.fillStyle = '#c8b98a';
        ctx.fillRect(l.x - 10, l.y - 14, 20, 28);
        ctx.beginPath();
        ctx.arc(l.x, l.y - 16, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(232,210,122,0.9)';
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(l.label, l.x, l.y + 32);
    }
  }

  function drawCameras(ctx, S) {
    for (var i = 0; i < S.cameras.length; i++) {
      var c = S.cameras[i];
      if (c.disabled <= 0) {
        var col = c.seeing ? 'rgba(255,50,50,0.30)' : 'rgba(120,200,255,0.16)';
        fillCone(ctx, c.x, c.y, c.angle, c.halfAngle, c.range, S.solids, col);
      }
      ctx.fillStyle = c.disabled > 0 ? '#3a3a44' : '#22222e';
      ctx.fillRect(c.x - 7, c.y - 7, 14, 14);
      ctx.strokeStyle = c.disabled > 0 ? '#666' : (c.seeing ? '#ff4040' : '#7cc8ff');
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x - 7, c.y - 7, 14, 14);
      ctx.fillStyle = c.disabled > 0 ? '#777' : '#ff5a5a';
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(c.angle) * 5, c.y + Math.sin(c.angle) * 5, 3, 0, Math.PI * 2);
      ctx.fill();
      if (c.disabled > 0) {
        ctx.strokeStyle = '#999';
        ctx.beginPath();
        ctx.moveTo(c.x - 5, c.y - 5);
        ctx.lineTo(c.x + 5, c.y + 5);
        ctx.moveTo(c.x + 5, c.y - 5);
        ctx.lineTo(c.x - 5, c.y + 5);
        ctx.stroke();
      }
    }
  }

  function drawGuards(ctx, S) {
    for (var i = 0; i < S.guards.length; i++) {
      var g = S.guards[i];
      var coneCol = 'rgba(255,214,80,0.16)';
      if (g.state === 'alerted') coneCol = 'rgba(255,60,60,0.28)';
      else if (g.state === 'search') coneCol = 'rgba(255,140,60,0.22)';
      else if (g.suspicion >= 0.55) coneCol = 'rgba(255,170,40,0.22)';
      fillCone(ctx, g.x, g.y, g.angle, 0.62, 175, S.solids, coneCol);
      // Body: navy uniform, cap, facing tick.
      ctx.fillStyle = '#232c44';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = g.state === 'alerted' ? '#ff5050' : '#5a6a94';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#1a2138';
      ctx.beginPath();
      ctx.arc(g.x + Math.cos(g.angle) * 4, g.y + Math.sin(g.angle) * 4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e8d27a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(g.x + Math.cos(g.angle) * (g.r - 2), g.y + Math.sin(g.angle) * (g.r - 2));
      ctx.lineTo(g.x + Math.cos(g.angle) * (g.r + 7), g.y + Math.sin(g.angle) * (g.r + 7));
      ctx.stroke();
      // State mark and suspicion arc.
      ctx.textAlign = 'center';
      if (g.state === 'alerted') {
        ctx.fillStyle = '#ff5050';
        ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
        ctx.fillText('!', g.x, g.y - 20);
      } else if (g.state === 'search' || g.suspicion >= 0.55) {
        ctx.fillStyle = '#ffb040';
        ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        ctx.fillText('?', g.x, g.y - 20);
      }
      if (g.suspicion > 0.05 && g.state !== 'alerted') {
        ctx.strokeStyle = 'rgba(255,176,64,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r + 5, -Math.PI / 2, -Math.PI / 2 + g.suspicion * Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawPlayer(ctx, S) {
    var p = S.player;
    if (p.invuln > 0 && Math.floor(S.time * 10) % 2 === 0) return; // blink
    // Shadow-hiding tint.
    if (p.inShadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
      ctx.fill();
    }
    var crouch = p.sneak ? 0.85 : 1;
    ctx.fillStyle = '#1d1a26';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * crouch, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8d27a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Hood and mask.
    ctx.fillStyle = '#2c2838';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.dir) * 3, p.y + Math.sin(p.dir) * 3, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5e6a8';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.dir) * 6, p.y + Math.sin(p.dir) * 6, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Direction tick.
    ctx.strokeStyle = '#f5e6a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.dir) * (p.r - 3), p.y + Math.sin(p.dir) * (p.r - 3));
    ctx.lineTo(p.x + Math.cos(p.dir) * (p.r + 6), p.y + Math.sin(p.dir) * (p.r + 6));
    ctx.stroke();
    // Hold-to-interact progress ring.
    if (S.interact && S.interact.prog > 0) {
      ctx.strokeStyle = '#7dffab';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 9, -Math.PI / 2,
        -Math.PI / 2 + (S.interact.prog / S.interact.need) * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#d8f5e0';
      ctx.font = '11px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(S.interact.label, p.x, p.y - p.r - 16);
    } else if (S.interact) {
      ctx.fillStyle = 'rgba(216,245,224,0.85)';
      ctx.font = '11px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Hold E — ' + S.interact.label, p.x, p.y - p.r - 14);
    }
  }

  function drawWorld(ctx, S) {
    drawFloor(ctx, S);
    drawShadowsAndVents(ctx, S);
    drawLasers(ctx, S);
    drawExit(ctx, S);
    drawLoot(ctx, S);
    drawWalls(ctx, S);
    drawCameras(ctx, S);
    drawGuards(ctx, S);
    drawPlayer(ctx, S);
    if (S.msgT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, S.msgT);
      ctx.fillStyle = S.lockdown > 0 ? '#ff7070' : '#f5e6a8';
      ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(S.msg, 640, 100);
      ctx.restore();
    }
    if (S.lockdown > 0) {
      ctx.fillStyle = 'rgba(255,40,40,' + (0.05 + 0.03 * Math.sin(S.time * 8)).toFixed(2) + ')';
      ctx.fillRect(0, 64, 1280, 656);
      ctx.fillStyle = '#ff8080';
      ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOCKDOWN — ' + Math.ceil(S.lockdown) + 's', 640, 140);
    }
  }

  function drawHUD(ctx, S) {
    ctx.fillStyle = '#0d0d16';
    ctx.fillRect(0, 0, 1280, 64);
    ctx.strokeStyle = '#3a3220';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(1280, 64);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8d27a';
    ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
    ctx.fillText(S.def.name, 18, 26);
    ctx.fillStyle = '#8d8570';
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(S.lootTaken + '/' + S.def.loot.length + ' loot  ·  ' +
      S.requiredTaken + '/' + S.requiredTotal + ' targets', 18, 46);

    // Alarm meter.
    var ax = 470, aw = 340;
    ctx.fillStyle = '#8d8570';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALARM', ax, 22);
    ctx.fillStyle = '#1d1d2b';
    rr(ctx, ax, 28, aw, 18, 9);
    ctx.fill();
    var frac = S.alarm / 100;
    var grad = ctx.createLinearGradient(ax, 0, ax + aw, 0);
    grad.addColorStop(0, '#3fae5a');
    grad.addColorStop(0.55, '#e8c832');
    grad.addColorStop(1, '#e83232');
    ctx.fillStyle = grad;
    if (frac > 0.005) {
      rr(ctx, ax + 2, 30, Math.max(8, (aw - 4) * frac), 14, 7);
      ctx.fill();
    }
    ctx.strokeStyle = S.alarm > 70 ? '#ff5050' : '#55556e';
    ctx.lineWidth = 1.5;
    rr(ctx, ax, 28, aw, 18, 9);
    ctx.stroke();
    ctx.fillStyle = S.alarm > 70 ? '#ff8080' : '#c9c2ae';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(Math.round(S.alarm) + '%', ax + aw + 10, 43);

    // Timer, score, lives.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#d8c98a';
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    var t = Math.floor(S.levelTime);
    var mm = String(Math.floor(t / 60)).padStart(2, '0');
    var ss = String(t % 60).padStart(2, '0');
    ctx.fillText(mm + ':' + ss, 1000, 26);
    ctx.fillText('$' + S.score, 1000, 47);
    ctx.fillStyle = '#e8d27a';
    ctx.font = '15px "Segoe UI", Arial, sans-serif';
    var masks = '';
    for (var i = 0; i < S.lives; i++) masks += '◆ ';
    ctx.fillText(masks + '  LIVES ' + S.lives, 1262, 26);
    ctx.fillStyle = '#8d8570';
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(S.exitOpen ? 'EXIT OPEN — GO!' : 'Lift the targets, then leave', 1262, 47);
  }

  function overlay(ctx, title, lines, accent) {
    ctx.fillStyle = 'rgba(6,6,12,0.78)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || '#e8d27a';
    ctx.font = 'bold 44px "Segoe UI", Arial, sans-serif';
    ctx.fillText(title, 640, 250);
    ctx.fillStyle = '#d8c98a';
    ctx.font = '17px "Segoe UI", Arial, sans-serif';
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], 640, 300 + i * 30);
  }

  function wrapText(ctx, text, maxW) {
    var words = text.split(' ');
    var lines = [];
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = words[i];
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  global.VV_RENDER = {
    drawWorld: drawWorld,
    drawHUD: drawHUD,
    overlay: overlay,
    wrapText: wrapText
  };
})(window);
