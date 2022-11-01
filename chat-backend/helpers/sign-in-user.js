const { createSign, createVerify } = require('node:crypto')

const { readFile } = require('node:fs/promises')

const axios = require('axios')

function read (path) {
  return readFile(path, 'utf-8', (err, data) => {
    if (err) throw err
    console.log(path, data)
    return data
  })
}

async function main () {
  const publicKey = await read('./public.key')
  const privateKey = await read('./private.key')

  const id = 'id'
  const timestamp = Date.now()

  const signer = createSign('rsa-sha256')
  signer.update(id + timestamp.toString())
  const signature = Buffer.from(signer.sign(privateKey, 'base64'), 'base64')

  console.log('signature', signature)

  const verifier = createVerify('rsa-sha256')
  verifier.update(id + timestamp.toString())
  const isVerified = verifier.verify(publicKey, Buffer.from(signature), 'base64')

  console.log('isVerified', isVerified)

  await axios.put('https://9a1o7mlx6k.execute-api.eu-west-3.amazonaws.com/sign-in', {
    id,
    timestamp,
    signature
  }).then(function (response) {
    console.log('status', response.status)
    console.log('data', response.data)
  })
    .catch(function (error) {
      console.log('code', error.code)
      console.log('status', error.response.status)
      console.log('data', error.response.data)
    })
}

main()
