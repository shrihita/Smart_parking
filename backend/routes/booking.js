const express = require('express');
const router = express.Router();
const pool = require('../db');

// Fetch owner details by plate
router.get('/owner/:plate', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM owners WHERE plate = 50", [req.params.plate]);
    if (result.rows.length > 0) {
      res.json({ success: true, owner: result.rows[0] });
    } else {
      res.json({ success: false, message: "Plate not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Add new owner when scanned
router.post('/owner', async (req, res) => {
  const { plate, name, phone, email, address } = req.body;
  try {
    await pool.query(
      "INSERT INTO owners (plate, name, phone, email, address) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (plate) DO NOTHING",
      [plate, name, phone, email, address]
    );
    res.json({ success: true, message: "Owner added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;