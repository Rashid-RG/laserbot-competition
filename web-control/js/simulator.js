/* ==========================================================================
   LASERBOT APEX-1 - 2D CANVAS TARGET CHALLENGE SIMULATOR
   Features: Turret positioning, vector laser reflections, hit detection
   ========================================================================== */

class LaserSimulator {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    
    // Gameplay States
    this.isRunning = false;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.activationProgress = 0; // 0 to 100 %
    this.bestTime = null;
    
    // Physics Coordinates
    this.robotPos = { x: 120, y: 340 };
    this.towerPos = { x: 680, y: 160 };
    this.targetRadius = 15;
    
    // Target motion limits
    this.targetY = 220;
    this.targetDirection = 1;
    
    // Particles System
    this.sparks = [];
    this.celebrations = [];
    
    this.loop = this.loop.bind(this);
  }

  init() {
    this.canvas = document.getElementById('simulator-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.resizeCanvas();
    this.draw();

    // Listen to laser buttons
    const fireBtn = document.getElementById('btn-fire');
    if (fireBtn) {
      fireBtn.addEventListener('mousedown', () => {
        if (this.isRunning) app.laserTrigger(true);
      });
      window.addEventListener('mouseup', () => {
        if (this.isRunning) app.laserTrigger(false);
      });
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    // Keep canvas 800x400 aspect ratio relative to container
    const width = this.canvas.parentElement.clientWidth;
    this.canvas.width = width;
    this.canvas.height = 400;
  }

  startChallenge() {
    this.isRunning = true;
    this.startTime = Date.now();
    this.elapsedTime = 0;
    this.activationProgress = 0;
    this.sparks = [];
    this.celebrations = [];
    
    // Hide overlay
    document.getElementById('simulator-overlay').classList.add('hidden');
    document.getElementById('submit-score-box').classList.add('disabled');
    
    // Start game loop
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = requestAnimationFrame(this.loop);
    app.showToast('Calibration Match Started. Target Locked!', 'info');
  }

  stopChallenge(success = false) {
    this.isRunning = false;
    cancelAnimationFrame(this.animationId);
    
    // Show overlay
    const overlay = document.getElementById('simulator-overlay');
    overlay.classList.remove('hidden');
    overlay.querySelector('h3').innerText = success ? 'TARGET COMPLETED!' : 'CALIBRATION HALTED';
    overlay.querySelector('p').innerText = success 
      ? `LaserBot target successfully activated in ${this.elapsedTime.toFixed(2)} seconds!` 
      : 'Calibration was interrupted. Try again to log scores.';
    overlay.querySelector('button').innerText = 'Start Calibration Run';

    app.laserTrigger(false);

    if (success) {
      // Reveal submit box
      document.getElementById('submit-score-box').classList.remove('disabled');
      
      // Update high score
      if (!this.bestTime || this.elapsedTime < this.bestTime) {
        this.bestTime = this.elapsedTime;
        document.getElementById('sim-best').innerText = `${this.bestTime.toFixed(2)}s`;
      }
      app.showToast('Target Activated! Ready to Submit Score.', 'success');
    }
  }

  submitScore() {
    const teamNameInput = document.getElementById('sim-team-name').value.trim();
    if (!teamNameInput) {
      app.showToast('Please enter a team name.', 'error');
      return;
    }

    // Push score directly to leaderboard database
    app.leaderboard.push({
      teamName: teamNameInput,
      institution: 'Simulator Hub',
      time: this.elapsedTime,
      type: 'simulator',
      status: 'approved'
    });
    
    app.saveLeaderboard();
    app.showToast('Score logged to Leaderboard!', 'success');
    
    // Hide submit area
    document.getElementById('submit-score-box').classList.add('disabled');
  }

  // --- GAME LOOP ---
  loop() {
    if (!this.isRunning) return;

    this.update();
    this.draw();

    this.animationId = requestAnimationFrame(this.loop);
  }

  update() {
    // 1. Update Timer
    this.elapsedTime = (Date.now() - this.startTime) / 1000;
    document.getElementById('sim-timer').innerText = `${this.elapsedTime.toFixed(2)}s`;
    
    // 2. Slow moving target up/down to simulate dynamic alignment challenge
    const speed = 0.8;
    this.targetY += this.targetDirection * speed;
    if (this.targetY > 280) {
      this.targetY = 280;
      this.targetDirection = -1;
    } else if (this.targetY < 180) {
      this.targetY = 180;
      this.targetDirection = 1;
    }

    // 3. Process Laser Path & Target Collisions
    let hit = false;
    let finalLaserPos = null;

    if (app.laserActive) {
      const reflectEnabled = document.getElementById('control-mirror').checked;
      const panRad = (app.panAngle - 90) * Math.PI / 180; // horizontal angle offset
      const tiltRad = (app.tiltAngle - 90) * Math.PI / 180; // vertical angle offset
      
      // Starting coordinates at turret tip
      let startX = this.robotPos.x + Math.sin(panRad) * 40;
      let startY = this.robotPos.y - 30 - Math.sin(tiltRad) * 40;
      
      // Calculate shooting vector
      // In 2D plane: X goes right, Y goes up/down. Let's aim rightward.
      const angle = -tiltRad; // negative because canvas Y is inverted
      let vx = Math.cos(angle);
      let vy = Math.sin(angle);

      const laserSegments = this.calculateLaserPath(startX, startY, vx, vy, reflectEnabled);
      finalLaserPos = laserSegments[laserSegments.length - 1];

      // Check if laser tip is near the target coordinates
      const distToTarget = this.distanceToPoint(finalLaserPos.x, finalLaserPos.y, this.towerPos.x, this.targetY);
      if (distToTarget < this.targetRadius + 5) {
        hit = true;
        // Generate spark particles at target hit site
        this.createSparks(finalLaserPos.x, finalLaserPos.y);
      }
    }

    // 4. Progress activation state
    if (hit) {
      // 3.0 seconds to activate. 60fps = 180 frames. E.g. +0.55% per frame
      this.activationProgress = Math.min(100, this.activationProgress + 0.6);
      
      // Screen shake or rumble simulation
      if (this.activationProgress >= 100) {
        this.createCelebration(this.towerPos.x, this.targetY);
        this.stopChallenge(true);
        return;
      }
    } else {
      // Gradual drain if not being hit (requires sustained contact)
      this.activationProgress = Math.max(0, this.activationProgress - 0.25);
    }
    
    document.getElementById('sim-activation').innerText = `${Math.floor(this.activationProgress)}%`;

    // 5. Update Particle Arrays
    this.sparks = this.sparks.filter(s => {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.08; // gravity
      s.life -= 1;
      return s.life > 0;
    });

    this.celebrations = this.celebrations.filter(c => {
      c.x += c.vx;
      c.y += c.vy;
      c.life -= 1;
      return c.life > 0;
    });
  }

  calculateLaserPath(startX, startY, vx, vy, reflect) {
    let path = [{ x: startX, y: startY }];
    let cx = startX;
    let cy = startY;
    let dx = vx;
    let dy = vy;
    
    const maxBounces = reflect ? 4 : 0;
    const maxRange = 1200;
    let distTravelled = 0;
    
    for (let bounce = 0; bounce <= maxBounces; bounce++) {
      // Find intersection with borders or target tower plane
      // Tower vertical plane is at x = towerPos.x = 680
      let t_tower = Infinity;
      if (dx > 0) {
        t_tower = (this.towerPos.x - cx) / dx;
      }

      // Check wall limits: Right x = canvas.width, Left x = 0, Top y = 0, Bottom y = 360 (ground)
      const limits = {
        right: dx > 0 ? (this.canvas.width - cx) / dx : Infinity,
        left: dx < 0 ? (0 - cx) / dx : Infinity,
        top: dy < 0 ? (0 - cy) / dy : Infinity,
        bottom: dy > 0 ? (360 - cy) / dy : Infinity
      };

      // Find earliest collision
      let t_min = Math.min(t_tower, limits.right, limits.left, limits.top, limits.bottom);
      
      if (t_min === Infinity || t_min <= 0) {
        // Shoot vector far into distance
        cx += dx * maxRange;
        cy += dy * maxRange;
        path.push({ x: cx, y: cy });
        break;
      }
      
      cx += dx * t_min;
      cy += dy * t_min;
      path.push({ x: cx, y: cy });
      distTravelled += t_min;

      if (distTravelled >= maxRange) break;

      // If hit the tower plane, stop laser there
      if (t_min === t_tower) {
        break;
      }

      // Reflect off boundaries
      if (t_min === limits.top || t_min === limits.bottom) {
        dy = -dy; // mirror vertical
      } else if (t_min === limits.left || t_min === limits.right) {
        dx = -dx; // mirror horizontal
      }
    }

    return path;
  }

  // --- DRAWING CANVAS SCENE ---
  draw() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, w, h);
    
    // Draw Grid Backdrop
    ctx.strokeStyle = 'rgba(255, 51, 51, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw Ground Floor
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 360, w, 40);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(0, 360);
    ctx.lineTo(w, 360);
    ctx.stroke();

    // 1. Draw Target Tower (Castle Tower Style)
    ctx.fillStyle = '#10141e';
    ctx.strokeStyle = varColor('--border-color');
    ctx.lineWidth = 2;
    // Base Tower
    ctx.fillRect(this.towerPos.x, this.towerPos.y, 80, 200);
    ctx.strokeRect(this.towerPos.x, this.towerPos.y, 80, 200);
    // Battlement Tops
    ctx.fillRect(this.towerPos.x - 5, this.towerPos.y - 15, 90, 15);
    ctx.strokeRect(this.towerPos.x - 5, this.towerPos.y - 15, 90, 15);
    
    // 2. Draw Target Bullseye Sensor
    const pulseRadius = this.targetRadius + Math.sin(Date.now() / 150) * 3;
    ctx.fillStyle = 'rgba(255, 51, 51, 0.15)';
    ctx.beginPath();
    ctx.arc(this.towerPos.x, this.targetY, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.towerPos.x, this.targetY, this.targetRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(this.towerPos.x, this.targetY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Target Activation bar right next to the target
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(this.towerPos.x + 25, this.targetY - 15, 6, 30);
    ctx.fillStyle = hitColor(this.activationProgress);
    ctx.fillRect(this.towerPos.x + 25, this.targetY + 15, 6, -((this.activationProgress/100) * 30));

    // 3. Draw LaserBot Chassis (competitor robot model)
    ctx.save();
    // Wheels
    ctx.fillStyle = '#171b26';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    // Left Wheel
    ctx.fillRect(this.robotPos.x - 40, this.robotPos.y + 10, 22, 10);
    ctx.strokeRect(this.robotPos.x - 40, this.robotPos.y + 10, 22, 10);
    // Right Wheel
    ctx.fillRect(this.robotPos.x + 18, this.robotPos.y + 10, 22, 10);
    ctx.strokeRect(this.robotPos.x + 18, this.robotPos.y + 10, 22, 10);
    
    // Chassis Frame
    ctx.fillStyle = '#0e1118';
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 2;
    ctx.fillRect(this.robotPos.x - 30, this.robotPos.y - 15, 60, 25);
    ctx.strokeRect(this.robotPos.x - 30, this.robotPos.y - 15, 60, 25);
    
    // Controller board overlay
    ctx.fillStyle = 'rgba(0, 230, 118, 0.4)';
    ctx.fillRect(this.robotPos.x - 15, this.robotPos.y - 10, 30, 6);
    
    // Servo Pan base
    ctx.fillStyle = '#171b26';
    ctx.fillRect(this.robotPos.x - 10, this.robotPos.y - 25, 20, 10);

    // Turret Barrel (Rotating via Sliders angle)
    ctx.translate(this.robotPos.x, this.robotPos.y - 30);
    const panRad = (app.panAngle - 90) * Math.PI / 180;
    const tiltRad = (app.tiltAngle - 90) * Math.PI / 180;
    ctx.rotate(-tiltRad); // side-view pitch orientation
    
    // Barrel wireframe
    ctx.fillStyle = '#2b3447';
    ctx.fillRect(0, -6, 40, 12);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, -6, 40, 12);
    
    // Red indicator tip
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(36, -3, 4, 6);
    ctx.restore();

    // 4. Draw Laser beam path lines
    if (app.laserActive) {
      const startPanRad = (app.panAngle - 90) * Math.PI / 180;
      const startTiltRad = (app.tiltAngle - 90) * Math.PI / 180;
      let startX = this.robotPos.x + Math.sin(startPanRad) * 40;
      let startY = this.robotPos.y - 30 - Math.sin(startTiltRad) * 40;
      
      const reflect = document.getElementById('control-mirror').checked;
      const angle = -startTiltRad;
      let vx = Math.cos(angle);
      let vy = Math.sin(angle);
      
      const segments = this.calculateLaserPath(startX, startY, vx, vy, reflect);
      
      // Red Laser Core line
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff3333';
      ctx.strokeStyle = '#ff1a1a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(segments[0].x, segments[0].y);
      for (let i = 1; i < segments.length; i++) {
        ctx.lineTo(segments[i].x, segments[i].y);
      }
      ctx.stroke();

      // White inner core
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 5. Draw Spark Particles
    this.sparks.forEach(s => {
      ctx.fillStyle = `rgba(255, ${Math.floor(s.life*5)}, 51, ${s.life / 25})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. Draw Celebration Explosion
    this.celebrations.forEach(c => {
      ctx.fillStyle = `rgba(${c.color.r}, ${c.color.g}, ${c.color.b}, ${c.life / 60})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // --- COLLISION SPARK BUILDER ---
  createSparks(x, y) {
    for (let i = 0; i < 3; i++) {
      this.sparks.push({
        x: x,
        y: y,
        vx: (Math.random() - 1.2) * 2, // burst back
        vy: (Math.random() - 0.5) * 4 - 2,
        size: Math.random() * 2 + 1.5,
        life: Math.random() * 15 + 10
      });
    }
  }

  createCelebration(x, y) {
    const colors = [
      {r: 0, g: 230, b: 118}, // green
      {r: 255, g: 51, b: 51}, // red
      {r: 255, g: 215, b: 0}  // gold
    ];
    for (let i = 0; i < 40; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const ang = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 5 + 2;
      this.celebrations.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * velocity,
        vy: Math.sin(ang) * velocity,
        size: Math.random() * 4 + 2,
        color: color,
        life: Math.random() * 40 + 20
      });
    }
  }

  distanceToPoint(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1)**2 + (y2 - y1)**2);
  }
}

// Utility colors getter
function varColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#fff';
}
function hitColor(val) {
  if (val > 80) return '#00e676';
  if (val > 40) return '#ffb300';
  return '#ff3333';
}

// Global instantiation
const simulator = new LaserSimulator();
window.addEventListener('DOMContentLoaded', () => {
  simulator.init();
});
window.simulator = simulator;
