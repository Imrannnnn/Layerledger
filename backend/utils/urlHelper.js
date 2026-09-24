/**
 * ----------------------------------------------------------------------
 * Application URL Resolver & Sanitizer
 * ----------------------------------------------------------------------
 * Resolves the public frontend application URL dynamically from the
 * incoming HTTP request (headers.origin / headers.referer) or environment variables.
 * Guarantees that in production environments or when a live domain is detected,
 * links generated for emails and activations never point to localhost.
 * ----------------------------------------------------------------------
 */

/**
 * Resolves the base web application URL.
 * 
 * Priority:
 * 1. Request origin header (e.g. https://bakewealthinternational.com)
 * 2. Request referer header origin
 * 3. process.env.APP_URL / process.env.CLIENT_URL / process.env.FRONTEND_URL (if not localhost)
 * 4. Production fallback: https://bakewealthinternational.com
 * 5. Localhost (only in development/test if no live origin/env is provided)
 * 
 * @param {import('express').Request} [req]
 * @returns {string}
 */
function resolveAppUrl(req = null) {
  let origin = req?.headers?.origin;

  if (!origin && req?.headers?.referer) {
    try {
      origin = new URL(req.headers.referer).origin;
    } catch (_) {
      // Ignore malformed referer headers
    }
  }

  // 1. If we have a request origin and it's a live domain, always use it
  if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    return origin.replace(/\/$/, '');
  }

  // 2. Check environment variables for live domain
  const envUrl = process.env.APP_URL || process.env.CLIENT_URL || process.env.FRONTEND_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/$/, '');
  }

  // 3. If caller explicitly passed a localhost request and in development or test mode
  if (origin && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
    return origin.replace(/\/$/, '');
  }

  if (envUrl && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
    return envUrl.replace(/\/$/, '');
  }

  // 4. Default fallback to live production domain
  return 'https://bakewealthinternational.com';
}

/**
 * Sanitizes any URL intended for email recipients so localhost links
 * are safely converted to the live domain when running in production or
 * when a live domain is configured.
 * 
 * @param {string} url
 * @param {import('express').Request} [req]
 * @returns {string}
 */
function sanitizePublicUrl(url, req = null) {
  if (!url || typeof url !== 'string') return url;
  const liveUrl = resolveAppUrl(req);

  // If liveUrl is a production domain, replace localhost:port with liveUrl
  if (liveUrl && !liveUrl.includes('localhost') && !liveUrl.includes('127.0.0.1')) {
    return url.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/gi, liveUrl);
  }
  return url;
}

module.exports = {
  resolveAppUrl,
  sanitizePublicUrl
};
