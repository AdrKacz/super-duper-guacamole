import 'dart:convert';
import 'dart:typed_data';
import 'package:awachat/store/memory.dart';

// ignore: implementation_imports
import 'package:pointycastle/src/platform_check/platform_check.dart';
import 'package:pointycastle/export.dart';
import 'package:asn1lib/asn1lib.dart';

// ===== ===== ===== ===== =====
// ===== ===== ===== ===== =====
// Storage

AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey>? retreiveRSAkeyPair() {
  String? n = Memory().rsaKeyPairBox.get('n');
  String? e = Memory().rsaKeyPairBox.get('e');

  String? d = Memory().rsaKeyPairBox.get('d');
  String? p = Memory().rsaKeyPairBox.get('p');
  String? q = Memory().rsaKeyPairBox.get('q');
  // print('===Retreive===\nn: $n\ne: $e\nd: $d\np: $p\nq: $q');
  if (n != null && e != null && d != null && p != null && q != null) {
    try {
      RSAPublicKey publicKey = RSAPublicKey(BigInt.parse(n), BigInt.parse(e));
      RSAPrivateKey privateKey = RSAPrivateKey(
          BigInt.parse(n), BigInt.parse(d), BigInt.parse(p), BigInt.parse(q));
      return AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey>(
          publicKey, privateKey);
    } catch (e) {
      // No specified type, handles all
      print('Something really unknown: $e');
    }
  }
  return null;
}

void storeRSAkeyPair(AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> pair) {
  BigInt? n = pair.publicKey.n;
  BigInt? e = pair.publicKey.publicExponent;

  BigInt? d = pair.privateKey.privateExponent;
  BigInt? p = pair.privateKey.p;
  BigInt? q = pair.privateKey.q;
  // print('===Store===\nn: $n\ne: $e\nd: $d\np: $p\nq: $q');
  if (n != null && e != null && d != null && p != null && q != null) {
    Memory().rsaKeyPairBox.putAll({
      'n': n.toString(),
      'e': e.toString(),
      'd': d.toString(),
      'p': p.toString(),
      'q': q.toString(),
    });
  }
}

// ===== ===== ===== ===== =====
// ===== ===== ===== ===== =====
// Generation

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

// ===== ===== ===== ===== =====
// ===== ===== ===== ===== =====
// Signature

// See Uint8List.fromList(plainText.codeUnits)
Uint8List rsaSign(RSAPrivateKey privateKey, Uint8List dataToSign) {
  //final signer = Signer('SHA-256/RSA'); // Get using registry
  final signer = RSASigner(SHA256Digest(), '0609608648016503040201');

  // initialize with true, which means sign
  signer.init(true, PrivateKeyParameter<RSAPrivateKey>(privateKey));

  final sig = signer.generateSignature(dataToSign);

  return sig.bytes;
}

// https://gist.github.com/proteye/982d9991922276ccfb011dfc55443d74
String? encodePublicKeyToPem(RSAPublicKey publicKey) {
  BigInt? modulus = publicKey.modulus;
  BigInt? exponent = publicKey.exponent;
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
