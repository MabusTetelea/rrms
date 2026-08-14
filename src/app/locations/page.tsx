import { PageHeader } from "@/components/shell";
import { StoreSearch } from "@/components/store-search";
import { StoreStrip } from "@/components/store-strip";
import { getDict, plural, type Dict, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { getStoreStats, type StoreStats } from "@/lib/queries";
import { isZoneId, ZONE_IDS, ZONE_META, type ZoneId } from "@/lib/zones";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDict(locale);

  const q = one(params.q);
  const zoneParam = one(params.zone);
  const zone = isZoneId(zoneParam) ? zoneParam : undefined;

  // The unfiltered set drives the zone dropdown counts, so they stay stable
  // while the operator narrows the list.
  const [all, matches] = await Promise.all([
    getStoreStats(),
    getStoreStats({ q, zone }),
  ]);

  const countByZone = new Map<ZoneId, number>();
  for (const store of all) {
    countByZone.set(store.zone, (countByZone.get(store.zone) ?? 0) + 1);
  }

  const zoneOptions = ZONE_IDS.filter((id) => countByZone.has(id)).map((id) => ({
    id,
    label: t.zones[id],
    count: countByZone.get(id) ?? 0,
  }));

  // Group matches into zones, keeping ZONE_IDS order so the capital's sectors
  // always come before the regions.
  const grouped = ZONE_IDS.map((id) => ({
    zone: id,
    stores: matches.filter((store) => store.zone === id),
  })).filter((group) => group.stores.length > 0);

  return (
    <>
      <PageHeader
        title={t.locations.title}
        subtitle={t.locations.subtitle}
        actions={
          <StoreSearch
            zones={zoneOptions}
            searchLabel={t.locations.search}
            allZonesLabel={t.locations.allZones}
            clearLabel={t.locations.clear}
          />
        }
      />

      <div className="px-5 py-6 md:px-8 md:py-8">
        <p className="mb-4 font-mono text-[11px] text-ink-faint">
          {t.locations.showing}:{" "}
          <span className="tabular">
            {matches.length === all.length
              ? plural(locale, all.length, t.plurals.stores)
              : `${matches.length} / ${plural(locale, all.length, t.plurals.stores)}`}
          </span>
        </p>

        {grouped.length === 0 ? (
          <div className="border border-rule bg-surface px-5 py-12 text-center">
            <p className="font-medium">{t.locations.noMatches}</p>
            <p className="mt-1 text-sm text-ink-faint">{t.locations.noMatchesBody}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <ZoneGroup
                key={group.zone}
                zone={group.zone}
                stores={group.stores}
                t={t}
                locale={locale}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ZoneGroup({
  zone,
  stores,
  t,
  locale,
}: {
  zone: ZoneId;
  stores: StoreStats[];
  t: Dict;
  locale: Locale;
}) {
  const unanswered = stores.reduce((sum, s) => sum + s.unanswered, 0);
  const meta = ZONE_META[zone];

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-ink pb-1.5">
        <h2 className="flex items-baseline gap-2.5 text-[15px] font-semibold">
          <span className="tabular font-mono text-[11px] tracking-[0.1em] text-ink-faint">
            {meta.code}
          </span>
          {t.zones[zone]}
        </h2>
        <p className="font-mono text-[11px] text-ink-faint">
          <span className="tabular">
            {plural(locale, stores.length, t.plurals.stores)}
          </span>
          {unanswered > 0 ? (
            <>
              <span aria-hidden="true"> · </span>
              <span className="tabular text-brand">
                {unanswered} {t.common.unanswered}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-5 px-3 pt-2 pb-1 sm:grid-cols-[auto_minmax(0,1fr)_minmax(120px,200px)_auto] sm:px-4">
        <span className="eyebrow">{t.locations.code}</span>
        <span className="eyebrow">{t.locations.store}</span>
        <span className="eyebrow hidden sm:block">{t.locations.spread}</span>
        <span className="eyebrow hidden justify-self-end sm:block">
          {t.locations.rating}
        </span>
      </div>

      <div className="border-t border-rule">
        {stores.map((store) => (
          <StoreStrip key={store.id} store={store} t={t} locale={locale} />
        ))}
      </div>
    </section>
  );
}
