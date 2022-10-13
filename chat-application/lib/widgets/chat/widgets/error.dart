import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class ErrorPage extends StatelessWidget {
  const ErrorPage({Key? key, required this.refresh}) : super(key: key);

  final VoidCallback refresh;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: SingleChildScrollView(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Image.asset('assets/images/error-lost-in-space.gif'),
                const SizedBox(
                  height: 24,
                ),
                Text(AppLocalizations.of(context)!.somethingWentWrong,
                    textAlign: TextAlign.center),
                const SizedBox(
                  height: 24,
                ),
                IconButton(
                  onPressed: refresh,
                  icon: const Icon(
                    Icons.refresh,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
