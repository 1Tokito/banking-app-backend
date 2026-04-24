const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Admin = require("../models/Admin");
const RegistrationRequest = require("../models/RegistrationRequest");

// POST /register-request — User submits registration request
router.post("/register-request", async (req, res) => {
  try {
    const { fullName, gmail, password } = req.body;

    if (!fullName || !gmail || !password) {
      return res.status(400).json({ error: "Full name, Gmail, and password are required" });
    }

    // Check if gmail already in use by a real user
    const existingUser = await User.findOne({ gmail: gmail.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: "An account with this Gmail already exists" });
    }

    // Check if there's already a pending request for this gmail
    const existingReq = await RegistrationRequest.findOne({
      gmail: gmail.toLowerCase(),
      status: "pending",
    });
    if (existingReq) {
      return res.status(400).json({ error: "A registration request for this Gmail is already pending" });
    }

    const request = new RegistrationRequest({
      fullName,
      gmail: gmail.toLowerCase(),
      password,
    });

    await request.save();

    res.status(201).json({
      message: "Registration request submitted. Please wait for admin approval.",
    });
  } catch (err) {
    console.error("Register request error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /login — Step 1: Gmail + password
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

// POST /verify-pin — Step 2: PIN check
router.post("/verify-pin", async (req, res) => {
  try {
    const { accountNumber, pin } = req.body;

    if (!accountNumber || !pin) {
      return res.status(400).json({ error: "Account number and PIN are required" });
    }

    const user = await User.findOne({ accountNumber, isActive: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.pin !== pin) return res.status(401).json({ error: "Invalid PIN" });

    res.json({
      message: "PIN verified. Welcome!",
      user: {
        fullName: user.fullName,
        accountNumber: user.accountNumber,
        gmail: user.gmail,
        balance: user.balance,
        country: user.country,
        currency: user.currency,
      },
    });
  } catch (err) {
    console.error("Verify PIN error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /admin/login
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
