const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {

    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    companyDescription: {
      type: String,
      default: "",
      trim: true,
    },

    companyUrl: {
      type: String,
      default: "",
      trim: true,
    },


companySize: {
  type: String,
  enum: [
    "1-10",
    "11-50",
    "51-200",
    "201-500",
    "500+",
  ],
  default: "",
},


companyType: {
  type: String,
  enum: [
    "direct-employer",
    "agency",
    "non-profit",
  ],
  default: "",
},

    location: {
      city: {
        type: String,
        required: true,
        trim: true,
      },

      country: {
        type: String,
        required: true,
        trim: true,
      },
    },


    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Company",
  companySchema
);


/*
 * COMPANY REGISTRATION FLOW
 *
 * Company user signs up
 *        ↓
 * Create User
 *        ↓
 * Create Company
 *        ↓
 * Company.createdBy = User._id
 *        ↓
 * User.companyId = Company._id
 *        ↓
 * User.companyRole = "company_admin"
 *
 *
 * Example:
 *
 * Alice registers "ABC Recruitment Ltd"
 *
 * Company:
 * _id: COMPANY_1
 * companyName: ABC Recruitment Ltd
 * createdBy: ALICE_USER_ID
 *
 * Alice:
 * role: company
 * companyId: COMPANY_1
 * companyRole: company_admin
 */