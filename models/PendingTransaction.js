const mongoose = require("mongoose");

const pendingTransactionSchema = new mongoose.Schema(
  {
    fromAccountNumber: { type: String, required: true },
    fromName: { type: String, required: true },
    toAccountNumber: { type: String, required: true },
    toName: { type: String, required: true },
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
