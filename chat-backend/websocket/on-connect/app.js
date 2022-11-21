// ===== ==== ====
// EXPORTS
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2))

  const id = event.requestContext.authorizer.id

  return {
    statusCode: 200,
    body: JSON.stringify({ id })
  }
}
