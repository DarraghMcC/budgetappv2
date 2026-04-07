export function applyRules(
  description: string,
  rules: Array<{ pattern: string; category: string }>,
): string {
  const lower = description.toLowerCase();
  for (const rule of rules) {
    if (rule.pattern && lower.includes(rule.pattern.toLowerCase())) {
      return rule.category;
    }
  }
  return '';
}
