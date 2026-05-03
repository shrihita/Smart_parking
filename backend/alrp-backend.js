const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");
const { createWorker } = require("tesseract.js");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

// Create required folders
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("public")) fs.mkdirSync("public");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Enhanced ALPR System
class ImprovedALPR {
  constructor() {
    this.worker = null;
    this.ready = false;
  }

  async init() {
    if (!this.worker) {
      console.log("🚀 Initializing ALPR Engine...");
      this.worker = await createWorker("eng");
      await this.worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        tessedit_pageseg_mode: "7", // Treat image as a single text line
        preserve_interword_spaces: "0",
      });
      this.ready = true;
      console.log("✅ ALPR Engine Ready!");
    }
    return this.worker;
  }

  async detectPlate(imagePath) {
    try {
      const worker = await this.init();
      
      // First attempt: Direct recognition
      const { data: result1 } = await worker.recognize(imagePath);
      let text = result1.text.toUpperCase().replace(/[^A-Z0-9]/g, "");
      
      // Extract plates
      let plates = this.extractPlates(text);
      
      // If no plate found, try preprocessing
      if (plates.length === 0) {
        const preprocessed = await this.preprocessImage(imagePath);
        if (preprocessed) {
          const { data: result2 } = await worker.recognize(preprocessed);
          text = result2.text.toUpperCase().replace(/[^A-Z0-9]/g, "");
          plates = this.extractPlates(text);
        }
      }
      
      return {
        success: plates.length > 0,
        plate: plates[0] || null,
        all_plates: plates,
        confidence: plates.length > 0 ? 85 : 0,
        raw_text: text
      };
    } catch (error) {
      console.error("Detection error:", error);
      return { success: false, error: error.message };
    }
  }

  async preprocessImage(imagePath) {
    // For better detection, you'd implement image preprocessing here
    // e.g., increase contrast, convert to grayscale, etc.
    return imagePath; // Return original for now
  }

  extractPlates(text) {
    const patterns = [
      /[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}/,  // MH12AB1234
      /[A-Z]{2}[0-9]{2}[A-Z]{1}[0-9]{4}/,   // MH12A1234
      /[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}/,   // MH12AB123
      /[A-Z]{1}[0-9]{2}[A-Z]{2}[0-9]{4}/,   // M12AB1234
      /[A-Z]{2}[0-9]{2}[A-Z]{1}[0-9]{3}/,   // MH12A123
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return [match[0]];
    }
    
    // Fallback: return any 8-10 character alphanumeric string
    const fallback = text.match(/[A-Z0-9]{8,10}/);
    return fallback ? [fallback[0]] : [];
  }
}

const alpr = new ImprovedALPR();

// API Routes
app.post("/api/alpr/detect", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }
    
    const result = await alpr.detectPlate(req.file.path);
    
    // Clean up
    fs.unlinkSync(req.file.path);
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/alpr/detect-base64", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }
    
    // Save base64 to temp file
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const filename = Date.now() + ".jpg";
    const filepath = path.join("uploads", filename);
    fs.writeFileSync(filepath, base64Data, "base64");
    
    const result = await alpr.detectPlate(filepath);
    
    // Clean up
    fs.unlinkSync(filepath);
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/alpr/status", (req, res) => {
  res.json({ 
    status: "online", 
    engine_ready: alpr.ready,
    version: "2.0"
  });
});

// Initialize and start server
alpr.init().then(() => {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`\n🚗 ALPR Server running on http://localhost:${PORT}`);
    console.log(`   Test with: curl http://localhost:${PORT}/api/alpr/status\n`);
  });
}).catch(console.error);