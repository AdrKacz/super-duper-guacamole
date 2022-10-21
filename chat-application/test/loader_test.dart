import 'package:awachat/widgets/loader.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Loader is a centered circular indicator',
      (WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(
        theme: ThemeData(
            colorScheme: const ColorScheme.light(onPrimary: Colors.white)),
        home: const Loader()));

    Finder circularProgressIndicatorFinder = find.byWidgetPredicate(
        (Widget widget) =>
            widget is CircularProgressIndicator &&
            widget.color == Colors.white);

    Finder circularProgressIndicatorAncestorFinder = find.ancestor(
        of: circularProgressIndicatorFinder,
        matching: find.byWidgetPredicate((Widget widget) => widget is Center));

    expect(circularProgressIndicatorFinder, findsOneWidget);
    expect(circularProgressIndicatorAncestorFinder, findsOneWidget);
  });
}
