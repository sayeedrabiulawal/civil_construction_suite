import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import CalculatorCard from "@/components/CalculatorCard";
import { CATEGORIES } from "@/core/categories";
import {
    CALCULATORS,
    countByCategory,
    searchCalculators,
} from "@/core/registry";
import { UNIT_GROUPS } from "@/core/units";

/** Every unit offered by every dropdown across the site. */
const UNIT_COUNT = Object.values(UNIT_GROUPS).reduce(
    (total, group) => total + group.length,
    0,
);

interface Props {
    mode: "home" | "search" | "category" | "favorites" | "history";
    favoriteIds?: string[];
    historyCalcIds?: string[];
}

/**
 * One component drives four listing screens because they only differ by which
 * calculators they show and how they are headed.
 */
export default function ListScreen({
    mode,
    favoriteIds,
    historyCalcIds,
}: Props) {
    const { id: categoryId } = useParams();
    const [params, setParams] = useSearchParams();
    const query = params.get("q") ?? "";
    const [draft, setDraft] = useState(query);

    useEffect(() => setDraft(query), [query]);

    const counts = useMemo(() => countByCategory(), []);

    const { title, subtitle, items } = useMemo(() => {
        if (mode === "search") {
            return {
                title: `Search results for “${query}”`,
                subtitle: `${searchCalculators(query).length} calculator(s) matched.`,
                items: searchCalculators(query),
            };
        }

        if (mode === "favorites") {
            const set = new Set(favoriteIds ?? []);
            const list = CALCULATORS.filter((c) => set.has(c.id));
            return {
                title: "Favourites",
                subtitle: list.length
                    ? "Your starred calculators, always one tap away."
                    : "No favourites yet.",
                items: list,
            };
        }

        if (mode === "history") {
            const set = new Set(historyCalcIds ?? []);
            return {
                title: "Recently used",
                subtitle: "The calculators you used most recently.",
                items: CALCULATORS.filter((c) => set.has(c.id)),
            };
        }

        if (mode === "category") {
            const category = CATEGORIES.find((c) => c.id === categoryId);
            return {
                title: category?.name ?? "Category",
                subtitle: category?.blurb ?? "",
                items: CALCULATORS.filter((c) => c.category === categoryId),
            };
        }

        return { title: "", subtitle: "", items: [] };
    }, [mode, query, categoryId, favoriteIds, historyCalcIds]);

    if (mode === "home") {
        return (
            <>
                <section className="hero">
                    <h1>Civil Construction Suite</h1>
                    <p>
                        {CALCULATORS.length} engineering calculators and tools
                        for construction materials, concrete, bricks, steel,
                        areas, volumes, foundations, RCC, soil, surveying,
                        hydraulics, transportation, unit conversion and BOQ —
                        all working instantly in your browser.
                    </p>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            setParams(draft ? { q: draft } : {});
                        }}
                        className="field hero-search"
                        role="search"
                    >
                        <label htmlFor="home-search">Find a calculator</label>
                        <div className="control">
                            <input
                                id="home-search"
                                type="text"
                                placeholder="e.g. brick, bar weight, mix design, CBR"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                            />
                            <button className="button primary" type="submit">
                                Search
                            </button>
                        </div>
                    </form>
                    <div className="hero-stats">
                        <div className="stat">
                            <strong>{CALCULATORS.length}</strong>
                            <span>Calculators</span>
                        </div>
                        <div className="stat">
                            <strong>{CATEGORIES.length}</strong>
                            <span>Categories</span>
                        </div>
                        <div className="stat">
                            <strong>{UNIT_COUNT}</strong>
                            <span>Units supported</span>
                        </div>
                        <div className="stat">
                            <strong>Installable</strong>
                            <span>Offline after first visit</span>
                        </div>
                    </div>
                </section>

                <h2 className="section-title">Browse by category</h2>
                <div className="grid">
                    {CATEGORIES.map((c) => (
                        <Link
                            className="card"
                            key={c.id}
                            to={`/category/${c.id}`}
                        >
                            <span className="card-emoji" aria-hidden="true">
                                {c.icon}
                            </span>
                            <div className="card-body">
                                <h3>{c.name}</h3>
                                <p>{c.blurb}</p>
                                <div className="card-tags">
                                    <span>{counts[c.id] ?? 0} calculators</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                <h2 className="section-title">Most used tools</h2>
                <div className="grid">
                    {CALCULATORS.slice(0, 6).map((c) => (
                        <CalculatorCard key={c.id} calc={c} />
                    ))}
                </div>
            </>
        );
    }

    return (
        <>
            <h1 className="page-title">{title}</h1>
            <p className="page-sub">{subtitle}</p>

            {items.length === 0 ? (
                <div className="empty">
                    {mode === "search"
                        ? "Nothing matched. Try a shorter word like “steel”, “brick” or “concrete”."
                        : "Nothing here yet."}
                </div>
            ) : (
                <div className="grid">
                    {items.map((c) => (
                        <CalculatorCard key={c.id} calc={c} />
                    ))}
                </div>
            )}
        </>
    );
}
