'use client';

import { useTheme } from 'next-themes';

interface FormattedMessageProps {
  content: string;
  sources?: string;
}

export function FormattedMessage({ content, sources }: FormattedMessageProps) {
  const { theme, systemTheme } = useTheme();
  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  // Parse sources if provided
  let parsedSources: string[] = [];
  if (sources) {
    try {
      parsedSources = JSON.parse(sources);
    } catch {
      // If not JSON, treat as comma-separated
      parsedSources = sources.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  return (
    <div className="w-full">
      {/* Plain text message - no markdown, no formatting, just like iMessage */}
      <div className="whitespace-pre-wrap leading-[1.4]">
        {content}
      </div>

      {/* Sources Section - Subtle and clean like iMessage */}
      {parsedSources.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-white/15">
          <div className="text-[10px] font-medium text-white/50 mb-1.5 uppercase tracking-wider">
            Sources
          </div>
          <div className="flex flex-wrap gap-1.5">
            {parsedSources.map((source, index) => (
              <div
                key={index}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-sm text-[11px] text-white/80"
              >
                <svg className="h-2.5 w-2.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate max-w-[200px]">{source}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
