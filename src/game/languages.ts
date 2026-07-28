// Spoken languages a team can list, sorted alphabetically by English name.
// Deliberately a short curated list rather than every ISO 639-1 code: this is
// "what language is voice chat in", so it covers the languages WoW's EU/US
// realms actually organise around, plus an "Other" escape hatch for anything
// a team can spell out in its description.
//
// Codes are ISO 639-1 (two-letter), so they stay stable if this ever needs to
// drive anything beyond a label.

export interface Language {
  code: string;
  name: string;
}

export const LANGUAGES: Language[] = [
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "en", name: "English" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "hu", name: "Hungarian" },
  { code: "it", name: "Italian" },
  { code: "nb", name: "Norwegian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "es", name: "Spanish" },
  { code: "sv", name: "Swedish" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "xx", name: "Other" },
];

export function languageByCode(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export function isLanguageCode(value: unknown): value is string {
  return typeof value === "string" && LANGUAGES.some((l) => l.code === value);
}
