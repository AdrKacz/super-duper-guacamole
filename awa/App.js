/**
 *
 * @format
 * @flow strict-local
 */

import React, {useState} from 'react';
import {
  useColorScheme,
  StatusBar,
  Platform,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
} from 'react-native';

import getColor, {setColor} from './styles/Colors';

import useMessages from './hooks/messages/useMessages';

import useUser from './hooks/user/useUser';

import Return from './components/Return/Return';

import Register from './components/Register/Register';

import UserPage from './components/UserPage/UserPage';

import AvatarBanner from './components/AvatarBanner/AvatarBanner';
import MessageFeed from './components/MessageFeed/MessageFeed';
import MessageInput from './components/MessageInput/MessageInput';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';
  setColor('backgroundColor', isDarkMode ? 'black' : 'light');
  setColor('interactiveColor', isDarkMode ? 'dark' : 'white');
  setColor('textColor', isDarkMode ? 'white' : 'black');
  setColor('placeholder', isDarkMode ? 'placeholder' : 'placeholderDarkMode');

  const [lookAtUser, setLookAtUser] = useState();
  const [user, setUser] = useUser();
  const [messageQueue, sendMessage] = useMessages(user);

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
      style={{flex: 1, backgroundColor: getColor('backgroundColor')}}>
      <SafeAreaView style={{flex: 1}}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        {appContent}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
