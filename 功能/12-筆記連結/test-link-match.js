// Unit test for the note-link trigger pattern in public/js/lib/editor/note-links.js.
// Usage: node test-link-match.js <path to hedgedoc-1x>
// Reads the regex from the source so the test follows the real code.
const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(process.argv[2] || '.', 'public', 'js', 'lib', 'editor', 'note-links.js'), 'utf8')
const literal = src.match(/const LINK_MATCH = (\/.*\/)\s*$/m)[1]
const LINK_MATCH = eval(literal) // eslint-disable-line no-eval

const cases = [
  // [text before cursor, should trigger, expected link text, expected query]
  ['- [ ](', true, ' ', ''],
  ['[範例一](', true, '範例一', ''],
  ['see [notes](wel', true, 'notes', 'wel'],
  ['- [x] [todo](', true, 'todo', ''],
  ['![alt](', false],
  ['[text](https://example.com/a b', false],
  ['[text] (', false],
  ['plain text (', false],
  ['[a](b)(', false]
]

const results = cases.map(([text, should, linkText, query]) => {
  const m = text.match(LINK_MATCH)
  const ok = should ? !!m && m[2] === linkText && m[3] === query : !m
  return { text, ok }
})
const failed = results.filter((r) => !r.ok)
console.log(JSON.stringify({ total: results.length, failed: failed.map((r) => r.text) }))
process.exit(failed.length ? 1 : 0)
