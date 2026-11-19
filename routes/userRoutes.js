const express = require("express");
const router = express.Router();

const {
  getUser,
  updateUserProfile,
} = require("../controllers/userController");

const auth = require("../middleware/auth");

router.get("/auth/session", auth, (req, res) => {
  res.set("Cache-Control", "no-store").json({
    user: { id: req.user.id, role: req.user.role },
    expiresAt: req.authExpiresAt,
  });
});

router.get("/user-profile", auth, getUser);
router.put("/user-profile", auth, updateUserProfile);

module.exports = router;