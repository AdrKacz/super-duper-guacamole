import 'package:awachat/objects/user.dart';
import 'package:awachat/widgets/loader.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

// ===== ===== =====
// Drawer

class UserDrawer extends StatelessWidget {
  const UserDrawer(
      {Key? key, required this.seeIntroduction, required this.resetAccount})
      : super(key: key);

  final VoidCallback seeIntroduction;
  final VoidCallback resetAccount;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: <Widget>[
          DrawerHeader(
            child: CircleAvatar(
              backgroundColor: Colors.transparent,
              child: SizedBox(
                child: ClipOval(
                  child: Image.network(
                    "https://avatars.dicebear.com/api/adventurer-neutral/${User().id}.png",
                  ),
                ),
              ),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.question_mark_rounded),
            title: const Text("Questions"),
            subtitle: const Text("Quel est ton état d'esprit ?"),
            onTap: () {
              Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (context) => const QuestionsLoader()));
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.nature),
            title: const Text(
              "Je veux revoir la présentation",
            ),
            onTap: seeIntroduction,
          ),
          ListTile(
            leading: const Icon(Icons.copyright),
            title: const Text("Sources"),
            onTap: () {
              Navigator.push(context,
                  MaterialPageRoute(builder: (context) => const Credits()));
            },
          ),
          ListTile(
            leading:
                Icon(Icons.delete_forever, color: Colors.redAccent.shade100),
            title: Text(
              "Réinitialiser mon compte",
              style: TextStyle(color: Colors.redAccent.shade100),
            ),
            onTap: () async {
              switch (await showDialog(
                  context: context,
                  builder: (BuildContext context) {
                    return AlertDialog(
                      title: const Text("Attention"),
                      content: const SingleChildScrollView(
                        child: Text(
                            'Es-tu sûr que tu veux supprimer tout ce qui te concerne ? Tu ne pourras pas faire marche arrière.'),
                      ),
                      actions: [
                        TextButton(
                          child: const Text('Non'),
                          onPressed: () {
                            Navigator.pop(context, "nothing");
                          },
                        ),
                        TextButton(
                          child: const Text('Oui'),
                          onPressed: () {
                            Navigator.pop(context, "confirmed");
                          },
                        ),
                      ],
                    );
                  })) {
                case 'confirmed':
                  Navigator.of(context).pop();
                  resetAccount();
                  break;
                default:
                  Navigator.of(context).pop();
              }
            },
          ),
        ],
      ),
    );
  }
}

// ===== ===== =====
// Credits
class Credits extends StatefulWidget {
  const Credits({Key? key}) : super(key: key);

  @override
  _CreditsState createState() => _CreditsState();
}

class _CreditsState extends State<Credits> {
  late Future<http.Response> text;

  @override
  void initState() {
    super.initState();
    text = http.get(Uri.parse(
        "https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/agreements/credits/fr"));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          foregroundColor: const Color(0xff6f61e8),
          backgroundColor: const Color(0xfff5f5f7),
          title: const Text('Sources'),
        ),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: FutureBuilder(
              future: text,
              builder: (BuildContext context, AsyncSnapshot snapshot) {
                if (snapshot.hasData) {
                  return Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Expanded(
                        child: SingleChildScrollView(
                          child: Text(
                            snapshot.data.body,
                            textAlign: TextAlign.justify,
                          ),
                        ),
                      )
                    ],
                  );
                }

                return const Center(
                    child: CircularProgressIndicator(color: Color(0xff6f61e8)));
              },
            ),
          ),
        ));
  }
}

// ===== ===== =====
// Questions Loader
class QuestionsLoader extends StatefulWidget {
  const QuestionsLoader({Key? key}) : super(key: key);

  @override
  _QuestionsLoaderState createState() => _QuestionsLoaderState();
}

class _QuestionsLoaderState extends State<QuestionsLoader> {
  late Future<http.Response> text;

  @override
  void initState() {
    super.initState();
    text = http.get(Uri.parse(
        "https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/agreements/credits/fr"));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder(
        future: text,
        builder: (BuildContext context, AsyncSnapshot snapshot) {
          if (snapshot.hasData) {
            return Questions(data: snapshot.data.body);
          }

          return const Loader();
        },
      ),
    );
  }
}

// Questions
class Questions extends StatefulWidget {
  const Questions({Key? key, required this.data}) : super(key: key);

  final String data;

  @override
  _QuestionsState createState() => _QuestionsState();
}

class _QuestionsState extends State<Questions> {
  final List<Map> temporaryData = [
    {
      'id': '001',
      'index': 0,
      'question': 'Ton type de soirée ? 🥳',
      'answers': [
        {'id': '01', 'answer': 'Talk and chill 🍷'},
        {'id': '02', 'answer': 'Pizza et jeux de société 🍕'},
        {'id': '03', 'answer': 'Ça part en boîte ! 😎'},
      ],
    },
    {
      'id': '002',
      'index': 1,
      'question': 'Ton sec au choix ? 🥴',
      'answers': [
        {'id': '01', 'answer': 'Vodka 🧯'},
        {'id': '02', 'answer': 'Smoothie fraise banane 🍌'},
        {'id': '03', 'answer': 'Bière 🍺'},
      ],
    },
    {
      'id': '003',
      'index': 2,
      'question': "T'es plutôt ? 😏",
      'answers': [
        {'id': '01', 'answer': 'Que des potes ici 👊'},
        {'id': '02', 'answer': 'Ça peut toujours déraper 😇'},
        {'id': '03', 'answer': 'Où le vent me porte 🙈'},
      ],
    }
  ];

  Map<String, String> selectedAnswers = {};
  bool isConfirmed = false;

  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: DefaultTabController(
          length: temporaryData.length + 1,
          child: Builder(builder: (BuildContext context) {
            return Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Expanded(
                  child: TabBarView(
                    children: List<Widget>.from(temporaryData
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
                              // add a pop up to notify it has been correctly stored
                              Future.delayed(const Duration(milliseconds: 250))
                                  .then((value) => {Navigator.pop(context)});
                            },
                            isConfirmed: isConfirmed,
                          )
                        ],
                  ),
                ),
                const TabPageSelector(
                  color: Color(0xfff5f5f7),
                  selectedColor: Color(0xff6f61e8),
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
                                  primary: const Color(0xff6f61e8),
                                  onPrimary: Colors.white,
                                )
                              : ElevatedButton.styleFrom(
                                  minimumSize: const Size.fromHeight(100),
                                  primary: const Color(0xfff5f5f7),
                                  onPrimary: Colors.black,
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
                  primary: const Color(0xff6f61e8),
                  onPrimary: Colors.white,
                )
              : ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(100),
                  primary: const Color(0xfff5f5f7),
                  onPrimary: Colors.black,
                ),
          child: const Text('Je valide !'),
        ),
      ),
    );
  }
}

// https://stackoverflow.com/questions/58883067/flutter-custom-animated-icon for button animation
