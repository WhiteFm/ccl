import type { AbilityId, AbilityScores } from "../../content-schema/src/types.ts";

export interface FormulaContext {
  characterLevel: number;
  classLevels: Readonly<Record<string, number>>;
  abilityScores: Readonly<AbilityScores>;
  proficiencyBonus: number;
}

type TokenKind = "number" | "string" | "identifier" | "operator" | "leftParen" | "rightParen" | "comma" | "eof";

interface Token {
  kind: TokenKind;
  value: string;
  position: number;
}

type FormulaValue = number | boolean | string;

const ABILITIES = new Set<AbilityId>(["str", "dex", "con", "int", "wis", "cha"]);

export class FormulaError extends Error {
  readonly position: number;

  constructor(message: string, position: number) {
    super(`${message} at position ${position}`);
    this.name = "FormulaError";
    this.position = position;
  }
}

class Tokenizer {
  private readonly source: string;
  private index = 0;

  constructor(source: string) {
    this.source = source;
  }

  next(): Token {
    this.skipWhitespace();
    const position = this.index;
    const char = this.source[this.index];

    if (char === undefined) return { kind: "eof", value: "", position };

    if (/[0-9.]/.test(char)) return this.readNumber();
    if (/[A-Za-z_]/.test(char)) return this.readIdentifier();
    if (char === '"' || char === "'") return this.readString(char);

    this.index += 1;
    if (char === "(") return { kind: "leftParen", value: char, position };
    if (char === ")") return { kind: "rightParen", value: char, position };
    if (char === ",") return { kind: "comma", value: char, position };

    const pair = char + (this.source[this.index] ?? "");
    if ([">=", "<=", "==", "!=", "&&", "||"].includes(pair)) {
      this.index += 1;
      return { kind: "operator", value: pair, position };
    }
    if (["+", "-", "*", "/", "%", ">", "<", "!"].includes(char)) {
      return { kind: "operator", value: char, position };
    }

    throw new FormulaError(`Unsupported character ${JSON.stringify(char)}`, position);
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.source[this.index] ?? "")) this.index += 1;
  }

  private readNumber(): Token {
    const position = this.index;
    let value = "";
    let dotCount = 0;
    while (/[0-9.]/.test(this.source[this.index] ?? "")) {
      const char = this.source[this.index] ?? "";
      if (char === ".") dotCount += 1;
      value += char;
      this.index += 1;
    }
    if (dotCount > 1 || value === ".") throw new FormulaError("Invalid number", position);
    return { kind: "number", value, position };
  }

  private readIdentifier(): Token {
    const position = this.index;
    let value = "";
    while (/[A-Za-z0-9_]/.test(this.source[this.index] ?? "")) {
      value += this.source[this.index];
      this.index += 1;
    }
    return { kind: "identifier", value, position };
  }

  private readString(quote: string): Token {
    const position = this.index;
    this.index += 1;
    let value = "";
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (char === quote) {
        this.index += 1;
        return { kind: "string", value, position };
      }
      if (char === "\\") {
        const escaped = this.source[this.index + 1];
        if (escaped !== quote && escaped !== "\\") throw new FormulaError("Unsupported escape sequence", this.index);
        value += escaped;
        this.index += 2;
        continue;
      }
      value += char;
      this.index += 1;
    }
    throw new FormulaError("Unterminated string", position);
  }
}

class Parser {
  private readonly tokenizer: Tokenizer;
  private readonly context: FormulaContext;
  private current: Token;

  constructor(source: string, context: FormulaContext) {
    this.tokenizer = new Tokenizer(source);
    this.context = context;
    this.current = this.tokenizer.next();
  }

  parse(): number | boolean {
    const result = this.parseOr();
    if (this.current.kind !== "eof") throw new FormulaError(`Unexpected token ${this.current.value}`, this.current.position);
    if (typeof result === "string") throw new FormulaError("A formula cannot return a string", this.current.position);
    if (typeof result === "number" && !Number.isFinite(result)) throw new FormulaError("Formula returned a non-finite number", this.current.position);
    return result;
  }

  private parseOr(): FormulaValue {
    let left = this.parseAnd();
    while (this.isOperator("||")) {
      const op = this.consume();
      const right = this.parseAnd();
      left = this.requireBoolean(left, op) || this.requireBoolean(right, op);
    }
    return left;
  }

  private parseAnd(): FormulaValue {
    let left = this.parseEquality();
    while (this.isOperator("&&")) {
      const op = this.consume();
      const right = this.parseEquality();
      left = this.requireBoolean(left, op) && this.requireBoolean(right, op);
    }
    return left;
  }

  private parseEquality(): FormulaValue {
    let left = this.parseComparison();
    while (this.isOperator("==") || this.isOperator("!=")) {
      const op = this.consume();
      const right = this.parseComparison();
      left = op.value === "==" ? left === right : left !== right;
    }
    return left;
  }

  private parseComparison(): FormulaValue {
    let left = this.parseAddition();
    while ([">", ">=", "<", "<="].some((operator) => this.isOperator(operator))) {
      const op = this.consume();
      const leftNumber = this.requireNumber(left, op);
      const rightNumber = this.requireNumber(this.parseAddition(), op);
      if (op.value === ">") left = leftNumber > rightNumber;
      if (op.value === ">=") left = leftNumber >= rightNumber;
      if (op.value === "<") left = leftNumber < rightNumber;
      if (op.value === "<=") left = leftNumber <= rightNumber;
    }
    return left;
  }

