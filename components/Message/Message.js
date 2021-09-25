import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Message({what, who, isYours}) {
  return (
    <View style={styles.container}>
      <Text>{what}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    color: '#1c1e21',
    writingDirection: 'ltr',
    'line-height': '1.34',
    '-webkit-font-smoothing': 'antialiased',
    'font-size': '.9375rem',
    display: 'flex',
    width: '100%',
    'font-family': 'inherit',
  },
});

// background-image: linear-gradient(rgb(42, 127, 227), rgb(0, 191, 145), rgb(159, 213, 45));
// background-image: linear-gradient(rgb(42, 127, 227) 0%, rgb(0, 191, 145) 50%, rgb(159, 213, 45) 100%);
