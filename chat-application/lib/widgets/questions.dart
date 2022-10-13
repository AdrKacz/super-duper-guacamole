import 'package:flutter/material.dart';
import 'package:yaml/yaml.dart';
import 'package:http/http.dart' as http;
import 'package:awachat/widgets/loader.dart';
import 'package:awachat/store/memory.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

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
                  Text(AppLocalizations.of(context)!.toFindTheRightGroupForYou,
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
                    child: Text(AppLocalizations.of(context)!.answerTheQuestions),
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
                    child: Text(AppLocalizations.of(context)!.iPreferNotToAnswer),
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
            'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/questions/fr-2.yaml'))
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

    // re-init answers
    Memory().boxAnswers.clear();
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async => false,
      child: Scaffold(
        body: FutureBuilder(
          future: object,
          builder: (BuildContext context, AsyncSnapshot snapshot) {
            if (snapshot.hasData) {
              return QuestionTree(yaml: snapshot.data);
            }

            return const Loader();
          },
        ),
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

  void Function(String) createValidateAnswer(String pageId) {
    return (String answerId) {
      if (!widget.yaml['nodes'].containsKey(pageId)) {
        return;
      }

      if (Memory().boxAnswers.get(pageId) == answerId) {
        // un-select
        Memory().boxAnswers.delete(pageId);
      } else {
        // select
        // answer question (recursive flatten)
        String? currentPageId = pageId;
        String? currentAnswerId = answerId;
        while (currentPageId != null && currentAnswerId != null) {
          // store answer
          final bool isDiscriminating = readArgument(
              'isDiscriminating', currentPageId, currentAnswerId,
              defaultArg: false);

          Memory().boxAnswers.put(
              currentPageId, '${isDiscriminating ? '_' : ''}$currentAnswerId');

          // move to next page
          final String lastPageId = currentPageId;
          currentPageId = readArgument('next', currentPageId, currentAnswerId);
          if (currentPageId == null) {
            continue;
          }

          // remove answers discriminating if going back
          for (int i = pages.indexOf(currentPageId) + 1;
              i >= 0 && i <= pages.indexOf(lastPageId);
              i++) {
            Memory().boxAnswers.put(
                currentPageId,
                (Memory().boxAnswers.get(pages[i]) ?? '')
                    .replaceFirst(RegExp(r'^_'), ''));
          }

          // clear current question
          Memory().boxAnswers.delete(currentPageId);

          // read automatic answer if any
          currentAnswerId =
              readArgument('nextAnswer', lastPageId, currentAnswerId);
        }
        // animate to next page
        Future.delayed(const Duration(milliseconds: 250), () {
          // move to next page
          setState(() {
            pages.add(currentPageId ?? 'end');
          });
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
          child: Text(AppLocalizations.of(context)!.validate),
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
            title: Text(AppLocalizations.of(context)!.iSavedYourAnswers),
            actions: <Widget>[
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                },
                child: Text(AppLocalizations.of(context)!.ok),
              ),
            ]);
      });
}
