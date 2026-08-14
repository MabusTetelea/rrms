ALTER TABLE "locations" ADD COLUMN "zone" text DEFAULT 'unassigned' NOT NULL;--> statement-breakpoint
CREATE INDEX "locations_zone_idx" ON "locations" USING btree ("zone");