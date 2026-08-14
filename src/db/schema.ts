import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Reviews arrive from a pluggable source (see src/lib/sources). Everything a
 * source can tell us is stored verbatim; anything we derive (language, topics,
 * sentiment) lives alongside it so a re-sync never clobbers our own work.
 */

/**
 * Operators of the desk. Passwords are scrypt hashes (see lib/auth/password);
 * this table never holds anything reversible.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Stored lower-cased so sign-in is case-insensitive without a citext extension.
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  // operator | admin
  role: text("role").notNull().default("operator"),
  // Disabling beats deleting: replies keep pointing at a real person.
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Server-side sessions rather than a self-contained token, so that disabling an
 * account or signing out actually ends access immediately.
 *
 * Only the SHA-256 of the cookie value is stored — a leaked database dump
 * doesn't hand anyone a working session.
 */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(),
    // Google place_id, Business Profile location name, or a mock slug.
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    address: text("address"),
    city: text("city"),
    // Operational grouping (Chișinău sector or region). Derived from city and
    // address by lib/zones on every sync, never entered by hand.
    zone: text("zone").notNull().default("unassigned"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    googleUrl: text("google_url"),
    // Rating as Google reports it, kept for reconciliation against our own math.
    reportedRating: numeric("reported_rating", { precision: 2, scale: 1 }),
    reportedReviewCount: integer("reported_review_count"),
    active: boolean("active").notNull().default(true),
    /**
     * The same physical shop shows up once per source — as "Linella — Ciocana"
     * on Google and "Линелла" on Yandex. Pointing one at another makes the
     * target canonical: its page, its ratings and its zone totals absorb both.
     *
     * Null means this row is canonical (or standalone), which is the default,
     * so nothing changes until someone merges deliberately.
     */
    mergedInto: uuid("merged_into"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("locations_source_external_id").on(t.source, t.externalId),
    index("locations_zone_idx").on(t.zone),
    index("locations_merged_into_idx").on(t.mergedInto),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    authorName: text("author_name"),
    authorPhotoUrl: text("author_photo_url"),
    rating: integer("rating").notNull(),
    text: text("text"),
    // Detected from the review body: ro | ru | en | other.
    language: text("language"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    // A reply already posted on Google (by anyone), if the source exposes it.
    existingReplyText: text("existing_reply_text"),
    existingReplyAt: timestamp("existing_reply_at", { withTimezone: true }),
    // new | in_progress | replied | skipped
    status: text("status").notNull().default("new"),
    // positive | neutral | negative
    sentiment: text("sentiment"),
    topics: text("topics").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("reviews_source_external_id").on(t.source, t.externalId),
    index("reviews_location_idx").on(t.locationId),
    index("reviews_status_idx").on(t.status),
    index("reviews_published_idx").on(t.publishedAt),
  ],
);

/**
 * One row per AI-drafted reply option. A "generation" groups the variants
 * produced by a single model call so regenerating doesn't hide older batches.
 */
export const suggestions = pgTable(
  "suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    generationId: uuid("generation_id").notNull(),
    // apologetic | warm | concise — the operator picks the register that fits.
    tone: text("tone").notNull(),
    text: text("text").notNull(),
    language: text("language"),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suggestions_review_idx").on(t.reviewId)],
);

/** The reply the operator actually settled on and copied out to Google. */
export const replies = pgTable(
  "replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    // Null when the operator wrote it from scratch instead of picking a draft.
    suggestionId: uuid("suggestion_id").references(() => suggestions.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    // True when the final text differs from the suggestion it started as.
    edited: boolean("edited").notNull().default(false),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    // Display name snapshotted at publish time, so the audit trail survives a
    // rename or a deleted account.
    operator: text("operator"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("replies_review_idx").on(t.reviewId)],
);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  // running | ok | error
  status: text("status").notNull().default("running"),
  locationsUpserted: integer("locations_upserted").notNull().default(0),
  reviewsUpserted: integer("reviews_upserted").notNull().default(0),
  reviewsNew: integer("reviews_new").notNull().default(0),
  error: text("error"),
});

/** Single-row-per-key store for brand voice, default model, etc. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Suggestion = typeof suggestions.$inferSelect;
export type Reply = typeof replies.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
