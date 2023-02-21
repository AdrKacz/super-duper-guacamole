// ===== ==== ====
// IMPORTS
const { s3Client } = require('chat-backend-package/src/clients/aws/s3-client') // skipcq: JS-0260
const { PutObjectCommand } = require('@aws-sdk/client-s3')

const { DATA_BUCKET_NAME } = process.env

// ===== ==== ====
// HANDLER
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))
  const jwt = event.requestContext.authorizer.jwt.claims
  const id = jwt.id

  const body = JSON.parse(event.body)
  const base64Image = body.image
  const imageExtension = body.imageExtension
  const timestamp = Date.now()

  if (typeof imageExtension !== 'string' || imageExtension[0] !== '.') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'You must provide a valid imageExtension' })
    }
  }

  // upload image
  const imagePath = `users/${id}/image${imageExtension}`
  const imageBuffer = Buffer.from(base64Image, 'base64')
  await s3Client.send(new PutObjectCommand({
    Bucket: DATA_BUCKET_NAME,
    Body: imageBuffer,
    Key: imagePath,
    ContentType: `image/${imageExtension.substring(1)}`
  }))

  // upload data
  const data = {
    lastUpdate: timestamp,
    imagePath
  }
  await s3Client.send(new PutObjectCommand({
    Bucket: DATA_BUCKET_NAME,
    Body: JSON.stringify(data),
    Key: `users/${id}/data.json`,
    ContentType: 'application/json'
  }))

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: jwt.id })
  }
}
