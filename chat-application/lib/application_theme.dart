import 'package:flutter/material.dart';

// ===== ===== =====
// Colors
const primary = Color(0xffffde00);
const secondary = Color(0xffd94556);

const customBlack = Color(0xff1f1c38);
const customWhite = Color(0xfff5f5f7);
const customGrey = Color(0xff9e9cab);

const green = Colors.green;

// ===== ===== =====
// Themes
final applicationTheme = ThemeData(
  disabledColor: customGrey,
  colorScheme: ColorScheme(
    brightness: Brightness.light,
    // main action
    primary: customWhite,
    onPrimary: secondary,
    // other action
    secondary: customWhite,
    onSecondary: primary,
    // active status
    tertiary: green,
    // error
    error: Colors.white,
    onError: Colors.redAccent.shade100,
    // not used
    background: customWhite,
    onBackground: customBlack,
    surface: customWhite,
    onSurface: customBlack,
  ),
  iconTheme: const IconThemeData(
    color: secondary,
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: secondary,
      foregroundColor: customWhite,
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      foregroundColor: secondary,
    ),
  ),
);
