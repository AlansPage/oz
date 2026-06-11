/* global React */

// Mobile-web frame: just the content. No status bar, no notch, no home
// indicator. Lets the warm canvas extend edge-to-edge — exactly what
// Chrome / Safari renders. The screen's own .tx-stage handles bg color.
function WebMobile({ children }) {
  return (
    <div className="web-mobile">{children}</div>
  );
}

// Desktop-web frame: 1280 outer, 480 inner centered, both painted with the
// screen's canvas color (passed as `bg`). The inner column has hairline
// guides at its edges so the 480 constraint is visible without redesigning
// anything. Same component code on both viewports — that's the point.
function WebDesktop({ children, bg = "var(--bg)" }) {
  return (
    <div className="web-desktop" style={{ background: bg }}>
      <div className="web-desktop__col">
        {children}
      </div>
    </div>
  );
}

window.WebMobile = WebMobile;
window.WebDesktop = WebDesktop;
