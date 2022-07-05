import 'package:hive/hive.dart';

import 'dart:typed_data';

import 'package:pointycastle/export.dart';
import 'package:awachat/store/config/helpers.dart' as helpers;

// flutter packages pub run build_runner build
part 'config.g.dart';

@HiveType(typeId: 2)
class Config extends HiveObject {
  Config(this._rsaKeyPair);

  factory Config.loads(String key, {String boxName = 'metadata'}) {
    final dynamic config = Hive.box(boxName).get(key);
    if (config is Config) {
      return config;
    } else {
      final AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> rsaKeyPair =
          helpers.generateRSAkeyPair(helpers.exampleSecureRandom());
      Hive.box(boxName)
          .put(key, Config(helpers.rsaKeyPairToString(rsaKeyPair)));
      return Hive.box(boxName).get(key);
    }
  }

  static final Config config = Config.loads('config');

  @HiveField(0)
  final List<String> _rsaKeyPair;
  AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> get rsaKeyPair =>
      helpers.stringToRsaKeyPair(_rsaKeyPair);

  Uint8List rsaSign(Uint8List dataToSign) {
    return helpers.rsaSign(rsaKeyPair.privateKey, dataToSign);
  }

  String encodePublicKeyToPem() {
    return helpers.encodePublicKeyToPem(rsaKeyPair.publicKey);
  }
}
