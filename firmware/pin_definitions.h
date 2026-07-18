/* ==========================================================================
   LASERBOT APEX-1 - ESP32 PIN CONFIGURATIONS
   ========================================================================== */

#ifndef PIN_DEFINITIONS_H
#define PIN_DEFINITIONS_H

// --- Locomotion Motor Pins (L298N Motor Driver) ---
#define MOTOR_L_IN1 12  // Left motor forward
#define MOTOR_L_IN2 13  // Left motor backward
#define MOTOR_R_IN3 14  // Right motor forward
#define MOTOR_R_IN4 27  // Right motor backward

// Note: If speed control is required, these pins can be driven by ESP32 PWM (LEDC), 
// but simple digital high/low is used here for rapid H-Bridge steering.

// --- Aiming Turret Servo Pins (SG90 / MG90S) ---
#define SERVO_PAN_PIN 19   // Yaw control (horizontal axis)
#define SERVO_TILT_PIN 18  // Pitch control (vertical axis)

// --- Laser Emission Pin ---
#define LASER_PIN 23       // Laser control (Active HIGH - triggers BC547 transistor)

#endif // PIN_DEFINITIONS_H
