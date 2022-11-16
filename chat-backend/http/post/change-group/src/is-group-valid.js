// ===== ==== ====
// EXPORTS
exports.isGroupValid = ({ group, users, currentUser }) => {
  // verify if user is not banned from group
  if (typeof group.bannedUsers === 'object' && group.bannedUsers.has(currentUser.id)) {
    return false
  }

  for (const { id } of users) {
    // verify if user not in group
    if (currentUser.id === id) {
      return false
    }
    // verify if user has not blocked user from group
    if (currentUser.blockedUserIds.has(id)) {
      return false
    }
  }

  return true
}
