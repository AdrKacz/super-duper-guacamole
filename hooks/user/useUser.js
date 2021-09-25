import { useState } from 'react';

export default function useUser() {
  const [name, setName] = useState();

  function setUserName(userName) {
    setName(userName);
  };
  return [{
      name: name,
      isRegister: name ? true : false,
    },
    setUserName
  ];
}
