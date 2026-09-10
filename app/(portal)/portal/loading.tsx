import styles from "@/components/portal/portal-feedback.module.css";

export default function PortalLoading() {
  return (
    <section className={styles.loading} aria-busy="true" aria-live="polite">
      <span className={styles.srOnly}>Loading Company Portal</span>
      <div className={styles.loadingHero} aria-hidden="true">
        <div className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
        <div className={`${styles.loadingLine} ${styles.loadingLineMedium}`} />
        <div className={`${styles.loadingLine} ${styles.loadingLineLong}`} />
      </div>
      <div className={styles.loadingCards} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className={styles.loadingCard} key={index}>
            <div className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
            <div className={`${styles.loadingLine} ${styles.loadingLineMedium}`} />
            <div className={`${styles.loadingLine} ${styles.loadingLineLong}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
