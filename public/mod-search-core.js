(() => {
  'use strict';

  // Grupos de títulos equivalentes usados pelos catálogos.
  // Aliases curtos são aceitos somente por igualdade exata para evitar falsos positivos.
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

  function editSimilarity(first, second) {
    if (!first || !second) return 0;
    if (first === second) return 1;
    const rows = second.length + 1;
    const cols = first.length + 1;
    let previous = Array.from({ length: cols }, (_, index) => index);
    for (let row = 1; row < rows; row++) {
      const current = [row];
      for (let col = 1; col < cols; col++) {
        const cost = second.charCodeAt(row - 1) === first.charCodeAt(col - 1) ? 0 : 1;
        current[col] = Math.min(
          current[col - 1] + 1,
          previous[col] + 1,
          previous[col - 1] + cost
        );
      }
      previous = current;
    }
    return 1 - previous[cols - 1] / Math.max(first.length, second.length);
  }

  function projectNames(project) {
    return [project && project.title, project && project.name, project && project.slug]
      .filter(Boolean)
      .map((value) => ({ value: String(value), normalized: normalizeName(value) }))
      .filter((entry) => entry.normalized);
  }

  function scoreProject(project, requestedName) {
    const expected = aliasesFor(requestedName)
      .map(normalizeName)
      .filter(Boolean);
    const names = projectNames(project);
    if (!expected.length || !names.length) {
      return { project, score: 0, exact: false, matchedName: '' };
    }

    for (const candidate of names) {
      if (expected.includes(candidate.normalized)) {
        return { project, score: 1, exact: true, matchedName: candidate.value };
      }
    }

    // Correspondência aproximada serve apenas como sugestão. Nunca autoriza
    // a instalação automática. Acrônimos curtos (JEI, AE2 etc.) não são fuzzy.
    let best = { project, score: 0, exact: false, matchedName: '' };
    for (const wanted of expected) {
      if (wanted.length < 8) continue;
      for (const candidate of names) {
        const candidateName = candidate.normalized;
        if (candidateName.length < 8) continue;
        const maxLength = Math.max(wanted.length, candidateName.length);
        const lengthDifference = Math.abs(wanted.length - candidateName.length);
        if (lengthDifference > Math.max(2, Math.ceil(wanted.length * 0.18))) continue;
        const score = editSimilarity(wanted, candidateName);
        if (score > best.score) {
          best = { project, score, exact: false, matchedName: candidate.value };
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
      .sort((a, b) => b.score - a.score);

    return {
      exact: ranked.filter((entry) => entry.exact),
      suggestions: ranked.filter((entry) => !entry.exact && entry.score >= 0.72)
    };
  }

  globalThis.MikaelModSearch = Object.freeze({
    normalizeName,
    aliasesFor,
    scoreProject,
    rankProjects
  });
})();
