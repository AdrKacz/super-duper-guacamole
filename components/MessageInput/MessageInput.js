import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Image, View } from 'react-native';

import stylesRoot from '../../styles/root';

export default function MessageInput({onMessageInput}) {
  const [text, setText] = useState('');

  function handlePress() {
    console.log(`Text input is <${text}>`);

    if (text === '') {
      return;
    }

    onMessageInput(text);

    setText('');
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Aa"
        onChangeText={text => setText(text)}
        value={text}
      >
      </TextInput>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
      >
        <Image
          style={styles.image}
          source={require('../../assets/send.png')}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    backgroundColor: stylesRoot.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 20,
    paddingRight: 20,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    lineHeight: 24,
    backgroundColor: stylesRoot.inputBackground,
    padding: 6,
    marginRight: 10,
  },
  button: {
    backgroundColor: '#859a9b',
    borderRadius: 20,
    alignItems: 'center',
    padding: 6,

  },
  image: {
    tintColor: stylesRoot.background,
    resizeMode: 'contain',
    width: 24,
    height: 24,
  }
});
