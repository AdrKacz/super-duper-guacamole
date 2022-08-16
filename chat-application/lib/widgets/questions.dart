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
                    onPressed: onConfirmed,
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

class QuestionsLoader extends StatefulWidget {
  const QuestionsLoader({Key? key}) : super(key: key);

  @override
  State<QuestionsLoader> createState() => _QuestionsLoaderState();
}

class _QuestionsLoaderState extends State<QuestionsLoader> {
  late Future<YamlMap> object;

  Future<YamlMap> readQuestionTree() async {
    http.Response response = await http
        .get(Uri.parse(
            'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/227-improve-question-logic-flexibility/questions/fr-2.yaml'))
        .catchError((e) {
      return http.Response('', 404);
    });

    if (response.body.isEmpty) {
      return YamlMap();
    }

    final dynamic yamlMap = loadYaml(response.body);

    if (yamlMap is YamlMap) {
      return yamlMap;
    }

    return YamlMap();
  }

  @override
  void initState() {
    super.initState();

    // read question
    object = readQuestionTree();

    // de-actualise answer (remove "_" marker)
    for (String key in Memory().boxAnswers.keys) {
      final String? answer = Memory().boxAnswers.get(key);
      if (answer == null) {
        continue;
      }
      Memory().boxAnswers.put(key, Memory().unmarkedAnswer(answer));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder(
        future: object,
        builder: (BuildContext context, AsyncSnapshot snapshot) {
          if (snapshot.hasData) {
            return QuestionTree(yaml: snapshot.data);
          }

          return const Loader();
        },
      ),
    );
  }
}

// Question Tree
class QuestionTree extends StatefulWidget {
  const QuestionTree({Key? key, required this.yaml}) : super(key: key);

  final YamlMap yaml;

  @override
  State<QuestionTree> createState() => _QuestionTreeState();
}

class _QuestionTreeState extends State<QuestionTree> {
  List<String> pages = [];
  final PageController controller = PageController();

  dynamic readArgument(String arg, String pageId, String answerId,
      {dynamic defaultArg}) {
    return widget.yaml['nodes'][pageId]['answers'][answerId][arg] ??
        widget.yaml['nodes'][pageId][arg] ??
        widget.yaml['defaults'][arg] ??
        defaultArg;
  }

  void createNextPage(String pageId, String answerId) {
    final String nextPageId =
        readArgument('next', pageId, answerId, defaultArg: 'end');

    int indexOfNextPageId = pages.indexOf(nextPageId);
    if (indexOfNextPageId >= 0) {
      final pagesLength = pages.length;
      for (int i = indexOfNextPageId; i < pagesLength; i++) {
        final lastPageId = pages.removeLast();
        Memory().boxAnswers.delete(lastPageId);
      }
    }

    setState(() {
      pages.add(nextPageId);
    });
  }

  void Function(String) createValidateAnswer(String pageId) {
    return (String answerId) {
      if (Memory().getUnmarkedAnswer(pageId) == answerId) {
        // un-select
        Memory().boxAnswers.delete(pageId);
      } else {
        // select
        final bool isDiscriminating = readArgument(
            'isDiscriminating', pageId, answerId,
            defaultArg: false);

        Memory().boxAnswers.put('${isDiscriminating ? '_' : ''}$pageId',
            Memory().markedAnswer(answerId));
        Future.delayed(const Duration(milliseconds: 250), () {
          createNextPage(pageId, answerId);
          controller.nextPage(
              duration: const Duration(milliseconds: 500),
              curve: Curves.easeInOut);
        });
      }
      setState(() {});
    };
  }

  @override
  void initState() {
    super.initState();
    pages.add(widget.yaml['root'] ?? 'end');
  }

  @override
  Widget build(BuildContext context) {
    return PageView.builder(
      itemCount: pages.length,
      physics: const NeverScrollableScrollPhysics(parent: PageScrollPhysics()),
      controller: controller,
      itemBuilder: (BuildContext context, int index) {
        String pageId = pages[index];
        if (pageId == 'end' || !widget.yaml['nodes'].containsKey(pageId)) {
          return const ConfirmPage();
        }

        return DefaultQuestion(
          questionId: pageId,
          question: widget.yaml['nodes'][pageId],
          onPressed: createValidateAnswer(pageId),
        );
      },
    );
  }
}

// Question
class DefaultQuestion extends StatelessWidget {
  const DefaultQuestion({
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
    final String? currentAnswer = Memory().getUnmarkedAnswer(questionId);
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
                            style: mapEntry.key == currentAnswer
                                ? ElevatedButton.styleFrom(
                                    minimumSize: const Size.fromHeight(100),
                                  )
                                : ElevatedButton.styleFrom(
                                    minimumSize: const Size.fromHeight(100),
                                    primary:
                                        Theme.of(context).colorScheme.secondary,
                                    onPrimary: Theme.of(context)
                                        .colorScheme
                                        .onSecondary,
                                  ),
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

// Confirm
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
  final answersMap = Memory().boxAnswers.toMap();
  answersMap.removeWhere((_, answer) => !Memory().isAnswerMarked(answer));
  answersMap.updateAll((_, answer) => answer = Memory().unmarkedAnswer(answer));
  print(
      'Send answers: $answersMap (original is ${Memory().boxAnswers.toMap()}');
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
