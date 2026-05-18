export const revalidate = 3600;

export default function AboutPage() {
  return (
    <main className="hub-about">
      <header>
        <span className="eyebrow">— About Gather at the Grove —</span>
        <h1>A village marketplace that doesn&apos;t take a cut.</h1>
      </header>

      <section>
        <h2>What it is</h2>
        <p>
          Gather at the Grove is a federated discoverability layer for a small co-op of
          Appalachian agroforestry businesses. Today: three sister farms on one West
          Virginia hillside. Over time: more independent makers in the region who run
          their own Odoo + Stripe checkouts.
        </p>
        <p>
          We&apos;re a magazine and a directory. Each maker keeps full sovereignty over
          their own checkout, their own Stripe account, their own customer relationships.
          The hub never sees a transaction. The hub never takes a cut.
        </p>
      </section>

      <section>
        <h2>Why federated, not aggregated</h2>
        <p>
          Every marketplace platform that exists takes a percentage of each sale, holds
          the customer relationship, and charges for placement. Etsy, Amazon, Faire — same
          model with different paint. For makers selling under regional and community
          identity, that model is hostile. The customer becomes the platform&apos;s customer,
          not the maker&apos;s.
        </p>
        <p>
          Federation flips this. The hub points you at the maker&apos;s own shop, then gets
          out of the way. You become the maker&apos;s customer. The platform is a directory
          and a magazine, not a financial intermediary.
        </p>
      </section>

      <section>
        <h2>Why a journal at all</h2>
        <p>
          Because cooperative commerce in 2026 is a contested idea, and the people doing
          it are not going to win the argument with louder ads. They might win it with
          better writing. The journal is where we make the case — slowly, in long-form,
          with the texture of actual practice.
        </p>
      </section>
    </main>
  );
}
