export type TokenType =
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "function"
  | "builtin"
  | "boolean"
  | "operator"
  | "punctuation"
  | "plain"

export interface Token {
  type: TokenType
  value: string
}

// Regex patterns for code block detection
export const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g

// Regex patterns for plot data detection
export const PLOT_DATA_REGEX = /\[PLOT_DATA\]([\s\S]*?)\[\/PLOT_DATA\]/

// Language-specific keyword patterns
export const KEYWORDS: Record<string, RegExp> = {
  javascript: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of)\b/,
  typescript: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|type|interface|enum|implements|private|public|protected|readonly|static|abstract|as|is)\b/,
  python: /\b(def|class|if|elif|else|for|while|try|except|finally|with|return|import|from|as|pass|break|continue|raise|yield|lambda|and|or|not|in|is)\b/,
  sql: /\b(SELECT|FROM|WHERE|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|DISTINCT|NULL|NOT|IN|LIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END)\b/i,
  bash: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|cd|ls|pwd|mkdir|rm|cp|mv|cat|grep|sed|awk|export|source)\b/,
}

// Language-specific builtin patterns
export const BUILTINS: Record<string, RegExp> = {
  javascript: /\b(console|Math|Array|Object|String|Number|Boolean|Date|JSON|Promise|Map|Set|RegExp|Error|parseInt|parseFloat|isNaN|isFinite)\b/,
  typescript: /\b(console|Math|Array|Object|String|Number|Boolean|Date|JSON|Promise|Map|Set|RegExp|Error|Record|Partial|Required|Pick|Omit|Exclude|Extract)\b/,
  python: /\b(print|len|range|str|int|float|list|dict|tuple|set|open|input|True|False|None)\b/,
  sql: /\b(COUNT|SUM|AVG|MAX|MIN|COALESCE|CAST|CONVERT)\b/i,
  bash: /\b(true|false)\b/,
}

// Boolean/null patterns
export const BOOLEANS_REGEX = /\b(true|false|null|undefined|NaN|Infinity|True|False|None)\b/

// Common patterns
export const PATTERNS = {
  singleLineComment: /^(\/\/.*|#.*|--.*)/,
  string: /^(['"`])(?:\\.|[^\\])*?\1/,
  number: /^\b\d+\.?\d*\b/,
  functionCall: /^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/,
  operator: /^(===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%=<>!&|^~])/,
  punctuation: /^[{}[\]();:,.]/,
  plainText: /^(\s+|[a-zA-Z_$][a-zA-Z0-9_$]*|.)/,
}

// Token color classes
export const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: "text-pink-400",
  string: "text-emerald-400",
  number: "text-amber-400",
  comment: "text-neutral-500 italic",
  function: "text-blue-400",
  builtin: "text-yellow-400",
  boolean: "text-amber-400",
  operator: "text-neutral-300",
  punctuation: "text-neutral-400",
  plain: "text-neutral-200",
}

export function tokenize(code: string, language: string): Token[] {
  const tokens: Token[] = []

  const lang = language.toLowerCase()
  const keywordRegex = KEYWORDS[lang] || KEYWORDS.javascript
  const builtinRegex = BUILTINS[lang] || BUILTINS.javascript

  const lines = code.split("\n")

  lines.forEach((line, lineIndex) => {
    let remaining = line

    while (remaining.length > 0) {
      let matched = false

      // Check for single-line comments
      const commentMatch = remaining.match(PATTERNS.singleLineComment)
      if (commentMatch) {
        tokens.push({ type: "comment", value: commentMatch[0] })
        remaining = remaining.slice(commentMatch[0].length)
        matched = true
        continue
      }

      // Check for strings
      const stringMatch = remaining.match(PATTERNS.string)
      if (stringMatch) {
        tokens.push({ type: "string", value: stringMatch[0] })
        remaining = remaining.slice(stringMatch[0].length)
        matched = true
        continue
      }

      // Check for numbers
      const numberMatch = remaining.match(PATTERNS.number)
      if (numberMatch) {
        tokens.push({ type: "number", value: numberMatch[0] })
        remaining = remaining.slice(numberMatch[0].length)
        matched = true
        continue
      }

      // Check for keywords
      const keywordMatch = remaining.match(new RegExp(`^${keywordRegex.source}`))
      if (keywordMatch) {
        tokens.push({ type: "keyword", value: keywordMatch[0] })
        remaining = remaining.slice(keywordMatch[0].length)
        matched = true
        continue
      }

      // Check for builtins
      const builtinMatch = remaining.match(new RegExp(`^${builtinRegex.source}`))
      if (builtinMatch) {
        tokens.push({ type: "builtin", value: builtinMatch[0] })
        remaining = remaining.slice(builtinMatch[0].length)
        matched = true
        continue
      }

      // Check for booleans
      const booleanMatch = remaining.match(new RegExp(`^${BOOLEANS_REGEX.source}`))
      if (booleanMatch) {
        tokens.push({ type: "boolean", value: booleanMatch[0] })
        remaining = remaining.slice(booleanMatch[0].length)
        matched = true
        continue
      }

      // Check for function calls
      const funcMatch = remaining.match(PATTERNS.functionCall)
      if (funcMatch) {
        tokens.push({ type: "function", value: funcMatch[1] })
        remaining = remaining.slice(funcMatch[1].length)
        matched = true
        continue
      }

      // Check for operators
      const operatorMatch = remaining.match(PATTERNS.operator)
      if (operatorMatch) {
        tokens.push({ type: "operator", value: operatorMatch[0] })
        remaining = remaining.slice(operatorMatch[0].length)
        matched = true
        continue
      }

      // Check for punctuation
      const punctMatch = remaining.match(PATTERNS.punctuation)
      if (punctMatch) {
        tokens.push({ type: "punctuation", value: punctMatch[0] })
        remaining = remaining.slice(punctMatch[0].length)
        matched = true
        continue
      }

      // Plain text (identifiers, whitespace, etc)
      if (!matched) {
        const plainMatch = remaining.match(PATTERNS.plainText)
        if (plainMatch) {
          tokens.push({ type: "plain", value: plainMatch[0] })
          remaining = remaining.slice(plainMatch[0].length)
        } else {
          tokens.push({ type: "plain", value: remaining[0] })
          remaining = remaining.slice(1)
        }
      }
    }

    // Add newline between lines (except last line)
    if (lineIndex < lines.length - 1) {
      tokens.push({ type: "plain", value: "\n" })
    }
  })

  return tokens
}
