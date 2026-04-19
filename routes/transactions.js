const express = require("express");
const router = express.Router();
const User = require("../models/User");
const PendingTransaction = require("../models/PendingTransaction");

// Helper: generate a 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper: OTP expiry — 10 minutes
const otpExpiry = () => new Date(Date.now() + 10 * 60 * 1000);

// ─── USER ROUTES ─────────────────────────────────────────────────────────────

// POST /transfer — User initiates a transfer (no PIN required, just account details)
router.post("/transfer", async (req, res) => {
  try {
    const { fromAccountNumber, toAccountNumber, amount, description } = req.body;

    if (!fromAccountNumber || !toAccountNumber || !amount) {
      return res.status(400).json({ error: "From account, to account, and amount are required" });
    }

    if (fromAccountNumber === toAccountNumber) {
      return res.status(400).json({ error: "Cannot transfer to own account" });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const sender = await User.findOne({ accountNumber: fromAccountNumber, isActive: true });
    if (!sender) return res.status(404).json({ error: "Sender account not found" });

    if (sender.balance < numAmount) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    const recipient = await User.findOne({ accountNumber: toAccountNumber, isActive: true });
    if (!recipient) return res.status(404).json({ error: "Recipient account not found" });

    const pending = new PendingTransaction({
      fromAccountNumber: sender.accountNumber,
      fromName: sender.fullName,
      toAccountNumber: recipient.accountNumber,
      toName: recipient.fullName,
      amount: numAmount,
      description: description || "Transfer",
    });

    await pending.save();

    res.status(201).json({
      message: "Transfer request submitted. Awaiting admin approval and OTP.",
      transactionId: pending._id,
    });
  } catch (err) {
    console.error("Transfer error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /confirm-otp — User confirms transfer with OTP from admin
router.post("/confirm-otp", async (req, res) => {
  try {
    const { transactionId, otp, accountNumber } = req.body;

    if (!transactionId || !otp || !accountNumber) {
      return res.status(400).json({ error: "Transaction ID, OTP, and account number are required" });
    }

    const pending = await PendingTransaction.findById(transactionId);
    if (!pending) return res.status(404).json({ error: "Transaction not found" });

    if (pending.fromAccountNumber !== accountNumber) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (pending.status !== "otp_sent") {
      return res.status(400).json({ error: "Transaction is not awaiting OTP confirmation" });
    }

    if (pending.otp !== otp) return res.status(401).json({ error: "Invalid OTP" });

    if (new Date() > pending.otpExpiry) {
      pending.status = "pending";
      await pending.save();
      return res.status(401).json({ error: "OTP has expired. Ask admin to resend." });
    }

    const sender = await User.findOne({ accountNumber: pending.fromAccountNumber });
    const recipient = await User.findOne({ accountNumber: pending.toAccountNumber });

    if (!sender || !recipient) {
      return res.status(404).json({ error: "Account not found during execution" });
    }

    if (sender.balance < pending.amount) {
      pending.status = "rejected";
      await pending.save();
      return res.status(400).json({ error: "Insufficient funds at time of confirmation" });
    }

    const ref = `TXN${Date.now()}`;

    sender.balance -= pending.amount;
    sender.transactions.push({
      type: "debit",
      amount: pending.amount,
      description: `Transfer to ${recipient.fullName} (${recipient.accountNumber}) — ${pending.description}`,
      reference: ref,
    });
    await sender.save();

    recipient.balance += pending.amount;
    recipient.transactions.push({
      type: "credit",
      amount: pending.amount,
      description: `Transfer from ${sender.fullName} (${sender.accountNumber}) — ${pending.description}`,
      reference: ref,
    });
    await recipient.save();

    pending.status = "completed";
    pending.completedAt = new Date();
    pending.otp = null;
    await pending.save();

    res.json({
      message: "Transfer completed successfully",
      reference: ref,
      newBalance: sender.balance,
    });
  } catch (err) {
    console.error("Confirm OTP error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// POST /admin/send — Admin sends money directly to a user
router.post("/admin/send", async (req, res) => {
  try {
    const { toAccountNumber, amount, description } = req.body;

    if (!toAccountNumber || !amount) {
      return res.status(400).json({ error: "Account number and amount are required" });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const user = await User.findOne({ accountNumber: toAccountNumber, isActive: true });
    if (!user) return res.status(404).json({ error: "Account not found" });

    const ref = `ADMIN${Date.now()}`;
    user.balance += numAmount;
    user.transactions.push({
      type: "credit",
      amount: numAmount,
      description: description || "Credit from admin",
      reference: ref,
    });
    await user.save();

    res.json({
      message: `₦${numAmount.toLocaleString()} sent to ${user.fullName}`,
      newBalance: user.balance,
      reference: ref,
    });
  } catch (err) {
    console.error("Admin send error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /admin/pending — Admin views pending transactions
router.get("/admin/pending", async (req, res) => {
  try {
    const pending = await PendingTransaction.find({
      status: { $in: ["pending", "otp_sent"] },
    }).sort({ initiatedAt: -1 });
    res.json({ pendingTransactions: pending });
  } catch (err) {
    console.error("Get pending error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /generate-otp — Admin approves transaction and generates OTP
router.post("/generate-otp", async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ error: "Transaction ID is required" });

    const pending = await PendingTransaction.findById(transactionId);
    if (!pending) return res.status(404).json({ error: "Transaction not found" });

    if (!["pending", "otp_sent"].includes(pending.status)) {
      return res.status(400).json({ error: "Transaction cannot be approved in its current state" });
    }

    const sender = await User.findOne({ accountNumber: pending.fromAccountNumber });
    if (!sender || sender.balance < pending.amount) {
      pending.status = "rejected";
      await pending.save();
      return res.status(400).json({ error: "Sender has insufficient funds. Transaction rejected." });
    }

    const otp = generateOTP();
    pending.otp = otp;
    pending.otpExpiry = otpExpiry();
    pending.status = "otp_sent";
    await pending.save();

    res.json({
      message: "OTP generated. Share this with the user to confirm their transfer.",
      otp,
      transactionId: pending._id,
      expiresIn: "10 minutes",
      transaction: {
        from: `${pending.fromName} (${pending.fromAccountNumber})`,
        to: `${pending.toName} (${pending.toAccountNumber})`,
        amount: pending.amount,
      },
    });
  } catch (err) {
    console.error("Generate OTP error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /approve — Alias for generate-otp
router.post("/approve", async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ error: "Transaction ID is required" });

    const pending = await PendingTransaction.findById(transactionId);
    if (!pending) return res.status(404).json({ error: "Transaction not found" });

    if (!["pending", "otp_sent"].includes(pending.status)) {
      return res.status(400).json({ error: "Transaction already processed" });
    }

    const sender = await User.findOne({ accountNumber: pending.fromAccountNumber });
    if (!sender || sender.balance < pending.amount) {
      pending.status = "rejected";
      await pending.save();
      return res.status(400).json({ error: "Insufficient funds. Transaction rejected." });
    }

    const otp = generateOTP();
    pending.otp = otp;
    pending.otpExpiry = otpExpiry();
    pending.status = "otp_sent";
    await pending.save();

    res.json({
      message: "Transaction approved. OTP generated.",
      otp,
      transactionId: pending._id,
      expiresIn: "10 minutes",
    });
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /admin/reject — Admin rejects a pending transaction
router.post("/admin/reject", async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ error: "Transaction ID is required" });

    const pending = await PendingTransaction.findById(transactionId);
    if (!pending) return res.status(404).json({ error: "Transaction not found" });

    if (!["pending", "otp_sent"].includes(pending.status)) {
      return res.status(400).json({ error: "Transaction already processed" });
    }

    pending.status = "rejected";
    await pending.save();

    res.json({ message: "Transaction rejected successfully" });
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /admin/transactions — Admin views all transactions
router.get("/admin/transactions", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const transactions = await PendingTransaction.find(filter).sort({ initiatedAt: -1 });
    res.json({ transactions });
  } catch (err) {
    console.error("Admin transactions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
