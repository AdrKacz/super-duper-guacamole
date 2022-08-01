import 'package:flutter/material.dart';
import 'package:yaml/yaml.dart';
import 'package:http/http.dart' as http;
import 'package:awachat/widgets/loader.dart';
import 'package:awachat/store/memory.dart';

// ===== ===== =====
// First Time Questions Loader
class FirstTimeQuestionsLoader extends StatelessWidget {
  const FirstTimeQuestionsLoader({Key? key, required this.onConfirmed})
      : super(key: key);

  final VoidCallback onConfirmed;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Center(
            child: SingleChildScrollView(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Image.asset('assets/images/decision-questions.gif'),
                  const Divider(height: 48),
                  const Text(
                      '''Pour te placer un groupe qui te correspond, je dois en savoir plus sur toi.
                      
Tu pourras changer tes réponses à tout moment en touchant ton avatar.''',
                      textAlign: TextAlign.center),
                  const Divider(height: 48),
                  ElevatedButton(
                    onPressed: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const QuestionsLoader(),
                        ),
                      );
                      onConfirmed();
                    },
                    child: const Text('Répondre aux questions'),
                  ),
                  const SizedBox(
                    height: 12,
                  ),
                  ElevatedButton(
                    onPressed: () {
                      Memory().put('user', 'questions', '');
                      onConfirmed();
                    },
                    style: ElevatedButton.styleFrom(
                      primary: Theme.of(context).colorScheme.secondary,
                      onPrimary: Theme.of(context).colorScheme.onSecondary,
                    ),
                    child: const Text('Ne pas répondre'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ===== ===== =====
// Questions Loader

Map<String, String> loadSelectedAnswers() {
  final Map<String, String> selectedAnswers = {};
  final String? encodedSelectedAnswers = Memory().get('user', 'questions');
  if (encodedSelectedAnswers != null) {
    encodedSelectedAnswers.split('::').forEach((element) {
      List<String> mapEntry = element.split(':');
      if (mapEntry.length == 2) {
        selectedAnswers[mapEntry[0]] = mapEntry[1];
      }
    });
  }
  return selectedAnswers;
}

class QuestionsLoader extends StatefulWidget {
  const QuestionsLoader({Key? key}) : super(key: key);

  @override
  State<QuestionsLoader> createState() => _QuestionsLoaderState();
}

class _QuestionsLoaderState extends State<QuestionsLoader> {
  late Future<Map> object;

  Future<Map> readQuestionTree() async {
    http.Response response = await http.get(Uri.parse(
        'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/206-entrer-sa-localisation/questions/fr-2.yaml'));

    if (response.body.isEmpty) {
      return {};
    }

    final YamlMap yamlMap = loadYaml(response.body);

    if (yamlMap['nodes'] is! YamlList) {
      return {};
    }

    final Map questionTree = {};

    for (final Map node in yamlMap['nodes']) {
      final String? id = node['id'];
      final String? text = node['text'];
      final YamlList? answers = node['aswers'];

      if (id is! String || text is! String || answers is! YamlList) {
        continue;
      }

      final Map answersMap = {};
      for (final YamlMap answer in answers) {
        final String? answerId = answer['id'];
        final String? answerText = answer['text'];
        final String? next = answer['next'];

        if (answerId is! String || answerText is! String) {
          continue;
        }

        answersMap[answerId] = {
          'id': answerId,
          'text': answerText,
          'next': next,
        };
      }
      if (answersMap.isEmpty) {
        continue;
      }

      questionTree[id] = {
        'id': id,
        'text': text,
        'answers': answersMap,
      };
    }

    if (questionTree.isEmpty) {
      return {};
    }

    return questionTree;
  }

  @override
  void initState() {
    super.initState();
    object = readQuestionTree();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder(
        future: object,
        builder: (BuildContext context, AsyncSnapshot snapshot) {
          if (snapshot.hasData) {
            return Questions(
                loadedSelectedAnswer: snapshot.data['selectedAnswers'],
                questions: snapshot.data['questions']);
          }

          return const Loader();
        },
      ),
    );
  }
}

// Questions
class Questions extends StatefulWidget {
  const Questions(
      {Key? key, required this.loadedSelectedAnswer, required this.questions})
      : super(key: key);

  final Map<String, String> loadedSelectedAnswer;
  final List<Map> questions;

  @override
  State<Questions> createState() => _QuestionsState();
}

class _QuestionsState extends State<Questions> {
  late Map<String, String> selectedAnswers;
  bool isConfirmed = false;

  void saveSelectedAnswers() {
    Memory().put(
        'user',
        'questions',
        selectedAnswers.entries.map((MapEntry selectedAnswer) {
          return '${selectedAnswer.key}:${selectedAnswer.value}';
        }).join('::'));
  }

  @override
  void initState() {
    super.initState();
    selectedAnswers = Map.from(widget.loadedSelectedAnswer);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: DefaultTabController(
          length: widget.questions.length + 1,
          child: Builder(builder: (BuildContext context) {
            return Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Expanded(
                  child: TabBarView(
                    children: List<Widget>.from(widget.questions
                            .map((e) => (Question(
                                  question: e,
                                  selectedAnswer: selectedAnswers[e['id']],
                                  onNext: () {
                                    final TabController? controller =
                                        DefaultTabController.of(context);
                                    if (controller != null) {
                                      controller.animateTo(e['index'] + 1);
                                    }
                                  },
                                  onPressed: (String id) {
                                    print('set $id for ${e['id']}');

                                    if (selectedAnswers[e['id']] == id) {
                                      setState(() {
                                        selectedAnswers.remove(e['id']);
                                      });
                                      return false;
                                    } else {
                                      setState(() {
                                        selectedAnswers[e['id']] = id;
                                      });
                                      return true;
                                    }
                                  },
                                )))
                            .toList()) +
                        [
                          Confirm(
                            onPressed: () {
                              setState(() {
                                isConfirmed = true;
                              });
                              // store answers
                              saveSelectedAnswers();
                              // Memory().put('user', 'questions', 'bonjour');
                              Future.delayed(const Duration(milliseconds: 250))
                                  .then((value) => {Navigator.pop(context)})
                                  .then(
                                      (value) => {showConfirmDialog(context)});
                            },
                            isConfirmed: isConfirmed,
                          )
                        ],
                  ),
                ),
                TabPageSelector(
                  color: Theme.of(context).colorScheme.primary,
                  selectedColor: Theme.of(context).colorScheme.onPrimary,
                ),
              ],
            );
          }),
        ),
      ),
    );
  }
}

