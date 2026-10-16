// Read-only query against the HedgeDoc SQLite database.
// Usage (cwd = hedgedoc-1x): node db-query.js "<SELECT ...>"
// Prints the rows as JSON.
const path = require('path')
const sqlite3 = require(path.join(process.cwd(), 'node_modules', 'sqlite3'))

const sql = process.argv[2]
if (!/^\s*select\b/i.test(sql || '')) {
  console.error('only SELECT statements are allowed')
  process.exit(2)
}
const db = new sqlite3.Database(path.join(process.cwd(), 'db.hedgedoc.sqlite'), sqlite3.OPEN_READONLY)
db.all(sql, (err, rows) => {
  if (err) {
    console.error(err.message)
    process.exit(1)
  }
  console.log(JSON.stringify(rows))
  db.close()
})
