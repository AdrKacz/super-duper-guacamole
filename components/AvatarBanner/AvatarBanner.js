import React from 'react';
import { StyleSheet, TouchableOpacity, Image, View} from 'react-native';

import stylesRoot from '../../styles/root';

export default function AvatarBanner({user, onUserSelected}) {
  function handlePress() {
    onUserSelected({key: user.key, name: user.name});
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.avatarcontainer}
        onPress={handlePress}
      >
        <Image
          style={styles.avatar}
          source={{
            uri: `https://avatars.dicebear.com/api/gridy/${user.key}.svg?radius=50`
          }}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#859a9b',
  },
  avatarcontainer: {
    backgroundColor: stylesRoot.inputBackground,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    margin: 3,
  },
  avatar: {
    resizeMode: 'contain',
    width: 24,
    height: 24,
  }
});
