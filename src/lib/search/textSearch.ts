function codePointBefore(text: string, index: number): string {
  if (index <= 0) return '';
  const trailingUnit = text.charCodeAt(index - 1);
  const start =
    trailingUnit >= 0xdc00 && trailingUnit <= 0xdfff && index > 1 ? index - 2 : index - 1;
  const codePoint = text.codePointAt(start);
  return codePoint === undefined ? '' : String.fromCodePoint(codePoint);
}

function codePointAt(text: string, index: number): string {
  if (index >= text.length) return '';
  const codePoint = text.codePointAt(index);
  return codePoint === undefined ? '' : String.fromCodePoint(codePoint);
}

function isWordCharacter(character: string): boolean {
  return character !== '' && /[\p{Letter}\p{Number}_]/u.test(character);
}

/** 全词匹配以 Unicode 字母、数字和下划线作为单词字符边界。 */
export function isWholeWordRange(text: string, from: number, to: number): boolean {
  return !isWordCharacter(codePointBefore(text, from)) && !isWordCharacter(codePointAt(text, to));
}
