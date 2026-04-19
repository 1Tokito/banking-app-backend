const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ["credit", "debit"], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now },
  reference: { type: String },
});

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    gmail: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    pin: { type: String, required: true, match: /^\d{4,6}$/ },
    accountNumber: { type: String, required: true, unique: true, match: /^\d{10}$/ },
    balance: { type: Number, default: 0, min: 0 },
    transactions: [transactionSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
