import { useEffect } from 'react';

import gun from '../gun/gun';

import { useMessages as chatuiUseMessages } from '@chatui/core';

const chat = gun.get('chatweb-dev0');

const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.floor(Math.random() * 16);
      const v = c === 'x' ? r : (r % 4) + 8;
      return v.toString(16);
    });
  };

const userId = uuidv4();

function useMessages() {
    const { messages, appendMsg, } = chatuiUseMessages([]);

    const handleMessage = (type, value) => {
        if (type === 'text' && value.trim()) {
            sendMessage(userId + value);
        }
    }

    const sendMessage = async value => {
        chat.set(value);
    }

    useEffect(() => {
        chat.map().once(async value => {
            if (value) {
                appendMsg({
                    type: 'text',
                    content: {text: value.slice(36)},
                    position: value.slice(0, 36) === userId ? 'right' : 'left',
                });
            }
        })
    }, [appendMsg]);

    return {
        messages,
        handleMessage,
    };
}

export default useMessages;