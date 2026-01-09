require("dotenv").config();
console.log("server file is loaded");

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const Report = require("./models/Report");

const app = express();

//---middleware---
app.use(cors({
  origin: "*"
}));

app.use(express.json());

//---server uploaded images----
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


//---mongodb connection--
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected using Mongoose"))
    .catch((err) => console.error("MongoDB Connection error:", err));




const fs = require("fs");

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}


//---muter setup--
const storage  = multer.diskStorage({
    destination:(req, file, cb) => {
        cb(null, "uploads/");
    },
    filename:(req, file, cb) =>{
        const uniqueName = Date.now() + "-" + Math.round(Math.random()*1e9);
        cb(null, uniqueName + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

//AI ruled based analysis
const analyzeImage = (file) =>{
let score = 0;
let reasons = [];

//rule1: high resolution but small size 
if(file.size < 150 * 1024)
{
    score += 1;
    reasons.push("Unusually small file size for the given image.");
}

//rule2: AI-common format
if(file.mimetype === "image/webp"){
    score += 1;
    reasons.push("Image format commanly used by AI tools");
}

//rule3: Auto generated filename pattern
if(file.originalname.length < 10){
    score +=1;
    reasons.push("Generic or Short file name detected");
}

const confidence = Math.min(100, Math.round((score/3) * 100));

if(score >= 2)
{
    return{
        verdict:"Final Result: AI-Generated Image",
        confidence,
        reasons,
    };
} else{
    return{
        verdict: "Final Result : Not AI-Generated Image",
        confidence: 100 - confidence,
        reasons,
    };
}
};


//Admin Auth Middleware

const authAdmin = (req,res,next) => {
    const authHeader = req.headers.authorization;

    if(!authHeader){
        return res.status(403).json({message:"Token Missing"});
    }
    try{
        const token = authHeader.split(" ")[1];
        const decoded =jwt.verify(token, process.env.JWT_SECRET);

        if(decoded.role !== "admin"){
            return res.status(403).json({message:"Unauthorised"});
        }
    

    next();
}catch(err){
   
  return res.status(401).json({message:"Invalid Token"});
}
};
//---Routes
app.get("/", (req,res) => {
    res.send("Spot The Fake Backend is running...");
});

//Admin login
app.post("/api/admin/login",(req,res) => {
    const {email, password} = req.body;
    
    if(email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD){
        return res.status(401).json({message:"Invalid Credentials"});
    }

    const token = jwt.sign(
        {role: "admin", email},
        process.env.JWT_SECRET,
        {expiresIn:"2h"}
    );
    res.json({ token});
})


//upload & analyze image
app.post("/api/upload", upload.single("image"), async(req, res) => {
    try{
        console.log("Upload Api hit");
        console.log(req.file);
    if(!req.file)
    {
        return res.status(400).json({message: "No Image Uploaded"});
    }


    const analysisResult = analyzeImage(req.file);

    const report = new Report({
        imageName: req.file.originalname,
        imageSize: req.file.size,
        imageType:req.file.mimetype,
        imagePath:req.file.filename,
        verdict:analysisResult.verdict,
        confidence:analysisResult.confidence,
        reasons:analysisResult.reasons,
    });

     await report.save();

    res.json({
        message:"Image analyzed and save sucessfully",
        result: analysisResult,
    });
} catch(error){
    console.error("Detection Error:", error);
    res.status(500).json({message: error.message});
}
});


app.get("/api/reports", authAdmin, async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error("Fetch reports error:", error);
    res.status(500).json({ message: "Failed to fetch reports" });
  }

 });

   
//----server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>{
    console.log(`server is running on http://localhost:${PORT}`);
});