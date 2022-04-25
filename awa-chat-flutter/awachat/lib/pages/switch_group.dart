import 'package:flutter/material.dart';

class SwitchGroupPage extends StatelessWidget {
  const SwitchGroupPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Image.asset('assets/images/undraw_searching_re_3ra9.png'),
          const Divider(height: 48),
          const Text(
            """Je cherche un groupe.
Je te préviendrai quand j'en aurai trouvé un.""",
            textAlign: TextAlign.center,
          ),
          const SizedBox(
            height: 24,
          ),
          const CircularProgressIndicator(color: Color(0xff6f61e8)),
        ]),
      ),
    );
  }
}
