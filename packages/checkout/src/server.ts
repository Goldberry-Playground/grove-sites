// Server-only entry. Route handler factories and the server-rendered
// order success page live here. Importing from "@grove/checkout/server"
// keeps these out of client bundles.
//
// The `server-only` marker makes accidental client imports a build-time
// error, so a future refactor that pulls OdooClient configuration into a
// factory file can't silently leak backend credentials into the browser
// bundle.
import "server-only";

export { createCartRoute } from "./api/createCartRoute";
export {
  createCheckoutRoute,
  createCheckoutSessionRoute,
} from "./api/createCheckoutRoute";
export { createOrderSuccessPage } from "./components/createOrderSuccessPage";
export { createCheckoutSuccessPage } from "./components/createCheckoutSuccessPage";
