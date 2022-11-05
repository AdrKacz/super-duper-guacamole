// https://docs.mia-platform.eu/docs/runtime_suite/client-credentials/jwt_keys
const {
  generateKeyPairSync
} = require('node:crypto')

const fs = require('node:fs')

const { argv } = require('node:process')

let kid = null
if (argv.length > 2) {
  kid = argv[2]
} else {
  throw new Error('you must provide one parameter for kid (ex: yarn node generate-jwt-key-pair.js my-key')
}

const {
  publicKey,
  privateKey
} = generateKeyPairSync('rsa', {
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

console.log('publicKey', publicKey)
console.log('privateKey', privateKey)

const jwk = {
  ...publicKey,
  kid,
  alg: 'RS256',
  use: 'sig'
}

console.log('jwk', jwk)

fs.readFile('./.well-known/jwks.json', (readErr, data) => {
  if (readErr) throw readErr
  const json = JSON.parse(data)
  json.keys.push(jwk)
  fs.writeFile('./.well-known/jwks.json', JSON.stringify(json, null, 2), (writeErr) => {
    if (writeErr) throw writeErr
    console.log('The "data to append" was appended to file!')
  })
})
