import React, {useState} from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';

import getColor from '../../styles/Colors';

export default function Register({onRegister}) {
  const [username, setUsername] = useState('');

  function handlePress() {
    if (username === '') {
      return;
    }
    onRegister(username);
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={{
          backgroundColor: getColor('interactiveColor'),
          color: getColor('textColor'),
          ...styles.input,
        }}
        placeholder="What's your name?"
        onChangeText={text => setUsername(text)}
        value={username}
      />
      <TouchableOpacity
        style={{
          backgroundColor: getColor('interactiveColor'),
          color: getColor('textColor'),
          ...styles.button,
        }}
        onPress={handlePress}>
        <Text
          style={{
            color: getColor('textColor'),
          }}>
          Chat
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    height: 50,
    marginBottom: 32,
    padding: 8,
    borderRadius: 25,
    minWidth: 256,
    paddingHorizontal: 18,
  },
  button: {
    marginBottom: 10,
    borderRadius: 24,
    width: 128,
    padding: 12,
    alignItems: 'center',
  },
});
