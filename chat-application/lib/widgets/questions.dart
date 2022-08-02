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

    String? root;

    for (final Map node in yamlMap['nodes']) {
      final String? id = node['id'];
      final String? text = node['text'];
      final YamlList? answers = node['answers'];

      if (id is! String || text is! String || answers is! YamlList) {
        continue;
      }

      root = root ?? id;

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

    return {'questionTree': questionTree, 'root': root};
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
            return Questions(
                questionTree: snapshot.data['questionTree'],
                root: snapshot.data['root']);
          }

          return const Loader();
        },
      ),
    );
  }
}

// Questions
class Questions extends StatefulWidget {
  const Questions({Key? key, required this.questionTree, required this.root})
      : super(key: key);

  final Map questionTree;
  final String? root;

  @override
  State<Questions> createState() => _QuestionsState();
}

class _QuestionsState extends State<Questions> {
  List<String> pages = [];
  final PageController controller = PageController();

  void createNextPage(String pageId, String answerId) {
    final String? nextPageId =
        widget.questionTree[pageId]['answers'][answerId]['next'];

    setState(() {
      pages.add(nextPageId ?? 'end');
    });
  }

  @override
  void initState() {
    super.initState();
    pages.add(widget.root ?? 'end');
  }

  @override
  Widget build(BuildContext context) {
    return PageView.builder(
      itemCount: pages.length,
      physics: const NeverScrollableScrollPhysics(parent: PageScrollPhysics()),
      controller: controller,
      itemBuilder: (BuildContext context, int index) {
        String pageId = pages[index];
        if (pageId == 'end') {
          return const ConfirmPage();
        }

        return Question(
          question: widget.questionTree[pageId],
          onPressed: (String answerId) {
            if (Memory().getUnmarkedAnswer(pageId) == answerId) {
              Memory().boxAnswers.delete(pageId);
            } else {
              Memory().boxAnswers.put(pageId, Memory().markedAnswer(answerId));
              Future.delayed(const Duration(milliseconds: 250), () {
                createNextPage(pageId, answerId);
                controller.nextPage(
                    duration: const Duration(milliseconds: 500),
                    curve: Curves.easeInOut);
              });
            }
            setState(() {});
          },
        );
      },
    );
  }
}

// Question
class Question extends StatelessWidget {
  const Question({
    Key? key,
    required this.question,
    required this.onPressed,
  }) : super(key: key);

  final Map question;
  final Function onPressed;

  @override
  Widget build(BuildContext context) {
    final String? currentAnswer = Memory().getUnmarkedAnswer(question['id']);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Text(
              question['text'],
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
                    .map((answer) => (Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: ElevatedButton(
                            style: answer.value['id'] == currentAnswer
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
                              onPressed(answer.value['id']);
                            },
                            child: Text(
                              answer.value['text'],
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
