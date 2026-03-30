import { Button } from "@grove/ui";

const tenantSites = [
  {
    name: "Goldberry Grove Farm",
    description: "Farm-fresh produce, artisan goods, and seasonal offerings.",
    href: "https://goldberrygrove.farm",
    color: "bg-amber-50 border-amber-200",
  },
  {
    name: "Gathering Grove Gardens",
    description: "Community garden plots, workshops, and growing resources.",
    href: "https://gatheringgrovegardens.com",
    color: "bg-sky-50 border-sky-200",
  },
  {
    name: "The Grove Nursery",
    description: "Native plants, trees, and garden supplies for every season.",
    href: "https://thegrovenursery.com",
    color: "bg-pink-50 border-pink-200",
  },
];

export default function HubPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <section className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-primary mb-4">
          Gathering at the Grove
        </h1>
        <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
          A community of growers, makers, and neighbors. Explore our family of
          sites and find your place in the grove.
        </p>
      </section>

      <section className="grid gap-8 md:grid-cols-3">
        {tenantSites.map((site) => (
          <a
            key={site.name}
            href={site.href}
            className={`rounded-xl border-2 p-6 transition-shadow hover:shadow-lg ${site.color}`}
          >
            <h2 className="text-xl font-display font-semibold mb-2">
              {site.name}
            </h2>
            <p className="text-sm text-foreground/60 mb-4">
              {site.description}
            </p>
            <Button variant="ghost" size="sm">
              Visit site &rarr;
            </Button>
          </a>
        ))}
      </section>
    </div>
  );
}
