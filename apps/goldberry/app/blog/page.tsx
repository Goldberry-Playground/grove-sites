/**
 * Blog listing page — will fetch from Ghost via @grove/ghost-client.
 * Currently renders a placeholder skeleton.
 */
export default function BlogPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-display font-bold text-primary mb-8">
        From the Grove
      </h1>
      <p className="text-foreground/60 mb-8">
        Stories, recipes, and farm updates — coming soon from our Ghost blog.
      </p>
      <div className="space-y-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <article
            key={i}
            className="rounded-lg border border-primary/10 p-6 animate-pulse"
          >
            <div className="h-5 bg-secondary/40 rounded w-2/3 mb-3" />
            <div className="h-4 bg-secondary/40 rounded w-full mb-2" />
            <div className="h-4 bg-secondary/40 rounded w-5/6" />
          </article>
        ))}
      </div>
    </div>
  );
}
