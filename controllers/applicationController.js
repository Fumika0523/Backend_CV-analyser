const Application = require("../Model/applicationModel");
const User = require("../Model/UserModel");
const Job = require("../Model/jobModel");
const sendEmail = require("../utils/sendEmail");
const CV = require("../Model/CVModel");

const {
  candidateApplicationTemplate,
  companyApplicationTemplate,
} = require("../utils/emailTemplates");


// ======================================================
// HELPER: NORMALIZE SKILL
// ======================================================

const normalizeSkill = (skill) => {
  return skill
    ?.toString()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .trim();
};


// ======================================================
// HELPER: NORMALIZE LOCATION
// ======================================================

const normalizeLocation = (location) => {
  if (!location) return "";

  if (typeof location === "string") {
    return location.toLowerCase().trim();
  }

  if (typeof location === "object") {
    /*
     * Your current application match logic uses
     * the CITY when a location object is provided.
     *
     * Example:
     *
     * candidate.location.city = "Manchester"
     * job.location.city       = "Manchester"
     *
     * => locationMatch = true
     */
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

  return location
    .toString()
    .toLowerCase()
    .trim();
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
// ======================================================
// HELPER: CALCULATE APPLICATION MATCH
// ======================================================

const calculateMatch = (
  candidateSkills = [],
  jobSkills = [],
  candidateLocation,
  jobLocation
) => {
  /*
   * Normalize candidate skills.
   *
   * Example:
   * "React.js" -> "reactjs"
   */
  const normalizedCandidateSkills =
    candidateSkills
      .map(normalizeSkill)
      .filter(Boolean);

  /*
   * Check whether two skills match.
   *
   * Exact:
   * React.js <-> React JS
   *
   * Approximate:
   * React.js <-> React
   */
  const isSkillMatch = (
    candidateSkill,
    jobSkill
  ) => {
    const candidate =
      normalizeSkill(candidateSkill);

    const job =
      normalizeSkill(jobSkill);

    if (!candidate || !job) {
      return false;
    }

    if (candidate === job) {
      return true;
    }

    /*
     * Avoid bad partial matches for
     * very short skills such as:
     *
     * C
     * R
     */
    if (
      candidate.length < 3 ||
      job.length < 3
    ) {
      return false;
    }

    return (
      candidate.includes(job) ||
      job.includes(candidate)
    );
  };

  /*
   * Skills that the candidate has.
   */
  const matchedSkills =
    jobSkills.filter((jobSkill) =>
      normalizedCandidateSkills.some(
        (candidateSkill) =>
          isSkillMatch(
            candidateSkill,
            jobSkill
          )
      )
    );

  /*
   * Skills required by the job
   * that the candidate does not have.
   */
  const missingSkills =
    jobSkills.filter(
      (jobSkill) =>
        !normalizedCandidateSkills.some(
          (candidateSkill) =>
            isSkillMatch(
              candidateSkill,
              jobSkill
            )
        )
    );

  /*
   * IMPORTANT:
   *
   * Match candidate COUNTRY against
   * JOB country.
   *
   * Do NOT use Company.location.
   */
  const candidateCountry =
    normalizeCountry(
      candidateLocation?.country
    );

  const jobCountry =
    normalizeCountry(
      jobLocation?.country
    );

  const locationMatch = Boolean(
    candidateCountry &&
      jobCountry &&
      candidateCountry === jobCountry
  );

  /*
   * Matching score:
   *
   * Skills   = maximum 80 points
   * Location = maximum 20 points
   */
  const skillScore =
    jobSkills.length > 0
      ? (matchedSkills.length /
          jobSkills.length) *
        80
      : 0;

  const locationScore =
    locationMatch ? 20 : 0;

  const matchScore =
    Math.round(
      skillScore +
        locationScore
    );

  return {
    matchedSkills,
    missingSkills,
    locationMatch,
    matchScore,
  };
};

// ======================================================
// APPLY FOR JOB
// ======================================================

const applyForJob = async (req, res) => {
  try {
    const { jobId, cvId } = req.body;

    /*
     * Candidate user.
     *
     * req.user.id = MongoDB User._id
     */
    const user = await User.findById(
      req.user.id
    ).lean();

    if (
      !user ||
      user.role !== "candidate"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only candidates can apply for jobs",
      });
    }

    const job = await Job.findById(jobId)
      .populate(
        "companyId",
        "companyName companyDescription companyUrl location isActive"
      )
      .populate(
        "createdBy",
        "firstName lastName email"
      )
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    /*
     * don't accept applications for jobs
     * belonging to disabled companies.
     */
    if (
      job.companyId?.isActive === false
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This company is currently unavailable",
      });
    }

    const currentDate = new Date();


    if (
      job.status !== "Open" ||
      new Date(job.applicationEndDate) <
        currentDate ||
      job.filledPositions >= job.vacancies
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This job is no longer open for applications",
      });
    }


    const alreadyApplied =
      await Application.findOne({
        candidateId: user.userId,
        jobId,
      }).lean();

    if (alreadyApplied) {
      return res.status(400).json({
        success: false,
        message:
          "You already applied for this job",
      });
    }

    const cv = cvId
      ? await CV.findById(cvId).lean()
      : await CV.findOne({
          candidateId: user.userId,
        })
          .sort({
            version: -1,
          })
          .lean();

    const candidateSkills =
      cv?.skills ||
      cv?.skillsDetected ||
      [];

    const jobSkills =
      job.keySkills || [];

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

   
    const application =
      await Application.create({
        candidateId:
          user.userId,

        companyId:
          job.companyId._id,

        jobId:
          job._id,

        title:
          job.title,

        companyName:
          job.companyId?.companyName ||
          "Company",

        cvId:
          cv?._id || null,

        status:
          "pending",

        matchScore,

        matchedSkills,

        missingSkills,

        locationMatch,

        note: "",
      });

    /*
     * Candidate confirmation email.
     */
    const candidateHtml =
      candidateApplicationTemplate(
        user,
        job
      );

    /*
     * Company/recruiter notification email.
     */
    const companyHtml =
      companyApplicationTemplate(
        user,
        job
      );

    await sendEmail({
      to: user.email,

      subject:
        "Application submitted successfully",

      html:
        candidateHtml,
    });

    if (job.createdBy?.email) {
      await sendEmail({
        to: job.createdBy.email,

        subject:
          "New job application received",

        html:
          companyHtml,
      });
    }

    return res.status(201).json({
      success: true,

      message:
        "Application submitted successfully",

      application,
    });
  } catch (error) {
    console.error(
      "Apply Job Error:",
      error
    );


    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message:
          "You have already applied for this job.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


// ======================================================
// GET RECOMMENDED CANDIDATES
// ======================================================

const getRecommendedCandidates =
  async (req, res) => {
    try {
      /*
       * Get logged-in company user.
       */
      const user = await User.findById(
        req.user.id
      ).lean();

      if (
        !user ||
        user.role !== "company"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Only companies can view recommended candidates",
        });
      }


      if (!user.companyId) {
        return res.status(400).json({
          success: false,

          message:
            "Your account is not linked to a company",
        });
      }


      const jobs = await Job.find({
        companyId:
          user.companyId,

        status:
          "Open",

        applicationEndDate: {
          $gte: new Date(),
        },

        $expr: {
          $lt: [
            "$filledPositions",
            "$vacancies",
          ],
        },
      }).lean();

      const applications =
        await Application.find({
          companyId:
            user.companyId,
        }).lean();

 
      const candidates =
        await User.find({
          role:
            "candidate",

          availableForWork: {
            $ne: false,
          },
        }).lean();

      const acceptedCandidateIds =
        new Set(
          (
            await Application.distinct(
              "candidateId",
              {
                status:
                  "accepted",
              }
            )
          ).map(Number)
        );

      const results = [];

      for (const job of jobs) {
        for (
          const candidate
          of candidates
        ) {
   
          if (
            acceptedCandidateIds.has(
              Number(
                candidate.userId
              )
            )
          ) {
            continue;
          }
          const alreadyApplied =
            applications.some(
              (app) =>
                Number(
                  app.candidateId
                ) ===
                  Number(
                    candidate.userId
                  ) &&
                app.jobId.toString() ===
                  job._id.toString()
            );

          if (alreadyApplied) {
            continue;
          }

          /*
           * Find candidate's newest CV.
           */
          const cv =
            await CV.findOne({
              candidateId:
                candidate.userId,
            })
              .sort({
                version: -1,
              })
              .lean();

          if (!cv) {
            continue;
          }

        const candidateSkillDoc =
  await Skill.findOne({
    candidateId: candidate.userId,
  }).lean();

if (!candidateSkillDoc) {
  continue;
}

const candidateSkills =
  Array.isArray(candidateSkillDoc.skills)
    ? candidateSkillDoc.skills.filter(Boolean)
    : [];

if (candidateSkills.length === 0) {
  continue;
}

const jobSkills =
  Array.isArray(job.keySkills)
    ? job.keySkills.filter(Boolean)
    : [];

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

          if (matchScore === 0) {
            continue;
          }

          results.push({
            candidateId:
              candidate.userId,

            candidateName:
              `${candidate.firstName || ""} ${
                candidate.lastName || ""
              }`.trim(),

   
            candidateEmail:
              candidate.email,

            jobTitle:
              job.title,

            jobId:
              job._id,

            cvFilePath:
              cv.filePath,

            matchScore,

            matchedSkills,

            missingSkills,

            locationMatch,

            contactStatus:
              "Need to contact",
          });
        }
      }

      /*
       * Highest match first.
       */
      results.sort(
        (a, b) =>
          b.matchScore -
          a.matchScore
      );

      return res.status(200).json({
        success: true,

        count:
          results.length,

        candidates:
          results,
      });
    } catch (error) {
      console.error(
        "Recommended Candidates Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server Error",
      });
    }
  };

