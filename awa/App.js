/**
 *
 * @format
 * @flow strict-local
 */

/* Dark Mode Support
import { useColorScheme } from 'react-native';
const isDarkMode = useColorScheme() === 'dark';
color: isDarkMode ? Colors.white : Colors.black,
backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
*/

import React, {useState} from 'react';
import {
  Platform,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
} from 'react-native';

import useMessages from './hooks/messages/useMessages';

import useUser from './hooks/user/useUser';

import Return from './components/Return/Return';

import Register from './components/Register/Register';

import UserPage from './components/UserPage/UserPage';

import AvatarBanner from './components/AvatarBanner/AvatarBanner';
import MessageFeed from './components/MessageFeed/MessageFeed';
import MessageInput from './components/MessageInput/MessageInput';

export default function App() {
  const [lookAtUser, setLookAtUser] = useState();
  const [user, setUser] = useUser();
  const [messageQueue, sendMessage] = useMessages(user);
  console.log(messageQueue)

  function handleMessageInput(message) {
    sendMessage(message);
  }

  function handleRegister(username) {
    setUser(username);
  }

  function handleUserSelected({key, name}) {
    setLookAtUser({
      key: key,
      name: name,
    });
  }

  let appContent = <></>;
  if (user.isRegister) {
    if (lookAtUser) {
      appContent = (
        <>
          <AvatarBanner user={user} onUserSelected={handleUserSelected} />
          <UserPage
            user={lookAtUser}
            onLeave={() => {
              setUser('');
              setLookAtUser(null);
            }}
          />
          <Return onReturn={() => setLookAtUser(null)} />
        </>
      );
    } else {
      appContent = (
        <>
          <AvatarBanner user={user} onUserSelected={handleUserSelected} />
          <MessageFeed
            messages={messageQueue}
            onUserSelected={handleUserSelected}
          />
          <MessageInput onMessageInput={handleMessageInput} />
        </>
      );
    }
  } else {
    appContent = <Register onRegister={handleRegister} />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.largecontainer}>
      <SafeAreaView style={styles.container}>{appContent}</SafeAreaView>
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
    paddingTop: Platform.OS === 'android' ? 32 : 0, // safe view for android
  },
});
