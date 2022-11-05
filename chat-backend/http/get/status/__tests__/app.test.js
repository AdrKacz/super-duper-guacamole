// ===== ==== ====
// IMPORTS
const { handler } = require('../app')

const chatBackendPackageModule = require('chat-backend-package')
jest.mock('chat-backend-package', () => ({
  getUser: jest.fn(),
  getGroup: jest.fn()
}))

// ===== ==== ====
// CONSTANTS
const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // reset console
  log.mockReset()
})

test.each([
  { details: 'without group', id: 'id', expectedId: 'id', expectedGroup: null, expectedUsers: null },
  { details: 'with private group', id: 'id-1', group: { id: 'group-id', isPublic: false }, users: [{ id: 'id-2' }], expectedId: 'id-1', expectedGroup: { isPublic: false }, expectedUsers: null },
  { details: 'with public group', id: 'id-1', group: { id: 'group-id', isPublic: true }, users: [{ id: 'id-2' }], expectedId: 'id-1', expectedGroup: { id: 'group-id', isPublic: true }, expectedUsers: [{ id: 'id-2' }] }
])('it returns user status ($details)', async ({ id, group, users, expectedId, expectedGroup, expectedUsers }) => {
  chatBackendPackageModule.getUser.mockResolvedValue({ id, groupId: group?.id })
  chatBackendPackageModule.getGroup.mockResolvedValue({ group, users })

  const response = await handler({
    requestContext: { authorizer: { jwt: { claims: { id } } } }
  })

  expect(chatBackendPackageModule.getUser).toHaveBeenCalledTimes(1)
  expect(chatBackendPackageModule.getUser).toHaveBeenCalledWith({ id })

  if (typeof group === 'object') {
    expect(chatBackendPackageModule.getGroup).toHaveBeenCalledTimes(1)
    expect(chatBackendPackageModule.getGroup).toHaveBeenCalledWith({ groupId: group.id })
  } else {
    expect(chatBackendPackageModule.getGroup).toHaveBeenCalledTimes(0)
  }

  expect(response.statusCode).toBe(200)
  expect(JSON.stringify(response.headers)).toBe(JSON.stringify({ 'Content-Type': 'application/json' }))
  expect(response.body).toBe(JSON.stringify({ id: expectedId, group: expectedGroup, users: expectedUsers }))
})
