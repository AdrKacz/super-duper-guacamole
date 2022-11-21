const { createSign, createVerify } = require('node:crypto')

const { readFile } = require('node:fs')

const axios = require('axios') // skipcq: JS-0260

const { argv } = require('node:process')

let id = null
let url = null
if (argv.length > 3) {
  url = argv[2]
  id = argv[3]
} else {
  throw new Error('you must provide one parameter for url and one for id (ex: yarn node sign-in-user.js your-url your-id)')
}

readFile('./public.key', { encoding: 'utf-8' }, (_publicKeyErr, publicKey) => {
  readFile('./private.key', { encoding: 'utf-8' }, (_privateKeyErr, privateKey) => {
    const timestamp = Date.now()

    const signature = Buffer.from(createSign('rsa-sha256')
      .update(id + timestamp.toString())
      .sign(privateKey, 'base64'), 'base64')

    console.log('signature', signature)

    const isVerified = createVerify('rsa-sha256')
      .update(id + timestamp.toString())
      .verify(publicKey, Buffer.from(signature), 'base64')

    console.log('isVerified', isVerified)

    axios.put(`${url}/sign-in`, {
      id,
      timestamp,
      signature
    }).then((response) => {
      console.log('status', response.status)
      console.log('data', response.data)
    })
      .catch((error) => {
        console.log('code', error.code)
        console.log('status', error.response.status)
        console.log('data', error.response.data)
      })
  })
})
