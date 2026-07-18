#!/usr/bin/env python3
"""
==============================================================================
LASERBOT APEX-1 - OPENCV TARGET TRACKING & AUTO-AIMING
Tracks a RED circle target in a camera stream and outputs pan/tilt 
commands to the ESP32 micro-controller.
==============================================================================
"""

import cv2
import numpy as np
import serial
import serial.tools.list_ports
import time
import sys

# --- CONFIGURABLE PARAMETERS ---
CAMERA_INDEX = 0          # Default USB webcam
FRAME_WIDTH = 640         # Resized feed width
FRAME_HEIGHT = 480        # Resized feed height
BAUD_RATE = 115200        # Serial baud rate
SERIAL_TIMEOUT = 0.1      # Non-blocking read timeout

# Aiming PID Loop Proportional Gain (Tune as needed for hardware response)
KP_X = 12.0
KP_Y = 10.0
DEADZONE_PX = 10          # Do not adjust servos if target is within 10px of center

# Global Turret Angles (Synced with ESP32 default startup angles)
pan_angle = 90
tilt_angle = 90

# --- SERIAL CONNECTIVITY UTILITY ---
def find_esp32_port():
    print("[*] Scanning active system serial ports...")
    ports = serial.tools.list_ports.comports()
    
    # Try to find common ESP32 / Silicon Labs / CH340 board strings
    for p in ports:
        desc = p.description.lower()
        hwid = p.hwid.lower()
        if "silicon labs" in desc or "ch340" in desc or "usb to uart" in desc or "cp210" in desc:
            print(f"[+] Found potential ESP32 hardware: {p.device} ({p.description})")
            return p.device
            
    # Fallback to first available port
    if len(ports) > 0:
        print(f"[!] Target board description matches not found. Defaulting to first port: {ports[0].device}")
        return ports[0].device
        
    return None

# --- OPENCV TARGET DETECTOR ---
class TargetTracker:
    def __init__(self):
        # Red HSV Color Range Definitions (Red wraps around Hue limit 180)
        self.lower_red_1 = np.array([0, 120, 70])
        self.upper_red_1 = np.array([10, 255, 255])
        
        self.lower_red_2 = np.array([170, 120, 70])
        self.upper_red_2 = np.array([180, 255, 255])
        
        # Kernel for morphological operations
        self.kernel = np.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    def detect_target(self, frame):
        """
        Processes frame to locate the largest circular red target.
        Returns: (cx, cy, radius) if found, else None
        """
        # Convert BGR frame to HSV color space
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # Threshold to extract red segments
        mask1 = cv2.inRange(hsv, self.lower_red_1, self.upper_red_1)
        mask2 = cv2.inRange(hsv, self.lower_red_2, self.upper_red_2)
        mask = cv2.bitwise_or(mask1, mask2)
        
        # Morphological opening and closing to clean noise
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self.kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, self.kernel)
        
        # Find contours in the mask
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        largest_contour = None
        max_area = 0
        
        for c in contours:
            area = cv2.contourArea(c)
            # Filter noise by min area
            if area > 350:
                # Calculate circularity metric
                perimeter = cv2.arcLength(c, True)
                if perimeter > 0:
                    circularity = 4 * np.pi * area / (perimeter * perimeter)
                    # Bullseye targets will have circularity close to 1
                    if circularity > 0.45:
                        if area > max_area:
                            max_area = area
                            largest_contour = c
                            
        if largest_contour is not None:
            (x, y), radius = cv2.minEnclosingCircle(largest_contour)
            return int(x), int(y), int(radius)
            
        return None

