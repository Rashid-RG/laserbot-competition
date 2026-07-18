# 🛠️ LaserBot Apex-1: Hardware & Assembly Guide

This guide details the complete Bill of Materials (BOM), step-by-step wiring schematics, and mechanical assembly instructions to build the **LaserBot Apex-1** physical robot.

---

## 📋 1. Bill of Materials (BOM)

To build this project, you will need the following electronic and mechanical components:

| Component Category | Part Name | Qty | Purpose | Est. Operating Voltage |
| :--- | :--- | :---: | :--- | :---: |
| **Microcontroller** | ESP32 DevKit v1 (30-pin) | 1 | Robot brain, processes serial commands, controls locomotion, servos, and laser. | 5V (USB or Vin) |
| **Motor Driver** | L298N Dual H-Bridge Module | 1 | Drives the DC motors for robot locomotion. | 7.4V - 12V |
| **Locomotion** | DC Gearbox Motors (Yellow) + Wheels | 2 | Left and Right driving wheels. | 3V - 6V |
| **Chassis** | 2WD Acrylic Smart Car Chassis Kit | 1 | Base platform. Includes omnidirectional caster wheel. | Mechanical |
| **Aiming Servos** | SG90 9g Micro Servos (or MG90S Metal Gear) | 2 | Actuates the Pan-and-Tilt laser turret aiming mechanism. | 5V |
| **Turret Frame** | FPV 2-Axis Nylon Pan-Tilt Servo Mount | 1 | Mechanical bracket to hold the two servos and the laser. | Mechanical |
| **Laser Emitter** | 5V Red Laser Diode (Class 2, < 1mW) | 1 | Target pointer to trigger photodiode sensor. | 5V |
| **Power Supply** | 2x 18650 Li-ion Batteries (with dual slot case) | 1 | Main system power source (Approx. 7.4V - 8.4V output). | 7.4V |
| **Transistor Switch** | BC547 NPN Transistor + 220Ω Resistor | 1 | Safety switch to drive the laser from ESP32 GPIO safely. | Signal Switching |
| **Wiring & Hookups** | Breadboard & Dupont Jumper Wires | 1set | Solderless connections between controller, driver, and modules. | Jumper |

---

## 🔌 2. Wiring & Schematic Diagram

Below is the pin connection layout. 

> [!WARNING]  
> Always connect all **GND (Ground)** pins of the ESP32, L298N driver, Servos, and battery pack together. A common ground reference is critical for PWM signal transmission.

### Pin Connection Matrix

| Source Component | Pin Name | Destination Component | Pin Name | Notes |
| :--- | :---: | :--- | :---: | :--- |
| **Battery Pack (+)** | 7.4V (+) | **L298N Driver** | 12V Screw Terminal | Main input power |
| **Battery Pack (-)** | GND (-) | **L298N Driver** | GND Screw Terminal | Common ground |
| **L298N Driver** | GND Screw Terminal | **ESP32** | GND | Shares ground connection |
| **L298N Driver** | 5V Out Terminal | **ESP32** | Vin (or 5V pin) | Powers ESP32 board |
| **L298N Driver** | 5V Out Terminal | **SG90 Servos (Both)** | Red (+) wire | Powers servos |
| **ESP32** | GPIO 12 | **L298N Driver** | IN1 | Left Motor Forward |
| **ESP32** | GPIO 13 | **L298N Driver** | IN2 | Left Motor Backward |
| **ESP32** | GPIO 14 | **L298N Driver** | IN3 | Right Motor Forward |
| **ESP32** | GPIO 27 | **L298N Driver** | IN4 | Right Motor Backward |
| **ESP32** | GPIO 19 | **SG90 Pan Servo** | Orange/Yellow (PWM) | Yaw control (horizontal) |
| **ESP32** | GPIO 18 | **SG90 Tilt Servo** | Orange/Yellow (PWM) | Pitch control (vertical) |
| **ESP32** | GPIO 23 | **BC547 Base** (via 220Ω) | Base (B) | Switches laser ON/OFF |
| **BC547 Transistor** | Collector (C) | **Laser Module (+)** | VCC (Red) | Active high signal |
| **BC547 Transistor** | Emitter (E) | **GND** | GND | Connected to ground |
| **Laser Module (-)** | GND (Black) | **GND** | GND | Common ground |

---

## 🛠️ 3. Step-by-Step Construction Guide

### Phase 1: Mechanical Chassis Assembly
1. Mount the two **DC Gearbox Motors** to the bottom acrylic chassis plate using the metal fasteners and screws provided in the chassis kit.
2. Press-fit the rubber wheels onto the motor shafts.
3. Attach the omni-directional **Caster Wheel** to the front underside of the chassis plate using brass spacers.
4. Mount the **Battery Holder** onto the top center-back of the plate.

### Phase 2: Building the Aiming Turret
1. Assemble the nylon **Pan-Tilt bracket** using the small self-tapping screws.
2. Insert the first servo (Pan) into the base slot. This controls horizontal rotation.
3. Mount the second servo (Tilt) into the upper bracket. This controls vertical height.
4. Affix the **Laser Diode** module to the tilt platform (using zip-ties, tape, or 3D printed housing).
5. Secure the turret structure onto the front section of the smart car chassis plate.

### Phase 3: Electronics Connections
1. **Motor Connections:** Connect Left DC motor terminals to L298N OUT1 & OUT2. Connect Right DC motor terminals to OUT3 & OUT4.
2. **Servo Connections:** Connect both red wires of the SG90 servos to the L298N 5V output port. Connect both brown/black wires to the GND screw terminal. Connect yellow/orange signal wires to ESP32 Pins 19 and 18.
3. **Laser Switch Circuit:** Connect ESP32 pin 23 to a 220Ω resistor. Connect the other end of the resistor to the middle pin (Base) of the BC547 NPN Transistor. Connect the Laser black wire (GND) to common GND. Connect the Laser red wire (+) to the Collector of BC547. Connect the Emitter of BC547 to GND. (This transistor buffer prevents drawing too much current directly from the ESP32 pin).
4. **Power Routing:** Wire battery positive to L298N 12V terminal. Wire battery negative to L298N GND. Run a wire from L298N GND to ESP32 GND. Run a wire from L298N 5V Out to ESP32 Vin.

---

## 🏁 4. Calibration & Running
1. **Zeroing Servos:** Before mounting the plastic servo horns onto the gears, upload the firmware to the ESP32. On startup, the firmware will write a 90° angle (center position) to both servos. Put the horns on in their exact center alignments at this point.
2. **Serial Connection:** Connect the ESP32 to your PC using a micro-USB cable.
3. **Run OpenCV Stream:** Power up the python vision script (`vision/auto_aim.py`) on your PC. It will open your webcam/camera, track the target, and send steering codes to the ESP32.
4. **Open Web HUD Control:** Alternatively, launch the `web-control/index.html` page, click "Connect Robot" to link your browser to the ESP32 port via Web Serial API, and drive manual test courses using WASD!
