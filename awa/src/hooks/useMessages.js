import {useReducer, useEffect} from 'react';

import gun from '../gun/gun';

import {sendNotifications} from '../helpers/notifications';

import {getTokens} from '../gun/tokens';

const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
};

const recentMatcher = {
  // lexical queries are kind of like a limited RegEx or Glob.
  '.': {
    // property selector
    '>': new Date(+new Date() - 1 * 1000 * 60 * 60 * 3).toISOString(), // find any indexed property larger ~3 hours ago
  },
  '-': 1, // filter in reverse
};

const chat = gun.get('chat');

// TODO: ensure that user is alays empty if it has no id
const user = {};

const messages = {};

function getState() {
  return {
    messages: Object.values(messages)
      .slice()
      .sort((a, b) => a.createdAt < b.createdAt),
    user: user,
  };
}

function reducer(state, action) {
  // console.log('Call Reducer');
  // console.log('\tState:', state);
  // console.log('\tAction:', action);
  switch (action.type) {
    case 'set user id':
      user.id = action.id;
      return getState();
    case 'send message text':
      if (!user.id) {
        console.warn('No user defined');
        return getState();
      }
      const sendedMessage = {
        authorId: user.id,
        createdAt: Date.now(),
        id: Date.now() + '-' + uuidv4(),
        text: action.text,
        type: 'text',
      };
      // Put Message in Db
      const index = new Date().toISOString();
      chat.get(index).put(sendedMessage);
      return getState();
    case 'add message':
      console.log(`[${user.id}]\tAdd:\t\t${action.message.text}`);
      const addedMessage = {
        author: {id: action.message.authorId},
        createdAt: action.message.createdAt,
        id: action.message.id,
        text: action.message.text,
        type: 'text',
      };
      messages[addedMessage.id] = addedMessage;
      return getState();
    default:
      throw new Error();
  }
}

function useMessage(userId) {
  const [state, dispatch] = useReducer(reducer, {});
  if (!state.user) {
    dispatch({type: 'set user id', id: userId});
  }

  const sendMessage = async message => {
    // Only handle text message for now (message.text)
    dispatch({type: 'send message text', text: message.text});
    // Send notification
    // console.log(await getRawTokens());
    sendNotifications({tokens: await getTokens()});
  };

  const collectMessages = () => {
    chat.map(recentMatcher).once(async value => {
      console.log(`[${user.id}]\tReceive:\t${value.text}`);
      if (value && !messages[value.id]) {
        // await displayNotification({message: value.text});
        dispatch({type: 'add message', message: value});
      }
    });
  };

  useEffect(() => {
    collectMessages();
  }, []);

  return [state.messages, state.user, sendMessage];
}

export default useMessage;
