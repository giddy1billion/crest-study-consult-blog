import type { Route } from "./+types/admin-logout";
import { redirect } from "react-router";
import { logout, getAdminUser } from "~/utils/session.server";
import { recordAdminAudit, AUDIT_ACTIONS, AUDIT_RESOURCES } from "~/utils/audit.server";

/**
 * Logout action - destroys session and redirects to login
 */
export async function loader({ request }: Route.LoaderArgs) {
  const actor = await getAdminUser(request);
  if (actor) {
    await recordAdminAudit(actor, {
      request,
      action: AUDIT_ACTIONS.LOGOUT,
      resource: AUDIT_RESOURCES.AUTH,
      resourceId: actor.id,
    });
  }
  return logout(request);
}

export async function action({ request }: Route.ActionArgs) {
  const actor = await getAdminUser(request);
  if (actor) {
    await recordAdminAudit(actor, {
      request,
      action: AUDIT_ACTIONS.LOGOUT,
      resource: AUDIT_RESOURCES.AUTH,
      resourceId: actor.id,
    });
  }
  return logout(request);
}
