const jwt = require("jsonwebtoken");
const Company = require("../Model/companyModel");
const User = require("../Model/UserModel");
const bcrypt = require("bcryptjs");
const sendEmail = require("../utils/sendEmail")
const getNextSequence = require("../utils/getNextSequence");
const CV = require("../Model/CVModel");
const { otpEmailTemplate } = require("../utils/emailTemplates");
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

    // Normalize email
    const email = String(rawEmail || "")
      .trim()
      .toLowerCase();

    // Basic backend email format check
    if (!email) {
      return res.status(400).json({
        field: "email",
        code: "EMAIL_REQUIRED",
        message: "Email address is required.",
      });
    }

    /*
     * Check email separately so we can return
     * a clear error message.
     */
    const existingUser = await User.findOne({
      email,
    });

    if (existingUser) {
      /*
       * User exists but hasn't completed OTP verification.
       * Send them back to the OTP screen.
       */
      if (!existingUser.isVerified) {
        return res.status(403).json({
          field: "email",
          code: "EMAIL_NOT_VERIFIED",
          _id: existingUser._id,
          message:
            "This email is already registered but has not been verified. Please verify your email.",
        });
      }

      return res.status(409).json({
        field: "email",
        code: "EMAIL_EXISTS",
        message:
          "This email is already registered. Please sign in.",
      });
    }

    /*
     * Check phone number separately.
     */
    const existingPhone = await User.findOne({
      phoneNumber,
    });

    if (existingPhone) {
      return res.status(409).json({
        field: "phoneNumber",
        code: "PHONE_EXISTS",
        message:
          "This phone number is already registered. Please sign in.",
      });
    }

    /*
     * Company account must have a company name.
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
    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(
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
        Date.now() + 5 * 60 * 1000,
          otpAttempts: 0,
          otpLastSentAt: new Date(),

      isVerified: false,
    };

    /*
     * Keep legacy company fields temporarily.
     */
    if (role === "company") {
      userData.companyName =
        companyName.trim();

      userData.companyDescription =
        companyDescription || "";
    }

    user = await User.create(userData);

    if (role === "company") {
      company = await Company.create({
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

    /*
     * Link guest CVs to newly registered candidate.
     */
    if (
      role === "candidate" &&
      guestSessionId
    ) {
      const updatedCV =
        await CV.updateMany(
          {
            guestSessionId,
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

    /*
     * OTP proves that the user actually has
     * access to this email address.
     */
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

    /*
     * Extra protection for MongoDB unique email.
     */
    if (
      error.code === 11000 &&
      error.keyPattern?.email
    ) {
      return res.status(409).json({
        field: "email",
        code: "EMAIL_EXISTS",
        message:
          "This email is already registered. Please sign in.",
      });
    }

    if (
      error.name === "ValidationError" ||
      error.statusCode === 400
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message:
        "Signup failed. Please check the details and try again.",
    });
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

    // --------------------------------------------------
    // 1. Validate request
    // --------------------------------------------------

    /*
     * Both the MongoDB user ID and the 6-digit OTP
     * are required before verification can continue.
     */
    if (!_id || !otp) {
      return res.status(400).json({
        message: "_id and otp are required",
      });
    }

    // --------------------------------------------------
    // 2. Find user
    // --------------------------------------------------

    /*
     * OTP verification belongs to a specific user,
     * so first find the account using the MongoDB _id
     * that was returned after signup.
     */
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({
        message:
          "User not found. Please try signing up or signing in again.",
      });
    }

    // --------------------------------------------------
    // 3. Check failed-attempt limit
    // --------------------------------------------------

    /*
     * A 6-digit OTP has only 1,000,000 combinations.
     *
     * Without an attempt limit, somebody could repeatedly
     * guess codes during the 5-minute validity period.
     *
     * We allow a maximum of 5 incorrect attempts for
     * each OTP. After that, the user must request a new one.
     *
     * `|| 0` also protects older User documents that
     * may not yet contain otpAttempts.
     */
    if ((user.otpAttempts || 0) >= 5) {
      // 429: Too Many Request
      return res.status(429).json({
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    // --------------------------------------------------
    // 4. Check whether OTP has expired
    // --------------------------------------------------

    /*
     * OTPs are valid for only 5 minutes.
     *
     * Expiry must be checked before comparing the code.
     * Even if an expired OTP happens to match, it must
     * never be accepted.
     */
    if (
      !user.otpExpiry ||
      user.otpExpiry < Date.now()
    ) {
      // 400 Bad requests >> the server cannot understand the request
      return res.status(400).json({
        message:
          "OTP expired. Please request a new OTP.",
      });
    }

    // --------------------------------------------------
    // 5. Compare OTP
    // --------------------------------------------------

    /*
     * Convert both values to strings because MongoDB or
     * the frontend may represent the OTP differently.
     */
    if (
      String(user.otp) !==
      String(otp)
    ) {
      /*
       * Increase the failed-attempt counter.
       *
       * Using `(user.otpAttempts || 0)` prevents
       * `undefined + 1` from becoming NaN for older users.
       */
      user.otpAttempts =
        (user.otpAttempts || 0) + 1;

      const attemptsLeft =
        5 - user.otpAttempts;

      /*
       * On the fifth incorrect attempt, invalidate the OTP.
       *
       * The same code cannot be used again even if the user
       * later remembers the correct value. They must request
       * a new OTP.
       */
      if (attemptsLeft <= 0) {
        user.otp = null;
        user.otpExpiry = null;

        await user.save();

        return res.status(429).json({
          message:
            "Too many incorrect attempts. Please request a new OTP.",
        });
      }

      /*
       * Save the failed-attempt counter before returning
       * the error to the frontend.
       */
      await user.save();

      return res.status(400).json({
        message:
          `Invalid OTP. ${attemptsLeft} attempt${
            attemptsLeft === 1 ? "" : "s"
          } remaining.`,
      });
    }

    // --------------------------------------------------
    // 6. Extra company account safety check
    // --------------------------------------------------

    /*
     * Under the current architecture, every company user
     * must be linked to a Company document.
     *
     * Candidate users do not require companyId.
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

    // --------------------------------------------------
    // 7. Mark account as verified
    // --------------------------------------------------

    user.isVerified = true;

    /*
     * Once verification succeeds:
     *
     * - remove the OTP
     * - remove its expiry
     * - reset the failed-attempt counter
     *
     * This prevents the OTP from ever being reused.
     */
    user.otp = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;

    await user.save();

    // --------------------------------------------------
    // 8. Generate authentication token
    // --------------------------------------------------

    /*
     * After successful email verification, generate
     * the normal authentication token so the frontend
     * can log the user into SkillfulJobs.ai.
     */
    const token =
      generateToken(user);

    // --------------------------------------------------
    // 9. Return authenticated user
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      token,
      user: {
        _id: user._id,
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,

        /*
         * Keep name for compatibility with existing
         * frontend components.
         */
        name:
          `${user.firstName || ""} ${
            user.lastName || ""
          }`.trim(),
        email: user.email,
        role: user.role,

        /*
         * Candidate:
         * companyId = null
         * companyRole = null
         *
         * Company:
         * companyId = Company._id
         * companyRole = company_admin
         */
        companyId: user.companyId || null,
        companyRole: user.companyRole || null,

        /*
         * Used by candidate availability / recruiter
         * recommendation logic.
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
exports.resendOtp = async (req, res) => {
  try {
    const { _id } = req.body;

    // --------------------------------------------------
    // 1. Validate request
    // --------------------------------------------------

    if (!_id) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    // --------------------------------------------------
    // 2. Find user
    // --------------------------------------------------

    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // --------------------------------------------------
    // 3. Prevent unnecessary resend after verification
    // --------------------------------------------------

    /*
     * Once the account has already been verified,
     * there is no reason to issue another signup OTP.
     */
    if (user.isVerified) {
      return res.status(400).json({
        message:
          "This account has already been verified. Please sign in.",
      });
    }

    // --------------------------------------------------
    // 4. Generate a completely new OTP
    // --------------------------------------------------

    const otp = generateOTP();

    /*
     * Replace the old OTP with a new code and give
     * the new code its own fresh 5-minute expiry.
     */
    user.otp = otp;

    user.otpExpiry =
      Date.now() + 5 * 60 * 1000;

    /*
     * IMPORTANT:
     *
     * A new OTP means a new set of verification attempts.
     *
     * If the previous OTP was locked after 5 incorrect
     * attempts, this MUST be reset to 0. Otherwise the new
     * OTP would also remain locked immediately.
     */
    user.otpAttempts = 0;

    /*
     * Store when the latest OTP was sent.
     *
     * We will use this to prevent users from repeatedly
     * requesting OTP emails too quickly.
     */
    user.otpLastSentAt = new Date();

    await user.save();

    // --------------------------------------------------
    // 5. Send the new OTP
    // --------------------------------------------------

    await sendEmail({
      to: user.email,

      subject:
        "Your SkillfulJobs.ai verification code",

      html:
        otpEmailTemplate(otp),
    });

    // --------------------------------------------------
    // 6. Return success
    // --------------------------------------------------

    return res.status(200).json({
      message:
        "A new OTP has been sent.",
    });

  } catch (error) {
    console.error(
      "Resend OTP error:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};


// 1. Forgot password - check email and send OTP
// 1. Forgot password - check email and send OTP
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // --------------------------------------------------
    // 1. Validate + normalize email
    // --------------------------------------------------

    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // --------------------------------------------------
    // 2. Find candidate
    // --------------------------------------------------

    const user = await User.findOne({
      email: normalizedEmail,
      role: "candidate",
    });

    if (!user) {
      return res.status(404).json({
        message:
          "This email is not registered as a candidate.",
      });
    }

    // --------------------------------------------------
    // 3. Prevent repeated OTP requests
    // --------------------------------------------------

    /*
     * Do not allow users to repeatedly request OTP
     * emails every few seconds.
     *
     * They must wait 60 seconds between requests.
     */
    const cooldown = 60 * 1000;

    if (
      user.otpLastSentAt &&
      Date.now() -
        new Date(user.otpLastSentAt).getTime() <
        cooldown
    ) {
      const secondsLeft = Math.ceil(
        (
          cooldown -
          (
            Date.now() -
            new Date(
              user.otpLastSentAt
            ).getTime()
          )
        ) / 1000
      );

      return res.status(429).json({
        message:
          `Please wait ${secondsLeft} seconds before requesting another OTP.`,
      });
    }

    // --------------------------------------------------
    // 4. Generate new OTP
    // --------------------------------------------------

    const otp = generateOTP();

    user.otp = otp;

    /*
     * Each new OTP gets a fresh 5-minute validity period.
     */
    user.otpExpiry =
      Date.now() + 5 * 60 * 1000;

    /*
     * A new OTP also gets a fresh set of
     * 5 verification attempts.
     */
    user.otpAttempts = 0;

    /*
     * Used for the 60-second resend restriction.
     */
    user.otpLastSentAt =
      new Date();

    await user.save();

    // --------------------------------------------------
    // 5. Send OTP email
    // --------------------------------------------------

    await sendEmail({
      to: user.email,

      subject:
        "Your SkillfulJobs.ai verification code",

      html:
        otpEmailTemplate(otp),
    });

    return res.status(200).json({
      success: true,
      message:
        "OTP sent to your email.",
    });

  } catch (error) {
    console.error(
      "Forgot password error:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// 2. Verify reset OTP
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // --------------------------------------------------
    // 1. Validate request
    // --------------------------------------------------

    /*
     * Both email and OTP are required before
     * password-reset verification can continue.
     */
    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required.",
      });
    }

    // Normalize email before searching MongoDB.
    const normalizedEmail =
      email.trim().toLowerCase();

    // --------------------------------------------------
    // 2. Find candidate
    // --------------------------------------------------

    const user = await User.findOne({
      email: normalizedEmail,
      role: "candidate",
    });

    if (!user) {
      return res.status(404).json({
        message: "Candidate not found.",
      });
    }

    // --------------------------------------------------
    // 3. Check failed-attempt limit
    // --------------------------------------------------

    /*
     * Allow a maximum of 5 incorrect attempts
     * for one reset OTP.
     *
     * `|| 0` also supports older users that may
     * not yet have otpAttempts stored.
     */
    if ((user.otpAttempts || 0) >= 5) {
      return res.status(429).json({
        message:
          "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    // --------------------------------------------------
    // 4. Check OTP expiry
    // --------------------------------------------------

    /*
     * Check expiry before comparing the OTP.
     *
     * An expired OTP must never be accepted,
     * even if the entered code is correct.
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

    // --------------------------------------------------
    // 5. Check OTP
    // --------------------------------------------------

    if (
      String(user.otp) !==
      String(otp)
    ) {
      /*
       * Increase the failed-attempt counter.
       */
      user.otpAttempts =
        (user.otpAttempts || 0) + 1;

      const attemptsLeft =
        5 - user.otpAttempts;

      /*
       * On the fifth incorrect attempt,
       * invalidate this reset OTP completely.
       */
      if (attemptsLeft <= 0) {
        user.otp = null;
        user.otpExpiry = null;

        await user.save();

        return res.status(429).json({
          message:
            "Too many incorrect attempts. Please request a new OTP.",
        });
      }

      /*
       * Save the new attempt count so the next
       * request knows how many attempts remain.
       */
      await user.save();

      return res.status(400).json({
        message:
          `Invalid OTP. ${attemptsLeft} attempt${
            attemptsLeft === 1 ? "" : "s"
          } remaining.`,
      });
    }

    // --------------------------------------------------
    // 6. OTP verified successfully
    // --------------------------------------------------

    /*
     * Reset the failed-attempt counter after
     * successful verification.
     *
     * We are NOT clearing the OTP here yet because
     * we first need to confirm how your reset-password
     * endpoint verifies that this step was completed.
     */
    user.otpAttempts = 0;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "OTP verified successfully.",
    });

  } catch (error) {
    console.error(
      "Verify reset OTP error:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// 3. Reset password
// 3. Reset password
exports.resetPassword = async (req, res) => {
  try {
    const {
      email,
      otp,
      password,
    } = req.body;

    // --------------------------------------------------
    // 1. Validate request
    // --------------------------------------------------

    if (
      !email ||
      !otp ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Email, OTP and password are required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // --------------------------------------------------
    // 2. Find candidate
    // --------------------------------------------------

    const user = await User.findOne({
      email: normalizedEmail,
      role: "candidate",
    });

    if (!user) {
      return res.status(404).json({
        message:
          "Candidate not found.",
      });
    }

    // --------------------------------------------------
    // 3. Check attempt limit
    // --------------------------------------------------

    /*
     * resetPassword must enforce the attempt limit too.
     *
     * Otherwise somebody could skip verifyResetOtp
     * completely and brute-force this endpoint directly.
     */
    if (
      (user.otpAttempts || 0) >= 5
    ) {
      return res.status(429).json({
        message:
          "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    // --------------------------------------------------
    // 4. Check OTP expiry
    // --------------------------------------------------

    /*
     * Never accept an expired OTP,
     * even if the entered value is correct.
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

    // --------------------------------------------------
    // 5. Verify OTP
    // --------------------------------------------------

    if (
      String(user.otp) !==
      String(otp)
    ) {
      user.otpAttempts =
        (user.otpAttempts || 0) + 1;

      const attemptsLeft =
        5 - user.otpAttempts;

      /*
       * Fifth incorrect attempt invalidates
       * the current OTP completely.
       */
      if (attemptsLeft <= 0) {
        user.otp = null;
        user.otpExpiry = null;

        await user.save();

        return res.status(429).json({
          message:
            "Too many incorrect attempts. Please request a new OTP.",
        });
      }

      await user.save();

      return res.status(400).json({
        message:
          `Invalid OTP. ${attemptsLeft} attempt${
            attemptsLeft === 1 ? "" : "s"
          } remaining.`,
      });
    }

    // --------------------------------------------------
    // 6. Update password
    // --------------------------------------------------

    const salt =
      await bcrypt.genSalt(10);

    user.password =
      await bcrypt.hash(
        password,
        salt
      );

    // --------------------------------------------------
    // 7. Clear OTP data
    // --------------------------------------------------

    /*
     * Once the password has been successfully changed,
     * the OTP must never be reusable.
     */
    user.otp = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;

    await user.save();

    return res.status(200).json({
      success: true,

      message:
        "Password reset successful. Please sign in.",
    });

  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};


// Forgot Password
//       ↓
// Send OTP
// 5-minute expiry
// 60-second resend cooldown
// otpAttempts = 0
//       ↓
// Verify OTP
// Maximum 5 wrong attempts
//       ↓
// Enter new password
//       ↓
// resetPassword checks OTP again
// Maximum 5 attempts also enforced
//       ↓
// Password changed
// OTP deleted
// attempt counter reset