// App-wide serif font (Times New Roman). RN 0.85's Text is a plain function
// component (no .render to patch), so instead we export thin wrappers that
// inject the font, and every file imports Text/TextInput from here.

import React from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  TextProps,
  TextInputProps,
} from 'react-native';

const SERIF = { fontFamily: 'Times New Roman' as const };

export function Text(props: TextProps) {
  return <RNText {...props} style={[SERIF, props.style]} />;
}

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>((props, ref) => {
  return <RNTextInput ref={ref} {...props} style={[SERIF, props.style]} />;
});
TextInput.displayName = 'TextInput';
