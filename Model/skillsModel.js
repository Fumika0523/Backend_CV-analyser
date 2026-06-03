const mongoose = require("mongoose")

const skillSchema = new mongoose.Schema(
    {
        // After signup, you can link this to user's numeric candidateId
          candidateId: {
      type: Number,
      default: null,
    },

    userMongoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
        // Before signup, this connects skills to the guest browser session
        guestSessionId:{
            type:String,
            required:false,
            default:null,
        },
        // Skills from each uploaded CV
        skills:{
            type:[String],
            default:[],
        }
    }
)

module.exports = mongoose.model("Skill", skillSchema)