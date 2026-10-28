import {discoverDrinks,type DrinkHistory,type NextDrink} from './next-drinks-domain.ts';
import type {Product} from './product-catalog.ts';
import type {TasteSnapshot} from './taste-domain.ts';
export const WEEKLY_DISCOVERY_VERSION='weekly-selection-v1';
export type WeeklySelection={version:typeof WEEKLY_DISCOVERY_VERSION;productIds:string[]};
/** The model may select supplied candidates; product facts and evidence stay server-derived. */
export function validateWeeklySelection(value:unknown,eligible:readonly NextDrink[]):WeeklySelection{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_WEEKLY_SELECTION');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['version','productIds'].includes(k))||v.version!==WEEKLY_DISCOVERY_VERSION||!Array.isArray(v.productIds)||v.productIds.length<1||v.productIds.length>24||new Set(v.productIds).size!==v.productIds.length)throw Error('INVALID_WEEKLY_SELECTION');
 const allowed=new Set(eligible.map(r=>r.product.id));
 if(v.productIds.some(id=>typeof id!=='string'||!allowed.has(id)))throw Error('UNSUPPORTED_WEEKLY_PRODUCT');
 return {version:WEEKLY_DISCOVERY_VERSION,productIds:[...v.productIds] as string[]};
}
/** Cache is only a selection receipt, never a source of old facts or old personal evidence. */
export function restoreWeeklyDrinks(value:unknown,snapshot:TasteSnapshot,history:DrinkHistory[],excluded:ReadonlySet<string>,catalog:readonly Product[],category:Product['category']|null=null):NextDrink[]{
 // Structural validation is separate from availability: a retired/saved product simply disappears.
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_WEEKLY_SELECTION');
 const v=value as WeeklySelection;
 if(Object.keys(v).some(k=>!['version','productIds'].includes(k))||v.version!==WEEKLY_DISCOVERY_VERSION||!Array.isArray(v.productIds)||v.productIds.length<1||v.productIds.length>24||v.productIds.some(id=>typeof id!=='string'||!id||id.length>200)||new Set(v.productIds).size!==v.productIds.length)throw Error('INVALID_WEEKLY_SELECTION');
 const current=new Map(discoverDrinks(snapshot,history,null,excluded,catalog).map(row=>[row.product.id,row]));
 return v.productIds.flatMap(id=>{const row=current.get(id);return row&&(!category||row.product.category===category)?[row]:[];});
}
