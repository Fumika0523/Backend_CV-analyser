// Display metadata only. Storage names and paths must remain server-generated.
const sanitizeOriginalFileName = (value) => {
  if (typeof value !== "string") return undefined;
  const name = value.split(/[\\/]/).pop()
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>:"|?*]/g, "")
    .trim().slice(0, 255);
  return name && !/^\.+$/.test(name) ? name : undefined;
};

module.exports = { sanitizeOriginalFileName };
