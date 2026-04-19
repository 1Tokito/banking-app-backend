const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Helper: generate a random 10-digit account number
const generateAccountNumber = async () => {
  let accountNumber;
  let attempts = 0;
  do {
    accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    attempts++;
    if (attempts > 10) throw new Error("Could not generate unique account number");
  } while (await User.findOne({ accountNumber }));
  return accountNumber;
};

// POST /register — Admin registers a new user
router.post("/register", async (req, res) => {
  try {
    const { fullName, gmail, password, pin, initialBalance } = req.body;

    if (!fullName || !gmail || !password || !pin) {
      return res.status(400).json({ error: "Full name, Gmail, password, and PIN are required" });
    }

    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: "PIN must be 4 to 6 digits" });
    }

    // Check Gmail is unique
    const existing = await User.findOne({ gmail: gmail.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: "A user with this Gmail already exists" });
    }

    const accountNumber = await generateAccountNumber();
    const balance = parseFloat(initialBalance) || 0;

    const user = new User({
      fullName,
      gmail: gmail.toLowerCase(),
      password,
      pin,
      accountNumber,
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
        gmail: user.gmail,
        accountNumber: user.accountNumber,
        balance: user.balance,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// GET /users — Admin views all users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "-pin -password").sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /dashboard/:accountNumber — User fetches their dashboard
router.get("/dashboard/:accountNumber", async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const user = await User.findOne(
      { accountNumber, isActive: true },
      "-pin -password"
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      fullName: user.fullName,
      gmail: user.gmail,
      accountNumber: user.accountNumber,
      balance: user.balance,
      transactions: user.transactions.slice(-20).reverse(),
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /users/:accountNumber — Admin deletes a user account
router.delete("/users/:accountNumber", async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const user = await User.findOneAndDelete({ accountNumber });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: `Account for ${user.fullName} deleted successfully` });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
