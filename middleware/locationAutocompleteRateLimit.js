const WINDOW_MS = 60000;
const MAX_REQUESTS = 30;
const clients = new Map();

const locationAutocompleteRateLimit = (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket?.remoteAddress || "unknown";
  const current = clients.get(key);

  if (clients.size > 1000) {
    for (const [clientKey, client] of clients) {
      if (client.resetAt <= now) {
        clients.delete(clientKey);
      }
    }
  }

  if (!current || current.resetAt <= now) {
    clients.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (current.count >= MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({ message: "Too many location searches." });
  }

  current.count += 1;
  return next();
};

module.exports = locationAutocompleteRateLimit;
