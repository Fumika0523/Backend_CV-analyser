const jwt = require("jsonwebtoken");
const Company = require("../Model/companyModel");
const User = require("../Model/UserModel");
const bcrypt = require("bcryptjs");
const sendEmail = require("../utils/sendEmail")
const getNextSequence = require("../utils/getNextSequence");
const CV = require("../Model/CVModel");
const {
  otpEmailTemplate,
} = require("../utils/emailTemplates");
const validateEmailForOtp = require("../utils/validateEmail");

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "3h" }
  );
};

//req = request from frontend
//res= response back to frontend
exports.signUp = async (req, res) => {
  let user;
  let company;

  try {
    const {
      firstName,
      lastName,
      // User-entered email before validation.
      email: rawEmail,
      password,
      role,
      phoneNumber,
      companyUrl,
      companyName,
      companyDescription,
      companySize,
      companyType,
      location,
      guestSessionId,
    } = req.body;

    const emailValidation =
      await validateEmailForOtp(rawEmail);

    if (emailValidation.status !== "valid") {
      return res.status(400).json({
        field: "email",
        code: emailValidation.status,

        message:
          emailValidation.message ||
          "Please enter a valid email address.",

        suggestion:
          emailValidation.suggestion || null,
      });
    }

    // Use normalized / cleaned email.
    const email = emailValidation.email;

    const userExists = await User.findOne({
      $or: [
        { email },
        { phoneNumber },
      ],
    });

    if (userExists) {
      return res.status(400).json({
        message:
          "User already exists. Please Sign in.",
      });
    }


    /*
     * A company user must provide a company name
     * because we're going to create a Company document.
     */
    if (
      role === "company" &&
      !companyName?.trim()
    ) {
      return res.status(400).json({
        message:
          "Company name is required for company account.",
      });
    }

    // Hash password
    const salt =
      await bcrypt.genSalt(10);

    const hashedPassword =
      await bcrypt.hash(
        password,
        salt
      );

    const otp = generateOTP();

    const userId =
      await getNextSequence("userId");


    const userData = {
      userId,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
      phoneNumber,
      location,

      otp,

      otpExpiry:
        Date.now() +
        5 * 60 * 1000,

      isVerified: false,
    };

    /*
     *
     * Keep these legacy User fields while the rest
     * of your frontend is still being migrated.
     *
     * Later, companyName and companyDescription
     * should come from CompanyModel only.
     */
    if (role === "company") {
      userData.companyName =
        companyName.trim();

      userData.companyDescription =
        companyDescription || "";
    }


    /*
     * We create the User first because Company.createdBy
     * requires a real User._id.
     */
    user = await User.create(
      userData
    );


    if (role === "company") {
      /*
       * This registration represents creation of a
       * NEW company workspace.
       *
       * Later, additional recruiters will JOIN this
       * Company instead of creating another one.
       */
      company =
        await Company.create({
          companyName:
            companyName.trim(),

          companyDescription:
            companyDescription || "",
          companyUrl:
            companyUrl?.trim() || "",
          companySize:
            companySize || "",

          companyType:
            companyType || "",

          location: {
            city:
              location?.city || "",

            country:
              location?.country || "",
          },


          createdBy:
            user._id,
        });


      user.companyId =
        company._id;

      user.companyRole =
        "company_admin";

      await user.save();
    }

    if (
      role === "candidate" &&
      req.body.guestSessionId
    ) {
      const updatedCV =
        await CV.updateMany(
          {
            guestSessionId:
              req.body.guestSessionId,
          },
          {
            $set: {
              candidateId:
                user.userId,

              guestSessionId:
                null,
            },
          }
        );

      console.log(
        "Guest CV link result:",
        updatedCV
      );
    }

    await sendEmail({
      to: email,

      subject:
        "Your SkillfulJobs.ai verification code",

      html:
        otpEmailTemplate(otp),
    });


    return res.status(201).json({
      success: true,

      message:
        "OTP sent to your email",

      mongoId:
        user._id,

      userId:
        user.userId,

      companyId:
        company?._id || null,
    });

  } catch (error) {
    console.error(
      "SignUp error:",
      error
    );

    if (company?._id) {
      await Company.findByIdAndDelete(
        company._id
      );
    }

    if (user?._id) {
      await User.findByIdAndDelete(
        user._id
      );
    }

    if (
      error.name ===
      "ValidationError" ||
      error.statusCode === 400
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message:
        "Signup failed. Please check the detail again.",
    });
  }
};

exports.checkEmail = async (req, res) => {
  try {
    const result = await validateEmailForOtp(req.body.email);

    if (result.status !== "valid") {
      return res.status(400).json({
        valid: false,
        message: result.message,
        suggestion: result.suggestion || null,
      });
    }

    return res.status(200).json({
      valid: true,
      email: result.email,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      valid: false,
      message:
        error.statusCode === 503
          ? error.message
          : "Email validation failed.",
    });
  }
};


// VERIFY OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { _id, otp } = req.body;

    // 1. Validate request
 
    if (!_id || !otp) {
      return res.status(400).json({
        message: "_id and otp are required",
      });
    }

    // 2. Find user

    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({
        message:
          "User not found. Please try signing up or signing in again.",
      });
    }

    // 3. Check whether OTP has expired

    /*
     * Check expiry before comparing the OTP.
     *
     * Even if the entered code happens to match,
     * an expired OTP must never be accepted.
     */
    if (
      !user.otpExpiry ||
      user.otpExpiry < Date.now()
    ) {
      return res.status(400).json({
        message:
          "OTP expired. Please request a new OTP.",
      });
    }

    // 4. Check OTP
