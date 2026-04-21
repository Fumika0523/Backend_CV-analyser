const User = require("../Model/UserModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// 🔐 Generate JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role
    },
    process.env.JWT_SECRET_KEY || "nodejs",
    { expiresIn: "7d" }
  );
};

// =======================
// SIGN UP
// =======================
exports.signUp = async (req, res) => {
  try {
    const { email, password, role, firstName, lastName } = req.body;

    // check if user exists
    let userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role
    });

    res.status(201).json({
      message: "User registered successfully",
      user,
      token: generateToken(user)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// =======================
// SIGN IN
// =======================
exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    // find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Email not found"
      });
    }

    // check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password"
      });
    }

    // success
    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.firstName,
        email: user.email,
        role: user.role
      },
      token: generateToken(user)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};