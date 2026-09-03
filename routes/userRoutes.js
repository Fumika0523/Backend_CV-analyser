const express = require("express");
const router = express.Router();
const {
 getUser, updateUserProfile
} = require("../controllers/userController");
const {auth} = require('../middleware/auth')

router.get("/user-profile",auth,getUser)
router.put("/user-profile", auth,updateUserProfile);

module.exports = router;

