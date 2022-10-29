// ===== ==== ====
// IMPORTS
const { sendMessages } = require('../send-messages')

const sendMessageModule = require('../helpers/send-message')
jest.mock('../helpers/send-message')

// ===== ==== ====
// CONSTANTS
const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // clear console
  log.mockClear()
})

// ===== ==== ====
// TESTS
test('it throws error when users is not an array', async () => {
  await expect(sendMessages({ users: {}, message: { action: 'action' } })).rejects.toThrow('users must be an array')
})

test('it throws error when message.action is not a string', async () => {
  await expect(sendMessages({ users: [], message: { action: 1 } })).rejects.toThrow('message.action must be a string')
})

test('it sends and saves messages', async () => {
  await sendMessages({
    users: [{ id: 'id-1' }, { id: 'id-2' }],
    message: { action: 'action' }
  })

  expect(sendMessageModule.sendMessage).toHaveBeenCalledTimes(2)
  expect(sendMessageModule.sendMessage).toHaveBeenCalledWith({ user: { id: 'id-1' }, message: { action: 'action' }, useSaveMessage: true })
  expect(sendMessageModule.sendMessage).toHaveBeenCalledWith({ user: { id: 'id-2' }, message: { action: 'action' }, useSaveMessage: true })
})

test("it doesn't save message if not asked", async () => {
  await sendMessages({
    users: [{ id: 'id-1' }],
    message: { action: 'action' },
    useSaveMessage: false
  })

  expect(sendMessageModule.sendMessage).toHaveBeenCalledTimes(1)
  expect(sendMessageModule.sendMessage).toHaveBeenCalledWith({ user: { id: 'id-1' }, message: { action: 'action' }, useSaveMessage: false })
})
