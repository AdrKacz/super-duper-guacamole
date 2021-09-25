import { useState } from 'react';

import useUser from '../user/useUser';

export default function useMessages() {

  const [user, _] = useUser()

  if (user === null) {
    return ([], (_) => (undefined))
  }

  const [messageQueue, setMessageQueue] = useState([])

  const [i, setI] = useState(0)
  function send(message) {
    console.log('Send message', message);
    setMessageQueue([...messageQueue.slice(-10), {
      what: message,
      who: user.name,
      isYours: i % 2 === 0 ? true : false
    }]);
    setI(i + 1);
  };

  return [messageQueue, send]
};


// const ws = new WebSocket('wss://boiling-waters-84504.herokuapp.com');
//
// ws.onopen = () => {
//   console.log(`[${Date.now()}] Connection Open`);
// };
//
// ws.onerror = (e) => {
//   console.log(`[${Date.now()}] Error: ${e.message}`);
//   console.log(e);
// }
//
// ws.onclose = (e) => {
//   console.log(`[${Date.now()}] Close with code ${e.code} for reason ${e.reason}`);
//   console.log(e);
// }

// ws.onmessage = (message) => {
//   console.log(`[${Date.now()}] Received Message`);
//   console.log(JSON.parse(message.data));
//   appendMessage(JSON.parse(message.data));
// };
