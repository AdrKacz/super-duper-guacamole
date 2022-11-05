// ===== ==== ====
// EXPORTS
exports.isGroupValid = ({ group, userId, users, blockedUsers }) => {
  // verify if user is not banned from group
  if (typeof group.bannedUsers === 'object' && group.bannedUsers.has(userId)) {
    return false
  }

  // verify if user has not blocked user from group
  if (typeof blockedUsers === 'object') {
    for (const { id } of users) {
      if (blockedUsers.has(id)) {
        return false
      }
    }
  }

  return true
}
