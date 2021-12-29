import gun from './gun';

const tokens = gun.get('tokens');
tokens.get('0').put('.');

// This succeed to keep data between run (but I don't want), and chat doesn't (but I want) ...
export const saveToken = token =>
  new Promise(async (resolve, reject) => {
    if (typeof token !== 'string') {
      reject('Token must be a string');
    }
    // Check if tokens already exists
    const existingTokens = await getTokens();
    if (existingTokens.includes(token)) {
      resolve('Token already saved');
      return;
    }

    // Get new tokens
    const nextIndex = await getNextEmptyTokenIndex();
    console.log(
      `Register New Token at index -> ${nextIndex} (new token below)\n---\n${token}\n---`,
    );
    tokens.get(nextIndex).put(token);
    resolve('Token saved');
    return;
  });

const getValidKeys = k => Object.keys(k).filter(n => !isNaN(parseInt(n, 10)));

export const getRawTokens = () =>
  new Promise(resolve => {
    tokens.once((v, k) => {
      const keys = getValidKeys(v);
      const values = Object.entries(v).filter(
        ([vk]) => vk !== '0' && keys.includes(vk),
      );
      resolve(values.map(([, vv]) => vv));
    });
  });

export const getTokens = async () => Array.from(new Set(await getRawTokens()));

const getNextEmptyTokenIndex = () =>
  new Promise(resolve => {
    tokens.once((v, k) => {
      const keys = getValidKeys(v).map(n => parseInt(n, 10));
      resolve(Math.max(...keys) + 1);
    });
  });
