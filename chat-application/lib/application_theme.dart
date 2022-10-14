import 'package:flutter/material.dart';

// ===== ===== =====
// Colors
const primary = Color(0xff9758f8);
const secondary = Color(0xfff5f5f7);

const black = Color(0xff1f1c38);
const grey = Color(0xff9e9cab);
const green = Colors.green;

// ===== ===== =====
// Themes
final applicationTheme = ThemeData(
  disabledColor: grey,
  colorScheme: ColorScheme(
    brightness: Brightness.light,
    // main action
    primary: secondary,
    onPrimary: primary,
    // other action
    secondary: secondary,
    onSecondary: black,
    // active status
    tertiary: green,
    // error
    error: Colors.white,
    onError: Colors.redAccent.shade100,
    // not used
    background: Colors.transparent,
    onBackground: Colors.transparent,
    surface: Colors.transparent,
    onSurface: Colors.transparent,
  ),
  iconTheme: const IconThemeData(
    color: primary,
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: primary,
      foregroundColor: secondary,
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      foregroundColor: primary,
    ),
  ),
);
