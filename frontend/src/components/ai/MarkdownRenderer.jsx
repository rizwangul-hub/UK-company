import React from 'react';

function renderInline(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 text-indigo-700 text-[12px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function MarkdownRenderer({ content }) {
  const lines = String(content || '').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect Markdown table
    if (
      line.trim().startsWith('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]+\|/.test(lines[i + 1])
    ) {
      const headerCells = line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rowCells = lines[i]
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
        rows.push(rowCells);
        i++;
      }
      blocks.push({ type: 'table', headerCells, rows });
      continue;
    }

    // Headings
    if (/^###\s+/.test(line)) {
      blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '') });
      i++;
      continue;
    }
    if (/^##\s+/.test(line)) {
      blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '') });
      i++;
      continue;
    }
    if (/^#\s+/.test(line)) {
      blocks.push({ type: 'h1', text: line.replace(/^#\s+/, '') });
      i++;
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    blocks.push({ type: 'p', text: line });
    i++;
  }

  return (
    <div className="space-y-2.5 text-[13.5px] leading-relaxed text-slate-700">
      {blocks.map((b, idx) => {
        if (b.type === 'h1') {
          return (
            <h1 key={idx} className="text-base font-bold text-slate-900 pt-1">
              {renderInline(b.text)}
            </h1>
          );
        }
        if (b.type === 'h2') {
          return (
            <h2 key={idx} className="text-sm font-bold text-slate-900 pt-1">
              {renderInline(b.text)}
            </h2>
          );
        }
        if (b.type === 'h3') {
          return (
            <h3 key={idx} className="text-[13px] font-bold text-slate-800 pt-0.5">
              {renderInline(b.text)}
            </h3>
          );
        }
        if (b.type === 'ul') {
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1">
              {b.items.map((item, k) => (
                <li key={k}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === 'ol') {
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-1">
              {b.items.map((item, k) => (
                <li key={k}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        if (b.type === 'table') {
          return (
            <div key={idx} className="overflow-x-auto rounded-xl border border-slate-200 bg-white my-2">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {b.headerCells.map((h, k) => (
                      <th key={k} className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/70">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-slate-700 whitespace-nowrap tabular-nums">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={idx}>{renderInline(b.text)}</p>;
      })}
    </div>
  );
}

export default MarkdownRenderer;
