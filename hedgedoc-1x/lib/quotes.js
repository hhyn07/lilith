'use strict'
// Lilith: quotes for the home page heading. One is picked at random for each
// page load and typed out by public/js/catppuccin.js.
// To add or remove a quote, edit this list (text + source, and lang for
// non-Chinese text so the heading uses the right font) and restart.

const QUOTES = [
  // anime lines in Japanese (wording checked against the official site where possible)
  { text: 'それが運命石の扉の選択だ。', source: '岡部倫太郎《命運石之門》', lang: 'ja' },
  { text: '奇跡ってのは、起こしてこそ初めて価値が出るものよ。', source: '葛城美里《新世紀福音戰士》', lang: 'ja' },
  { text: '魔法は探し求めている時が一番楽しいんだよ。', source: '芙莉蓮《葬送的芙莉蓮》', lang: 'ja' },
  { text: '逃げちゃダメだ。', source: '碇真嗣《新世紀福音戰士》', lang: 'ja' }
]

function randomQuote () {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]
}

module.exports = {
  QUOTES,
  randomQuote
}
