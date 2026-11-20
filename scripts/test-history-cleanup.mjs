// Extract cleanHistoryText from client.js and test it against real-world
// user-row innerText shapes (duplicates + timestamps).
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const start = src.indexOf('const cleanHistoryText =');
if (start < 0) throw new Error('cleanHistoryText not found');
const end = src.indexOf('const readHistory =', start);
const fnSource = src.slice(start, end);
const cleanHistoryText = new Function(`${fnSource}; return cleanHistoryText;`)();

const cases = [
  // Real shape from m01608: text + inline zh date + same text again.
  ['再增加一个功能，当光标在输入框中，我可以…历史 11月19日 19:34再增加一个功能，当光标在输入框中，我可以…历史',
    '再增加一个功能，当光标在输入框中，我可以…历史'],
  // Duplicates separated by a stamp line.
  ['hello world\n11月19日 19:34\nhello world', 'hello world'],
  // Plain message, no duplication.
  ['普通的一条消息', '普通的一条消息'],
  // Multiline message preserved.
  ['第一行\n第二行\n第三行', '第一行\n第二行\n第三行'],
  // En date stamp between duplicates.
  ['fix the bug Nov 19 fix the bug', 'fix the bug'],
  // Time-only stamp on its own line.
  ['paste logs\n09:41\npaste logs', 'paste logs'],
  // Message that merely contains a number-like time but is not duplicated.
  ['会议改到 14:30 开', '会议改到 14:30 开'],
  // Stamp-only noise row → empty (filtered out of history).
  ['11月19日 19:34', ''],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = cleanHistoryText(input);
  const ok = got === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(input.slice(0, 40))} -> ${JSON.stringify(got)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}
console.log(failed === 0 ? 'ALL CLEANUP TESTS PASSED' : `${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
