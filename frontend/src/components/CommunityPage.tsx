import { useState } from "react";

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
    sort: string;
    newest: string;
    popular: string;
    emptyTitle: string;
    emptyDescription: string;
};

type CommunityPageProps = {
    messages: CommunityMessages;
};

export function CommunityPage({ messages }: CommunityPageProps) {
    const [filtersVisible, setFiltersVisible] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(["all"]);

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
        <section className={`community-page ${filtersVisible ? "filters-visible" : "filters-hidden"}`} aria-labelledby="community-heading">
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
                        <div className="community-empty-state">
                            <span className="community-empty-icon" aria-hidden="true">▧</span>
                            <h2>{messages.emptyTitle}</h2>
                            <p>{messages.emptyDescription}</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
