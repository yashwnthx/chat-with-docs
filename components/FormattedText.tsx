'use client';

import React from 'react';

interface FormattedTextProps {
  content: string;
}

export function FormattedText({ content }: FormattedTextProps) {
  const renderContent = (text: string) => {
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => {
      const parts: React.ReactNode[] = [];
      let key = 0;

      // Collect all matches first
      const matches: Array<{ type: string; content: string; index: number; length: number }> = [];

      // Find bold patterns **text**
      const boldMatches = line.matchAll(/\*\*(.+?)\*\*/g);
      for (const match of boldMatches) {
        if (match.index !== undefined) {
          matches.push({
            type: 'bold',
            content: match[1],
            index: match.index,
            length: match[0].length
          });
        }
      }

      // Find italic patterns *text* (not part of bold)
      const italicMatches = line.matchAll(/\*(.+?)\*/g);
      for (const match of italicMatches) {
        if (match.index !== undefined) {
          // Skip if it's part of a bold pattern
          const isBold = matches.some(m =>
            m.type === 'bold' &&
            match.index! >= m.index &&
            match.index! < m.index + m.length
          );
          if (!isBold) {
            matches.push({
              type: 'italic',
              content: match[1],
              index: match.index,
              length: match[0].length
            });
          }
        }
      }

      // Find code patterns `text`
      const codeMatches = line.matchAll(/`(.+?)`/g);
      for (const match of codeMatches) {
        if (match.index !== undefined) {
          matches.push({
            type: 'code',
            content: match[1],
            index: match.index,
            length: match[0].length
          });
        }
      }

      // Sort matches by index
      matches.sort((a, b) => a.index - b.index);

      // Build the parts array
      let lastIndex = 0;
      matches.forEach((m) => {
        // Add text before this match
        if (m.index > lastIndex) {
          parts.push(line.substring(lastIndex, m.index));
        }

        // Add formatted element
        if (m.type === 'bold') {
          parts.push(<strong key={`${lineIndex}-${key++}`}>{m.content}</strong>);
        } else if (m.type === 'italic') {
          parts.push(<em key={`${lineIndex}-${key++}`}>{m.content}</em>);
        } else if (m.type === 'code') {
          parts.push(
            <code key={`${lineIndex}-${key++}`} className="bg-white/10 px-1 py-0.5 rounded text-[13px] font-mono">
              {m.content}
            </code>
          );
        }

        lastIndex = m.index + m.length;
      });

      // Add remaining text
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }

      // If no formatting was found, just use the original line
      if (parts.length === 0) {
        parts.push(line);
      }

      // Add line break after each line except the last
      return (
        <React.Fragment key={lineIndex}>
          {parts}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return <>{renderContent(content)}</>;
}
