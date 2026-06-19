/**
 * Always-visible footer for the public site: names the data source and states
 * the non-advice disclaimer. Self-contained inline styling (no dependency on
 * app CSS); pointer-events disabled so it never blocks the 3D canvas.
 */
export function SiteDisclaimer() {
  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        textAlign: "center",
        padding: "4px 8px",
        fontSize: "11px",
        lineHeight: 1.4,
        color: "rgba(255, 255, 255, 0.45)",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      数据来源 Tushare · 仅供学习与展示，非投资建议
    </footer>
  );
}
