const express = require("express");
const router = express.Router();
const {
  createJobPost,
  getAllJobPosts,
  getMyCompanyJobPosts,
  getSingleJobPost,
  updateJobPost,
  deleteJobPost,
  getMatchedCandidatesForJob,
  getMatchedJobsForCandidate,
  getMatchedJobsForGuest,
} = require("../controllers/jobController");

const auth = require("../middleware/auth");


// ========================================
// COMPANY - CREATE JOB
// ========================================
router.post(
  "/create",
  auth,
  createJobPost
);


// ========================================
// PUBLIC - ALL AVAILABLE JOBS
// ========================================
router.get(
  "/all-jobs",
  getAllJobPosts
);


// ========================================
// COMPANY - GET COMPANY JOBS
// ========================================
router.get(
  "/my-jobs",
  auth,
  getMyCompanyJobPosts
);


// ========================================
// COMPANY - UPDATE JOB
// ========================================
router.put(
  "/jobs/:id",
  auth,
  updateJobPost
);


// ========================================
// COMPANY - CLOSE JOB
// ========================================
router.delete(
  "/jobs/:id",
  auth,
  deleteJobPost
);


// ========================================
// COMPANY - MATCHED CANDIDATES
// ========================================

router.get(
  "/jobs/:jobId/matches",
  auth,
  getMatchedCandidatesForJob
);


// ========================================
// CANDIDATE - RECOMMENDED JOBS
// ========================================
router.get(
  "/candidate/matched-jobs",
  auth,
  getMatchedJobsForCandidate
);


// ========================================
// GUEST - RECOMMENDED JOBS
// ========================================
router.get(
  "/guest/matched-jobs",
  getMatchedJobsForGuest
);


// ========================================
// PUBLIC - SINGLE JOB
// ========================================

/*
 * Keep this near the bottom because /:id
 * is a very general route.
 *
 * More specific routes should normally
 * appear before it.
 */
router.get(
  "/:id",
  getSingleJobPost
);


module.exports = router;