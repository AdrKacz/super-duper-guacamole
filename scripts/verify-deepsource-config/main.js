const util = require('node:util')
const exec = util.promisify(require('node:child_process').exec)
const toml = require('toml')
const fs = require('fs')

function getJavascriptAnalyzer () {
  const deepSourceConfigToml = fs.readFileSync('../.deepsource.toml', 'utf8')
  const deepSourceConfig = toml.parse(deepSourceConfigToml)
  for (const analyzer of deepSourceConfig.analyzers) {
    if (analyzer.name === 'javascript') {
      return analyzer
    }
  }

  throw new Error('javascript analyzer not found')
}

async function verifyDeepsourceConfig () {
  // Find all package.json
  const { stdout, stderr } = await exec('find .. -name "node_modules" -prune -o -name ".aws-sam" -prune -o -name "package.json"')
  console.error('stderr:', stderr)

  let stdoutArray = stdout.split('\n')
  stdoutArray = stdoutArray.filter((path) => path.endsWith('/package.json'))
  stdoutArray = stdoutArray.map((path) => path.replace('../', ''))
  stdoutArray = stdoutArray.map((path) => path.replace('package.json', ''))
  stdoutArray.sort()

  const stringStdoutArray = stdoutArray.map((path) => `"${path}"`).join(',\n') + ','
  console.log('correct set of dependencies:\n', stringStdoutArray, '\n')

  const deepSourceConfigToml = fs.readFileSync('../.deepsource.toml', 'utf8')
  const deepSourceConfig = toml.parse(deepSourceConfigToml)
  const javascriptAnalyzer = getJavascriptAnalyzer(deepSourceConfig)
  javascriptAnalyzer.meta.dependency_file_paths.sort()

  if (stdoutArray.toString() !== javascriptAnalyzer.meta.dependency_file_paths.toString()) {
    throw new Error("dependency_file_paths doesn't include every dependencies")
  }
}
verifyDeepsourceConfig()
