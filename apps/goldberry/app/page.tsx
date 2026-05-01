import Link from "next/link";
import { Button } from "@grove/ui";
import { tenantConfig } from "../tenant.config";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-display font-bold text-primary mb-4">
          Welcome to {tenantConfig.name}
        </h1>
        <p className="text-lg text-foreground/70 mb-8 max-w-2xl mx-auto">
          {tenantConfig.description}
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/shop">
            <Button variant="primary" size="lg">
              Browse the Shop
            </Button>
          </Link>
          <Link href="/blog">
            <Button variant="ghost" size="lg">
              Read the Blog
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
