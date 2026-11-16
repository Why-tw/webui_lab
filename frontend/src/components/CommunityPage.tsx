import { useCallback, useEffect, useRef, useState } from "react";

import { CanvasPreview } from "./CanvasPreview";
import type { Layer } from "../types/pixelEditor";

type CommunityMessages = {
    eyebrow: string;
    title: string;
    description: string;
    showFilters: string;
    hideFilters: string;
    filters: string;
    category: string;
    categories: {
        all: string;
        pixelArt: string;
        icons: string;
        devices: string;
    };
    size: string;
    allSizes: string;
    ssd1306: string;
    sort: string;
    newest: string;
    popular: string;
    loading: string;
    loadError: string;
    loadingMore: string;
    loadMoreError: string;
    retry: string;
    emptyTitle: string;
    emptyDescription: string;
    sharedBy: string;
    canvasSize: string;
    displayProfile: string;
};

type CommunityPageProps = {
    messages: CommunityMessages;
};

type SharedProject = {
    projectId: string;
    fileName: string;
    canvasSize: { width: number; height: number };
    displayProfile: "custom" | "ssd1306" | "ssd1327";
    authorName: string;
    createdAt: string;
    layers: Layer[];
};

type SharedProjectsPage = {
    projects: SharedProject[];
    hasMore: boolean;
};

const COMMUNITY_PAGE_SIZE = 20;

function isLayer(value: unknown): value is Layer {
    if (!value || typeof value !== "object") return false;
    const layer = value as Record<string, unknown>;
    return (
        typeof layer.id === "string" &&
        typeof layer.name === "string" &&
        typeof layer.visible === "boolean" &&
        Array.isArray(layer.pixels) &&
        layer.pixels.every((row) => Array.isArray(row) && row.every((pixel) => pixel === null || typeof pixel === "string"))
    );
}

function isSharedProject(value: unknown): value is SharedProject {
    if (!value || typeof value !== "object") return false;
    const project = value as Record<string, unknown>;
    if (!project.canvasSize || typeof project.canvasSize !== "object") return false;
    const canvasSize = project.canvasSize as Record<string, unknown>;
    return (
        typeof project.projectId === "string" &&
        typeof project.fileName === "string" &&
        typeof canvasSize.width === "number" &&
        typeof canvasSize.height === "number" &&
        (project.displayProfile === "custom" || project.displayProfile === "ssd1306" || project.displayProfile === "ssd1327") &&
        typeof project.authorName === "string" &&
        typeof project.createdAt === "string" &&
        Array.isArray(project.layers) &&
        project.layers.every(isLayer)
    );
}

function isSharedProjectsPage(value: unknown): value is SharedProjectsPage {
    if (!value || typeof value !== "object") return false;
    const page = value as Record<string, unknown>;
    return typeof page.hasMore === "boolean" &&
        Array.isArray(page.projects) &&
        page.projects.every(isSharedProject);
}

