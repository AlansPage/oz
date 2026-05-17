"use client";

import { useEffect, useRef, type RefObject } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  breaking: boolean;
};

const EDGE_INSET = 1.5;
const EMIT_MIN_MS = 90;
const EMIT_JITTER_MS = 110;
const MAX_PARTICLES = 80;
const BEIGE = "245, 240, 232";

type Props = {
  sourceRef: RefObject<SVGGraphicsElement | null>;
};

export function Sparkler({ sourceRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;
    let cssWidth = 0;
    let cssHeight = 0;
    let particles: Particle[] = [];
    let rafId = 0;
    let lastEmit = 0;
    let running = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssWidth = rect.width;
      cssHeight = rect.height;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(cssWidth * dpr));
      canvas.height = Math.max(1, Math.round(cssHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const getSourcePos = () => {
      const src = sourceRef.current;
      if (!src) return null;
      const canvasRect = canvas.getBoundingClientRect();
      const srcRect = src.getBoundingClientRect();
      return {
        x: srcRect.left + srcRect.width / 2 - canvasRect.left,
        y: srcRect.top + srcRect.height / 2 - canvasRect.top,
      };
    };

    const emit = (x: number, y: number) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.9 + Math.random() * 1.2;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: 0.9 + Math.random() * 0.7,
        breaking: false,
      });
    };

    const drawParticle = (p: Particle) => {
      const speed = Math.hypot(p.vx, p.vy) || 1;
      const len = p.breaking ? 1.5 + p.size * 2.5 : 4 + p.size * 1.8;
      const hx = p.vx / speed;
      const hy = p.vy / speed;
      const tailX = p.x - hx * len * 0.6;
      const tailY = p.y - hy * len * 0.6;
      const headX = p.x + hx * len * 0.4;
      const headY = p.y + hy * len * 0.4;

      ctx.strokeStyle = `rgba(${BEIGE}, ${Math.min(1, p.life)})`;
      ctx.lineWidth = 1.25;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.stroke();
    };

    const tick = (t: number) => {
      rafId = 0;
      if (!running) return;

      const source = getSourcePos();
      if (source && t - lastEmit > EMIT_MIN_MS + Math.random() * EMIT_JITTER_MS) {
        lastEmit = t;
        emit(source.x, source.y);
      }

      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const next: Particle[] = [];
      for (const p of particles) {
        if (p.breaking) {
          p.size += 0.35;
          p.life -= 0.28;
          if (p.life > 0) next.push(p);
        } else {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.005;
          if (
            p.x < EDGE_INSET ||
            p.x > cssWidth - EDGE_INSET ||
            p.y < EDGE_INSET ||
            p.y > cssHeight - EDGE_INSET ||
            p.life <= 0
          ) {
            p.breaking = true;
            p.life = Math.min(1, p.life + 0.25);
          }
          next.push(p);
        }
        drawParticle(p);
      }
      particles = next.slice(-MAX_PARTICLES);

      rafId = requestAnimationFrame(tick);
    };

    resize();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
    window.addEventListener("resize", resize);

    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      if (visible && !running) {
        running = true;
        rafId = requestAnimationFrame(tick);
      } else if (!visible) {
        running = false;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    rafId = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      ro?.disconnect();
    };
  }, [sourceRef]);

  return <canvas ref={canvasRef} className="oz-sparkler" aria-hidden />;
}
