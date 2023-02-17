import 'dart:math';

import 'package:flutter/material.dart';

class TypingIndicator extends StatefulWidget {
  const TypingIndicator({super.key});

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator>
    with TickerProviderStateMixin {
  late AnimationController _repeatingController;

  final List<Interval> _dotIntervals = const [
    Interval(0.25, 0.8),
    Interval(0.35, 0.9),
    Interval(0.45, 1.0),
  ];

  @override
  void initState() {
    super.initState();

    _repeatingController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1500));
    _repeatingController.repeat();
  }

  @override
  void dispose() {
    _repeatingController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
        width: 20,
        height: 12,
        decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            color: Theme.of(context).colorScheme.background),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
          FlashingCircle(
              interval: _dotIntervals[0],
              repeatingController: _repeatingController),
          FlashingCircle(
              interval: _dotIntervals[1],
              repeatingController: _repeatingController),
          FlashingCircle(
              interval: _dotIntervals[2],
              repeatingController: _repeatingController)
        ]));
  }
}

class FlashingCircle extends StatelessWidget {
  const FlashingCircle(
      {super.key, required this.interval, required this.repeatingController});

  final Interval interval;
  final AnimationController repeatingController;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
        animation: repeatingController,
        builder: (BuildContext context, Widget? child) {
          final double circleFlashPercent =
              interval.transform(repeatingController.value);

          final double circleColorPercent = sin(pi * circleFlashPercent);

          return Container(
              width: 4,
              height: 4,
              decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color.lerp(Theme.of(context).colorScheme.background,
                      Colors.grey, circleColorPercent)));
        });
  }
}
