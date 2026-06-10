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
      .populate(
        "companyId",
        "firstName lastName companyName email city country"
      )
      .sort({ createdAt: -1 })
      .lean();

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
    }).lean()

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

// Find skills from Skill Collectio
exports.getMatchedJobsForCompany = async (req, res) => {
 // try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    console.log("JOB SKILLS:", job.keySkills);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const jobSkills = job.keySkills || [];
  const jobLocation = `${job.location?.city || ""}, ${job.location?.country || ""}`
  .toLowerCase()
  .trim();

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

const jobCity = job.location?.city?.toLowerCase().trim();
const candidateCity = user?.location?.city?.toLowerCase().trim();

const locationMatched = jobCity === candidateCity;

console.log("JOB CITY:", jobCity);
console.log("CANDIDATE CITY:", candidateCity);
console.log("LOCATION MATCHED:", locationMatched);
console.log("MATCHED SKILLS:", matchedSkills);
console.log("MATCH SCORE:", matchScore);

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

console.log("FINAL SORTED RESULTS:", sortedResults);

    return res.status(200).json({
title: job.title,
      jobLocation: job.location,
      jobSkills,
      matchedCandidates: sortedResults,
    });

  // } catch (e) {
  //   console.error("getMatchedJobs error:", e);
  //   return res.status(500).json({ 
  //     message: "Some internal error"
  //    });
  // }
};

exports.getMatchedJobsForCandidate = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates can view matched jobs" });
    }

    const candidateSkillDoc = await Skill.findOne({
      candidateId: user.userId,
    });

    if (!candidateSkillDoc) {
      return res.status(404).json({ message: "No skills found for this candidate" });
    }

    const candidateSkills = candidateSkillDoc.skills || [];
    const candidateCity = user.location?.city?.toLowerCase().trim();

    const jobs = await Job.find({ status: "Open" }).lean();

    const results = [];

    for (const job of jobs) {
      const jobSkills = job.keySkills || [];
      const jobCity = job.location?.city?.toLowerCase().trim();

      const locationMatched = candidateCity === jobCity;

      const matchedSkills = jobSkills.filter((jobSkill) =>
        candidateSkills.some(
          (candidateSkill) =>
            candidateSkill.toLowerCase().includes(jobSkill.toLowerCase()) ||
            jobSkill.toLowerCase().includes(candidateSkill.toLowerCase())
        )
      );

      const matchScore =
        jobSkills.length > 0
          ? Math.round((matchedSkills.length / jobSkills.length) * 100)
          : 0;

      if (matchScore === 0 || !locationMatched) {
        continue;
      }

      if(matchScore <= 50){
        continue
      }

      results.push({
        jobId: job._id,
        title: job.title,
        companyUrl: job.companyUrl,
        location: job.location,
        salary: job.salary,
        jobType: job.jobType,
        workMode: job.workMode,
        matchedSkills,
        matchScore,
      });
    }

    const sortedResults = results.sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({
      matchedJobs: sortedResults,
    });
  } catch (error) {
    console.error("getMatchedJobsForCandidate error:", error);
    res.status(500).json({ message: "Failed to fetch matched jobs" });
  }
};

exports.getMatchedJobsForGuest = async (req, res) => {
  try {
    // get guestSessionId from URL
    const { guestSessionId } = req.query;

    if (!guestSessionId) {
      return res.status(400).json({
        message: "Guest session ID is required",
      });
    }

    // Go to SKill collection and Find Skills saved for this guest
    const guestSkill = await Skill.findOne({ guestSessionId });

    if (!guestSkill) {
      return res.status(404).json({
        message: "No skills found for this guest",
      });
    }

    const guestSkills = guestSkill.skills || [];


    //mongoose methods that tells mongodb - give me plain javascript obj. no need full mongoose doc.
    const jobs = await Job.find({ status: "Open" }).lean();

    const results = [];

    // Check every open job one by one
    for (const job of jobs) {
      const jobSkills = job.keySkills || [];

    // for each job skill, check if guest CV has a similar skill
      const matchedSkills = jobSkills.filter((jobSkill) =>
        //"Check all guest skills.
        // For each job skill, check weather at least one skill form the guest's CV
        // is similar or contains the same wording.
        // The .some() method returns true as soon as it finds one matching skill
        // If a match is found, this job skill is added to the matchedSkills array
        guestSkills.some(
          (guestSkill) =>
            guestSkill.toLowerCase().includes(jobSkill.toLowerCase()) ||
            jobSkill.toLowerCase().includes(guestSkill.toLowerCase())
        )
      );

      const matchScore =
        jobSkills.length > 0
          ? Math.round((matchedSkills.length / jobSkills.length) * 100)
          : 0;

      if (matchScore === 0) continue;
      if (matchScore <= 50) continue;
console.log("JOB OBJECT:", job);


console.log("JOB TITLE:", job.title);

results.push({
  jobId: job._id,
  title: job.title,
  companyUrl: job.companyUrl,
  location: job.location,
  salary: job.salary,
  jobType: job.jobType,
  workMode: job.workMode,
  matchedSkills,
  matchScore,
});
    }

    // array methods - .sort()
    // a and b are two elements from the array that JavaScript passes into the sort callback for comparison. THe callback returns a positive, negative, or zero value to tell JavaScript which item should come first
    const sortedResults = results.sort((a, b) => b.matchScore - a.matchScore);

    console.log(
  "MATCHED JOBS RESPONSE:",
  JSON.stringify(sortedResults, null, 2)
);

    return res.status(200).json({
      matchedJobs: sortedResults.slice(0, 5),
    });
      
  } catch (error) {
    console.error("getMatchedJobsForGuest error:", error);
    return res.status(500).json({
      message: "Failed to fetch guest matched jobs",
    });
  }
};