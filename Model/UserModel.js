const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    //1,2,3.....
    userId:{
        type:Number,
        required:true,
        unique:true
    },
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
    location: {
  city: { type: String, required: true },
  country: { type: String, required: true },
  //status update by ourside - admin system
//   status:{ type: String, 
//     required: true , default:"Not Applied"},
},
    role:{
        type:String,
        enum:["candidate","company"],
        required:true
    },
    otp: String,
    otpExpiry: Date,
    // isVerified: { type: Boolean, default: false }
},{timestamps:true})

module.exports = mongoose.model("User",userSchema)
