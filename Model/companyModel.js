const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    /*
     * The organisation itself.
     *
     * Example:
     * "ABC Recruitment Ltd"
     */
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    /*
     * Description belongs to the COMPANY,
     * not to an individual recruiter.
     */
    companyDescription: {
      type: String,
      default: "",
      trim: true,
    },

    /*
     * Main company website.
     *
     * This can later be displayed on the
     * public company profile.
     */
    companyUrl: {
      type: String,
      default: "",
      trim: true,
    },

    /*
     * Company's main office / HQ location.
     *
     * IMPORTANT:
     * This is NOT necessarily the same
     * as Job.location.
     *
     * Example:
     * Company = London
     * Job = Manchester
     */
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

    /*
     * The user who originally registered
     * this company on SkillfulJobs.ai.
     *
     * Example:
     * Alice creates ABC Recruitment.
     *
     * createdBy = Alice's User._id
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /*
     * Allows the platform to disable a company
     * later without deleting its data.
     */
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