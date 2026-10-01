import Link from "next/link";
import {
  ADMIN_HELP_CATEGORIES,
  findAdminHelpArticles,
} from "@/lib/admin-help-library";
import { PORTAL_CREATION_GUIDE } from "@/lib/portal-creation-guide";
import styles from "@/app/(admin)/help/help.module.css";

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
  const showMoreHelp = Boolean(search || category);

  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Portal creation</p>
          <h1>Portal creation — quick guide</h1>
          <p className="muted">
            Keep it simple: collect the source data, complete the templates in order, Preview, Apply, then QA.
          </p>
        </div>
        <Link className="button button-secondary button-link" href="/migrations">Portal migrations</Link>
      </header>

      <section className={styles.guideIntro}>
        <div className={styles.introCard}>
          <p className="eyebrow">Before you start</p>
          <h2>Create the request first</h2>
          <p className="muted">
            One portal equals one company hierarchy. Create the migration record so ownership, blockers and progress have somewhere to live.
          </p>
          <div className="button-row">
            <Link className="button button-link" href="/migrations">Open Portal migrations</Link>
          </div>
        </div>

        <div className={styles.introCard}>
          <p className="eyebrow">You should receive</p>
          <div className={styles.sourceList}>
            <div className={styles.sourceItem}>
              <span className={styles.sourceNumber}>1</span>
              <span>Current company hierarchy</span>
            </div>
            <div className={styles.sourceItem}>
              <span className={styles.sourceNumber}>2</span>
              <span>Proposed SKU list</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.steps} aria-label="Portal creation steps">
        {PORTAL_CREATION_GUIDE.slice(1).map((step) => (
          <article className={styles.step} key={step.number}>
            <span className={styles.stepNumber} aria-hidden="true">{step.number}</span>

            <div className={styles.stepBody}>
              <h2>{step.title}</h2>
              <p>{step.summary}</p>
              {step.bullets?.length ? (
                <ul>
                  {step.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              ) : null}
            </div>

            <div className={styles.actions}>
              {step.actions.map((action) => (
                <Link
                  className={`${action.primary ? "button" : "button button-secondary"} button-link button-compact ${styles.actionLink}`}
                  href={action.href}
                  key={`${step.number}-${action.href}`}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>

      <details className={`card ${styles.moreHelp}`} open={showMoreHelp}>
        <summary>More help / common questions</summary>

        <div className={styles.moreHelpBody}>
          <p className="muted">
            Only open this bit when you need it. The quick guide above is enough for the normal migration flow.
          </p>

          <form method="get" className={styles.searchForm}>
            <div className="field">
              <label htmlFor="help-search">Search</label>
              <input
                id="help-search"
                name="q"
                type="search"
                defaultValue={search}
                placeholder="Roles, products, purchase controls…"
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

            <div className={`button-row ${styles.searchActions}`}>
              <button className="button button-compact" type="submit">Search</button>
              <Link className="button button-secondary button-link button-compact" href="/help">Reset</Link>
            </div>
          </form>

          <div className={styles.faqList}>
            {articles.map((article) => (
              <details className={styles.faqItem} id={article.slug} key={article.slug} open={Boolean(search)}>
                <summary>{article.title}</summary>
                <p className="muted">{article.summary}</p>

                <div className={styles.faqSections}>
                  {article.sections.map((section) => (
                    <section className={styles.faqSection} key={section.heading}>
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

            {!articles.length ? (
              <div className="notice">No matching help article. Try a broader term or reset the filters.</div>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}
