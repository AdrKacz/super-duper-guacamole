// ===== ==== ====
// IMPORTS
const verify = require('jsonwebtoken/verify') // skipcq: JS-0260
const jwkToPem = require('jwk-to-pem') // skipcq: JS-0260
const axios = require('axios') // skipcq: JS-0260

const { AUTHENTICATION_STAGE } = process.env
// ===== ==== ====
// EXPORTS
exports.handler = async (event, _context, callback) => {
  console.log('Receives:', JSON.stringify(event, null, 2))

  // Perform authorization to return the Allow policy for correct parameters and
  // the 'Unauthorized' error, otherwise.
  const issuer = 'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/chat-backend'
  try {
    const { data } = await axios.get(`${issuer}/.well-known/jwks.json`)
    const key = getKey(data.keys)
    const pem = jwkToPem(key)
    const jwt = verify(event.queryStringParameters.token, pem, {
      issuer,
      audience: 'user'
    })
    callback(null, generateAllow(jwt.id, event.methodArn, jwt))
  } catch (error) {
    console.log(error)
    callback(new Error('Unauthorized'))
  }
}

// ===== ==== ====
// HELPERS
const getKey = (keys) => {
  for (const key of keys) {
    if (key.kid === AUTHENTICATION_STAGE) {
      return key
    }
  }

  throw new Error('key not found in issuer')
}

// Help function to generate an IAM policy
const generatePolicy = (principalId, effect, resource, context) => {
  // Required output:
  const authResponse = {}
  authResponse.principalId = principalId
  if (effect && resource) {
    const policyDocument = {}
    policyDocument.Version = '2012-10-17' // default version
    policyDocument.Statement = []
    policyDocument.Statement[0] = {
      Action: 'execute-api:Invoke', // default action,
      Effect: effect,
      Resource: resource
    }
    authResponse.policyDocument = policyDocument
  }
  // Optional output with custom properties of the String, Number or Boolean type.
  authResponse.context = context
  return authResponse
}

/**
 * Create allow policy
 *
 * @param {string} principalId
 * @param {string} resource
 * @param {object} context
 *
 * @return {object}
 */
const generateAllow = (principalId, resource, context) => {
  return generatePolicy(principalId, 'Allow', resource, context)
}

// const generateDeny = (principalId, resource, context) => {
//   return generatePolicy(principalId, 'Deny', resource, context)
// }