  private parseAddition(): FormulaValue {
    let left = this.parseMultiplication();
    while (this.isOperator("+") || this.isOperator("-")) {
      const op = this.consume();
      const leftNumber = this.requireNumber(left, op);
      const rightNumber = this.requireNumber(this.parseMultiplication(), op);
      left = op.value === "+" ? leftNumber + rightNumber : leftNumber - rightNumber;
    }
    return left;
  }

  private parseMultiplication(): FormulaValue {
    let left = this.parseUnary();
    while (this.isOperator("*") || this.isOperator("/") || this.isOperator("%")) {
      const op = this.consume();
      const leftNumber = this.requireNumber(left, op);
      const rightNumber = this.requireNumber(this.parseUnary(), op);
      if ((op.value === "/" || op.value === "%") && rightNumber === 0) throw new FormulaError("Division by zero", op.position);
      if (op.value === "*") left = leftNumber * rightNumber;
      if (op.value === "/") left = leftNumber / rightNumber;
      if (op.value === "%") left = leftNumber % rightNumber;
    }
    return left;
  }

  private parseUnary(): FormulaValue {
    if (this.isOperator("!")) {
      const op = this.consume();
      return !this.requireBoolean(this.parseUnary(), op);
    }
    if (this.isOperator("+") || this.isOperator("-")) {
      const op = this.consume();
      const value = this.requireNumber(this.parseUnary(), op);
      return op.value === "-" ? -value : value;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaValue {
    if (this.current.kind === "number") return Number(this.consume().value);
    if (this.current.kind === "string") return this.consume().value;
    if (this.current.kind === "leftParen") {
      this.consume();
      const value = this.parseOr();
      this.expect("rightParen");
      return value;
    }
    if (this.current.kind === "identifier") return this.parseFunctionCall();
    throw new FormulaError(`Expected a number, function or parenthesized expression`, this.current.position);
  }

  private parseFunctionCall(): FormulaValue {
    const identifier = this.consume();
    this.expect("leftParen");
    const args: FormulaValue[] = [];
    if (this.current.kind !== "rightParen") {
      args.push(this.parseOr());
      while (this.current.kind === "comma") {
        this.consume();
        args.push(this.parseOr());
      }
    }
    this.expect("rightParen");
    return this.callFunction(identifier, args);
  }

  private callFunction(identifier: Token, args: FormulaValue[]): number {
    const numbers = (): number[] => args.map((value) => this.requireNumber(value, identifier));
    const noArgs = (): void => {
      if (args.length !== 0) throw new FormulaError(`${identifier.value} expects no arguments`, identifier.position);
    };
    const oneString = (): string => {
      if (args.length !== 1 || typeof args[0] !== "string") throw new FormulaError(`${identifier.value} expects one string argument`, identifier.position);
      return args[0];
    };

    switch (identifier.value) {
      case "character_level":
        noArgs();
        return this.context.characterLevel;
      case "class_level":
        return this.context.classLevels[oneString()] ?? 0;
      case "ability_score": {
        const ability = oneString() as AbilityId;
        if (!ABILITIES.has(ability)) throw new FormulaError(`Unknown ability ${ability}`, identifier.position);
        return this.context.abilityScores[ability];
      }
      case "ability_modifier": {
        const ability = oneString() as AbilityId;
        if (!ABILITIES.has(ability)) throw new FormulaError(`Unknown ability ${ability}`, identifier.position);
        return Math.floor((this.context.abilityScores[ability] - 10) / 2);
      }
      case "proficiency_bonus":
        noArgs();
        return this.context.proficiencyBonus;
      case "min":
        if (args.length < 1) throw new FormulaError("min expects at least one argument", identifier.position);
        return Math.min(...numbers());
      case "max":
        if (args.length < 1) throw new FormulaError("max expects at least one argument", identifier.position);
        return Math.max(...numbers());
      case "floor":
        if (args.length !== 1) throw new FormulaError("floor expects one argument", identifier.position);
        return Math.floor(numbers()[0]);
      case "ceil":
        if (args.length !== 1) throw new FormulaError("ceil expects one argument", identifier.position);
        return Math.ceil(numbers()[0]);
      case "abs":
        if (args.length !== 1) throw new FormulaError("abs expects one argument", identifier.position);
        return Math.abs(numbers()[0]);
      default:
        throw new FormulaError(`Unknown function ${identifier.value}`, identifier.position);
    }
  }

  private requireNumber(value: FormulaValue, token: Token): number {
    if (typeof value !== "number") throw new FormulaError(`${token.value} requires numeric operands`, token.position);
    return value;
  }

  private requireBoolean(value: FormulaValue, token: Token): boolean {
    if (typeof value !== "boolean") throw new FormulaError(`${token.value} requires boolean operands`, token.position);
    return value;
  }

  private isOperator(value: string): boolean {
    return this.current.kind === "operator" && this.current.value === value;
  }

  private expect(kind: TokenKind): Token {
    if (this.current.kind !== kind) throw new FormulaError(`Expected ${kind}`, this.current.position);
    return this.consume();
  }

  private consume(): Token {
    const token = this.current;
    this.current = this.tokenizer.next();
    return token;
  }
}

export function evaluateFormula(source: string, context: FormulaContext): number | boolean {
  if (source.length === 0 || source.length > 500) throw new FormulaError("Formula length is invalid", 0);
  return new Parser(source, context).parse();
}

export function evaluateNumericFormula(source: string, context: FormulaContext): number {
  const result = evaluateFormula(source, context);
  if (typeof result !== "number") throw new FormulaError("Expected a numeric formula result", source.length);
  return result;
}

export function evaluateRequirement(source: string, context: FormulaContext): boolean {
  const result = evaluateFormula(source, context);
  if (typeof result !== "boolean") throw new FormulaError("Expected a boolean requirement result", source.length);
  return result;
}
