import type { Route } from "./+types/admin-logout";
import { redirect } from "react-router";
import { logout } from "~/utils/session.server";

/**
 * Logout action - destroys session and redirects to login
 */
export async function loader({ request }: Route.LoaderArgs) {
  return logout(request);
}

export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}
