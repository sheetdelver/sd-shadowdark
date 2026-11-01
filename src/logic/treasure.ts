import { modifierErrors, applyTreasureModifiers, type TreasureModifier } from './treasure-modifiers';
import { utilityErrors, utilityImage, spellItemErrors, spellTier, isWeaponBase, partError, describePart, type UtilityRecipe, type SpellItemRecipe } from './treasure-procedures';
import { originalRow, type OriginalPart, type OriginalSource } from './original-tables';
import { slugify } from './foundry';
import { potionErrors, potionDescription, type PotionRecipe } from './potion-treasure';
import { armorErrors, applyArmorRecipe, type ArmorRecipe } from './armor-treasure';
import { isScroll } from './scrolls';
import { isWand } from './wands';
import { ownedCopy } from './identity';
import { NATIVE_PREDEFINED_EFFECTS } from '../data/native-predefined-effects';
import { createEffect } from '../utils/Sanitizer';
import { mundaneErrors, mundaneParts, mundaneDescription, type MundaneRecipe } from './mundane';
import { boonErrors, boonDescription, type BoonRecipe } from './boons';
import { magicErrors, magicDescription, magicHasAdditions, type MagicRecipe } from './magic-attributes';

export const TREASURE_TYPES = ['Basic', 'Weapon', 'Armor', 'Potion', 'Scroll', 'Wand', 'Gem'];
// Native Shadowdark 4.0.6 DEFAULTS.ITEM_IMAGES for newly authored item types.
// Explicit payload artwork keeps the editor preview and saved item identical.
const NEW_ITEM_IMAGES = {
    Basic: 'icons/containers/bags/pouch-simple-brown.webp',
    Gem: 'icons/commodities/gems/gem-faceted-navette-red.webp',
    Scroll: 'icons/sundries/scrolls/scroll-runed-brown-purple.webp',
    Wand: 'icons/weapons/wands/wand-gem-violet.webp',
    Boon: 'icons/skills/social/diplomacy-writing-letter.webp',
    Potion: 'icons/consumables/potions/bottle-corked-red.webp',
};
export const CRAWLING_KIT_UUID = 'Compendium.shadowdark.gear.Item.fJHwwn6TEfbdr8CM';
// Retain retired category identities for exact in-flight operation recovery.
// The UI hides magic/personality: their controls now live in every builder.
export const TREASURE_CATEGORIES = [
    ['random','Random Treasure'], ['mundane','Mundane Items'], ['boons','Boons'],
    ['magic','Magic Items / Attributes'], ['armor','Armor'], ['potions','Potions'],
    ['scrolls','Scrolls / Wands'], ['utility','Utility'], ['weapons','Weapons'], ['personality','Personalities'],
] as const;
export type TreasureCategory = typeof TREASURE_CATEGORIES[number][0];
export interface WeaponRecipe {
    mode?:'build'|'existing'; featurePart?:OriginalPart; bonusSource?:OriginalSource;
    feature: string; bonus: string; benefits: string[]; curses: string[];
    virtues: string[]; flaws: string[]; trait: string; alignment: string;
}
export const emptyWeaponRecipe = (): WeaponRecipe => ({feature:'',bonus:'0',benefits:[],curses:[],virtues:[],flaws:[],trait:'',alignment:''});
export function treasureFolder(d: TreasureDraft, payload: any): string {
    if (d.category==='weapons'&&payload.system?.isAmmunition)return 'Weapons';
    if (payload.type === 'Boon') return 'Boons';
    if (isScroll(payload)) return 'Scrolls';
    if (isWand(payload)) return 'Wands';
    if (d.category==='mundane' && d.mundane?.path==='jewelry') return 'Gems & Jewelry';
    const types: Record<string,string> = {Weapon:'Weapons',Armor:'Armor',Potion:'Potions',Scroll:'Scrolls',Wand:'Wands',Gem:'Gems & Jewelry'};
    return types[payload.type] ?? (d.category === 'utility' || d.category === 'magic' ? 'Utility' : 'Mundane Items');
}
export interface TreasureDraft {
    category?: TreasureCategory;
    potion?: PotionRecipe;
    utility?:UtilityRecipe; spellItem?:SpellItemRecipe; modifiers?:TreasureModifier[];
    armor?: ArmorRecipe;
    weapon?: WeaponRecipe;
    mundane?: MundaneRecipe;
    boon?: BoonRecipe;
    magic?: MagicRecipe;
    kind: 'template' | 'Basic' | 'Gem' | 'Scroll' | 'Wand' | 'Boon' | 'Potion';
    templateUuid: string; spellUuid: string; name: string; description: string;
    quantity: string; gp: string; sp: string; cp: string;
    slots: string; perSlot: string; freeCarry: string;
    sourceNote: string; drawId: string;
}
export const emptyTreasureDraft = (): TreasureDraft => ({ kind: 'Basic', templateUuid: '', spellUuid: '', name: '', description: '',
    quantity: '1', gp: '0', sp: '0', cp: '0', slots: '1', perSlot: '1', freeCarry: '0', sourceNote: '', drawId: '' });
