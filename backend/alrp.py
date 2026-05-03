from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import cv2
import numpy as np
import base64
import re
import easyocr
from datetime import datetime
import json
import os

app = Flask(__name__)
CORS(app)

print("=" * 60)
print("Starting OCR System on Port 5002...")
print("=" * 60)

# Initialize EasyOCR
print("Loading OCR engine...")
reader = None

try:
    print("Loading OCR...")
    reader = easyocr.Reader(['en'], gpu=False)
    print("OCR Loaded ")
except Exception as e:
    print(f"Error loading OCR: {e}")
    print("Install: pip install easyocr opencv-python")
    exit(1)

# Penalty Database File
PENALTY_DB_FILE = "penalty_database.json"

# Load penalty database
def load_penalty_database():
    if os.path.exists(PENALTY_DB_FILE):
        try:
            with open(PENALTY_DB_FILE, 'r') as f:
                return json.load(f)
        except:
            return {"penalties": [], "total_count": 0, "total_amount": 0}
    else:
        return {"penalties": [], "total_count": 0, "total_amount": 0}

# Save penalty database
def save_penalty_database(data):
    with open(PENALTY_DB_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# Initialize penalty database
penalty_db = load_penalty_database()

def extract_license_plate(text):
    """Extract Indian license plate pattern from text"""
    patterns = [
        r'[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}',
        r'[A-Z]{2}[0-9]{2}[A-Z]{1}[0-9]{4}',
        r'[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}',
        r'[A-Z]{1}[0-9]{2}[A-Z]{2}[0-9]{4}',
        r'[A-Z]{2}[0-9]{2}[0-9]{4}[A-Z]{2}',
        r'[A-Z]{2}[0-9]{2}[A-Z]{3}[0-9]{3}',
    ]
    text = text.upper().replace(' ', '').replace('-', '')
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    fallback = re.search(r'[A-Z0-9]{8,10}', text)
    return fallback.group(0) if fallback else None

# HTML Template with Penalty List
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>License Plate Recognition with Penalty Tracker</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { text-align: center; color: white; margin-bottom: 10px; }
        .subtitle { text-align: center; color: rgba(255,255,255,0.9); margin-bottom: 30px; }
        .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 1024px) { .main-grid { grid-template-columns: 1fr; } }
        .card {
            background: white;
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .card h2 { color: #333; margin-bottom: 15px; border-left: 4px solid #2a5298; padding-left: 12px; }
        .video-container {
            background: #000;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
            aspect-ratio: 4/3;
        }
        video { width: 100%; height: 100%; object-fit: cover; }
        .guide-box {
            position: absolute;
            top: 20%;
            left: 10%;
            width: 80%;
            height: 40%;
            border: 2px solid #00ff00;
            border-radius: 10px;
            pointer-events: none;
            animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%,100% { border-color: #00ff00; } 50% { border-color: #ffff00; } }
        .button-group { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
        button {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .btn-primary { background: #2a5298; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-success { background: #28a745; color: white; }
        .btn-info { background: #17a2b8; color: white; }
        .btn-warning { background: #ffc107; color: #333; }
        .result-box {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 15px;
            margin-top: 15px;
            min-height: 150px;
        }
        .plate-number {
            font-size: 2em;
            font-weight: bold;
            font-family: monospace;
            color: #28a745;
            background: white;
            padding: 10px;
            border-radius: 8px;
            margin: 10px 0;
        }
        .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .status-success { background: #d4edda; color: #155724; }
        .status-error { background: #f8d7da; color: #721c24; }
        .status-processing { background: #fff3cd; color: #856404; }
        .status-info { background: #d1ecf1; color: #0c5460; }
        .status-penalty { background: #f8d7da; color: #dc3545; }
        .history-item {
            padding: 10px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            cursor: pointer;
        }
        .history-plate { font-family: monospace; font-weight: bold; color: #2a5298; }
        .penalty-item {
            padding: 12px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .penalty-plate { font-family: monospace; font-weight: bold; color: #dc3545; font-size: 16px; }
        .penalty-amount { color: #dc3545; font-weight: bold; font-size: 18px; }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #2a5298;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .stats {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        .stat-card {
            background: white;
            border-radius: 10px;
            padding: 15px;
            text-align: center;
            flex: 1;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .stat-card:hover { transform: scale(1.05); }
        .stat-number { font-size: 2em; font-weight: bold; color: #2a5298; }
        .stat-label { font-size: 11px; color: #666; }
        .penalty-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 15px;
        }
        .penalty-stat-card {
            background: linear-gradient(135deg, #dc3545, #c82333);
            color: white;
            border-radius: 10px;
            padding: 15px;
            text-align: center;
        }
        .penalty-stat-number { font-size: 24px; font-weight: bold; }
        .penalty-stat-label { font-size: 11px; opacity: 0.9; }
        .search-box {
            width: 100%;
            padding: 10px;
            margin-bottom: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 14px;
        }
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .tab {
            flex: 1;
            padding: 10px;
            background: #e9ecef;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
        }
        .tab.active {
            background: #2a5298;
            color: white;
        }
        .scrollable-list {
            max-height: 400px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚗 ALPR - License Plate Recognition</h1>
        <p class="subtitle">Real-time License Plate Detection & Penalty Tracking System</p>

        <div class="stats">
            <div class="stat-card" onclick="showTab('detections')">
                <div class="stat-number" id="totalDetections">0</div>
                <div class="stat-label">Total Detections</div>
            </div>
            <div class="stat-card" onclick="showTab('detections')">
                <div class="stat-number" id="uniquePlates">0</div>
                <div class="stat-label">Unique Plates</div>
            </div>
            <div class="stat-card" onclick="showTab('penalties')">
                <div class="stat-number" id="totalPenalties">0</div>
                <div class="stat-label">Total Penalties</div>
            </div>
            <div class="stat-card" onclick="showTab('penalties')">
                <div class="stat-number" id="totalPenaltyAmount">₹0</div>
                <div class="stat-label">Penalty Amount</div>
            </div>
        </div>

        <div class="tabs">
            <button class="tab active" onclick="showTab('detections')">License Plate Detection</button>
            <button class="tab" onclick="showTab('penalties')">Penalty List</button>
            <button class="tab" onclick="showTab('reports')"> Reports</button>
        </div>

        <!-- Detection Tab -->
        <div id="detectionsTab" class="main-grid">
            <div class="card">
                <h2>Live Camera</h2>
                <div class="video-container">
                    <video id="video" autoplay playsinline muted></video>
                    <div class="guide-box"></div>
                </div>
                <div class="button-group">
                    <button class="btn-primary" onclick="startCamera()">Start Camera</button>
                    <button class="btn-danger" onclick="stopCamera()">Stop Camera</button>
                    <button class="btn-success" onclick="captureAndDetect()">Detect Plate</button>
                </div>
                <div id="cameraResult" class="result-box">
                    <div class="status-badge status-info"> Ready</div>
                    <div>Start camera → Position plate → Click "Detect Plate"</div>
                </div>
            </div>

            <div class="card">
                <h2>Upload Image</h2>
                <div class="button-group">
                    <input type="file" id="fileUpload" accept="image/*" style="display: none;">
                    <button class="btn-info" onclick="document.getElementById('fileUpload').click()">Upload Image</button>
                    <button class="btn-primary" onclick="testSample()">Test Sample</button>
                    <button class="btn-danger" onclick="clearHistory()">Clear History</button>
                </div>
                <div id="uploadPreview" style="display: none; margin-top: 10px;">
                    <img id="previewImage" style="max-width: 100%; border-radius: 8px;">
                </div>
                <div id="uploadResult" class="result-box">
                    <div class="status-badge status-info">Ready</div>
                    <div>Upload an image or click "Test Sample"</div>
                </div>
            </div>
        </div>

        <!-- Penalty Tab -->
        <div id="penaltiesTab" style="display: none;">
            <div class="card">
                <h2>⚠️ Vehicles with Penalties</h2>
                <input type="text" id="penaltySearch" class="search-box" placeholder="Search by license plate..." onkeyup="searchPenalties()">
                <div class="penalty-stats">
                    <div class="penalty-stat-card">
                        <div class="penalty-stat-number" id="penaltyCount">0</div>
                        <div class="penalty-stat-label">Total Penalties</div>
                    </div>
                    <div class="penalty-stat-card">
                        <div class="penalty-stat-number" id="penaltyTotalAmount">₹0</div>
                        <div class="penalty-stat-label">Total Amount</div>
                    </div>
                    <div class="penalty-stat-card">
                        <div class="penalty-stat-number" id="avgPenalty">₹0</div>
                        <div class="penalty-stat-label">Average Penalty</div>
                    </div>
                </div>
                <div id="penaltyList" class="scrollable-list">
                    <div style="text-align: center; padding: 20px; color: #999;">Loading penalties...</div>
                </div>
                <div class="button-group" style="margin-top: 15px;">
                    <button class="btn-danger" onclick="clearAllPenalties()">Clear All Penalties</button>
                    <button class="btn-success" onclick="exportPenalties()">Export Penalties</button>
                </div>
            </div>
        </div>

        <!-- Reports Tab -->
        <div id="reportsTab" style="display: none;">
            <div class="card">
                <h2>Penalty Reports</h2>
                <canvas id="penaltyChart" style="max-height: 400px;"></canvas>
                <div style="margin-top: 20px;">
                    <h3>Top Offenders</h3>
                    <div id="topOffenders"></div>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top: 20px;">
            <h2>Detection History</h2>
            <div id="history" style="max-height: 250px; overflow-y: auto;">
                <div style="text-align: center; color: #999; padding: 20px;">No detections yet</div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        let videoStream = null;
        let detectionHistory = [];
        let uniquePlates = new Set();
        let totalDetections = 0;
        let penaltyChart = null;

        async function startCamera() {
            try {
                if (videoStream) stopCamera();
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                videoStream = stream;
                document.getElementById("video").srcObject = stream;
                showCameraMessage("Camera ready! Position license plate in green box.", "success");
            } catch (error) {
                showCameraMessage("Cannot access camera. Check permissions.", "error");
            }
        }

        function stopCamera() {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
                videoStream = null;
                document.getElementById("video").srcObject = null;
                showCameraMessage("Camera stopped.", "info");
            }
        }

        async function captureAndDetect() {
            if (!videoStream) {
                showCameraMessage("Start camera first", "error");
                return;
            }
            
            showCameraMessage("Processing...", "processing");
            
            const video = document.getElementById("video");
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d").drawImage(video, 0, 0);
            
            const result = await sendImage(canvas.toDataURL());
            
            if (result && result.plate) {
                showDetectionResult("cameraResult", result);
                addToHistory(result);
                checkAndAddPenalty(result.plate);
            } else {
                showCameraMessage("No license plate detected. Adjust position and lighting.", "error");
            }
        }

        async function sendImage(imageData) {
            try {
                const response = await fetch("/detect", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: imageData })
                });
                return await response.json();
            } catch (error) {
                console.error("Error:", error);
                return null;
            }
        }

        async function checkAndAddPenalty(plate) {
            try {
                const response = await fetch(`/check-penalty/${plate}`);
                const data = await response.json();
                if (data.has_penalty) {
                    showPenaltyAlert(plate, data.penalty);
                }
            } catch (error) {
                console.error("Error checking penalty:", error);
            }
        }

        function showPenaltyAlert(plate, penalty) {
            const resultDiv = document.getElementById("cameraResult");
            const existingAlert = resultDiv.querySelector('.penalty-alert');
            if (existingAlert) existingAlert.remove();
            
            const alertDiv = document.createElement('div');
            alertDiv.className = 'penalty-alert';
            alertDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; color: #721c24;';
            alertDiv.innerHTML = `
                <strong>Penalty Alert!</strong><br>
                License Plate: ${plate}<br>
                Penalty Amount: ₹${penalty.amount}<br>
                Reason: ${penalty.reason}<br>
                Date: ${penalty.date}
            `;
            resultDiv.appendChild(alertDiv);
        }

        async function addPenalty(plate, amount, reason) {
            try {
                const response = await fetch("/add-penalty", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ plate: plate, amount: amount, reason: reason })
                });
                const result = await response.json();
                if (result.success) {
                    alert(`Penalty added for ${plate}`);
                    loadPenalties();
                }
            } catch (error) {
                console.error("Error adding penalty:", error);
            }
        }

        async function loadPenalties() {
            try {
                const response = await fetch("/get-penalties");
                const data = await response.json();
                updatePenaltyUI(data);
            } catch (error) {
                console.error("Error loading penalties:", error);
            }
        }

        function updatePenaltyUI(data) {
            const penaltyList = document.getElementById("penaltyList");
            const penaltyCount = document.getElementById("penaltyCount");
            const penaltyTotalAmount = document.getElementById("penaltyTotalAmount");
            const avgPenalty = document.getElementById("avgPenalty");
            const totalPenaltiesSpan = document.getElementById("totalPenalties");
            const totalPenaltyAmountSpan = document.getElementById("totalPenaltyAmount");
            
            penaltyCount.textContent = data.total_count;
            penaltyTotalAmount.textContent = `₹${data.total_amount}`;
            avgPenalty.textContent = data.total_count > 0 ? `₹${Math.round(data.total_amount / data.total_count)}` : "₹0";
            totalPenaltiesSpan.textContent = data.total_count;
            totalPenaltyAmountSpan.textContent = `₹${data.total_amount}`;
            
            if (data.penalties.length === 0) {
                penaltyList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No penalties recorded</div>';
                return;
            }
            
            penaltyList.innerHTML = data.penalties.map(p => `
                <div class="penalty-item">
                    <div>
                        <div class="penalty-plate">${p.plate}</div>
                        <div style="font-size: 11px; color: #666;">${p.reason}</div>
                        <div style="font-size: 10px; color: #999;">${p.date}</div>
                    </div>
                    <div class="penalty-amount">₹${p.amount}</div>
                </div>
            `).join("");
            
            updateChart(data.penalties);
            updateTopOffenders(data.penalties);
        }

        function updateChart(penalties) {
            const plateCounts = {};
            penalties.forEach(p => {
                plateCounts[p.plate] = (plateCounts[p.plate] || 0) + p.amount;
            });
            
            const labels = Object.keys(plateCounts).slice(0, 10);
            const amounts = labels.map(l => plateCounts[l]);
            
            const ctx = document.getElementById('penaltyChart').getContext('2d');
            if (penaltyChart) penaltyChart.destroy();
            
            penaltyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Penalty Amount (₹)',
                        data: amounts,
                        backgroundColor: 'rgba(220, 53, 69, 0.7)',
                        borderColor: '#dc3545',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Amount (₹)' } },
                        x: { ticks: { rotation: 45, maxRotation: 45 } }
                    }
                }
            });
        }

        function updateTopOffenders(penalties) {
            const plateTotal = {};
            penalties.forEach(p => {
                plateTotal[p.plate] = (plateTotal[p.plate] || 0) + p.amount;
            });
            
            const sorted = Object.entries(plateTotal).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const topOffendersDiv = document.getElementById("topOffenders");
            
            if (sorted.length === 0) {
                topOffendersDiv.innerHTML = '<div style="text-align: center; padding: 20px;">No data available</div>';
                return;
            }
            
            topOffendersDiv.innerHTML = sorted.map(([plate, amount], index) => `
                <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee;">
                    <span><strong>#${index + 1}</strong> ${plate}</span>
                    <span style="color: #dc3545; font-weight: bold;">₹${amount}</span>
                </div>
            `).join("");
        }

        async function clearAllPenalties() {
            if (confirm("Are you sure you want to clear all penalties? This action cannot be undone!")) {
                try {
                    const response = await fetch("/clear-penalties", { method: "POST" });
                    const result = await response.json();
                    if (result.success) {
                        alert("All penalties cleared");
                        loadPenalties();
                    }
                } catch (error) {
                    console.error("Error clearing penalties:", error);
                }
            }
        }

        async function exportPenalties() {
            window.open("/export-penalties", "_blank");
        }

        function searchPenalties() {
            const searchTerm = document.getElementById("penaltySearch").value.toUpperCase();
            const penaltyItems = document.querySelectorAll(".penalty-item");
            penaltyItems.forEach(item => {
                const plate = item.querySelector(".penalty-plate").textContent;
                if (plate.includes(searchTerm)) {
                    item.style.display = "flex";
                } else {
                    item.style.display = "none";
                }
            });
        }

        function showDetectionResult(elementId, result) {
            const container = document.getElementById(elementId);
            container.innerHTML = `
                <div class="status-badge status-success">LICENSE PLATE DETECTED</div>
                <div class="plate-number">${result.plate}</div>
                <div class="confidence">Confidence: ${result.confidence}% | Time: ${result.time}ms</div>
                <div class="button-group" style="margin-top: 10px;">
                    <button class="btn-warning" onclick="addPenalty('${result.plate}', 100, 'Overtime parking')">Add Penalty ₹100</button>
                    <button class="btn-warning" onclick="addPenalty('${result.plate}', 200, 'Wrong parking')">Add Penalty ₹200</button>
                    <button class="btn-warning" onclick="addPenalty('${result.plate}', 500, 'No parking zone')">Add Penalty ₹500</button>
                </div>
            `;
        }

        function showCameraMessage(message, type) {
            const colors = { info: "#17a2b8", error: "#dc3545", success: "#28a745", processing: "#ffc107" };
            document.getElementById("cameraResult").innerHTML = `
                <div class="status-badge" style="background: ${colors[type]}20; color: ${colors[type]}">${type.toUpperCase()}</div>
                <div>${message}</div>
            `;
        }

        function addToHistory(result) {
            totalDetections++;
            uniquePlates.add(result.plate);
            
            document.getElementById("totalDetections").textContent = totalDetections;
            document.getElementById("uniquePlates").textContent = uniquePlates.size;
            
            detectionHistory.unshift({
                plate: result.plate,
                confidence: result.confidence,
                time: result.time,
                timestamp: new Date().toLocaleTimeString()
            });
            
            if (detectionHistory.length > 15) detectionHistory.pop();
            
            const historyDiv = document.getElementById("history");
            if (detectionHistory.length === 0) {
                historyDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No detections yet</div>';
                return;
            }
            
            historyDiv.innerHTML = detectionHistory.map(item => `
                <div class="history-item" onclick="alert('Plate: ${item.plate}\\nConfidence: ${item.confidence}%\\nTime: ${item.time}ms')">
                    <div><div class="history-plate">${item.plate}</div><div style="font-size: 11px; color: #999;">${item.timestamp}</div></div>
                    <div style="color: #28a745;">${item.confidence}%</div>
                </div>
            `).join("");
        }

        function clearHistory() {
            detectionHistory = [];
            uniquePlates.clear();
            totalDetections = 0;
            document.getElementById("totalDetections").textContent = "0";
            document.getElementById("uniquePlates").textContent = "0";
            document.getElementById("history").innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No detections yet</div>';
        }

        function showTab(tabName) {
            document.getElementById("detectionsTab").style.display = tabName === "detections" ? "grid" : "none";
            document.getElementById("penaltiesTab").style.display = tabName === "penalties" ? "block" : "none";
            document.getElementById("reportsTab").style.display = tabName === "reports" ? "block" : "none";
            
            document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
            if (tabName === "detections") document.querySelector(".tab").classList.add("active");
            else if (tabName === "penalties") document.querySelectorAll(".tab")[1].classList.add("active");
            else if (tabName === "reports") document.querySelectorAll(".tab")[2].classList.add("active");
            
            if (tabName === "penalties") loadPenalties();
            if (tabName === "reports") loadPenalties();
        }

        async function testSample() {
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#333333';
            ctx.font = 'Bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("MH12AB1234", canvas.width/2, 120);
            
            const result = await sendImage(canvas.toDataURL());
            
            if (result && result.plate) {
                showDetectionResult("uploadResult", result);
                addToHistory(result);
            } else {
                document.getElementById("uploadResult").innerHTML = '<div class="status-badge status-error"> ERROR</div><div>Could not detect license plate</div>';
            }
            document.getElementById("previewImage").src = canvas.toDataURL();
            document.getElementById("uploadPreview").style.display = "block";
        }

        document.getElementById("fileUpload").addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                document.getElementById("previewImage").src = event.target.result;
                document.getElementById("uploadPreview").style.display = "block";
                const result = await sendImage(event.target.result);
                if (result && result.plate) {
                    showDetectionResult("uploadResult", result);
                    addToHistory(result);
                } else {
                    document.getElementById("uploadResult").innerHTML = '<div class="status-badge status-error"> ERROR</div><div>No license plate detected</div>';
                }
            };
            reader.readAsDataURL(file);
        });

        // Auto-start camera and load penalties
        startCamera();
        loadPenalties();
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return HTML_TEMPLATE

@app.route('/detect', methods=['POST'])
def detect_plate():
    try:
        start_time = datetime.now()
        data = request.json
        image_data = data['image'].split(',')[1]
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'plate': None, 'success': False})
        
        # Perform OCR
        results = reader.readtext(img)
        
        # Extract text
        all_text = ' '.join([result[1] for result in results])
        cleaned_text = re.sub(r'[^A-Z0-9]', '', all_text.upper())
        
        # Find license plate
        plate = extract_license_plate(cleaned_text)
        
        # If no pattern match, try first word
        if not plate and results:
            first_word = results[0][1].upper().replace(' ', '').replace('-', '')
            if len(first_word) >= 6:
                plate = first_word
        
        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
        
        return jsonify({
            'plate': plate,
            'confidence': 85 if plate else 0,
            'time': processing_time,
            'success': True
        })
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'plate': None, 'error': str(e), 'success': False})

@app.route('/add-penalty', methods=['POST'])
def add_penalty():
    try:
        data = request.json
        plate = data.get('plate', '').upper()
        amount = data.get('amount', 0)
        reason = data.get('reason', 'Parking violation')
        
        if not plate:
            return jsonify({'success': False, 'error': 'Plate required'})
        
        penalty_entry = {
            'plate': plate,
            'amount': amount,
            'reason': reason,
            'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'timestamp': datetime.now().isoformat()
        }
        
        penalty_db['penalties'].append(penalty_entry)
        penalty_db['total_count'] = len(penalty_db['penalties'])
        penalty_db['total_amount'] = sum(p['amount'] for p in penalty_db['penalties'])
        
        save_penalty_database(penalty_db)
        
        return jsonify({'success': True, 'penalty': penalty_entry})
        
    except Exception as e:
        print(f"Error adding penalty: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/get-penalties', methods=['GET'])
def get_penalties():
    return jsonify(penalty_db)

@app.route('/check-penalty/<plate>', methods=['GET'])
def check_penalty(plate):
    plate = plate.upper()
    penalties_for_plate = [p for p in penalty_db['penalties'] if p['plate'] == plate]
    total_penalty = sum(p['amount'] for p in penalties_for_plate)
    
    return jsonify({
        'has_penalty': len(penalties_for_plate) > 0,
        'count': len(penalties_for_plate),
        'total_amount': total_penalty,
        'penalties': penalties_for_plate
    })

@app.route('/clear-penalties', methods=['POST'])
def clear_penalties():
    global penalty_db
    penalty_db = {"penalties": [], "total_count": 0, "total_amount": 0}
    save_penalty_database(penalty_db)
    return jsonify({'success': True})

@app.route('/export-penalties', methods=['GET'])
def export_penalties():
    import csv
    from io import StringIO
    from flask import Response
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['License Plate', 'Amount (₹)', 'Reason', 'Date'])
    
    for penalty in penalty_db['penalties']:
        writer.writerow([penalty['plate'], penalty['amount'], penalty['reason'], penalty['date']])
    
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=penalties_export.csv'}
    )

@app.route('/penalty-stats', methods=['GET'])
def penalty_stats():
    return jsonify({
        'total_penalties': penalty_db['total_count'],
        'total_amount': penalty_db['total_amount'],
        'average_penalty': penalty_db['total_amount'] / penalty_db['total_count'] if penalty_db['total_count'] > 0 else 0,
        'unique_offenders': len(set(p['plate'] for p in penalty_db['penalties']))
    })

if __name__ == '__main__':
    print("\n" + "="*50)
    print("ALPR System with Penalty Tracking Running!")
    print("="*50)
    print(f"Open in browser: http://localhost:5002")
    print("\nFeatures:")
    print("  ✓ License Plate Detection")
    print("  ✓ Penalty Tracking System")
    print("  ✓ Add penalties with reason")
    print("  ✓ View penalty list")
    print("  ✓ Export penalties to CSV")
    print("  ✓ Charts and reports")
    print("="*50 + "\n")
    app.run(host='0.0.0.0', port=5002, debug=True)