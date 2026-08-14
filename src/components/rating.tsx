import { ratingBand } from "@/lib/format";

const BAND_TEXT: Record<string, string> = {
  good: "text-good",
  mid: "text-mid",
  bad: "text-bad",
};

/**
 * A rating printed like a shelf price: heavy whole number, small raised
 * decimals. Colour carries the band so a row can be read without reading.
 */
export function RatingPrice({
  value,
  className = "text-4xl",
  muted = false,
}: {
  value: number | null;
  className?: string;
  muted?: boolean;
}) {
  if (value == null) {
    return <span className={`price ${className} text-ink-faint`}>—</span>;
  }

  const whole = Math.floor(value);
  const fraction = Math.round((value - whole) * 100)
    .toString()
    .padStart(2, "0");

  return (
    <span
      className={`price ${className} ${muted ? "text-ink" : BAND_TEXT[ratingBand(value)]}`}
    >
      {whole}
      <span className="price-fraction">.{fraction}</span>
    </span>
  );
}

/** Five-segment distribution bar. Width = share of reviews at that star level. */
export function StarSpread({
  histogram,
  className = "",
}: {
  histogram: readonly number[];
  className?: string;
}) {
  const total = histogram.reduce((a, b) => a + b, 0);

  if (total === 0) {
    return <div className={`h-2 rounded-[1px] bg-rule-soft ${className}`} />;
  }

  const segments = [
    { stars: 1, count: histogram[0], color: "#c3352c" },
    { stars: 2, count: histogram[1], color: "#e08b6b" },
    { stars: 3, count: histogram[2], color: "#d9b45c" },
    { stars: 4, count: histogram[3], color: "#7fae7c" },
    { stars: 5, count: histogram[4], color: "#1c7a4a" },
  ];

  return (
    <div
      className={`flex h-2 overflow-hidden rounded-[1px] bg-rule-soft ${className}`}
      role="img"
      aria-label={segments
        .map((s) => `${s.stars} star: ${s.count}`)
        .join(", ")}
    >
      {segments.map((s) =>
        s.count === 0 ? null : (
          <div
            key={s.stars}
            style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
            title={`${s.stars}★ — ${s.count}`}
          />
        ),
      )}
    </div>
  );
}

/** Star rating for a single review, drawn as filled/empty pips. */
export function StarRow({
  rating,
  size = 12,
  className = "",
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const color = rating <= 2 ? "#c3352c" : rating === 3 ? "#b57611" : "#1c7a4a";

  return (
    <span
      className={`inline-flex items-center gap-[2px] ${className}`}
      role="img"
      aria-label={`${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width={size}
          height={size}
          viewBox="0 0 16 16"
          aria-hidden="true"
          fill={n <= rating ? color : "transparent"}
          stroke={n <= rating ? color : "#c9c7bf"}
          strokeWidth="1.4"
        >
          <path d="M8 1.6l1.9 4 4.4.6-3.2 3 .8 4.3L8 11.5 4.1 13.5l.8-4.3-3.2-3 4.4-.6z" />
        </svg>
      ))}
    </span>
  );
}
