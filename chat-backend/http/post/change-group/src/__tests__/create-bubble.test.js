// ===== ==== ====
// IMPORTS
const { createBubble } = require('../create-bubble')

// ===== ==== ====
// TESTS
test('it returns empty bubble if not questions', () => {
  const bubble = createBubble({ currentUser: { questions: [] } })

  expect(bubble).toBe('void')
})

test.each([
  { questions: { a: '_1', b: '_2', c: '1' }, expectedBubble: 'a:1::b:2' },
  { questions: { a: '2', b: '3', c: '1' }, expectedBubble: 'void' },
  { questions: { a: '_1', b: '3', c: '_2' }, expectedBubble: 'a:1::c:2' }
])('it returns correct bubble ($expectedBubble)', ({ questions, expectedBubble }) => {
  const bubble = createBubble({ currentUser: { questions } })

  expect(bubble).toBe(expectedBubble)
})
