const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Admin = require("../models/Admin");

// POST /login — Step 1: User logs in with Gmail + password
router.post("/login", async (req, res) => {
  try {
    const { gmail, password } = req.body;

    if (!gmail || !password) {
      return res.status(400).json({ error: "Gmail and password are required" });
    }

    const user = await User.findOne({ gmail: gmail.toLowerCase(), isActive: true });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid Gmail or password" });
    }

    res.json({
      message: "Credentials verified. Please enter your PIN.",
      user: {
        fullName: user.fullName,
        accountNumber: user.accountNumber,
        gmail: user.gmail,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /verify-pin — Step 2: User verifies PIN to reach dashboard
router.post("/verify-pin", async (req, res) => {
  try {
    const { accountNumber, pin } = req.body;

    if (!accountNumber || !pin) {
      return res.status(400).json({ error: "Account number and PIN are required" });
    }

    const user = await User.findOne({ accountNumber, isActive: true });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.pin !== pin) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    res.json({
      message: "PIN verified. Welcome!",
      user: {
        fullName: user.fullName,
        accountNumber: user.accountNumber,
        gmail: user.gmail,
        balance: user.balance,
      },
    });
  } catch (err) {
    console.error("Verify PIN error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /admin/login — Admin login
router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const admin = await Admin.findOne({ username });
    if (!admin || admin.password !== password) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    res.json({ message: "Admin login successful", username: admin.username });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
