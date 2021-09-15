import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import MessageInput from './components/MessageInput/MessageInput';
import Message from './components/Message/Message';

const ws = new WebSocket('ws://127.0.0.1:8000');

export default function App() {
  const [messages, setMessages] = useState([]);

  function appendMessage(message) {
    setMessages([...messages.slice(-10), message]);
  }

  function sendMessage(message) {
    ws.send(JSON.stringify(message));
  }

  function handleMessageInput(message) {
    sendMessage(message);
    // appendMessage(message);
  }

  ws.onopen = () => {
    console.log(`[${Date.now()}] Connection Open`);
  };

  ws.onmessage = (message) => {
    console.log(`[${Date.now()}] Received Message`);
    console.dir(message);
    appendMessage(JSON.parse(message.data));
  };



  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app!</Text>
      {messages.map((message, i) => (
        <Message
          key={i}
          what={message.what}
          who={message.who}
          when={message.when}
        />
      ))}
      <MessageInput
        onMessageInput={handleMessageInput}
      />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
