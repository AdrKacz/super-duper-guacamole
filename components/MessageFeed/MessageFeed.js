import React from 'react';
import { StyleSheet, View } from 'react-native';

import Message from '../Message/Message';

export default function MessageFeed({messages}) {
  return (
    <View style={styles.container}>
      {messages.map((message, i) => (
        <Message
          key={i}
          what={message.what}
          who={message.who}
          isYours={message.isYours}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    'box-sizing': 'border-box',
    display: 'flex',
    width: '100%',
  }
})

// 'background-image': 'linear-gradient(rgb(42, 127, 227) 0%, rgb(0, 191, 145) 50%, rgb(159, 213, 45) 100%)'
