// Print lib/quotes.js as JSON with \uXXXX escapes, so the output is pure ASCII
// (Windows PowerShell 5.1 decodes native output with the ANSI code page).
// Usage: node list-quotes.js <path to hedgedoc-1x>
const path = require('path')
const { QUOTES } = require(path.join(path.resolve(process.argv[2] || '.'), 'lib', 'quotes'))
console.log(JSON.stringify(QUOTES).replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')))
