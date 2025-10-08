'use client';

import { useMemo } from 'react';
import { highlightWelltale } from '../../lib/WelltaleSyntaxHighlighter';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language = 'xml', className = '' }: CodeBlockProps) {
  const highlightedCode = useMemo(() => {
    if (language === 'xml' || language === 'welltale') {
      return highlightWelltale(code);
    }
    // For other languages, just escape HTML
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }, [code, language]);

  return (
    <pre className={`${className} language-${language}`}>
      <code 
        className={`language-${language}`}
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </pre>
  );
}