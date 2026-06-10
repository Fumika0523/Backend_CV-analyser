const express = require("express");
const router = express.Router();
const { applyForJob, getApplications, updateApplicationStatus } = require("../controllers/applicationController");
const auth = require('../middleware/auth')


router.post("/apply", auth,  applyForJob)
router.get("/applications", auth, getApplications)
router.put("/update-applications/:id/status", auth, updateApplicationStatus)

module.exports = router;