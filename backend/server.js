const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/uploads", express.static("uploads"));

app.use((req, res, next) => {
  req.setTimeout(60000);
  res.setTimeout(60000);
  next();
});

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const db = new Pool({
  user: "postgres",
  host: "localhost",
  database: "parkingdb",
  password: "1234",
  port: 5432,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

db.connect((err, client, release) => {
  if (err) {
    console.error("Error connecting to database:", err.stack);
  } else {
    console.log("Database connected successfully");
    release();
  }
});

// ─── RAZORPAY ─────────────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id: "rzp_test_ScFnFfbsB8nJWc",
  key_secret: "HeSSWZzf1G9TOp6J13aPbhin",
});

// ─── ADMIN AUTH ────────────────────────────────────────────────────────────────
const ADMIN_KEY = "admin123";

function adminAuth(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ════════════════════════════════════════════════════════════════════════
//  OCR CONFIGURATION - Use Python OCR Server
// ════════════════════════════════════════════════════════════════════════

const OCR_SERVER_URL = process.env.OCR_SERVER_URL || "http://localhost:5002";

async function detectLicensePlate(imageBase64) {
    try {
        console.log("Sending image to Python OCR server...");
        const response = await axios.post(`${OCR_SERVER_URL}/detect`, {
            image: imageBase64
        }, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log("OCR server response:", response.data);
        return response.data;
    } catch (error) {
        console.error("OCR Server error:", error.message);
        if (error.code === 'ECONNREFUSED') {
            throw new Error("OCR server is not running on port 5002. Please start it with: python ocr_server.py");
        }
        throw error;
    }
}

app.post("/api/ocr/detect", async (req, res) => {
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({ error: "No image provided" });
        }
        
        console.log("Received image for OCR detection");
        
        const ocrResult = await detectLicensePlate(image);
        
        let savedPath = null;
        if (ocrResult.plate) {
            try {
                const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
                const fileName = `plate_${ocrResult.plate}_${Date.now()}.jpg`;
                const filePath = path.join("uploads", fileName);
                fs.writeFileSync(filePath, base64Data, "base64");
                savedPath = filePath;
                console.log(`Saved license plate image: ${savedPath}`);
            } catch (err) {
                console.error("Failed to save image:", err);
            }
        }
        
        res.json({
            success: ocrResult.success,
            plate: ocrResult.plate,
            confidence: ocrResult.confidence || 0,
            processingTime: ocrResult.time,
            fullText: ocrResult.full_text || "",
            imagePath: savedPath
        });
        
    } catch (error) {
        console.error("OCR error:", error);
        res.status(500).json({ 
            error: error.message,
            suggestion: "Make sure Python OCR server is running on port 5002"
        });
    }
});

app.get("/api/ocr/health", async (req, res) => {
    try {
        const response = await axios.get(`${OCR_SERVER_URL}/health`, { timeout: 5000 });
        res.json({ 
            status: "connected", 
            ocr_server: response.data,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(503).json({ 
            status: "disconnected", 
            error: "OCR server not available. Start it with: python ocr_server.py",
            timestamp: new Date()
        });
    }
});

// ════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES
// ════════════════════════════════════════════════════════════════════════

app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date() }));

app.get("/api/areas", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM areas ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch areas" });
  }
});