// ======================================================
// GET APPLICATIONS
// ======================================================

const getApplications = async (
  req,
  res
) => {
  try {
    const user = await User.findById(
      req.user.id
    ).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    let applications = [];

    // ==================================================
    // CANDIDATE APPLICATIONS
    // ==================================================

    if (
      user.role === "candidate"
    ) {
  
      applications =
        await Application.find({
          candidateId:
            user.userId,
        })
          .sort({
            appliedDate: -1,
          })
          .lean();
    }

    // ==================================================
    // COMPANY APPLICATIONS
    // ==================================================

    if (
      user.role === "company"
    ) {
      /*
       * NEW safety check.
       */
      if (!user.companyId) {
        return res.status(400).json({
          success: false,

          message:
            "Your account is not linked to a company",
        });
      }

      applications =
        await Application.find({
          companyId:
            user.companyId,
        })
          .sort({
            appliedDate: -1,
          })
          .lean();

      applications =
        await Promise.all(
          applications.map(
            async (app) => {
              const candidate =
                await User.findOne({
                  userId:
                    app.candidateId,
                }).lean();

              const cv = app.cvId
                ? await CV.findById(
                    app.cvId
                  ).lean()
                : await CV.findOne({
                    candidateId:
                      app.candidateId,
                  })
                    .sort({
                      version: -1,
                    })
                    .lean();

              return {
                ...app,

                candidateName:
                  candidate
                    ? `${candidate.firstName || ""} ${
                        candidate.lastName || ""
                      }`.trim()
                    : `Candidate ${app.candidateId}`,

                candidateEmail:
                  candidate?.email ||
                  "",

                cvFilePath:
                  cv?.filePath ||
                  "",

                applicationType:
                  "already_applied",
              };
            }
          )
        );
    }

    return res.status(200).json({
      success: true,

      count:
        applications.length,

      applications,
    });
  } catch (error) {
    console.error(
      "Get Applications Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server Error",
    });
  }
};


