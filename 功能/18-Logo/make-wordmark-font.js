// Download a subset of Marcellus 400 (SIL OFL 1.1) holding only
// the letters of the site name "Lilith", from the Google Fonts CSS API
// (text= parameter), and save it as public/fonts/lilith/wordmark.woff2.
// (2026-10-16: first Cormorant Garamond Italic, then Marcellus at hhyn's choice)
// Usage: node make-wordmark-font.js <path to hedgedoc-1x> <empty download folder>
'use strict'
const fs = require('fs')
const path = require('path')

const hd = path.resolve(process.argv[2] || '.')
const downloadDir = path.resolve(process.argv[3] || '')
const TEXT = 'Lilith'
const OUT = path.join(hd, 'public', 'fonts', 'lilith', 'wordmark.woff2')

async function main () {
  if (!process.argv[3]) throw new Error('give an empty download folder as the 2nd argument')
  fs.mkdirSync(downloadDir, { recursive: true })
  if (fs.readdirSync(downloadDir).length > 0) throw new Error('download folder is not empty: ' + downloadDir)

  const cssUrl = `https://fonts.googleapis.com/css2?family=Marcellus&display=swap&text=${encodeURIComponent(TEXT)}`
  // a current browser user agent, so the API answers with woff2
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
  const css = await (await fetch(cssUrl, { headers: { 'User-Agent': ua } })).text()
  const urls = Array.from(css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\('woff2'\)/g)).map((m) => m[1])
  if (urls.length !== 1) throw new Error(`expected 1 woff2 url, got ${urls.length}:\n${css}`)

  const res = await fetch(urls[0])
  if (!res.ok) throw new Error('download failed: HTTP ' + res.status)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.slice(0, 4).toString('latin1') !== 'wOF2') throw new Error('not a woff2 file')
  const tmp = path.join(downloadDir, 'wordmark.woff2')
  fs.writeFileSync(tmp, buf)
  fs.copyFileSync(tmp, OUT)
  console.log(JSON.stringify({ text: TEXT, bytes: buf.length, to: OUT }))
}

main().catch((e) => { console.error(String(e)); process.exit(1) })
