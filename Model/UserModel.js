const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: true,
      unique: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },

 // Professional position of the registered company user.
//
// Examples:
// - HR Manager
// - Recruitment Consultant
// - Managing Director
//
// This can be completed later in Profile Settings.
// It becomes mandatory when publishing a JD.
companyPosition: {
  type: String,
  trim: true,
  maxlength: 120,
  default: "",
},

    location: {
      city: {
        type: String,
        trim: true,
        default: "",
      },

      country: {
        type: String,
        trim: true,
        default: "",
      },
    },

role: {
  type: String,
  enum: ["candidate", "company"],
  required: true,
},

// Controls whether the candidate appears in
// recruiter/company candidate recommendations.
availableForWork: {
  type: Boolean,
  default: function () {
    return this.role === "candidate";
  },
},

    otp: {
  type: String,
  default: null,
},

otpResendAvailableAt: {
  type: Date,
  default: null,
},

otpAttempts: {
  type: Number,
  default: 0,
},

    otpExpiry: Date,
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({
  companyId: 1,
});

module.exports = mongoose.model(
  "User", userSchema
);