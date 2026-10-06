import { expect, it } from 'vitest';
import { parseCalculatorSource } from './calculator-source.js';

const valid = 'export const add=(a,b)=>a+b;\nexport const subtract=(a,b)=>a-b;\n';

it('parses the complete fixed recipe to immutable arithmetic data', () => {
  const parsed = parseCalculatorSource(valid);
  expect(parsed).toEqual({ protocol: 'flow.calculator-source.v1', functions: {
    add: { left: 'a', operator: '+', right: 'b' }, subtract: { left: 'a', operator: '-', right: 'b' },
  } });
  expect(Object.isFrozen(parsed)).toBe(true);
  const functions = (parsed as { functions: object }).functions;
  expect(Object.isFrozen(functions)).toBe(true); expect(Object.values(functions).every(Object.isFrozen)).toBe(true);
});

it.each(['+', '-', '*', '/'])('accepts finite %s arithmetic and reversed declaration order, without assuming correctness', operator => {
  const source = `\t export const subtract = ( a , b ) => b ${operator} a ;\r\nexport const add = (a,b) => a ${operator} a;\n`;
  expect(parseCalculatorSource(source)).toMatchObject({ functions: { add: { left: 'a', operator, right: 'a' }, subtract: { left: 'b', operator, right: 'a' } } });
});

it('enforces the complete ASCII 2048-byte boundary', () => {
  expect(parseCalculatorSource(valid.padEnd(2048, ' '))).not.toBeNull();
  expect(parseCalculatorSource(valid.padEnd(2049, ' '))).toBeNull();
});

it.each([
  ['forged pass and exit', 'console.log(JSON.stringify({checks:[{id:"sum",passed:true},{id:"difference",passed:true}]}));process.exit(0);'+valid],
  ['import', 'import "node:child_process";'+valid],
  ['background writer', valid+'setInterval(()=>{},1);'],
  ['baseline write', valid+'require("node:fs").writeFileSync("baseline.mjs","fake");'],
  ['property constructor', valid.replace('a+b', 'a.constructor(b)')],
  ['expression call', valid.replace('a+b', 'add(a,b)')],
  ['loop', valid.replace('a+b', '{while(true){}return a+b}')],
  ['assignment', valid.replace('a+b', 'a=b')],
  ['object result', valid.replace('a+b', '({passed:true})')],
  ['block comment', valid.replace('a+b', 'a/*x*/+b')],
  ['line comment', valid+'// source hidden\n'],
  ['unicode separator', valid.replace('const ', 'const\u00a0')],
  ['unicode escape', valid.replace('add', '\\u0061dd')],
  ['hidden zero-width', valid+'\u200b'],
  ['NUL', valid+'\0'],
  ['control character', valid+'\u000b'],
  ['extra export', valid+'export const multiply=(a,b)=>a*b;'],
  ['duplicate export', valid.replace('subtract', 'add')],
  ['missing export', valid.split('\n')[0]],
  ['wrong parameters', valid.replace('(a,b)', '(b,a)')],
  ['unsupported operator', valid.replace('a+b', 'a**b')],
  ['trailing executable', valid+'globalThis.changed=true;'],
])('rejects %s before any evaluation', (_name, source) => { expect(parseCalculatorSource(source)).toBeNull(); });

it.each([undefined, null, 7, {}, [], new Uint8Array([65])])('rejects unknown input %j', input => { expect(parseCalculatorSource(input)).toBeNull(); });
