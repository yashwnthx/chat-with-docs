'use client';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';

interface FormattedMessageProps {
  content: string;
}

export function FormattedMessage({ content }: FormattedMessageProps) {
  const { theme, systemTheme } = useTheme();
  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  // Custom light theme based on VS Code light
  const lightTheme = {
    'code[class*="language-"]': {
      color: '#383a42',
      background: 'none',
      fontFamily: '"Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
      fontSize: '0.875rem',
      textAlign: 'left' as const,
      whiteSpace: 'pre' as const,
      wordSpacing: 'normal',
      wordBreak: 'normal' as const,
      wordWrap: 'normal' as const,
      lineHeight: '1.5',
      tabSize: 2,
      hyphens: 'none' as const,
    },
    'pre[class*="language-"]': {
      color: '#383a42',
      background: '#fafafa',
      fontFamily: '"Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
      fontSize: '0.875rem',
      textAlign: 'left' as const,
      whiteSpace: 'pre' as const,
      wordSpacing: 'normal',
      wordBreak: 'normal' as const,
      wordWrap: 'normal' as const,
      lineHeight: '1.5',
      tabSize: 2,
      hyphens: 'none' as const,
      padding: '1em',
      margin: '0.5em 0',
      overflow: 'auto',
      borderRadius: '0.5rem',
      border: '1px solid #e5e7eb',
    },
    'comment': { color: '#a0a1a7', fontStyle: 'italic' },
    'prolog': { color: '#a0a1a7' },
    'doctype': { color: '#a0a1a7' },
    'cdata': { color: '#a0a1a7' },
    'punctuation': { color: '#383a42' },
    'property': { color: '#e45649' },
    'tag': { color: '#e45649' },
    'boolean': { color: '#986801' },
    'number': { color: '#986801' },
    'constant': { color: '#986801' },
    'symbol': { color: '#e45649' },
    'deleted': { color: '#e45649' },
    'selector': { color: '#50a14f' },
    'attr-name': { color: '#986801' },
    'string': { color: '#50a14f' },
    'char': { color: '#50a14f' },
    'builtin': { color: '#c18401' },
    'inserted': { color: '#50a14f' },
    'operator': { color: '#383a42' },
    'entity': { color: '#4078f2', cursor: 'help' },
    'url': { color: '#0184bc' },
    '.language-css .token.string': { color: '#0184bc' },
    '.style .token.string': { color: '#0184bc' },
    'atrule': { color: '#c18401' },
    'attr-value': { color: '#50a14f' },
    'keyword': { color: '#a626a4' },
    'function': { color: '#4078f2' },
    'class-name': { color: '#c18401' },
    'regex': { color: '#e45649' },
    'important': { color: '#e45649', fontWeight: 'bold' },
    'variable': { color: '#e45649' },
  };

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const inline = !match;
            return !inline && match ? (
              <div className="relative group/code">
                <SyntaxHighlighter
                  {...props}
                  style={effectiveTheme === 'dark' ? vscDarkPlus : lightTheme}
                  language={match[1]}
                  PreTag="div"
                  className="rounded-lg my-2 shadow-sm"
                  showLineNumbers={true}
                  wrapLines={true}
                  customStyle={{
                    margin: '0.5rem 0',
                    padding: '1rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                  }}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
                {/* Language badge */}
                <div className="absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded bg-background/80 backdrop-blur-sm text-muted-foreground uppercase tracking-wide opacity-0 group-hover/code:opacity-100 transition-opacity">
                  {match[1]}
                </div>
              </div>
            ) : (
              <code
                {...props}
                className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="ml-2">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold mb-2 mt-4">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-bold mb-1 mt-2">{children}</h3>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-muted pl-4 italic my-2">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0A7CFF] hover:underline"
              >
                {children}
              </a>
            );
          },
          strong({ children }) {
            return <strong className="font-bold">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic">{children}</em>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

