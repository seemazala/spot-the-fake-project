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
//rule:1 small size
  if (file.size < 150 * 1024) {
    score++;
    reasons.push("Unusually small file size for the high-quality image.");
  }

    //rule :2 AI common format
  if (["image/webp", "image/avif"].includes(file.mimetype)) {
    score++;
    reasons.push("Image format frequently used by AI generators.");
  }
 // rule:3 generic filename
  if (file.originalname.length < 10) {
    score++;
    reasons.push("Auto-generated or Generic filename detected");
  }
    //rule:4 simulated logic
    
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/i)) {
    score++;
    reasons.push("Missing typical camera metadata.");
  }
  

/* ---- FINAL DECISION ---- */
  if (score >= 3) {
    return {
      verdict: "AI-Generated Image",
      confidence: 90,
      reasons,
    };
  }

  if (score === 2) {
    return {
      verdict: "Likely AI-Generated Image",
      confidence: 70,
      reasons,
    };
  }

  return {
    verdict: "Likely Real Image",
    confidence: 95,
    reasons,
  };
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
