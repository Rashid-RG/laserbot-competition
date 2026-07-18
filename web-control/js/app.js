/* ==========================================================================
   LASERBOT APEX-1 - TELEMETRY ENGINE & APP CONTROLLER (VANILLA JS)
   Interactions: Web Serial API, Keyboard Locomotion WASD, Telemetry Dials
   ========================================================================== */

class AppController {
  constructor() {
    this.currentView = 'home';
    this.registrations = [];
    this.leaderboard = [];
    
    // --- Web Serial State ---
    this.serialPort = null;
    this.serialReader = null;
    this.serialWriter = null;
    this.serialConnected = false;
    
    // Commands Throttling
    this.lastSentMotorCmd = "";
    this.lastMotorSendTime = 0;
    
    // Current Active Telemetry
    this.panAngle = 90;
    this.tiltAngle = 90;
    this.laserActive = false;
    
    // Active pressed keys for drive
    this.pressedKeys = {};

    this.init = this.init.bind(this);
    this.navigateTo = this.navigateTo.bind(this);
    this.showToast = this.showToast.bind(this);
  }

  init() {
    this.loadDatabase();
    this.setupNavigation();
    this.renderMemberFields();
    this.setupKeyboardControls();
    this.setupParticles();
    
    // Check hash on load
    const hash = window.location.hash.substring(1);
    if (hash && ['home', 'control', 'hardware', 'register', 'admin'].includes(hash)) {
      this.navigateTo(hash);
    } else {
      this.navigateTo('home');
    }
  }

  // --- DATABASE & LOCAL STORAGE ---
  loadDatabase() {
    // 1. Check registrations
    const localReg = localStorage.getItem('laserbot_registrations');
    if (localReg) {
      this.registrations = JSON.parse(localReg);
    } else {
      // Default demo teams
      this.registrations = [
        {
          id: 'LB-48901',
          teamName: 'CyberPhotonics',
          institution: 'Department of Physical Science',
          leaderName: 'Amith Perera',
          leaderEmail: 'amith.perera@fas.cmb.ac.lk',
          leaderPhone: '+94 77 123 4567',
          status: 'approved',
          members: [
            { name: 'Kavindi Silva', email: 'kavindi@mail.com', phone: '0711111111', role: 'Hardware Lead' }
          ],
          timestamp: Date.now() - 86400000 * 3
        }
      ];
      this.saveRegistrations();
    }

    // 2. Check leaderboard
    const localLead = localStorage.getItem('laserbot_leaderboard');
    if (localLead) {
      this.leaderboard = JSON.parse(localLead);
    } else {
      this.leaderboard = [
        { teamName: 'Apex-1 Calibration', institution: 'Physical Science', time: 11.23, type: 'simulator', status: 'approved' },
        { teamName: 'CyberPhotonics', institution: 'Department of Physical Science', time: 14.52, type: 'verified', status: 'approved' }
      ];
      this.saveLeaderboard();
    }

    this.updateActiveTicketDisplay();
  }

  saveRegistrations() {
    localStorage.setItem('laserbot_registrations', JSON.stringify(this.registrations));
    if (window.admin) window.admin.renderRegistrations();
  }

  saveLeaderboard() {
    this.leaderboard.sort((a, b) => a.time - b.time);
    localStorage.setItem('laserbot_leaderboard', JSON.stringify(this.leaderboard));
    if (window.admin) window.admin.renderRegistrations(); // updates admin stats too
  }

  // --- NAVIGATION ---
  setupNavigation() {
    const navToggle = document.getElementById('nav-toggle');
    const nav = document.querySelector('nav');
    
    if (navToggle && nav) {
      navToggle.addEventListener('click', () => {
        nav.classList.toggle('active');
        navToggle.classList.toggle('active');
      });
    }

    document.querySelectorAll('nav a').forEach(link => {
      link.addEventListener('click', () => {
        if (nav && nav.classList.contains('active')) {
          nav.classList.remove('active');
          navToggle.classList.remove('active');
        }
      });
    });
  }

