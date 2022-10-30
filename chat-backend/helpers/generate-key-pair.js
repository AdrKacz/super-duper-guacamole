// https://docs.mia-platform.eu/docs/runtime_suite/client-credentials/jwt_keys
const {
  generateKeyPairSync
} = require('node:crypto')

const fs = require('node:fs')

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
  kid: 'key',
  alg: 'RS256',
  use: 'sig'
}

console.log('jwk', jwk)

fs.readFile('./jwks.json', (err, data) => {
  if (err) throw err
  const json = JSON.parse(data)
  json.keys.push(jwk)
  fs.writeFile('./jwks.json', JSON.stringify(json, null, 2), (err) => {
    if (err) throw err
    console.log('The "data to append" was appended to file!')
  })
})
