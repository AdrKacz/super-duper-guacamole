import React from 'react';
import { StyleSheet, View, FlatList } from 'react-native';

import Message from '../Message/Message';

// TODO: Only display avatar on last message of someone when multiple messages next to eachothers
export default function MessageFeed({messages}) {
  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <Message
            message={item}
          />
        )}
        keyExtractor={(item) => item.key}
        inverted
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: 1,
    overflow: 'scroll',
  }
})

// 'background-image': 'linear-gradient(rgb(42, 127, 227) 0%, rgb(0, 191, 145) 50%, rgb(159, 213, 45) 100%)'
