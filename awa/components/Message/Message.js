import React from 'react';

import {StyleSheet, TouchableOpacity, View, Text} from 'react-native';

import Avatar from '../Avatar/Avatar';

import stylesRoot from '../../styles/root';

export default function Message({message, onUserSelected}) {
  const what = message.what;
  const isYours = message.isYours;

  return (
    <View
      style={[
        styles.container,
        {flexDirection: isYours ? 'row-reverse' : 'row'},
      ]}>
      {!isYours && (
        <TouchableOpacity
          style={styles.avatarcontainer}
          onPress={onUserSelected}>
          <Avatar
            seed={message.key.substring(0, 5)}
            width={styles.avatar.width}
            height={styles.avatar.height}
          />
        </TouchableOpacity>
      )}
      <View
        style={[
          styles.message,
          {
            backgroundColor: isYours
              ? stylesRoot.ownedMessageBackgroundColor
              : stylesRoot.otherMessageBackgroundColor,
            textAlign: isYours ? 'right' : 'left',
          },
        ]}>
        <Text
          style={{
            color: isYours
              ? stylesRoot.ownedMessageTextColor
              : stylesRoot.otherMessageTextColor,
          }}>
          {what}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 3,
  },
  message: {
    borderRadius: 20,
    lineHeight: 24,
    padding: 6,
    paddingLeft: 12,
    paddingRight: 12,
  },
  avatarcontainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  avatar: {
    resizeMode: 'contain',
    width: 20,
    height: 20,
  },
});

// background-image: linear-gradient(rgb(42, 127, 227), rgb(0, 191, 145), rgb(159, 213, 45));
// background-image: linear-gradient(rgb(42, 127, 227) 0%, rgb(0, 191, 145) 50%, rgb(159, 213, 45) 100%);
