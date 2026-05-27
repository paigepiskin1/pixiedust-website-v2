// Scroll-reveal wrapper (React island). Uses Motion's LazyMotion + `m` so the
// shipped bundle stays ~4.6 KB instead of the full ~34 KB. Wrap Astro markup:
//   <Reveal client:visible><h2>…</h2></Reveal>
import { LazyMotion, domAnimation, m } from "motion/react";
import type { ReactNode } from "react";

interface Props {
  children?: ReactNode;
  /** Initial vertical offset in px (slides up into place). */
  y?: number;
  /** Stagger delay in seconds. */
  delay?: number;
  /** Animate every time it enters the viewport (default: once). */
  repeat?: boolean;
}

export default function Reveal({ children, y = 24, delay = 0, repeat = false }: Props) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        initial={{ opacity: 0, y }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: !repeat, margin: "-80px" }}
        transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
