import 'package:awachat/widgets/cities/utils.dart';
import 'package:flutter/material.dart';

class ConfirmPage extends StatefulWidget {
  const ConfirmPage({
    Key? key,
  }) : super(key: key);

  @override
  State<ConfirmPage> createState() => _ConfirmPageState();
}

class _ConfirmPageState extends State<ConfirmPage> {
  bool isConfirmed = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Center(
        child: ElevatedButton(
          onPressed: () {
            if (isConfirmed) {
              return;
            }

            setState(() {
              isConfirmed = true;
            });

            Future.delayed(const Duration(milliseconds: 250))
                .then((value) => {Navigator.pop(context)})
                .then((value) => {showConfirmDialog(context)});
          },
          style: getButtonStyle(context, isConfirmed),
          child: const Text('Je valide !'),
        ),
      ),
    );
  }
}
