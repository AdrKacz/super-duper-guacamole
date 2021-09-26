import React from 'react';

import { StyleSheet, TouchableOpacity, Image, Text, View} from 'react-native';

import useUser from '../../hooks/user/useUser';

import stylesRoot from '../../styles/root';

export default function UserPage({user, onLeave}) {
  const [localUser, setLocalUser] = useUser();

  return (
    <View style={styles.container}>
      <View style={styles.avatarcontainer}>
        <Image
          style={styles.avatar}
          source={{
            uri: `https://avatars.dicebear.com/api/gridy/${user.key}.svg?radius=50`
          }}
        />
      </View>
      <Text style={styles.username}>{user.name}</Text>
      {localUser.key === user.key && (
        <TouchableOpacity
          style={styles.button}
          onPress={onLeave}
        >
          <Text style={styles.leavetext}>Leave Awa</Text>
        </TouchableOpacity>
      )}
    </View>
  )
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontSize: 42,
  },
  avatarcontainer: {
    backgroundColor: stylesRoot.inputBackground,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 12,
  },
  avatar: {
    resizeMode: 'contain',
    width: 64,
    height: 64,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#859a9b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
    borderRadius: 6,
  },
  leavetext: {
    color: '#fff',
    fontSize: 24,
  }
});
