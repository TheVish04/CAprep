const AuditLog = require('../models/AuditLogModel');
const logger = require('../config/logger');

/**
 * Write an audit log entry (fire-and-forget; does not throw).
 * @param {string} actorId - User ID performing the action
 * @param {string} action - Action name (e.g. 'create', 'update', 'delete')
 * @param {string} resource - Resource type (e.g. 'question', 'resource', 'announcement')
 * @param {string} [resourceId] - ID of the affected document
 * @param {object} [details] - Optional extra details
 */
async function logAudit(actorId, action, resource, resourceId = null, details = null) {
  try {
    await AuditLog.create({ actor: actorId, action, resource, resourceId, details });
  } catch (err) {
    logger.error('Audit log write error: ' + (err && err.message));
  }
}

module.exports = { logAudit };
