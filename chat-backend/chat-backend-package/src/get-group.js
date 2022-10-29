// ===== ==== ====
// IMPORTS
const { getGroupUsers } = require('./helpers/get-group-users')
const { getGroupMetadata } = require('./helpers/get-group-metadata')

// ===== ==== ====
// EXPORTS
/**
 * Get group with its users
 *
 * @param {string} groupId
 *
 * @return {Promise<{group: Group, users: User[]>}
 */
exports.getGroupUsers = async ({ groupId }) => {
  if (typeof groupId !== 'string') {
    throw new Error('groupId must be a string')
  }

  const [group, users] = Promise.all([
    getGroupMetadata({ groupId }),
    getGroupUsers({ groupId })
  ])

  return {
    group,
    users
  }
}
