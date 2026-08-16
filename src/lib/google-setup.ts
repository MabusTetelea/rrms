import "server-only";
import { getReviewSources } from "@/lib/sources";

/**
 * What the Settings page reports about the Google connection.
 *
 * Deliberately only ever says whether each value is *present* — never what it
 * is. A secret that can be read back out of a settings screen is a secret that
 * leaks through a shoulder, a screenshot or a support call.
 *
 * The values themselves stay in .env.local rather than in the database. A
 * browser form that accepts an OAuth client secret would mean storing it in
 * plain text in Postgres and shipping it to whoever opens the page — worse than
 * a file on the server that only a deployer can read.
 */
export type GoogleRequirement = {
  /** i18n key under settings.google.req. */
  key: "clientId" | "clientSecret" | "refreshToken" | "accountId";
  /** The environment variable that supplies it. */
  env: string;
  present: boolean;
};

export type GoogleSetup = {
  requirements: GoogleRequirement[];
  /** All four credentials present. */
  credentialsReady: boolean;
  /** REVIEW_SOURCE includes gbp, so reviews are read from Google. */
  readingGoogle: boolean;
  /** PUBLISH_REPLIES=true, the separate switch for writing back. */
  publishingOn: boolean;
  /** Everything needed for the Publish button to appear. */
  connected: boolean;
};

export function googleSetup(): GoogleSetup {
  const requirements: GoogleRequirement[] = [
    { key: "clientId", env: "GBP_CLIENT_ID", present: Boolean(process.env.GBP_CLIENT_ID) },
    {
      key: "clientSecret",
      env: "GBP_CLIENT_SECRET",
      present: Boolean(process.env.GBP_CLIENT_SECRET),
    },
    {
      key: "refreshToken",
      env: "GBP_REFRESH_TOKEN",
      present: Boolean(process.env.GBP_REFRESH_TOKEN),
    },
    {
      key: "accountId",
      env: "GBP_ACCOUNT_ID",
      present: Boolean(process.env.GBP_ACCOUNT_ID),
    },
  ];

  const credentialsReady = requirements.every((r) => r.present);
  const readingGoogle = getReviewSources().some((source) => source.name === "gbp");
  const publishingOn = process.env.PUBLISH_REPLIES === "true";

  return {
    requirements,
    credentialsReady,
    readingGoogle,
    publishingOn,
    connected: credentialsReady && readingGoogle && publishingOn,
  };
}
