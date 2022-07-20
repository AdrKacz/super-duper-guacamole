import 'package:flutter/material.dart';

class SwitchGroupPage extends StatelessWidget {
  const SwitchGroupPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: SingleChildScrollView(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Image.asset('assets/images/alien-science.gif'),
                const SizedBox(
                  height: 24,
                ),
                const Text(
                  """Je te cherche un groupe.                
Je t'envoie une notification quand j'ai trouvé.""",
                  textAlign: TextAlign.center,
                ),
                const SizedBox(
                  height: 24,
                ),
                CircularProgressIndicator(
                    color: Theme.of(context).colorScheme.onPrimary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
