import { useMemo, useState } from "react";
import {
    BOQ_UNITS,
    computeTotals,
    exportCsv,
    exportText,
    formatMoney,
    formatQuantity,
    largestLine,
    lineAmount,
} from "@/core/boq";
import type { BoqProject } from "@/core/types";
import {
    addLine,
    clearLines,
    createProject,
    deleteProject,
    duplicateProject,
    getActiveProject,
    getProjects,
    removeLine,
    renameProject,
    setActiveProject,
    updateLine,
    updateProjectDetails,
    updateTerms,
    moveLineBy,
} from "@/store/boqStore";
import { useStoreVersion } from "@/store/useStore";

/** Download generated text without needing a server. */
function download(filename: string, contents: string, mime: string): void {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoke on the next tick so the download has started.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A filename that will not collide or contain illegal characters. */
function safeFilename(project: BoqProject, extension: string): string {
    const base = project.name
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
    return `${base || "boq"}.${extension}`;
}

export default function BoqScreen() {
    useStoreVersion();

    const projects = getProjects();
    const project = getActiveProject();
    const [copied, setCopied] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [newName, setNewName] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);

    const totals = useMemo(
        () => (project ? computeTotals(project) : null),
        [project],
    );
    const biggest = useMemo(
        () => (project ? largestLine(project) : null),
        [project],
    );

    // No beforeunload guard here on purpose: every edit is written to storage
    // immediately, so there is never unsaved work to warn the user about.

    if (!project || !totals) {
        return (
            <div className="empty">
                No bill of quantities found. Reload the page to start a new one.
            </div>
        );
    }

    const copySummary = async () => {
        try {
            await navigator.clipboard.writeText(exportText(project));
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    };

    const currency = project.currency;

    return (
        <>
            <h1 className="page-title">Bill of Quantities</h1>
            <p className="page-sub">
                Build a priced bill item by item. Everything saves to this
                device automatically, and nothing is uploaded anywhere.
            </p>

            {/* ------------------------- Project bar ------------------------- */}
            <div className="boq-toolbar">
                <div className="boq-project-select">
                    <label htmlFor="boq-project">Project</label>
                    <select
                        id="boq-project"
                        value={project.id}
                        onChange={(e) => setActiveProject(e.target.value)}
                    >
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    type="button"
                    className="button"
                    onClick={() => {
                        // Inline input rather than window.prompt, which is blocked
                        // in embedded frames and cannot be styled.
                        setConfirmDelete(false);
                        setNewName(newName === null ? "" : null);
                    }}
                >
                    + New
                </button>
                <button
                    type="button"
                    className="button"
                    onClick={() => duplicateProject(project.id)}
                >
                    Duplicate
                </button>
                <button
                    type="button"
                    className="button"
                    onClick={() => {
                        setConfirmDelete(false);
                        setShowExport((open) => !open);
                    }}
                >
                    Export
                </button>
                {confirmDelete ? (
                    <span className="boq-confirm">
                        <span>Delete this bill?</span>
                        <button
                            type="button"
                            className="button danger-button"
                            onClick={() => {
                                deleteProject(project.id);
                                setConfirmDelete(false);
                            }}
                        >
                            Yes, delete
                        </button>
                        <button
                            type="button"
                            className="button"
                            onClick={() => setConfirmDelete(false)}
                        >
                            Cancel
                        </button>
                    </span>
                ) : (
                    <button
                        type="button"
                        className="button danger-button"
                        onClick={() => {
                            setShowExport(false);
                            setConfirmDelete(true);
                        }}
                    >
                        Delete
                    </button>
                )}
            </div>

            {newName !== null && (
                <div className="boq-inline-prompt">
                    <label htmlFor="boq-new-name">Name for the new bill</label>
                    <div className="control">
                        <input
                            id="boq-new-name"
                            type="text"
                            autoFocus
                            placeholder="e.g. Rupganj residence — structure"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    createProject(newName);
                                    setNewName(null);
                                }
                                if (e.key === "Escape") setNewName(null);
                            }}
                        />
                        <button
                            type="button"
                            className="button primary"
                            onClick={() => {
                                createProject(newName);
                                setNewName(null);
                            }}
                        >
                            Create
                        </button>
                        <button
                            type="button"
                            className="button"
                            onClick={() => setNewName(null)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {showExport && (
                <div className="boq-export">
                    <button
                        type="button"
                        className="button primary"
                        onClick={() =>
                            download(
                                safeFilename(project, "csv"),
                                exportCsv(project),
                                "text/csv",
                            )
                        }
                    >
                        ⬇ Download CSV (Excel)
                    </button>
                    <button
                        type="button"
                        className="button"
                        onClick={() =>
                            download(
                                safeFilename(project, "txt"),
                                exportText(project),
                                "text/plain",
                            )
                        }
                    >
                        ⬇ Download text summary
                    </button>
                    <button
                        type="button"
                        className="button"
                        onClick={copySummary}
                    >
                        {copied ? "Copied ✓" : "Copy summary"}
                    </button>
                    <button
                        type="button"
                        className="button"
                        onClick={() => window.print()}
                    >
                        🖨 Print
                    </button>
                </div>
            )}

            {/* --------------------------- Details --------------------------- */}
            <section className="panel boq-details">
                <h2>Bill details</h2>
                <div className="boq-details-grid">
                    <div className="field">
                        <label htmlFor="boq-name">Project name</label>
                        <div className="control">
                            <input
                                id="boq-name"
                                type="text"
                                value={project.name}
                                onChange={(e) => renameProject(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="field">
                        <label htmlFor="boq-client">Client / location</label>
                        <div className="control">
                            <input
                                id="boq-client"
                                type="text"
                                placeholder="e.g. Rupganj, 4-storey residence"
                                value={project.client}
                                onChange={(e) =>
                                    updateProjectDetails({
                                        client: e.target.value,
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div className="field">
                        <label htmlFor="boq-currency">Currency label</label>
                        <div className="control">
                            <input
                                id="boq-currency"
                                type="text"
                                value={project.currency}
                                onChange={(e) =>
                                    updateProjectDetails({
                                        currency: e.target.value,
                                    })
                                }
                            />
                        </div>
                        <span className="hint">
                            Shown next to every amount. No conversion is
                            applied.
                        </span>
                    </div>
                </div>
            </section>

            {/* ---------------------------- Lines ---------------------------- */}
            <section className="panel boq-table-panel">
                <h2>Measured items</h2>

                <div className="boq-table-wrap">
                    <table className="boq-table">
                        <thead>
                            <tr>
                                <th className="col-num">#</th>
                                <th className="col-desc">Description</th>
                                <th className="col-unit">Unit</th>
                                <th className="col-qty">Quantity</th>
                                <th className="col-rate">Rate</th>
                                <th className="col-amount">Amount</th>
                                <th
                                    className="col-actions"
                                    aria-label="Actions"
                                />
                            </tr>
                        </thead>
                        <tbody>
                            {project.lines.map((line, index) => (
                                <tr key={line.id}>
                                    <td className="col-num" data-label="Item">
                                        {index + 1}
                                    </td>
                                    <td
                                        className="col-desc"
                                        data-label="Description"
                                    >
                                        <input
                                            type="text"
                                            aria-label={`Description for item ${index + 1}`}
                                            placeholder="e.g. Brickwork in cement mortar 1:6"
                                            value={line.description}
                                            onChange={(e) =>
                                                updateLine(line.id, {
                                                    description: e.target.value,
                                                })
                                            }
                                        />
                                        <input
                                            type="text"
                                            className="boq-remarks"
                                            aria-label={`Remarks for item ${index + 1}`}
                                            placeholder="Remarks (optional)"
                                            value={line.remarks}
                                            onChange={(e) =>
                                                updateLine(line.id, {
                                                    remarks: e.target.value,
                                                })
                                            }
                                        />
                                    </td>
                                    <td className="col-unit" data-label="Unit">
                                        <select
                                            aria-label={`Unit for item ${index + 1}`}
                                            value={line.unit}
                                            onChange={(e) =>
                                                updateLine(line.id, {
                                                    unit: e.target.value,
                                                })
                                            }
                                        >
                                            {BOQ_UNITS.map((u) => (
                                                <option key={u} value={u}>
                                                    {u}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="col-qty" data-label="Quantity">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="any"
                                            aria-label={`Quantity for item ${index + 1}`}
                                            value={line.quantity}
                                            onChange={(e) =>
                                                updateLine(line.id, {
                                                    quantity:
                                                        Number(
                                                            e.target.value,
                                                        ) || 0,
                                                })
                                            }
                                        />
                                    </td>
                                    <td className="col-rate" data-label="Rate">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="any"
                                            aria-label={`Rate for item ${index + 1}`}
                                            value={line.rate}
                                            onChange={(e) =>
                                                updateLine(line.id, {
                                                    rate:
                                                        Number(
                                                            e.target.value,
                                                        ) || 0,
                                                })
                                            }
                                        />
                                    </td>
                                    <td
                                        className="col-amount"
                                        data-label="Amount"
                                    >
                                        {formatQuantity(lineAmount(line))}
                                    </td>
                                    <td
                                        className="col-actions"
                                        data-label="Actions"
                                    >
                                        <button
                                            type="button"
                                            className="row-button"
                                            title="Move up"
                                            aria-label={`Move item ${index + 1} up`}
                                            disabled={index === 0}
                                            onClick={() =>
                                                moveLineBy(line.id, -1)
                                            }
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            className="row-button"
                                            title="Move down"
                                            aria-label={`Move item ${index + 1} down`}
                                            disabled={
                                                index ===
                                                project.lines.length - 1
                                            }
                                            onClick={() =>
                                                moveLineBy(line.id, 1)
                                            }
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            className="row-button danger-button"
                                            title="Delete item"
                                            aria-label={`Delete item ${index + 1}`}
                                            onClick={() => removeLine(line.id)}
                                        >
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="calc-actions">
                    <button
                        type="button"
                        className="button primary"
                        onClick={() =>
                            addLine({
                                unit:
                                    project.lines[project.lines.length - 1]
                                        ?.unit ?? "m³",
                            })
                        }
                    >
                        + Add item
                    </button>
                    <button
                        type="button"
                        className="button"
                        onClick={() => {
                            // Carry the description, unit and rate into the new row, but
                            // not the id or the quantity: bills usually repeat the same
                            // work at a different measurement.
                            const last =
                                project.lines[project.lines.length - 1];
                            if (!last) {
                                addLine();
                                return;
                            }
                            addLine({
                                description: last.description,
                                unit: last.unit,
                                rate: last.rate,
                                remarks: last.remarks,
                            });
                        }}
                    >
                        Repeat last item
                    </button>
                    {confirmClear ? (
                        <span className="boq-confirm">
                            <span>Remove every item?</span>
                            <button
                                type="button"
                                className="button danger-button"
                                onClick={() => {
                                    clearLines();
                                    setConfirmClear(false);
                                }}
                            >
                                Yes, clear
                            </button>
                            <button
                                type="button"
                                className="button"
                                onClick={() => setConfirmClear(false)}
                            >
                                Cancel
                            </button>
                        </span>
                    ) : (
                        <button
                            type="button"
                            className="button"
                            onClick={() => setConfirmClear(true)}
                        >
                            Clear all items
                        </button>
                    )}
                </div>
            </section>

            {/* --------------------------- Totals ---------------------------- */}
            <section className="panel boq-totals-panel">
                <h2>Summary</h2>

                <div className="boq-terms">
                    <div className="field">
                        <label htmlFor="boq-contingency">Contingency</label>
                        <div className="control">
                            <input
                                id="boq-contingency"
                                type="number"
                                step="0.5"
                                min="0"
                                value={project.terms.contingency}
                                onChange={(e) =>
                                    updateTerms({
                                        contingency:
                                            Number(e.target.value) || 0,
                                    })
                                }
                            />
                            <span className="unit-badge">%</span>
                        </div>
                    </div>
                    <div className="field">
                        <label htmlFor="boq-overhead">
                            Overhead and profit
                        </label>
                        <div className="control">
                            <input
                                id="boq-overhead"
                                type="number"
                                step="0.5"
                                min="0"
                                value={project.terms.overhead}
                                onChange={(e) =>
                                    updateTerms({
                                        overhead: Number(e.target.value) || 0,
                                    })
                                }
                            />
                            <span className="unit-badge">%</span>
                        </div>
                    </div>
                    <div className="field">
                        <label htmlFor="boq-tax">Tax / VAT / GST</label>
                        <div className="control">
                            <input
                                id="boq-tax"
                                type="number"
                                step="0.5"
                                min="0"
                                value={project.terms.tax}
                                onChange={(e) =>
                                    updateTerms({
                                        tax: Number(e.target.value) || 0,
                                    })
                                }
                            />
                            <span className="unit-badge">%</span>
                        </div>
                    </div>
                </div>

                <div className="result-list boq-summary-list">
                    <div className="result-row">
                        <span className="rlabel">
                            Subtotal of {totals.lineCount} item
                            {totals.lineCount === 1 ? "" : "s"}
                        </span>
                        <span className="rvalue">
                            {formatMoney(totals.subtotal)}
                            <span className="runit">{currency}</span>
                        </span>
                    </div>
                    <div className="result-row">
                        <span className="rlabel">
                            Contingency ({project.terms.contingency}%)
                        </span>
                        <span className="rvalue">
                            {formatMoney(totals.contingencyAmount)}
                            <span className="runit">{currency}</span>
                        </span>
                    </div>
                    <div className="result-row">
                        <span className="rlabel">
                            Overhead and profit ({project.terms.overhead}%)
                        </span>
                        <span className="rvalue">
                            {formatMoney(totals.overheadAmount)}
                            <span className="runit">{currency}</span>
                        </span>
                    </div>
                    <div className="result-row">
                        <span className="rlabel">Amount before tax</span>
                        <span className="rvalue">
                            {formatMoney(totals.beforeTax)}
                            <span className="runit">{currency}</span>
                        </span>
                    </div>
                    <div className="result-row">
                        <span className="rlabel">
                            Tax ({project.terms.tax}%)
                        </span>
                        <span className="rvalue">
                            {formatMoney(totals.taxAmount)}
                            <span className="runit">{currency}</span>
                        </span>
                    </div>
                </div>

                <div className="hero-result boq-grand-total">
                    <div className="label">Grand total</div>
                    <div className="value">
                        {formatMoney(totals.grandTotal)}
                        <span className="unit">{currency}</span>
                    </div>
                </div>

                <div className="boq-breakdown">
                    <h4>Quantities by unit</h4>
                    {Object.keys(totals.quantityByUnit).length === 0 ? (
                        <p>No items yet.</p>
                    ) : (
                        <ul className="boq-unit-list">
                            {Object.entries(totals.quantityByUnit).map(
                                ([unit, quantity]) => (
                                    <li key={unit}>
                                        <strong>
                                            {formatQuantity(quantity)}
                                        </strong>{" "}
                                        {unit}
                                    </li>
                                ),
                            )}
                        </ul>
                    )}

                    {biggest && totals.subtotal > 0 && (
                        <p className="boq-insight">
                            Largest item is{" "}
                            <strong>{formatQuantity(biggest.share)}%</strong> of
                            the subtotal
                            {biggest.line.description
                                ? ` — “${biggest.line.description}”`
                                : ""}
                            .
                        </p>
                    )}
                </div>
            </section>

            <div className="meta">
                <div className="meta-block">
                    <h4>How the total is built</h4>
                    <pre className="formula">
                        {`Subtotal          = Σ (quantity × rate)
Contingency       = subtotal × contingency %
Overhead          = subtotal × overhead %
Amount before tax = subtotal + contingency + overhead
Tax               = amount before tax × tax %
Grand total       = amount before tax + tax`}
                    </pre>
                </div>
                <div className="meta-block">
                    <h4>Notes</h4>
                    <ul>
                        <li>
                            Every change saves to this device immediately.
                            Nothing is uploaded.
                        </li>
                        <li>
                            Tax applies to the whole sum, so keep it out of the
                            individual rates.
                        </li>
                        <li>
                            Contingency covers unforeseen work; overhead and
                            profit is the contractor's margin. They are not the
                            same thing.
                        </li>
                        <li>
                            Rates should exclude tax. Quantities should be
                            measured net, per the method of measurement.
                        </li>
                        <li>
                            Use the CSV export to open the bill in Excel or
                            Google Sheets.
                        </li>
                    </ul>
                </div>
            </div>
        </>
    );
}
