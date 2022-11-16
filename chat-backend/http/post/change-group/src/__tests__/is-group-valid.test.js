// ===== ==== ====
// IMPORTS
const { isGroupValid } = require('../is-group-valid')

// ===== ==== ====
// TESTS
test.each([
  {
    details: 'user in group',
    group: {},
    users: [{ id: 'id' }, { id: 'id-2' }],
    currentUser: { id: 'id', blockedUserIds: new Set() },
    expectedValid: false
  },
  {
    details: 'banned undefined, no blocked users',
    group: {},
    users: [{ id: 'id-1' }, { id: 'id-2' }],
    currentUser: { id: 'id', blockedUserIds: new Set() },
    expectedValid: true
  },
  {
    details: 'not banned, no blocked users',
    group: { bannedUsers: new Set() },
    users: [{ id: 'id-1' }, { id: 'id-2' }],
    currentUser: { id: 'id', blockedUserIds: new Set() },
    expectedValid: true
  },
  {
    details: 'not banned, blocked users',
    group: {},
    users: [{ id: 'id-1' }, { id: 'id-2' }],
    currentUser: { id: 'id', blockedUserIds: new Set(['id-2']) },
    expectedValid: false
  },
  {
    details: 'banned, no blocked users',
    group: { bannedUsers: new Set(['id']) },
    users: [{ id: 'id-1' }, { id: 'id-2' }],
    currentUser: { id: 'id', blockedUserIds: new Set() },
    expectedValid: false
  },
  {
    details: 'banned, blocked users',
    group: { bannedUsers: new Set(['id']) },
    users: [{ id: 'id-1' }, { id: 'id-2' }],
    currentUser: { id: 'id', blockedUserIds: new Set(['id-2']) },
    expectedValid: false
  }
])('it returns correct valid status ($details)', ({ group, users, currentUser, expectedValid }) => {
  const result = isGroupValid({ group, users, currentUser })

  expect(result).toBe(expectedValid)
})
