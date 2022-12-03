// ===== ==== ====
// EXPORTS
exports.createBubble = ({ currentUser = { questions: {} } }) => {
  const bubbleArray = []
  for (const [question, answer] of Object.entries(currentUser.questions)) {
    if (answer.startsWith('_')) {
      bubbleArray.push(`${question}:${answer.slice(1)}`)
    }
  }

  if (bubbleArray.length === 0) {
    return 'void' // The AttributeValue for a key attribute cannot contain an empty string value
  }
  return bubbleArray.join('::')
}
