import type { AromaCatalog } from './aroma';

// Issue #6, 2026-10-21. Codes, rather than translated labels, are persisted.
export const TASTING_CATALOG_VERSION = 2;
export type TastingCategory = 'whisky' | 'wine' | 'beer' | 'traditional';
export type NoteMode = 'light' | 'deep';
export const questionCounts: Record<TastingCategory, Record<NoteMode, number>> = {
  whisky: { light: 5, deep: 9 }, wine: { light: 5, deep: 11 },
  beer: { light: 5, deep: 10 }, traditional: { light: 5, deep: 8 },
};
export const aromaCatalogs = {
  whisky: {
    fruit: ['apple_pear', 'citrus', 'tropical', 'dried_fruit'],
    flower_herb: ['white_flower', 'honey_flower', 'grass', 'herb'],
    grain_malt: ['barley', 'malt', 'bread', 'biscuit'],
    sweet: ['vanilla', 'caramel', 'honey', 'chocolate'],
    wood_spice: ['oak', 'nuts', 'cinnamon', 'pepper'],
    peat_smoke: ['campfire', 'charcoal', 'smoke', 'seaweed', 'iodine', 'earth'],
  },
  wine: {
    fruit: ['berry_cherry', 'plum', 'apple_pear', 'citrus', 'tropical', 'dried_fruit'],
    flower: ['white_flower', 'rose', 'violet', 'dried_flower'],
    herb_grass: ['grass', 'mint', 'herb', 'bell_pepper'],
    wood_vanilla: ['vanilla', 'wood', 'toast', 'coconut'],
    spice: ['pepper', 'cinnamon', 'clove', 'licorice'],
    earthy: ['earth', 'mushroom', 'leaves', 'leather'],
  },
  beer: {
    malt_grain: ['bread', 'biscuit', 'grain', 'caramel'],
    hop: ['pine_resin', 'grass', 'herb', 'earth'],
    fruit: ['citrus', 'tropical', 'apple_pear', 'banana'],
    flower: ['white_flower', 'floral', 'dried_flower'],
    yeast_ferment: ['clove', 'pepper', 'dough', 'fermented'],
    roast: ['coffee', 'chocolate', 'roasted_grain', 'burnt'],
  },
  traditional: {
    rice_grain: ['rice', 'steamed_grain'], ferment: [],
    fruit: ['apple_pear', 'citrus', 'tropical', 'other_fruit'], flower_herb: [], nuts: [], wood: [],
  },
} as const satisfies Record<TastingCategory, AromaCatalog>;
