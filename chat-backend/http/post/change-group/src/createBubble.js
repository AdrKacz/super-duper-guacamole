// ===== ==== ====
// EXPORTS
exports.createBubble = async ({ currentUser }) => {
  if (typeof currentUser.questions !== 'object') {
    return ''
  }

  const bubbleArray = []
  for (const [question, answer] of Object.entries(currentUser.questions)) {
    if (answer.startsWith('_')) {
      bubbleArray.push(`${question}:${answer.slice(1)}`)
    }
  }

  return bubbleArray.join('::')
}
