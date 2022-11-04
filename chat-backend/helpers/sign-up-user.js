const { readFile } = require('node:fs/promises')

const axios = require('axios') // skipcq: JS-0260

/**
 * Read file
 *
 * @param {string} path
 *
 * @return {string}
 */
function read (path) {
  return readFile(path, 'utf-8', (err, data) => {
    if (err) throw err
    console.log(path, data)
    return data
  })
}

/**
 * Sign up user to Awa
 */
async function main () {
  const publicKey = await read('./public.key')

  const id = 'id'

  await axios.put('https://9a1o7mlx6k.execute-api.eu-west-3.amazonaws.com/sign-up', {
    id,
    publicKey
  }).then((response) => {
    console.log('status', response.status)
    console.log('data', response.data)
  })
    .catch((error) => {
      console.log('code', error.code)
      console.log('data', error.data)
    })
}

main()
