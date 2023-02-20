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

  const body = JSON.parse(event.body)
  const base64Image = body.image
  const imageBuffer = Buffer.from(base64Image, 'base64')

  const data = await s3Client.send(new PutObjectCommand({
    Bucket: DATA_BUCKET_NAME,
    Body: imageBuffer,
    Key: `users/${jwt.id}/image.png`,
    ContentType: 'image/png'
  }))

  console.log('Success', data)
}