export function CommunityPage({ messages }: CommunityPageProps) {
    const communityScrollRef = useRef<HTMLElement>(null);
    const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
    const loadingMoreRef = useRef(false);
    const [filtersVisible, setFiltersVisible] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(["all"]);
    const [projects, setProjects] = useState<SharedProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextOffset, setNextOffset] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        async function loadProjects() {
            try {
                const response = await fetch(
                    `/api/projects/shared?limit=${COMMUNITY_PAGE_SIZE}&offset=0`,
                    { signal: controller.signal },
                );
                if (!response.ok) throw new Error("Unable to load shared projects.");
                const result: unknown = await response.json();
                if (!isSharedProjectsPage(result)) {
                    throw new Error("The server returned invalid shared project data.");
                }
                setProjects(result.projects);
                setHasMore(result.hasMore && result.projects.length > 0);
                setNextOffset(result.projects.length);
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setLoadError(true);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void loadProjects();
        return () => controller.abort();
    }, []);

    const loadMoreProjects = useCallback(async () => {
        if (!hasMore || loadingMoreRef.current) return;

        loadingMoreRef.current = true;
        setLoadingMore(true);
        setLoadMoreError(false);
        try {
            const response = await fetch(
                `/api/projects/shared?limit=${COMMUNITY_PAGE_SIZE}&offset=${nextOffset}`,
            );
            if (!response.ok) throw new Error("Unable to load more shared projects.");
            const result: unknown = await response.json();
            if (!isSharedProjectsPage(result)) {
                throw new Error("The server returned invalid shared project data.");
            }
            setProjects((current) => {
                const existingIds = new Set(current.map((project) => project.projectId));
                return [...current, ...result.projects.filter((project) => !existingIds.has(project.projectId))];
            });
            setNextOffset((current) => current + result.projects.length);
            setHasMore(result.hasMore && result.projects.length > 0);
        } catch {
            setLoadMoreError(true);
        } finally {
            loadingMoreRef.current = false;
            setLoadingMore(false);
        }
    }, [hasMore, nextOffset]);

    useEffect(() => {
        const root = communityScrollRef.current;
        const sentinel = loadMoreSentinelRef.current;
        if (!root || !sentinel || loading || loadError || loadMoreError || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    void loadMoreProjects();
                }
            },
            { root, rootMargin: "300px 0px" },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, loadError, loadMoreError, loadMoreProjects, loading]);

    function toggleCategory(category: string) {
        setSelectedCategories((current) => {
            if (category === "all") return ["all"];
            const next = current.includes(category)
                ? current.filter((item) => item !== category)
                : [...current.filter((item) => item !== "all"), category];
            return next.length ? next : ["all"];
        });
    }

    return (
        <section
            ref={communityScrollRef}
            className={`community-page ${filtersVisible ? "filters-visible" : "filters-hidden"}`}
            aria-labelledby="community-heading"
        >
            <header className="community-heading">
                <div>
                    <span className="eyebrow">{messages.eyebrow}</span>
                    <h1 id="community-heading">{messages.title}</h1>
                    <p>{messages.description}</p>
                </div>
                <button
                    className="community-filter-toggle"
                    type="button"
                    aria-expanded={filtersVisible}
                    aria-controls="community-filters"
                    onClick={() => setFiltersVisible((visible) => !visible)}
                >
                    <span aria-hidden="true">{filtersVisible ? "◧" : "☷"}</span>
                    {filtersVisible ? messages.hideFilters : messages.showFilters}
                </button>
            </header>
            <div className="community-layout">
                <aside
                    className="community-filters"
                    id="community-filters"
                    aria-label={messages.filters}
                    hidden={!filtersVisible}
                >
                    <h2>{messages.filters}</h2>
                    <fieldset>
                        <legend>{messages.category}</legend>
                        {Object.entries(messages.categories).map(([id, label]) => (
                            <label className="community-filter-option" key={id}>
                                <input
                                    type="checkbox"
                                    checked={selectedCategories.includes(id)}
                                    onChange={() => toggleCategory(id)}
                                />
                                <span>{label}</span>
                            </label>
                        ))}
                    </fieldset>
                    <label className="community-select-filter">
                        <span>{messages.size}</span>
                        <select defaultValue="all">
                            <option value="all">{messages.allSizes}</option>
                            <option value="ssd1306">{messages.ssd1306}</option>
                        </select>
                    </label>
                    <label className="community-select-filter">
                        <span>{messages.sort}</span>
                        <select defaultValue="newest">
                            <option value="newest">{messages.newest}</option>
                            <option value="popular">{messages.popular}</option>
                        </select>
                    </label>
                </aside>
                <div className="community-projects">
                    <div className="community-project-grid" aria-live="polite">
                        {loading ? (
                            <div className="community-empty-state" role="status">
                                <h2>{messages.loading}</h2>
                            </div>
                        ) : loadError ? (
                            <div className="community-empty-state" role="alert">
                                <h2>{messages.loadError}</h2>
                            </div>
                        ) : projects.length ? (
                            projects.map((project) => (
                                <article className="community-project-card" key={project.projectId}>
                                    <div className="community-project-preview" aria-hidden="true">
                                        <CanvasPreview
                                            layers={project.layers}
                                            width={project.canvasSize.width}
                                            height={project.canvasSize.height}
                                            className="community-project-canvas-preview"
                                        />
                                    </div>
                                    <div className="community-project-card-details">
                                        <h2>{project.fileName}</h2>
                                        <p>{messages.sharedBy}: {project.authorName}</p>
                                        <p>{messages.canvasSize}: {project.canvasSize.width} × {project.canvasSize.height}</p>
                                        <p>{messages.displayProfile}: {project.displayProfile.toUpperCase()}</p>
                                        <time dateTime={project.createdAt}>{project.createdAt}</time>
                                    </div>
                                </article>
                            ))
                        ) : (
                            <div className="community-empty-state">
                                <span className="community-empty-icon" aria-hidden="true">▧</span>
                                <h2>{messages.emptyTitle}</h2>
                                <p>{messages.emptyDescription}</p>
                            </div>
                        )}
                    </div>
                    {hasMore && !loading && projects.length > 0 && (
                        <div className="community-load-more-sentinel" ref={loadMoreSentinelRef} aria-hidden="true" />
                    )}
                    {loadingMore && <p className="community-more-status" role="status">{messages.loadingMore}</p>}
                    {loadMoreError && (
                        <div className="community-more-status" role="alert">
                            <span>{messages.loadMoreError}</span>
                            <button type="button" onClick={() => void loadMoreProjects()}>{messages.retry}</button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
