const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    firstName:{
        type:String, required:true
    },
    lastName:{
        type:String, required:true

    },
    email: { 
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phoneNumber:{
        type:String, required:true
    },
    password:{
        type:String, required:true
    },
    companyName:{
        type:String, required:false
    },
    location:{
        type:String, required:true
    },
    role:{
        type:String,
        enum:["candidate","company"],
        required:true
    }
},{timestamps:true})

module.exports = mongoose.model("User",userSchema)
