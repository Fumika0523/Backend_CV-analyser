const express = require("express");
const router = express.Router();

const {
  applyForJob,
  getApplications,
  updateApplicationStatus,
  getRecommendedCandidates,
} = require("../controllers/applicationController");

const auth = require("../middleware/auth");

router.post("/apply", auth, applyForJob);
router.get("/applications", auth, getApplications);
router.get("/recommended-candidates", auth, getRecommendedCandidates);
router.put("/update-applications/:id/status", auth, updateApplicationStatus);

module.exports = router;