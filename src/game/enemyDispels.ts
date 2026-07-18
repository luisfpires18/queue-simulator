// Enemy magic dispels — removing a beneficial Magic effect (or Enrage) from
// an enemy, the opposite direction from dispels.ts (which helps allies).
import type { ClassId } from "./classes";

export interface EnemyDispelDef {
  id: string;
  name: string;
  short: string;
  icon: string; // spell icon slug
  description: string; // tooltip text
  requiresTalent?: boolean; // player must have selected this talent — not guaranteed just by spec
  providerClasses: ClassId[];
}

export const ENEMY_DISPELS: EnemyDispelDef[] = [
  { id: "purge", name: "Purge / Greater Purge", short: "Purge", icon: "spell_nature_purge", description: "Elemental/Enhancement/Restoration Shaman. Talent choice. Removes one beneficial Magic effect, or two with Greater Purge.", requiresTalent: true, providerClasses: ["shaman"] },
  { id: "consumemagic", name: "Consume Magic", short: "Consume Magic", icon: "spell_misc_zandalari_council_soulswap", description: "Havoc/Vengeance/Devourer Demon Hunter. Talent. Removes one beneficial Magic effect.", requiresTalent: true, providerClasses: ["demonhunter"] },
  { id: "spellsteal", name: "Spellsteal", short: "Spellsteal", icon: "spell_arcane_arcane02", description: "Arcane/Fire/Frost Mage. Talent. Removes and steals a beneficial Magic effect.", requiresTalent: true, providerClasses: ["mage"] },
  { id: "dispelmagic", name: "Dispel Magic", short: "Dispel Magic", icon: "spell_nature_nullifydisease", description: "Discipline/Holy/Shadow Priest. Removes one beneficial Magic effect.", providerClasses: ["priest"] },
  { id: "tranquilizingshot", name: "Tranquilizing Shot", short: "Tranq Shot", icon: "spell_nature_drowsy", description: "Beast Mastery/Marksmanship/Survival Hunter. Talent. Removes one Enrage and one beneficial Magic effect.", requiresTalent: true, providerClasses: ["hunter"] },
  { id: "devourmagic", name: "Devour Magic", short: "Devour Magic", icon: "spell_nature_purge", description: "Affliction/Demonology/Destruction Warlock. Available through a Felhunter, or through the Grimoire: Fel Ravager talent. Removes one beneficial Magic effect.", requiresTalent: true, providerClasses: ["warlock"] },
  { id: "soothe", name: "Soothe", short: "Soothe", icon: "ability_hunter_beastsoothe", description: "Balance/Feral/Guardian/Restoration Druid. Talent. Removes Enrage effects.", requiresTalent: true, providerClasses: ["druid"] },
  { id: "shiv", name: "Shiv", short: "Shiv", icon: "inv_throwingknife_04", description: "Assassination/Outlaw/Subtlety Rogue. Talent. Removes all Enrage effects.", requiresTalent: true, providerClasses: ["rogue"] },
  { id: "oppressingroar", name: "Oppressing Roar + Overawe", short: "Oppressing Roar", icon: "ability_evoker_oppressingroar", description: "Augmentation/Devastation/Preservation Evoker. Requires both talents and removes Enrage effects from enemies struck.", requiresTalent: true, providerClasses: ["evoker"] },
];

export const ENEMY_DISPEL_BY_ID: Record<string, EnemyDispelDef> = Object.fromEntries(
  ENEMY_DISPELS.map((d) => [d.id, d])
);
