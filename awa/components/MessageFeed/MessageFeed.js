import React from 'react';
import {StyleSheet, View, FlatList} from 'react-native';

import Message from '../Message/Message';

// TODO: Only display avatar on last message of someone when multiple messages next to eachothers
export default function MessageFeed({messages, onUserSelected}) {
  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={({item}) => (
          <Message
            message={item}
            onUserSelected={() =>
              onUserSelected({key: item.userkey, name: item.who})
            }
          />
        )}
        keyExtractor={item => item.id}
        inverted
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'scroll',
  },
});
