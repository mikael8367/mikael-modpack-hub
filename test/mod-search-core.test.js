import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/mod-search-core.js';

const search = globalThis.MikaelModSearch;

test('normaliza espaços, pontuação, apóstrofos e acentos', () => {
  assert.equal(search.normalizeName("Tinkers' Construct"), 'tinkersconstruct');
  assert.equal(search.normalizeName('  Better   Builder’s Wands! '), 'betterbuilderswands');
  assert.equal(search.normalizeName('MÉKANISM'), 'mekanism');
});

test('reconhece título alternativo exato do JEI', () => {
  const result = search.rankProjects([
    { id: '1', title: 'Just Enough Items', slug: 'jei' },
    { id: '2', title: 'JEI Addons', slug: 'jei-addons' }
  ], 'JEI');
  assert.equal(result.exact.length, 1);
  assert.equal(result.exact[0].project.id, '1');
  assert.equal(result.suggestions.length, 0);
});

test('reconhece aliases com pontuação diferente', () => {
  const result = search.rankProjects([
    { id: '1', title: "Tinkers' Complement", slug: 'tinkers-complement' }
  ], 'Tinkers Complement');
  assert.equal(result.exact.length, 1);
});

test('reconhece Applied Energistics 2 como AE2', () => {
  const result = search.rankProjects([
    { id: 'ae2', title: 'Applied Energistics 2', slug: 'ae2' }
  ], 'AE2');
  assert.equal(result.exact.length, 1);
});

test('typo vira sugestão, nunca correspondência exata', () => {
  const result = search.rankProjects([
    { id: '1', title: 'Mekanism', slug: 'mekanism' }
  ], 'Mekanizm');
  assert.equal(result.exact.length, 0);
  assert.equal(result.suggestions.length, 1);
  assert.ok(result.suggestions[0].score >= 0.72);
});

test('não confunde ProjectE com ProjectE Integration', () => {
  const result = search.rankProjects([
    { id: 'integration', title: 'ProjectE Integration', slug: 'projecte-integration' }
  ], 'ProjectE');
  assert.equal(result.exact.length, 0);
  assert.equal(result.suggestions.length, 0);
});

test('não confunde Ender IO com Ender IO Endergy', () => {
  const result = search.rankProjects([
    { id: 'endergy', title: 'Ender IO Endergy', slug: 'ender-io-endergy' }
  ], 'Ender IO');
  assert.equal(result.exact.length, 0);
  assert.equal(result.suggestions.length, 0);
});

test('não usa fuzzy em siglas curtas', () => {
  const result = search.rankProjects([
    { id: '1', title: 'JEI Addons', slug: 'jei-addons' }
  ], 'JEI');
  assert.equal(result.exact.length, 0);
  assert.equal(result.suggestions.length, 0);
});

test('remove projetos duplicados retornados por consultas diferentes', () => {
  const project = { id: 'same', title: 'Chisel', slug: 'chisel' };
  const result = search.rankProjects([project, { ...project }], 'Chisel');
  assert.equal(result.exact.length, 1);
});
