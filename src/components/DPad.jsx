// On-screen directional pad for grid games on touch devices.
// onDir receives 'up' | 'down' | 'left' | 'right'; optional action button.
export default function DPad({ onDir, actionLabel = null, onAction = null }) {
  const btn = (label, dir, area) => (
    <button
      onPointerDown={(e) => {
        e.preventDefault()
        onDir(dir)
      }}
      style={{
        gridArea: area,
        width: 44,
        height: 44,
        borderRadius: 10,
        border: '2px solid rgba(34, 229, 255, 0.6)',
        background: 'rgba(34, 229, 255, 0.12)',
        color: '#22e5ff',
        fontSize: 18,
        touchAction: 'none',
      }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', alignItems: 'flex-end', gap: 12, zIndex: 10, opacity: 0.85 }}>
      {onAction && (
        <button
          onPointerDown={(e) => {
            e.preventDefault()
            onAction()
          }}
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            border: '2px solid rgba(255, 47, 185, 0.7)',
            background: 'rgba(255, 47, 185, 0.15)',
            color: '#ff2fb9',
            fontSize: 20,
            touchAction: 'none',
          }}
        >
          {actionLabel}
        </button>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateAreas: '". u ." "l d r"',
          gap: 4,
        }}
      >
        {btn('▲', 'up', 'u')}
        {btn('◀', 'left', 'l')}
        {btn('▼', 'down', 'd')}
        {btn('▶', 'right', 'r')}
      </div>
    </div>
  )
}
