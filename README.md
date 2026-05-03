# Scan & Park - Smart Parking Management System

![Version](https://img.shields.io/badge/version-3.0-blue)
![Node](https://img.shields.io/badge/node-18+-green)
![React](https://img.shields.io/badge/react-18-blue)
![PostgreSQL](https://img.shields.io/badge/postgresql-14-blue)
![Python](https://img.shields.io/badge/python-3.9+-blue)

A complete smart parking management system with license plate recognition, online payments, real-time slot booking, and automated penalty calculation.

## Table of Contents
- [Features](#features)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Screenshots](#screenshots)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

### Customer Features
- **License Plate Recognition** - Automatic number plate detection using OCR
- **Real-time Slot Booking** - View and book available parking slots
- **Online Payments** - Razorpay integration for secure payments
- **Time Extension** - Extend parking duration with additional payment
- **Automated Exit** - Calculate penalties and process refunds automatically
- **Mobile Responsive** - Works on all devices

### Admin Features
- **Area Management** - Create and manage parking zones
- **Slot Management** - Add/remove parking slots
- **Dynamic Pricing** - Configure fees, deposits, and penalty rates
- **Analytics Dashboard** - View revenue, penalties, and occupancy reports
- **Penalty Tracking** - Track and manage penalty records
- **Export Reports** - Download transaction and penalty reports

### Technical Features
- **Secure Authentication** - Admin key protection
- **OCR Integration** - EasyOCR for license plate detection
- **Automated Refunds** - Razorpay refund processing
- **PostgreSQL Database** - Reliable data storage
- **RESTful API** - Clean API architecture

## System Architecture


## Prerequisites

Before you begin, ensure you have the following installed:

| Software | Version | Download Link |
|----------|---------|---------------|
| Node.js | 18.x or higher | [https://nodejs.org/](https://nodejs.org/) |
| Python | 3.9 or higher | [https://www.python.org/](https://www.python.org/) |
| PostgreSQL | 14 or higher | [https://www.postgresql.org/](https://www.postgresql.org/) |
| Git | Latest | [https://git-scm.com/](https://git-scm.com/) |

### Required Accounts
- **Razorpay Account** - For payment processing (Test keys available)
  - Sign up at [https://razorpay.com/](https://razorpay.com/)
  - Get API Key and Secret from Dashboard → Settings → API Keys

## Installation

### 1. Clone the Repository
Required packages will be installed:

express

razorpay

pg (PostgreSQL)

cors

axios

crypto (built-in)

```bash
git clone https://github.com/yourusername/smart-parking.git
cd smart-parking

npm install

FOR PYTHON ENVORNMENT

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install Python packages
pip install easyocr opencv-python flask flask-cors pillow numpy

FOR FRONTEND

cd frontend
npm install
cd ..
```
## Database Setup
### Open PostgreSQL command line or pgAdmin and run:
```bash
CREATE DATABASE parkingdb;
CREATE USER parking_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE parkingdb TO parking_user;
```
### Create Tables
```bash
-- Connect to parkingdb
\c parkingdb;

-- Create areas table
CREATE TABLE areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    base_fee DECIMAL(10,2) DEFAULT 50,
    deposit DECIMAL(10,2) DEFAULT 30,
    duration_minutes INTEGER DEFAULT 60,
    penalty_per_min DECIMAL(10,2) DEFAULT 2,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create slots table
CREATE TABLE slots (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE,
    area_name VARCHAR(100),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create bookings table
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    slot VARCHAR(50),
    slot_id INTEGER,
    area_name VARCHAR(100),
    phone VARCHAR(15),
    license_plate VARCHAR(20),
    photo_path TEXT,
    entry_time TIMESTAMP,
    duration BIGINT,
    exited_at TIMESTAMP,
    payment_status VARCHAR(20),
    payment_id VARCHAR(100),
    amount DECIMAL(10,2),
    due_amount DECIMAL(10,2),
    deposit DECIMAL(10,2),
    base_fee DECIMAL(10,2),
    penalty_amount DECIMAL(10,2),
    refund_status VARCHAR(20),
    refund_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create extension_config table
CREATE TABLE extension_config (
    id SERIAL PRIMARY KEY,
    extend_minutes INTEGER DEFAULT 30,
    extend_fee DECIMAL(10,2) DEFAULT 20
);

-- Insert default extension config
INSERT INTO extension_config (extend_minutes, extend_fee) VALUES (30, 20);

-- Insert sample areas
INSERT INTO areas (name, base_fee, deposit, duration_minutes, penalty_per_min) VALUES
('Area A', 50, 100, 60, 5),
('Area B', 40, 80, 60, 4),
('Area C', 60, 120, 60, 6),
('VIP Area', 100, 200, 120, 10);

-- Insert sample slots for Area A
INSERT INTO slots (name, area_id, area_name, is_available) VALUES
('A1', 1, 'Area A', true),
('A2', 1, 'Area A', true),
('A3', 1, 'Area A', true),
('A4', 1, 'Area A', true),
('A5', 1, 'Area A', true),
('A6', 1, 'Area A', true);

-- Insert sample slots for Area B
INSERT INTO slots (name, area_id, area_name, is_available) VALUES
('B1', 2, 'Area B', true),
('B2', 2, 'Area B', true),
('B3', 2, 'Area B', true),
('B4', 2, 'Area B', true);
```
## Configuration
### Database Configuration(Update server.js with your database credentials):
```bash
const db = new Pool({
  user: "Your PostgreSQL username",     
  host: "Database host",     
  database: "Database name",   
  password: "Your password",        
  port: PostgreSQL port,             
});
```
### Razorpay Configuration(Update server.js with your Razorpay keys):
```bash
const razorpay = new Razorpay({
  key_id: "rzp_test_xxxxxxxxxx",     // Your Razorpay Key ID
  key_secret: "xxxxxxxxxxxxxxxxxxxx", // Your Razorpay Secret
});
```
#### Update React frontend (frontend/src/App.js) with your Razorpay key:
```bash
const options = {
  key: "rzp_test_xxxxxxxxxx",  // Same Key ID as above
  // ... other options
};
```
### Admin Configuration(Default admin key is admin123. Change it in server.js):
```bash
const ADMIN_KEY = "admin123";  // Change this to your secure key
```
### OCR Server Configuration(The OCR server runs on port 5002 by default. Ensure it matches in server.js):
```bash
const OCR_SERVER_URL = process.env.OCR_SERVER_URL || "http://localhost:5002";
```
### Frontend API URL(In frontend/src/App.js, set the BASE_URL):
```bash
const BASE_URL = "http://localhost:5000";  // Your Node.js server URL
```
#### For production, you can set it to empty string:
```bash
const BASE_URL = "";  // Will use relative paths
```
## Running the Application
### Step 1: Start PostgreSQL
```bash
# Windows
net start postgresql-x64-14

# Mac/Linux
sudo service postgresql start
```
### Step 2: Start Python OCR Server
```bash
#in terminal
cd smart-parking
python ocr_server.py

#Expected Output:
============================================================
Starting OCR Server on Port 5002...
============================================================
✓ OCR Engine loaded successfully!

==================================================
OCR Server Running on port 5002!
==================================================
Health check: GET http://localhost:5002/health
Detection: POST http://localhost:5002/detect
==================================================
```

### Step 3: Start Node.js Server
```bash
#in terminal
cd smart-parking
node server.js

#Expected Output:
Database connected successfully

 Scan & Park Server running → http://localhost:5000
   Admin key: admin123
   API Health: GET /api/health
   OCR Endpoint: POST /api/ocr/detect
   OCR Server Status: GET /api/ocr/health
```

### Step 4: Start React Frontend
```bash
#in terminal
cd smart-parking/frontend
npm start

#Expected Output:
Compiled successfully!

You can now view frontend in the browser.
  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```
### Step 4: Start React Frontend
```bash
#in terminal
cd smart-parking/frontend
npm start

#Expected Output:
Compiled successfully!

You can now view frontend in the browser.
  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```
## Troubleshooting
### Issue: OCR Server Not Starting
```bash
pip install easyocr opencv-python flask flask-cors
```
### Issue: Database Connection Failed
```bash
# Windows
net start postgresql-x64-14

# Mac
brew services start postgresql

# Linux
sudo systemctl start postgresql
```
## Issue: Camera Not Working
### Solutions:

- **Ensure HTTPS or localhost (camera requires secure context)

- **Check browser permissions

- **Try different browser (Chrome/Firefox recommended)

- **Check if another app is using camera

## Issue: Razorpay Payment Failed
### Solutions:

- **Use test mode keys (starting with rzp_test_)

- **Use test card: 4111 1111 1111 1111

- **Check console for errors

##Issue: OCR Not Detecting Plates
###Tips for better detection:

- **Ensure good lighting

- **Hold camera steady

- **License plate should fill 30-40% of frame

- **Clean camera lens

- **Avoid glare and reflections
