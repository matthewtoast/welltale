/**
 * Welltale DSL Syntax Highlighter
 * 
 * Provides syntax highlighting for the Welltale story DSL with support for:
 * - XML tags and attributes
 * - Template variables {{var}}
 * - Template expressions {$ expr $}
 * - Template AI prompts {% prompt %}
 * - Comments and other elements
 * 
 * Can be used for web highlighting and exported to VS Code extensions.
 */

export interface HighlightToken {
  type: 'tag' | 'attr-name' | 'attr-value' | 'punctuation' | 'variable' | 'expression' | 'ai-prompt' | 'comment' | 'text';
  value: string;
  start: number;
  end: number;
}

export interface HighlightRule {
  name: string;
  pattern: RegExp;
  tokenType: HighlightToken['type'];
}

export const WELLTALE_HIGHLIGHT_RULES: HighlightRule[] = [
  // Comments (highest priority - process first)
  {
    name: 'comment',
    pattern: /<!--[\s\S]*?-->/g,
    tokenType: 'comment'
  },
  
  // Template syntax (before XML to avoid conflicts)
  {
    name: 'ai-prompt',
    pattern: /\{\%[\s\S]*?\%\}/g,
    tokenType: 'ai-prompt'
  },
  {
    name: 'expression',
    pattern: /\{\$[\s\S]*?\$\}/g,
    tokenType: 'expression'
  },
  {
    name: 'variable',
    pattern: /\{\{[^}]*\}\}/g,
    tokenType: 'variable'
  },
  
  // XML structure - process in specific order to handle overlaps
  {
    name: 'tag',
    pattern: /<\/?[a-zA-Z][a-zA-Z0-9\-:]*(?=[\s>\/])/g,
    tokenType: 'tag'
  },
  {
    name: 'attr-value',
    pattern: /"[^"]*"/g,
    tokenType: 'attr-value'
  },
  {
    name: 'attr-name', 
    pattern: /\s([a-zA-Z][a-zA-Z0-9\-:.]*?)(?==)/g,
    tokenType: 'attr-name'
  },
  {
    name: 'punctuation',
    pattern: /[<>\/=]/g,
    tokenType: 'punctuation'
  }
];

export function tokenizeWelltale(code: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  const processed = new Set<string>(); // Track processed character ranges
  
  // Process rules in order of priority
  for (const rule of WELLTALE_HIGHLIGHT_RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match;
    
    while ((match = regex.exec(code)) !== null) {
      let start = match.index;
      let end = start + match[0].length;
      const rangeKey = `${start}-${end}`;
      
      // Skip if this range was already processed by higher priority rule
      if (processed.has(rangeKey)) {
        continue;
      }
      
      // Check for overlaps with existing tokens
      const hasOverlap = tokens.some(token => 
        (start < token.end && end > token.start)
      );
      
      if (!hasOverlap) {
        let value = match[0];
        
        // For attribute names, extract just the name part (without leading space)
        if (rule.tokenType === 'attr-name' && match[1]) {
          value = match[1];
          // Adjust start position to skip the leading space
          start = match.index + match[0].indexOf(match[1]);
          end = start + value.length;
        }
        
        tokens.push({
          type: rule.tokenType,
          value,
          start,
          end
        });
        
        processed.add(rangeKey);
      }
    }
  }
  
  return tokens.sort((a, b) => a.start - b.start);
}

export function highlightToHtml(code: string, tokens: HighlightToken[]): string {
  let result = '';
  let lastIndex = 0;
  
  for (const token of tokens) {
    // Add any text before this token
    if (token.start > lastIndex) {
      const text = code.slice(lastIndex, token.start);
      result += escapeHtml(text);
    }
    
    // Add the highlighted token
    const tokenValue = escapeHtml(token.value);
    result += `<span class="token ${token.type}">${tokenValue}</span>`;
    
    // Use the actual token's end position, not the value length
    lastIndex = token.end;
  }
  
  // Add any remaining text
  if (lastIndex < code.length) {
    result += escapeHtml(code.slice(lastIndex));
  }
  
  return result;
}

export function highlightWelltale(code: string): string {
  const tokens = tokenizeWelltale(code);
  return highlightToHtml(code, tokens);
}

// VS Code language definition export
export function generateVSCodeLanguageDefinition() {
  return {
    $schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
    name: "Welltale",
    patterns: [
      {
        name: "comment.block.welltale",
        begin: "<!--",
        end: "-->",
        patterns: [
          {
            name: "invalid.deprecated.welltale",
            match: "<!--|-->"
          }
        ]
      },
      {
        name: "meta.template.ai-prompt.welltale",
        begin: "\\{%",
        end: "%\\}",
        beginCaptures: {
          "0": { name: "punctuation.definition.template.begin.welltale" }
        },
        endCaptures: {
          "0": { name: "punctuation.definition.template.end.welltale" }
        },
        patterns: [
          {
            name: "string.unquoted.ai-prompt.welltale",
            match: "[^%]+"
          }
        ]
      },
      {
        name: "meta.template.expression.welltale",
        begin: "\\{\\$",
        end: "\\$\\}",
        beginCaptures: {
          "0": { name: "punctuation.definition.template.begin.welltale" }
        },
        endCaptures: {
          "0": { name: "punctuation.definition.template.end.welltale" }
        },
        patterns: [
          {
            name: "source.js.embedded.welltale",
            match: "[^$]+"
          }
        ]
      },
      {
        name: "meta.template.variable.welltale",
        begin: "\\{\\{",
        end: "\\}\\}",
        beginCaptures: {
          "0": { name: "punctuation.definition.template.begin.welltale" }
        },
        endCaptures: {
          "0": { name: "punctuation.definition.template.end.welltale" }
        },
        patterns: [
          {
            name: "variable.other.welltale",
            match: "[^}]+"
          }
        ]
      },
      {
        name: "meta.tag.welltale",
        begin: "(<)([a-zA-Z][a-zA-Z0-9\\-:]*)",
        end: "(>)",
        beginCaptures: {
          "1": { name: "punctuation.definition.tag.begin.welltale" },
          "2": { name: "entity.name.tag.welltale" }
        },
        endCaptures: {
          "1": { name: "punctuation.definition.tag.end.welltale" }
        },
        patterns: [
          {
            name: "entity.other.attribute-name.welltale",
            match: "\\b[a-zA-Z][a-zA-Z0-9\\-:.]*(?==)"
          },
          {
            name: "string.quoted.double.welltale",
            begin: "\"",
            end: "\"",
            patterns: [
              {
                include: "#template-content"
              }
            ]
          }
        ]
      }
    ],
    repository: {
      "template-content": {
        patterns: [
          { include: "#ai-prompt" },
          { include: "#expression" },
          { include: "#variable" }
        ]
      }
    },
    scopeName: "source.welltale"
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}