import { Link } from "react-router-dom";
import { clearHistory, getHistory, removeHistoryEntry } from "@/store/storage";
import { useStoreVersion } from "@/store/useStore";

function formatWhen(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} d ago`;
    return new Date(timestamp).toLocaleDateString();
}

export default function HistoryScreen() {
    useStoreVersion();
    const history = getHistory();

    return (
        <>
            <h1 className="page-title">History</h1>
            <p className="page-sub">
                Your last {history.length} calculation(s), stored on this device
                only.
            </p>

            {history.length === 0 ? (
                <div className="empty">
                    Nothing calculated yet.{" "}
                    <Link to="/">Pick a calculator</Link> and your results will
                    appear here automatically.
                </div>
            ) : (
                <>
                    <div className="calc-actions" style={{ marginBottom: 16 }}>
                        <button
                            type="button"
                            className="button"
                            onClick={clearHistory}
                        >
                            Clear all history
                        </button>
                    </div>

                    {history.map((h) => (
                        <div className="history-row" key={h.id}>
                            <div className="hbody">
                                <div className="hname">
                                    <Link to={`/calc/${h.calcId}`}>
                                        {h.calcName}
                                    </Link>
                                </div>
                                <div className="hinputs">{h.inputs}</div>
                                <div className="htime">{formatWhen(h.at)}</div>
                            </div>
                            <div className="hresult">{h.result}</div>
                            <button
                                type="button"
                                className="star"
                                aria-label="Remove this entry"
                                onClick={() => removeHistoryEntry(h.id)}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </>
            )}
        </>
    );
}
