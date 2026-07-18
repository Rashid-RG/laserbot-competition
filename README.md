# 🤖 LaserBot Competition Landing & Portal

[![Deploy to GitHub Pages](https://github.com/your-username/laserbot-competition/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-username/laserbot-competition/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](https://opensource.org/licenses/MIT)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JS](https://img.shields.io/badge/Vanilla_JS-ES6+-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

> An immersive, feature-rich web portal and physics-based simulator for the **LaserBot Competition**, organized by the **Faculty Career Guidance Cell - FAS, Department of Physical Science**. 
> 
> *Target the opponent's tower and activate the target in the shortest possible time!*

---

## 🎯 Project Overview

This repository hosts a premium single-page web application (SPA) tailored for the **LaserBot Competition (July 24, 2026)**. The portal is engineered to provide students with a fully functional event information guide, an interactive 2D canvas laser aiming simulator, a real-time leaderboard, a validation-backed registration form, and a dedicated administrator dashboard.

### 🌟 Key Features

1. **🛸 Interactive LaserBot Simulator**
   - Built on HTML5 Canvas with custom particle systems, laser raycasting, and boundary reflection physics.
   - Real-time turret orientation controls (angle and laser power adjustments).
   - Collision detection against animated target hitboxes on a castle tower.
   - High-score hook integrated directly into the event's Leaderboard database.

2. **📋 Smart Team Registration & Entry Pass Generator**
   - Support for individual or team registration (up to 5 members).
   - Real-time frontend validation for emails, phone numbers, and member configurations.
   - Generates a **LaserBot Entry Pass** complete with a visual QR code and barcode, ready to print or save.

3. **🏆 Leaderboard Hub**
   - Real-time rank board tracking the fastest times.
   - Live search filters to find specific teams or institutions.

4. **⚙️ Administrator Control Panel**
   - Secure review of team registration status (Approve/Reject controls).
   - Manual overrides to add, modify, or remove leaderboard times.
   - Local database export options (direct download as JSON or CSV formats).

5. **🕒 Event Countdown**
   - Live ticker counting down to the competition date: **July 24, 2026**.

---

## 🛠️ Technology Stack

- **Structure**: Semantic HTML5 markup
- **Styling**: Vanilla CSS3 (CSS Variables, Flexbox/Grid, Glassmorphic overlays, keyframe animations)
- **Scripting & Canvas**: Vanilla JavaScript (ES6+), Canvas API
- **Deployment**: Automatic GitHub Actions workflow (`deploy.yml`) for publishing to GitHub Pages.

---

## 🚀 Getting Started

### Prerequisites
You only need a modern web browser to run this project. No external node servers or dependencies are required, making it lightweight and highly portable.

### Local Development
1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/laserbot-competition.git
   ```
2. Navigate into the project folder:
   ```bash
   cd laserbot-competition
   ```
3. Open `index.html` in your browser, or spin up a local development server:
   - Using Python:
     ```bash
     python -m http.server 8000
     ```
   - Using Node (npx):
     ```bash
     npx live-server
     ```

---

## 📂 Codebase Structure

```
laserbot-competition/
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions deploy configuration
├── css/
│   └── style.css            # Responsive layout styles, animations, variables
├── js/
│   ├── app.js               # Main SPA state controller and registration handlers
│   ├── simulator.js         # Canvas physics-based LaserBot turret gameplay
│   └── admin.js             # Team lists and admin metrics database operations
├── index.html               # Main single page entry point
├── LICENSE                  # MIT License
└── README.md                # Project documentation
```

---

## 🎨 Theme & Styling System

The application features a sleek **Cyber-Slate Red** aesthetics system matching the event poster:
- Primary Color: `#ff3333` (Laser Red)
- Secondary Glow: `rgba(255, 51, 51, 0.45)`
- Dark Base: `#0c0f12` (Slate Black)
- Card Accents: `#171c24` with glassmorphic borders.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Organizer Information
**Faculty Career Guidance Cell - FAS**  
*Department of Physical Science*  
*Registration Date: 24 July 2026*
