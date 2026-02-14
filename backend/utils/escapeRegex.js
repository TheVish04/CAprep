/**
 * Escape special regex metacharacters in a string so it can be safely used
 * in MongoDB $regex (or RegExp). Prevents regex injection and avoids
 * unintended behavior or performance issues from user-controlled input.
 *
 * Escapes: \ ^ $ . | ? * + ( ) [ ] { }
 *
 * @param {string} str - User-provided search string
 * @returns {string} - Escaped string safe for use in $regex
 */
function escapeRegex(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

module.exports = { escapeRegex };
