import { useState, useEffect } from 'react';

import { API, graphqlOperation } from 'aws-amplify';
import { createMessage } from '../../src/graphql/mutations';
import { onCreateMessage } from '../../src/graphql/subscriptions';

let subscription;
export default function useMessages(user) {
  const [messageQueue, setMessageQueue] = useState([]);


  useEffect(() => {
    subscription = API.graphql(graphqlOperation(onCreateMessage)).subscribe({
      next: ({ provider, value }) => {
        message = value.data.onCreateMessage;
        if (messageQueue.length > 0 && messageQueue[0].userkey === message.userkey) {
          messageQueue[0].isLast = false;
        }
        console.log('Receive', message);
        setMessageQueue([
          {
            id: message.id,
            what: message.what,
            userkey: message.userkey,
            who: message.who,
            isYours: user.key === message.userkey ? true : false,
            isLast: true,
          },
          ...messageQueue.slice(-1000),
        ]);
      },
      error: error => console.warn(error)
    });

    return () => {
      subscription.unsubscribe();
    }
  });

  async function send(text) {
    if (!user.isRegister) {
      return;
    }
    // TODO: Not secure, message object should be created server side
    try {
      const message = {
        what: text,
        who: user.name,
        userkey: user.key,
      };
      await API.graphql(graphqlOperation(createMessage, {input: message}))
    } catch (err) {
      console.warn('error creating message:', err)
    }
  }

  return [messageQueue, send];
}
