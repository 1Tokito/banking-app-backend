const mongoose = require("mongoose");

const registrationRequestSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    gmail: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending",
    },
    deniedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RegistrationRequest", registrationRequestSchema);