export function treasureErrors(d: TreasureDraft): Record<string, string> {
    const errors: Record<string, string> = {};
    Object.assign(errors,modifierErrors(d.modifiers,d.kind==='template'?'Basic':d.kind));
    if(d.utility){
        if(d.category!=='utility'||d.kind!==(d.utility.mode==='build'?'Basic':'template'))errors['utility.mode']='Use the matching Utility path.';
        Object.assign(errors,utilityErrors(d.utility));
    }
    if(d.spellItem){
        if(d.category!=='scrolls'||!['Scroll','Wand'].includes(d.kind))errors['spellItem.feature']='Use the Scrolls / Wands builder.';
        else Object.assign(errors,spellItemErrors(d.spellItem,d.kind));
    }
    if(d.potion){
        if(d.category!=='potions'||d.kind!==(d.potion.mode==='build'?'Potion':'template'))errors['potion.mode']='Use the matching Potions path.';
        Object.assign(errors,potionErrors(d.potion));
    }
    if(d.kind==='Potion'&&(d.category!=='potions'||d.potion?.mode!=='build'))errors['potion.mode']='Use the Potions builder for a new potion.';
    if(d.armor){
        if(d.category!=='armor'||d.kind!=='template')errors['armor.mode']='Use the Armor builder for an armor recipe.';
        Object.assign(errors,armorErrors(d.armor));
    }
    if(d.magic)Object.assign(errors,magicErrors(d.magic));
    if (!['template','Basic','Gem','Scroll','Wand','Boon','Potion'].includes(d.kind)) errors.kind = 'Choose an item type.';
    if (d.category==='boons' || d.kind==='Boon') {
        if(d.category!=='boons'||d.kind!=='Boon')errors.kind='Use the Boons category for a boon.';
        Object.assign(errors,boonErrors(d.boon!));
    }
    if (d.category==='mundane' && d.mundane) {
        Object.assign(errors,mundaneErrors(d.mundane,d.kind==='template'));
        if (d.kind!=='template' && d.kind!==(d.mundane.path==='gemstone'?'Gem':'Basic')) errors.kind='Choose the matching mundane item type.';
    }
    if (d.category && !TREASURE_CATEGORIES.some(([id]) => id === d.category)) errors.category = 'Choose an available category.';
    if (d.category === 'weapons') {
        if (d.kind !== 'template') errors.templateUuid = 'Choose a native weapon base.';
        const w = d.weapon;
        if (!w || !/^[0-3]$/.test(w.bonus)) errors.bonus = 'Choose an additional weapon bonus from 0 to 3.';
        if(w?.mode&&!['build','existing'].includes(w.mode))errors['weapon.mode']='Choose how to create the weapon.';
        if(w?.mode==='build'){
            const e=partError(w.featurePart!,'weapon-feature');if(e)errors['weapon.feature']=e;
            if(w.bonusSource&&(!originalRow(w.bonusSource)||w.bonusSource.table!=='weapon-bonus'))errors.bonus='Choose a current bonus or set it manually.';
        }
        if (w) {
            for (const key of ['feature','trait','alignment'] as const) if (typeof w[key] !== 'string' || w[key].length > 1000) errors[key] = 'Use at most 1,000 characters.';
            for (const key of ['benefits','curses','virtues','flaws'] as const) {
                if (!Array.isArray(w[key]) || w[key].length > 20) { errors[key] = 'Use at most 20 entries per group in this draft.'; continue; }
                w[key].forEach((value,i) => { if (typeof value !== 'string' || !value.trim() || value.length > 1000) errors[`${key}.${i}`] = 'Enter this result, including any required follow-up choices (up to 1,000 characters).'; });
            }
        }
    }
    if (!d.name?.trim() || d.name.length > 200) errors.name = 'Enter an item name (up to 200 characters).';
    if (d.kind === 'template' && !d.templateUuid) errors.templateUuid = d.armor?.mode==='build'?'Choose an armor type.':'Choose a native item.';
    if (['Scroll','Wand'].includes(d.kind) && !d.spellUuid) errors.spellUuid = 'Choose the spell for this item.';
    for (const key of d.kind==='Boon'?[]:['quantity','gp','sp','cp','slots','perSlot','freeCarry'] as const) {
        const min = key === 'quantity' || key === 'perSlot' ? 1 : 0;
        if (!/^\d+$/.test(d[key] ?? '') || !Number.isSafeInteger(Number(d[key])) || Number(d[key]) < min)
            errors[key] = `Enter a whole number of ${min} or more.`;
    }
    if (typeof d.description !== 'string' || d.description.length > 10000) errors.description = 'Description must be at most 10,000 characters.';
    if (typeof d.sourceNote !== 'string' || d.sourceNote.length > 500) errors.sourceNote = 'Source note must be at most 500 characters.';
    return errors;
}
/** Shared form defaults from the exact native template, never name matching. */
export function treasureFromTemplate(doc: any, previous = emptyTreasureDraft()): TreasureDraft {
    return { ...previous, kind: 'template', templateUuid: doc.uuid, spellUuid: '', name: doc.name ?? '', description: doc.system?.description ?? '',
        quantity: String(doc.system?.quantity ?? 1), gp: String(doc.system?.cost?.gp ?? 0), sp: String(doc.system?.cost?.sp ?? 0), cp: String(doc.system?.cost?.cp ?? 0),
        slots: String(doc.system?.slots?.slots_used ?? 1), perSlot: String(doc.system?.slots?.per_slot ?? 1), freeCarry: String(doc.system?.slots?.free_carry ?? 0) };
}
/** Compare editable content, excluding routing, provenance and native copy defaults. */
export function treasureUnchanged(d: TreasureDraft, template: any): boolean {
    if (d.kind !== 'template' || !template || d.templateUuid !== template.uuid) return false;
    const original = treasureFromTemplate(template);
    if (d.name.trim() !== original.name.trim() || d.description !== original.description) return false;
    for (const key of ['quantity','gp','sp','cp','slots','perSlot','freeCarry'] as const)
        if (Number(d[key]) !== Number(original[key])) return false;
    const w = d.category === 'weapons' ? d.weapon : undefined;
    if (d.category==='mundane' && d.mundane && mundaneParts(d.mundane).length) return false;
    if (magicHasAdditions(d.magic)||d.modifiers?.length) return false;
    if(d.utility?.mode==='build')return false;
    if(d.armor?.mode==='build'&&(Number(d.armor.bonus)>0||d.armor.feature.text.trim()))return false;
    return !w || (Number(w.bonus) === 0 && ![w.featurePart?.text??'',w.feature,w.trait,w.alignment,...w.benefits,...w.curses,...w.virtues,...w.flaws].some(v=>v.trim()));
}
export function treasureTemplateAllowed(category: TreasureCategory | undefined, item: any): boolean {
    const spellItem = isScroll(item) || isWand(item);
    if (category === 'scrolls') return spellItem;
    if (category === 'magic') return !spellItem;
    if (category === 'weapons') return (item.type === 'Weapon'||item.type==='Basic'&&item.system?.isAmmunition===true) && !spellItem;
    if (category === 'armor') return item.type === 'Armor';
    if (category === 'potions') return item.type === 'Potion';
    if (category === 'mundane') return ['Basic','Gem'].includes(item.type) && !spellItem;
    if (category === 'utility') return item.type === 'Basic' && !spellItem;
    return true;
}
/** Native PhysicalItem fields and UtilitySD.createItemFromSpell shapes (4.0.6).
 * No table contents, executable prose effects, currency or Actor changes. */
