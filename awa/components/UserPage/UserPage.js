import React from 'react';

import {StyleSheet, TouchableOpacity, Text, View} from 'react-native';

import getColor from '../../styles/Colors';

import useUser from '../../hooks/user/useUser';

import Avatar from '../Avatar/Avatar';

export default function UserPage({user, onLeave}) {
  const [localUser] = useUser();

  return (
    <View style={styles.container}>
      <View style={styles.avatarcontainer}>
        <Avatar
          width={styles.avatar.width}
          height={styles.avatar.height}
          seed={user.key}
        />
      </View>
      <Text style={styles.username}>{user.name}</Text>
      {localUser.key === user.key && (
        <TouchableOpacity
          style={{
            backgroundColor: getColor('interactiveColor'),
            ...styles.button,
          }}
          onPress={onLeave}>
          <Text
            style={{
              color: getColor('textColor'),
            }}>
            Leave chat
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    padding: 20,
  },
  avatarcontainer: {
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    resizeMode: 'contain',
    width: 64,
    height: 64,
  },
  button: {
    marginBottom: 10,
    borderRadius: 24,
    width: 128,
    padding: 12,
    alignItems: 'center',
  },
});
