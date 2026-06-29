import Link from "next/link";
import { BRANDS, BRAND_LABELS } from "./lib/brands";

export default function Home() {
  return (
    <main className="home">
      <h1>Grove Component QA</h1>
      <ul>
        {BRANDS.map((b) => (
          <li key={b}>
            <Link href={`/${b}`}>{BRAND_LABELS[b]}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
