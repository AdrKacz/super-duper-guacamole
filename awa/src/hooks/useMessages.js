/**
 * message format : <date><user><uuid><text>
 * date: Date.now() (20 char)
 * user: user uuidv4 (36 char)
 * uuid: message uuidv4 (36 char)
 * text: message
 * uuid format : xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx
 */

import 'react-native-get-random-values';
import {v4 as uuidv4} from 'uuid';

import {useReducer, useEffect} from 'react';

import gun from '../gun/gun';

const chat = gun.get('chatapp-dev2');

const messages = {};
const getMessages = () =>
  Object.values(messages)
    .slice()
    .sort((a, b) => a.createdAt < b.createdAt);

const zeroPad = (num, places) => String(num).padStart(places, '0');

const userId = uuidv4();

function reducer(state, action) {
  switch (action.type) {
    case 'add message':
      messages[action.message.id] = action.message;
      return {messages: getMessages()};
    default:
      throw new Error("Action Type doesn't exist");
  }
}

function useMessages() {
  const [state, dispatch] = useReducer(reducer, {messages: getMessages()});

  const handleMessage = ({type, text}) => {
    if (type === 'text' && text.trim()) {
      const d = zeroPad(Date.now(), 20).toString();
      const u = userId.toString();
      const uuid = uuidv4();
      const t = text.toString();
      sendMessage(d + u + uuid + t);
    }
  };

  const sendMessage = async value => {
    chat.set(value);
  };

  useEffect(() => {
    chat.map().once(async value => {
      if (value) {
        const d = value.slice(0, 20);
        const u = value.slice(20, 56);
        const uuid = value.slice(56, 92);
        const t = value.slice(92);
        if (!(uuid in messages)) {
          dispatch({
            type: 'add message',
            message: {
              author: {id: u},
              type: 'text',
              text: t,
              createdAt: parseInt(d, 10),
              id: d + uuid,
            },
          });
        }
      }
    });
  }, []);

  return {
    messages: state.messages,
    handleMessage,
    user: {id: userId},
  };
}

export default useMessages;