# --- MAIN EXECUTION ---
def main():
    global pan_angle, tilt_angle
    
    print("==================================================================")
    print("           LASERBOT APEX-1 : COMPUTER VISION SYSTEM               ")
    print("==================================================================")
    
    # 1. Establish Serial Communications
    port = find_esp32_port()
    ser = None
    if port:
        try:
            ser = serial.Serial(port, BAUD_RATE, timeout=SERIAL_TIMEOUT)
            time.sleep(2) # Wait for ESP32 boot cycle
            print(f"[+] Serial connection established on {port}")
        except Exception as e:
            print(f"[-] Failed to open serial port {port}: {e}")
            print("[!] Running in OFFLINE SIMULATION MODE.")
    else:
        print("[-] No active serial boards detected.")
        print("[!] Running in OFFLINE SIMULATION MODE.")

    # 2. Initialize Camera Video Capture
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print("[-] CRITICAL ERROR: Could not open camera. Verify USB index.")
        sys.exit(1)
        
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
    
    tracker = TargetTracker()
    time.sleep(1) # Camera warm up
    
    print("[+] Camera stream online. Press 'q' inside display frame to quit.")
    
    target_locked_frames = 0
    laser_active = False

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[-] Error capturing frame.")
            break
            
        # Flip frame horizontally for natural joystick mirror response
        frame = cv2.flip(frame, 1)
        
        # Process detection
        target_info = tracker.detect_target(frame)
        
        # Center coordinates
        center_x = FRAME_WIDTH // 2
        center_y = FRAME_HEIGHT // 2
        
        # Draw Center HUD Grid (Crosshair)
        cv2.line(frame, (center_x - 30, center_y), (center_x + 30, center_y), (100, 100, 100), 1)
        cv2.line(frame, (center_x, center_y - 30), (center_x, center_y + 30), (100, 100, 100), 1)
        cv2.circle(frame, (center_x, center_y), 15, (100, 100, 100), 1)

        if target_info:
            cx, cy, r = target_info
            
            # Calculate pixel error from crosshair
            err_x = cx - center_x
            err_y = cy - center_y
            
            # Draw tracking boundary on target
            cv2.circle(frame, (cx, cy), r, (0, 0, 255), 2)
            cv2.circle(frame, (cx, cy), 4, (0, 0, 255), -1)
            
            # Draw offset vector line from center to target
            cv2.line(frame, (center_x, center_y), (cx, cy), (0, 255, 255), 1)
            
            # Check target centering limits
            dist = np.sqrt(err_x**2 + err_y**2)
            
            # Turret Aim Steering Command Math (Proportional tracking loop)
            # X-Axis pan steering
            if abs(err_x) > DEADZONE_PX:
                # Normalize x error into [-1.0, 1.0]
                norm_err_x = err_x / center_x
                pan_angle -= int(norm_err_x * KP_X)
                
            # Y-Axis tilt steering (depends on mechanical rotation orientation)
            if abs(err_y) > DEADZONE_PX:
                # Normalize y error into [-1.0, 1.0]
                norm_err_y = err_y / center_y
                tilt_angle += int(norm_err_y * KP_Y) # Adjust polarity (+/-) based on servo orientation

            # Clamping pan and tilt limits (prevent motor strain)
            pan_angle = np.clip(pan_angle, 10, 170)
            tilt_angle = np.clip(tilt_angle, 20, 160)
            
            # Send updated coordinates to ESP32
            cmd_aim = f"A:{pan_angle},{tilt_angle}\n"
            if ser:
                ser.write(cmd_aim.encode())
            
            # Laser Activation Trigger
            if dist < 25: # Target is locked (centered within 25px radius)
                target_locked_frames += 1
                # If target is locked continuously for 5 frames, trigger laser
                if target_locked_frames > 5:
                    cv2.putText(frame, "TARGET LOCK CONFIRMED", (15, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                    cv2.circle(frame, (cx, cy), r + 8, (0, 255, 0), 2)
                    
                    if not laser_active:
                        laser_active = True
                        if ser:
                            ser.write(b"L:1\n")
            else:
                target_locked_frames = 0
                if laser_active:
                    laser_active = False
                    if ser:
                        ser.write(b"L:0\n")
                        
            # Display target stats
            cv2.putText(frame, f"Error: X:{err_x} Y:{err_y}", (cx + r + 5, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)
            
        else:
            # No Target Found - Display Search Mode HUD
            target_locked_frames = 0
            if laser_active:
                laser_active = False
                if ser:
                    ser.write(b"L:0\n")
            
            cv2.putText(frame, "SEARCHING FOR TARGET...", (15, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)
            
            # Draw sweeping horizontal radar lines
            scan_y = int((time.time() * 200) % FRAME_HEIGHT)
            cv2.line(frame, (0, scan_y), (FRAME_WIDTH, scan_y), (0, 100, 255), 1)

        # Telemetry Display
        cv2.putText(frame, f"Pan Servo: {pan_angle} deg", (15, FRAME_HEIGHT - 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.putText(frame, f"Tilt Servo: {tilt_angle} deg", (15, FRAME_HEIGHT - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.putText(frame, f"Laser State: {'ON' if laser_active else 'OFF'}", (FRAME_WIDTH - 180, FRAME_HEIGHT - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255) if laser_active else (100, 100, 100), 2)

        # Display Frame
        cv2.imshow("LaserBot Apex-1 Auto-Aim HUD", frame)
        
        # Listen for quit command
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Clean shut down
    print("[*] Powering down subsystems...")
    if ser:
        ser.write(b"L:0\n") # Force laser off
        ser.write(b"M:0,0\n") # Force motors stop
        ser.close()
    cap.release()
    cv2.destroyAllWindows()
    print("[+] Subsystems offline. Script terminated.")

if __name__ == "__main__":
    main()
