require("dotenv").config();
console.log("server file is loaded");

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const adminRoutes = require("./routes/admin");
const Report = require("./models/Report");

const app = express();

/* =====================
   MIDDLEWARE
===================== */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* =====================
   STATIC FILES
===================== */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =====================
   MONGODB
===================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected using Mongoose"))
  .catch((err) => console.error("MongoDB Connection error:", err));

/* =====================
   UPLOADS FOLDER
===================== */
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

/* =====================
   MULTER
===================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* =====================
   IMAGE ANALYSIS
===================== */
const analyzeImage = (file) => {
  let score = 0;
  let reasons = [];

  if (file.size < 150 * 1024) {
    score++;
    reasons.push("Unusually small file size for the given image.");
  }

  if (file.mimetype === "image/webp") {
    score++;
    reasons.push("Image format commonly used by AI tools");
  }

  if (file.originalname.length < 10) {
    score++;
    reasons.push("Generic or short file name detected");
  }

  const confidence = Math.min(100, Math.round((score / 3) * 100));

  return score >= 2
    ? { verdict: "Final Result: AI-Generated Image", confidence, reasons }
    : { verdict: "Final Result: Not AI-Generated Image", confidence: 100 - confidence, reasons };
};

/* =====================
   ADMIN AUTH MIDDLEWARE
===================== */
const authAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Token Missing" });

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.adminId = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

/* =====================
   ROUTES
===================== */
app.get("/", (req, res) => {
  res.send("Spot The Fake Backend is running...");
});

app.use("/api/admin", adminRoutes);

app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No Image Uploaded" });

    const analysisResult = analyzeImage(req.file);

    const report = new Report({
      imageName: req.file.originalname,
      imageSize: req.file.size,
      imageType: req.file.mimetype,
      imagePath: req.file.filename,
      verdict: analysisResult.verdict,
      confidence: analysisResult.confidence,
      reasons: analysisResult.reasons,
    });

    await report.save();
    res.json({ message: "Image analyzed and saved successfully", result: analysisResult });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/admin/reports", authAdmin, async (req, res) => {
  const reports = await Report.find().sort({ createdAt: -1 });
  res.json(reports);
});

app.get("/healthz", (req, res) => res.send("OK"));

/* =====================
   SERVER START
===================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
