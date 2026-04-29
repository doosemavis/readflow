const HEADER_PATTERNS = [
  /^(chapter\s+[\divxlc]+[.:—\-\s]*.*)$/i,
  /^(part\s+[\divxlc]+[.:—\-\s]*.*)$/i,
  /^(section\s+[\divxlc]+[.:—\-\s]*.*)$/i,
  /^(prologue|epilogue|introduction|preface|foreword|afterword|conclusion|appendix\s*[\divxlc]*)$/i,
  /^(act\s+[\divxlc]+[.:—\-\s]*.*)$/i,
  /^#{1,3}\s+(.+)$/,
];

function isHeader(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return null;
  for (const pat of HEADER_PATTERNS) {
    const m = trimmed.match(pat);
    if (m) return m[1] || m[0];
  }
  if (trimmed.length > 2 && trimmed.length < 60 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && !/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function detectTextStructure(text) {
  const lines = text.split("\n");
  const sections = [];
  let currentTitle = null;
  let currentContent = [];
  let sectionNum = 0;

  const flush = () => {
    const content = currentContent.join("\n").trim();
    if (content) {
      sectionNum++;
      sections.push({ type: "chapter", title: currentTitle, number: sectionNum, content });
    }
    currentContent = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerText = isHeader(line);
    if (headerText && headerText === line.trim() && line.trim() === line.trim().toUpperCase()) {
      const prevBlank = i === 0 || !lines[i - 1].trim();
      const nextBlank = i === lines.length - 1 || !lines[i + 1]?.trim();
      if (prevBlank || nextBlank) {
        flush();
        currentTitle = headerText.charAt(0).toUpperCase() + headerText.slice(1).toLowerCase();
        continue;
      }
    } else if (headerText) {
      flush();
      currentTitle = headerText;
      continue;
    }
    currentContent.push(line);
  }
  flush();

  if (sections.length <= 1 && !sections[0]?.title) {
    return [{ type: "document", title: null, number: 1, content: text.trim() }];
  }
  return sections;
}

export function parseHTMLStructured(rawHtml) {
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  const body = doc.body;
  const sections = [];
  let currentTitle = null;
  let currentContent = [];
  let sectionNum = 0;

  const flush = () => {
    const text = currentContent.join("\n\n").trim();
    if (text) {
      sectionNum++;
      sections.push({ type: "section", title: currentTitle, number: sectionNum, content: text });
    }
    currentContent = [];
  };

  for (const node of body.children) {
    const tag = node.tagName.toLowerCase();
    if (/^h[1-3]$/.test(tag)) { flush(); currentTitle = node.textContent.trim(); }
    else { const txt = node.textContent.trim(); if (txt) currentContent.push(txt); }
  }
  flush();
  if (sections.length === 0) return detectTextStructure(body.innerText);
  return sections;
}
