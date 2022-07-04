import 'package:hive/hive.dart';

import 'dart:convert';
import 'dart:typed_data';

import 'package:pointycastle/src/platform_check/platform_check.dart';
import 'package:pointycastle/export.dart';
import 'package:asn1lib/asn1lib.dart';

// flutter packages pub run build_runner build
part 'config.g.dart';

@HiveType(typeId: 2)
class Config extends HiveObject {
  Config(this._rsaKeyPair);

  factory Config.loads(String key) {
    final dynamic config = Hive.box('meta').get(key);
    if (config is Config) {
      return config;
    } else {
      final AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> rsaKeyPair =
          generateRSAkeyPair(exampleSecureRandom());
      BigInt? n = rsaKeyPair.publicKey.n;
      BigInt? e = rsaKeyPair.publicKey.publicExponent;

      BigInt? d = rsaKeyPair.privateKey.privateExponent;
      BigInt? p = rsaKeyPair.privateKey.p;
      BigInt? q = rsaKeyPair.privateKey.q;
      // print('===Store===\nn: $n\ne: $e\nd: $d\np: $p\nq: $q');
      if (n != null && e != null && d != null && p != null && q != null) {
        Hive.box('meta').put(
            key,
            Config([
              n.toString(),
              e.toString(),
              d.toString(),
              p.toString(),
              q.toString(),
            ]));
        return Hive.box('meta').get(key);
      } else {
        throw 'cannot extract private key from rsa pair';
      }
    }
  }

  static final Config instance = Config.loads('config');

  @HiveField(0)
  final List<String> _rsaKeyPair;
  AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> get rsaKeyPair {
    if (_rsaKeyPair.length != 5) {
      throw 'rsa key pair must have exactly five parameters: $_rsaKeyPair';
    }

    String n = _rsaKeyPair[0];
    String e = _rsaKeyPair[1];
    String d = _rsaKeyPair[2];
    String p = _rsaKeyPair[3];
    String q = _rsaKeyPair[4];

    try {
      RSAPublicKey publicKey = RSAPublicKey(BigInt.parse(n), BigInt.parse(e));
      RSAPrivateKey privateKey = RSAPrivateKey(
          BigInt.parse(n), BigInt.parse(d), BigInt.parse(p), BigInt.parse(q));
      return AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey>(
          publicKey, privateKey);
    } catch (e) {
      // No specified type, handles all
      throw 'Something really unknown: $e';
    }
  }

  // See Uint8List.fromList(plainText.codeUnits)
  Uint8List rsaSign(Uint8List dataToSign) {
    //final signer = Signer('SHA-256/RSA'); // Get using registry
    final signer = RSASigner(SHA256Digest(), '0609608648016503040201');

    // initialize with true, which means sign
    signer.init(
        true, PrivateKeyParameter<RSAPrivateKey>(rsaKeyPair.privateKey));

    final sig = signer.generateSignature(dataToSign);

    return sig.bytes;
  }

  // https://gist.github.com/proteye/982d9991922276ccfb011dfc55443d74
  String? encodePublicKeyToPem() {
    BigInt? modulus = rsaKeyPair.publicKey.modulus;
    BigInt? exponent = rsaKeyPair.publicKey.exponent;
    if (modulus == null || exponent == null) {
      return null;
    }

    ASN1Sequence algorithmSeq = ASN1Sequence();
    ASN1Object algorithmAsn1Obj = ASN1Object.fromBytes(Uint8List.fromList(
        [0x6, 0x9, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0xd, 0x1, 0x1, 0x1]));
    ASN1Object paramsAsn1Obj =
        ASN1Object.fromBytes(Uint8List.fromList([0x5, 0x0]));
    algorithmSeq.add(algorithmAsn1Obj);
    algorithmSeq.add(paramsAsn1Obj);

    ASN1Sequence publicKeySeq = ASN1Sequence();
    publicKeySeq.add(ASN1Integer(modulus));
    publicKeySeq.add(ASN1Integer(exponent));
    var publicKeySeqBitString =
        ASN1BitString(Uint8List.fromList(publicKeySeq.encodedBytes));

    var topLevelSeq = ASN1Sequence();
    topLevelSeq.add(algorithmSeq);
    topLevelSeq.add(publicKeySeqBitString);
    var dataBase64 = base64.encode(topLevelSeq.encodedBytes);

    return '''-----BEGIN PUBLIC KEY-----\r\n$dataBase64\r\n-----END PUBLIC KEY-----''';
  }
}

// ===== ===== ===== ===== =====
// ===== ===== ===== ===== =====
// RSE KEY PAIRS Generation

AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> generateRSAkeyPair(
    SecureRandom secureRandom,
    {int bitLength = 2048}) {
  // Create an RSA key generator and initialize it

  // final keyGen = KeyGenerator('RSA'); // Get using registry
  final keyGen = RSAKeyGenerator();

  keyGen.init(ParametersWithRandom(
      RSAKeyGeneratorParameters(BigInt.parse('65537'), bitLength, 64),
      secureRandom));

  // Use the generator

  final pair = keyGen.generateKeyPair();

  // Cast the generated key pair into the RSA key types

  final myPublic = pair.publicKey as RSAPublicKey;
  final myPrivate = pair.privateKey as RSAPrivateKey;

  return AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey>(myPublic, myPrivate);
}

SecureRandom exampleSecureRandom() {
  final secureRandom = SecureRandom('Fortuna')
    ..seed(
        KeyParameter(Platform.instance.platformEntropySource().getBytes(32)));
  return secureRandom;
}
