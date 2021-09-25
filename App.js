import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import useMessages from './hooks/messages/useMessages';

import useUser from './hooks/user/useUser';

import MessageFeed from './components/MessageFeed/MessageFeed';
import MessageInput from './components/MessageInput/MessageInput';

export default function App() {
  const [messageQueue, sendMessage] = useMessages();
  const [user, setUser] = useUser();

  function handleMessageInput(message) {
    sendMessage(message);
  };

  return (
    <View style={styles.container}>
      <MessageFeed
        messages={messageQueue}
      />
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
