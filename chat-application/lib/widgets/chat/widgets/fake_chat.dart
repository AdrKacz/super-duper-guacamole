import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class FakeChat extends StatelessWidget {
  const FakeChat({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: ListView(
          physics: const ClampingScrollPhysics(),
          shrinkWrap: true,
          padding: const EdgeInsets.all(24.0),
          children: [
            Center(
              child: CircularProgressIndicator(
                  color: Theme.of(context).colorScheme.onPrimary),
            ),
            const SizedBox(
              height: 24,
            ),
            Text(AppLocalizations.of(context)!.continueToChangeGroup,
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
