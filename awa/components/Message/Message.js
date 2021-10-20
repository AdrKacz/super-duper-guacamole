import React from 'react';

import {StyleSheet, TouchableOpacity, View, Text} from 'react-native';

import Avatar from '../Avatar/Avatar';

export default function Message({message, onUserSelected}) {
  const what = message.what;
  const isYours = message.isYours;

  let avatar = (
    <View
      style={{
        width: styles.avatar.width + styles.avatarcontainer.paddingRight,
        height: styles.avatar.height,
      }}
    />
  );

  if (!isYours && message.isLast) {
    avatar = (
      <TouchableOpacity style={styles.avatarcontainer} onPress={onUserSelected}>
        <Avatar
          seed={message.avatar}
          width={styles.avatar.width}
          height={styles.avatar.height}
        />
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.container}>
      {avatar}
      <View style={{flex: 1, flexDirection: isYours ? 'row-reverse' : 'row'}}>
        <View
          style={{
            backgroundColor: isYours ? 'lightblue' : 'white',
            ...styles.message,
          }}>
          <Text
            style={{
              color: isYours ? 'white' : 'black',
            }}>
            {what}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 4,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
  },
  message: {
    borderRadius: 25,
    padding: 12,
  },
  avatarcontainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 8,
  },
  avatar: {
    resizeMode: 'contain',
    width: 24,
    height: 24,
  },
});
