/* ==========================================================================
   LASERBOT APEX-1 - ESP32 ROBOT FIRMWARE (C++)
   Locomotion: L298N H-Bridge
   Turret: 2-Axis Servo Pan & Tilt Mount
   Laser Switch: Transistor-isolated laser diode
   Communication: USB Serial Commands at 115200 Baud
   ========================================================================== */

#include <ESP32Servo.h>
#include "pin_definitions.h"

// --- Servo Objects ---
Servo panServo;
Servo tiltServo;

// --- Turret Coordinates ---
int panAngle = 90;   // Centered horizontally
int tiltAngle = 90;  // Centered vertically

// --- Safety Watchdog ---
unsigned long lastCommandTime = 0;
const unsigned long SAFETY_TIMEOUT = 5000; // 5 seconds serial communication watchdog
bool laserState = false;

// --- Serial Buffer ---
String inputString = "";
bool stringComplete = false;

void setup() {
  // Initialize Serial communication
  Serial.begin(115200);
  Serial.println("=========================================");
  Serial.println("LASERBOT APEX-1 SYSTEM INITIALIZED");
  Serial.println("Ready for Serial Commands...");
  Serial.println("Format: Motor: 'M:L,R' | Aim: 'A:P,T' | Laser: 'L:1|0'");
  Serial.println("=========================================");

  // Set Motor Control Pinmodes
  pinMode(MOTOR_L_IN1, OUTPUT);
  pinMode(MOTOR_L_IN2, OUTPUT);
  pinMode(MOTOR_R_IN3, OUTPUT);
  pinMode(MOTOR_R_IN4, OUTPUT);

  // Stop motors initially
  stopLocomotion();

  // Set Laser Pinmode
  pinMode(LASER_PIN, OUTPUT);
  digitalWrite(LASER_PIN, LOW); // Laser OFF

  // Attach ESP32 Servos
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  
  panServo.setPeriodHertz(50); // Standard 50hz servo frequency
  tiltServo.setPeriodHertz(50);
  
  panServo.attach(SERVO_PAN_PIN, 500, 2400); // Attach with standard pulse limits
  tiltServo.attach(SERVO_TILT_PIN, 500, 2400);

  // Initialize servos to center position
  panServo.write(panAngle);
  tiltServo.write(tiltAngle);

  // Pre-allocate serial buffer string capacity
  inputString.reserve(32);
  
  lastCommandTime = millis();
}

void loop() {
  // Check for incoming serial commands
  readSerialInput();
  
  if (stringComplete) {
    processCommand(inputString);
    inputString = "";
    stringComplete = false;
    lastCommandTime = millis(); // Refresh watchdog timer on valid packet
  }

  // Safety Watchdog: Shut down laser if communication goes silent
  if (laserState && (millis() - lastCommandTime > SAFETY_TIMEOUT)) {
    Serial.println("CRITICAL WARNING: Communication watchdog timeout. Shutting down laser.");
    shutDownLaser();
    stopLocomotion();
  }
}

/* ==========================================================================
   COMMUNICATION & COMMAND PARSING
   ========================================================================== */
void readSerialInput() {
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    if (inChar == '\n' || inChar == '\r') {
      if (inputString.length() > 0) {
        stringComplete = true;
      }
    } else {
      inputString += inChar;
    }
  }
}

void processCommand(String cmd) {
  cmd.trim();
  if (cmd.length() < 3) return;

  char type = cmd.charAt(0);
  if (cmd.charAt(1) != ':') return;

  String args = cmd.substring(2);

  switch (type) {
    case 'M': // MOTOR COMMAND: "M:L,R" where L,R ∈ [-1, 0, 1]
      handleMotorCommand(args);
      break;

    case 'A': // AIM COMMAND: "A:P,T" where P,T ∈ [0, 180]
      handleAimCommand(args);
      break;

    case 'L': // LASER COMMAND: "L:1" or "L:0"
      handleLaserCommand(args);
      break;

    default:
      Serial.println("ERR: Unknown command type.");
      break;
  }
}

/* ==========================================================================
   HARDWARE ACTUATION HANDLERS
   ========================================================================== */
void handleMotorCommand(String args) {
  int commaIndex = args.indexOf(',');
  if (commaIndex == -1) {
    Serial.println("ERR_M: Invalid syntax. Expected 'M:Left,Right'");
    return;
  }

  int leftVal = args.substring(0, commaIndex).toInt();
  int rightVal = args.substring(commaIndex + 1).toInt();

  // Control Left Motor
  if (leftVal > 0) {
    digitalWrite(MOTOR_L_IN1, HIGH);
    digitalWrite(MOTOR_L_IN2, LOW);
  } else if (leftVal < 0) {
    digitalWrite(MOTOR_L_IN1, LOW);
    digitalWrite(MOTOR_L_IN2, HIGH);
  } else {
    digitalWrite(MOTOR_L_IN1, LOW);
    digitalWrite(MOTOR_L_IN2, LOW);
  }

  // Control Right Motor
  if (rightVal > 0) {
    digitalWrite(MOTOR_R_IN3, HIGH);
    digitalWrite(MOTOR_R_IN4, LOW);
  } else if (rightVal < 0) {
    digitalWrite(MOTOR_R_IN3, LOW);
    digitalWrite(MOTOR_R_IN4, HIGH);
  } else {
    digitalWrite(MOTOR_R_IN3, LOW);
    digitalWrite(MOTOR_R_IN4, LOW);
  }

  Serial.print("ACK_M: Motors Set -> Left: ");
  Serial.print(leftVal);
  Serial.print(" | Right: ");
  Serial.println(rightVal);
}

void handleAimCommand(String args) {
  int commaIndex = args.indexOf(',');
  if (commaIndex == -1) {
    Serial.println("ERR_A: Invalid syntax. Expected 'A:Pan,Tilt'");
    return;
  }

  int targetPan = args.substring(0, commaIndex).toInt();
  int targetTilt = args.substring(commaIndex + 1).toInt();

  // Constrain inputs to standard servo ranges [0 - 180]
  panAngle = constrain(targetPan, 0, 180);
  tiltAngle = constrain(targetTilt, 0, 180);

  // Write positions to physical servos
  panServo.write(panAngle);
  tiltServo.write(tiltAngle);

  Serial.print("ACK_A: Turret Aim -> Pan: ");
  Serial.print(panAngle);
  Serial.print("° | Tilt: ");
  Serial.print(tiltAngle);
  Serial.println("°");
}

void handleLaserCommand(String args) {
  int state = args.toInt();
  if (state == 1) {
    digitalWrite(LASER_PIN, HIGH);
    laserState = true;
    Serial.println("ACK_L: LASER EMITTING");
  } else {
    shutDownLaser();
  }
}

void shutDownLaser() {
  digitalWrite(LASER_PIN, LOW);
  laserState = false;
  Serial.println("ACK_L: LASER TERMINATED");
}

void stopLocomotion() {
  digitalWrite(MOTOR_L_IN1, LOW);
  digitalWrite(MOTOR_L_IN2, LOW);
  digitalWrite(MOTOR_R_IN3, LOW);
  digitalWrite(MOTOR_R_IN4, LOW);
}
