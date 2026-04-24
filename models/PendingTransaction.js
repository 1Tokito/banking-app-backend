const mongoose = require("mongoose");

const pendingTransactionSchema = new mongoose.Schema(
  {
    transferType: {
      type: String,
      enum: ["inbank", "international"],
      required: true,
      default: "inbank",
    },

    // ── In-bank fields ──────────────────────────────────────────
    fromAccountNumber: { type: String },
    fromName: { type: String },
    toAccountNumber: { type: String },
    toName: { type: String },

    // ── International fields ────────────────────────────────────
    recipientName: { type: String },
    recipientBank: { type: String },
    recipientAccountOrIBAN: { type: String },
    swiftCode: { type: String },
    recipientCountry: { type: String },
    recipientCurrency: { type: String },

    // ── Shared fields ───────────────────────────────────────────
    amount: { type: Number, required: true, min: 1 },
    description: { type: String, default: "Transfer" },
    status: {
      type: String,
      enum: ["pending", "otp_sent", "completed", "rejected"],
      default: "pending",
    },
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    initiatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PendingTransaction", pendingTransactionSchema);
