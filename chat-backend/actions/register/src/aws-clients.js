// ===== ==== ====
// IMPORTS
const { SNSClient } = require('@aws-sdk/client-sns') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS

const { AWS_REGION } = process.env

exports.snsClient = new SNSClient({ region: AWS_REGION })
