import {useState} from 'react';

export default function useMessages(user) {
  const [messageQueue, setMessageQueue] = useState([]);

  function send(message) {
    if (!user.isRegister) {
      return;
    }
    // TODO: Not secure, message object should be created server side
    setMessageQueue([
      {
        what: message,
        key: user.key + Date.now().toString().substring(-7),
        who: user.name,
        isYours: messageQueue.length % 3 === 0 ? true : false,
      },
      ...messageQueue.slice(-1000),
    ]);
  }

  return [messageQueue, send];
}
