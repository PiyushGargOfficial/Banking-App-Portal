/**
 * Light input sanitisation. Strips HTML tags from string fields and trims
 * whitespace. Not a substitute for output encoding - just a first line of
 * defence so obviously-malicious payloads can't even reach the model layer.
 */
function sanitize(value) {
  return typeof value === 'string' ? value.replace(/<\/?[^>]+(>|$)/g, '').trim() : value;
}

/** Apply `sanitize` to every value on a flat object. Returns a new object. */
function sanitizeObject(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[k] = sanitize(v);
  return out;
}

module.exports = { sanitize, sanitizeObject };
