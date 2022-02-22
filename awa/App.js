/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';

import {Chat, defaultTheme} from '@flyerhq/react-native-chat-ui';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import useMessages from './src/hooks/useMessages';

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';

  const {messages, user, handleMessage} = useMessages();

  const handleSendPress = async message => {
    handleMessage(message);
  };

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <SafeAreaProvider style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Chat
        theme={{
          ...defaultTheme,
          colors: {...defaultTheme.colors},
        }}
        messages={messages}
        onSendPress={handleSendPress}
        user={user}
      />
    </SafeAreaProvider>
  );
};

/**
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
*/

export default App;
