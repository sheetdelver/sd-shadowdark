import { useSheetViewPreference } from './sheet-view-preference';

// Structural lifecycle props let the optional panel compile against the released SDK floor.
export default function SheetSettings({ signal }: { signal: AbortSignal; onDirtyChange: (dirty: boolean) => void }) {
    const preference = useSheetViewPreference();
    return <section>
        <h3>Sheet display</h3>
        <p>Changes save immediately in this browser for this site, across worlds and accounts.</p>
        <label htmlFor="shadowdark-settings-view">Sheet view</label>
        <select id="shadowdark-settings-view" value={preference.mode} onChange={event => {
            if (!signal.aborted) { try { preference.set(event.target.value === 'advanced' ? 'advanced' : 'simple'); } catch { /* Inline error below. */ } }
        }}>
            <option value="simple">Single page</option>
            <option value="advanced">Tabbed</option>
        </select>
        <p>The sheet’s existing view button changes the same preference.</p>
        {preference.error && <p role="alert">{preference.error.message}</p>}
        <button type="button" onClick={() => {
            if (!signal.aborted) { try { preference.reset(); } catch { /* Inline error below. */ } }
        }}>Reset sheet view</button>
    </section>;
}
