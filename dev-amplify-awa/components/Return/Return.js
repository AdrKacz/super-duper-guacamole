import React from 'react';

import {StyleSheet, TouchableOpacity, Image, Text, View} from 'react-native';

import getColor from '../../styles/Colors';

export default function Return({onReturn}) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onReturn}>
        <Image
          style={{
            tintColor: getColor('textColor'),
            ...styles.image,
          }}
          source={require('./left-arrow.png')}
        />
        <Text
          style={{
            color: getColor('textColor'),
          }}>
          Return to chat
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    width: 128,
    padding: 12,
    marginBottom: 10,
    borderRadius: 24,
  },
  image: {
    resizeMode: 'contain',
    width: 24,
    height: 24,
    paddingRight: 8,
  },
});
