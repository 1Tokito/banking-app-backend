const express = require("express");
const router = express.Router();
const User = require("../models/User");
const RegistrationRequest = require("../models/RegistrationRequest");

// Helper: generate unique 10-digit account number
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

// ── Registration Requests ────────────────────────────────────────────────────

// GET /admin/registration-requests — Admin views all registration requests
router.get("/admin/registration-requests", async (req, res) => {
  try {
    const requests = await RegistrationRequest.find().sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /admin/approve-registration — Admin approves a request and creates the user
router.post("/admin/approve-registration", async (req, res) => {
  try {
    const { requestId, pin, country, currency, initialBalance } = req.body;

    if (!requestId || !pin || !country || !currency) {
      return res.status(400).json({ error: "Request ID, PIN, country, and currency are required" });
    }

    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: "PIN must be 4 to 6 digits" });
    }

    const request = await RegistrationRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: "Registration request not found" });
    if (request.status !== "pending") {
      return res.status(400).json({ error: "This request has already been processed" });
    }

    // Check gmail not already taken
    const existingUser = await User.findOne({ gmail: request.gmail });
    if (existingUser) {
      return res.status(400).json({ error: "An account with this Gmail already exists" });
    }

    const accountNumber = await generateAccountNumber();
    const balance = parseFloat(initialBalance) || 0;

    const user = new User({
      fullName: request.fullName,
      gmail: request.gmail,
      password: request.password,
      pin,
      accountNumber,
      country,
      currency,
      balance,
      transactions:
        balance > 0
          ? [{ type: "credit", amount: balance, description: "Initial deposit" }]
          : [],
    });

    await user.save();

    request.status = "approved";
    await request.save();

    res.status(201).json({
      message: "Registration approved and account created",
      user: {
        fullName: user.fullName,
        gmail: user.gmail,
        accountNumber: user.accountNumber,
        pin,
        country: user.country,
        currency: user.currency,
        balance: user.balance,
      },
    });
  } catch (err) {
    console.error("Approve registration error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// POST /admin/deny-registration — Admin denies a request
router.post("/admin/deny-registration", async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: "Request ID is required" });

    const request = await RegistrationRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: "Registration request not found" });
    if (request.status !== "pending") {
      return res.status(400).json({ error: "This request has already been processed" });
    }

    request.status = "denied";
    request.deniedAt = new Date();
    await request.save();

    res.json({ message: "Registration request denied" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /admin/registration-requests/:id — Admin deletes a denied request
router.delete("/admin/registration-requests/:id", async (req, res) => {
  try {
    const request = await RegistrationRequest.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    res.json({ message: "Request deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── Manual Registration (admin creates user directly) ─────────────────────────

// POST /register — Admin manually registers a user
router.post("/register", async (req, res) => {
  try {
    const { fullName, gmail, password, pin, country, currency, initialBalance } = req.body;

    if (!fullName || !gmail || !password || !pin || !country || !currency) {
      return res.status(400).json({ error: "All fields except initial balance are required" });
    }

    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: "PIN must be 4 to 6 digits" });
    }

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
      country,
      currency,
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
        pin,
        country: user.country,
        currency: user.currency,
        balance: user.balance,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// ── Users ─────────────────────────────────────────────────────────────────────

// GET /users — Admin views all users (full details including password and pin)
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /dashboard/:accountNumber
router.get("/dashboard/:accountNumber", async (req, res) => {
  try {
    const user = await User.findOne(
      { accountNumber: req.params.accountNumber, isActive: true },
      "-pin -password"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      fullName: user.fullName,
      gmail: user.gmail,
      accountNumber: user.accountNumber,
      balance: user.balance,
      country: user.country,
      currency: user.currency,
      transactions: user.transactions.slice(-20).reverse(),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /users/:accountNumber — Admin deletes a user account
router.delete("/users/:accountNumber", async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ accountNumber: req.params.accountNumber });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: `Account for ${user.fullName} deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
