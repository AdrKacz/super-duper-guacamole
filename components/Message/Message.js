import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Message({what, who, when}) {
  return (
    <View>
      <Text>{who}: {what}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
