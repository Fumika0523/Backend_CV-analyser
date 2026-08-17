const Job = require("../Model/jobModel");
const Skill = require('../Model/skillsModel')
const User = require("../Model/UserModel");
const CV = require("../Model/CVModel");
const Application = require("../Model/applicationModel");

// CREATE JOB POST - company only
exports.createJobPost = async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can post jobs" });
    }

   const {
  title,
  jobType,
  workMode,
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
  vacancies,
} = req.body

    let formattedLocation = location;

    if (typeof location === "string") {
      const [city, country] = location.split(",").map((item) => item.trim());

      formattedLocation = {
        city: city || "",
        country: country || "",
      };
    }

    const job = await Job.create({
      companyId: req.user.id,
      title,
      jobType,
      workMode,
      education,
      experience,
      keySkills,
      location: formattedLocation,
      responsibilities,
      companyUrl,
      roleSummary,
      compensationBenefits,
      requirements,
      applicationEndDate,
      salary,
      vacancies: Number(vacancies) || 1,
filledPositions: 0,
    });

    res.status(201).json({
      message: "Job created successfully",
      job,
    });
  } catch (error) {
    console.error("Create job error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

// GET ALL JOBS
exports.getAllJobPosts = async (req, res) => {
  try {
    const currentDate = new Date();

    const jobs = await Job.find({
      status: "Open",
      applicationEndDate: { $gte: currentDate },
      $expr: {
        $lt: ["$filledPositions", "$vacancies"],
      },
    })
      .populate(
        "companyId",
        "firstName lastName companyName email city country"
      )
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(jobs);
  } catch (error) {
    console.error("Get all jobs error:", error);

    res.status(500).json({
      message: "Server error",
    });
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
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.companyId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updateData = { ...req.body };

    if (updateData.vacancies !== undefined) {
  updateData.vacancies = Number(updateData.vacancies) || 1;
}

    if (typeof updateData.location === "string") {
      const [city, country] = updateData.location
        .split(",")
        .map((item) => item.trim());

      updateData.location = {
        city: city || "",
        country: country || "",
      };
    }

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      message: "Job updated successfully",
      job: updatedJob,
    });
  } catch (error) {
    console.error("Update job error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
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

    job.status = "Closed";
    await job.save();

    res.status(200).json({
      message: "Job closed successfully",
      job,
    });
  } catch (error) {
    console.error("Close job error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const normalizeCountry = (country) => {
  const value = String(country || "")
    .toLowerCase()
    .replace(/\./g, "")
    .trim();

  const aliases = {
    uk: "united kingdom",
    "u k": "united kingdom",
    gb: "united kingdom",
    "great britain": "united kingdom",
    england: "united kingdom",
    scotland: "united kingdom",
    wales: "united kingdom",
    "northern ireland": "united kingdom",
  };

  return aliases[value] || value;
};

const normalizeSkill = (skill) =>
  String(skill || "").toLowerCase().trim();

// Find matching candidates for a particular job
exports.getMatchedJobsForCompany = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        message: "Job ID is required",
      });
    }

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    const jobSkills = Array.isArray(job.keySkills)
      ? job.keySkills.filter(Boolean)
      : [];

    console.log("JOB ID:", jobId);
    console.log("JOB SKILLS:", jobSkills);
    console.log("JOB LOCATION:", job.location);

    if (jobSkills.length === 0) {
      return res.status(200).json({
        title: job.title,
        jobLocation: job.location,
        jobSkills: [],
        matchedCandidates: [],
        message: "This job does not have any key skills",
      });
    }

    const candidateSkillDocuments = await Skill.find({
      candidateId: { $ne: null },
    });

    if (candidateSkillDocuments.length === 0) {
      return res.status(200).json({
        title: job.title,
        jobLocation: job.location,
        jobSkills,
        matchedCandidates: [],
        message: "No candidate skills found",
      });
    }

    const acceptedCandidateIds = new Set(
      (
        await Application.distinct("candidateId", {
          status: "accepted",
        })
      ).map(Number)
    );

    const results = [];

    for (const candidateSkillDocument of candidateSkillDocuments) {
      // Supports both number and numeric-string candidate IDs
      const candidateId = Number(
        candidateSkillDocument.candidateId
      );

      console.log("CHECKING CANDIDATE:", candidateId);

      if (!Number.isFinite(candidateId)) {
        console.log(
          "Skipping invalid candidateId:",
          candidateSkillDocument.candidateId
        );
        continue;
      }

      // Set uses .has(), not .includes()
      if (acceptedCandidateIds.has(candidateId)) {
        console.log(
          "Skipping already accepted candidate:",
          candidateId
        );
        continue;
      }

      const candidateSkills = Array.isArray(
        candidateSkillDocument.skills
      )
        ? candidateSkillDocument.skills.filter(Boolean)
        : [];

      console.log("CANDIDATE SKILLS:", candidateSkills);

      const matchedSkills = jobSkills.filter((jobSkill) => {
        const normalizedJobSkill = normalizeSkill(jobSkill);

        return candidateSkills.some((candidateSkill) => {
          const normalizedCandidateSkill =
            normalizeSkill(candidateSkill);

          return (
            normalizedCandidateSkill === normalizedJobSkill ||
            normalizedCandidateSkill.includes(
              normalizedJobSkill
            ) ||
            normalizedJobSkill.includes(
              normalizedCandidateSkill
            )
          );
        });
      });

      const matchScore = Math.round(
        (matchedSkills.length / jobSkills.length) * 100
      );

      console.log("MATCHED SKILLS:", matchedSkills);
      console.log("MATCH SCORE:", matchScore);

      // Candidate must have at least one matching skill
      if (matchScore === 0) {
        console.log(
          "Skipping because no skills matched:",
          candidateId
        );
        continue;
      }

      const user = await User.findOne({
        userId: candidateId,
      });

      if (!user) {
        console.log(
          "Skipping because User was not found:",
          candidateId
        );
        continue;
      }

      const jobCountry = normalizeCountry(
        job.location?.country
      );

      const candidateCountry = normalizeCountry(
        user.location?.country
      );

      const locationMatched = Boolean(
        jobCountry &&
          candidateCountry &&
          jobCountry === candidateCountry
      );

      console.log("JOB COUNTRY:", jobCountry);
      console.log("CANDIDATE COUNTRY:", candidateCountry);
      console.log("COUNTRY MATCHED:", locationMatched);

      // Only allow candidates from the same country
      if (!locationMatched) {
        console.log(
          "Skipping because countries do not match:",
          candidateId
        );
        continue;
      }

      const cv = await CV.findOne({
        candidateId,
      }).sort({
        version: -1,
      });

      results.push({
        candidateId,
        candidateName:
          `${user.firstName || ""} ${
            user.lastName || ""
          }`.trim() || `Candidate ${candidateId}`,
        email: user.email || "",
        candidateLocation: user.location || null,
        locationMatched,
        matchedSkills,
        totalJobSkills: jobSkills.length,
        matchScore,
        cvPath: cv?.filePath || null,
      });
    }

    const sortedResults = results.sort(
      (a, b) => b.matchScore - a.matchScore
    );

    console.log(
      "FINAL SORTED RESULTS:",
      sortedResults
    );

    return res.status(200).json({
      title: job.title,
      jobLocation: job.location,
      jobSkills,
      matchedCandidates: sortedResults,
    });
  } catch (error) {
    console.error(
      "getMatchedJobsForCompany error:",
      error
    );

    return res.status(500).json({
      message: "Failed to fetch matching candidates",
    });
  }
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
   const candidateCountry = normalizeCountry(user.location?.country);
    const currentDate = new Date();

    const appliedApplications = await Application.find({
  candidateId: user.userId,
}).select("jobId");

const appliedJobIds = appliedApplications.map((app) => app.jobId);

    const jobs = await Job.find({
      status: "Open",
      applicationEndDate: { $gte: currentDate },
       _id: { $nin: appliedJobIds },
    }).lean();

    const results = [];

    
    for (const job of jobs) {
      const jobSkills = job.keySkills || [];
    const jobCountry = normalizeCountry(job.location?.country);

const locationMatched = Boolean(
  candidateCountry &&
  jobCountry &&
  candidateCountry === jobCountry
);

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
    const currentDate = new Date();

const jobs = await Job.find({
  status: "Open",
  applicationEndDate: { $gte: currentDate },
}).lean();

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
  // companyUrl: job.companyUrl,
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