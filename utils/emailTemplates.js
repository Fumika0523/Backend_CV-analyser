// utils/emailTemplates.js

const brandName = "SkillfulJobs.ai";
const appUrl = "http://localhost:3000";

const logoHtml = `
  <div style="
    font-size:26px;
    font-weight:700;
    letter-spacing:-0.5px;
    color:white;
  ">
    SkillfulJobs.ai
  </div>
`;

const emailWrapper = (title, content) => `
  <div style="background:#EFF6FF;padding:40px;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:auto;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 6px 18px rgba(29, 78, 183, 0.78);">

      <div style="background:linear-gradient(135deg,#2563EB,#60A5FA);padding:30px;text-align:center;">
        ${logoHtml}
        <p style="color: color:#FFFFFF;;margin-top:10px;margin-bottom:0;">
          ${title}
        </p>
      </div>

      <div style="padding:30px;">
        ${content}
      </div>

      <div style="background:#F8FAFC;color:#64748B;text-align:center;padding:15px;font-size:12px;border-top:1px solid #DBEAFE;">
        © 2026 ${brandName}
      </div>

    </div>
  </div>
`;

const candidateApplicationTemplate = (user, job) => {
  return emailWrapper(
    "Job Application Confirmation",
    `
      <h2 style="color:#0F172A;">Hello ${user.firstName || "there"},</h2>

      <p style="color:#475569;">
        Thank you for applying through ${brandName}. Your application has been submitted successfully.
      </p>

      <div style="background:#F8FAFC;border-left:4px solid #2563EB;padding:20px;margin:25px 0;border-radius:8px;">
        <p><strong>Position:</strong> ${job.title}</p>
        <p><strong>Company:</strong> ${job.companyId.companyName || "Company"}</p>
        <p>
          <strong>Status:</strong>
          <span style="background:#DCFCE7;color:#166534;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:bold;">
            PENDING REVIEW
          </span>
        </p>
      </div>

      <div style="text-align:center;margin-top:30px;">
        <a href="${appUrl}/my-applications"
          style="background:#2563EB;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;">
          View Applications
        </a>
      </div>

      <p style="margin-top:30px;color:#64748B;">
        Best wishes,<br>
        <strong>${brandName} Team</strong>
      </p>
    `
  );
};

const companyApplicationTemplate = (user, job) => {
  return emailWrapper(
    "New Job Application Received",
    `
      <h2 style="color:#0F172A;">
        Hello ${job.companyId.companyName || "there"},
      </h2>

      <p style="color:#475569;">
        A new candidate has applied for one of your job posts on ${brandName}.
      </p>

      <div style="background:#F8FAFC;border-left:4px solid #2563EB;padding:20px;margin:25px 0;border-radius:8px;">
        <p><strong>Position:</strong> ${job.title}</p>
        <p><strong>Candidate:</strong> ${user.firstName || ""} ${user.lastName || ""}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p>
          <strong>Status:</strong>
          <span style="background:#DBEAFE;color:#1E40AF;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:bold;">
            NEW APPLICATION
          </span>
        </p>
      </div>

      <div style="text-align:center;margin-top:30px;">
        <a href="${appUrl}/company/applications"
          style="background:#2563EB;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;">
          Review Candidate
        </a>
      </div>

      <p style="margin-top:30px;color:#64748B;">
        Regards,<br>
        <strong>${brandName} Team</strong>
      </p>
    `
  );
};

const otpEmailTemplate = (otp) => {
  return emailWrapper(
    "Email Verification Code",
    `
      <h2 style="color:#0F172A;">Verify your email</h2>

      <p style="color:#475569;">
        Please use the verification code below to complete your account verification.
      </p>

      <div style="text-align:center;margin:30px 0;">
        <div style="display:inline-block;background:#EFF6FF;color:#2563EB;font-size:32px;font-weight:bold;letter-spacing:6px;padding:18px 28px;border-radius:10px;border:1px solid #BFDBFE;">
          ${otp}
        </div>
      </div>

      <p style="color:#475569;">
        This code is valid for <strong>5 minutes</strong>.
      </p>

      <p style="color:#94A3B8;font-size:13px;">
        If you did not request this code, you can safely ignore this email.
      </p>

      <p style="margin-top:30px;color:#64748B;">
        Regards,<br>
        <strong>${brandName} Team</strong>
      </p>
    `
  );
};

module.exports = {
  candidateApplicationTemplate,
  companyApplicationTemplate,
  otpEmailTemplate,
};