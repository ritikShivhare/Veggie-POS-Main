import React from "react";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  const lines = content.split("\n");

  return (
    <div className="space-y-4 font-sans text-slate-800 text-sm leading-relaxed select-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // 1. Empty lines
        if (trimmed === "") {
          return <div key={idx} className="h-2" />;
        }

        // 2. Heading 1 (#)
        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={idx} className="text-xl font-display font-bold text-slate-900 tracking-tight pt-4 pb-1 border-b border-slate-200">
              {trimmed.substring(2)}
            </h1>
          );
        }

        // 3. Heading 2 (##)
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={idx} className="text-lg font-display font-semibold text-emerald-800 tracking-tight pt-3 pb-1">
              {trimmed.substring(3)}
            </h2>
          );
        }

        // 4. Heading 3 (###)
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-base font-display font-semibold text-slate-900 tracking-tight pt-3 pb-1 border-b border-slate-100">
              {trimmed.substring(4)}
            </h3>
          );
        }

        // 5. Bullet List items (*)
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          const itemText = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start space-x-2 pl-2">
              <span className="text-emerald-600 font-bold shrink-0 mt-1">•</span>
              <p className="flex-1">{parseInlineFormatting(itemText)}</p>
            </div>
          );
        }

        // 6. Numbered lists (e.g. 1. , 2.)
        const numListMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numListMatch) {
          const num = numListMatch[1];
          const text = numListMatch[2];
          return (
            <div key={idx} className="flex items-start space-x-2 pl-2">
              <span className="text-emerald-700 font-mono font-bold shrink-0">{num}.</span>
              <p className="flex-1">{parseInlineFormatting(text)}</p>
            </div>
          );
        }

        // 7. Regular paragraph
        return (
          <p key={idx} className="text-slate-700">
            {parseInlineFormatting(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

// Simple function to parse bold **text** in-line with exceptional contrast
function parseInlineFormatting(text: string): React.ReactNode {
  if (!text.includes("**")) return text;

  const parts = text.split("**");
  return parts.map((part, index) => {
    // Odd indexes correspond to bold segments
    if (index % 2 === 1) {
      const isCritical = part.toLowerCase().includes("critical") || part.toLowerCase().includes("warning") || part.toLowerCase().includes("low!");
      const isHighlight = part.startsWith("INR") || part.match(/^\d+$/) || part.includes("%");

      let badgeClasses = "font-bold text-emerald-800 bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-200/50 text-xs mx-0.5";
      if (isCritical) {
        badgeClasses = "font-bold text-rose-800 bg-rose-50/80 px-1.5 py-0.5 rounded border border-rose-200/50 text-xs mx-0.5";
      } else if (isHighlight) {
        badgeClasses = "font-bold text-blue-800 bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-200/50 text-xs mx-0.5";
      }

      return (
        <strong key={index} className={badgeClasses}>
          {part}
        </strong>
      );
    }
    return part;
  });
}
