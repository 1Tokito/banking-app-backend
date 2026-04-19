const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Admin = require("../models/Admin");

// POST /login — User login with accountNumber + passcode
router.post("/login", async (req, res) => {
  try {
    const { accountNumber, passcode } = req.body;

    if (!accountNumber || !passcode) {
      return res.status(400).json({ error: "Account number and passcode are required" });
    }

    const user = await User.findOne({ accountNumber, isActive: true });
    if (!user) {
      return res.status(401).json({ error: "Invalid account number or passcode" });
    }

    if (user.passcode !== passcode) {
      return res.status(401).json({ error: "Invalid account number or passcode" });
    }

    res.json({
      message: "Login successful",
      user: {
        fullName: user.fullName,
        accountNumber: user.accountNumber,
        balance: user.balance,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
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
