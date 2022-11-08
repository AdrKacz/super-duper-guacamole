// ===== ==== ====
// BEFORE EACH
let crypto = null
let fs = null
let axios = null
beforeEach(() => {
  // reset modules
  jest.resetModules()

  crypto = require('node:crypto')
  jest.mock('node:crypto', () => ({
    createSign: jest.fn(),
    createVerify: jest.fn()
  }))

  fs = require('node:fs')
  jest.mock('node:fs', () => ({
    readFile: jest.fn()
  }))

  axios = require('axios')
  jest.mock('axios', () => ({
    put: jest.fn()
  }))

  Date.now = jest.fn()
})

// ===== ==== ====
// TEST
test('it throws if no id provided', () => {
  process.argv = ['node', 'sign-in-user.js']
  expect(() => (require('../sign-in-user'))).toThrow('you must provide one parameter for id (ex: yarn node sign-in-user.js your-id)')
})

test('it sends request', () => {
  Date.now.mockReturnValue(0)
  process.argv = ['node', 'sign-in-user.js', 'your-id']

  fs.readFile
    .mockImplementationOnce((_path, _options, callback) => (callback(null, 'public-key')))
    .mockImplementationOnce((_path, _options, callback) => (callback(null, 'private-key')))

  const signer = {
    update: jest.fn().mockReturnThis(),
    sign: jest.fn().mockReturnValue('signature')
  }
  crypto.createSign.mockReturnValue(signer)

  const verifier = {
    update: jest.fn().mockReturnThis(),
    verify: jest.fn().mockReturnValue(true)
  }
  crypto.createVerify.mockReturnValue(verifier)

  axios.put.mockResolvedValue({ status: 'status', data: 'data' })

  require('../sign-in-user')

  expect(fs.readFile).toHaveBeenCalledTimes(2)
  expect(fs.readFile).toHaveBeenCalledWith('./public.key', { encoding: 'utf-8' }, expect.any(Function))
  expect(fs.readFile).toHaveBeenCalledWith('./private.key', { encoding: 'utf-8' }, expect.any(Function))

  expect(crypto.createSign).toHaveBeenCalledTimes(1)
  expect(crypto.createSign).toHaveBeenCalledWith('rsa-sha256')
  expect(signer.update).toHaveBeenCalledTimes(1)
  expect(signer.update).toHaveBeenCalledWith('your-id0')
  expect(signer.sign).toHaveBeenCalledTimes(1)
  expect(signer.sign).toHaveBeenCalledWith('private-key', 'base64')

  expect(crypto.createVerify).toHaveBeenCalledTimes(1)
  expect(crypto.createVerify).toHaveBeenCalledWith('rsa-sha256')
  expect(verifier.update).toHaveBeenCalledTimes(1)
  expect(verifier.update).toHaveBeenCalledWith('your-id0')
  expect(verifier.verify).toHaveBeenCalledTimes(1)
  expect(verifier.verify).toHaveBeenCalledWith('public-key', Buffer.from('signature', 'base64'), 'base64')

  expect(axios.put).toHaveBeenCalledTimes(1)
  expect(axios.put).toHaveBeenCalledWith('https://gfskxtf7o3.execute-api.eu-west-3.amazonaws.com/sign-in', {
    id: 'your-id',
    timestamp: 0,
    signature: Buffer.from('signature', 'base64')
  })
})

test('it reads error', () => {
  Date.now.mockReturnValue(0)
  process.argv = ['node', 'sign-in-user.js', 'your-id']

  fs.readFile
    .mockImplementationOnce((_path, _options, callback) => (callback(null, 'public-key')))
    .mockImplementationOnce((_path, _options, callback) => (callback(null, 'private-key')))

  const signer = {
    update: jest.fn().mockReturnThis(),
    sign: jest.fn().mockReturnValue('signature')
  }
  crypto.createSign.mockReturnValue(signer)

  const verifier = {
    update: jest.fn().mockReturnThis(),
    verify: jest.fn().mockReturnValue(true)
  }
  crypto.createVerify.mockReturnValue(verifier)

  axios.put.mockRejectedValue({ code: 'code', response: { status: 'status', data: 'data' } })

  require('../sign-in-user')

  expect(axios.put).toHaveBeenCalledTimes(1)
})
