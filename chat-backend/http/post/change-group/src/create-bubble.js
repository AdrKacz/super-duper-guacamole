// ===== ==== ====
// EXPORTS
exports.createBubble = ({ currentUser }) => {
  if (typeof currentUser.questions !== 'object') {
    return 'void' // The AttributeValue for a key attribute cannot contain an empty string value
  }

  const bubbleArray = []
  for (const [question, answer] of Object.entries(currentUser.questions)) {
    if (answer.startsWith('_')) {
      bubbleArray.push(`${question}:${answer.slice(1)}`)
    }
  }

  return bubbleArray.join('::')
}
