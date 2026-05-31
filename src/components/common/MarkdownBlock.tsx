import type { ReactNode } from "react";

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function flushList(items: string[], blocks: ReactNode[]) {
  if (items.length === 0) return;

  blocks.push(
    <ul key={`list-${blocks.length}`}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{renderInline(item)}</li>
      ))}
    </ul>
  );
  items.length = 0;
}

export function MarkdownBlock({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const listItems: string[] = [];
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList(listItems, blocks);
      continue;
    }

    if (/^-{3,}$/.test(line)) {
      flushList(listItems, blocks);
      blocks.push(<hr key={`hr-${blocks.length}`} />);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList(listItems, blocks);
      const level = heading[1].length;
      const children = renderInline(heading[2]);

      if (level === 1) blocks.push(<h2 key={`h-${blocks.length}`}>{children}</h2>);
      else if (level === 2) blocks.push(<h3 key={`h-${blocks.length}`}>{children}</h3>);
      else blocks.push(<h4 key={`h-${blocks.length}`}>{children}</h4>);
      continue;
    }

    if (line.startsWith(">")) {
      flushList(listItems, blocks);
      blocks.push(<blockquote key={`q-${blocks.length}`}>{renderInline(line.replace(/^>\s?/, ""))}</blockquote>);
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      listItems.push(listItem[1]);
      continue;
    }

    flushList(listItems, blocks);
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line)}</p>);
  }

  flushList(listItems, blocks);

  return <div className="markdown-block">{blocks}</div>;
}
