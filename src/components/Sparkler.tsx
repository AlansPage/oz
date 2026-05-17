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

const GRAVITY = 0.05;
const DRAG = 0.985;
const EDGE_INSET = 1.5;
const EMIT_MIN_MS = 90;
const EMIT_JITTER_MS = 110;
const MAX_PARTICLES = 80;

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
      const speed = 0.55 + Math.random() * 1.05;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.55,
        life: 1,
        size: 0.9 + Math.random() * 0.7,
        breaking: false,
      });
    };

    const drawParticle = (p: Particle) => {
      const r = p.size * 2.6;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, p.life)})`);
      grad.addColorStop(0.35, `rgba(26, 122, 74, ${p.life * 0.85})`);
      grad.addColorStop(1, "rgba(26, 122, 74, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
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
          p.size += 0.55;
          p.life -= 0.22;
          if (p.life > 0) next.push(p);
        } else {
          p.vy += GRAVITY;
          p.vx *= DRAG;
          p.vy *= DRAG;
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.006;
          if (
            p.x < EDGE_INSET ||
            p.x > cssWidth - EDGE_INSET ||
            p.y < EDGE_INSET ||
            p.y > cssHeight - EDGE_INSET ||
            p.life <= 0
          ) {
            p.breaking = true;
            p.life = Math.min(1, p.life + 0.2);
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
