import { LanguageChoices } from '../../LanguageChoices';
import { CollectionStatus } from '../../CollectionStatus';
import type { LanguagePlan, LanguageSelections } from '../../../../logic/languages';
export function LanguageSelectionSection({ data, selected, onChange, knownLanguages }: {
    data: { ready: boolean; plan: (LanguagePlan & { rows: any[] }) | null; error: string | null; loading: boolean; retry: () => void };
    selected: LanguageSelections; onChange: (selected: LanguageSelections) => void; knownLanguages: any[];
}) {
    return <section aria-label="Native language choices" className="border-2 border-black bg-white p-4">
        <h3 className="font-bold mb-2">Languages</h3>
        <CollectionStatus state={data} label="Loading native language choices…" />
        {data.ready && data.plan && <LanguageChoices plan={data.plan} rows={data.plan.rows} selected={selected} onChange={onChange} />}
        {knownLanguages.length > 0 && <p className="text-sm mt-2">Existing languages are retained: {knownLanguages.map(doc => doc.name ?? 'Unavailable language').join(', ')}</p>}
    </section>;
}
