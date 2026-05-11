const express = require("express");
const router = express.Router();
const { applyForJob, getApplications, updateApplicationStatus } = require("../controllers/applicationController");

// const auth = require('../middleware/auth')

router.post("/apply",  applyForJob)
router.get("/applications", getApplications)
router.put("/update-applications/:id/status", updateApplicationStatus)

module.exports = router;