export function treasurePayload(d: TreasureDraft, template: any, spell: any): any {
    if (Object.keys(treasureErrors(d)).length) throw new Error('Complete the item details.');
    // Native BoonSD extends BaseItemSD, not PhysicalItemSD: no cost, slots or quantity.
    if(d.kind==='Boon')return {name:d.name.trim(),type:'Boon',img:NEW_ITEM_IMAGES.Boon,
        system:{boonType:d.boon!.path,level:Number(d.boon!.level),description:boonDescription(d.boon!)+d.description+magicDescription(d.magic)},effects:[]};
    if (d.kind === 'template' && (!template || !TREASURE_TYPES.includes(template.type) || template.uuid === CRAWLING_KIT_UUID))
        throw new Error('Choose an available single item. Crawling Kits are added through inventory.');
    if (['Scroll','Wand'].includes(d.kind) && spell?.type !== 'Spell') throw new Error('The selected spell is unavailable.');
    if (d.kind === 'template' && !treasureTemplateAllowed(d.category,template)) throw new Error('Choose an item from this category. Scrolls and wands have their own tab.');
    const item = d.kind === 'template' ? ownedCopy(template) : { type: d.kind, img: NEW_ITEM_IMAGES[d.kind], system: {}, effects: [] };
    if (d.category === 'weapons' && item.type !== 'Weapon' && !(item.type==='Basic'&&item.system?.isAmmunition===true)) throw new Error('Choose a native weapon base.');
    if (d.category === 'armor' && item.type !== 'Armor') throw new Error('Choose native armor.');
    if (d.category === 'potions' && item.type !== 'Potion') throw new Error('Choose or build a potion.');
    item.name = d.name.trim();
    item.system = { ...item.system, description: d.description, quantity: Number(d.quantity),
        cost: { gp: Number(d.gp), sp: Number(d.sp), cp: Number(d.cp) },
        slots: { slots_used: Number(d.slots), per_slot: Number(d.perSlot), free_carry: Number(d.freeCarry) }, equipped: false, stashed: false };
    if (d.kind === 'Basic') item.system.treasure = true;
    if (d.kind === 'Potion') item.system.magicItem = true;
    if(d.potion)item.system.description+=potionDescription(d.potion);
    if(d.utility?.mode==='build'){
        item.system.treasure=false;
        item.img=utilityImage(d.utility)??item.img;
        item.system.description+=describePart('Utility form',d.utility.form)+describePart('Utility feature',d.utility.feature);
    }
    if(d.spellItem){
        if(spellTier(spell)!==Number(d.spellItem.tier))throw Error('Choose a spell from the selected tier.');
        item.system.description+=describePart(`${d.kind} feature`,d.spellItem.feature);
    }
    // Source artwork belongs to the chosen document, including spell-derived items.
    // Template copies already preserve their own img through ownedCopy.
    if (['Scroll','Wand'].includes(d.kind) && typeof spell.img === 'string' && spell.img.trim()) item.img = spell.img;
    if (['Scroll','Wand'].includes(d.kind)) item.system.magicItem=true;
    if (d.kind === 'Scroll') item.system.spellUuid = spell.uuid;
    if (d.kind === 'Wand') { item.system.spells = [{ uuid: spell.uuid, lost: false }]; item.system.broken = false; }
    if (d.category==='mundane' && d.mundane) item.system.description += mundaneDescription(d.mundane);
    if(d.armor)applyArmorRecipe(item,d.armor,template);
    item.system.description += magicDescription(d.magic);
    if(magicHasAdditions(d.magic))item.system.magicItem=true;
    if (d.category === 'weapons' && d.weapon) {
        const w = d.weapon;
        if(w.mode==='build'){
            if(!isWeaponBase(template))throw Error('Choose an available weapon or ammunition type from native gear.');
            if(item.type==='Weapon')item.system.baseWeapon=template.system.baseWeapon||slugify(template.name);
            item.system.description+=describePart('Weapon feature',w.featurePart!);
        }
        if(Number(w.bonus))item.system.magicItem=true;
        if(Number(w.bonus)&&item.type!=='Weapon')item.system.description+=`<p><strong>Ammunition bonus (manual):</strong> +${w.bonus} to attack and damage with this ammunition. Apply when resolving the attack.</p>`;
        if (Number(w.bonus)&&item.type==='Weapon') {
            const defs = [NATIVE_PREDEFINED_EFFECTS.weaponAttackBonus,NATIVE_PREDEFINED_EFFECTS.weaponDamageBonus];
            item.effects = [...(item.effects ?? []),createEffect(`Additional weapon bonus +${w.bonus}`,defs[0].icon,
                defs.map(def => ({key:def.key,mode:def.mode,value:w.bonus})),{sourceName:'Treasure authoring'})];
        }
        const escape = (v: string) => v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
        const parts = [['Feature',w.feature],...w.benefits.map(v=>['Benefit (manual)',v]),...w.curses.map(v=>['Curse (manual)',v]),
            ...w.virtues.map(v=>['Virtue (manual)',v]),...w.flaws.map(v=>['Flaw (manual)',v]),['Personality trait',w.trait],['Item alignment',w.alignment]];
        item.system.description += parts.filter(([,value])=>value.trim()).map(([label,value])=>`<p><strong>${label}:</strong> ${escape(value)}</p>`).join('');
    }
    applyTreasureModifiers(item,d.modifiers);
    return item;
}

