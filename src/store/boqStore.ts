import type { BoqLine, BoqProject, BoqTerms } from "@/core/types";
import { DEFAULT_TERMS, newId, newLine, newProject } from "@/core/boq";
import { emit, readJson, writeJson } from "./pubsub";

const KEY = "ccs.boq.v1";
const ACTIVE_KEY = "ccs.boq.active.v1";

interface Persisted {
    projects: BoqProject[];
    activeId: string | null;
}

/**
 * Repairs a project loaded from storage.
 *
 * Stored data may come from an older build, or a partly written record, so every
 * field is coerced rather than trusted. A corrupt bill must never crash the app.
 */
function normaliseProject(raw: unknown): BoqProject | null {
    if (!raw || typeof raw !== "object") return null;
    const p = raw as Partial<BoqProject>;
    if (typeof p.id !== "string") return null;

    const terms: BoqTerms = {
        contingency: numberOr(p.terms?.contingency, DEFAULT_TERMS.contingency),
        overhead: numberOr(p.terms?.overhead, DEFAULT_TERMS.overhead),
        tax: numberOr(p.terms?.tax, DEFAULT_TERMS.tax),
    };

    const lines: BoqLine[] = Array.isArray(p.lines)
        ? p.lines.map((line) => ({
              id: typeof line?.id === "string" ? line.id : newId("line"),
              description:
                  typeof line?.description === "string" ? line.description : "",
              unit:
                  typeof line?.unit === "string" && line.unit
                      ? line.unit
                      : "m³",
              quantity: numberOr(line?.quantity, 0),
              rate: numberOr(line?.rate, 0),
              remarks: typeof line?.remarks === "string" ? line.remarks : "",
          }))
        : [];

    return {
        id: p.id,
        name: typeof p.name === "string" && p.name ? p.name : "Untitled BOQ",
        client: typeof p.client === "string" ? p.client : "",
        currency:
            typeof p.currency === "string" && p.currency ? p.currency : "BDT",
        lines: lines.length > 0 ? lines : [newLine()],
        terms,
        createdAt: numberOr(p.createdAt, Date.now()),
        updatedAt: numberOr(p.updatedAt, Date.now()),
    };
}

function numberOr(value: unknown, fallback: number): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function load(): Persisted {
    const raw = readJson<Partial<Persisted>>(KEY, {
        projects: [],
        activeId: null,
    });

    const projects = Array.isArray(raw.projects)
        ? raw.projects
              .map(normaliseProject)
              .filter((p): p is BoqProject => p !== null)
        : [];

    // Seed one blank bill so the screen is never empty on a first visit.
    if (projects.length === 0) {
        const seed = newProject("New BOQ");
        return { projects: [seed], activeId: seed.id };
    }

    const storedActive = readJson<string | null>(ACTIVE_KEY, null);
    const activeId =
        typeof raw.activeId === "string" &&
        projects.some((p) => p.id === raw.activeId)
            ? raw.activeId
            : typeof storedActive === "string" &&
                projects.some((p) => p.id === storedActive)
              ? storedActive
              : projects[0].id;

    return { projects, activeId };
}

let state: Persisted = load();

function persist(): void {
    writeJson(KEY, state);
    writeJson(ACTIVE_KEY, state.activeId);
    emit();
}

/** Replace the active project with the result of `update`. */
function updateActive(update: (project: BoqProject) => BoqProject): void {
    const index = state.projects.findIndex((p) => p.id === state.activeId);
    if (index === -1) return;

    const next = update(state.projects[index]);
    state = {
        ...state,
        projects: state.projects.map((p, i) =>
            i === index ? { ...next, updatedAt: Date.now() } : p,
        ),
    };
    persist();
}

/* ------------------------------ Projects ----------------------------- */

export function getProjects(): BoqProject[] {
    return state.projects;
}

export function getActiveId(): string | null {
    return state.activeId;
}

export function getActiveProject(): BoqProject | null {
    return state.projects.find((p) => p.id === state.activeId) ?? null;
}

export function setActiveProject(id: string): void {
    if (!state.projects.some((p) => p.id === id)) return;
    state = { ...state, activeId: id };
    persist();
}

export function createProject(name: string): string {
    const project = newProject(name.trim() || "New BOQ");
    state = { projects: [...state.projects, project], activeId: project.id };
    persist();
    return project.id;
}

export function duplicateProject(id: string): string | null {
    const source = state.projects.find((p) => p.id === id);
    if (!source) return null;

    const copy: BoqProject = {
        ...source,
        id: newId("boq"),
        name: `${source.name} (copy)`,
        // Give every line a fresh id so the two bills are independent.
        lines: source.lines.map((line) => ({ ...line, id: newId("line") })),
        terms: { ...source.terms },
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    state = { projects: [...state.projects, copy], activeId: copy.id };
    persist();
    return copy.id;
}

export function deleteProject(id: string): void {
    const remaining = state.projects.filter((p) => p.id !== id);

    // Never leave the user with nothing — seed a blank bill instead.
    if (remaining.length === 0) {
        const seed = newProject("New BOQ");
        state = { projects: [seed], activeId: seed.id };
    } else {
        state = {
            projects: remaining,
            activeId: state.activeId === id ? remaining[0].id : state.activeId,
        };
    }
    persist();
}

export function renameProject(name: string): void {
    updateActive((project) => ({ ...project, name }));
}

export function updateProjectDetails(details: Partial<BoqProject>): void {
    updateActive((project) => ({ ...project, ...details }));
}

export function updateTerms(terms: Partial<BoqTerms>): void {
    updateActive((project) => ({
        ...project,
        terms: { ...project.terms, ...terms },
    }));
}

/* -------------------------------- Lines ------------------------------ */

export function addLine(partial: Partial<BoqLine> = {}): void {
    updateActive((project) => ({
        ...project,
        lines: [...project.lines, newLine(partial)],
    }));
}

export function updateLine(id: string, changes: Partial<BoqLine>): void {
    updateActive((project) => ({
        ...project,
        lines: project.lines.map((line) =>
            line.id === id ? { ...line, ...changes } : line,
        ),
    }));
}

export function removeLine(id: string): void {
    updateActive((project) => {
        const lines = project.lines.filter((line) => line.id !== id);
        // Keep one editable row so the table never collapses to nothing.
        return { ...project, lines: lines.length > 0 ? lines : [newLine()] };
    });
}

/** Move a line up (-1) or down (+1). */
export function moveLineBy(id: string, offset: number): void {
    updateActive((project) => {
        const from = project.lines.findIndex((line) => line.id === id);
        if (from === -1) return project;

        const to = from + offset;
        if (to < 0 || to >= project.lines.length) return project;

        const lines = [...project.lines];
        const [moved] = lines.splice(from, 1);
        lines.splice(to, 0, moved);
        return { ...project, lines };
    });
}

export function clearLines(): void {
    updateActive((project) => ({ ...project, lines: [newLine()] }));
}
