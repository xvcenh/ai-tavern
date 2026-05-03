// AI Tavern - Map Engine
// Canvas-based tile map with NPC movement, day/night cycle, and camera controls

const TILE_SIZE = 48;
const MAP_WIDTH = 32;
const MAP_HEIGHT = 20;

// Terrain tiles
const TERRAIN = {
  GRASS:        { char: '.', color: '#2d5a1e',   name: 'grass' },
  PATH:         { char: '#', color: '#8b7355',   name: 'path' },
  BUILDING:     { char: 'B', color: '#5a4a3a',   name: 'building' },
  WATER:        { char: '~', color: '#1a5276',   name: 'water' },
  FOREST:       { char: 'T', color: '#1e4d2b',   name: 'forest' },
  MOUNTAIN:     { char: 'M', color: '#4a4a4a',   name: 'mountain' },
  BRIDGE:       { char: '=', color: '#8b7355',   name: 'bridge' },
  WALL:         { char: 'W', color: '#6a5a4a',   name: 'wall' },
  GRAVE:        { char: 'g', color: '#3a3a3a',   name: 'grave' },
  FLOWER:       { char: '*', color: '#4a8c3f',   name: 'flower' },
  MARKET:       { char: 'm', color: '#c4a44a',   name: 'market' }
};

// Tile map (0-based grid)
const TILE_MAP = [
  'TTTTTTTTTTTTMMMMMMMMMM~~~~~~~~~~~~',  // 0
  'TTTTTTTTTTTTMMMMMM~~~~~~~~~~~~~~~~~',  // 1
  'TTTTTgg..TTTT~~~~~~~~~~~~~~~~~~~~MM',  // 2
  'TTTTgg...TTTT~~~~~~~~~~~~~~MMMMMMM',  // 3
  'TTTT......TTT~~~~~~~~~~~MMMMMMMMMM',  // 4
  'TTTT...T.TTTT~~~~==~~~~~~~~~~~~MMM',  // 5
  'TTT...TTT.TT~~~~~~~~~~BBBB~~~~~~MM',  // 6
  'TT....TTT................BBBB.....',  // 7
  'TT...TTT.......BBBB......BBBB.....',  // 8
  'TTT......##....BBBB...##........##',  // 9
  'TT.......##............##......##..',  // 10
  '.TT......##..BBBB.......##....##..T', // 11
  '....#....BB..BBBB...BB....##.##...T', // 12
  '.......#.............BB........#.TT', // 13
  '...B...#..BBBB..............#...TTT', // 14
  '...B...#..BBBB..BB..........#....TT', // 15
  '...BBBB........BB....BBBB.....#.TTT', // 16
  '.########......BB....BBBB.......TTT', // 17
  '..##..##................BBBB.......', // 18
  '..##..##.....BBBB.......BBBB...TTTT', // 19
];

