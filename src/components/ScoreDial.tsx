function tone(score: number) {
  if (score >= 95) return "var(--success)";
  if (score >= 70) return "var(--warning)";
  return "var(--destructive)";
}

/**
 * Conformance score ring. The number is always rendered as text so the value
 * never depends on colour alone.
 */
export function ScoreDial({
  score,
  size = 56,
  label = "Conformance score",
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const stroke = Math.max(3, Math.round(size / 12));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${clamped} out of 100`}
    >
      <svg width={size} height={size} aria-hidden="true" className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone(clamped)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <span
        className="absolute font-display font-semibold tabular-nums"
        style={{ fontSize: Math.max(10, Math.round(size / 3.4)) }}
      >
        {clamped}
      </span>
    </span>
  );
}
