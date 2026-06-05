const { Skills } = require("openai/resources.js");
const Job = require("../Model/jobModel");
const Skill = require('../Model/skillsModel')
const User = require("../Model/UserModel");
const CV = require("../Model/CVModel");

// CREATE JOB POST - company only
exports.createJobPost = async (req, res) => {
  try {
    if (
      req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can post jobs" });
    }

  const {
  title,
  jobType,
  education,
  experience,
  keySkills,
  location,
  companyUrl,
  responsibilities,
  roleSummary,
  compensationBenefits,
  requirements,
  applicationEndDate,
  salary,
} = req.body;

      const job = await Job.create({
  companyId: req.user.id,
  title,
  jobType,
  education,
  experience,
  keySkills,
  location,
  responsibilities,
  companyUrl,
  roleSummary,
  compensationBenefits,
  requirements,
  applicationEndDate,
  salary,
});

    res.status(201).json({
      message: "Job created successfully",
      job,
    });
  } catch (error) {
    console.error("Create job error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// GET ALL JOBS
exports.getAllJobPosts = async (req, res) => {
  try {
    const jobs = await Job.find()
      .populate("companyId", "firstName lastName companyName email city country")
      .sort({ createdAt: -1 });

    res.status(200).json(jobs);
  } catch (error) {
    console.error("Get all jobs error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET MY COMPANY JOBS
exports.getMyCompanyJobPosts = async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can view their jobs" });
    }

    const jobs = await Job.find({ companyId: req.user.id }).sort({
      createdAt: -1,
    });

    res.status(200).json(jobs);
  } catch (error) {
    console.error("Get my jobs error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET SINGLE JOB
exports.getSingleJobPost = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate(
      "companyId",
      "firstName lastName companyName email city country"
    );

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json(job);
  } catch (error) {
    console.error("Get single job error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATE JOB
exports.updateJobPost = async (req, res) => {
  // try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.companyId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updateData = { ...req.body };

    if (typeof updateData.location === "string") {
      const [city, country] = updateData.location.split(",").map((item) => item.trim());

      updateData.location = {
        city: city || "",
        country: country || "",
      };
    }

    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      message: "Job updated successfully",
      job: updatedJob,
    });
  // } catch (error) {
  //   console.error("Update job error:", error);

  //   res.status(500).json({
  //     message: error.message || "Server error",
  //   });
  // }
};

// DELETE JOB
exports.deleteJobPost = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.companyId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await job.deleteOne();

    res.status(200).json({
      message: "Job deleted successfully",
    });
  } catch (error) {
    console.error("Delete job error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Find skills from Skill Collection
exports.getMatchedJobs = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    console.log("JOB SKILLS:", job.keySkills);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const jobSkills = job.keySkills || [];
    const jobLocation = job.location?.toLowerCase().trim();
    const candidateSkills = await Skill.find({
      candidateId: { $ne: null },
    }
  );

    if (!candidateSkills || candidateSkills.length === 0) {
      return res.status(404).json({
        message: "No candidate skills found",
      });
    }

    const results = [];

for (const candidate of candidateSkills) {
  console.log("CANDIDATE SKILLS:", candidate.skills);
  if (typeof candidate.candidateId !== "number") {
    console.log("Skipping invalid candidateId:", candidate.candidateId);
    continue;
  }     
      const matchedSkills = jobSkills.filter((jobSkill) =>
        candidate.skills.some(
          (candidateSkill) =>
            candidateSkill.toLowerCase().includes(jobSkill.toLowerCase()) ||
            jobSkill.toLowerCase().includes(candidateSkill.toLowerCase())
        )
      );

      const matchScore =
        jobSkills.length > 0
          ? Math.round((matchedSkills.length / jobSkills.length) * 100)
          : 0;

      const user = await User.findOne({ userId: candidate.candidateId });

      const candidateLocation = user?.location?.toLowerCase().trim();
      console.log("USER LOCATION:", user?.location);
console.log("TYPE:", typeof user?.location);

   const locationMatched =
        candidateLocation &&
        jobLocation &&
        (candidateLocation.includes(jobLocation) ||
          jobLocation.includes(candidateLocation));

      if (matchScore === 0 || !locationMatched) {
        continue;
      }

      const cv = await CV.findOne({ candidateId: candidate.candidateId }).sort({
        version: -1,
      });

      results.push({
        candidateId: candidate.candidateId,
        candidateName: user
          ? `${user.firstName} ${user.lastName}`
          : "Unknown Candidate",
        email: user?.email,
        matchedSkills,
        totalJobSkills: jobSkills.length,
        matchScore,
        cvPath: cv?.filePath || null,
      });
    }

    const sortedResults = results.sort((a, b) => b.matchScore - a.matchScore);

    return res.status(200).json({
      jobTitle: job.title,
      jobLocation: job.location,
      jobSkills,
      matchedCandidates: sortedResults,
    });

  } catch (e) {
    console.error("getMatchedJobs error:", e);
    return res.status(500).json({ 
      message: "Some internal error"
     });
  }
};