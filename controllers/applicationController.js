const Application = require("../Model/applicationModel");
const User = require("../Model/UserModel");
const Job = require("../Model/jobModel")
const sendEmail = require("../utils/sendEmail");
const CV = require("../Model/CVModel");

const {
  candidateApplicationTemplate,
  companyApplicationTemplate,
} = require("../utils/emailTemplates");


const normalizeSkill = (skill) => {
  return skill
    ?.toString()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .trim();
};

const normalizeLocation = (location) => {
  if (!location) return "";

  if (typeof location === "string") {
    return location.toLowerCase().trim();
  }

  if (typeof location === "object") {
    return (
      location.city ||
      location.town ||
      location.address ||
      location.name ||
      location.label ||
      ""
    )
      .toString()
      .toLowerCase()
      .trim();
  }

  return location.toString().toLowerCase().trim();
};

const calculateMatch = (
  candidateSkills = [],
  jobSkills = [],
  candidateLocation,
  jobLocation
) => {
  const normalizedCandidateSkills = candidateSkills.map(normalizeSkill);

  const matchedSkills = jobSkills.filter((jobSkill) =>
    normalizedCandidateSkills.includes(normalizeSkill(jobSkill))
  );

  const missingSkills = jobSkills.filter(
    (jobSkill) => !normalizedCandidateSkills.includes(normalizeSkill(jobSkill))
  );

  const normalizedCandidateLocation = normalizeLocation(candidateLocation);
  const normalizedJobLocation = normalizeLocation(jobLocation);

  const locationMatch =
    normalizedCandidateLocation &&
    normalizedJobLocation &&
    normalizedCandidateLocation === normalizedJobLocation;

  const skillScore =
    jobSkills.length > 0 ? (matchedSkills.length / jobSkills.length) * 80 : 0;

  const locationScore = locationMatch ? 20 : 0;

  const matchScore = Math.round(skillScore + locationScore);

  return {
    matchedSkills,
    missingSkills,
    locationMatch,
    matchScore,
  };
};

// ===============================
// APPLY FOR JOB
// ===============================