// Question
class Question extends StatelessWidget {
  const Question({
    Key? key,
    required this.question,
    this.selectedAnswer,
    required this.onPressed,
    required this.onNext,
  }) : super(key: key);

  final Map question;
  final String? selectedAnswer;
  final Function onPressed;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          Text(
            question['question'],
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 16),
          ),
          const Divider(
            height: 24,
          ),
          Expanded(
            child: ListView(
              children: List<Widget>.from(question['answers']
                  .map((e) => (Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: ElevatedButton(
                          style: e['id'] == selectedAnswer
                              ? ElevatedButton.styleFrom(
                                  minimumSize: const Size.fromHeight(100),
                                )
                              : ElevatedButton.styleFrom(
                                  minimumSize: const Size.fromHeight(100),
                                  primary:
                                      Theme.of(context).colorScheme.secondary,
                                  onPrimary:
                                      Theme.of(context).colorScheme.onSecondary,
                                ),
                          onPressed: () {
                            if (onPressed(e['id'])) {
                              Future.delayed(const Duration(milliseconds: 250))
                                  .then((value) => {onNext()});
                            }
                          },
                          child: Text(
                            e['answer'],
                            textAlign: TextAlign.center,
                          ),
                        ),
                      )))
                  .toList()),
            ),
          )
        ],
      ),
    );
  }
}

// Confirm
class Confirm extends StatelessWidget {
  // https://stackoverflow.com/questions/58883067/flutter-custom-animated-icon for button animation
  const Confirm({
    Key? key,
    required this.isConfirmed,
    required this.onPressed,
  }) : super(key: key);

  final bool isConfirmed;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Center(
        child: ElevatedButton(
          onPressed: onPressed,
          style: isConfirmed
              ? ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(100),
                )
              : ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(100),
                  primary: Theme.of(context).colorScheme.secondary,
                  onPrimary: Theme.of(context).colorScheme.onSecondary,
                ),
          child: const Text('Je valide !'),
        ),
      ),
    );
  }
}

// Confirm Dialog
void showConfirmDialog(BuildContext context) async {
  return await showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
            title: const Text("J'ai bien enregistré tes réponses"),
            actions: <Widget>[
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                },
                child: const Text('Ok'),
              ),
            ]);
      });
}
