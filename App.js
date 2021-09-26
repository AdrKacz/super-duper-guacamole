import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, SafeAreaView, KeyboardAvoidingView } from 'react-native';

import useMessages from './hooks/messages/useMessages';

import useUser from './hooks/user/useUser';

import Register from './components/Register/Register';

import AvatarBanner from './components/AvatarBanner/AvatarBanner';
import MessageFeed from './components/MessageFeed/MessageFeed';
import MessageInput from './components/MessageInput/MessageInput';

export default function App() {
  const [user, setUser] = useUser();
  const [messageQueue, sendMessage] = useMessages(user);

  function handleMessageInput(message) {
    sendMessage(message);
  };

  function handleRegister(username) {
    setUser(username);
  }

  let appContent = <></>
  if (user.isRegister) {
    appContent = (
      <>
      <AvatarBanner
        user={user}
      />
      <MessageFeed
        messages={messageQueue}
      />
      <MessageInput
        onMessageInput={handleMessageInput}
      />
      </>
    );
  }
  else {
    appContent= (
      <Register
        onRegister={handleRegister}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.largecontainer}
    >
      <SafeAreaView style={styles.container}>
        {appContent}
        <StatusBar style="auto" />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  largecontainer: {
    flex: 1,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 6,
    paddingBottom: 6,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
