import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, SafeAreaView, KeyboardAvoidingView } from 'react-native';

import useMessages from './hooks/messages/useMessages';

import useUser from './hooks/user/useUser';

import Return from './components/Return/Return';

import Register from './components/Register/Register';

import UserPage from './components/UserPage/UserPage';

import AvatarBanner from './components/AvatarBanner/AvatarBanner';
import MessageFeed from './components/MessageFeed/MessageFeed';
import MessageInput from './components/MessageInput/MessageInput';

export default function App() {
  const [lookAtUser, setLookAtUser] = useState()
  const [user, setUser] = useUser();
  const [messageQueue, sendMessage] = useMessages(user);

  function handleMessageInput(message) {
    sendMessage(message);
  };

  function handleRegister(username) {
    setUser(username);
  }

  function handleUserSelected({key, name}) {
    setLookAtUser({
      key: key,
      name: name,
    })
  }
  console.log('Re-render with user')
  console.dir(user)
  let appContent = <></>
  if (user.isRegister) {
    if (lookAtUser) {
      appContent = (
        <>
        <AvatarBanner
          user={user}
          onUserSelected={handleUserSelected}
        />
        <UserPage
          user={lookAtUser}
          onLeave={() => {setUser(''); setLookAtUser(null)}}
        />
        <Return
          onReturn={() => (setLookAtUser(null))}
        />
        </>
      );
    } else {
      appContent = (
        <>
        <AvatarBanner
          user={user}
          onUserSelected={handleUserSelected}
        />
        <MessageFeed
          messages={messageQueue}
          onUserSelected={handleUserSelected}
        />
        <MessageInput
          onMessageInput={handleMessageInput}
        />
        </>
      );
    }
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
