// ===== ==== ====
// IMPORTS
jest.mock('../src/get-group')
jest.mock('../src/get-user')
jest.mock('../src/send-messages')
jest.mock('../src/send-notifications')

/* I don't know why I need to mock dependencies of ../src/send-notifications, without it fires error
Service account object must contain a string "project_id" property.
    10 | const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY)
    11 | const app = initializeApp({
>   12 |   credential: cert(serviceAccount)
       |               ^
    13 | })
    14 |
    15 | // ===== ==== ====

at new ServiceAccount (node_modules/firebase-admin/lib/app/credential-internal.js:136:19)
at new ServiceAccountCredential (node_modules/firebase-admin/lib/app/credential-internal.js:70:15)
at cert (node_modules/firebase-admin/lib/app/credential-factory.js:103:54)
at Object.cert (chat-backend-package/src/clients/firebase-clients.js:12:15)
*/
jest.mock('../src/clients/firebase-clients')
jest.mock('firebase-admin/app')
jest.mock('firebase-admin/messaging')

const indexModule = require('../index')
// ===== ==== ====
// CONSTANTS
const log = jest.spyOn(console, 'log').mockImplementation(() => {}) // skipcq: JS-0057

// ===== ==== ====
// BEFORE EACH
beforeEach(() => {
  // clear console
  log.mockClear()
})

// ===== ==== ====
// TESTS
test('it has all dependencies', async () => {
  expect(JSON.stringify(indexModule)).toBe(JSON.stringify({
    getGroup: {},
    getUser: {},
    sendMessages: {},
    sendNotifications: {}
  }))
})
