import "./recipes.css";

/** GOL-3435: shared wrapper for /recipes and /recipes/[id] (scopes recipes.css). */
export default function RecipesLayout({ children }: { children: React.ReactNode }) {
  return <div className="recipes-page">{children}</div>;
}
