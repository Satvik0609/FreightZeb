export default function Gauge({ value = 0, max = 100, label, size = 120, colorThresholds }) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))
  const angle = (percent / 100) * 180 - 90

  const getColor = () => {
    if (colorThresholds) {
      for (const { threshold, color } of colorThresholds) {
        if (percent <= threshold) return color
      }
    }
    if (percent < 30) return '#22c55e'
    if (percent < 60) return '#f59e0b'
    if (percent < 80) return '#f97316'
    return '#ef4444'
  }

  const color = getColor()
  const r = size * 0.38
  const cx = size / 2
  const cy = size * 0.58

  const polarToCartesian = (angle) => {
    const rad = (angle * Math.PI) / 180
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    }
  }

  const start = polarToCartesian(-180)
  const end = polarToCartesian(0)
  const needle = polarToCartesian(angle - 90)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={size * 0.1}
          strokeLinecap="round"
        />
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${polarToCartesian(angle - 90).x} ${polarToCartesian(angle - 90).y}`}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.1}
          strokeLinecap="round"
        />
        <line
          x1={cx}
          y1={cy}
          x2={needle.x}
          y2={needle.y}
          stroke={color}
          strokeWidth={size * 0.025}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={size * 0.04} fill={color} />
        <text x={cx} y={cy - r * 0.3} textAnchor="middle" fontSize={size * 0.18} fontWeight="700" fill={color}>
          {Math.round(percent)}%
        </text>
      </svg>
      {label && <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">{label}</p>}
    </div>
  )
}
