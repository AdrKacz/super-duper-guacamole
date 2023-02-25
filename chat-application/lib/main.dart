import 'package:awachat/store/group_user.dart';
import 'package:awachat/widgets/chat/main.dart';
import 'package:awachat/widgets/cities/cities_loader.dart';
import 'package:awachat/widgets/update_user/update_user.dart';
import 'package:flutter/material.dart';
import 'package:awachat/application_theme.dart';
import 'package:awachat/network/notification_handler.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/presentation.dart';
import 'package:awachat/widgets/agreements.dart';
import 'package:go_router/go_router.dart';

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
              if (state.location == '/agreements' &&
                  Memory().boxUser.containsKey('hasSignedAgreements')) {
                return '/chat';
              } else if (state.location != '/chat') {
                return null;
              } else if (!Memory().boxUser.containsKey('hasSignedAgreements')) {
                return '/onboarding';
              } else if (GroupUser(User().id!).getArgument('lastUpdate')
                  is! int) {
                return '/update-user';
              } else if (!Memory().boxUser.containsKey('city')) {
                return '/cities';
              } else {
                return null;
              }
            },
            routes: [
              GoRoute(
                  path: '/chat',
                  builder: (context, state) => const ChatHandler()),
              GoRoute(
                  path: '/onboarding',
                  builder: (context, state) => const Presentation()),
              GoRoute(
                  path: '/cities',
                  builder: (context, state) => const CitiesLoader()),
              GoRoute(
                  path: '/agreements',
                  builder: (context, state) => const Agreements()),
              GoRoute(
                  path: '/update-user',
                  builder: (context, state) => const UpdateUser()),
            ]));
  }
}
