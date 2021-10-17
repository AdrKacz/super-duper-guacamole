import React from 'react';

import { StyleSheet, TouchableOpacity, Image} from 'react-native';

import stylesRoot from '../../styles/root';

export default function Return({onReturn}) {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onReturn}
    >
      <Image
        style={styles.image}
        source={require('./left-arrow.png')}
      />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 38,
    left: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    tintColor: '#000',
    resizeMode: 'contain',
    width: 24,
    height: 24,
  }
});
