import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FLAGS: Record<string, string> = {
  GB: "🇬🇧", ENG: "🇬🇧", DE: "🇩🇪", GER: "🇩🇪", RU: "🇷🇺", FR: "🇫🇷",
  US: "🇺🇸", ES: "🇪🇸", PT: "🇵🇹", IT: "🇮🇹", PL: "🇵🇱", SE: "🇸🇪",
  NL: "🇳🇱", BR: "🇧🇷", CN: "🇨🇳", KR: "🇰🇷",
};

export function flag(country?: string | null): string {
  if (!country) return "🏳️";
  return FLAGS[country.toUpperCase()] ?? "🏳️";
}
