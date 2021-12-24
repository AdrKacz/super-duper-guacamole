/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

/** //Init not used (why ??)
import 'gun/lib/mobile.js'; // most important!
import GUN from 'gun/gun';
import SEA from 'gun/sea';
import 'gun/lib/radix.js';
import 'gun/lib/radisk.js';
import 'gun/lib/store.js';
import AsyncStorage from '@react-native-community/async-storage';
import asyncStore from 'gun/lib/ras.js';

// Warning: Android AsyncStorage has 6mb limit by default!
Gun({store: asyncStore({AsyncStorage})});
*/

import Gun from 'gun/gun';
const gun = new Gun('http://gunjs.herokuapp.com/gun'); // or use your own GUN relay

import React, {useState} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  useColorScheme,
} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';

import {Chat} from '@flyerhq/react-native-chat-ui';
import {SafeAreaProvider} from 'react-native-safe-area-context';

const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
};

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';

  const [messages, setMessages] = useState([]);
  const user = {id: '06c33e8b-e835-4736-80f4-63f44b66666c'};

  const addMessage = message => {
    setMessages([message, ...messages]);
  };

  const handleSendPress = message => {
    const textMessage = {
      author: user,
      createdAt: Date.now(),
      id: uuidv4(),
      text: message.text,
      type: 'text',
    };
    addMessage(textMessage);
  };

  // let hello = gun.get('hello');
  // hello.on((data, key) => {
  //   const n = data.name;
  //   if (name !== n) {
  //     setName(n);
  //   }
  // });

  // function handleOnPress() {
  //   hello.put({name: text});
  //   setText('');
  // }

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <SafeAreaProvider style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Chat messages={messages} onSendPress={handleSendPress} user={user} />
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default App;
