// ===== ==== ====
// IMPORTS
const { s3Client } = require('chat-backend-package/src/clients/aws/s3-client') // skipcq: JS-0260
const { GetObjectCommand } = require('@aws-sdk/client-s3')

const { DATA_BUCKET_NAME } = process.env

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))

  const body = JSON.parse(event.body)
  const id = body.id
  const lastUpdate = body.lastUpdate ?? 0

  let data
  try {
    const dataRaw = await s3Client.send(new GetObjectCommand({
      Bucket: DATA_BUCKET_NAME,
      Key: `users/${id}/data.json`
    }))
    data = JSON.parse(dataRaw)
  } catch (error) {
    console.log('Error while getting user data', error)
  }

  if (lastUpdate >= data.lastUpdate) {
    console.log('You already have the latest version')
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ id: id })
    }
  }

  let image
  try {
    const imageRaw = await s3Client.send(new GetObjectCommand({
      Bucket: DATA_BUCKET_NAME,
      Key: data.imagePath
    }))
    image = await imageRaw.Body.transformToString()
  } catch (error) {
    console.log('Error while getting user image', error)
  }

  return {
    id,
    data,
    image
  }
}
