const mongoose = require("mongoose");   
const reportSchema = new mongoose.Schema({
    imageName:{
        type: String,
        required: true,
    },
   imageType: String,
    
    imageSize:Number,

    imagePath:{
        type:String,
        required:true,
    },

    verdict: {
        type: String,
        required: true,
    },
    confidence:{
        type:Number,
        required:true,
    },
    reasons:[String],
    
createdAt:{
    type:Date,
    default:Date.now,
},
}
);

module.exports = mongoose.model("Report", reportSchema);