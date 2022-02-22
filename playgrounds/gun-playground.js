const args = process.argv.slice(2);
const GUN = require('gun/gun');

const gun = new GUN('https://awa-gun-relay-server.herokuapp.com/gun');
const tokens = gun.get('tokens');
tokens.get('0').put('.');

const saveToken = token =>
  new Promise(async (resolve, reject) => {
    if (typeof token !== 'string') {
      reject('Token must be a string');
    }
    const nextIndex = await getNextEmptyTokenIndex();
    console.log(nextIndex)
    tokens.get(nextIndex).put(token);
    resolve()
  });

const getValidKeys = k => (
    Object.keys(k).filter(n => !isNaN(parseInt(n)))
)
const getTokens = () =>
  new Promise((resolve,) => {
    tokens.once((v, k) => {
        const keys = getValidKeys(v);
        const values = Object.entries(v).filter(([vk,]) => vk !== '0' && keys.includes(vk));
        resolve(Array.from(new Set(values.map(([, vv]) => vv))));
    });
  });

const getNextEmptyTokenIndex = () =>
  new Promise((resolve,) => {
    tokens.once((v, k) => {
        const keys = getValidKeys(v).map(n => parseInt(n));
        resolve(Math.max(...keys) + 1);
    });
  });

const once = (key, root=gun) => (
    new Promise((resolve,) => {
        root.get(key).once((v, k) => {
            resolve([v, k])
        })
    })
);

(async function main() {
    console.log(await getTokens())
    await saveToken('token-1');
    await saveToken('token-2');
    console.log(await getTokens())
    await saveToken('token-2');
    console.log(await getTokens())
})();
