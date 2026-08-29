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


// ======================================================
// HELPER: CALCULATE APPLICATION MATCH
// ======================================================

const calculateMatch = (
  candidateSkills = [],
  jobSkills = [],
  candidateLocation,
  jobLocation
) => {
  const normalizedCandidateSkills =
    candidateSkills.map(normalizeSkill);

  /*
   * Find skills that exist in both:
   *
   * candidate CV skills
   * job required skills
   */
  const matchedSkills = jobSkills.filter(
    (jobSkill) =>
      normalizedCandidateSkills.includes(
        normalizeSkill(jobSkill)
      )
  );

  /*
   * Required job skills the candidate does
   * NOT currently have.
   */
  const missingSkills = jobSkills.filter(
    (jobSkill) =>
      !normalizedCandidateSkills.includes(
        normalizeSkill(jobSkill)
      )
  );

  const normalizedCandidateLocation =
    normalizeLocation(candidateLocation);

  const normalizedJobLocation =
    normalizeLocation(jobLocation);

  const locationMatch = Boolean(
    normalizedCandidateLocation &&
      normalizedJobLocation &&
      normalizedCandidateLocation ===
        normalizedJobLocation
  );

  /*
   * Your existing scoring:
   *
   * Skills   = max 80 points
   * Location = max 20 points
   */
  const skillScore =
    jobSkills.length > 0
      ? (matchedSkills.length /
          jobSkills.length) *
        80
      : 0;

  const locationScore =
    locationMatch ? 20 : 0;

  const matchScore = Math.round(
    skillScore + locationScore
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

    /*
     *
     * Job.companyId now references Company.
     *
     * Job.createdBy references the recruiter
     * who originally created the vacancy.
     *
     * We populate BOTH.
     */
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

    /*
     * Job must:
     *
     * - still be Open
     * - not be expired
     * - still have vacancies
     */
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

    /*
     * Prevent duplicate applications.
     *
     * You also have a database unique index,
     * so this is frontend-friendly protection.
     */
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

    /*
     * Use explicitly chosen CV if cvId exists.
     *
     * Otherwise use candidate's latest CV.
     */
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

    /*
     * CHANGED:
     *
     * OLD:
     *
     * companyId: job.companyId.userId
     *
     * That stored the recruiter's numeric ID.
     *
     *
     * NEW:
     *
     * job.companyId is the actual populated
     * Company document.
     *
     * Application.companyId stores Company._id.
     */
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

    /*
     * CHANGED:
     *
     * CompanyModel does not contain recruiter email.
     *
     * The recruiter who created the job is stored
     * in Job.createdBy.
     *
     * Therefore:
     *
     * job.createdBy.email
     *
     * receives the application notification.
     */
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

    /*
     * FIX:
     *
     * Your previous code had:
     *
     * res.statue(400)
     *
     * which is a typo.
     */
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

      /*
       * NEW:
       *
       * A company user MUST now belong
       * to an actual Company.
       */
      if (!user.companyId) {
        return res.status(400).json({
          success: false,

          message:
            "Your account is not linked to a company",
        });
      }

      /*
       * CHANGED:
       *
       * OLD:
       *
       * companyId: user._id
       *
       * NEW:
       *
       * companyId: user.companyId
       *
       * This means all recruiters belonging
       * to the same company see the same jobs.
       */
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

      /*
       * CHANGED:
       *
       * Applications now belong to Company._id,
       * not company user's numeric userId.
       */
      const applications =
        await Application.find({
          companyId:
            user.companyId,
        }).lean();

      /*
       * NEW:
       *
       * Only recommend candidates who have NOT
       * disabled recruiter visibility.
       *
       * $ne: false also allows old candidate
       * documents that do not yet physically
       * contain availableForWork.
       */
      const candidates =
        await User.find({
          role:
            "candidate",

          availableForWork: {
            $ne: false,
          },
        }).lean();

      /*
       * Candidate accepted anywhere in the
       * platform should no longer appear in
       * recruiter recommendations.
       */
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
          /*
           * Don't recommend a candidate who
           * has already been accepted elsewhere.
           */
          if (
            acceptedCandidateIds.has(
              Number(
                candidate.userId
              )
            )
          ) {
            continue;
          }

          /*
           * Don't recommend someone who already
           * applied for THIS specific job.
           */
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
            candidate.location,
            job.location
          );

          /*
           * Don't recommend a candidate
           * with absolutely no match.
           */
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

            /*
             * TODO:
             *
             * We will remove/hide this during
             * the Candidate Privacy task.
             *
             * For now it remains so we don't
             * break your existing frontend.
             */
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
      /*
       * Candidate logic stays the same.
       *
       * Application.candidateId still uses
       * your numeric User.userId.
       */
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

      /*
       * CHANGED:
       *
       * OLD:
       *
       * companyId: user.userId
       *
       * NEW:
       *
       * companyId: user.companyId
       *
       * Therefore Alice and Bob from the
       * same company can see applications
       * belonging to their company.
       */
      applications =
        await Application.find({
          companyId:
            user.companyId,
        })
          .sort({
            appliedDate: -1,
          })
          .lean();

      /*
       * Add candidate details and CV
       * information to each application.
       */
      applications =
        await Promise.all(
          applications.map(
            async (app) => {
              const candidate =
                await User.findOne({
                  userId:
                    app.candidateId,
                }).lean();

              /*
               * Prefer the CV actually used
               * during the application.
               *
               * If not available, fall back
               * to latest candidate CV.
               */
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

                /*
                 * TODO:
                 * Candidate privacy task will
                 * remove this from recruiter view.
                 */
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
      /*
       * New status sent by frontend.
       */
      const { status } =
        req.body;

      const allowedStatuses = [
        "pending",
        "reviewing",
        "interview",
        "rejected",
        "accepted",
      ];

      /*
       * Prevent random/invalid values.
       */
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

      /*
       * Find logged-in company user.
       */
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

      /*
       * Company user must belong to
       * a real Company.
       */
      if (!user.companyId) {
        return res.status(400).json({
          success: false,

          message:
            "Your account is not linked to a company",
        });
      }

      /*
       * Find application.
       */
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

      /*
       * CHANGED SECURITY CHECK:
       *
       * OLD:
       *
       * application.companyId !== user.userId
       *
       * NEW:
       *
       * compare Company._id values.
       *
       * ObjectIds should be converted to strings
       * before comparison.
       */
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

      /*
       * Save previous status so we know
       * whether this is actually a transition.
       */
      const previousStatus =
        application.status;

      /*
       * No need to update anything if
       * the status hasn't changed.
       */
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

      /*
       * Find the related job.
       */
      const job =
        await Job.findById(
          application.jobId
        );

      /*
       * Extra security:
       *
       * The job should also belong to this
       * same company.
       */
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


      // ==================================================
      // MOVING INTO ACCEPTED
      // ==================================================

      if (
        status === "accepted" &&
        previousStatus !==
          "accepted"
      ) {
        /*
         * Candidate can only be accepted
         * once across the platform.
         */
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

        /*
         * Make sure vacancy still exists.
         */
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


      // ==================================================
      // MOVING AWAY FROM ACCEPTED
      // ==================================================

      /*
       * FIX:
       *
       * Your old code increased filledPositions
       * when status became accepted,
       * but did not decrease it if a manager
       * later changed:
       *
       * accepted -> rejected
       *
       * or
       *
       * accepted -> reviewing
       *
       * This would make vacancy counts incorrect.
       */
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


// ======================================================
// EXPORT CONTROLLERS
// ======================================================

module.exports = {
  applyForJob,
  getApplications,
  updateApplicationStatus,
  getRecommendedCandidates,
};


/*
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