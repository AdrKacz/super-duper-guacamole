import React, {useState} from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  View,
} from 'react-native';

import getColor from '../../styles/Colors';

export default function MessageInput({onMessageInput}) {
  const [text, setText] = useState('');

  function handlePress() {
    if (text === '') {
      return;
    }
    onMessageInput(text);
    setText('');
  }

  return (
    <View style={styles.container}>
      <View
        style={{
          backgroundColor: getColor('interactiveColor'),
          ...styles.inputview,
        }}>
        <TextInput
          multiline
          style={{
            color: getColor('textColor'),
            ...styles.input,
          }}
          placeholder="Awa"
          placeholderTextColor={getColor('placeholder')}
          onChangeText={t => setText(t)}
          value={text}
        />
      </View>
      <TouchableOpacity
        style={{
          backgroundColor: getColor('interactiveColor'),
          ...styles.button,
        }}
        onPress={handlePress}>
        <Image
          style={{
            tintColor: getColor('textColor'),
            ...styles.image,
          }}
          source={require('./send.png')}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 10,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  inputview: {
    flex: 1,
    minHeight: 50,
    maxHeight: 150,
    borderRadius: 25,
    padding: 4,
    paddingHorizontal: 18,
    marginRight: 12,
    justifyContent: 'center',
  },
  input: {
    padding: 8,
    textAlignVertical: 'top',
  },
  button: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    resizeMode: 'contain',
    width: 25,
    height: 25,
  },
});
