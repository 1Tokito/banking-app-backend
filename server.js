require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const transactionRoutes = require("./routes/transactions");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB();

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/", authRoutes);
app.use("/", userRoutes);
app.use("/", transactionRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Banking API running on port ${PORT}`);
});
