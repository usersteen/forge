function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text) {
  return escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function flushParagraph(lines, output) {
  if (lines.length === 0) return;
  output.push(`<p>${lines.map((line) => renderInline(line)).join(" ")}</p>`);
  lines.length = 0;
}

function flushList(listType, items, output) {
  if (!listType || items.length === 0) return;
  const tag = listType === "ordered" ? "ol" : "ul";
  output.push(`<${tag}>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${tag}>`);
  items.length = 0;
}

export function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  const paragraph = [];
  const listItems = [];
  let listType = null;
  let inCodeBlock = false;
  let codeLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      flushParagraph(paragraph, output);
      flushList(listType, listItems, output);
      if (inCodeBlock) {
        output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line) {
      flushParagraph(paragraph, output);
      flushList(listType, listItems, output);
      listType = null;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph(paragraph, output);
      flushList(listType, listItems, output);
      listType = null;
      output.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph(paragraph, output);
      flushList(listType, listItems, output);
      listType = null;
      output.push("<hr />");
      continue;
    }

    const blockquote = line.match(/^>\s?(.*)$/);
    if (blockquote) {
      flushParagraph(paragraph, output);
      flushList(listType, listItems, output);
      listType = null;
      output.push(`<blockquote>${renderInline(blockquote[1])}</blockquote>`);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      flushParagraph(paragraph, output);
      if (listType && listType !== "ordered") {
        flushList(listType, listItems, output);
      }
      listType = "ordered";
      listItems.push(ordered[1]);
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph(paragraph, output);
      if (listType && listType !== "unordered") {
        flushList(listType, listItems, output);
      }
      listType = "unordered";
      listItems.push(bullet[1]);
      continue;
    }

    if (listType) {
      flushList(listType, listItems, output);
      listType = null;
    }

    paragraph.push(line);
  }

  if (inCodeBlock) {
    output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  flushParagraph(paragraph, output);
  flushList(listType, listItems, output);
  return output.join("");
}
