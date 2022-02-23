import {useState} from 'react';

const avatar = Math.random()
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
      avatar: avatar,
      name: name,
      isRegister: name ? true : false,
    },
    setUsername,
  ];
}
