import 'package:awachat/widgets/cities/cities_question.dart';
import 'package:flutter/material.dart';
import 'package:yaml/yaml.dart';
import 'package:http/http.dart' as http;
import 'package:awachat/widgets/loader.dart';
import 'package:awachat/store/memory.dart';

class CitiesLoader extends StatefulWidget {
  const CitiesLoader({Key? key}) : super(key: key);

  @override
  State<CitiesLoader> createState() => _CitiesLoaderState();
}

class _CitiesLoaderState extends State<CitiesLoader> {
  late Future<List<String>> futureCities;

  Future<List<String>> readCities() async {
    http.Response response = await http
        .get(Uri.parse(
            'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/configurations/cities/cities-v0.yml'))
        .catchError((e) {
      return http.Response('', 404);
    });

    if (response.body.isEmpty) {
      return [];
    }

    final dynamic yamlMap = loadYaml(response.body);

    if (yamlMap is YamlMap && yamlMap['cities'] is YamlList) {
      return yamlMap['cities'].cast<String>();
    }

    return [];
  }

  @override
  void initState() {
    super.initState();

    // read cities
    futureCities = readCities();

    // re-init answers
    Memory().boxAnswers.clear();
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async => false,
      child: Scaffold(
        body: FutureBuilder(
          future: futureCities,
          builder: (BuildContext context, AsyncSnapshot snapshot) {
            if (snapshot.hasData) {
              return CitiesQuestion(cities: snapshot.data);
            }

            return const Loader();
          },
        ),
      ),
    );
  }
}
