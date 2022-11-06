// ===== ==== ====
// EXPORTS
exports.isGroupValid = ({ group, users, currentUser }) => {
  // verify if user is not banned from group
  if (typeof group.bannedUsers === 'object' && group.bannedUsers.has(currentUser.id)) {
    return false
  }

  // verify if user has not blocked user from group
  for (const { id } of users) {
    if (currentUser.blockedUserIds.has(id)) {
      return false
    }
  }

  return true
}
