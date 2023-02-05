// TRIGGER: HTTP API

// ===== ==== ====
// IMPORTS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb') // skipcq: JS-0260
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

const { PutCommand } = require('@aws-sdk/lib-dynamodb') // skipcq: JS-0260

// ===== ==== ====
// CONSTANTS
const { AWS_REGION, USERS_TABLE_NAME } = process.env

const dynamoDBDocumentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: AWS_REGION })
)

// ===== ==== ====
// EXPORTS
/**
 * Get user status
 *
 * @param {Object} event
 */
exports.handler = async (event) => {
  console.log('Receives:', JSON.stringify(event, null, 2))
  const response = await putSignUp(event)
  console.log('Returns:', JSON.stringify(response, null, 2))
  return response
}

const putSignUp = async (event) => {
  const body = JSON.parse(event.body)

  const id = body.id
  const publicKey = body.publicKey

  if (typeof id !== 'string' || typeof publicKey === 'undefined') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'id and publicKey must be defined with correct type' })
    }
  }

  const putCommand = new PutCommand({
    TableName: USERS_TABLE_NAME,
    Item: { id, publicKey },
    ConditionExpression: 'attribute_not_exists(id)'
  })

  try {
    const data = await dynamoDBDocumentClient.send(putCommand)
    console.log('success - item added or updated', data)
    return { statusCode: 200 }
  } catch (err) {
    console.log('error', err.stack)
    return { statusCode: 400 }
  }
}