  navigateTo(viewId) {
    document.querySelectorAll('nav a').forEach(link => {
      if (link.getAttribute('href') === `#${viewId}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    document.querySelectorAll('.view-section').forEach(section => {
      if (section.id === `view-${viewId}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    this.currentView = viewId;
    window.location.hash = viewId;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewId === 'control') {
      if (window.simulator) {
        simulator.resizeCanvas();
        simulator.draw();
      }
    }
  }

  // --- WEB SERIAL INTERFACE ---
  async connectSerial() {
    if (!('serial' in navigator)) {
      this.showToast('Web Serial API not supported in this browser. Use Chrome/Edge.', 'error');
      this.writeLog('ERR: Web Serial API not supported by browser.', 'err');
      return;
    }

    try {
      this.writeLog('[SYSTEM] Requesting Serial Port access...', 'sys');
      this.serialPort = await navigator.serial.requestPort();
      
      this.writeLog('[SYSTEM] Opening port at 115200 Baud...', 'sys');
      await this.serialPort.open({ baudRate: 115200 });
      
      this.serialConnected = true;
      this.updateSerialHUD(true);
      
      this.writeLog('[+] Connected to ESP32 board successfully!', 'out');
      this.showToast('Robot Connected', 'success');

      // Start serial reading loop in background
      this.readSerialLoop();
      
      // Initialize telemetry positions
      this.sendAimCommand(this.panAngle, this.tiltAngle);
    } catch (err) {
      this.writeLog(`ERR: Serial Port failed: ${err.message}`, 'err');
      this.showToast('Serial connection failed', 'error');
      this.updateSerialHUD(false);
    }
  }

  async readSerialLoop() {
    while (this.serialPort && this.serialPort.readable && this.serialConnected) {
      try {
        const textDecoder = new TextDecoderStream();
        this.serialReader = this.serialPort.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable.getReader();
        
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            reader.releaseLock();
            break;
          }
          if (value) {
            buffer += value;
            // Split by lines
            let lines = buffer.split('\n');
            buffer = lines.pop(); // Keep partial line in buffer
            
            for (let line of lines) {
              line = line.trim();
              if (line.length > 0) {
                this.writeLog(`[IN] ${line}`, 'in');
              }
            }
          }
        }
      } catch (err) {
        this.writeLog(`ERR: Connection closed or read error: ${err.message}`, 'err');
        this.updateSerialHUD(false);
        break;
      }
    }
  }

  async sendSerialMessage(message) {
    if (!this.serialConnected || !this.serialPort || !this.serialPort.writable) {
      return;
    }

    try {
      const encoder = new TextEncoder();
      const writer = this.serialPort.writable.getWriter();
      await writer.write(encoder.encode(message));
      writer.releaseLock();
      this.writeLog(`[OUT] ${message.trim()}`, 'out');
    } catch (err) {
      this.writeLog(`ERR: Write failure: ${err.message}`, 'err');
    }
  }

  updateSerialHUD(connected) {
    const indicator = document.getElementById('serial-status-indicator');
    const badge = document.getElementById('hud-connection-badge');

    if (connected) {
      if (indicator) {
        indicator.className = 'header-serial-status online';
        indicator.querySelector('.status-text').innerText = 'ROBOT CONNECTED';
      }
      if (badge) {
        badge.className = 'badge connected';
        badge.innerText = 'ONLINE';
      }
      this.serialConnected = true;
    } else {
      if (indicator) {
        indicator.className = 'header-serial-status offline';
        indicator.querySelector('.status-text').innerText = 'ROBOT OFFLINE';
      }
      if (badge) {
        badge.className = 'badge';
        badge.innerText = 'OFFLINE';
      }
      this.serialConnected = false;
      this.serialPort = null;
    }
  }

  // --- KEYBOARD LOCOMOTION WASD & SERVO DRIVES ---
  setupKeyboardControls() {
    // Keyboard Steering Bindings
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      
      // Stop typing from firing keys
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      this.pressedKeys[key] = true;

      // Locomotion Drives (WASD)
      if (['w', 'a', 's', 'd'].includes(key)) {
        e.preventDefault();
        this.updateKeyboardMotors();
      }

      // Servo Turret Drives (Arrows)
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        this.updateKeyboardServos(key);
      }

      // Laser emitter toggle (Spacebar)
      if (e.key === ' ' || key === 'spacebar') {
        e.preventDefault();
        if (!this.laserActive) {
          this.laserTrigger(true);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      delete this.pressedKeys[key];

      if (['w', 'a', 's', 'd'].includes(key)) {
        this.updateKeyboardMotors();
      }

      if (e.key === ' ' || key === 'spacebar') {
        this.laserTrigger(false);
      }
    });

