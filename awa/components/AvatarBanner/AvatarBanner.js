import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';

import Avatar from '../Avatar/Avatar';

import getColor from '../../styles/Colors';

export default function AvatarBanner({user, onUserSelected}) {
  function handlePress() {
    onUserSelected({key: user.key, name: user.name});
  }

  return (
    <View
      style={{
        borderBottomColor: getColor('textColor'),
        ...styles.container,
      }}>
      <TouchableOpacity styles={styles.avatarcontainer} onPress={handlePress}>
        <Avatar
          seed={user.key}
          width={styles.avatar.width}
          height={styles.avatar.height}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: 10,
    borderBottomWidth: 2,
  },
  avatarcontainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    resizeMode: 'contain',
    width: 30,
    height: 30,
  },
});