// ======================================================
// UPDATE APPLICATION STATUS
// ======================================================

const updateApplicationStatus =
  async (req, res) => {
    try {

      const { status } =
        req.body;

      const allowedStatuses = [
        "pending",
        "reviewing",
        "interview",
        "rejected",
        "accepted",
      ];


      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid status",
        });
      }

      const user =
        await User.findById(
          req.user.id
        );

      if (
        !user ||
        user.role !== "company"
      ) {
        return res.status(403).json({
          success: false,

          message:
            "Only companies can update application status",
        });
      }

      if (!user.companyId) {
        return res.status(400).json({
          success: false,

          message:
            "Your account is not linked to a company",
        });
      }

      const application =
        await Application.findById(
          req.params.id
        );

      if (!application) {
        return res.status(404).json({
          success: false,

          message:
            "Application not found",
        });
      }

      if (
        application.companyId.toString() !==
        user.companyId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Unauthorized",
        });
      }

      const previousStatus =
        application.status;

      if (
        previousStatus === status
      ) {
        return res.status(200).json({
          success: true,

          message:
            "Application status is already up to date",

          application,
        });
      }

      const job =
        await Job.findById(
          application.jobId
        );

      if (
        job &&
        job.companyId.toString() !==
          user.companyId.toString()
      ) {
        return res.status(403).json({
          success: false,

          message:
            "You are not authorized to manage this job",
        });
      }

      if (
        status === "accepted" &&
        previousStatus !==
          "accepted"
      ) {
    
        const alreadyAcceptedApplication =
          await Application.findOne({
            candidateId:
              application.candidateId,

            status:
              "accepted",

            _id: {
              $ne:
                application._id,
            },
          });

        if (
          alreadyAcceptedApplication
        ) {
          return res.status(400).json({
            success: false,

            message:
              "This candidate has already been accepted for another job.",
          });
        }

        if (
          job &&
          job.filledPositions >=
            job.vacancies
        ) {
          return res.status(400).json({
            success: false,

            message:
              "This job has already filled all vacancies.",
          });
        }

        /*
         * Save when candidate was accepted.
         */
        application.acceptedAt =
          new Date();

        if (job) {
          /*
           * Increase number of filled jobs.
           */
          job.filledPositions += 1;

          /*
           * Close automatically when all
           * vacancies have been filled.
           */
          if (
            job.filledPositions >=
            job.vacancies
          ) {
            job.status =
              "Closed";
          }

          await job.save();
        }
      }

      if (
        previousStatus ===
          "accepted" &&
        status !== "accepted"
      ) {
        application.acceptedAt =
          null;

        if (job) {
          /*
           * Never let filledPositions
           * become negative.
           */
          job.filledPositions =
            Math.max(
              0,
              job.filledPositions -
                1
            );

          /*
           * Reopen the job only when:
           *
           * - vacancies are available
           * - application deadline hasn't passed
           *
           * Otherwise it stays Closed/Expired.
           */
          const stillWithinDeadline =
            new Date(
              job.applicationEndDate
            ) >= new Date();

          if (
            job.filledPositions <
              job.vacancies &&
            stillWithinDeadline
          ) {
            job.status =
              "Open";
          }

          await job.save();
        }
      }

      /*
       * Finally update the application.
       */
      application.status =
        status;

      await application.save();

      return res.status(200).json({
        success: true,

        message:
          "Application status updated",

        application,
      });
    } catch (error) {
      console.error(
        "Update Status Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server Error",
      });
    }
  };

module.exports = {
  applyForJob,
  getApplications,
  updateApplicationStatus,
  getRecommendedCandidates,
};


/*CV
 └─ proves candidate has a CV
 └─ gives us CV file

Skill
 └─ provides extracted skills
 └─ used for job matching
 *
 * Company recruiter changes application
 * status to:
 *
 * accepted
 *      ↓
 * acceptedAt saved
 *      ↓
 * Job.filledPositions + 1
 *      ↓
 * filledPositions >= vacancies?
 *      ↓ YES
 * Job.status = Closed
 *      ↓
 * Application remains in database
 *
 *
 * If accepted status is later reversed:
 *
 * accepted -> rejected/reviewing/etc.
 *      ↓
 * acceptedAt = null
 *      ↓
 * Job.filledPositions - 1
 *      ↓
 * If vacancy exists and deadline is valid
 *      ↓
 * Job reopens
 */