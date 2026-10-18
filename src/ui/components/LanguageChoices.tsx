import type { LanguagePlan, LanguageSelections } from '../../logic/languages';

/** Shared separate native choice pools for Generator and advancement. */
export function LanguageChoices({ plan, rows, selected, onChange }: {
    plan: LanguagePlan; rows: any[]; selected: LanguageSelections; onChange: (selected: LanguageSelections) => void;
}) {
    return <div className="space-y-4">
        {plan.fixed.length > 0 && <p>Fixed grants: {plan.fixed.map(uuid => rows.find(row => row.uuid === uuid)?.name ?? 'Unavailable language').join(', ')}</p>}
        {plan.groups.filter(group => group.count > 0).map(group => <section key={group.id} aria-label={group.label} className="border-2 border-black p-3">
            <h4 className="font-bold">{group.label}: {selected[group.id].length} / {group.count}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">{group.options.map(uuid => {
                const doc = rows.find(row => row.uuid === uuid); if (!doc) return null;
                const chosen = selected[group.id].includes(uuid);
                const elsewhere = Object.entries(selected).some(([id, refs]) => id !== group.id && refs.includes(uuid));
                return <button type="button" key={uuid} aria-label={`${group.label}: ${doc.name}`} aria-pressed={chosen}
                    disabled={!chosen && (elsewhere || selected[group.id].length >= group.count)}
                    className={`min-h-11 border-2 border-black p-2 text-left disabled:opacity-40 ${chosen ? 'bg-black text-white' : 'bg-white text-black'}`}
                    onClick={() => onChange({ ...selected, [group.id]: chosen ? selected[group.id].filter(value => value !== uuid) : [...selected[group.id], uuid] })}>{doc.name}</button>;
            })}</div>
            {!group.options.some(uuid => rows.some(row => row.uuid === uuid)) && <p>No readable options are available for this required pool.</p>}
        </section>)}
    </div>;
}
