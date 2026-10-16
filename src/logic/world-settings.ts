/**
 * Native Shadowdark 4.0.6 world settings the module's rules depend on
 * (src/settings.mjs, `scope: "world"`). SheetDelver Core does not expose Foundry
 * world settings to modules (its SettingStore is GM-only with no module route),
 * so every value here is the native registered default, labelled as such. This is
 * the single seam for a future read-only Core contract; callers must not read
 * settings any other way or infer them from Actor data.
 */
export interface WorldSettingValue<T> { value: T; source: 'native-default' | 'world' }

export const NATIVE_WORLD_SETTINGS = {
    usePulpMode: { key: 'shadowdark.usePulpMode', default: false },
    autoConsumeAmmunition: { key: 'shadowdark.autoConsumeAmmunition', default: true },
} as const;

export type WorldSettingName = keyof typeof NATIVE_WORLD_SETTINGS;

export function worldSetting<K extends WorldSettingName>(name: K): WorldSettingValue<(typeof NATIVE_WORLD_SETTINGS)[K]['default']> {
    return { value: NATIVE_WORLD_SETTINGS[name].default, source: 'native-default' };
}
