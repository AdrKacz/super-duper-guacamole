import {v4 as uuidv4} from 'uuid';

import { useEffect } from 'react';

import gun from '../gun/gun';

import { useMessages as chatuiUseMessages } from '@chatui/core';

const chat = gun.get('chatapp-dev1');

const zeroPad = (num, places) => String(num).padStart(places, '0');

const userId = uuidv4();

function useMessages() {
    const { messages, appendMsg, } = chatuiUseMessages([]);

    const handleMessage = (type, value) => {
        if (type === 'text' && value.trim()) {
            const d = zeroPad(Date.now(), 20).toString();
            const u = userId.toString();
            const uuid = uuidv4();
            const t = value.toString();
            sendMessage(d + u + uuid + t);
        }
    }

    const sendMessage = async value => {
        chat.set(value);
    }

    useEffect(() => {
        chat.map().once(async value => {
            if (value) {
                const d = value.slice(0, 20);
                const u = value.slice(20, 56);
                const uuid = value.slice(56, 92);
                const t = value.slice(92);
                appendMsg({
                    type: 'text',
                    content: {text: t},
                    position: u === userId ? 'right' : 'left',
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