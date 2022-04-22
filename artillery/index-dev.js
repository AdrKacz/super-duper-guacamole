module.exports = { createUniqueId, createData, registerHandler, switchgroupHandler, textmessageHandler }

const { v4: uuidv4 } = require('uuid')

const randomSentence = require('random-sentence')

function registerHandler (event, userContext, error, done) {
  let data
  try {
    data = JSON.parse(event.data)
  } catch (err) {
    error(err)
  }
  // console.log('\x1b[1mRegister handler\x1b[0m')
  // console.log(data)
  if (data.action === 'register') {
    done()
  }
}

function switchgroupHandler (event, userContext, error, done) {
  let data
  try {
    data = JSON.parse(event.data)
  } catch (err) {
    error(err)
  }
  // console.log('\x1b[1mSwitch Group handler\x1b[0m')
  // console.log(data)
  if (data.action === 'switchgroup') {
    userContext.vars.groupId = data.groupid
    done()
  }
}

function textmessageHandler (event, userContext, error, done) {
  let data
  try {
    data = JSON.parse(event.data)
  } catch (err) {
    error(err)
  }
  // console.log(`\x1b[1m<${userContext.vars.uniqueId}>Text Message handler\x1b[0m\n${JSON.stringify(data, null, 2)}`)

  // wait for your message to come back
  if (data.action === 'textmessage' && data.message === userContext.vars.data.message) {
    done()
  }
}

const GLOBALS = { i: 0 }
function createUniqueId (userContext, _events, done) {
  userContext.vars.uniqueId = `bot-${GLOBALS.i}`
  GLOBALS.i += 1
  return done()
}

function createData (userContext, _events, done) {
  const author = userContext.vars.uniqueId
  const createdAt = Date.now()
  const id = uuidv4()
  const text = randomSentence({ min: 4, max: 9 })

  userContext.vars.data = {
    action: 'textmessage',
    groupid: userContext.vars.groupid,
    id: author,
    message: `${author}::${createdAt}::${id}::${text}`
  }
  return done()
}
