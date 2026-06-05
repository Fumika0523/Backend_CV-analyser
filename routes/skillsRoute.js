const express = require("express");
const router = express.Router();
const { getMySkills} = require("../controllers/skillsController");
const auth = require("../middleware/auth");


router.get("/my-skills", auth, getMySkills);


module.exports = router;