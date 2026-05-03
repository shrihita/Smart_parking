import React, { useState, useEffect, useCallback, useRef } from "react";

const BASE_URL = "https://monday-kilobyte-chili.ngrok-free.dev";

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const compressImage = (base64String, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      
      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedDataUrl);
    };
    img.src = base64String;
  });
};

async function detectLicensePlate(imageBase64) {
  try {
    const response = await fetch(`${BASE_URL}/api/ocr/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageBase64 })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("OCR Error:", error);
    return { success: false, error: error.message };
  }
}

// Camera Component
function VehicleCamera({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const [manualPlate, setManualPlate] = useState("");
  const [detectedPlate, setDetectedPlate] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setError(null);
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadeddata = () => {
          setCameraReady(true);
          console.log("Camera ready!");
        };
      }
    } catch (err) {
      setError("Cannot access camera: " + err.message);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !cameraReady) {
      setError("Camera not ready. Please wait.");
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    
    console.log("Captured image size:", imageDataUrl.length);
    
    setCapturedImage(imageDataUrl);
    setDetectedPlate(null);
    setManualPlate("");
    setError(null);
  };

  const detectPlate = async () => {
    if (!capturedImage) {
      alert("Please capture a photo first");
      return;
    }
    
    setIsDetecting(true);
    setError(null);
    
    console.log("Sending to OCR...");
    
    try {
      const result = await detectLicensePlate(capturedImage);
      console.log("OCR Result:", result);
      
      if (result.success && result.plate) {
        setDetectedPlate(result.plate);
        setManualPlate(result.plate);
      } else {
        setError("No license plate detected. Try adjusting position/lighting.");
      }
    } catch (err) {
      console.error("Detection error:", err);
      setError("OCR Error: " + err.message);
    } finally {
      setIsDetecting(false);
    }
  };

  const confirmAndUse = () => {
    const finalPlate = manualPlate || detectedPlate;
    if (!finalPlate) {
      alert("Please enter or detect license plate");
      return;
    }
    onCapture(finalPlate, capturedImage);
  };

  const modalStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.95)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  };

  const modalContentStyle = {
    background: "#0d1520",
    borderRadius: 20,
    maxWidth: "90vw",
    width: 500,
    maxHeight: "90vh",
    overflow: "auto",
    border: "1px solid #1a2c3d",
  };

  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 20px",
    borderBottom: "1px solid #1a2c3d",
  };

  const contentStyle = { padding: 20 };

  const videoStyle = { width: "100%", borderRadius: 10, background: "#000" };

  const guideBoxStyle = {
    position: "absolute",
    top: "30%",
    left: "10%",
    width: "80%",
    height: "30%",
    border: "2px solid #00ff00",
    borderRadius: 10,
    pointerEvents: "none",
  };

  const buttonStyle = {
    width: "100%",
    marginTop: 15,
    padding: 12,
    background: "#00d278",
    color: "#000",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
  };

  const detectButtonStyle = {
    width: "100%",
    marginBottom: 10,
    padding: 12,
    background: "#4361ee",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
  };

  const inputStyle = {
    width: "100%",
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    border: "1px solid #1e3045",
    background: "#0d1520",
    color: "#fff",
    fontSize: 18,
    fontFamily: "monospace",
    textAlign: "center",
  };

  return (
    <div style={modalStyle}>
      <div style={modalContentStyle}>
        <div style={headerStyle}>
          <h3>Capture License Plate</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#e63946", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        
        <div style={contentStyle}>
          {!capturedImage ? (
            <>
              <div style={{ position: "relative" }}>
                <video ref={videoRef} autoPlay playsInline style={videoStyle} />
                <div style={guideBoxStyle}></div>
              </div>
              
              <button 
                onClick={capturePhoto}
                disabled={!cameraReady}
                style={{ ...buttonStyle, opacity: !cameraReady ? 0.5 : 1 }}
              >
                Capture Photo
              </button>
              
              <button 
                onClick={() => onCapture("", null)}
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: 10,
                  background: "none",
                  border: "1px solid #666",
                  color: "#999",
                  borderRadius: 8,
                  cursor: "pointer"
                }}
              >
                Skip (Enter Manually)
              </button>
            </>
          ) : (
            <>
              <img src={capturedImage} alt="Captured" style={{ width: "100%", borderRadius: 10, marginBottom: 15 }} />
              
              {!detectedPlate && !isDetecting && (
                <button onClick={detectPlate} style={detectButtonStyle}>
                  Detect License Plate
                </button>
              )}
              
              {isDetecting && (
                <div style={{ textAlign: "center", padding: 15, background: "#0d1520", borderRadius: 8, marginBottom: 10 }}>
                  <span style={{ display: "inline-block", width: 20, height: 20, border: "2px solid #fff", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite", marginRight: 8 }}></span>
                  Detecting...
                </div>
              )}
              
              {detectedPlate && (
                <div style={{ textAlign: "center", padding: 15, background: "#0a1a12", border: "1px solid #00d278", borderRadius: 8, marginBottom: 10 }}>
                  <p style={{ color: "#00d278", marginBottom: 5 }}>✅ License Plate Detected!</p>
                  <p style={{ fontSize: 24, fontWeight: "bold", fontFamily: "monospace" }}>{detectedPlate}</p>
                </div>
              )}
              
              {error && (
                <div style={{ textAlign: "center", padding: 15, background: "#1a0a0a", border: "1px solid #e63946", borderRadius: 8, marginBottom: 10, color: "#e63946" }}>
                  {error}
                </div>
              )}
              
              <input 
                type="text" 
                placeholder="Enter license plate number" 
                value={manualPlate}
                onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
                style={inputStyle}
              />
              
              <div style={{ display: "flex", gap: 10 }}>
                <button 
                  onClick={() => {
                    setCapturedImage(null);
                    setDetectedPlate(null);
                    setManualPlate("");
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    padding: 10,
                    background: "#1a0a0a",
                    color: "#e63946",
                    border: "1px solid #3d1515",
                    borderRadius: 8,
                    cursor: "pointer"
                  }}
                >
                  Retake
                </button>
                <button 
                  onClick={confirmAndUse}
                  style={{
                    flex: 1,
                    padding: 10,
                    background: "#00d278",
                    color: "#000",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  Use This
                </button>
              </div>
            </>
          )}
        </div>
        
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}

// Simple Badge Component
function Badge({ children, color = "#00d278" }) {
  return (
    <span style={{ background: color + "22", color, border: "1px solid " + color + "44", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontFamily: "monospace", fontWeight: 500 }}>
      {children}
    </span>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 11, color: "#7a8ba0" }}>{label}</label>}
      <input {...props} style={{ background: "#0d1520", border: "1px solid #1e3045", borderRadius: 8, padding: "10px 14px", color: "#e8eaf0", fontSize: 14, width: "100%" }} />
    </div>
  );
}

function Select({ label, options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 11, color: "#7a8ba0" }}>{label}</label>}
      <select value={value} onChange={onChange} style={{ background: "#0d1520", border: "1px solid #1e3045", borderRadius: 8, padding: "10px 14px", color: "#e8eaf0", fontSize: 14, width: "100%", cursor: "pointer" }}>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function Btn({ children, variant = "primary", loading, ...props }) {
  const variants = {
    primary: { background: "#00d278", color: "#000", fontWeight: 700 },
    danger: { background: "#e63946", color: "#fff", fontWeight: 700 },
    ghost: { background: "transparent", color: "#7a8ba0", border: "1px solid #1e3045" },
    admin: { background: "#4361ee", color: "#fff", fontWeight: 700 },
  };
  return (
    <button {...props} disabled={loading} style={{ padding: "11px 20px", borderRadius: 8, border: "none", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: loading ? 0.6 : 1, width: "100%", ...variants[variant] }}>
      {loading ? <span style={{ width: 16, height: 16, border: "2px solid #fff4", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 1s linear infinite", display: "inline-block" }} /> : children}
    </button>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: "#0d1520", border: "1px solid #1a2c3d", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 14, ...style }}>
      {children}
    </div>
  );
}

// Exit Screen
function ExitScreen({ due, refund, deposit, refundStatus, exitedOnTime, onDone }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#080c12", padding: 20 }}>
      <Card style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <h2>{exitedOnTime ? "Exit Successful" : "Late Exit"}</h2>
        <div style={{ background: "#0a1a12", borderRadius: 10, padding: 16 }}>
          <p style={{ color: "#7a8ba0", fontSize: 12 }}>DEPOSIT PAID</p>
          <p style={{ color: "#f4a261", fontSize: 28, fontWeight: 800 }}>₹{deposit}</p>
        </div>
        {due > 0 && (
          <div style={{ background: "#120a0a", borderRadius: 10, padding: 16, marginTop: 10 }}>
            <p style={{ color: "#7a8ba0", fontSize: 12 }}>OVERTIME PENALTY</p>
            <p style={{ color: "#e63946", fontSize: 28, fontWeight: 800 }}>₹{due}</p>
          </div>
        )}
        <div style={{ background: refundStatus === "success" ? "#0a1a12" : "#1a0a0a", borderRadius: 10, padding: 16, marginTop: 10 }}>
          <p style={{ color: "#7a8ba0", fontSize: 12 }}>{refundStatus === "success" ? "REFUND PROCESSED" : "REFUND STATUS"}</p>
          <p style={{ color: refundStatus === "success" ? "#00d278" : "#e63946", fontSize: 28, fontWeight: 800 }}>₹{refund}</p>
        </div>
        <Btn onClick={onDone}>Done</Btn>
      </Card>
    </div>
  );
}

// Booking Active Screen
function BookingActive({ bookingData, timeLeft, onExtend, onDone, extensionConfig, loading }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#080c12", padding: 20 }}>
      <Card style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <Badge color="#00d278">BOOKING CONFIRMED</Badge>
        <h2 style={{ fontSize: 26 }}>{bookingData.slot}</h2>
        <p style={{ fontSize: 12, color: "#7a8ba0" }}>{bookingData.area}</p>
        <p style={{ fontFamily: "monospace", fontSize: 13 }}>{bookingData.license}</p>
        <div style={{ background: timeLeft === "TIME EXPIRED" ? "#1a0a0a" : "#0a1a12", borderRadius: 10, padding: "16px 0", marginTop: 10 }}>
          <p style={{ fontSize: 22, fontWeight: 500, color: timeLeft === "TIME EXPIRED" ? "#e63946" : "#00d278" }}>{timeLeft}</p>
          <p style={{ fontSize: 11, color: "#7a8ba0" }}>TIME REMAINING</p>
        </div>
        <Btn variant="primary" onClick={onExtend} loading={loading}>Extend {extensionConfig?.extend_minutes || 30} mins (+₹{extensionConfig?.extend_fee || 20})</Btn>
        <Btn variant="ghost" onClick={onDone}>Back to Home</Btn>
      </Card>
    </div>
  );
}

// Admin Panel (Simplified)
function AdminPanel({ onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "#080c12", padding: 20 }}>
      <button onClick={onBack} style={{ background: "#0d1520", border: "1px solid #1e3045", color: "#7a8ba0", padding: "10px 20px", borderRadius: 8, cursor: "pointer", marginBottom: 20 }}>← Back</button>
      <Card>
        <h2>Admin Panel</h2>
        <p>Add your full admin panel code here</p>
      </Card>
    </div>
  );
}

// Main App
export default function SlotBooking() {
  const [screen, setScreen] = useState("home");
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [slots, setSlots] = useState([]);
  const [extensionConfig, setExtensionConfig] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [phone, setPhone] = useState("");
  const [license, setLicense] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bookingData, setBookingData] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [exitLicense, setExitLicense] = useState("");
  const [exitData, setExitData] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  // Add CSS animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  const refreshAreas = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/areas`);
      if (res.ok) setAreas(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const refreshSlots = useCallback(async (areaId) => {
    if (!areaId) return;
    try {
      const res = await fetch(`${BASE_URL}/api/slots?area_id=${areaId}`);
      if (res.ok) setSlots(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const refreshExtensionConfig = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/extension-config`);
      if (res.ok) setExtensionConfig(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    refreshAreas();
    refreshExtensionConfig();
  }, [refreshAreas, refreshExtensionConfig]);

  useEffect(() => {
    if (selectedArea) {
      refreshSlots(selectedArea.id);
      setSelectedSlot(null);
    }
  }, [selectedArea, refreshSlots]);

  useEffect(() => {
    if (!bookingData) return;
    const iv = setInterval(() => {
      const diff = new Date(bookingData.exitTime) - new Date();
      if (diff <= 0) setTimeLeft("TIME EXPIRED");
      else setTimeLeft(`${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s left`);
    }, 1000);
    return () => clearInterval(iv);
  }, [bookingData]);

  const handleVehicleCapture = (enteredPlate, photoDataUrl) => {
    setLicense(enteredPlate);
    setCapturedPhoto(photoDataUrl);
    setImage(photoDataUrl);
    setShowCamera(false);
    if (enteredPlate) {
      console.log(`License plate captured: ${enteredPlate}`);
    }
  };

  const handleBook = async () => {
    if (!selectedSlot || !phone || !license || !image) {
      alert("Please select a slot, fill all fields and capture vehicle photo.");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      alert("Please enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    try {
      const compressedImage = await compressImage(image, 800, 0.7);
      
      const res = await fetch(`${BASE_URL}/api/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_fee: selectedSlot.base_fee })
      });
      const data = await res.json();
      const loaded = await loadRazorpay();
      if (!loaded) {
        alert("Razorpay failed to load");
        setLoading(false);
        return;
      }
      const options = {
        key: "rzp_test_ScFnFfbsB8nJWc",
        amount: data.amount,
        currency: "INR",
        order_id: data.id,
        name: "Scan & Park",
        description: `${selectedSlot.area_name} - ${selectedSlot.name}`,
        handler: async (response) => {
          const verify = await fetch(`${BASE_URL}/api/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...response,
              slot_id: selectedSlot.id,
              slot_name: selectedSlot.name,
              area_name: selectedSlot.area_name,
              phone,
              license,
              image: compressedImage,
              base_fee: selectedSlot.base_fee,
              deposit: selectedSlot.deposit,
              duration_minutes: selectedSlot.duration_minutes
            }),
          });
          const result = await verify.json();
          if (result.status === "success") {
            const exitTime = new Date(Date.now() + (selectedSlot.duration_minutes || 60) * 60000);
            setBookingData({ slot: selectedSlot.name, area: selectedSlot.area_name, license, exitTime });
            setSelectedSlot(null);
            setPhone("");
            setLicense("");
            setImage(null);
            setCapturedPhoto(null);
            setScreen("success");
            refreshSlots(selectedArea.id);
          } else {
            alert("Payment verification failed");
          }
          setLoading(false);
        },
        modal: { ondismiss: () => setLoading(false) },
      };
      new window.Razorpay(options).open();
    } catch (e) {
      console.error(e);
      alert("Booking failed: " + e.message);
      setLoading(false);
    }
  };

  const handleExtend = async () => {
    if (!bookingData) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license: bookingData.license }),
      });
      const data = await res.json();
      if (data.order) {
        const loaded = await loadRazorpay();
        if (!loaded) {
          alert("Razorpay failed to load");
          setLoading(false);
          return;
        }
        const options = {
          key: "rzp_test_ScFnFfbsB8nJWc",
          amount: data.order.amount,
          currency: "INR",
          order_id: data.order.id,
          name: "Scan & Park",
          description: `Extend time for ${bookingData.slot}`,
          handler: async (response) => {
            const verify = await fetch(`${BASE_URL}/api/verify-extension`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...response, booking_id: data.booking_id }),
            });
            const result = await verify.json();
            if (result.success) {
              setBookingData({
                ...bookingData,
                exitTime: new Date(new Date(bookingData.exitTime).getTime() + (data.added_minutes || 30) * 60000)
              });
              alert(`${data.added_minutes || 30} mins added (₹${data.fee || 20})`);
            } else {
              alert("Extension failed");
            }
            setLoading(false);
          },
          modal: { ondismiss: () => setLoading(false) },
        };
        new window.Razorpay(options).open();
      }
    } catch (e) {
      console.error(e);
      alert("Extend failed");
      setLoading(false);
    }
  };

  const handleExit = async () => {
    if (!exitLicense) return alert("Enter license plate");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/exit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license: exitLicense }),
      });
      const data = await res.json();
      if (data.success) {
        setExitData(data);
        setScreen("exit");
        if (selectedArea) refreshSlots(selectedArea.id);
      } else {
        alert(data.message || "No active booking found");
      }
    } catch (e) {
      console.error(e);
      alert("Exit failed: " + e.message);
    }
    setLoading(false);
  };

  if (screen === "admin") return <AdminPanel onBack={() => { setScreen("home"); refreshAreas(); }} />;
  if (screen === "exit" && exitData) return <ExitScreen due={exitData.due_amount} refund={exitData.refund} deposit={exitData.deposit} refundStatus={exitData.refund_status} exitedOnTime={exitData.exited_on_time} onDone={() => { setExitLicense(""); setExitData(null); setScreen("home"); refreshAreas(); }} />;
  if (screen === "success" && bookingData) return <BookingActive bookingData={bookingData} timeLeft={timeLeft} onExtend={handleExtend} onDone={() => setScreen("home")} extensionConfig={extensionConfig} loading={loading} />;
  if (showCamera) return <VehicleCamera onCapture={handleVehicleCapture} onClose={() => setShowCamera(false)} />;

  const availableSlots = slots.filter(s => s.is_available === true || s.is_available === "true" || s.is_available === 1).length;

  return (
    <div style={{ minHeight: "100vh", background: "#080c12", display: "flex", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div><h1 style={{ fontSize: 28, fontWeight: 800 }}>Scan & Park</h1><p style={{ color: "#7a8ba0", fontSize: 13 }}>Smart Parking System</p></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            {selectedArea && <Badge color="#00d278">{availableSlots} FREE</Badge>}
            <button onClick={() => setScreen("admin")} style={{ background: "#0d1520", border: "1px solid #1e3045", color: "#4361ee", padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>⚙ Admin</button>
          </div>
        </div>

        <Card><h3 style={{ fontSize: 14, fontWeight: 700 }}>Select Parking Area</h3>
          <Select options={[{ value: "", label: "Choose an area..." }, ...areas.map(a => ({ value: a.id, label: `${a.name} (₹${a.base_fee}/${a.duration_minutes}min, Deposit: ₹${a.deposit})` }))]} value={selectedArea?.id || ""} onChange={(e) => { const area = areas.find(a => a.id === parseInt(e.target.value)); setSelectedArea(area || null); }} />
        </Card>

        {selectedArea && (<Card style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ fontSize: 14, fontWeight: 700 }}>Select a Slot</h3><span style={{ fontFamily: "monospace", fontSize: 11, color: "#7a8ba0" }}>{selectedArea.name} - ₹{selectedArea.base_fee} / {selectedArea.duration_minutes}min</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {slots.map((s) => {
              const avail = s.is_available === true || s.is_available === "true" || s.is_available === 1;
              const selected = selectedSlot?.id === s.id;
              return (<div key={s.id} onClick={() => avail && setSelectedSlot({ id: s.id, name: s.name, area_name: s.area_name, base_fee: s.base_fee, deposit: s.deposit, duration_minutes: s.duration_minutes })} style={{ background: avail ? (selected ? "#0a2a18" : "#0a1a12") : "#1a0a0a", border: selected ? "2px solid #00d278" : `1px solid ${avail ? "#1a4a2a" : "#2a1010"}`, borderRadius: 8, padding: "10px 6px", textAlign: "center", cursor: avail ? "pointer" : "not-allowed", opacity: avail ? 1 : 0.45 }}>
                <p style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{s.name}</p>
                <p style={{ fontSize: 9, marginTop: 3, color: avail ? "#00d278" : "#e63946" }}>{avail ? "free" : "busy"}</p>
              </div>);
            })}
          </div>
        </Card>)}

        <Card style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Vehicle Details</h3>
          <Input label="Selected Slot" value={selectedSlot ? selectedSlot.name : ""} readOnly placeholder="Click a slot above" />
          <Input label="Phone Number" type="tel" placeholder="10-digit mobile" value={phone} onChange={(e) => setPhone(e.target.value)} />
          
          <Btn variant="admin" onClick={() => setShowCamera(true)} style={{ marginBottom: 10 }}>
            Capture Vehicle & Detect Plate Number
          </Btn>
          
          <Input 
            label="License Plate" 
            placeholder="Auto-detected or enter manually" 
            value={license} 
            onChange={(e) => setLicense(e.target.value.toUpperCase())}
            style={{ fontFamily: "monospace", fontSize: 16, fontWeight: "bold" }}
          />
          
          {capturedPhoto && (
            <div style={{ marginTop: 10 }}>
              <img src={capturedPhoto} alt="Captured vehicle" style={{ width: "100%", borderRadius: 8 }} />
            </div>
          )}
          
          <Btn onClick={handleBook} loading={loading}>Book & Pay ₹{selectedSlot?.base_fee || 0}</Btn>
        </Card>

        <Card style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Exit Vehicle</h3>
          <Input label="License Plate" placeholder="Enter your plate to exit" value={exitLicense} onChange={(e) => setExitLicense(e.target.value.toUpperCase())} />
          <Btn variant="danger" onClick={handleExit} loading={loading}>Exit & Calculate Charges</Btn>
        </Card>

        <p style={{ textAlign: "center", color: "#3a4a5a", fontSize: 11, marginTop: 20 }}>Scan & Park v3.0 with OCR</p>
      </div>
    </div>
  );
}