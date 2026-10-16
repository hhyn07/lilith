// Unit test for hedgedoc-1x/lib/book.js (book table of contents from an index note).
// Usage: node test-book.js <hedgedoc-1x dir>; prints "ok N" or the failures (ASCII only).
'use strict'
const path = require('path')
const book = require(path.join(process.argv[2], 'lib', 'book.js'))

const fails = []
let n = 0
function check (name, got, want) {
  n++
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(name + ': got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want))
}
// tree without the fields the resolver adds, for comparing
function shape (nodes) {
  return nodes.map(x => [x.type, x.title.trim(), x.href || null, shape(x.children)])
}

// the note "書本模式" as hhyn wrote it (title heading + two links + an empty item)
check('simple book', shape(book.parseTree('## Book\n\n- [One](/aaa)\n- [Two](/bbb)\n- ', 'Book')),
  [['page', 'One', '/aaa', []], ['page', 'Two', '/bbb', []]])
// headings make groups (HackMD's "week meetings")
check('groups', shape(book.parseTree('- [Back](/idx)\n\n## Weekly\n\n- [M1](/m1)\n- [M2](/m2)\n\n## Notes\n\ntext only\n', 'Index')),
  [['page', 'Back', '/idx', []], ['group', 'Weekly', null, [['page', 'M1', '/m1', []], ['page', 'M2', '/m2', []]]]])
// nested lists are sub-pages; an item without a link is a label
check('nested', shape(book.parseTree('- Part A\n  - [A1](/a1)\n  - [A2](/s/a2)\n- [B](/b)\n', 'X')),
  [['page', 'Part A', null, [['page', 'A1', '/a1', []], ['page', 'A2', '/s/a2', []]]], ['page', 'B', '/b', []]])
// first link of an item wins; code in titles is kept
check('first link', shape(book.parseTree('- see [`ch1`](/c1) and [x](/x)\n', 'X')), [['page', 'ch1', '/c1', []]])
check('empty', book.parseTree('', 'X'), [])
// the book's name: HedgeDoc only takes '# x' as the title, books also take '## x'
check('title from note', book.bookTitle('## H2', 'Real'), 'Real')
check('title from first heading', book.bookTitle('text\n\n## Book\n', 'Untitled'), 'Book')
check('title fallback', book.bookTitle('no heading', 'Untitled'), 'Untitled')

// links that point at notes on this site
check('ref /id', book.noteRefOf('/Cx3L4v0lR2e8gScLzQT3qw', 'http://localhost:3000'), 'Cx3L4v0lR2e8gScLzQT3qw')
check('ref /s/short', book.noteRefOf('/s/VMMk0KFdxN', ''), 'VMMk0KFdxN')
check('ref full url', book.noteRefOf('http://localhost:3000/abc?view#h', 'http://localhost:3000'), 'abc')
check('ref /b/book/page', book.noteRefOf('/b/book1/page2', ''), 'page2')
check('ref other site', book.noteRefOf('https://example.com/abc', 'http://localhost:3000'), null)
check('ref protocol-relative', book.noteRefOf('//evil.example/abc', ''), null)
check('ref deep path', book.noteRefOf('/a/b/c/d', ''), null)
// code review 2026-10-16: "/\host" is another site to browsers
check('ref backslash host', book.noteRefOf('/\\evil.example/x', ''), null)
// isBook: lists with at least two links to notes of this site
check('book: three note links', book.isBook('# B\n- [a](/abc)\n- [b](/s/def)\n- [c](/b/x/ghi)', 'http://h'), true)
check('book: one link in a list', book.isBook('# B\n- [a](/abc)\ntext [b](/def)', 'http://h'), false)
check('book: other sites only', book.isBook('- [a](https://x.example)\n- [b](https://y.example)', 'http://h'), false)
check('book: empty', book.isBook('', 'http://h'), false)
// past the 500 limit the tree must stay in shape (items after it are dropped, not misplaced)
;(function () {
  let big = '- [Parent](/p)\n'
  for (let i = 0; i < 520; i++) big += '  - [c' + i + '](/c' + i + ')\n'
  big += '- [After](/a)\n'
  const t = book.parseTree(big, 'X')
  let total = 0
  ;(function walk (ns) { ns.forEach(x => { total++; walk(x.children) }) })(t)
  check('limit keeps the shape', [t.length, t[0].title, t[0].children.length <= 500, total <= 500], [1, 'Parent', true, true])
})()

const lookups = []
// resolve: internal links get the note, readable or not; http(s) links are external
book.resolve(book.parseTree('- [Mine](/m)\n- [Secret](/p)\n- [Web](https://example.com)\n- [Gone](/zz)\n', 'X'), '',
  async (ref) => ({ m: { id: '1', shortid: 'M1', alias: null, title: 'Mine' }, p: { id: '2', shortid: 'P2', alias: 'priv', title: 'P' } })[ref] || null,
  (note) => note.id === '1'
).then(tree => {
  check('resolve readable', tree[0].note, { id: '1', ref: 'M1', canView: true, link: '/m' })
  check('resolve not readable (alias used)', [tree[1].note.ref, tree[1].note.canView], ['priv', false])
  check('resolve external', tree[2].external, 'https://example.com')
  check('resolve missing note (plain site link)', [tree[3].note, tree[3].external, tree[3].local], [undefined, undefined, '/zz'])
  // a private note linked without text must not show its title
  // (an item with no text is only kept when it has sub-items)
  return book.resolve(book.parseTree('- [](/p)\n  - [a](/m)\n- [](/m)\n  - [b](/m)\n', 'X'), '',
    async (ref) => { lookups.push(ref); return ({ m: { id: '1', shortid: 'M1', title: 'Mine' }, p: { id: '2', shortid: 'P2', title: 'Secret plan' } })[ref] || null },
    (note) => note.id === '1')
}).then(tree => {
  check('private title hidden', tree[0].title.trim(), '')
  check('readable title used', tree[1].title, 'Mine')
  check('each note looked up once', lookups.slice().sort(), ['m', 'p'])
  if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
  console.log('ok ' + n)
}).catch(e => { console.log('error ' + e.message); process.exit(1) })
