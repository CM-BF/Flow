export const CALCULATOR_SOURCE_MAX_BYTES = 2048;
export const CALCULATOR_SOURCE_POLICY = 'flow.calculator-source.v1';
type Operand = 'a' | 'b';
type Operator = '+' | '-' | '*' | '/';
export interface ArithmeticExpression { readonly left: Operand; readonly operator: Operator; readonly right: Operand }
export interface CalculatorProgram {
  readonly protocol: typeof CALCULATOR_SOURCE_POLICY;
  readonly functions: Readonly<{ add: ArithmeticExpression; subtract: ArithmeticExpression }>;
}

const space = '[ \\t\\r\\n]*';
const declaration = `export[ \\t\\r\\n]+const[ \\t\\r\\n]+(add|subtract)${space}=${space}\\(${space}a${space},${space}b${space}\\)${space}=>${space}(a|b)${space}([+*/-])${space}(a|b)${space};`;
const completeProgram = new RegExp(`^${space}${declaration}${space}${declaration}${space}$`);

/** The entire accepted language is two arithmetic arrow exports, not a JavaScript blacklist. */
export function parseCalculatorSource(source: unknown): CalculatorProgram | null {
  if (typeof source !== 'string' || source.length > CALCULATOR_SOURCE_MAX_BYTES || !/^[\t\r\n\x20-\x7e]*$/.test(source)) return null;
  const match = completeProgram.exec(source);
  if (!match || match[0].length !== source.length || match[1] === match[5]) return null;
  const expression = (offset: number): ArithmeticExpression => Object.freeze({
    left: match[offset] as Operand, operator: match[offset + 1] as Operator, right: match[offset + 2] as Operand,
  });
  const first = expression(2), second = expression(6);
  return Object.freeze({ protocol: CALCULATOR_SOURCE_POLICY, functions: Object.freeze({
    add: match[1] === 'add' ? first : second, subtract: match[1] === 'subtract' ? first : second,
  }) });
}
