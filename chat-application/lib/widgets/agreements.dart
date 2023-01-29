import 'package:go_router/go_router.dart';
import 'package:awachat/store/memory.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class Agreements extends StatelessWidget {
  const Agreements({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return AgreementsPage(
      nextText: 'Suivant',
      checkText: "J'ai pris connaissance de la politique de confidentialité",
      url:
          'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/agreements/privacy-policy/fr',
      onNextPressed: () {
        Navigator.push(
          context,
          MaterialPageRoute(
              builder: (context) => AgreementsPage(
                  nextText: "C'est parti !",
                  checkText:
                      "J'ai lu et j'accepte les conditions générales d'utilisations",
                  url:
                      'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/agreements/end-user/fr',
                  onNextPressed: () {
                    Memory().boxUser.put('hasSignedAgreements',
                        DateTime.now().millisecondsSinceEpoch.toString());
                    context.go('/cities');
                  })),
        );
      },
    );
  }
}

// ===== ===== =====
// ===== ===== =====
// HELPERS

class AgreementsPage extends StatefulWidget {
  const AgreementsPage({
    Key? key,
    required this.onNextPressed,
    required this.url,
    required this.checkText,
    required this.nextText,
  }) : super(key: key);

  final VoidCallback onNextPressed;
  final String url;
  final String checkText;
  final String nextText;

  @override
  State<AgreementsPage> createState() => _AgreementsPageState();
}

class _AgreementsPageState extends State<AgreementsPage> {
  late Future<http.Response> text;

  bool _checked = false;

  void check(bool value) {
    setState(() {
      _checked = value;
    });
  }

  @override
  void initState() {
    super.initState();
    text = http.get(Uri.parse(widget.url));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                          textAlign: TextAlign.left,
                          style: const TextStyle(height: 1.5),
                        ),
                      ),
                    ),
                    CheckboxListTile(
                      activeColor: Theme.of(context).colorScheme.onPrimary,
                      contentPadding: EdgeInsets.zero,
                      title: Text(widget.checkText),
                      value: _checked,
                      onChanged: (bool? value) {
                        if (value == null) {
                          return;
                        }
                        setState(() {
                          _checked = value;
                        });
                      },
                    ),
                    const Divider(height: 48),
                    ElevatedButton(
                        onPressed: _checked
                            ? () {
                                if (!_checked) {
                                  return;
                                }
                                widget.onNextPressed();
                              }
                            : null,
                        child: Text(widget.nextText))
                  ],
                );
              } else if (snapshot.hasError) {
                // snpashot error (see widget.url and snapshot.error)
                // reload (not sure it is the best idea to reload on error, can cause infinite reload)
                setState(() {
                  text = http.get(Uri.parse(widget.url));
                });
              }

              return Center(
                child: CircularProgressIndicator(
                    color: Theme.of(context).colorScheme.onPrimary),
              );
            },
          ),
        ),
      ),
    );
  }
}
