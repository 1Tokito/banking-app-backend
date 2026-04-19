const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Helper: generate a random 10-digit account number
const generateAccountNumber = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// Helper: generate a random 4-digit passcode
const generatePasscode = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// POST /register — Admin registers a new user
router.post("/register", async (req, res) => {
  try {
    const { fullName, initialBalance, pin } = req.body;

    if (!fullName || !pin) {
      return res.status(400).json({ error: "Full name and PIN are required" });
    }

    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: "PIN must be exactly 4 digits" });
    }

    // Generate unique account number
    let accountNumber;
    let attempts = 0;
    do {
      accountNumber = generateAccountNumber();
      attempts++;
      if (attempts > 10) {
        return res.status(500).json({ error: "Could not generate unique account number" });
      }
    } while (await User.findOne({ accountNumber }));

    const passcode = generatePasscode();
    const balance = parseFloat(initialBalance) || 0;

    const user = new User({
      fullName,
      accountNumber,
      passcode,
      pin,
      balance,
      transactions:
        balance > 0
          ? [{ type: "credit", amount: balance, description: "Initial deposit" }]
          : [],
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user: {
        fullName: user.fullName,
        accountNumber: user.accountNumber,
        passcode, // returned once so admin can share it with user
        balance: user.balance,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /users — Admin views all users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "-otp -otpExpiry").sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /dashboard — User fetches their dashboard (balance + transactions)
router.get("/dashboard/:accountNumber", async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const user = await User.findOne({ accountNumber, isActive: true }, "-otp -otpExpiry -pin -passcode");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      fullName: user.fullName,
      accountNumber: user.accountNumber,
      balance: user.balance,
      transactions: user.transactions.slice(-20).reverse(), // last 20, newest first
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
