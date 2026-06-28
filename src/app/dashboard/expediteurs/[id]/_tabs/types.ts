// ─────────────────────────────────────────────────────────────────────────────
// TAB CONTRACT for the merchant (expéditeur) ERP fiche.
//
// Every tab under ./_tabs/<Name>.tsx is a DEFAULT-exported React component that
// receives exactly these props from the shell (page.tsx). Keep this stable —
// the shell renders the active tab as <Component {...ExpTabProps} />.
// ─────────────────────────────────────────────────────────────────────────────
import type { StaffUser } from "@/lib/users";
import type { Tokens } from "../../../_ui";

export interface ExpTabProps {
  /** Merchant (expéditeur) user id from the dynamic route segment. */
  userId: number;
  /** The fully-loaded merchant record (header + relations) from getUser(id). */
  user: StaffUser;
  /** Theme tokens (dark/light) resolved by the shell. */
  t: Tokens;
}
