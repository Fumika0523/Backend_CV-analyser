const jwt = require("jsonwebtoken");
const User = require("../Model/UserModel");

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "No token, authorization denied",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY || "nodejs"
    );

    // Fetch user from DB
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    req.user = user; // attach user
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({
      message: "Invalid token",
    });
  }
};

module.exports = auth;