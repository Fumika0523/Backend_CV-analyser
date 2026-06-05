const express = require("express");
const router = express.Router();

const {
  createJobPost, getAllJobPosts, getMyCompanyJobPosts, getSingleJobPost,
  updateJobPost, deleteJobPost,getMatchedJobs, getMatchedJobsForCandidate
} = require("../controllers/jobController");

const auth = require("../middleware/auth");

router.post("/create", auth, createJobPost);
router.get("/all-jobs", getAllJobPosts);
router.get("/my-jobs", auth, getMyCompanyJobPosts);

router.put("/jobs/:id", auth, updateJobPost);
router.delete("/jobs/:id", auth, deleteJobPost);
router.get("/jobs/:jobId/matches", getMatchedJobs);
router.get("/candidate/matched-jobs", auth, getMatchedJobsForCandidate);
router.get("/:id", getSingleJobPost);

module.exports = router;