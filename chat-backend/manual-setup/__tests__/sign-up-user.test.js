// ===== ==== ====
// BEFORE EACH
let fs = null
let axios = null
beforeEach(() => {
  // reset modules
  jest.resetModules()

  fs = require('node:fs')
  jest.mock('node:fs', () => ({
    readFile: jest.fn()
  }))

  axios = require('axios')
  jest.mock('axios', () => ({
    put: jest.fn()
  }))
})

// ===== ==== ====
// TEST
test('it throws if no id provided', () => {
  process.argv = ['node', 'sign-up-user.js', 'your-url']
  expect(() => (require('../sign-up-user'))).toThrow('you must provide one parameter for url and one for id (ex: yarn node sign-up-user.js your-url your-id)')
})

test('it throws if no url provided', () => {
  process.argv = ['node', 'sign-up-user.js']
  expect(() => (require('../sign-up-user'))).toThrow('you must provide one parameter for url and one for id (ex: yarn node sign-up-user.js your-url your-id)')
})

test('it sends request', () => {
  process.argv = ['node', 'sign-up-user.js', 'your-url', 'your-id']

  fs.readFile
    .mockImplementationOnce((_path, _options, callback) => (callback(null, 'public-key')))

  axios.put.mockResolvedValue({ status: 'status', data: 'data' })

  require('../sign-up-user')

  expect(fs.readFile).toHaveBeenCalledTimes(1)
  expect(fs.readFile).toHaveBeenCalledWith('./public.key', { encoding: 'utf-8' }, expect.any(Function))

  expect(axios.put).toHaveBeenCalledTimes(1)
  expect(axios.put).toHaveBeenCalledWith('your-url/sign-up', {
    id: 'your-id',
    publicKey: 'public-key'
  })
})

test('it reads error', () => {
  process.argv = ['node', 'sign-up-user.js', 'your-url', 'your-id']

  fs.readFile
    .mockImplementationOnce((_path, _options, callback) => (callback(null, 'public-key')))

  axios.put.mockRejectedValue({ code: 'code', response: { status: 'status', data: 'data' } })

  require('../sign-up-user')

  expect(axios.put).toHaveBeenCalledTimes(1)
})
