const User = require('../Model/UserModel')
const jwt = require("jsonwebtoken");

//Get User Profile
exports.getUser = async (req, res) => {
  try {
    const authHeader = req.header("Authorization");
    console.log("Authorization",authHeader)

    if(!authHeader){
      return res.status(401).send({
        message:"Authorization header is missing"
      })
    }

    // const token = authHeader.replace("Bearer ", "");
    //Take the authorization header, split it into two parts by space, and etraxt the second part, which is thee actual JWT token.
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY || "nodejs"
    );
    console.log("decoded",decoded)
    const user = await User.findById(decoded.id).select("-password -otp -otpExpiry");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    console.error("getUser error:", error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

//updateUserProfile
// Update User Profile
exports.updateUserProfile = async (req, res) => {
  try {
    const authHeader = req.header("Authorization");

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        message:
          "Authorization header is missing or invalid",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY || "nodejs"
    );

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const {
      firstName,
      lastName,
      phoneNumber,
      companyName,
      companyDescription,
      location,
      availableForWork,
    } = req.body;

    // Common fields
    user.firstName =
      firstName || user.firstName;

    user.lastName =
      lastName || user.lastName;

    user.phoneNumber =
      phoneNumber || user.phoneNumber;

    // Location
    if (location) {
      user.location = {
        city:
          location.city ||
          user.location?.city,

        country:
          location.country ||
          user.location?.country,
      };
    }

    // Candidate-only field
    if (
      user.role === "candidate" &&
      typeof availableForWork === "boolean"
    ) {
      user.availableForWork =
        availableForWork;
    }

    // Company-only fields
    if (user.role === "company") {
      user.companyName =
        companyName || user.companyName;

      user.companyDescription =
        companyDescription ||
        user.companyDescription;
    }

    await user.save();

    const updatedUser =
      await User.findById(decoded.id).select(
        "-password -otp -otpExpiry"
      );

    return res.status(200).json({
      message:
        "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error(
      "updateUserProfile error:",
      error
    );

    return res.status(401).json({
      message:
        "Invalid or expired token",
    });
  }
};