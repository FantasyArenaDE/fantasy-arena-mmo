import type { AbilityVfxFullSpec } from './ability_vfx_core';

const threadBlue = '#9ec8ef';
const nightViolet = '#b186f2';
const nightmare: AbilityVfxFullSpec = {
  archetype: 'burst', palette: 'shadow', tint: nightViolet, power: 0.8,
  motifs: ['implosion'], motifAt: 'target',
  impact: { ring: 1.25, sparks: 12, light: 0.7 },
};

export const DREAMDANCER_VFX: Readonly<Record<string, AbilityVfxFullSpec>> = {
  dream_thread: {
    archetype: 'buff', palette: 'arcane', tint: threadBlue, power: 0.5,
    windupStyle: 'none', motifs: ['orbitals'], motifAt: 'target',
    buff: { orbit: 'runes', o: { n: 3, size: 0.24, rate: 0.75, radius: 0.8 } },
    impact: { ring: 0.7, sparks: 6, light: 0.35 },
  },
  dream_spark: {
    archetype: 'bolt', palette: 'arcane', tint: threadBlue, accent: nightViolet, power: 0.7,
    windupStyle: 'orb', bolt: { speed: 26, coils: true, headScale: 0.75 },
    impact: { sparks: 10, light: 0.55 },
  },
  dream_shroud: {
    archetype: 'buff', palette: 'arcane', tint: threadBlue, power: 0.8, barrier: true,
    buff: { orbit: 'plates', shellDur: 2, o: { n: 3, size: 0.95, rate: 0.8 } },
    rim: '#d9ebff', impact: { sparks: 8, light: 0.55 },
  },
  dream_nightmare: nightmare,
  dream_deep_nightmare: { ...nightmare, power: 1, impact: { ring: 1.6, sparks: 18, light: 0.9 } },
  dream_comfort: {
    archetype: 'heal', palette: 'arcane', tint: '#c9e9ff', power: 0.75,
    windupStyle: 'ascend', motifs: ['orbitals'], motifAt: 'target', shaft: 0.55,
    impact: { vRing: 1.1, sparks: 7, light: 0.6 },
  },
  dream_veil: {
    archetype: 'nova', palette: 'arcane', tint: nightViolet, accent: threadBlue, power: 0.85,
    nova: { radius: 5 }, motifs: ['orbitals'], motifAt: 'target', decal: 'rune',
    impact: { ring: 1.4, sparks: 12, light: 0.65 },
  },
  dream_chorus: {
    archetype: 'heal', palette: 'holy', tint: '#ffdb96', accent: threadBlue, power: 0.85,
    windupStyle: 'ascend', motifs: ['orbitals'], motifAt: 'target', shaft: 0.65,
    impact: { vRing: 1.15, sparks: 12, light: 0.7 },
  },
  dream_miststep: {
    archetype: 'nova', palette: 'arcane', tint: '#a0a6f3', accent: '#83d9ef', power: 0.65,
    nova: { radius: 6 }, decal: 'rune', impact: { ring: 1.1, sparks: 8, smoke: true, light: 0.4 },
  },
  dream_moonrend: {
    archetype: 'dot', palette: 'shadow', tint: nightViolet, accent: '#d0e4ff', power: 0.75,
    motifs: ['crescents'], motifAt: 'target', impact: { focused: true, sparks: 9, light: 0.55 },
  },
  dream_silence: {
    archetype: 'cc', palette: 'arcane', tint: '#d3b7ff', power: 0.55,
    motifs: ['chains'], motifAt: 'target', impact: { ring: 0.65, sparks: 8, light: 0.45 },
  },
  dream_glide: {
    archetype: 'buff', palette: 'arcane', tint: '#82e1ff', power: 0.65,
    motifs: ['crescents'], motifAt: 'caster', impact: { ring: 0.8, sparks: 7, light: 0.4 },
  },
  dream_reverie: {
    archetype: 'buff', palette: 'arcane', tint: '#78bdff', power: 0.75,
    buff: { ceremony: 'ascend', orbit: 'runes' }, impact: { vRing: 0.8, sparks: 9, light: 0.5 },
  },
  dream_refuge: {
    archetype: 'buff', palette: 'arcane', tint: '#cfddff', power: 0.8, barrier: true,
    buff: { orbit: 'plates', shellDur: 2 }, rim: '#e9e9ff', impact: { ring: 1, sparks: 8, light: 0.6 },
  },
  dream_unravel: {
    archetype: 'cc', palette: 'arcane', tint: '#fff0cf', accent: nightViolet, power: 0.65,
    motifs: ['implosion'], motifAt: 'target', impact: { ring: 0.9, sparks: 10, light: 0.55 },
  },
};
