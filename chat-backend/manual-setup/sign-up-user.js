const { readFile } = require('node:fs')

const axios = require('axios') // skipcq: JS-0260

const { argv } = require('node:process')

let id = null
let url = null
if (argv.length > 3) {
  url = argv[2]
  id = argv[3]
} else {
  throw new Error('you must provide one parameter for url and one for id (ex: yarn node sign-up-user.js your-url your-id)')
}

readFile('./public.key', { encoding: 'utf-8' }, (_publicKeyErr, publicKey) => {
  axios.put(`${url}/sign-up`, {
    id,
    publicKey
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
