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


    companyRole: {
      type: String,
      enum: [
        "company_admin",
        "recruiter",
        "hiring_manager",
      ],
      default: null,
    },


    companyName: {
      type: String,
      required: false,
    },

    companyDescription: {
      type: String,
      required: false,
    },

    location: {
      city: {
        type: String,
        required: true,
      },

      country: {
        type: String,
        required: true,
      },
    },

    role: {
      type: String,
      enum: ["candidate", "company"],
      required: true,
    },


    availableForWork: {
      type: Boolean,

      default: function () {
        return this.role === "candidate";
      },
    },

    otp: String,

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

module.exports = mongoose.model(
  "User",
  userSchema
);