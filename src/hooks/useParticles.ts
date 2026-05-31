import { useRef, useCallback } from 'react';
import type { Particle } from '@/types/magic';

let nextId = 0;

export function useParticles() {
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);

  const addParticles = useCallback((
    x: number,
    y: number,
    count: number,
    color: string,
    type: Particle['type'] = 'spark',
    spread: number = 100
  ) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 1 + Math.random() * 4;
      newParticles.push({
        id: nextId++,
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed * (spread / 100),
        vy: Math.sin(angle) * speed * (spread / 100) - 1,
        life: 30 + Math.random() * 40,
        maxLife: 70,
        color,
        size: 2 + Math.random() * 4,
        type,
      });
    }
    particlesRef.current.push(...newParticles);
  }, []);

  const addBurst = useCallback((x: number, y: number, color: string, intensity: number = 1) => {
    addParticles(x, y, Math.round(30 * intensity), color, 'burst', 150);
    addParticles(x, y, Math.round(15 * intensity), '#ffffff', 'glow', 80);
  }, [addParticles]);

  const addTrailParticle = useCallback((x: number, y: number, color: string) => {
    if (Math.random() < 0.3) {
      particlesRef.current.push({
        id: nextId++,
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5 - 0.5,
        life: 15 + Math.random() * 20,
        maxLife: 35,
        color,
        size: 1.5 + Math.random() * 2,
        type: 'trail',
      });
    }
  }, []);

  const updateParticles = useCallback((): Particle[] => {
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // gravity
      p.life--;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
    return [...particles];
  }, []);

  const clearParticles = useCallback(() => {
    particlesRef.current = [];
  }, []);

  return {
    particlesRef,
    addParticles,
    addBurst,
    addTrailParticle,
    updateParticles,
    clearParticles,
    animationRef,
  };
}
