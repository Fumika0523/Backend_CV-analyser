const express = require("express");
const { applyForJob, getApplications, updateApplicationStatus } = require("../controllers/cvController");
const router = express.Router();

router.post("/apply", auth, applyForJob)
router.get("/applications", auth, getApplications)
router.put("/update-applications/:id/status",auth, updateApplicationStatus)

module.exports = router;