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

    companyPosition: {
      type: String,
      trim: true,
      default: "",
      required: function () {
        return this.role === "company";
      },
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

userSchema.index(
  {
    companyId: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      companyId: {
        $type: "objectId",
      },
    },
  }
);

module.exports = mongoose.model(
  "User", userSchema
);