import 'package:awachat/pointycastle/sign.dart';
import 'package:hive/hive.dart';

import 'package:pointycastle/export.dart';

// flutter packages pub run build_runner build
part 'config.g.dart';

@HiveType(typeId: 2)
class Config extends HiveObject {
  Config(this._rsaKeyPair);

  // ignore: unused_field
  static final Config _instance =
      Config(storeRSAkeyPair(generateRSAkeyPair(exampleSecureRandom())));

  @HiveField(0)
  final List<String> _rsaKeyPair;
  AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey>? get rsaKeyPair {
    if (_rsaKeyPair.length != 5) {
      return null;
    }
    String n = _rsaKeyPair[0];
    String e = _rsaKeyPair[1];
    String d = _rsaKeyPair[2];
    String p = _rsaKeyPair[3];
    String q = _rsaKeyPair[4];

    return retreiveRSAkeyPair(n, e, d, p, q);
  }
}
