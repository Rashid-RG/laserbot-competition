const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;

const filesToCheck = [
  '.gitignore',
  'LICENSE',
  'README.md',
  'index.html',
  '.github/workflows/deploy.yml',
  'hardware/README.md',
  'firmware/pin_definitions.h',
  'firmware/firmware.ino',
  'vision/requirements.txt',
  'vision/auto_aim.py',
  'web-control/index.html',
  'web-control/css/style.css',
  'web-control/js/app.js',
  'web-control/js/simulator.js',
  'web-control/js/admin.js'
];

console.log("==================================================");
console.log("    LASERBOT APEX-1 REPOSITORY INTEGRITY CHECK     ");
console.log("==================================================");

let success = true;

filesToCheck.forEach(file => {
  const fullPath = path.join(projectRoot, file);
  try {
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      if (stats.size > 0) {
        console.log(`[PASS] ${file} (${stats.size} bytes)`);
      } else {
        console.log(`[WARN] ${file} is EMPTY!`);
        success = false;
      }
    } else {
      console.log(`[FAIL] ${file} DOES NOT EXIST!`);
      success = false;
    }
  } catch (err) {
    console.log(`[FAIL] ${file} - Access error: ${err.message}`);
    success = false;
  }
});

console.log("--------------------------------------------------");
if (success) {
  console.log("[STATUS] INTEGRITY CHECK PASSED! All core modules compiled.");
} else {
  console.log("[STATUS] INTEGRITY CHECK FAILED! Fix missing resources.");
}
console.log("==================================================");
process.exit(success ? 0 : 1);
