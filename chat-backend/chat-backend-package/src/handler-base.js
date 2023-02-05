exports.handlerBase = async ({ event, handler }) => {
  console.log(JSON.stringify(event, null, 2))
  const response = await handler(event)
  console.log(JSON.stringify(response, null, 2))
  return response
}
