import { Link } from "react-router-dom";
import type { Calculator } from "@/core/types";
import { CATEGORY_BY_ID } from "@/core/categories";
import { isFavorite, toggleFavorite } from "@/store/storage";
import { useStoreVersion } from "@/store/useStore";

interface Props {
    calc: Calculator;
}

export default function CalculatorCard({ calc }: Props) {
    // Subscribe to the store so the star stays in sync across the app.
    useStoreVersion();

    const category = CATEGORY_BY_ID[calc.category];
    const favorited = isFavorite(calc.id);

    return (
        <Link className="card" to={`/calc/${calc.id}`}>
            <span className="card-emoji" aria-hidden="true">
                {category?.icon ?? "🧮"}
            </span>
            <div className="card-body">
                <h3>{calc.name}</h3>
                <p>{calc.summary}</p>
                <div className="card-tags">
                    <span>{category?.name ?? calc.category}</span>
                    {calc.tags?.slice(0, 2).map((t) => (
                        <span key={t}>· {t}</span>
                    ))}
                </div>
            </div>
            <button
                type="button"
                className={favorited ? "star on" : "star"}
                aria-label={
                    favorited ? "Remove from favourites" : "Add to favourites"
                }
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite(calc.id);
                }}
            >
                {favorited ? "★" : "☆"}
            </button>
        </Link>
    );
}
