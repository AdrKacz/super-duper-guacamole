import React, { useState } from 'react';
import { StyleSheet, TextInput, Button, View } from 'react-native';

export default function MessageInput({onMessageInput}) {
  const [text, setText] = useState('');

  function handlePress() {
    console.log(`Text input is <${text}>`);

    if (text === '') {
      return;
    }

    onMessageInput({
      what: text,
      who: 'Unknown',
      when: Date.now(),
    });

    setText('');
  }

  return (
    <View>
      <TextInput
        placeholder="Aa"
        onChangeText={text => setText(text)}
        value={text}
      >
      </TextInput>
      <Button
        onPress={handlePress}
        title="Submit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
