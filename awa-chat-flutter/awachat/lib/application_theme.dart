import 'package:flutter/material.dart';

// ===== ===== =====
// Colors
const primary = Color(0xfff06449);
const secondary = Color(0xffF8F7F9);

const black = Color(0xff333138);
const grey = Color(0xff757780);
const green = Color(0xff6DA34D);

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
      primary: primary,
      onPrimary: secondary,
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      primary: primary,
    ),
  ),
);
