/* ==========================================================================
   LASERBOT COMPETITION 2026 - APP CONTROLLER (VANILLA JS)
   ========================================================================== */

class AppController {
  constructor() {
    this.currentView = 'home';
    this.registrations = [];
    this.leaderboard = [];
    
    // Target Event Date: July 24, 2026 08:00:00 AM
    this.eventDate = new Date('2026-07-24T08:00:00').getTime();
    
    // Binding methods
    this.init = this.init.bind(this);
    this.navigateTo = this.navigateTo.bind(this);
    this.showToast = this.showToast.bind(this);
  }

  init() {
    this.loadDatabase();
    this.setupNavigation();
    this.setupCountdown();
    this.renderMemberFields();
    this.renderLeaderboard();
    this.setupParticles();
    
    // Check hash on load
    const hash = window.location.hash.substring(1);
    if (hash && ['home', 'guidelines', 'simulator', 'leaderboard', 'register', 'admin'].includes(hash)) {
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
            { name: 'Kavindi Silva', email: 'kavindi@mail.com', phone: '0711111111', role: 'Hardware Lead' },
            { name: 'Janith de Alwis', email: 'janith@mail.com', phone: '0722222222', role: 'Software Engineer' }
          ],
          timestamp: Date.now() - 86400000 * 3
        },
        {
          id: 'LB-90218',
          teamName: 'Quantum Rays',
          institution: 'FAS - Physical Science',
          leaderName: 'Sarah Jenkins',
          leaderEmail: 'sjenkins@phys.res.lk',
          leaderPhone: '+94 71 890 1234',
          status: 'approved',
          members: [
            { name: 'Ravi Kumar', email: 'ravi@mail.com', phone: '0773333333', role: 'Optics Specialist' }
          ],
          timestamp: Date.now() - 86400000 * 2
        },
        {
          id: 'LB-31142',
          teamName: 'Spectral Aimers',
          institution: 'Department of Physical Science',
          leaderName: 'Nipuna Bandara',
          leaderEmail: 'nbandara@std.ac.lk',
          leaderPhone: '+94 70 456 7890',
          status: 'pending',
          members: [],
          timestamp: Date.now() - 3600000 * 5
        }
      ];
      this.saveRegistrations();
    }

    // 2. Check leaderboard
    const localLead = localStorage.getItem('laserbot_leaderboard');
    if (localLead) {
      this.leaderboard = JSON.parse(localLead);
    } else {
      // Default demo times (in seconds)
      this.leaderboard = [
        { teamName: 'CyberPhotonics', institution: 'Department of Physical Science', time: 12.45, type: 'verified', status: 'approved' },
        { teamName: 'Quantum Rays', institution: 'FAS - Physical Science', time: 15.12, type: 'verified', status: 'approved' },
        { teamName: 'CyberPhotonics', institution: 'Department of Physical Science', time: 18.23, type: 'simulator', status: 'approved' },
        { teamName: 'Quantum Rays', institution: 'FAS - Physical Science', time: 24.67, type: 'simulator', status: 'approved' }
      ];
      this.saveLeaderboard();
    }

    // Check if current user is registered
    this.updateActiveTicketDisplay();
  }

  saveRegistrations() {
    localStorage.setItem('laserbot_registrations', JSON.stringify(this.registrations));
    if (window.admin) window.admin.renderRegistrations();
  }

  saveLeaderboard() {
    // Sort ascending (fastest time wins)
    this.leaderboard.sort((a, b) => a.time - b.time);
    localStorage.setItem('laserbot_leaderboard', JSON.stringify(this.leaderboard));
    this.renderLeaderboard();
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

    // Close mobile nav on link click
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
    // Update Active Nav Link
    document.querySelectorAll('nav a').forEach(link => {
      if (link.getAttribute('href') === `#${viewId}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Toggle Views
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

    // Handle view specific initializations
    if (viewId === 'simulator') {
      if (window.simulator) {
        simulator.resizeCanvas();
        simulator.draw();
      }
    } else if (viewId === 'admin') {
      if (window.admin) {
        admin.init();
      }
    }
  }

  switchTab(event, tabId) {
    const parent = event.currentTarget.parentElement;
    parent.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    const tabContainer = parent.nextElementSibling;
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
  }

  // --- COUNTDOWN TIMER ---
  setupCountdown() {
    const countdownFn = () => {
      const now = new Date().getTime();
      const distance = this.eventDate - now;

      if (distance < 0) {
        document.getElementById('countdown-timer').innerHTML = "<h4>COMPETITION IN PROGRESS</h4>";
        clearInterval(this.countdownInterval);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      document.getElementById('days').innerText = String(days).padStart(2, '0');
      document.getElementById('hours').innerText = String(hours).padStart(2, '0');
      document.getElementById('minutes').innerText = String(minutes).padStart(2, '0');
      document.getElementById('seconds').innerText = String(seconds).padStart(2, '0');
    };

    countdownFn();
    this.countdownInterval = setInterval(countdownFn, 1000);
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
        <h4><i class="fa-solid fa-user-plus"></i> Team Member 0${i + 1} (Additional)</h4>
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
            <label for="reg-member-${i}-role">Competition Role / Responsibility <span class="required">*</span></label>
            <select id="reg-member-${i}-role" required>
              <option value="Hardware Designer">Hardware Designer</option>
              <option value="Software Engineer">Software Engineer</option>
              <option value="Laser Optics Integrator">Laser Optics Integrator</option>
              <option value="Chassis Fabricator">Chassis Fabricator</option>
              <option value="General Backup">General Backup</option>
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

    // 1. Validation: Unique Team Name
    const exists = this.registrations.some(r => r.teamName.toLowerCase() === teamNameInput.toLowerCase());
    if (exists) {
      this.showToast('Team name is already registered.', 'error');
      return;
    }

    // 2. Build additional members list
    const members = [];
    for (let i = 1; i <= memberCount; i++) {
      const mName = document.getElementById(`reg-member-${i}-name`).value.trim();
      const mEmail = document.getElementById(`reg-member-${i}-email`).value.trim();
      const mPhone = document.getElementById(`reg-member-${i}-phone`).value.trim();
      const mRole = document.getElementById(`reg-member-${i}-role`).value;
      
      members.push({ name: mName, email: mEmail, phone: mPhone, role: mRole });
    }

    // 3. Generate registration object
    const randId = 'LB-' + Math.floor(10000 + Math.random() * 90000);
    const newReg = {
      id: randId,
      teamName: teamNameInput,
      institution: institutionInput,
      leaderName: leaderNameInput,
      leaderEmail: leaderEmailInput,
      leaderPhone: leaderPhoneInput,
      members: members,
      status: 'pending', // Starts pending until approved by admin
      timestamp: Date.now()
    };

    // 4. Save to database
    this.registrations.push(newReg);
    this.saveRegistrations();
    
    // Save self registration
    localStorage.setItem('my_laserbot_registration', JSON.stringify(newReg));
    
    this.showToast('Registration submitted successfully! Code: ' + randId, 'success');
    this.updateActiveTicketDisplay();
    
    // Reset Form
    document.getElementById('registration-form').reset();
    this.renderMemberFields();
  }

  // --- PASS TICKET GENERATION ---
  updateActiveTicketDisplay() {
    const myReg = localStorage.getItem('my_laserbot_registration');
    const emptyState = document.querySelector('#ticket-status-box .empty-state');
    const ticketWrapper = document.getElementById('ticket-wrapper');

    if (myReg) {
      const reg = JSON.parse(myReg);
      
      // Update fields
      document.getElementById('ticket-team-name').innerText = reg.teamName.toUpperCase();
      document.getElementById('ticket-id').innerText = reg.id;
      document.getElementById('ticket-leader').innerText = reg.leaderName;
      document.getElementById('ticket-members').innerText = `${reg.members.length + 1} Total`;
      document.getElementById('ticket-institution').innerText = reg.institution;
      document.getElementById('ticket-barcode-text').innerText = `${reg.id}-${Math.floor(1000 + Math.random()*9000)}`;

      // Generate visual barcode lines
      this.generateBarcode('ticket-barcode-lines');
      
      // Generate visual QR code grid dots
      this.generateQRCodeGrid('ticket-qr-grid');

      if (emptyState) emptyState.classList.add('hidden');
      if (ticketWrapper) ticketWrapper.classList.remove('hidden');
      
      // Enable simulator score submissions
      const submitBox = document.getElementById('submit-score-box');
      if (submitBox) {
        submitBox.classList.remove('disabled');
        document.getElementById('sim-team-name').value = reg.teamName;
      }
    } else {
      if (emptyState) emptyState.classList.remove('hidden');
      if (ticketWrapper) ticketWrapper.classList.add('hidden');
      
      const submitBox = document.getElementById('submit-score-box');
      if (submitBox) submitBox.classList.add('disabled');
    }
  }

  generateBarcode(elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';
    
    // Create random width black/white lines
    for (let i = 0; i < 40; i++) {
      const bar = document.createElement('div');
      bar.className = 'barcode-bar';
      
      // Random width: 1px, 2px, 3px, 4px
      const widths = [1, 2, 3, 4];
      const isVisible = Math.random() > 0.35; // random visibility to mimic spacing
      
      bar.style.width = widths[Math.floor(Math.random() * widths.length)] + 'px';
      bar.style.backgroundColor = isVisible ? '#ffffff' : 'transparent';
      
      container.appendChild(bar);
    }
  }

  generateQRCodeGrid(elementId) {
    const grid = document.getElementById(elementId);
    if (!grid) return;
    grid.innerHTML = '';
    
    // Create 10x10 QR-like block array
    for (let i = 0; i < 100; i++) {
      const dot = document.createElement('div');
      
      // Corners should have standard QR blocks (3x3 solid dots)
      const row = Math.floor(i / 10);
      const col = i % 10;
      
      const isTopLeftCorner = row < 3 && col < 3;
      const isTopRightCorner = row < 3 && col > 6;
      const isBottomLeftCorner = row > 6 && col < 3;
      
      if (isTopLeftCorner || isTopRightCorner || isBottomLeftCorner) {
        // Outer border of corner finder pattern
        const isBorder = (row === 0 || row === 2 || col === 0 || col === 2) ||
                         (row === 0 || row === 2 || col === 7 || col === 9) ||
                         (row === 7 || row === 9 || col === 0 || col === 2);
        
        dot.className = `qr-dot ${isBorder ? '' : 'white'}`;
      } else {
        // Random dot
        dot.className = `qr-dot ${Math.random() > 0.45 ? '' : 'white'}`;
      }
      grid.appendChild(dot);
    }
  }

  printTicket() {
    window.print();
  }

  resetRegistration() {
    if (confirm("Are you sure you want to cancel this registration? All local ticket info will be cleared.")) {
      const myReg = localStorage.getItem('my_laserbot_registration');
      if (myReg) {
        const parsed = JSON.parse(myReg);
        // Remove from list
        this.registrations = this.registrations.filter(r => r.id !== parsed.id);
        this.saveRegistrations();
        
        // Remove active simulator runs from leaderboard (optional, let's keep it clean)
        this.leaderboard = this.leaderboard.filter(l => l.teamName !== parsed.teamName);
        this.saveLeaderboard();
      }
      
      localStorage.removeItem('my_laserbot_registration');
      this.updateActiveTicketDisplay();
      this.showToast('Registration cancelled.', 'info');
    }
  }

  // --- LEADERBOARD DISPLAY ---
  renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const query = document.getElementById('leaderboard-search')?.value.toLowerCase() || '';
    const activeFilter = this.activeFilter || 'all';

    let rank = 1;
    this.leaderboard.forEach(entry => {
      // 1. Text filter
      const matchesSearch = entry.teamName.toLowerCase().includes(query) || 
                            entry.institution.toLowerCase().includes(query);
      
      // 2. Type filter
      let matchesType = true;
      if (activeFilter === 'verified') matchesType = (entry.type === 'verified');
      if (activeFilter === 'simulator') matchesType = (entry.type === 'simulator');

      if (matchesSearch && matchesType) {
        const tr = document.createElement('tr');
        
        // Ranking styles
        let rankClass = 'rank-normal';
        if (rank === 1) rankClass = 'rank-1';
        else if (rank === 2) rankClass = 'rank-2';
        else if (rank === 3) rankClass = 'rank-3';
        
        tr.className = rankClass;

        tr.innerHTML = `
          <td><span class="rank-badge">${rank}</span></td>
          <td><strong>${entry.teamName}</strong></td>
          <td>${entry.institution}</td>
          <td class="code-font text-glow-red" style="font-weight: 700;">${entry.time.toFixed(2)}s</td>
          <td><span class="run-type-badge ${entry.type}">${entry.type}</span></td>
          <td><span class="status-badge ${entry.status || 'approved'}">${entry.status || 'approved'}</span></td>
        `;
        tbody.appendChild(tr);
        rank++;
      }
    });

    if (tbody.children.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">
            <i class="fa-solid fa-circle-question" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
            No matching runs found in the database.
          </td>
        </tr>
      `;
    }
  }

  setLeaderboardFilter(type) {
    this.activeFilter = type;
    document.querySelectorAll('.btn-filter').forEach(btn => {
      if (btn.innerText.toLowerCase().includes(type) || (type === 'all' && btn.innerText.toLowerCase().includes('all'))) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    this.renderLeaderboard();
  }

  filterLeaderboard() {
    this.renderLeaderboard();
  }

  // --- TOAST NOTIFICATIONS ---
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check" style="color: var(--color-success);"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation" style="color: var(--primary-red);"></i>';

    toast.innerHTML = `
      ${icon}
      <span>${message}</span>
    `;

    container.appendChild(toast);

    // Fade out after 4 seconds
    setTimeout(() => {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, 4000);
  }

  // --- DECORATIVE TECH BACKGROUND ---
  setupParticles() {
    const container = document.getElementById('particles-container');
    if (!container) return;

    const createParticle = () => {
      const p = document.createElement('div');
      p.className = 'particle';
      
      const size = Math.random() * 4 + 2;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      
      p.style.left = Math.random() * 100 + 'vw';
      p.style.animationDuration = Math.random() * 10 + 10 + 's';
      p.style.animationDelay = Math.random() * 5 + 's';
      
      container.appendChild(p);
      
      // Cleanup particle after animation
      setTimeout(() => {
        p.remove();
      }, 20000);
    };

    // Seed initial particles
    for (let i = 0; i < 20; i++) {
      createParticle();
    }

    // Spawn regular particles
    setInterval(createParticle, 1200);
  }
}

// Global Instantation
const app = new AppController();
window.addEventListener('DOMContentLoaded', app.init);
window.app = app;
