const express = require("express");
const router = express.Router();
const {
 getUser, updateUserProfile
} = require("../controllers/userController");

router.get("/user-profile",getUser)
router.put("/user-profile", updateUserProfile);

module.exports = router;