import type { ChoiceOption } from '../../../../logic/talent-choices';

interface Props {
    required: number;
    selected: string[];
    options: ChoiceOption[];
    onSelectionChange: (selected: string[]) => void;
}

/** Each native advantage talent selects its own known (or currently learned) Spell. */
export function SpellAdvantageSelectionSection({ required, selected, options, onSelectionChange }: Props) {
    if (!required) return null;
    return <section className="bg-white text-black border-2 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" aria-label="Spellcasting advantage choices">
        <h3 className="bg-black text-white px-4 py-2 font-serif font-bold text-lg uppercase -mx-4 -mt-4 mb-4">Spellcasting Advantage</h3>
        <p className="mb-4">Choose one known spell for each talent. You can also choose a spell you are learning now.</p>
        {!options.length && <p role="status">Choose your spells first to make them available here.</p>}
        {Array.from({ length: required }, (_, index) => <label key={index} className="block mb-3 font-bold">
            Spell for advantage{required > 1 ? ` ${index + 1}` : ''}
            <select aria-label={`Spell for advantage${required > 1 ? ` ${index + 1}` : ''}`} className="block w-full border-2 border-black bg-white text-black p-2 mt-1" value={selected[index] ?? ''}
                onChange={event => {
                    const next = Array.from({ length: required }, (_, i) => selected[i] ?? '');
                    next[index] = event.target.value;
                    onSelectionChange(next);
                }}>
                <option value="">Choose a spell…</option>
                {options.map(option => <option key={option.slug} value={option.name}>{option.name}</option>)}
            </select>
        </label>)}
    </section>;
}
