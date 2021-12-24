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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  TextInput,
  Button,
} from 'react-native';

import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';

  const [text, setText] = useState('What is your name?');
  const [name, setName] = useState('');

  let hello = gun.get('hello');
  hello.on((data, key) => {
    const n = data.name;
    if (name !== n) {
      setName(n);
    }
  });

  function handleOnPress() {
    hello.put({name: text});
    setText('');
  }

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Text style={styles.welcome}>Hello {name}</Text>
      <TextInput value={text} onChangeText={value => setText(value)} />
      <Button title="Update" onPress={handleOnPress} />
    </SafeAreaView>
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
