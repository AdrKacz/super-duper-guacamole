import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class Presentation extends StatelessWidget {
  const Presentation({Key? key, required this.nextAppStatus}) : super(key: key);

  final Function nextAppStatus;

  @override
  Widget build(BuildContext context) {
    final slides = <Widget>[
      Slide(
        text: AppLocalizations.of(context)!.hiImAwa,
        assetPath: 'assets/images/astronaut-suit.gif',
      ),
      Slide(
          text: AppLocalizations.of(context)!.iWillTakeYouToAGroup,
          assetPath: 'assets/images/chat.gif'),
      CustomSlide(
          assetPath: 'assets/images/outer-space.gif',
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                    text: AppLocalizations.of(context)!.youCanBeInOnlyAGroupAtATime),
                TextSpan(
                    text: 'Swipe',
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.onPrimary,
                        fontWeight: FontWeight.bold)),
                TextSpan(text: AppLocalizations.of(context)!.toLeftOrTouchHere),
                const WidgetSpan(child: Icon(Icons.door_front_door_outlined)),
                  TextSpan(
                    text:AppLocalizations.of(context)!.onTopRightToExploreAnotherGroup)
              ],
            ),
            textAlign: TextAlign.center,
          )),
        Slide(
          text: AppLocalizations.of(context)!.ifYouAreOffendedHoldDownAMessage,
          assetPath: 'assets/images/taken.gif'),
      SlideWithButton(
        text: AppLocalizations.of(context)!.readyToMeetSomeNewFriends,
        assetPath: 'assets/images/launching.gif',
        buttonText: AppLocalizations.of(context)!.letsGo,
        onPressed: () {
          nextAppStatus();
        },
      ),
    ];
    return Scaffold(
      body: SafeArea(
        child: DefaultTabController(
          length: slides.length,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Expanded(child: TabBarView(children: slides)),
              TabPageSelector(
                color: Theme.of(context).colorScheme.primary,
                selectedColor: Theme.of(context).colorScheme.onPrimary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ===== ===== =====
// ===== ===== =====
// HELPERS

class SlideContainer extends StatelessWidget {
  const SlideContainer({Key? key, required this.child}) : super(key: key);

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Center(
        child: SingleChildScrollView(child: child),
      ),
    );
  }
}

class Slide extends StatelessWidget {
  const Slide({Key? key, required this.text, required this.assetPath})
      : super(key: key);

  final String text;
  final String assetPath;
  @override
  Widget build(BuildContext context) {
    return SlideContainer(
        child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Image.asset(assetPath),
        const Divider(height: 48),
        Text(text, textAlign: TextAlign.center),
      ],
    ));
  }
}

class CustomSlide extends StatelessWidget {
  const CustomSlide({Key? key, required this.child, required this.assetPath})
      : super(key: key);

  final Widget child;
  final String assetPath;
  @override
  Widget build(BuildContext context) {
    return SlideContainer(
        child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Image.asset(assetPath),
        const Divider(height: 48),
        child,
      ],
    ));
  }
}

class SlideWithButton extends StatelessWidget {
  const SlideWithButton(
      {Key? key,
      required this.text,
      required this.assetPath,
      required this.buttonText,
      required this.onPressed})
      : super(key: key);

  final String text;
  final String assetPath;
  final String buttonText;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SlideContainer(
        child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Image.asset(assetPath),
        const Divider(height: 48),
        Text(text, textAlign: TextAlign.center),
        const Divider(height: 48),
        ElevatedButton(
          onPressed: onPressed,
          child: Text(buttonText),
        ),
      ],
    ));
  }
}
