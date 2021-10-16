import {useState} from 'react';

const userKey = Math.random()
  .toString(36)
  .replace(/[^a-z]+/g, '')
  .substring(0, 5);

export default function useUser() {
  const [name, setName] = useState('');

  function setUsername(username) {
    setName(username);
  }

  return [
    {
      key: userKey,
      name: name,
      isRegister: name ? true : false,
    },
    setUsername,
  ];
}
