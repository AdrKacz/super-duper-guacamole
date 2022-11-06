// ===== ==== ====
// BEFORE EACH
let crypto = null
let fs = null
beforeEach(() => {
  // reset modules
  jest.resetModules()

  crypto = require('node:crypto')
  jest.mock('node:crypto', () => ({
    generateKeyPairSync: jest.fn()
  }))

  fs = require('node:fs')
  jest.mock('node:fs', () => ({
    readFile: jest.fn(),
    writeFile: jest.fn()
  }))
})

// ===== ==== ====
// TEST
test('it throws if no kid provided', () => {
  process.argv = ['node', 'generate-jwk.js']
  expect(() => (require('../generate-jwk'))).toThrow('you must provide one parameter for kid (ex: yarn node generate-jwk.js your-key)')
})

test('it throws if reading error', () => {
  process.argv = ['node', 'generate-jwk.js', 'my-key']

  crypto.generateKeyPairSync.mockReturnValue({
    publicKey: 'public-key',
    privateKey: 'private-key'
  })

  fs.readFile.mockImplementation((_path, callback) => (callback(new Error('can\'t read file'))))

  expect(() => (require('../generate-jwk'))).toThrow('can\'t read file')

  expect(crypto.generateKeyPairSync).toHaveBeenCalledTimes(1)
  expect(crypto.generateKeyPairSync).toHaveBeenCalledWith('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'jwk'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })

  expect(fs.readFile).toHaveBeenCalledTimes(1)
  expect(fs.readFile).toHaveBeenCalledWith('../.well-known/jwks.json', expect.any(Function))

  expect(fs.writeFile).toHaveBeenCalledTimes(0)
})

test('it throws if writing error', () => {
  process.argv = ['node', 'generate-jwk.js', 'my-key']

  crypto.generateKeyPairSync.mockReturnValue({
    publicKey: 'public-key',
    privateKey: 'private-key'
  })

  fs.readFile.mockImplementation((_path, callback) => (callback(null, JSON.stringify({ keys: [] }))))
  fs.writeFile.mockImplementation((_path, _text, callback) => (callback(new Error('can\'t write file'))))

  expect(() => (require('../generate-jwk'))).toThrow('can\'t write file')

  expect(fs.writeFile).toHaveBeenCalledTimes(1)
  expect(fs.writeFile).toHaveBeenCalledWith('../.well-known/jwks.json', JSON.stringify({
    keys: [{
      ...'public-key',
      kid: 'my-key',
      alg: 'RS256',
      use: 'sig'
    }]
  }, null, 2), expect.any(Function))
})

test('it writes without error', () => {
  process.argv = ['node', 'generate-jwk.js', 'my-key']

  crypto.generateKeyPairSync.mockReturnValue({
    publicKey: 'public-key',
    privateKey: 'private-key'
  })

  fs.readFile.mockImplementation((_path, callback) => (callback(null, JSON.stringify({ keys: [] }))))
  fs.writeFile.mockImplementation((_path, _text, callback) => (callback(null)))

  require('../generate-jwk')

  expect(fs.readFile).toHaveBeenCalledTimes(1)
  expect(fs.writeFile).toHaveBeenCalledTimes(1)
})
