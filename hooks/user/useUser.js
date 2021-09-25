import { useState } from 'react';

export default function useUser() {
  const [name, setName] = useState('Mario');

  function setUserName(userName) {
    setName(userName);
  };

  return [{
    name: name
  }, setUserName];
}
