import React, {useState} from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  View,
} from 'react-native';

import stylesRoot from '../../styles/root';

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
      <TextInput
        style={styles.input}
        placeholder="Awa"
        onChangeText={t => setText(t)}
        value={text}
      />
      <TouchableOpacity style={styles.button} onPress={handlePress}>
        <Image style={styles.image} source={require('../../assets/send.png')} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: stylesRoot.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    lineHeight: 24,
    backgroundColor: stylesRoot.inputBackground,
    padding: 6,
    paddingLeft: 12,
    marginRight: 10,
    alignSelf: 'center',
  },
  button: {
    backgroundColor: '#859a9b',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  image: {
    tintColor: stylesRoot.background,
    resizeMode: 'contain',
    width: 24,
    height: 24,
  },
});
