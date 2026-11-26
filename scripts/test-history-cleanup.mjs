// Extract cleanHistoryText (plus its stamp constants) from client.js and test
// it against real-world user-row innerText shapes (duplicates + timestamps).
// Primary path (bubble text) runs with allowFold=false; the full-row fallback
// folds "TEXT stamp TEXT" duplication.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const start = src.indexOf('const STAMP_LINE =');
if (start < 0) throw new Error('STAMP_LINE not found');
const end = src.indexOf('const readHistory =', start);
const fnSource = src.slice(start, end);
const cleanHistoryText = new Function(`${fnSource}; return cleanHistoryText;`)();

const bubbleCases = [
  // Bubble text needs no stamp handling: clock lives outside the bubble.
  ['帮我安装', '帮我安装'],
  ['第一行\n第二行\n第三行', '第一行\n第二行\n第三行'],
  // Repeated text is NEVER folded on the bubble path.
  ['哈哈哈哈哈哈哈哈', '哈哈哈哈哈哈哈哈'],
  // A message that IS just a timestamp is dropped from history.
  ['11:11', ''],
];

const rowCases = [
  // Real shape from m01608: text + inline zh date + same text again.
  ['再增加一个功能，当光标在输入框中，我可以…历史 11月19日 19:34再增加一个功能，当光标在输入框中，我可以…历史',
    '再增加一个功能，当光标在输入框中，我可以…历史'],
  // The user-reported bug: today's rows inline a time-only clock ("11:11")
  // between the two copies.
  ['帮我安装 11:11帮我安装', '帮我安装'],
  ['帮我安装11:11帮我安装', '帮我安装'],
  // Duplicates separated by a stamp line.
  ['hello world\n11月19日 19:34\nhello world', 'hello world'],
  // Time-only stamp on its own line.
  ['paste logs\n09:41\npaste logs', 'paste logs'],
  // Plain message, no duplication.
  ['普通的一条消息', '普通的一条消息'],
  // Multiline message preserved.
  ['第一行\n第二行\n第三行', '第一行\n第二行\n第三行'],
  // En date stamp between duplicates.
  ['fix the bug Nov 19 fix the bug', 'fix the bug'],
  // Message that merely contains a number-like time but is not duplicated.
  ['会议改到 14:30 开', '会议改到 14:30 开'],
  // Repeated text WITHOUT any timestamp gap must survive unchanged.
  ['哈哈哈哈哈哈哈哈', '哈哈哈哈哈哈哈哈'],
  ['buy milk and buy milk', 'buy milk and buy milk'],
  // Stamp-only noise row → empty (filtered out of history).
  ['11月19日 19:34', ''],
];

let failed = 0;
const run = (label, cases, ...args) => {
  for (const [input, expected] of cases) {
    const got = cleanHistoryText(input, ...args);
    const ok = got === expected;
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'} [${label}] ${JSON.stringify(input.slice(0, 40))} -> ${JSON.stringify(got)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  }
};
run('bubble', bubbleCases);
run('row', rowCases, true);
console.log(failed === 0 ? 'ALL CLEANUP TESTS PASSED' : `${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
