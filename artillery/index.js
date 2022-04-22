module.exports = { createUniqueId, createData, listen }

const { v4: uuidv4 } = require('uuid')

const { sentence } = require('txtgen')

function listen (next) {
  console.log('\x1b[1mListen\x1b[0m')

  next()
}

function createUniqueId (userContext, _events, done) {
  userContext.vars.uniqueId = uuidv4()
  return done()
}

function createData (userContext, _events, done) {
  if (userContext.vars.receivedData !== undefined) {
    console.log(`\x1b[1mLast data received:\x1b[0m\n${JSON.stringify(userContext.vars.receivedData, null, 2)}`)
  }
  const author = userContext.vars.uniqueId
  const createdAt = Date.now()
  const id = uuidv4()
  const text = sentence()

  userContext.vars.data = {
    action: 'textmessage',
    id: author,
    message: `${author}::${createdAt}::${id}::${text}`
  }
  return done()
}
