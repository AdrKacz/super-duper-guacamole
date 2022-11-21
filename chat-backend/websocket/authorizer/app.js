// ===== ==== ====
// EXPORTS
exports.handler = function (event, _context, callback) {
  console.log('Received event:', JSON.stringify(event, null, 2))

  // Perform authorization to return the Allow policy for correct parameters and
  // the 'Unauthorized' error, otherwise.
  try {
    const jwt = { id: 'id' }
    callback(null, generateAllow(jwt.id, event.methodArn, jwt))
  } catch (error) {
    console.log(error)
    callback(new Error('Unauthorized'))
  }
}

// ===== ==== ====
// HELPERS

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

const generateAllow = (principalId, resource, context) => {
  return generatePolicy(principalId, 'Allow', resource, context)
}

// const generateDeny = (principalId, resource, context) => {
//   return generatePolicy(principalId, 'Deny', resource, context)
// }
