// ===== ==== ====
// IMPORTS
const { s3Client } = require('./clients/aws/s3-client') // skipcq: JS-0260
const { GetObjectCommand } = require('@aws-sdk/client-s3')

const { DATA_BUCKET_NAME } = process.env

// ===== ==== ====
// EXPORTS
/**
 * Get user from its id
 *
 * @param {string} id
 *
 * @return {Promise<User>}
 */
exports.getUserData = async ({ id }) => {
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
  return data ?? {}
}
