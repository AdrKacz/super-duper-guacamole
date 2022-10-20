file=test/coverage_helper_test.dart
echo "// More details: https://github.com/flutter/flutter/issues/27997"
echo "// Helper file to make coverage work for all dart files\n" > $file
echo "// ignore_for_file: unused_import" >> $file
find lib -name '*.dart' | cut -c4- | awk -v package=$1 '{printf "import '\''package:%s%s'\'';\n", package, $1}' >> $file
echo "\nvoid main(){}" >> $file