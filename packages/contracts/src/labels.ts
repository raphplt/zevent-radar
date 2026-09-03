export const GOAL_CATEGORIES = ["donation", "global", "incentive", "recurrent", "donation_equal", "donation_more_than", "donation_largest", "other"] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const GOAL_STATUSES = ["pending", "verified", "reached", "accomplished", "rejected", "superseded"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  donation: "Cagnotte atteint X €",
  global: "Cagnotte globale atteint X €",
  incentive: "Incentive dédié",
  recurrent: "Tous les X €",
  donation_equal: "Don égal à X €",
  donation_more_than: "Don supérieur ou égal à X €",
  donation_largest: "Plus gros don",
  other: "Autre"
};

export const REPORT_KINDS = ["goal_added", "goal_updated", "goal_accomplished", "challenge_live", "important_announcement", "interesting_moment", "data_error"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  goal_added: "Nouveau donation goal",
  goal_updated: "Goal modifié",
  goal_accomplished: "Goal accompli",
  challenge_live: "Défi en cours",
  important_announcement: "Annonce importante",
  interesting_moment: "Moment intéressant",
  data_error: "Erreur de données"
};

export const TEMPORARY_REPORT_KINDS: ReadonlySet<ReportKind> = new Set(["challenge_live", "interesting_moment", "important_announcement"]);
