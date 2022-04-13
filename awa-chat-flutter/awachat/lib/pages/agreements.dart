import 'package:awachat/memory.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'package:awachat/pages/slide.dart';

class Agreements extends StatelessWidget {
  const Agreements({Key? key, required this.setAppState}) : super(key: key);

  final Function setAppState;

  @override
  Widget build(BuildContext context) {
    return AgreementsPage(
      nextText: "Suivant",
      checkText: "J'ai pris connaissance de la politique de confidentialité",
      url:
          "https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/agreements/privacy-policy/fr",
      onNextPressed: () {
        Navigator.push(
          context,
          MaterialPageRoute(
              builder: (context) => AgreementsPage(
                  nextText: "C'est parti !",
                  checkText:
                      "J'ai lu et j'accepte les conditions générales d'utilisations",
                  url:
                      "https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/agreements/end-user/fr",
                  onNextPressed: () {
                    Memory().put('user', 'hasSignedAgreements', "true");
                    Navigator.popUntil(context, ModalRoute.withName('/'));
                    setAppState('main');
                  })),
        );
      },
    );
  }
}

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
  _AgreementsPageState createState() => _AgreementsPageState();
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
                print(snapshot.data.body);
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
                    ),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      activeColor: const Color(0xff6f61e8),
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
                        style: _checked
                            ? ElevatedButton.styleFrom(
                                primary: const Color(0xff6f61e8),
                              )
                            : ElevatedButton.styleFrom(
                                primary: const Color(0xfff5f5f7),
                                onPrimary: const Color(0xff9e9cab),
                              ),
                        onPressed: () {
                          if (!_checked) {
                            return;
                          }
                          widget.onNextPressed();
                        },
                        child: Text(widget.nextText))
                  ],
                );
              } else if (snapshot.hasError) {
                print('Snapshot Error for ${widget.url}: ${snapshot.error}');
                // reload (not sure it is the best idea to reload on error)
                setState(() {
                  text = http.get(Uri.parse(widget.url));
                });
                // returns CircularProgressIndicator
              }

              return const Center(
                  child: CircularProgressIndicator(color: Color(0xff6f61e8)));
            },
          ),
        ),
      ),
    );
  }
}
