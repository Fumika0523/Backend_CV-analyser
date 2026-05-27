const mongoose = require("mongoose")

const skillSchema = new mongoose.Schema(
    {
        candidateId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User",
            required:true
        },

        skills:{
            type:[String],
            default:[],
        }
    }
)

module.exports = mongoose.model("Skill", skillSchema)