// Compare the OTP saved in the database
// with the OTP the user typed.
//
// String(...) makes sure both values
// are compared as strings.
if (
  String(user.otp) !==
  String(otp)
) {

  // The OTP is wrong.
  // Increase the failed-attempt counter by 1.
  //
  // Example:
  // 0 -> 1
  // 1 -> 2
  // 2 -> 3
  user.otpAttempts += 1;


  // Check whether the user has now reached
  // 5 failed attempts.
  if (user.otpAttempts >= 5) {

    // Remove the current OTP.
    // This means that OTP can no longer be used.
    user.otp = null;

    // Remove the expiry time as well,
    // because there is no active OTP anymore.
    user.otpExpiry = null;


    // Save the changes to MongoDB.
    //
    // Without this line, the changes above
    // would only exist temporarily in Node.js
    // and would NOT be stored in the database.
    await user.save();


    // Stop the function here and send
    // an error response to the frontend.
    //
    // 429 means:
    // "Too Many Requests"
    return res.status(429).json({
      message:
        "Too many failed attempts. Please request a new OTP.",
    });
  }


  // If we have NOT reached 5 attempts yet,
  // save the new attempt count.
  //
  // Example:
  // otpAttempts was 2
  // now it becomes 3 in MongoDB.
  await user.save();


  // Return an error because the OTP was wrong.
  //
  // This also tells the user how many
  // attempts are still available.
  //
  // Example:
  // otpAttempts = 2
  // 5 - 2 = 3 attempts remaining
  return res.status(400).json({
    message:
      `Invalid OTP. ${5 - user.otpAttempts} attempts remaining.`,
  });
}

    // 5. Extra company account safety check

    /*
     * Under the new architecture every company
     * user must be linked to a Company document.
     *
     * Candidate users do not need companyId.
     */
    if (
      user.role === "company" &&
      !user.companyId
    ) {
      return res.status(400).json({
        message:
          "Company account is not linked to a company.",
      });
    }

    // 6. Mark account as verified

    user.isVerified = true;

    /*
     * OTP should no longer be usable once verification
     * has succeeded.
     */
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    // 7. Generate authentication token

    const token =
      generateToken(user);

    // 8. Return authenticated user

    return res.status(200).json({
      success: true,

      message:
        "OTP verified successfully",

      token,

      user: {
        _id:
          user._id,

        userId:
          user.userId,

        firstName:
          user.firstName,

        lastName:
          user.lastName,

        /*
         * Keep name for compatibility with
         * existing frontend code.
         */
        name:
          `${user.firstName || ""} ${user.lastName || ""
            }`.trim(),

        email:
          user.email,

        role:
          user.role,

        /*
         * NEW COMPANY ARCHITECTURE
         *
         * Candidate:
         * companyId = null
         * companyRole = null
         *
         * Company:
         * companyId = Company._id
         * companyRole = company_admin / recruiter / hiring_manager
         */
        companyId:
          user.companyId || null,

        companyRole:
          user.companyRole || null,

        /*
         * Useful for candidate state.
         */
        availableForWork:
          user.availableForWork,
      },
    });
  } catch (error) {
    console.error(
      "Verify OTP error:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};

//_id     → MongoDB real ID (use for DB queries)
//userId  → your custom number ID (use for UI)
//mongoId → just a variable name (not needed)

exports.resendOtp = async (req, res) => {
  try {
    const { _id } = req.body;

    const user = await User.findById(_id);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // If the user requested an OTP less than 60 seconds ago,
// do not send another one yet.
if (
  user.otpResendAvailableAt &&
  user.otpResendAvailableAt > Date.now()
) {
  return res.status(429).json({
    message:
      "Please wait before requesting another OTP.",
  });
}

const otp = generateOTP();

// Save the new OTP.
user.otp = otp;

// OTP is valid for 5 minutes.
user.otpExpiry =
  Date.now() + 5 * 60 * 1000;

// New OTP starts with 0 failed attempts.
user.otpAttempts = 0;

// User must wait 60 seconds before requesting another OTP.
user.otpResendAvailableAt =
  Date.now() + 60 * 1000;

    await user.save();
    await sendEmail({
      to: user.email,
      subject: "Your SkillfulJobs.ai verification code",
      html: otpEmailTemplate(otp),
    });

    return res.status(200).json({
      message: "A new OTP has been sent.",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

//sign in
exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Email not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    if (!user.isVerified) {
      const otp = generateOTP()
      user.otp = otp
      user.otpExpiry = Date.now() + 5 * 60 * 1000

      await user.save()
      await sendEmail(user.email, otp)

      return res.status(403).json({
        success: false,
        message: "Please verify your email. A new OTP has been sent.",
        _id: user._id,
        email: user.email
      })
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: generateToken(user),
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.firstName,
        email: user.email,
        role: user.role,
      },
    });
    console.log("Login successful", user)
  } catch (error) {
    console.error("SignIn error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// 1. Forgot password - check email and send OTP
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email, role: "candidate" });

    if (!user) {
      return res.status(404).json({
        message: "This email is not registered as a candidate.",
      });
    }

    const otp = generateOTP();

    user.otp = otp;
    user.otpExpiry = Date.now() + 5 * 60 * 1000;

    await user.save();
    await sendEmail({
      to: user.email,
      subject: "Your SkillfulJobs.ai verification code",
      html: otpEmailTemplate(otp),
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// 2. Verify reset OTP
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email, role: "candidate" });

    if (!user) {
      return res.status(404).json({ message: "Candidate not found." });
    }

    if (String(user.otp) !== String(otp)) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    if (user.otpExpiry < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Please request again." });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully.",
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// 3. Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    const user = await User.findOne({ email, role: "candidate" });

    if (!user) {
      return res.status(404).json({ message: "Candidate not found." });
    }

    if (String(user.otp) !== String(otp)) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    if (user.otpExpiry < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Please request again." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful. Please sign in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
