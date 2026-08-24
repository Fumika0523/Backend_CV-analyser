// utils/validateEmailForOtp.js
const { resolveMx } = require("node:dns").promises;

// Common typing mistakes for popular email providers.
const COMMON_DOMAIN_TYPOS = {
  "gmaill.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",

  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",

  "outlok.com": "outlook.com",
  "outllook.com": "outlook.com",

  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
};

const validateEmailForOtp = async (rawEmail) => {
  // Make sure the received value is a string.
  const email =
    typeof rawEmail === "string"
      ? rawEmail.trim().toLowerCase()
      : "";

  // Check the basic email structure.
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!emailPattern.test(email)) {
    return {
      status: "invalid-format",
      email,
      message: "Please enter a valid email address.",
    };
  }

  const atPosition = email.lastIndexOf("@");
  const localPart = email.slice(0, atPosition);
  const domain = email.slice(atPosition + 1);

  // Detect common mistakes such as gmaill.com.
  const correctedDomain = COMMON_DOMAIN_TYPOS[domain];

  if (correctedDomain) {
    const suggestion = `${localPart}@${correctedDomain}`;

    return {
      status: "invalid-domain",
      email,
      suggestion,
      message: `This email domain looks incorrect. Did you mean ${suggestion}?`,
    };
  }

  try {

    //Node’s resolveMx() performs a DNS query for the domain’s mail-exchange records. It returns the available mail servers or rejects with a DNS error such as no data/domain not found. Node.js DNS documentation
    const mxRecords = await resolveMx(domain);

    const hasUsableMailServer = mxRecords.some(
      (record) => record.exchange && record.exchange !== "."
    );

    if (!hasUsableMailServer) {
      return {
        status: "invalid-domain",
        email,
        message:
          "This email domain cannot receive emails. Please check the spelling.",
      };
    }

    return {
      status: "valid",
      email,
      message: "Email domain is valid.",
    };
  } catch (error) {
    // These mean that the domain or its mail records do not exist.
    const invalidDomainCodes = [
      "ENOTFOUND",
      "ENODATA",
      "EFORMERR",
      "EBADNAME",
    ];

    if (invalidDomainCodes.includes(error.code)) {
      return {
        status: "invalid-domain",
        email,
        message:
          "This email domain does not exist or cannot receive emails.",
      };
    }

    // Timeout or DNS-server failure is not proof that the email is invalid.
    // However, registration should not continue without completing the check.
    console.error("Email DNS check failed:", error);

    const verificationError = new Error(
      "We could not verify the email domain. Please try again."
    );

    verificationError.statusCode = 503;
    throw verificationError;
  }
};

module.exports = validateEmailForOtp;