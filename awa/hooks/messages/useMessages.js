import {useState} from 'react';

export default function useMessages(user) {
  const [messageQueue, setMessageQueue] = useState([]);

  function send(message) {
    if (!user.isRegister) {
      return;
    }
    // TODO: Not secure, message object should be created server side
    // NOTE: Store message - Should be in receiver function
    const who = messageQueue.length % 3 === 0 ? user.name : 'other';
    if (messageQueue.length > 0 && messageQueue[0].who === who) {
      messageQueue[0].isLast = false;
    }
    setMessageQueue([
      {
        what: message,
        key: user.key + Date.now().toString().substring(-7),
        who: who,
        isYours: user.name === who ? true : false,
        isLast: true,
      },
      ...messageQueue.slice(-1000),
    ]);
  }

  return [messageQueue, send];
}
