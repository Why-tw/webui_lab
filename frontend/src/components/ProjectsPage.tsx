import { useState } from "react";
import type { FormEvent } from "react";

import type { Messages } from "../resources/locales";
import type { Project } from "../types/project";

type ProjectsPageProps = {
    projects: Project[];
    messages: Messages;
    storageError: boolean;
    onOpenProject: (project: Project) => void;
    onCreateProject: (name: string) => void;
};

export function ProjectsPage({ projects, messages, storageError, onOpenProject, onCreateProject }: ProjectsPageProps) {
    const [newProjectName, setNewProjectName] = useState("");

    function createProject(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = newProjectName.trim();
        if (!name) return;
        onCreateProject(name);
        setNewProjectName("");
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
                    <button
                        className="project-card"
                        type="button"
                        key={project.id}
                        onClick={() => onOpenProject(project)}
                    >
                        <span className="project-card-art" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                            <span />
                        </span>
                        <span className="project-card-details">
                            <strong>{project.name}</strong>
                            <span>{messages.projects.dimensions
                                .replace("{width}", String(project.canvasSize.width))
                                .replace("{height}", String(project.canvasSize.height))}</span>
                        </span>
                        <span className="project-card-open">{messages.projects.open}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}
