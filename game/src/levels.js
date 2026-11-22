// Velvet Vault — level data. Three original single-screen heist maps.
// The play field is 1280x720; the top 64px is the HUD strip, so rooms live
// inside x 16..1264, y 76..704. Walls, crates, shadows, vents, guards,
// cameras, lasers and loot are all plain data; the engine in engine.js
// turns them into a living level.
(function (global) {
  'use strict';

  var W = 1280, H = 720, TOP = 76, BOT = 704, LEFT = 16, RIGHT = 1264;

  function border() {
    return [
      { x: 0, y: 64, w: W, h: 12 },        // under the HUD strip
      { x: 0, y: BOT, w: W, h: 16 },       // bottom wall
      { x: 0, y: 64, w: 16, h: BOT - 64 }, // left wall
      { x: RIGHT, y: 64, w: 16, h: BOT - 64 } // right wall
    ];
  }

  // A vent pair: stepping into one (hold E) pops the thief out of the other.
  function vent(x1, y1, x2, y2) {
    return [
      { x: x1, y: y1, w: 44, h: 34, pair: 1, tx: x2 + 22, ty: y2 + 17 },
      { x: x2, y: y2, w: 44, h: 34, pair: 1, tx: x1 + 22, ty: y1 + 17 }
    ];
  }

  var LEVELS = [
    {
      name: 'The Gilded Gallery',
      sub: 'Level 1 — Museum of Fine Loot',
      par: 150,
      briefing: 'The Star Sapphire hangs in the east wing, flanked by two more ' +
        'masterpieces. The night guards walk lazy loops and the cameras sweep ' +
        'slow arcs. Lift all three paintings, mind the cones, and leave through ' +
        'the service door in the south-west corner.',
      theme: {
        floorA: '#2b2118', floorB: '#241b14', wall: '#4a3a28', trim: '#8a6d3b',
        accent: '#d8b45a', glow: '#ffd76a', shadow: 'rgba(8,6,10,0.55)'
      },
      playerStart: { x: 170, y: 640 },
      exit: { x: 30, y: 640, w: 64, h: 52, label: 'SERVICE DOOR' },
      walls: border().concat([
        { x: 330, y: 76, w: 18, h: 210 },   // west gallery divider
        { x: 330, y: 380, w: 18, h: 200 },
        { x: 640, y: 76, w: 18, h: 150 },   // central column wall
        { x: 640, y: 330, w: 18, h: 190 },
        { x: 950, y: 380, w: 18, h: 324 },
        { x: 950, y: 76, w: 18, h: 150 },
        { x: 480, y: 520, w: 300, h: 18 }   // low partition, south hall
      ]),
      crates: [
        { x: 430, y: 150, w: 64, h: 64, kind: 'pedestal' },
        { x: 520, y: 150, w: 64, h: 64, kind: 'pedestal' },
        { x: 760, y: 420, w: 70, h: 70, kind: 'pedestal' },
        { x: 1060, y: 520, w: 70, h: 70, kind: 'crate' },
        { x: 180, y: 420, w: 70, h: 70, kind: 'crate' }
      ],
      shadows: [
        { x: 20, y: 80, w: 130, h: 90 },
        { x: 700, y: 80, w: 240, h: 70 },
        { x: 1000, y: 600, w: 250, h: 96 },
        { x: 360, y: 600, w: 200, h: 96 }
      ],
      vents: vent(120, 300, 1090, 130),
      guards: [
        { x: 500, y: 260, speed: 62, wait: 1.2,
          waypoints: [[500, 260], [500, 470], [600, 470], [600, 260]] },
        { x: 1080, y: 300, speed: 55, wait: 2.0,
          waypoints: [[1080, 300], [1080, 480], [1180, 480], [1180, 300]] }
      ],
      cameras: [
        { x: 356, y: 120, baseAngle: Math.PI / 2, sweep: 0.7, speed: 0.55, range: 215 },
        { x: 976, y: 690, baseAngle: -Math.PI / 2, sweep: 0.6, speed: 0.7, range: 205 }
      ],
      lasers: [],
      loot: [
        { x: 1210, y: 150, kind: 'painting', value: 400, required: true,
          label: 'Star Sapphire' },
        { x: 1210, y: 350, kind: 'painting', value: 300, required: true,
          label: 'The Velvet Lady' },
        { x: 60, y: 130, kind: 'painting', value: 300, required: true,
          label: 'Portrait of a Thief' },
        { x: 700, y: 620, kind: 'jewel', value: 250, required: false,
          label: 'Emerald Brooch' }
      ]
    },
    {
      name: 'The Iron Bank',
      sub: 'Level 2 — Vault of the Meridian Bank',
      par: 180,
      briefing: 'Three gold bars sit in the vault at the north end, behind a ' +
        'patrol that never stops moving. The teller hall is watched by three ' +
        'cameras with overlapping arcs — use the shadows and the maintenance ' +
        'vent to cross unseen. The vault door is your way out.',
      theme: {
        floorA: '#1e2429', floorB: '#1a1f23', wall: '#3d454c', trim: '#7d8891',
        accent: '#c8a24a', glow: '#ffcf5e', shadow: 'rgba(4,6,10,0.55)'
      },
      playerStart: { x: 640, y: 640 },
      exit: { x: 608, y: 76, w: 64, h: 46, label: 'VAULT DOOR' },
      walls: border().concat([
        { x: 200, y: 76, w: 18, h: 250 },   // teller dividers
        { x: 200, y: 420, w: 18, h: 180 },
        { x: 1062, y: 76, w: 18, h: 250 },
        { x: 1062, y: 420, w: 18, h: 180 },
        { x: 430, y: 300, w: 18, h: 180 },  // vault approach walls
        { x: 832, y: 300, w: 18, h: 180 },
        { x: 430, y: 300, w: 420, h: 18 },  // vault antechamber roof
        { x: 430, y: 220, w: 180, h: 18 },
        { x: 700, y: 220, w: 150, h: 18 }
      ]),
      crates: [
        { x: 300, y: 480, w: 70, h: 70, kind: 'crate' },
        { x: 900, y: 480, w: 70, h: 70, kind: 'crate' },
        { x: 560, y: 560, w: 64, h: 64, kind: 'pedestal' },
        { x: 660, y: 560, w: 64, h: 64, kind: 'pedestal' }
      ],
      shadows: [
        { x: 20, y: 80, w: 170, h: 80 },
        { x: 1070, y: 80, w: 190, h: 80 },
        { x: 470, y: 620, w: 340, h: 76 },
        { x: 900, y: 200, w: 150, h: 70 }
      ],
      vents: vent(90, 560, 1150, 560),
      guards: [
        { x: 640, y: 250, speed: 66, wait: 1.0,
          waypoints: [[640, 250], [400, 250], [400, 650], [880, 650], [880, 250]] },
        { x: 240, y: 180, speed: 60, wait: 1.6,
          waypoints: [[240, 180], [240, 620]] },
        { x: 1000, y: 180, speed: 60, wait: 1.6,
          waypoints: [[1000, 180], [1000, 620]] }
      ],
      cameras: [
        { x: 780, y: 84, baseAngle: Math.PI / 2, sweep: 0.85, speed: 0.6, range: 220 },
        { x: 226, y: 300, baseAngle: 0, sweep: 0.7, speed: 0.8, range: 200 },
        { x: 1054, y: 300, baseAngle: Math.PI, sweep: 0.7, speed: 0.8, range: 200 }
      ],
      lasers: [],
      loot: [
        { x: 540, y: 150, kind: 'gold', value: 350, required: true, label: 'Gold Bar I' },
        { x: 640, y: 150, kind: 'gold', value: 350, required: true, label: 'Gold Bar II' },
        { x: 740, y: 150, kind: 'gold', value: 350, required: true, label: 'Gold Bar III' },
        { x: 640, y: 600, kind: 'relic', value: 300, required: false, label: 'Meridian Seal' }
      ]
    },
    {
      name: 'The Sky Penthouse',
      sub: 'Level 3 — Aurora Diamond, 88th floor',
      par: 210,
      briefing: 'The Aurora Diamond floats in a glass case at the heart of the ' +
        'penthouse, behind sweeping cameras and a laser lattice that blinks ' +
        'on and off. Time your crossing between the beams, lift the diamond ' +
        'and the two sapphires, and take the rooftop lift home.',
      theme: {
        floorA: '#241d33', floorB: '#1e1829', wall: '#453a5e', trim: '#9a8ac2',
        accent: '#b48ce8', glow: '#c9a7ff', shadow: 'rgba(6,4,14,0.55)'
      },
      playerStart: { x: 70, y: 640 },
      exit: { x: 1180, y: 640, w: 64, h: 52, label: 'ROOFTOP LIFT' },
      walls: border().concat([
        { x: 420, y: 76, w: 18, h: 200 },
        { x: 420, y: 400, w: 18, h: 180 },
        { x: 860, y: 76, w: 18, h: 200 },
        { x: 860, y: 400, w: 18, h: 180 },
        { x: 560, y: 330, w: 160, h: 18 },
        { x: 560, y: 330, w: 18, h: 120 },
        { x: 702, y: 330, w: 18, h: 120 }
      ]),
      crates: [
        { x: 220, y: 180, w: 70, h: 70, kind: 'crate' },
        { x: 990, y: 180, w: 70, h: 70, kind: 'crate' },
        { x: 220, y: 520, w: 70, h: 70, kind: 'crate' },
        { x: 990, y: 520, w: 70, h: 70, kind: 'crate' },
        { x: 605, y: 380, w: 70, h: 60, kind: 'pedestal' }
      ],
      shadows: [
        { x: 20, y: 80, w: 160, h: 90 },
        { x: 1080, y: 80, w: 180, h: 90 },
        { x: 460, y: 620, w: 360, h: 76 },
        { x: 700, y: 90, w: 140, h: 60 }
      ],
      vents: vent(120, 340, 1120, 340),
      guards: [
        { x: 640, y: 300, speed: 72, wait: 0.8,
          waypoints: [[640, 300], [300, 300], [330, 540], [960, 540], [960, 300]] },
        { x: 520, y: 460, speed: 66, wait: 1.2,
          waypoints: [[520, 460], [520, 620], [760, 620], [760, 460]] },
        { x: 1120, y: 200, speed: 68, wait: 1.0,
          waypoints: [[1120, 200], [1120, 480], [940, 480], [940, 200]] }
      ],
      cameras: [
        { x: 640, y: 84, baseAngle: Math.PI / 2, sweep: 0.9, speed: 0.65, range: 225 },
        { x: 1252, y: 340, baseAngle: Math.PI, sweep: 0.7, speed: 0.75, range: 210 }
      ],
      lasers: [
        { x1: 440, y1: 300, x2: 840, y2: 300, period: 3.2, on: 1.8, phase: 0 },
        { x1: 440, y1: 580, x2: 840, y2: 580, period: 4.0, on: 2.2, phase: 1.6 }
      ],
      loot: [
        { x: 640, y: 415, kind: 'diamond', value: 600, required: true,
          label: 'Aurora Diamond' },
        { x: 90, y: 130, kind: 'jewel', value: 300, required: true,
          label: 'Sapphire I' },
        { x: 1190, y: 130, kind: 'jewel', value: 300, required: true,
          label: 'Sapphire II' },
        { x: 640, y: 660, kind: 'gold', value: 250, required: false,
          label: 'Gold Ingot' }
      ]
    }
  ];

  global.VV_LEVELS = LEVELS;
  global.VV_BOUNDS = { W: W, H: H, TOP: TOP, BOT: BOT, LEFT: LEFT, RIGHT: RIGHT };
})(window);
