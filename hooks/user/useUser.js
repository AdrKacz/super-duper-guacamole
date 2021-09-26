import { useState } from 'react';

const userKey = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);

export default function useUser() {
  const [name, setName] = useState('');

  function setUserName(userName) {
    setName(userName);
  };
  return [{
      key: userKey,
      name: name,
      isRegister: name ? true : false,
    },
    setUserName
  ];
}
