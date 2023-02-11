import 'package:awachat/widgets/chat/main.dart';
import 'package:awachat/widgets/cities/cities_loader.dart';
import 'package:flutter/material.dart';
import 'package:awachat/application_theme.dart';
import 'package:awachat/network/notification_handler.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/presentation.dart';
import 'package:awachat/widgets/agreements.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_offline/flutter_offline.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Memory().init();
  await User().init();
  NotificationHandler().init();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
        title: 'Awa',
        theme: applicationTheme,
        routerConfig: GoRouter(
            initialLocation: '/chat',
            redirect: (BuildContext context, GoRouterState state) {
              if (state.location == '/chat' &&
                  !Memory().boxUser.containsKey('hasSignedAgreements')) {
                return '/onboarding';
              } else if (state.location == '/chat' &&
                  !Memory().boxUser.containsKey('city')) {
                return '/cities';
              } else if (state.location == '/agreements' &&
                  Memory().boxUser.containsKey('hasSignedAgreements')) {
                return '/chat';
              } else {
                return null;
              }
            },
            routes: [
              GoRoute(
                  path: '/chat',
                  builder: (context, state) =>
                      const NetworkWidget(widget: ChatHandler())),
              GoRoute(
                  path: '/onboarding',
                  builder: (context, state) => const Presentation()),
              GoRoute(
                  path: '/cities',
                  builder: (context, state) =>
                      const NetworkWidget(widget: CitiesLoader())),
              GoRoute(
                  path: '/agreements',
                  builder: (context, state) =>
                      const NetworkWidget(widget: Agreements()))
            ]));
  }
}

class NetworkWidget extends StatelessWidget {
  const NetworkWidget({Key? key, required this.widget}) : super(key: key);

  final Widget widget;

  @override
  Widget build(BuildContext context) {
    return OfflineBuilder(
        connectivityBuilder: (BuildContext context,
            ConnectivityResult connectivity, Widget child) {
          if (connectivity == ConnectivityResult.none) {
            return Scaffold(
                body: SafeArea(
                    child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Center(
                            child: SingleChildScrollView(
                                child: Column(children: <Widget>[
                          Image.asset('assets/images/error.gif'),
                          const SizedBox(height: 12),
                          const Text(
                              '''Impossible de se connecter, si le problème persiste ferme et rouvre l'application''',
                              textAlign: TextAlign.center),
                          const SizedBox(height: 24),
                          CircularProgressIndicator(
                              color: Theme.of(context).colorScheme.onPrimary)
                        ]))))));
          } else {
            return child;
          }
        },
        child: widget);
  }
}
