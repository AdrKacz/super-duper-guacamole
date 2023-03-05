// ===== ==== ====
// IMPORTS
const { sendNotifications } = require('chat-backend-package/src/send-notifications') // skipcq: JS-0260
const { getUserData } = require('chat-backend-package/src/get-user-data') // skipcq: JS-0260

// ===== ==== ====
// EXPORTS
/**
 * User starts to type a message
 *
 * @param {string} id
 * @param {string} users
 */
exports.startTyping = async ({ id, users }) => {
  console.log('start typing', id, users)
  const data = await getUserData({ id })

  let notificationTitle = null
  if (typeof data.name === 'string') {
    notificationTitle = `${data.name} est entrain d'écrire...`
  } else {
    notificationTitle = 'Quelqu\'un est entrain d\'écrire...'
  }

  await sendNotifications({
    users: users.filter(({ id: userId }) => (userId !== id)),
    notification: {
      title: notificationTitle,
      body: 'Viens jeter un œil 👀'
    }
  })
}
