/* ==========================================================================
   LASERBOT APEX-1 - ADMIN OVERRIDES & DATABASE MANAGER
   ========================================================================== */

class AdminController {
  constructor() {
    this.modal = null;
  }

  init() {
    this.modal = document.getElementById('score-modal');
    this.renderRegistrations();
  }

  renderRegistrations() {
    const tbody = document.getElementById('admin-tbody-registrations');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = app.leaderboard;
    
    // Update Stats Dials
    document.getElementById('stat-total-teams').innerText = list.length;
    
    let bestTime = 999.99;
    list.forEach(item => {
      if (item.time < bestTime) bestTime = item.time;
    });
    
    document.getElementById('stat-best-time').innerText = 
      list.length > 0 ? `${bestTime.toFixed(2)}s` : '--.--';

    // Populate List
    list.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="code-font" style="font-weight:700;">#${index + 1}</span></td>
        <td><strong>${item.teamName}</strong></td>
        <td>${item.institution}</td>
        <td class="code-font text-glow-red" style="font-weight:700;">${item.time.toFixed(2)}s</td>
        <td><span class="run-type-badge ${item.type}">${item.type}</span></td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-outline-danger" onclick="admin.deleteRun(${index})">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No logged timing data available.
          </td>
        </tr>
      `;
    }
  }

  deleteRun(index) {
    if (confirm("Permanently delete this run score from the session memory?")) {
      app.leaderboard.splice(index, 1);
      app.saveLeaderboard();
      this.renderRegistrations();
      app.showToast('Score deleted.', 'info');
    }
  }

  // --- MODAL CONTROLS ---
  openScoreModal() {
    if (this.modal) this.modal.classList.add('active');
  }

  closeScoreModal() {
    if (this.modal) this.modal.classList.remove('active');
    
    // Clear fields
    document.getElementById('modal-team-name').value = '';
    document.getElementById('modal-institution').value = '';
    document.getElementById('modal-run-time').value = '';
  }

  submitCustomScore() {
    const team = document.getElementById('modal-team-name').value.trim();
    const inst = document.getElementById('modal-institution').value.trim();
    const timeVal = parseFloat(document.getElementById('modal-run-time').value);
    const runType = document.getElementById('modal-run-type').value;

    if (!team || !inst || isNaN(timeVal) || timeVal <= 0) {
      app.showToast('Please compile all fields correctly.', 'error');
      return;
    }

    // Add to list
    app.leaderboard.push({
      teamName: team,
      institution: inst,
      time: timeVal,
      type: runType,
      status: 'approved'
    });

    app.saveLeaderboard();
    this.renderRegistrations();
    this.closeScoreModal();
    app.showToast('Run added successfully.', 'success');
  }

  // --- DATA EXPORT UTILITIES ---
  exportJSON() {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(app.leaderboard, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "laserbot_leaderboard_export.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      app.showToast('JSON Export Downloaded', 'success');
    } catch (e) {
      app.showToast('JSON Export failed', 'error');
    }
  }

  exportCSV() {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Rank,Team Name,Institution,Activation Time (s),Run Type,Status\n";

      app.leaderboard.forEach((item, index) => {
        csvContent += `${index + 1},"${item.teamName}","${item.institution}",${item.time},"${item.type}","${item.status}"\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", encodedUri);
      downloadAnchor.setAttribute("download", "laserbot_leaderboard_export.csv");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      app.showToast('CSV Export Downloaded', 'success');
    } catch (e) {
      app.showToast('CSV Export failed', 'error');
    }
  }

  // --- SYSTEM FACTORY RESET ---
  resetSystemData() {
    if (confirm("Reset database memory to default values? Self registered tickets and run logs will be overwritten.")) {
      localStorage.removeItem('laserbot_registrations');
      localStorage.removeItem('laserbot_leaderboard');
      localStorage.removeItem('my_laserbot_registration');
      
      // Reload page state
      app.loadDatabase();
      this.renderRegistrations();
      
      app.showToast('Defaults loaded.', 'info');
    }
  }
}

// Global Instantation
const admin = new AdminController();
window.addEventListener('DOMContentLoaded', () => {
  admin.init();
});
window.admin = admin;
