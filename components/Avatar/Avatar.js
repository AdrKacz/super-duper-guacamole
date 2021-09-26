import React from 'react';
import { SvgCssUri } from 'react-native-svg';

export default function Avatar({seed, width, height}) {
  return (
    <SvgCssUri
      uri={`https://avatars.dicebear.com/api/gridy/${seed}.svg?radius=50`}
      width={width}
      height={height}
    />
  );
}
