'use client';

import React, { useState } from 'react';
import { logger } from '@sheet-delver/sdk';
import { useSDK } from '@sheet-delver/sdk/react';

interface ShadowdarkImportFormProps {
    onCancel: () => void;
    onImportSuccess: (id: string) => void;
}

interface ImportError {
    type: string;
    name: string;
    error: string;
}

export default function ShadowdarkImportForm({ onCancel, onImportSuccess }: ShadowdarkImportFormProps) {
    const { fetchWithAuth } = useSDK();
    const [jsonInput, setJsonInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rawErrors, setRawErrors] = useState<ImportError[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [importedId, setImportedId] = useState<string | null>(null);
    const [charSummary, setCharSummary] = useState<any>(null);

    const handleCancel = async () => {
        if (importedId) {
            // Delete the actor if we cancel after creating it
            try {
                await fetchWithAuth(`/api/actors/${importedId}`, { method: 'DELETE' });
            } catch (e) {
                logger.error("Failed to cleanup actor", e);
            }
        }
        onCancel();
    };

    const handleImport = async () => {
        if (!jsonInput.trim()) return;

        setLoading(true);
        setError(null);
        setRawErrors([]);
        setWarnings([]);
        setCharSummary(null);

        try {
            let parsed;
            try {
                parsed = JSON.parse(jsonInput);
                // Extract summary data
                setCharSummary({
                    name: parsed.name || 'Unnamed',
                    ancestry: parsed.ancestry || 'Unknown',
                    class: parsed.class || 'Unknown',
                    level: parsed.level || 1,
                    hp: parsed.maxHitPoints || 0,
                    gp: parsed.gold || 0,
                    xp: parsed.XP || 0
                });
            } catch {
                throw new Error("Invalid JSON format");
            }

            const res = await fetchWithAuth('/api/modules/shadowdark/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed)
            });

            const data = await res.json();
            logger.debug('[Import Page] API Response:', data);

            if (data.debug && Array.isArray(data.debug)) {
                data.debug.forEach((log: string) => logger.debug(`[Importer] ${log}`));
            }

            if (!res.ok) {
                throw new Error(data.error || 'Import failed');
            }

            if (data.errors && data.errors.length > 0) {
                // Filter and store objects. If string, wrap it.
                const objs = data.errors.map((e: any) =>
                    typeof e === 'string' ? { type: 'General', name: e, error: '' } : e
                );
                setRawErrors(objs);
            }

            if (data.warnings && Array.isArray(data.warnings)) {
                setWarnings(data.warnings);
            }

            if (data.success && data.id) {
                // If there are no HARD errors (warnings are ok), auto-proceed.
                if (!data.errors || data.errors.length === 0) {
                    onImportSuccess(data.id);
                    return;
                }

                // Otherwise show the results (with errors)
                setImportedId(data.id);
            } else {
                throw new Error(data.error || 'Import failed');
            }

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col bg-neutral-100 pb-24 font-crimson font-inter font-sans text-black">
            <nav className="fixed top-0 left-0 right-0 z-50 bg-neutral-900 border-b border-neutral-800 px-4 py-3 shadow-md flex items-center justify-between backdrop-blur-sm bg-opacity-95">
                <button
                    type="button"
                    onClick={handleCancel}
                    className="flex items-center gap-2 text-neutral-400 hover:text-amber-500 transition-colors font-semibold group text-sm uppercase tracking-wide"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span>
                    Back to Dashboard
                </button>
                <div className="text-xs text-neutral-600 font-mono hidden md:block">Importing Character</div>
            </nav>

            <header className="bg-neutral-900 text-white shadow-md sticky top-[45px] z-10 flex items-center justify-between px-6 border-b-4 border-black h-24 mt-[45px]">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-neutral-800 border-2 border-white/10 flex items-center justify-center rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 opacity-50" aria-hidden="true">
                            <path d="M12 3a.75.75 0 0 1 .75.75v9.69l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V3.75A.75.75 0 0 1 12 3ZM4.75 15a.75.75 0 0 1 .75.75v3.5h13v-3.5a.75.75 0 0 1 1.5 0V20a.75.75 0 0 1-.75.75H4.75A.75.75 0 0 1 4 20v-4.25a.75.75 0 0 1 .75-.75Z" />
                        </svg>
                    </div>
                    <div className="py-2">
                        <h1 className="text-3xl font-serif font-bold leading-none tracking-tight">Import Character</h1>
                        <p className="text-xs text-neutral-400 font-sans tracking-widest uppercase mt-1">Shadowdark RPG</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 px-4 max-w-5xl mx-auto w-full pt-6 mb-20 space-y-8">
                <section className="bg-white p-6 border-2 border-black shadow-sm">
                    <h2 className="text-black font-black font-serif text-xl border-b-2 border-black mb-4 pb-1">Shadowdarklings.net Importer</h2>

                    {/* View: Input */}
                    {!importedId && (
                        <>
                            <div className="mb-6">
                                <label htmlFor="shadowdark-import-json" className="block text-neutral-900 font-black mb-2 uppercase text-sm tracking-widest font-serif">Paste Character JSON</label>
                                <textarea
                                    id="shadowdark-import-json"
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    className="w-full h-64 bg-white border-2 border-neutral-300 p-4 text-xs font-mono text-neutral-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-inner resize-none transition-all"
                                    placeholder='{ "name": "Character Name", ... }'
                                    disabled={loading}
                                />
                                <a className="mt-4 inline-block border-2 border-black bg-white px-4 py-2 font-bold uppercase text-black shadow-sm hover:bg-neutral-100" href="https://shadowdarklings.net/create#!" target="_blank" rel="noopener noreferrer">
                                    Go to Shadowdarklings.net
                                </a>
                            </div>
                            {error && (
                                <div className="p-3 mb-4 bg-red-100 border border-red-500 text-red-900 text-sm font-bold">
                                    ERROR: {error}
                                </div>
                            )}
                        </>
                    )}

                    {/* View: Summary / Result */}
                    {importedId && charSummary && (
                        <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">

                            {/* Character Card */}
                            <div className="border-2 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] relative overflow-hidden group hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] transition-all">
                                {/* Name Banner */}
                                <div className="bg-black text-white px-6 py-2 inline-block absolute top-0 left-0 border-r-4 border-b-4 border-white shadow-sm z-10">
                                    <span className="font-black uppercase tracking-widest text-xl font-serif">{charSummary.name}</span>
                                </div>

                                <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-2 text-sm font-bold text-neutral-900">
                                    <div className="flex justify-between border-b-2 border-neutral-100 pb-1">
                                        <span className="text-neutral-500 uppercase tracking-wider text-xs">Ancestry</span>
                                        <span className="font-serif text-lg">{charSummary.ancestry}</span>
                                    </div>
                                    <div className="flex justify-between border-b-2 border-neutral-100 pb-1">
                                        <span className="text-neutral-500 uppercase tracking-wider text-xs">HP</span>
                                        <span className="font-serif text-lg">{charSummary.hp} / {charSummary.hp}</span>
                                    </div>
                                    <div className="flex justify-between border-b-2 border-neutral-100 pb-1">
                                        <span className="text-neutral-500 uppercase tracking-wider text-xs">Class</span>
                                        <span className="font-serif text-lg">{charSummary.class}</span>
                                    </div>
                                    <div className="flex justify-between border-b-2 border-neutral-100 pb-1">
                                        <span className="text-neutral-500 uppercase tracking-wider text-xs">GP</span>
                                        <span className="font-serif text-lg">{charSummary.gp}</span>
                                    </div>
                                    <div className="flex justify-between border-b-2 border-neutral-100 pb-1">
                                        <span className="text-neutral-500 uppercase tracking-wider text-xs">Level</span>
                                        <span className="font-serif text-lg">{charSummary.level}</span>
                                    </div>
                                    <div className="flex justify-between border-b-2 border-neutral-100 pb-1">
                                        <span className="text-neutral-500 uppercase tracking-wider text-xs">XP</span>
                                        <span className="font-serif text-lg">{charSummary.xp}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Warnings / Notifications */}
                            {warnings.length > 0 && (
                                <div className="border-2 border-amber-500 bg-amber-50">
                                    <div className="bg-amber-500 text-white font-black text-center uppercase py-1 text-sm tracking-widest relative">
                                        Import Notes
                                    </div>
                                    <div className="max-h-32 overflow-y-auto p-4">
                                        <ul className="list-disc list-inside text-sm text-amber-900 font-medium">
                                            {warnings.map((w, i) => (
                                                <li key={i}>{w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Warnings Table */}
                            {rawErrors.length > 0 && (
                                <div className="border-2 border-red-500 bg-red-50">
                                    <div className="bg-red-500 text-white font-black text-center uppercase py-1 text-sm tracking-widest relative">
                                        Items Not Found
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="bg-red-100 text-red-900 font-bold border-b-2 border-red-200">
                                                <tr>
                                                    <th className="p-2 border-r border-red-200">Item Name</th>
                                                    <th className="p-2">Item Type</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rawErrors.map((err, i) => (
                                                    <tr key={i} className="border-b border-red-100 even:bg-red-50/50">
                                                        <td className="p-2 border-r border-red-100 font-semibold text-red-900">{err.name}</td>
                                                        <td className="p-2 text-red-700">{err.type}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                </section>

                <div className="bg-neutral-900 text-white p-8 border-2 border-black shadow-lg flex flex-col items-center justify-center gap-4">
                    <p className="text-neutral-400 font-serif italic text-lg opacity-80">&quot;Protect the light!&quot;</p>
                    <div className="flex w-full max-w-md flex-col-reverse gap-3 sm:flex-row">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="px-8 py-3 border-2 border-neutral-600 text-neutral-300 hover:text-white hover:border-white font-bold uppercase tracking-widest transition-all"
                    >
                        Cancel
                    </button>

                    {importedId ? (
                        <button
                            type="button"
                            onClick={() => onImportSuccess(importedId)}
                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded shadow-lg uppercase tracking-widest text-lg transition-all hover:scale-105"
                        >
                            Continue to Sheet
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleImport}
                            disabled={loading || !jsonInput}
                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded shadow-lg uppercase tracking-widest text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
                        >
                            {loading ? 'Reading Scroll...' : 'Import Character'}
                        </button>
                    )}
                    </div>
                </div>
            </div>
        </main>
    );
}
