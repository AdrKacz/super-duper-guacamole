const { readFile } = require('node:fs')

const axios = require('axios') // skipcq: JS-0260

const { argv } = require('node:process')

let id = null
if (argv.length > 2) {
  id = argv[2]
} else {
  throw new Error('you must provide one parameter for id (ex: yarn node sign-up-user.js your-id)')
}

readFile('./public.key', { encoding: 'utf-8' }, (_publicKeyErr, publicKey) => {
  axios.put('https://d1834iic8b.execute-api.eu-west-3.amazonaws.com/sign-up', {
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
