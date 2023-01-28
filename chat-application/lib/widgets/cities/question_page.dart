import 'package:awachat/widgets/cities/utils.dart';
import 'package:flutter/material.dart';
import 'package:yaml/yaml.dart';
import 'package:awachat/store/memory.dart';

class QuestionPage extends StatelessWidget {
  const QuestionPage({
    Key? key,
    required this.questionId,
    required this.question,
    required this.onPressed,
  }) : super(key: key);

  final String questionId;
  final YamlMap question;
  final Function onPressed;

  @override
  Widget build(BuildContext context) {
    final String currentAnswer = (Memory().boxAnswers.get(questionId) ?? '')
        .replaceFirst(RegExp(r'^_'), '');

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Text(
              question['text'] ?? '',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16),
            ),
            const Divider(
              height: 24,
            ),
            Expanded(
              child: ListView(
                children: List<Widget>.from(Map.from(question['answers'])
                    .entries
                    .map((mapEntry) => (Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: ElevatedButton(
                            style: getButtonStyle(
                                context, mapEntry.key == currentAnswer),
                            onPressed: () {
                              onPressed(mapEntry.key);
                            },
                            child: Text(
                              mapEntry.value['text'] ?? '',
                              textAlign: TextAlign.center,
                            ),
                          ),
                        )))
                    .toList()),
              ),
            )
          ],
        ),
      ),
    );
  }
}
