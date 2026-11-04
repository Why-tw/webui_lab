import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { CanvasPreview } from "./CanvasPreview";
import type { Messages } from "../resources/locales";
import type { Project } from "../types/project";

type ProjectsPageProps = {
    projects: Project[];
    messages: Messages;
    storageError: boolean;
    onOpenProject: (project: Project) => void;
    onCreateProject: (name: string) => void;
    onDeleteProject: (projectId: string) => void;
    onRenameProject: (projectId: string, name: string) => void;
};

type ContextMenu = {
    projectId: string;
    x: number;
    y: number;
};

type ProjectDialog = {
    projectId: string;
    mode: "rename" | "details" | "delete";
};

export function ProjectsPage({
    projects,
    messages,
    storageError,
    onOpenProject,
    onCreateProject,
    onDeleteProject,
    onRenameProject,
}: ProjectsPageProps) {
    const [newProjectName, setNewProjectName] = useState("");
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
    const [dialog, setDialog] = useState<ProjectDialog | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const contextProject = projects.find((project) => project.id === contextMenu?.projectId);
    const dialogProject = projects.find((project) => project.id === dialog?.projectId);

    useEffect(() => {
        if (!contextMenu && !dialog) return;
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setContextMenu(null);
                setDialog(null);
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [contextMenu, dialog]);

    function createProject(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = newProjectName.trim();
        if (!name) return;
        onCreateProject(name);
        setNewProjectName("");
    }

    function showContextMenu(projectId: string, x: number, y: number) {
        setContextMenu({
            projectId,
            x: Math.min(x, window.innerWidth - 180),
            y: Math.min(y, window.innerHeight - 150),
        });
    }

    function startRename() {
        if (!contextProject) return;
        setRenameValue(contextProject.name);
        setDialog({ projectId: contextProject.id, mode: "rename" });
        setContextMenu(null);
    }

    function saveRename(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = renameValue.trim();
        if (!dialogProject || !name) return;
        onRenameProject(dialogProject.id, name);
        setDialog(null);
    }

    return (
        <section className="projects-page" aria-labelledby="projects-heading">
            <header className="projects-heading">
                <div>
                    <span className="eyebrow">{messages.projects.eyebrow}</span>
                    <h1 id="projects-heading">{messages.projects.title}</h1>
                    <p>{messages.projects.description}</p>
                </div>
                <form className="new-project-form" onSubmit={createProject}>
                    <input
                        value={newProjectName}
                        onChange={(event) => setNewProjectName(event.target.value)}
                        placeholder={messages.projects.namePlaceholder}
                        aria-label={messages.projects.namePlaceholder}
                        maxLength={60}
                        required
                    />
                    <button type="submit">{messages.projects.create}</button>
                </form>
            </header>
            {storageError && <p className="project-storage-error" role="alert">{messages.projects.storageError}</p>}
            <div className="project-list">
                {projects.map((project) => (
                    <article
                        className="project-card"
                        key={project.id}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            showContextMenu(project.id, event.clientX, event.clientY);
                        }}
                    >
                        <button className="project-card-open-button" type="button" onClick={() => onOpenProject(project)}>
                            <span className="project-card-art" aria-hidden="true">
                                <CanvasPreview
                                    layers={project.layers}
                                    width={project.canvasSize.width}
                                    height={project.canvasSize.height}
                                    className="project-canvas-preview"
                                />
                            </span>
                            <span className="project-card-details">
                                <strong>{project.name}</strong>
                                <span>{messages.projects.dimensions
                                    .replace("{width}", String(project.canvasSize.width))
                                    .replace("{height}", String(project.canvasSize.height))}</span>
                            </span>
                            <span className="project-card-open">{messages.projects.open}</span>
                        </button>
                        <button
                            className="project-card-more"
                            type="button"
                            aria-label={`${messages.projects.more}: ${project.name}`}
                            title={messages.projects.more}
                            aria-haspopup="menu"
                            onClick={(event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                showContextMenu(project.id, rect.right, rect.bottom);
                            }}
                        >
                            ⋯
                        </button>
                    </article>
                ))}
            </div>
            {contextMenu && contextProject && (
                <div className="project-menu-dismiss" onClick={() => setContextMenu(null)} onContextMenu={(event) => event.preventDefault()}>
                    <div
                        className="project-context-menu"
                        role="menu"
                        aria-label={messages.projects.contextMenu}
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button type="button" role="menuitem" onClick={startRename}>{messages.projects.rename}</button>
                        <button type="button" role="menuitem" onClick={() => {
                            setDialog({ projectId: contextProject.id, mode: "details" });
                            setContextMenu(null);
                        }}>{messages.projects.details}</button>
                        <button type="button" role="menuitem" className="danger" onClick={() => {
                            setDialog({ projectId: contextProject.id, mode: "delete" });
                            setContextMenu(null);
                        }}>{messages.projects.delete}</button>
                    </div>
                </div>
            )}
            {dialog && dialogProject && (
                <div className="modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setDialog(null);
                }}>
                    <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title">
                        <h2 id="project-dialog-title">
                            {dialog.mode === "rename" ? messages.projects.rename
                                : dialog.mode === "details" ? messages.projects.details
                                    : messages.projects.delete}
                        </h2>
                        {dialog.mode === "rename" && (
                            <form onSubmit={saveRename}>
                                <label>
                                    {messages.projects.namePlaceholder}
                                    <input
                                        autoFocus
                                        value={renameValue}
                                        onChange={(event) => setRenameValue(event.target.value)}
                                        maxLength={60}
                                        required
                                    />
                                </label>
                                <div className="project-dialog-actions">
                                    <button type="button" onClick={() => setDialog(null)}>{messages.projects.cancel}</button>
                                    <button type="submit" className="primary">{messages.projects.save}</button>
                                </div>
                            </form>
                        )}
                        {dialog.mode === "details" && (
                            <>
                                <dl className="project-details-list">
                                    <dt>{messages.projects.namePlaceholder}</dt>
                                    <dd>{dialogProject.name}</dd>
                                    <dt>{messages.projects.dimensionsLabel}</dt>
                                    <dd>{messages.projects.dimensions
                                        .replace("{width}", String(dialogProject.canvasSize.width))
                                        .replace("{height}", String(dialogProject.canvasSize.height))}</dd>
                                    <dt>{messages.projects.layerCount}</dt>
                                    <dd>{dialogProject.layers.length}</dd>
                                    <dt>{messages.projects.displayProfile}</dt>
                                    <dd>{messages.canvas[dialogProject.displayProfile === "ssd1306" ? "ssd1306" : dialogProject.displayProfile === "ssd1327" ? "ssd1327" : "customSize"]}</dd>
                                </dl>
                                <div className="project-dialog-actions">
                                    <button type="button" className="primary" onClick={() => setDialog(null)}>{messages.projects.close}</button>
                                </div>
                            </>
                        )}
                        {dialog.mode === "delete" && (
                            <>
                                <p>{messages.projects.deleteConfirm.replace("{name}", dialogProject.name)}</p>
                                <div className="project-dialog-actions">
                                    <button type="button" onClick={() => setDialog(null)}>{messages.projects.cancel}</button>
                                    <button type="button" className="danger" onClick={() => {
                                        onDeleteProject(dialogProject.id);
                                        setDialog(null);
                                    }}>{messages.projects.delete}</button>
                                </div>
                            </>
                        )}
                    </section>
                </div>
            )}
        </section>
    );
}