/** Read explicit currency amounts from an applied result, not a price table.
 * “Each” remains a per-item value; quantities and dice expressions are not evaluated. */
export function treasureResultValue(text: string): Pick<TreasureDraft,'gp'|'sp'|'cp'> | null {
    const matches = [...text.matchAll(/\b(\d[\d,.]*)\s*(gp|sp|cp)\b/gi)];
    if (!matches.length) return null;
    const value = { gp:'0', sp:'0', cp:'0' }, seen = new Set<string>();
    for (let i=0;i<matches.length;i++) {
        const match = matches[i], unit = match[2].toLowerCase() as keyof typeof value;
        if (seen.has(unit) || !/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(match[1])) return null;
        const amount = Number(match[1].replace(/,/g,''));
        if (!Number.isSafeInteger(amount)) return null;
        const before = text.slice(0,match.index);
        if (/[+-]\s*$/.test(before) || /\d\s*(?:[-–—*/×x]|to)\s*$/i.test(before)) return null;
        if (/^\s*(?:[-–—]|to)\s*\d/i.test(text.slice(match.index!+match[0].length))) return null;
        if (i && !/^\s*(?:,\s*)?(?:and\s*)?$/i.test(text.slice(matches[i-1].index!+matches[i-1][0].length,match.index))) return null;
        seen.add(unit); value[unit] = String(amount);
    }
    return value;
}