const applyForJob = async (req, res) => {
  try {
    const { jobId, cvId } = req.body;

    const user = await User.findById(req.user.id).lean();

    if (!user || user.role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Only candidates can apply for jobs",
      });
    }

    const job = await Job.findById(jobId)
      .populate("companyId", "userId companyName email firstName lastName")
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const alreadyApplied = await Application.findOne({
      candidateId: user.userId,
      jobId,
    }).lean();

    if (alreadyApplied) {
      return res.status(400).json({
        success: false,
        message: "You already applied for this job",
      });
    }

    const cv = cvId
      ? await CV.findById(cvId).lean()
      : await CV.findOne({ candidateId: user.userId })
          .sort({ version: -1 })
          .lean();

    const candidateSkills = cv?.skills || [];
    const jobSkills = job.keySkills || [];

    const {
      matchedSkills,
      missingSkills,
      locationMatch,
      matchScore,
    } = calculateMatch(
      candidateSkills,
      jobSkills,
      user.location,
      job.location
    );

    const application = await Application.create({
      candidateId: user.userId,
      companyId: job.companyId.userId,
      jobId: job._id,
      title: job.title,
      companyName: job.companyId.companyName || "Company",
      cvId: cv?._id,
      status: "pending",
      matchScore,
      matchedSkills,
      missingSkills,
      locationMatch,
      note: "",
    });

    const candidateHtml = candidateApplicationTemplate(user, job);
    const companyHtml = companyApplicationTemplate(user, job);

    await sendEmail({
      to: user.email,
      subject: "Application submitted successfully",
      html: candidateHtml,
    });

    await sendEmail({
      to: job.companyId.email,
      subject: "New job application received",
      html: companyHtml,
    });

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    console.log("Apply Job Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const getRecommendedCandidates = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();

    if (!user || user.role !== "company") {
      return res.status(403).json({
        success: false,
        message: "Only companies can view recommended candidates",
      });
    }

    const jobs = await Job.find({ companyId: user._id }).lean();

    const applications = await Application.find({
      companyId: user.userId,
    }).lean();

    const appliedCandidateIds = applications.map((app) => app.candidateId);

    const candidates = await User.find({
      role: "candidate",
      userId: { $nin: appliedCandidateIds },
    }).lean();

    const results = [];

    for (const job of jobs) {
      for (const candidate of candidates) {
        const cv = await CV.findOne({ candidateId: candidate.userId })
          .sort({ version: -1 })
          .lean();
console.log("CV FOUND:", cv);
console.log("CV SKILLS:", cv?.skills);
console.log("CV SKILLS DETECTED:", cv?.skillsDetected);
        if (!cv) continue;

        const candidateSkills = cv?.skills || [];
        const jobSkills = job.keySkills || [];

        const {
  matchedSkills,
  missingSkills,
  locationMatch,
  matchScore,
} = calculateMatch(
  candidateSkills,
  jobSkills,
  candidate.location,
  job.location
);

        results.push({
          candidateId: candidate.userId,
          candidateName: `${candidate.firstName} ${candidate.lastName}`,
          candidateEmail: candidate.email,
          jobTitle: job.title,
          jobId: job._id,
          cvFilePath: cv.filePath,
          matchScore,
          matchedSkills,
          missingSkills,
          locationMatch,
          contactStatus: "Need to contact",
        });
      }
    }

    results.sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({
      success: true,
      count: results.length,
      candidates: results,
    });
  } catch (error) {
    console.log("Recommended Candidates Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


// ===============================
// GET APPLICATIONS
// ===============================
const getApplications = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let applications = [];

    if (user.role === "candidate") {
      applications = await Application.find({
        candidateId: user.userId,
      })
        .sort({ appliedDate: -1 })
        .lean();
    }

    if (user.role === "company") {
      applications = await Application.find({
        companyId: user.userId,
      })
        .sort({ appliedDate: -1 })
        .lean();

      applications = await Promise.all(
        applications.map(async (app) => {
          const candidate = await User.findOne({
            userId: app.candidateId,
          }).lean();

      const cv = app.cvId ?
      await CV.findById(app.cvId).lean()
      :
      await CV.findOne({ candidateId: app.candidateId }).sort({ version: -1 }).lean();

          return {
            ...app,
            candidateName: candidate
              ? `${candidate.firstName} ${candidate.lastName}`
              : `Candidate ${app.candidateId}`,
            candidateEmail: candidate?.email || "",
              cvFilePath: cv?.filePath || "",
              applicationType: "already_applied",
          };
        })
      );
    }

    res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    console.log("Get Applications Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// ===============================
// UPDATE APPLICATION STATUS
// ===============================
// ===============================
// UPDATE APPLICATION STATUS
// ===============================
const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "reviewing",
      "interview",
      "rejected",
      "accepted",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user || user.role !== "company") {
      return res.status(403).json({
        success: false,
        message: "Only companies can update application status",
      });
    }

    if (application.companyId !== user.userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Store previous status before updating
    const previousStatus = application.status;

    // Update application status
    application.status = status;

    // If hiring manager changes status to accepted
    // and it was not already accepted before
    if (status === "accepted" && previousStatus !== "accepted") {
      // Optional: store accepted date
      application.acceptedAt = new Date();

      // Find related job
      const job = await Job.findById(application.jobId);

      if (job) {
        // Increase filled position count by 1
        job.filledPositions += 1;

        // If filled positions reached vacancies,
        // close the job immediately
        if (job.filledPositions >= job.vacancies) {
          job.status = "Closed";
        }

        await job.save();
      }
    }

    await application.save();

    res.status(200).json({
      success: true,
      message: "Application status updated",
      application,
    });
  } catch (error) {
    console.log("Update Status Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  applyForJob,
  getApplications,
  updateApplicationStatus,
  getRecommendedCandidates,
};


// Manager changes application status to accepted
// ↓
// Application status becomes accepted
// ↓
// acceptedAt is saved
// ↓
// Job filledPositions increases by 1
// ↓
// If filledPositions >= vacancies
// ↓
// Job status becomes Closed
// ↓
// Application record stays in database