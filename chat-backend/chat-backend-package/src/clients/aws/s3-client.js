// ===== ==== ====
// IMPORTS
const { S3Client } = require('@aws-sdk/client-s3') // skipcq: JS-0260

const { AWS_REGION } = process.env

// ===== ==== ====
// EXPORTS
exports.s3Client = new S3Client({ region: AWS_REGION })
