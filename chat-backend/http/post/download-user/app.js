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

  const data = await s3Client.send(new GetObjectCommand({
    Bucket: DATA_BUCKET_NAME,
    Key: `users/${id}/image.png`
  }))

  console.log('Success', data)

  const image = await data.Body.transformToString()

  return {
    id,
    image
  }
}
