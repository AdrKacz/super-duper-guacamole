import { useState } from 'react';

import useUser from '../user/useUser';

export default function useMessages(user) {
  const [messageQueue, setMessageQueue] = useState([])

  function send(message) {
    if (!user.isRegister) {
      return;
    };
    setMessageQueue([{
      id: parseInt(Math.random() * 1e6).toString(),
      what: message,
      who: user.name,
      isYours: true,
    }, ...messageQueue.slice(-1000)]);
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
