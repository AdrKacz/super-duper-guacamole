// ===== ==== ====
// IMPORTS
const { getGroup } = require('../get-group')

const getGroupUsersModule = require('../helpers/get-group-users')
jest.mock('../helpers/get-group-users')

const getGroupMetadataModule = require('../helpers/get-group-metadata')
jest.mock('../helpers/get-group-metadata')

// ===== ==== ====
// TESTS
test('it throws error on none string group id', async () => {
  await expect(getGroup({ groupId: 1 })).rejects.toThrow('groupId must be a string')
})

test('it calls function to get group data', async () => {
  getGroupMetadataModule.getGroupMetadata.mockResolvedValue(Promise.resolve({ id: 'group-id' }))
  getGroupUsersModule.getGroupUsers.mockResolvedValue(Promise.resolve([{ id: 'id-1' }, { id: 'id-2' }]))

  const { group, users } = await getGroup({ groupId: 'group-id' })

  expect(getGroupMetadataModule.getGroupMetadata).toHaveBeenCalledTimes(1)
  expect(getGroupMetadataModule.getGroupMetadata).toHaveBeenCalledWith({ groupId: 'group-id' })

  expect(getGroupUsersModule.getGroupUsers).toHaveBeenCalledTimes(1)
  expect(getGroupUsersModule.getGroupUsers).toHaveBeenCalledWith({ groupId: 'group-id' })

  expect(JSON.stringify(group)).toBe(JSON.stringify({ id: 'group-id' }))
  expect(JSON.stringify(users)).toBe(JSON.stringify([{ id: 'id-1' }, { id: 'id-2' }]))
})
