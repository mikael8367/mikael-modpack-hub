import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/mod-search-core.js';

const search = globalThis.MikaelModSearch;

test('normaliza espaços, pontuação, apóstrofos e acentos', () => {
  assert.equal(search.normalizeName("Tinkers' Construct"), 'tinkersconstruct');
  assert.equal(search.normalizeName('  Better   Builder’s Wands! '), 'betterbuilderswands');
  assert.equal(search.normalizeName('MÉKANISM'), 'mekanism');
});

test('converte nomes em slugs ASCII sem perder acentos ou apóstrofos', () => {
  assert.equal(search.slugifyName('MÉKANISM'), 'mekanism');
  assert.equal(search.slugifyName("Better Builder’s Wands"), 'better-builders-wands');
  assert.equal(search.slugifyName("Tinkers' Construct"), 'tinkers-construct');
});

test('reconhece título alternativo exato do JEI e ignora addons', () => {
  const result = search.rankProjects([
    { id: '1', title: 'Just Enough Items', slug: 'jei' },
    { id: '2', title: 'JEI Addons', slug: 'jei-addons' }
  ], 'JEI');
  assert.equal(result.exact.length, 1);
  assert.equal(result.exact[0].project.id, '1');
  assert.equal(result.suggestions.length, 0);
});

test('slug exato com título conflitante exige confirmação manual', () => {
  const result = search.rankProjects([{ id: '1', title: 'JEI Addons', slug: 'jei' }], 'JEI');
  assert.equal(result.exact.length, 0);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].matchType, 'slug-review');
});

test('reconhece aliases com pontuação diferente', () => {
  const result = search.rankProjects([
    { id: '1', title: "Tinkers' Complement", slug: 'tinkers-complement' }
  ], 'Tinkers Complement');
  assert.equal(result.exact.length, 1);
});

test('usa todas as variantes de alias para montar slugs de catálogo', () => {
  const slugs = search.aliasesFor('AE2').map(search.slugifyName);
  assert.ok(slugs.includes('applied-energistics-2'));
  assert.ok(slugs.includes('ae2'));
});

test('reconhece Applied Energistics 2 como AE2', () => {
  const result = search.rankProjects([
    { id: 'ae2', title: 'Applied Energistics 2', slug: 'ae2' }
  ], 'AE2');
  assert.equal(result.exact.length, 1);
});

test('erro de digitação vira sugestão, nunca correspondência exata', () => {
  const result = search.rankProjects([{ id: '1', title: 'Mekanism', downloads: 1000 }], 'Mekanizm');
  assert.equal(result.exact.length, 0);
  assert.equal(result.suggestions.length, 1);
  assert.ok(result.suggestions[0].score >= 0.84);
});

test('transposição de letras é reconhecida como sugestão', () => {
  const result = search.rankProjects([{ id: '1', title: 'Mekanism' }], 'Mekansim');
  assert.equal(result.exact.length, 0);
  assert.equal(result.suggestions.length, 1);
  assert.equal(search.damerauLevenshtein('mekansim', 'mekanism'), 1);
});

test('tokeniza nomes com apóstrofos como uma palavra', () => {
  assert.deepEqual(search.tokenizeName("Better Builder's Wands"), ['better', 'builders', 'wands']);
});

test('detecta erro de digitação em um dos termos de nome composto', () => {
  const result = search.rankProjects([
    { id: '1', title: 'Applied Energistics 2' }
  ], 'Applied Energetics 2');
  assert.equal(result.exact.length, 0);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].matchType, 'token-fuzzy');
});

test('detecta palavras fora de ordem como sugestão manual', () => {
  const result = search.rankProjects([
    { id: '1', title: 'Builder Wands Better' }
  ], "Better Builder's Wands");
  assert.equal(result.exact.length, 0);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].matchType, 'token-fuzzy');
});

test('ignora sufixo genérico de catálogo apenas como sugestão', () => {
  const result = search.rankProjects([{ id: '1', title: 'Mekanism Mod' }], 'Mekanism');
  assert.equal(result.exact.length, 0);
  assert.equal(result.suggestions.length, 1);
});

test('não sugere complementos como se fossem o mod-base', () => {
  const cases = [
    [{ id: '1', title: 'ProjectE Integration' }, 'ProjectE'],
    [{ id: '2', title: 'Ender IO Endergy' }, 'Ender IO'],
    [{ id: '3', title: 'Mekanism Generators' }, 'Mekanism'],
    [{ id: '4', title: 'Draconic Additions' }, 'Draconic']
  ];
  for (const [project, requested] of cases) {
    const result = search.rankProjects([project], requested);
    assert.equal(result.suggestions.length, 0, project.title);
  }
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
  const result = search.rankProjects([{ id: '1', title: 'JEI Addons', slug: 'jei-addons' }], 'JEI');
  assert.equal(result.exact.length, 0);
  assert.equal(result.suggestions.length, 0);
});

test('prioriza título exato antes de aliases via slug', () => {
  const result = search.rankProjects([
    { id: 'slug', title: 'Other Project', slug: 'just-enough-items', downloads: 999999 },
    { id: 'title', title: 'Just Enough Items', slug: 'jei', downloads: 1 }
  ], 'JEI');
  assert.equal(result.exact[0].project.id, 'title');
});

test('remove projetos duplicados retornados por consultas diferentes', () => {
  const project = { id: 'same', title: 'Chisel', slug: 'chisel' };
  const result = search.rankProjects([project, { ...project }], 'Chisel');
  assert.equal(result.exact.length, 1);
});
