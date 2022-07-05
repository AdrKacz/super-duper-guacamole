import 'package:hive/hive.dart';

import 'dart:typed_data';

import 'package:pointycastle/export.dart';
import 'package:awachat/store/config/helpers.dart' as helpers;

// flutter packages pub run build_runner build
part 'config.g.dart';

@HiveType(typeId: 2)
class Config extends HiveObject {
  Config(this._rsaKeyPair, this._booleanParameters, this._answeredQuestions);

  factory Config.loads(String key, {String boxName = 'metadata'}) {
    final dynamic config = Hive.box(boxName).get(key);
    if (config is Config) {
      return config;
    } else {
      final AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> rsaKeyPair =
          helpers.generateRSAkeyPair(helpers.exampleSecureRandom());
      Hive.box(boxName)
          .put(key, Config(helpers.rsaKeyPairToString(rsaKeyPair), {}, {}));
      return Hive.box(boxName).get(key);
    }
  }

  static Config get config => Config.loads('config');

  @HiveField(0)
  List<String> _rsaKeyPair;
  AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> get rsaKeyPair =>
      helpers.stringToRsaKeyPair(_rsaKeyPair);

  @HiveField(1)
  Map<String, bool> _booleanParameters;
  Map<String, bool> get booleanParameters => _booleanParameters;

  @HiveField(2)
  Map<String, String> _answeredQuestions;
  Map<String, String> get answeredQuestions => _answeredQuestions;

  void overwriteAnsweredQuestions(Map<String, String> newAnsweredQuestions) {
    _answeredQuestions = Map.from(newAnsweredQuestions);
    save();
  }

  void editBooleanParameters(String key, bool value) {
    _booleanParameters[key] = value;
    save();
  }

  Uint8List rsaSign(Uint8List dataToSign) {
    return helpers.rsaSign(rsaKeyPair.privateKey, dataToSign);
  }

  String encodePublicKeyToPem() {
    return helpers.encodePublicKeyToPem(rsaKeyPair.publicKey);
  }

  void reset() {
    // new rsa key pair
    final AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> rsaKeyPair =
        helpers.generateRSAkeyPair(helpers.exampleSecureRandom());
    _rsaKeyPair = helpers.rsaKeyPairToString(rsaKeyPair);
    // reset parameters
    _booleanParameters.clear();
    save();
  }
}