const Map = {
  canvas: null,
  ctx: null,
  camera: { x: 0, y: 0 },
  npcPositions: {}, // npcId -> {x, y}
  playerPos: { x: 10, y: 14 },
  timeOfDay: 12, // 0-24
  dayPhase: 'day',
  particles: [],
  animFrame: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Initialize NPC positions from data
    for (const [id, npc] of Object.entries(NPCS)) {
      this.npcPositions[id] = { x: npc.x, y: npc.y, targetX: npc.x, targetY: npc.y, moveTimer: 0 };
    }
    
    // Camera follow player
    this.centerOnPlayer();
  },

  resize() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth * 2;  // Retina
    this.canvas.height = container.clientHeight * 2;
    this.canvas.style.width = container.clientWidth + 'px';
    this.canvas.style.height = container.clientHeight + 'px';
    this.ctx.scale(2, 2);
  },

  centerOnPlayer() {
    const w = this.canvas.style.width ? parseInt(this.canvas.style.width) / 2 : 400;
    const h = this.canvas.style.height ? parseInt(this.canvas.style.height) / 2 : 300;
    this.camera.x = this.playerPos.x * TILE_SIZE + TILE_SIZE/2 - w;
    this.camera.y = this.playerPos.y * TILE_SIZE + TILE_SIZE/2 - h;
  },

  // Get tile at grid position
  getTile(gx, gy) {
    if (gy < 0 || gy >= MAP_HEIGHT || gx < 0 || gx >= MAP_WIDTH) return TERRAIN.MOUNTAIN;
    const row = TILE_MAP[gy] || '';
    const ch = row[gx] || '.';
    for (const [key, tile] of Object.entries(TERRAIN)) {
      if (tile.char === ch) return tile;
    }
    return TERRAIN.GRASS;
  },

  isWalkable(gx, gy) {
    const tile = this.getTile(gx, gy);
    return tile !== TERRAIN.WATER && tile !== TERRAIN.MOUNTAIN && tile !== TERRAIN.WALL && tile !== TERRAIN.BUILDING;
  },

  // Move NPCs randomly within walkable area
  updateNPCs(dt) {
    for (const [id, pos] of Object.entries(this.npcPositions)) {
      pos.moveTimer -= dt;
      if (pos.moveTimer <= 0) {
        pos.moveTimer = 2 + Math.random() * 4; // 2-6 seconds between moves
        
        // Random walk: pick adjacent tile
        const dirs = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]];
        const shuffled = dirs.sort(() => Math.random() - 0.5);
        
        for (const [dx, dy] of shuffled) {
          const nx = pos.x + dx;
          const ny = pos.y + dy;
          if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && this.isWalkable(nx, ny)) {
            pos.targetX = nx;
            pos.targetY = ny;
            break;
          }
        }
      }
      
      // Smooth movement toward target
      const speed = 2; // tiles per second
      const dx = pos.targetX - pos.x;
      const dy = pos.targetY - pos.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0.05) {
        pos.x += (dx / dist) * speed * dt;
        pos.y += (dy / dist) * speed * dt;
      } else {
        pos.x = pos.targetX;
        pos.y = pos.targetY;
      }
    }
  },

  // Update time of day
  updateTime(dt) {
    // 1 real second = ~2 game minutes
    this.timeOfDay += dt * 0.033;
    if (this.timeOfDay >= 24) this.timeOfDay -= 24;
    
    if (this.timeOfDay >= 6 && this.timeOfDay < 18) this.dayPhase = 'day';
    else if (this.timeOfDay >= 18 && this.timeOfDay < 20) this.dayPhase = 'dusk';
    else if (this.timeOfDay >= 20 || this.timeOfDay < 5) this.dayPhase = 'night';
    else this.dayPhase = 'dawn';
  },

  // Main render
  render() {
    const ctx = this.ctx;
    const w = this.canvas.style.width ? parseInt(this.canvas.style.width) : 800;
    const h = this.canvas.style.height ? parseInt(this.canvas.style.height) : 400;
    
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    
    // Day/night overlay color
    let overlayColor, overlayAlpha;
    switch (this.dayPhase) {
      case 'day':   overlayColor = '#fff8dc'; overlayAlpha = 0.0; break;
      case 'dusk':  overlayColor = '#ff8c42'; overlayAlpha = 0.15; break;
      case 'dawn':  overlayColor = '#87ceeb'; overlayAlpha = 0.1; break;
      case 'night': overlayColor = '#0a0a2e'; overlayAlpha = 0.45; break;
    }
    
    // Calculate visible tiles
    const startCol = Math.max(0, Math.floor(this.camera.x / TILE_SIZE) - 1);
    const endCol = Math.min(MAP_WIDTH, startCol + Math.ceil(w / TILE_SIZE) + 2);
    const startRow = Math.max(0, Math.floor(this.camera.y / TILE_SIZE) - 1);
    const endRow = Math.min(MAP_HEIGHT, startRow + Math.ceil(h / TILE_SIZE) + 2);
    
    // Draw tiles
    for (let gy = startRow; gy < endRow; gy++) {
      for (let gx = startCol; gx < endCol; gx++) {
        const tile = this.getTile(gx, gy);
        const sx = gx * TILE_SIZE - this.camera.x;
        const sy = gy * TILE_SIZE - this.camera.y;
        
        // Base tile
        ctx.fillStyle = tile.color;
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        
        // Grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
        
        // Tile details
        if (tile === TERRAIN.GRASS && (gx + gy) % 5 === 0) {
          ctx.fillStyle = '#3a6b24';
          ctx.fillRect(sx + TILE_SIZE/2 - 2, sy + TILE_SIZE/2 - 2, 4, 4);
        }
        if (tile === TERRAIN.FOREST) {
          ctx.fillStyle = '#1a3d15';
          ctx.beginPath();
          ctx.arc(sx + TILE_SIZE/2, sy + TILE_SIZE/2, TILE_SIZE/2.5, 0, Math.PI*2);
          ctx.fill();
        }
        if (tile === TERRAIN.WATER) {
          const wave = Math.sin(this.animFrame * 0.05 + gx + gy) * 2;
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(sx, sy + TILE_SIZE/2 + wave, TILE_SIZE, 2);
        }
      }
    }
    
    // Draw location markers
    for (const [id, loc] of Object.entries(LOCATIONS)) {
      const sx = loc.x * TILE_SIZE - this.camera.x;
      const sy = loc.y * TILE_SIZE - this.camera.y;
      if (sx > -50 && sx < w + 50 && sy > -50 && sy < h + 50) {
        // Pulse effect
        const pulse = Math.sin(this.animFrame * 0.05) * 0.3 + 0.7;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(sx + TILE_SIZE/2, sy + TILE_SIZE/2 - 10, 14 * pulse, 0, Math.PI*2);
        ctx.fill();
        
        // Icon
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.fillText(loc.icon, sx + TILE_SIZE/2, sy + TILE_SIZE/2 - 4);
        
        // Name label (only when close)
        if (pulse > 0.8) {
          ctx.font = '9px sans-serif';
          ctx.fillStyle = 'white';
          ctx.fillText(loc.name, sx + TILE_SIZE/2, sy + TILE_SIZE/2 + 16);
        }
      }
    }
    
    // Draw NPCs
    for (const [id, npc] of Object.entries(NPCS)) {
      const pos = this.npcPositions[id];
      if (!pos) continue;
      const sx = pos.x * TILE_SIZE - this.camera.x;
      const sy = pos.y * TILE_SIZE - this.camera.y;
      if (sx > -30 && sx < w + 30 && sy > -30 && sy < h + 30) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(sx + TILE_SIZE/2, sy + TILE_SIZE/2 + 6, 10, 4, 0, 0, Math.PI*2);
        ctx.fill();
        
        // NPC body
        ctx.fillStyle = npc.color;
        ctx.beginPath();
        ctx.arc(sx + TILE_SIZE/2, sy + TILE_SIZE/2 - 4, 12, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // NPC icon
        ctx.font = '16px serif';
        ctx.textAlign = 'center';
        ctx.fillText(npc.icon, sx + TILE_SIZE/2, sy + TILE_SIZE/2);
        
        // Name tag
        ctx.font = 'bold 8px sans-serif';
        ctx.fillStyle = 'white';
        ctx.fillText(npc.name, sx + TILE_SIZE/2, sy + TILE_SIZE/2 + 20);
      }
    }
    
    // Draw player
    const px = this.playerPos.x * TILE_SIZE - this.camera.x;
    const py = this.playerPos.y * TILE_SIZE - this.camera.y;
    
    // Player glow
    const glowGrad = ctx.createRadialGradient(px + TILE_SIZE/2, py + TILE_SIZE/2, 4, px + TILE_SIZE/2, py + TILE_SIZE/2, 22);
    glowGrad.addColorStop(0, 'rgba(212,168,67,0.6)');
    glowGrad.addColorStop(1, 'rgba(212,168,67,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 22, 0, Math.PI*2);
    ctx.fill();
    
    // Player body
    ctx.fillStyle = '#d4a843';
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2 - 4, 14, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#f0d68a';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Player icon
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧑', px + TILE_SIZE/2, py + TILE_SIZE/2 + 3);
    
    // Day/night overlay
    ctx.fillStyle = overlayColor;
    ctx.globalAlpha = overlayAlpha;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    
    // Vignette
    const vignette = ctx.createRadialGradient(w/2, h/2, w*0.4, w/2, h/2, w*0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    
    ctx.restore();
  },

  // Move player in direction
  movePlayer(dx, dy) {
    const nx = this.playerPos.x + dx;
    const ny = this.playerPos.y + dy;
    if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && this.isWalkable(nx, ny)) {
      this.playerPos.x = nx;
      this.playerPos.y = ny;
      this.centerOnPlayer();
      return true;
    }
    return false;
  },

  // Check what's at a position (for interaction)
  getNearbyNPC(maxDist = 1.5) {
    for (const [id, pos] of Object.entries(this.npcPositions)) {
      const dx = pos.x - this.playerPos.x;
      const dy = pos.y - this.playerPos.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < maxDist) {
        return { id, npc: NPCS[id], distance: dist };
      }
    }
    return null;
  },

  // Get nearby location
  getNearbyLocation(maxDist = 2) {
    for (const [id, loc] of Object.entries(LOCATIONS)) {
      const dx = loc.x - this.playerPos.x;
      const dy = loc.y - this.playerPos.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < maxDist) {
        return { id, location: loc, distance: dist };
      }
    }
    return null;
  }
};
