import { expect } from "./TestUtils";
import {
  tokenizeWelltale,
  highlightWelltale,
  WELLTALE_HIGHLIGHT_RULES,
  HighlightToken
} from "../lib/WelltaleSyntaxHighlighter";

function testBasicTokenization() {
  const code = '<p>Hello {{name}}</p>';
  const tokens = tokenizeWelltale(code);
  
  // Should have tokens for tag, variable, and punctuation
  const tagTokens = tokens.filter(t => t.type === 'tag');
  const variableTokens = tokens.filter(t => t.type === 'variable');
  const punctuationTokens = tokens.filter(t => t.type === 'punctuation');
  
  expect(tagTokens.length >= 1, true);
  expect(variableTokens.length, 1);
  expect(variableTokens[0].value, '{{name}}');
  
  console.log('✓ Basic tokenization test passed');
}

function testTemplateExpressions() {
  const code = '<p>Health: {$ health + 10 $}</p>';
  const tokens = tokenizeWelltale(code);
  
  const expressionTokens = tokens.filter(t => t.type === 'expression');
  expect(expressionTokens.length, 1);
  expect(expressionTokens[0].value, '{$ health + 10 $}');
  
  console.log('✓ Template expressions test passed');
}

function testAIPrompts() {
  const code = '<p>{% Describe a mysterious forest %}</p>';
  const tokens = tokenizeWelltale(code);
  
  const aiTokens = tokens.filter(t => t.type === 'ai-prompt');
  expect(aiTokens.length, 1);
  expect(aiTokens[0].value, '{% Describe a mysterious forest %}');
  
  console.log('✓ AI prompts test passed');
}

function testXMLAttributes() {
  const code = '<input name="playerName" type="text" />';
  const tokens = tokenizeWelltale(code);
  
  const attrNameTokens = tokens.filter(t => t.type === 'attr-name');
  const attrValueTokens = tokens.filter(t => t.type === 'attr-value');
  
  expect(attrNameTokens.length >= 2, true);
  expect(attrValueTokens.length >= 2, true);
  
  // Check that we have the right attribute names
  const attrNames = attrNameTokens.map(t => t.value);
  expect(attrNames.includes('name'), true);
  expect(attrNames.includes('type'), true);
  
  console.log('✓ XML attributes test passed');
}

function testComments() {
  const code = '<!-- This is a comment --><p>Hello</p>';
  const tokens = tokenizeWelltale(code);
  
  const commentTokens = tokens.filter(t => t.type === 'comment');
  expect(commentTokens.length, 1);
  expect(commentTokens[0].value, '<!-- This is a comment -->');
  
  console.log('✓ Comments test passed');
}

function testComplexExample() {
  const code = `<!-- Character dialogue macro -->
<macro match="alex">
  <rename to="p" />
  <set attr="from" value="Alex" />
  <set attr="voice" value="{{alexVoice}}" />
</macro>

<var name="health" value="100" type="number" />
<p>Your health is {{health}} ({$ Math.round(health/100 * 100) $}%)</p>

<if cond="health > 50">
  <p>{% Describe how the character feels when healthy %}</p>
</if>`;

  const tokens = tokenizeWelltale(code);
  
  // Count different token types
  const tokenCounts = tokens.reduce((acc, token) => {
    acc[token.type] = (acc[token.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  expect(tokenCounts.comment || 0, 1);
  expect((tokenCounts.tag || 0) > 5, true);
  expect((tokenCounts.variable || 0) >= 2, true);
  expect((tokenCounts.expression || 0) >= 1, true);
  expect((tokenCounts['ai-prompt'] || 0) >= 1, true);
  expect((tokenCounts['attr-name'] || 0) >= 3, true);
  expect((tokenCounts['attr-value'] || 0) >= 3, true);
  
  console.log('✓ Complex example test passed');
}

function testHTMLGeneration() {
  const code = '<p>Hello {{name}}</p>';
  const html = highlightWelltale(code);
  
  // Should contain proper HTML with token classes
  expect(html.includes('<span class="token tag">'), true);
  expect(html.includes('<span class="token variable">{{name}}</span>'), true);
  expect(html.includes('&lt;'), true);
  expect(html.includes('&gt;'), true);
  
  console.log('✓ HTML generation test passed');
}

function testSpacePreservation() {
  const code = '<var name="playerName" value="Alex" />';
  const html = highlightWelltale(code);
  
  // Should preserve spaces between attributes
  expect(html.includes(' <span class="token attr-name">name</span>'), true);
  expect(html.includes(' <span class="token attr-name">value</span>'), true);
  // Should have spaces between attribute components and proper escaping
  expect(html.includes('<span class="token punctuation">=</span><span class="token attr-value">&quot;Alex&quot;</span>'), true);
  
  console.log('✓ Space preservation test passed');
}

function testEdgeCases() {
  // Empty string
  let tokens = tokenizeWelltale('');
  expect(tokens.length, 0);
  
  // Nested templates
  const nestedCode = '<p>{{player.stats.health}}</p>';
  tokens = tokenizeWelltale(nestedCode);
  const variableTokens = tokens.filter(t => t.type === 'variable');
  expect(variableTokens.length, 1);
  expect(variableTokens[0].value, '{{player.stats.health}}');
  
  // Self-closing tags
  const selfClosingCode = '<input name="test" />';
  tokens = tokenizeWelltale(selfClosingCode);
  const tagTokens = tokens.filter(t => t.type === 'tag');
  expect(tagTokens.length >= 1, true);
  
  console.log('✓ Edge cases test passed');
}

function testTokenOverlaps() {
  // Test that tokens don't overlap incorrectly
  const code = '<p attr="{{value}}">Text</p>';
  const tokens = tokenizeWelltale(code);
  
  // Sort tokens by start position
  const sortedTokens = tokens.sort((a, b) => a.start - b.start);
  
  // Check no overlaps
  for (let i = 0; i < sortedTokens.length - 1; i++) {
    const current = sortedTokens[i];
    const next = sortedTokens[i + 1];
    expect(current.end <= next.start, true);
  }
  
  console.log('✓ Token overlaps test passed');
}

async function runAllTests() {
  console.log('Running Welltale Syntax Highlighter tests...\n');
  
  testBasicTokenization();
  testTemplateExpressions();
  testAIPrompts();
  testXMLAttributes();
  testComments();
  testComplexExample();
  testHTMLGeneration();
  testSpacePreservation();
  testEdgeCases();
  testTokenOverlaps();
  
  console.log('\n✓ All syntax highlighter tests passed!');
}

runAllTests().catch(console.error);