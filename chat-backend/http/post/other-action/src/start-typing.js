// ===== ==== ====
// IMPORTS
const { sendMessages } = require('chat-backend-package/src/send-messages') // skipcq: JS-0260
const { sendNotifications } = require('chat-backend-package/src/send-notifications') // skipcq: JS-0260
const { s3Client } = require('chat-backend-package/src/clients/aws/s3-client') // skipcq: JS-0260
const { GetObjectCommand } = require('@aws-sdk/client-s3')

const { DATA_BUCKET_NAME } = process.env

// ===== ==== ====
// EXPORTS
/**
 * User starts to type a message
 *
 * @param {string} id
 * @param {string} users
 */
exports.startTyping = async ({ id, users }) => {
  let data = null
  try {
    const dataRaw = await s3Client.send(new GetObjectCommand({
      Bucket: DATA_BUCKET_NAME,
      Key: `users/${id}/data.json`
    }))
    const dataRawString = await dataRaw.Body.transformToString()
    data = JSON.parse(dataRawString)
    console.log(`Got data for user ${id}`, dataRawString)
  } catch (error) {
    console.log('Error while getting user data', error)
  }

  let notificationTitle
  if (data !== null && typeof data.name === 'string') {
    notificationTitle = `${data.name} est entrain d'écrire...`
  } else {
    notificationTitle = 'Quelqu\'un est entrain d\'écrire...'
  }

  await Promise.all([
    sendMessages({ users, message: { action: 'start-typing', message: { id } }, useSaveMessage: false }),
    sendNotifications({
      users: users.filter(({ id: userId }) => (userId !== id)),
      notification: {
        title: notificationTitle,
        body: 'Viens jeter un œil 👀'
      }
    })
  ])
}
