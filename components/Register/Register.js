import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';

import stylesRoot from '../../styles/root';

export default function Register({onRegister}) {
  const [username, setUsername] = useState('');

  function handlePress() {
    if (username === '') {
      return;
    };
    onRegister(username);
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="What's your name?"
        onChangeText={text => setUsername(text)}
        value={username}
      >
      </TextInput>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
      >
        <Text>Enter</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    margin: 20,
  },
  input: {
    width: '100%',
    borderRadius: 20,
    lineHeight: 24,
    backgroundColor: stylesRoot.inputBackground,
    padding: 6,
    paddingLeft: 12,
    marginRight: 10,
    marginBottom: 12,
  },
  button: {
    width: '100%',
    backgroundColor: '#E4E6EB',
    borderRadius: 20,
    alignItems: 'center',
    padding: 6,
  }
})
