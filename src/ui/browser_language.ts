/** First-visit language; URL and saved preferences remain authoritative. */
export function browserLanguage<T extends string>(supported: readonly T[], locales: readonly string[]): T {
  const regions: Record<string, string> = {
    cs: 'cs_CZ', da: 'da_DK', de: 'de_DE', fr: 'fr_FR', id: 'id_ID', it: 'it_IT',
    ja: 'ja_JP', ko: 'ko_KR', nl: 'nl_NL', pl: 'pl_PL', pt: 'pt_BR', ru: 'ru_RU',
    sv: 'sv_SE', tr: 'tr_TR', vi: 'vi_VN', zh: 'zh_CN',
  };
  for (const input of locales) {
    const parts = input.trim().split('.')[0].split('@')[0].replaceAll('-', '_').split('_').filter(Boolean);
    const language = parts[0]?.toLowerCase();
    if (!language) continue;
    const region = parts.find((part, index) => index > 0 && /^(?:[a-z]{2}|\d{3})$/i.test(part));
    const candidates = [region ? `${language}_${region.toUpperCase()}` : null, language, regions[language]];
    for (const candidate of candidates) {
      const match = supported.find((entry) => entry === candidate);
      if (match) return match;
    }
  }
  return supported.find((entry) => entry === 'de_DE') ?? supported[0];
}
