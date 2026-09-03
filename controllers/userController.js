const User = require('../Model/UserModel')
const jwt = require("jsonwebtoken");
const Company = require("../Model/companyModel");


// ======================================================
// GET USER PROFILE
// ======================================================

exports.getUser = async (req, res) => {
  try {

    const authHeader =
      req.header("Authorization");

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        message:
          "Authorization header is missing or invalid",
      });
    }

    const token =
      authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY
    );
 
    const user =
      await User.findById(
        decoded.id
      )
        .select(
          "-password -otp -otpExpiry"
        )

        .populate(
          "companyId",
          `
            companyName
            companyDescription
            companyUrl
            companySize
            companyType
            location
            isActive
            createdBy
          `
        );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }


    return res.status(200).json({
      message:
        "User fetched successfully",

      user,
    });
  } catch (error) {
    console.error(
      "getUser error:",
      error
    );

    if (
      error.name ===
        "TokenExpiredError" ||
      error.name ===
        "JsonWebTokenError"
    ) {
      return res.status(401).json({
        message:
          "Invalid or expired token",
      });
    }

    return res.status(500).json({
      message:
        "Failed to fetch user profile",
    });
  }
};


// ======================================================
// UPDATE USER PROFILE
// ======================================================

exports.updateUserProfile = async (
  req,
  res
) => {
  //try {
    // --------------------------------------------------
    // 1. CHECK AUTH HEADER
    // --------------------------------------------------

    const authHeader =
      req.header("Authorization");

    if (
      !authHeader ||
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        message:
          "Authorization header is missing or invalid",
      });
    }

    // --------------------------------------------------
    // 2. EXTRACT + VERIFY TOKEN
    // --------------------------------------------------

    const token =
      authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY 
    );

    // --------------------------------------------------
    // 3. FIND LOGGED-IN USER
    // --------------------------------------------------

    const user =
      await User.findById(
        decoded.id
      );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // --------------------------------------------------
    // 4. READ EDITABLE FIELDS
    // --------------------------------------------------

    const {
 
      firstName,
      lastName,
      phoneNumber,
      location,
      availableForWork,
      companyName,
      companyDescription,
      companyUrl,
      companySize,
      companyType,
    } = req.body;

    // --------------------------------------------------
    // 5. UPDATE COMMON USER FIELDS
    // --------------------------------------------------

    /*
     * Use !== undefined rather than:
     *
     * firstName || user.firstName
     *
     * Why?
     *
     * With ||, an empty string can never be
     * intentionally handled/validated properly.
     */
    if (
      firstName !== undefined
    ) {
      user.firstName =
        firstName;
    }

    if (
      lastName !== undefined
    ) {
      user.lastName =
        lastName;
    }

    if (
      phoneNumber !== undefined
    ) {
      user.phoneNumber =
        phoneNumber;
    }

    // ==================================================
    // 6. CANDIDATE PROFILE
    // ==================================================

    if (
      user.role === "candidate"
    ) {
      /*
       * Candidate location belongs directly
       * to UserModel.
       */
      if (location) {
        user.location = {
          city:
            location.city ??
            user.location?.city,

          country:
            location.country ??
            user.location?.country,
        };
      }

      /*
       * availableForWork controls recruiter
       * discovery only.
       */
      if (
        typeof availableForWork ===
        "boolean"
      ) {
        user.availableForWork =
          availableForWork;
      }
    }

    // ==================================================
    // 7. COMPANY PROFILE
    // ==================================================

    if (
      user.role === "company"
    ) {
      /*
       * Every company user should now be linked
       * to a real Company document.
       */
      if (!user.companyId) {
        return res.status(400).json({
          message:
            "Your account is not linked to a company.",
        });
      }

      /*
       * Build Company update separately.
       *
       * This is important because these fields
       * no longer truly belong to UserModel.
       */
      const companyUpdate = {};

      if (
        companyName !== undefined
      ) {
        companyUpdate.companyName =
          companyName;
      }

      if (
        companyDescription !==
        undefined
      ) {
        companyUpdate.companyDescription =
          companyDescription;
      }

      if (
        companyUrl !== undefined
      ) {
        companyUpdate.companyUrl =
          companyUrl;
      }

      if (
        companySize !== undefined
      ) {
        companyUpdate.companySize =
          companySize;
      }

      if (
        companyType !== undefined
      ) {
        companyUpdate.companyType =
          companyType;
      }

      /*
       * IMPORTANT:
       *
       * For a company user, this location means
       * the COMPANY location.
       *
       * Example:
       *
       * ABC Recruitment HQ
       * London, United Kingdom
       *
       * It does NOT represent Job.location.
       */
      if (location) {
        companyUpdate.location = {
          city:
            location.city,

          country:
            location.country,
        };
      }

      /*
       * Update the real Company document.
       */
      await Company.findByIdAndUpdate(
        user.companyId,
        companyUpdate,
        {
          /*
           * Return updated Company internally.
           */
          new: true,

          /*
           * Enforce enums and required fields
           * from CompanyModel.
           */
          runValidators: true,
        }
      );

      /*
       * TEMPORARY LEGACY SUPPORT
       *
       * You still have:
       *
       * User.companyName
       * User.companyDescription
       *
       * while the frontend migration is ongoing.
       *
       * Keep them synchronized for now so older
       * components don't suddenly break.
       *
       * We will remove this section once the
       * frontend uses CompanyModel everywhere.
       */
      if (
        companyName !== undefined
      ) {
        user.companyName =
          companyName;
      }

      if (
        companyDescription !==
        undefined
      ) {
        user.companyDescription =
          companyDescription;
      }
    }

    // --------------------------------------------------
    // 8. SAVE USER CHANGES
    // --------------------------------------------------

    await user.save();

    // --------------------------------------------------
    // 9. FETCH FRESH PROFILE
    // --------------------------------------------------

    /*
     * Do NOT return the old `user` variable directly.
     *
     * We re-fetch it so:
     *
     * companyId is populated
     * updated Company information is included
     * sensitive fields are excluded
     */
    const updatedUser =
      await User.findById(
        decoded.id
      )
        .select(
          "-password -otp -otpExpiry"
        )
        .populate(
          "companyId",
          `
            companyName
            companyDescription
            companyUrl
            companySize
            companyType
            location
            isActive
            createdBy
          `
        );

    // --------------------------------------------------
    // 10. RETURN UPDATED PROFILE
    // --------------------------------------------------

    return res.status(200).json({
      message:
        "Profile updated successfully",

      user:
        updatedUser,
    });
  // } catch (error) {
  //   console.error(
  //     "updateUserProfile error:",
  //     error
  //   );

  //   /*
  //    * JWT errors are authentication problems.
  //    */
  //   if (
  //     error.name ===
  //       "TokenExpiredError" ||
  //     error.name ===
  //       "JsonWebTokenError"
  //   ) {
  //     return res.status(401).json({
  //       message:
  //         "Invalid or expired token",
  //     });
  //   }

  //   /*
  //    * Mongoose validation errors should be
  //    * HTTP 400 rather than 401.
  //    *
  //    * Example:
  //    * invalid companyType enum.
  //    */
  //   if (
  //     error.name ===
  //     "ValidationError"
  //   ) {
  //     return res.status(400).json({
  //       message:
  //         error.message,
  //     });
  //   }

  //   /*
  //    * Unexpected backend errors.
  //    */
  //   return res.status(500).json({
  //     message:
  //       "Failed to update profile",
  //   });
  // }
};