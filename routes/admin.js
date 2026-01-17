const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");

const router = express.Router();

/* ======================
   ADMIN LOGIN
====================== */
router.post("/login", async (req, res) => {
  try {
    console.log("LOGIN BODY:", req.body); // 🔍 DEBUG (important)

    const { email, password } = req.body;

    // BODY VALIDATION
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // FIND ADMIN
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid email" });
    }

    // PASSWORD CHECK
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // TOKEN
    const token = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({ token });
  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
