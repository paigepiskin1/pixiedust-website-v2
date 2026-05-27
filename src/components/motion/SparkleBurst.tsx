// Full-screen celebratory sparkle explosion (React island, CSS-driven, no hooks
// so it's immune to dev-mode React-instance quirks for client:only islands).
// Fires once on mount; particles + the overlay fade out via CSS, leaving nothing
// interactive behind. Used after a successful top-up (/credits?status=success).
const COLORS = ["var(--pd-lilac)", "var(--pd-pink)", "var(--pd-amber)", "var(--pd-mint)", "#ffffff"];
const STAR = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";

const PARTS = Array.from({ length: 70 }, (_, i) => {
  const angle = Math.random() * Math.PI * 2;
  const dist = 120 + Math.random() * 360;
  return {
    id: i,
    tx: Math.cos(angle) * dist + "px",
    ty: Math.sin(angle) * dist - 40 + "px",
    size: 6 + Math.random() * 14 + "px",
    color: COLORS[i % COLORS.length],
    rot: (Math.random() - 0.5) * 540 + "deg",
    delay: Math.random() * 0.12 + "s",
    dur: 0.9 + Math.random() * 0.8 + "s",
  };
});

const KEYFRAMES =
  "@keyframes pd-spark{" +
  "0%{transform:translate(-50%,-50%) translate(0,0) scale(0) rotate(0deg);opacity:1}" +
  "30%{transform:translate(-50%,-50%) translate(calc(var(--tx)*.5),calc(var(--ty)*.5)) scale(1) rotate(calc(var(--rot)*.5));opacity:1}" +
  "100%{transform:translate(-50%,-50%) translate(var(--tx),var(--ty)) scale(.2) rotate(var(--rot));opacity:0}}" +
  "@keyframes pd-spark-gone{0%,92%{visibility:visible}100%{visibility:hidden}}";

export default function SparkleBurst() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        pointerEvents: "none",
        overflow: "hidden",
        animation: "pd-spark-gone 2.8s forwards",
      }}
    >
      <style>{KEYFRAMES}</style>
      {PARTS.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: p.size,
            height: p.size,
            background: p.color,
            clipPath: STAR,
            boxShadow: `0 0 ${p.size} ${p.color}`,
            ["--tx" as any]: p.tx,
            ["--ty" as any]: p.ty,
            ["--rot" as any]: p.rot,
            animation: `pd-spark ${p.dur} cubic-bezier(.16,1,.3,1) ${p.delay} both`,
          }}
        />
      ))}
    </div>
  );
}
