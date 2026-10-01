import Link from "next/link";
import {
  ADMIN_HELP_CATEGORIES,
  findAdminHelpArticles,
} from "@/lib/admin-help-library";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminHelpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const search = first(query.q)?.trim() ?? "";
  const category = first(query.category)?.trim() ?? "";
  const articles = findAdminHelpArticles(search, category);

  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Staff knowledge base</p>
          <h1>Help & how-to</h1>
          <p className="muted">
            The current Admin workflow in one searchable place, rather than somewhere around message 147 in a Teams chat.
          </p>
        </div>
        <Link className="button button-secondary button-link" href="/migrations">Portal migrations</Link>
      </header>

      <form method="get" className="card form-grid">
        <div className="field">
          <label htmlFor="help-search">Search help</label>
          <input
            id="help-search"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Roles, company products, purchase controls…"
          />
        </div>
        <div className="field">
          <label htmlFor="help-category">Category</label>
          <select id="help-category" name="category" defaultValue={category}>
            <option value="">All categories</option>
            {ADMIN_HELP_CATEGORIES.map((item) => (
              <option value={item} key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="button-row span-2">
          <button className="button" type="submit">Search</button>
          <Link className="button button-secondary button-link" href="/help">Reset</Link>
          <span className="muted small-text">{articles.length} article{articles.length === 1 ? "" : "s"}</span>
        </div>
      </form>

      <section className="grid" aria-label="Help articles">
        {articles.map((article) => (
          <details
            className="card stack"
            id={article.slug}
            key={article.slug}
            open={Boolean(search)}
          >
            <summary>
              <strong>{article.title}</strong>
              <span className="badge badge-neutral" style={{ marginLeft: "0.65rem" }}>{article.category}</span>
            </summary>
            <p className="muted">{article.summary}</p>
            <div className="stack">
              {article.sections.map((section) => (
                <section className="nested-card card" key={section.heading}>
                  <h3>{section.heading}</h3>
                  <p>{section.body}</p>
                  {section.bullets?.length ? (
                    <ul className="compact-list">
                      {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </details>
        ))}
      </section>

      {!articles.length ? (
        <section className="card stack">
          <h2>No matching help article</h2>
          <p className="muted">Try a broader term or clear the category filter.</p>
          <Link className="button button-secondary button-link" href="/help">Show all help</Link>
        </section>
      ) : null}
    </div>
  );
}