app.get("/api/slots", async (req, res) => {
  try {
    const { area_id } = req.query;
    let query = `
      SELECT s.*, a.name as area_name, a.base_fee, a.deposit, a.duration_minutes, a.penalty_per_min 
      FROM slots s 
      JOIN areas a ON s.area_id = a.id
    `;
    let params = [];
    
    if (area_id) {
      query += " WHERE s.area_id = $1";
      params.push(area_id);
    }
    
    query += " ORDER BY s.id";
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

app.post("/api/book", async (req, res) => {
  try {
    const { base_fee } = req.body;
    const totalAmount = parseFloat(base_fee) * 100;
    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount),
      currency: "INR",
    });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

app.post("/api/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      slot_id,
      slot_name,
      area_name,
      phone,
      license,
      image,
      base_fee,
      deposit,
      duration_minutes
    } = req.body;

    if (!razorpay_payment_id || !slot_id || !phone || !license) {
      return res.status(400).json({ status: "failure", reason: "Missing required fields" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expected = crypto
      .createHmac("sha256", "HeSSWZzf1G9TOp6J13aPbhin")
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.json({ status: "failure", reason: "Signature mismatch" });
    }

    let photo_path = null;
    if (image) {
      try {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const fileName = `plate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
        const filePath = path.join("uploads", fileName);
        fs.writeFileSync(filePath, base64Data, "base64");
        photo_path = filePath;
      } catch (imgError) {
        console.error("Image save error:", imgError);
      }
    }

    const durationMs = duration_minutes * 60 * 1000;

    await db.query(
      `INSERT INTO bookings 
        (slot, slot_id, area_name, phone, license_plate, photo_path, entry_time, duration, payment_status, payment_id, amount, due_amount, deposit, base_fee)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9,$10,$11,$12,$13)`,
      [
        slot_name,
        slot_id,
        area_name,
        phone,
        license,
        photo_path,
        durationMs,
        "paid",
        razorpay_payment_id,
        base_fee,
        0,
        deposit,
        base_fee,
      ]
    );

    await db.query("UPDATE slots SET is_available=false WHERE id=$1", [slot_id]);

    res.json({ status: "success" });
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ status: "failure", error: "Verification error: " + err.message });
  }
});

async function processRefund(paymentId, amount) {
  try {
    if (!paymentId) return { success: false, error: "No payment ID" };
    const refund = await razorpay.payments.refund(paymentId, {
      amount: Math.round(amount * 100),
      speed: "normal",
    });
    return { success: true, refundId: refund.id };
  } catch (error) {
    console.error("Refund failed:", error);
    return { success: false, error: error.error?.description || "Refund failed" };
  }
}

app.post("/api/extend", async (req, res) => {
  try {
    const { license } = req.body;
    const config = await db.query("SELECT * FROM extension_config WHERE id=1");
    const extendFee = config.rows[0]?.extend_fee || 20;
    const extendMinutes = config.rows[0]?.extend_minutes || 30;

    const result = await db.query(
      "SELECT * FROM bookings WHERE license_plate=$1 AND exited_at IS NULL ORDER BY id DESC LIMIT 1",
      [license]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "No active booking found" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(extendFee * 100),
      currency: "INR",
    });

    res.json({ 
      order: order,
      added_minutes: extendMinutes, 
      fee: extendFee,
      booking_id: result.rows[0].id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Extend failed" });
  }
});

app.post("/api/verify-extension", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      booking_id,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expected = crypto
      .createHmac("sha256", "HeSSWZzf1G9TOp6J13aPbhin")
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: "Signature mismatch" });
    }

    const config = await db.query("SELECT * FROM extension_config WHERE id=1");
    const extendMinutes = config.rows[0]?.extend_minutes || 30;
    const extendFee = config.rows[0]?.extend_fee || 20;
    const extMs = extendMinutes * 60 * 1000;

    await db.query(
      "UPDATE bookings SET duration = duration + $1, amount = amount + $2 WHERE id=$3",
      [extMs, extendFee, booking_id]
    );

    res.json({ success: true, message: "Time extended successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Extension verification failed" });
  }
});

app.post("/api/exit", async (req, res) => {
  try {
    const { license } = req.body;
    
    console.log("Exit request for license:", license);

    const result = await db.query(
      "SELECT * FROM bookings WHERE license_plate=$1 AND exited_at IS NULL ORDER BY id DESC LIMIT 1",
      [license]
    );

    if (!result.rows.length) {
      return res.json({ 
        success: false,
        message: "No active booking found", 
        due_amount: 0, 
        refund: 0, 
        deposit: 0,
        refund_status: "none"
      });
    }

    const booking = result.rows[0];
    console.log("Found booking:", booking);
    
    const area = await db.query("SELECT penalty_per_min FROM areas WHERE name = $1", [booking.area_name]);
    const penaltyPerMin = area.rows[0]?.penalty_per_min || 2;

    const entryTime = new Date(booking.entry_time).getTime();
    const durationMs = parseInt(booking.duration);
    const expiryTime = entryTime + durationMs;
    const nowMs = Date.now();

    let penalty = 0;
    let refundAmount = parseFloat(booking.deposit);
    let refundSuccess = false;
    let refundId = null;

    if (nowMs <= expiryTime) {
      console.log("Within time limit - Processing full refund of:", refundAmount);
      const refundResult = await processRefund(booking.payment_id, refundAmount);
      if (refundResult.success) {
        refundSuccess = true;
        refundId = refundResult.refundId;
      }
    } else {
      const extraMinutes = Math.ceil((nowMs - expiryTime) / 60000);
      penalty = extraMinutes * parseFloat(penaltyPerMin);
      refundAmount = Math.max(0, parseFloat(booking.deposit) - penalty);
      
      if (refundAmount > 0) {
        const refundResult = await processRefund(booking.payment_id, refundAmount);
        if (refundResult.success) {
          refundSuccess = true;
          refundId = refundResult.refundId;
        }
      } else {
        refundSuccess = true;
      }
    }

    await db.query(
      `UPDATE bookings SET 
        due_amount=$1, 
        penalty_amount=$2,
        exited_at=NOW(), 
        refund_status=$3,
        refund_id=$4
       WHERE id=$5`,
      [penalty, penalty, refundSuccess ? "completed" : "failed", refundId, booking.id]
    );

    await db.query(
      "UPDATE slots SET is_available=true WHERE id=$1",
      [booking.slot_id]
    );

    res.json({ 
      success: true,
      due_amount: penalty, 
      refund: refundAmount,
      deposit: parseFloat(booking.deposit),
      refund_status: refundSuccess ? "success" : "failed",
      refund_id: refundId,
      slot: booking.slot,
      exited_on_time: nowMs <= expiryTime
    });
  } catch (err) {
    console.error("Exit error:", err);
    res.status(500).json({ error: "Exit failed: " + err.message });
  }
});

app.get("/api/extension-config", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM extension_config WHERE id=1");
    res.json(result.rows[0] || { extend_minutes: 30, extend_fee: 20 });
  } catch (err) {
    res.status(500).json({ error: "Failed to load config" });
  }
});

// ════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ════════════════════════════════════════════════════════════════════════

app.get("/api/admin/areas", adminAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM areas ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch areas" });
  }
});

app.post("/api/admin/areas", adminAuth, async (req, res) => {
  try {
    const { name, base_fee, deposit, duration_minutes, penalty_per_min } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });

    const result = await db.query(
      "INSERT INTO areas (name, base_fee, deposit, duration_minutes, penalty_per_min) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, base_fee, deposit, duration_minutes, penalty_per_min]
    );

    res.json({ success: true, area: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Add area failed" });
  }
});

app.put("/api/admin/areas/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, base_fee, deposit, duration_minutes, penalty_per_min } = req.body;

    await db.query(
      "UPDATE areas SET name=$1, base_fee=$2, deposit=$3, duration_minutes=$4, penalty_per_min=$5 WHERE id=$6",
      [name, base_fee, deposit, duration_minutes, penalty_per_min, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update area failed" });
  }
});

app.delete("/api/admin/areas/:id", adminAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM areas WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete area failed" });
  }
});

app.get("/api/admin/slots", adminAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, a.name as area_name, a.base_fee, a.deposit, a.duration_minutes, a.penalty_per_min 
      FROM slots s 
      JOIN areas a ON s.area_id = a.id 
      ORDER BY s.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

app.patch("/api/admin/slots/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_available } = req.body;

    await db.query("UPDATE slots SET is_available=$1 WHERE id=$2", [is_available, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Toggle failed" });
  }
});

app.post("/api/admin/slots", adminAuth, async (req, res) => {
  try {
    const { name, area_id, area_name } = req.body;
    
    if (!name || !area_id) {
      return res.status(400).json({ error: "Name and Area ID required" });
    }

    const result = await db.query(
      "INSERT INTO slots (name, area_id, area_name, is_available) VALUES ($1, $2, $3, true) RETURNING *",
      [name.toUpperCase(), area_id, area_name]
    );

    res.json({ success: true, slot: result.rows[0] });
  } catch (err) {
    console.error("Add slot error:", err);
    res.status(500).json({ error: "Add slot failed: " + err.message });
  }
});

app.delete("/api/admin/slots/:id", adminAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM slots WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

app.post("/api/admin/extension-config", adminAuth, async (req, res) => {
  try {
    const { extend_minutes, extend_fee } = req.body;
    await db.query(
      "UPDATE extension_config SET extend_minutes=$1, extend_fee=$2 WHERE id=1",
      [extend_minutes, extend_fee]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update config" });
  }
});

app.get("/api/admin/extension-config", adminAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM extension_config WHERE id=1");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to load config" });
  }
});

app.get("/api/admin/reports", adminAuth, async (req, res) => {
  try {
    const { date } = req.query;
    let query = `
      SELECT id, slot, area_name, phone, license_plate,
             entry_time, exited_at, duration,
             payment_status, amount, due_amount, deposit, base_fee, penalty_amount,
             refund_status
      FROM bookings
    `;
    let params = [];
    
    if (date) {
      query += ` WHERE DATE(created_at) = $1 ORDER BY entry_time DESC`;
      params.push(date);
    } else {
      query += ` WHERE DATE(created_at) = CURRENT_DATE ORDER BY entry_time DESC`;
    }
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Report failed" });
  }
});

app.get("/api/admin/penalties", adminAuth, async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        license_plate,
        phone,
        slot,
        area_name,
        entry_time,
        exited_at,
        penalty_amount,
        refund_status
      FROM bookings
      WHERE exited_at IS NOT NULL AND penalty_amount > 0
      ORDER BY penalty_amount DESC
    `;
    
    const result = await db.query(query);
    res.json({
      success: true,
      penalties: result.rows,
      total_penalty: result.rows.reduce((sum, r) => sum + parseFloat(r.penalty_amount || 0), 0),
      count: result.rows.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch penalties" });
  }
});

app.get("/api/admin/reports/summary", adminAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         DATE(created_at) AS date,
         COUNT(*) AS total_bookings,
         COALESCE(SUM(amount), 0) AS total_revenue,
         COALESCE(SUM(penalty_amount), 0) AS total_penalties,
         COALESCE(SUM(deposit), 0) AS total_deposits,
         COUNT(CASE WHEN refund_status = 'completed' THEN 1 END) AS refunds_processed
       FROM bookings
       WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Summary failed" });
  }
});

app.get("/api/admin/active", adminAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, slot, area_name, phone, license_plate, entry_time, duration, amount
       FROM bookings
       WHERE exited_at IS NULL
       ORDER BY entry_time ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Active fetch failed" });
  }
});

// ════════════════════════════════════════════════════════════════════════
//  SERVE FRONTEND
// ════════════════════════════════════════════════════════════════════════

const frontendPath = path.join(__dirname, "../frontend/build");
if (fs.existsSync(frontendPath)) {
  console.log("Serving frontend from:", frontendPath);
  app.use(express.static(frontendPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
} else {
  console.log("Frontend build not found. Run 'npm run build' in frontend directory");
}

// ════════════════════════════════════════════════════════════════════════
//  START SERVER
// ════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`\n Scan & Park Server running → http://localhost:${PORT}`);
  console.log(`   Admin key: ${ADMIN_KEY}`);
  console.log(`   API Health: GET /api/health`);
  console.log(`   OCR Endpoint: POST /api/ocr/detect`);
  console.log(`   OCR Server Status: GET /api/ocr/health`);
  console.log(`\n Make sure Python OCR server is running on port 5002`);
  console.log(`   To start Python OCR: python ocr_server.py`);
  console.log(`\n`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    db.end();
  });
});