    // Touchpad steering triggers
    document.querySelectorAll('.kbd-key').forEach(keyEl => {
      const dir = keyEl.getAttribute('data-dir');
      
      const startDrive = () => {
        keyEl.classList.add('active');
        if (dir === 'forward') this.sendMotorCommand(1, 1);
        if (dir === 'left') this.sendMotorCommand(-1, 1);
        if (dir === 'right') this.sendMotorCommand(1, -1);
        if (dir === 'backward') this.sendMotorCommand(-1, -1);
      };

      const stopDrive = () => {
        keyEl.classList.remove('active');
        this.sendMotorCommand(0, 0);
      };

      keyEl.addEventListener('mousedown', startDrive);
      keyEl.addEventListener('mouseup', stopDrive);
      keyEl.addEventListener('mouseleave', stopDrive);
      
      keyEl.addEventListener('touchstart', (e) => { e.preventDefault(); startDrive(); });
      keyEl.addEventListener('touchend', (e) => { e.preventDefault(); stopDrive(); });
    });
  }

  updateKeyboardMotors() {
    let left = 0;
    let right = 0;

    const w = this.pressedKeys['w'];
    const a = this.pressedKeys['a'];
    const s = this.pressedKeys['s'];
    const d = this.pressedKeys['d'];

    // Visual feedback for virtual keyboard keys
    document.getElementById('key-w')?.classList.toggle('active', w);
    document.getElementById('key-a')?.classList.toggle('active', a);
    document.getElementById('key-s')?.classList.toggle('active', s);
    document.getElementById('key-d')?.classList.toggle('active', d);

    if (w && !s) {
      if (a && !d) { left = 0.5; right = 1.0; } // steer left forward
      else if (d && !a) { left = 1.0; right = 0.5; } // steer right forward
      else { left = 1.0; right = 1.0; } // direct forward
    } else if (s && !w) {
      if (a && !d) { left = -0.5; right = -1.0; }
      else if (d && !a) { left = -1.0; right = -0.5; }
      else { left = -1.0; right = -1.0; } // direct backward
    } else {
      if (a && !d) { left = -1.0; right = 1.0; } // pivot spin left
      else if (d && !a) { left = 1.0; right = -1.0; } // pivot spin right
    }

    this.sendMotorCommand(left, right);
  }

  updateKeyboardServos(key) {
    const step = 3; // degree increment per click
    if (key === 'arrowleft') this.panAngle = Math.max(0, this.panAngle - step);
    if (key === 'arrowright') this.panAngle = Math.min(180, this.panAngle + step);
    if (key === 'arrowdown') this.tiltAngle = Math.max(0, this.tiltAngle - step);
    if (key === 'arrowup') this.tiltAngle = Math.min(180, this.tiltAngle + step);

    // Sync sliders
    document.getElementById('control-angle').value = this.panAngle;
    document.getElementById('control-power').value = this.tiltAngle;
    
    this.updateAngleHUDs();
    this.sendAimCommand(this.panAngle, this.tiltAngle);
  }

  updateAnglesFromSliders() {
    this.panAngle = parseInt(document.getElementById('control-angle').value);
    this.tiltAngle = parseInt(document.getElementById('control-power').value);
    
    this.updateAngleHUDs();
    this.sendAimCommand(this.panAngle, this.tiltAngle);
  }

  updateAngleHUDs() {
    document.getElementById('val-angle').innerText = `${this.panAngle}°`;
    document.getElementById('val-power').innerText = `${this.tiltAngle}°`;
    
    document.getElementById('telemetry-pan').innerText = `${this.panAngle}°`;
    document.getElementById('telemetry-tilt').innerText = `${this.tiltAngle}°`;
  }

  sendMotorCommand(left, right) {
    // Map floats into simple command format: M:left,right where left/right is [-1, 0, 1]
    const leftInt = left > 0 ? 1 : (left < 0 ? -1 : 0);
    const rightInt = right > 0 ? 1 : (right < 0 ? -1 : 0);
    
    const cmd = `M:${leftInt},${rightInt}\n`;

    // Avoid redundant packet spam (throttling)
    const now = Date.now();
    if (cmd !== this.lastSentMotorCmd || (now - this.lastMotorSendTime > 150)) {
      this.sendSerialMessage(cmd);
      this.lastSentMotorCmd = cmd;
      this.lastMotorSendTime = now;
    }
  }

  sendAimCommand(pan, tilt) {
    const cmd = `A:${pan},${tilt}\n`;
    this.sendSerialMessage(cmd);
  }

  laserTrigger(active) {
    const btn = document.getElementById('btn-fire');
    const hudVal = document.getElementById('telemetry-laser');
    
    this.laserActive = active;
    
    if (active) {
      btn?.classList.add('firing');
      if (hudVal) {
        hudVal.innerText = 'ON';
        hudVal.className = 'hud-val active';
      }
      this.sendSerialMessage('L:1\n');
    } else {
      btn?.classList.remove('firing');
      if (hudVal) {
        hudVal.innerText = 'OFF';
        hudVal.className = 'hud-val';
      }
      this.sendSerialMessage('L:0\n');
    }
  }

  // --- TERMINAL LOGGER LOGIC ---
  writeLog(message, type = 'sys') {
    const terminal = document.getElementById('serial-terminal-logs');
    if (!terminal) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const line = document.createElement('p');
    line.className = `terminal-line ${type}`;
    line.innerText = `[${time}] ${message}`;

    terminal.appendChild(line);
    
    // Auto-scroll to bottom
    terminal.scrollTop = terminal.scrollHeight;

    // Limit buffer length
    if (terminal.childElementCount > 100) {
      terminal.firstElementChild.remove();
    }
  }

  clearTerminal() {
    const terminal = document.getElementById('serial-terminal-logs');
    if (terminal) terminal.innerHTML = '[SYSTEM] Log buffer flushed.\n';
  }

  // --- DYNAMIC REGISTRATION FORM ---
  renderMemberFields() {
    const select = document.getElementById('reg-member-count');
    const container = document.getElementById('dynamic-members-container');
    if (!select || !container) return;

    const count = parseInt(select.value);
    container.innerHTML = '';

    for (let i = 1; i <= count; i++) {
      const memberBlock = document.createElement('div');
      memberBlock.className = 'dynamic-member-block';
      memberBlock.innerHTML = `
        <h4><i class="fa-solid fa-user-plus"></i> Crew Member 0${i + 1}</h4>
        <div class="form-row">
          <div class="form-control-group">
            <label for="reg-member-${i}-name">Full Name <span class="required">*</span></label>
            <input type="text" id="reg-member-${i}-name" required placeholder="Enter member name">
          </div>
          <div class="form-control-group">
            <label for="reg-member-${i}-email">Email Address <span class="required">*</span></label>
            <input type="email" id="reg-member-${i}-email" required placeholder="member@domain.com">
          </div>
        </div>
        <div class="form-row">
          <div class="form-control-group">
            <label for="reg-member-${i}-phone">Phone Number <span class="required">*</span></label>
            <input type="tel" id="reg-member-${i}-phone" required placeholder="e.g. 07XXXXXXXX">
          </div>
          <div class="form-control-group">
            <label for="reg-member-${i}-role">Competition Responsibility <span class="required">*</span></label>
            <select id="reg-member-${i}-role" required>
              <option value="Hardware Designer">Hardware Designer</option>
              <option value="Software Engineer">Software Engineer</option>
              <option value="Laser Optics Integrator">Laser Optics Integrator</option>
              <option value="Chassis Fabricator">Chassis Fabricator</option>
              <option value="Safety Marshall">Safety Marshall</option>
            </select>
          </div>
        </div>
      `;
      container.appendChild(memberBlock);
    }
  }

  handleRegistration(e) {
    e.preventDefault();
    
    const teamNameInput = document.getElementById('reg-team-name').value.trim();
    const institutionInput = document.getElementById('reg-institution').value.trim();
    const leaderNameInput = document.getElementById('reg-leader-name').value.trim();
    const leaderEmailInput = document.getElementById('reg-leader-email').value.trim();
    const leaderPhoneInput = document.getElementById('reg-leader-phone').value.trim();
    const memberCount = parseInt(document.getElementById('reg-member-count').value);

    // Validate name limits
    const exists = this.registrations.some(r => r.teamName.toLowerCase() === teamNameInput.toLowerCase());
    if (exists) {
      this.showToast('Team entry name already compiled.', 'error');
      return;
    }

    const members = [];
    for (let i = 1; i <= memberCount; i++) {
      const mName = document.getElementById(`reg-member-${i}-name`).value.trim();
      const mEmail = document.getElementById(`reg-member-${i}-email`).value.trim();
      const mPhone = document.getElementById(`reg-member-${i}-phone`).value.trim();
      const mRole = document.getElementById(`reg-member-${i}-role`).value;
      members.push({ name: mName, email: mEmail, phone: mPhone, role: mRole });
    }

    const randId = 'LB-' + Math.floor(10000 + Math.random() * 90000);
    const newReg = {
      id: randId,
      teamName: teamNameInput,
      institution: institutionInput,
      leaderName: leaderNameInput,
      leaderEmail: leaderEmailInput,
      leaderPhone: leaderPhoneInput,
      members: members,
      status: 'approved', // Auto-approved for this telemetry mock pass
      timestamp: Date.now()
    };

    this.registrations.push(newReg);
    this.saveRegistrations();
    
    localStorage.setItem('my_laserbot_registration', JSON.stringify(newReg));
    
    this.showToast('Entry Pass Compiled: ' + randId, 'success');
    this.updateActiveTicketDisplay();
  }

  updateActiveTicketDisplay() {
    const myReg = localStorage.getItem('my_laserbot_registration');
    const emptyState = document.querySelector('#ticket-status-box .empty-state');
    const ticketWrapper = document.getElementById('ticket-wrapper');

    if (myReg) {
      const reg = JSON.parse(myReg);
      
      document.getElementById('ticket-team-name').innerText = reg.teamName.toUpperCase();
      document.getElementById('ticket-id').innerText = reg.id;
      document.getElementById('ticket-leader').innerText = reg.leaderName;
      document.getElementById('ticket-members').innerText = `${reg.members.length + 1} Total`;
      document.getElementById('ticket-institution').innerText = reg.institution;
      document.getElementById('ticket-barcode-text').innerText = `${reg.id}-${Math.floor(1000 + Math.random()*9000)}`;

      this.generateBarcode('ticket-barcode-lines');
      this.generateQRCodeGrid('ticket-qr-grid');

      if (emptyState) emptyState.classList.add('hidden');
      if (ticketWrapper) ticketWrapper.classList.remove('hidden');
    } else {
      if (emptyState) emptyState.classList.remove('hidden');
      if (ticketWrapper) ticketWrapper.classList.add('hidden');
    }
  }

  generateBarcode(elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';
    
    for (let i = 0; i < 40; i++) {
      const bar = document.createElement('div');
      bar.className = 'barcode-bar';
      const widths = [1, 2, 3];
      const isVisible = Math.random() > 0.4;
      bar.style.width = widths[Math.floor(Math.random() * widths.length)] + 'px';
      bar.style.backgroundColor = isVisible ? '#ffffff' : 'transparent';
      container.appendChild(bar);
    }
  }

  generateQRCodeGrid(elementId) {
    const grid = document.getElementById(elementId);
    if (!grid) return;
    grid.innerHTML = '';
    
    for (let i = 0; i < 100; i++) {
      const dot = document.createElement('div');
      const row = Math.floor(i / 10);
      const col = i % 10;
      
      const isTopLeft = row < 3 && col < 3;
      const isTopRight = row < 3 && col > 6;
      const isBottomLeft = row > 6 && col < 3;
      
      if (isTopLeft || isTopRight || isBottomLeft) {
        const isBorder = (row === 0 || row === 2 || col === 0 || col === 2) ||
                         (row === 0 || row === 2 || col === 7 || col === 9) ||
                         (row === 7 || row === 9 || col === 0 || col === 2);
        dot.className = `qr-dot ${isBorder ? '' : 'white'}`;
      } else {
        dot.className = `qr-dot ${Math.random() > 0.45 ? '' : 'white'}`;
      }
      grid.appendChild(dot);
    }
  }

  printTicket() { window.print(); }

  resetRegistration() {
    if (confirm("Reset entry pass? Saved ticket values will be cleared.")) {
      const myReg = localStorage.getItem('my_laserbot_registration');
      if (myReg) {
        const parsed = JSON.parse(myReg);
        this.registrations = this.registrations.filter(r => r.id !== parsed.id);
        this.saveRegistrations();
      }
      
      localStorage.removeItem('my_laserbot_registration');
      this.updateActiveTicketDisplay();
      this.showToast('Pass values reset.', 'info');
    }
  }

  // --- TOASTS UTILITY ---
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check" style="color: var(--color-success);"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation" style="color: var(--primary-red);"></i>';

    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
  }

  // --- DUST particles BACKGROUND ---
  setupParticles() {
    const container = document.getElementById('particles-container');
    if (!container) return;

    const createParticle = () => {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 3 + 2;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.animationDuration = Math.random() * 8 + 8 + 's';
      p.style.animationDelay = Math.random() * 3 + 's';
      
      container.appendChild(p);
      setTimeout(() => p.remove(), 16000);
    };

    for (let i = 0; i < 15; i++) createParticle();
    setInterval(createParticle, 1500);
  }
}

// Instantiate Global app
const app = new AppController();
window.addEventListener('DOMContentLoaded', app.init);
window.app = app;
