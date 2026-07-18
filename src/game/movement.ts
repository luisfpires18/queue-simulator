// Party-wide movement-speed cooldowns.

export interface MovementDef {
  id: string;
  name: string;
  short: string;
  icon: string; // spell icon slug
  description: string; // tooltip text
  requiresTalent?: boolean; // player must have selected this talent — not guaranteed just by spec
  providerSpecs: string[];
}

export const MOVEMENT: MovementDef[] = [
  { id: "stampedingroar", name: "Stampeding Roar", short: "Stampeding Roar", icon: "spell_druid_stampedingroar_cat", description: "Balance/Feral/Guardian/Restoration Druid. Increases nearby party members' movement speed by 60% for 8 seconds. Baseline.", providerSpecs: ["druid:balance", "druid:feral", "druid:guardian", "druid:restoration"] },
  { id: "windrushtotem", name: "Wind Rush Totem", short: "Wind Rush Totem", icon: "ability_shaman_windwalktotem", description: "Elemental/Enhancement/Restoration Shaman. Allies passing near the totem gain 40% movement speed for 5 seconds; the totem lasts 15 seconds.", requiresTalent: true, providerSpecs: ["shaman:elemental", "shaman:enhancement", "shaman:restoration"] },
  { id: "timespiral", name: "Time Spiral", short: "Time Spiral", icon: "ability_evoker_timespiral", description: "Augmentation/Devastation/Preservation Evoker. Allows the party to use its major movement abilities once during the next 10 seconds, even if they are already on cooldown.", requiresTalent: true, providerSpecs: ["evoker:augmentation", "evoker:devastation", "evoker:preservation"] },
];

export const MOVEMENT_BY_ID: Record<string, MovementDef> = Object.fromEntries(
  MOVEMENT.map((d) => [d.id, d])
);
