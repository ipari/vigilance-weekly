const namedEntities: Record<string, string> = {
  nbsp: " ",
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&(nbsp|lt|gt|amp|quot|apos);/gi, (_, name: string) =>
      namedEntities[name.toLocaleLowerCase()] ?? _,
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      fromCodePoint(Number.parseInt(code, 10)),
    );
}

function fromCodePoint(code: number) {
  if (code === 160) return " ";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "�";
  }
}
