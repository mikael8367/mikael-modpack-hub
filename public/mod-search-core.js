(() => {
  'use strict';

  // Aliases são relações explícitas entre títulos do mesmo projeto.
  // Não inclua aqui projetos complementares ou addons independentes.
  const ALIAS_GROUPS = [
    ['jei', 'Just Enough Items'],
    ['hwyla', "Here's What You're Looking At"],
    ['netherportalfix', 'Nether Portal Fix'],
    ['zerocore', 'ZeroCore 2', 'ZeroCore2'],
    ['betterfps', 'Better FPS'],
    ['fastworkbench', 'Fast Workbench'],
    ['fastfurnace', 'Fast Furnace'],
    ['memoryleakfix', 'Memory Leak Fix'],
    ['connectedtexturesmod', 'Connected Textures Mod'],
    ["tinkers'construct", 'Tinkers Construct', 'TConstruct'],
    ['tinkerscomplement', "Tinkers' Complement"],
    ["tinkers'toolleveling", 'Tinkers Tool Leveling'],
    ["construct'sarmory", 'Constructs Armory'],
    ["brandon'score", 'Brandon Core'],
    ['appliedenergistics2', 'Applied Energistics 2', 'AE2'],
    ['extracells2', 'Extra Cells 2', 'ExtraCells 2'],
    ['teslacorelib', 'Tesla Core Library'],
    ['valkyrielib', 'Valkyrie Lib', 'Valkyrie Library'],
    ['cucumberlibrary', 'Cucumber'],
    ['mcjtylib', 'McJty Lib'],
    ['entityculling', 'Entity Culling'],
    ['culleaves', 'Cull Leaves'],
    ['smoothboot', 'Smooth Boot'],
    ['vanillafix', 'Vanilla Fix'],
    ['extremereactors', 'Extreme Reactors 2'],
    ['ftblibrary', 'FTB Library'],
    ['ftbutilities', 'FTB Utilities'],
    ['ftbbackups', 'FTB Backups'],
    ['ftbquests', 'FTB Quests'],
    ['projecteintegration', 'ProjectE Integration']
  ];

  const normalizeName = (value) => String(value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

  const aliasLookup = new Map();
  for (const group of ALIAS_GROUPS) {
    for (const name of group) aliasLookup.set(normalizeName(name), group);
  }

  function aliasesFor(name) {
    const value = String(name || '').trim();
    const group = aliasLookup.get(normalizeName(value)) || [];
    return [...new Set([value, ...group].filter(Boolean))];
  }

  // Distância Damerau-Levenshtein restrita: além de inserção, remoção e
  // substituição, reconhece troca de letras vizinhas (erro comum no celular).
  function damerauLevenshtein(first, second) {
    if (first === second) return 0;
    if (!first || !second) return Math.max(first.length, second.length);
    const rows = second.length + 1;
    const cols = first.length + 1;
    const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let row = 0; row < rows; row++) matrix[row][0] = row;
    for (let col = 0; col < cols; col++) matrix[0][col] = col;

    for (let row = 1; row < rows; row++) {
      for (let col = 1; col < cols; col++) {
        const cost = second[row - 1] === first[col - 1] ? 0 : 1;
        matrix[row][col] = Math.min(
          matrix[row - 1][col] + 1,
          matrix[row][col - 1] + 1,
          matrix[row - 1][col - 1] + cost
        );
        if (row > 1 && col > 1 &&
            second[row - 1] === first[col - 2] &&
            second[row - 2] === first[col - 1]) {
          matrix[row][col] = Math.min(
            matrix[row][col],
            matrix[row - 2][col - 2] + 1
          );
        }
      }
    }
    return matrix[rows - 1][cols - 1];
  }

  function projectNames(project) {
    const display = [project && project.title, project && project.name]
      .filter(Boolean)
      .map((value) => ({ value: String(value), normalized: normalizeName(value), field: 'title' }))
      .filter((entry) => entry.normalized);
    const slug = project && project.slug
      ? [{ value: String(project.slug), normalized: normalizeName(project.slug), field: 'slug' }]
      : [];
    return { display, slug };
  }

  function scoreProject(project, requestedName) {
    const expected = aliasesFor(requestedName).map(normalizeName).filter(Boolean);
    const names = projectNames(project);
    if (!expected.length || (!names.display.length && !names.slug.length)) {
      return { project, score: 0, exact: false, matchedName: '', matchType: 'none' };
    }

    // Título/nome exibido tem precedência sobre slug. Um slug igual não pode
    // transformar "JEI Addons" em uma correspondência exata de "JEI".
    for (const candidate of names.display) {
      if (expected.includes(candidate.normalized)) {
        return { project, score: 1, exact: true, matchedName: candidate.value, matchType: 'title' };
      }
    }
    if (!names.display.length) {
      for (const candidate of names.slug) {
        if (expected.includes(candidate.normalized)) {
          return { project, score: 0.99, exact: true, matchedName: candidate.value, matchType: 'slug' };
        }
      }
    } else {
      // Slug exato com título divergente é um sinal forte, mas exige revisão
      // humana (ex.: addons com slug semelhante nunca são instalados sozinhos).
      for (const candidate of names.slug) {
        if (expected.includes(candidate.normalized)) {
          return { project, score: 0.96, exact: false, matchedName: candidate.value, matchType: 'slug-review' };
        }
      }
    }

    // Fuzzy matching é exclusivamente uma sugestão manual. Siglas e nomes
    // curtos não entram neste estágio, para evitar coincidências acidentais.
    let best = { project, score: 0, exact: false, matchedName: '', matchType: 'none' };
    const candidateNames = names.display.length ? names.display : names.slug;
    for (const wanted of expected) {
      if (wanted.length < 8) continue;
      for (const candidate of candidateNames) {
        const value = candidate.normalized;
        if (value.length < 8) continue;
        const maxLength = Math.max(wanted.length, value.length);
        const maxEdits = maxLength <= 14 ? 1 : 2;
        if (Math.abs(wanted.length - value.length) > maxEdits) continue;
        const distance = damerauLevenshtein(wanted, value);
        if (distance > maxEdits) continue;
        const score = 1 - distance / maxLength;
        if (score > best.score) {
          best = { project, score, exact: false, matchedName: candidate.value, matchType: 'fuzzy' };
        }
      }
    }
    return best;
  }

  function rankProjects(results, requestedName) {
    const unique = new Map();
    for (const project of results || []) {
      if (!project) continue;
      const key = project.id == null
        ? [project.title || project.name || '', project.slug || ''].join('|')
        : String(project.id);
      if (!unique.has(key)) unique.set(key, project);
    }

    const ranked = [...unique.values()]
      .map((project) => scoreProject(project, requestedName))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (a.exact !== b.exact) return a.exact ? -1 : 1;
        if (a.score !== b.score) return b.score - a.score;
        return Number(b.project.downloads || 0) - Number(a.project.downloads || 0);
      });

    return {
      exact: ranked.filter((entry) => entry.exact),
      suggestions: ranked.filter((entry) => !entry.exact && entry.score >= 0.84)
    };
  }

  globalThis.MikaelModSearch = Object.freeze({
    normalizeName,
    aliasesFor,
    scoreProject,
    rankProjects,
    damerauLevenshtein
  });
})();
