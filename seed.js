/**
 * seed.js — Run once to create the default admin account in MongoDB.
 * Usage: node seed.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("./models/Admin");
const connectDB = require("./db");

(async () => {
  await connectDB();

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  const existing = await Admin.findOne({ username });
  if (existing) {
    console.log(`Admin "${username}" already exists. Nothing to do.`);
  } else {
    await Admin.create({ username, password });
    console.log(`Admin created — username: ${username}, password: ${password}`);
  }

  await mongoose.disconnect();
  process.exit(0);
})();
