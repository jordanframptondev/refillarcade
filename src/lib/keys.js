// True when a key event originates from a text field (e.g. the high-score
// name input) — game hotkeys must ignore these or they swallow the
// player's typing (Space, WASD...) via preventDefault.
export function isTypingTarget(e) {
  const t = e.target
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}
