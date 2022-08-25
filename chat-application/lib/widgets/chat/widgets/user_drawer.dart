import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/loader.dart';
import 'package:awachat/widgets/questions.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

// ===== ===== =====
// Drawer

class UserDrawer extends StatelessWidget {
  const UserDrawer(
      {Key? key,
      required this.seeIntroduction,
      required this.resetAccount,
      required this.update})
      : super(key: key);

  final VoidCallback seeIntroduction;
  final VoidCallback resetAccount;
  final VoidCallback update;

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
                child: ClipOval(child: User.getUserImage(User().id)),
              ),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.question_mark_rounded),
            title: const Text('Questions'),
            subtitle: const Text("Quel est ton état d'esprit ?"),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const QuestionsLoader(),
                ),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.public),
            title: const Text('Partage ta photo'),
            subtitle: const Text('Seul ton groupe pourra le voir'),
            onTap: () {
              User().shareProfile(context).then((value) => {update()});
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.nature),
            title: const Text(
              'Je veux revoir la présentation',
            ),
            onTap: seeIntroduction,
          ),
          ListTile(
            leading: const Icon(Icons.copyright),
            title: const Text('Sources'),
            onTap: () {
              Navigator.push(context,
                  MaterialPageRoute(builder: (context) => const Credits()));
            },
          ),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('Nous contacter'),
            onTap: () async {
              if (!await launchUrl(Uri.parse('https://awa-chat.me/contact/'))) {
                throw 'Could not launch https://awa-chat.me/contact/';
              }
            },
          ),
          ListTile(
            leading: Icon(Icons.delete_forever,
                color: Theme.of(context).colorScheme.onError),
            title: Text(
              'Réinitialiser mon compte',
              style: TextStyle(color: Theme.of(context).colorScheme.onError),
            ),
            onTap: () async {
              switch (await showDialog(
                  context: context,
                  builder: (BuildContext context) {
                    return AlertDialog(
                      title: const Text('Attention'),
                      content: const SingleChildScrollView(
                        child: Text(
                            'Es-tu sûr que tu veux supprimer tout ce qui te concerne ? Tu ne pourras pas faire marche arrière.'),
                      ),
                      actions: [
                        TextButton(
                          child: const Text('Non'),
                          onPressed: () {
                            Navigator.pop(context, 'nothing');
                          },
                        ),
                        TextButton(
                          child: const Text('Oui'),
                          onPressed: () {
                            Navigator.pop(context, 'confirmed');
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
  State<Credits> createState() => _CreditsState();
}

class _CreditsState extends State<Credits> {
  late Future<http.Response> text;

  @override
  void initState() {
    super.initState();
    text = http.get(Uri.parse(
        'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/agreements/credits/fr'));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sources'),
      ),
      body: FutureBuilder(
        future: text,
        builder: (BuildContext context, AsyncSnapshot snapshot) {
          if (snapshot.hasData) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        child: Text(
                          snapshot.data.body,
                          textAlign: TextAlign.left,
                          style: const TextStyle(height: 1.5),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }
          return const Loader();
        },
      ),
    );
  }
}
