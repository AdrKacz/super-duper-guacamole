import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

export default function MessageInput(props) {
  const [text, setText] = useState('');
  return (
    <View>
      <TextInput>
        placeholder="Aa"
        onChangeText={text => setText(text)}
        defaultValue={text}
      </TextInput>
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
