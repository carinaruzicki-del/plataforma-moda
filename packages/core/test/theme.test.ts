import { describe, expect, it } from 'vitest';
import { contrast, DEFAULT_PLANS, PALETTES, readableAccent, resolveTheme } from '../src';

const free = DEFAULT_PLANS.inicial.features.design;
const esencial = DEFAULT_PLANS.esencial.features.design;
const pro = DEFAULT_PLANS.profesional.features.design;

describe('diseño de la tienda', () => {
  it('todas las paletas se leen bien con texto blanco y sobre marfil', () => {
    for (const p of PALETTES) {
      expect(contrast(p.accent, '#FFFFFF'), p.name).toBeGreaterThanOrEqual(4.5);
      expect(readableAccent(p.accent).adjusted, p.name).toBe(false);
    }
  });

  it('el plan gratis usa la paleta elegida e ignora el color libre', () => {
    const t = resolveTheme({ palette: 'bosque', accent: '#FF00AA', font: 'playfair', layout: 'editorial' }, free);
    expect(t.accent).toBe('#2F5D50');
    expect(t.font.id).toBe('fraunces');
    expect(t.layout).toBe('clasico');
    expect(t.branding).toBe(true);
  });

  it('Esencial usa el color exacto de la marca, sin leyenda', () => {
    const t = resolveTheme({ palette: 'bosque', accent: '#1F3A5F' }, esencial);
    expect(t.accent).toBe('#1F3A5F');
    expect(t.adjusted).toBe(false);
    expect(t.branding).toBe(false);
  });

  it('un color muy claro se oscurece hasta que se lea', () => {
    const t = resolveTheme({ accent: '#F4B6C2' }, esencial);
    expect(t.adjusted).toBe(true);
    expect(contrast(t.accent, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('Profesional habilita tipografía y diseño', () => {
    const t = resolveTheme({ font: 'playfair', layout: 'minimal' }, pro);
    expect(t.font.family).toBe('Playfair Display');
    expect(t.layout).toBe('minimal');
  });

  it('las tiendas viejas con accentColor de la lista siguen igual', () => {
    expect(resolveTheme(undefined, free, '#2F4A6B').accent).toBe('#2F4A6B');
    expect(resolveTheme(undefined, free, '#123456').accent).toBe('#754653');
    expect(resolveTheme(undefined, free).accent).toBe('#754653');
  });
});
