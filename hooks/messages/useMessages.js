import { useState } from 'react';

import useUser from '../user/useUser';

const ws = new WebSocket('wss://s2h01vlcgi.execute-api.eu-west-3.amazonaws.com/Prod');
export default function useMessages(user) {
  const [messageQueue, setMessageQueue] = useState([])

  function send(message) {
    if (!user.isRegister) {
      return;
    };
    // TODO: Not secure, message object should be created server side
    ws.send(JSON.stringify({
      action:'sendmessage',
      data: JSON.stringify({
        what: message,
        key: user.key + Date.now().toString().substr(-7, 5),
        who: user.name,
      })
    }));
  };

  ws.onmessage = ({data}) => {
    const dataObject = JSON.parse(data);
    const userKey = dataObject.key.substr(0, 5);

    setMessageQueue([{
      ...dataObject,
      isYours: user.key === userKey ? true : false,
    }, ...messageQueue.slice(-1000)]);
  };

  return [messageQueue, send]
};
