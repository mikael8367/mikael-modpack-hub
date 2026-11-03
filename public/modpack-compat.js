(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const LEGACY_VERSION = '1.12.2';
  const LEGACY_LOADER = 'forge';

  const LEGACY_MODS = [
    'Void Island Control','World Primer','Ex Nihilo Creatio','Ex Compressum','JEI','Hwyla',
    'JourneyMap',"Better Builder's Wands",'Chisel','NetherPortalFix','ProjectE','ProjectE Integration',
    'Mekanism','Mekanism Generators','Mekanism Tools','Extreme Reactors','ZeroCore','FTB Library',
    'FTB Utilities','FTB Backups','FTB Quests','FoamFix','BetterFps','VanillaFix','Surge','TexFix',
    'FastWorkbench','FastFurnace','Phosphor','EntityCulling','Cull Leaves','AI Improvements',
    'Smooth Boot','MemoryLeakFix','CoFH Core','CoFH World','Redstone Flux','Thermal Foundation',
    'Thermal Expansion','Thermal Dynamics','Thermal Cultivation','Thermal Innovation','Redstone Arsenal',
    'ConnectedTexturesMod','Placebo','Mantle',"Tinkers' Construct",'Tinkers Complement',
    "Tinkers' Tool Leveling","Construct's Armory","Brandon's Core",'Draconic Evolution',
    'Draconic Additions','Applied Energistics 2','AE2 Stuff','ExtraCells2','Refined Storage',
    'Refined Storage Addons','Extra Disks','EnderCore','Ender IO','Ender IO Endergy','Tesla Core Lib',
    'Industrial Foregoing','ValkyrieLib','Environmental Tech','Cucumber Library','Mystical Agriculture',
    'Mystical Agradditions','Avaritia','Extra Utilities 2','Cyclic','Dark Utilities','Building Gadgets',
    'McJtyLib','RFTools','RFTools Dimensions'
  ];

  // Variações de títulos usados nos catálogos. IDs nunca são presumidos:
  // o Hub consulta os provedores e usa somente IDs retornados por eles.
  const searchCore = window.MikaelModSearch;
  if (!searchCore) {
    throw new Error('O motor de busca preciso não foi carregado.');
  }
  const normalize = searchCore.normalizeName;
  const aliasesFor = searchCore.aliasesFor;

  function sameModName(first, second) {
    const firstNames = new Set(aliasesFor(first).map(normalize));
    return aliasesFor(second).some((name) => firstNames.has(normalize(name)));
  }

  function addResult(message, kind) {
    const output = $('#bulk-import-results');
    if (!output) return;
    const row = document.createElement('div');
    row.className = 'hint bulk-result ' + (kind || '');
    row.textContent = message;
    output.appendChild(row);
  }

  function addSuggestionResult(requestedName, matches) {
    const output = $('#bulk-import-results');
    if (!output) return;
    const row = document.createElement('div');
    row.className = 'hint bulk-result ambiguous';

    const message = document.createElement('p');
    message.textContent = requestedName +
      ' — não encontrei um título/alias exato. Confira uma destas opções antes de adicionar:';
    row.appendChild(message);

    const actions = document.createElement('div');
    actions.className = 'bulk-suggestion-actions';
    for (const match of matches.slice(0, 3)) {
      if (!match.id) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = 'Conferir ' + match.title + ' (' +
        Math.round(match.score * 100) + '% · ' +
        (match.provider === 'curseforge' ? 'CurseForge' : 'Modrinth') + ')';
      button.onclick = () => {
        if (typeof openVersionPicker !== 'function') {
          message.textContent = 'Abra a busca de mods para conferir esta sugestão manualmente.';
          return;
        }
        openVersionPicker(
          { id: match.id, title: match.title, name: match.title },
          match.provider,
          'pack',
          (result) => {
            if (result && result.duplicate) {
              message.textContent = requestedName + ' — este mod já estava no modpack.';
              row.classList.remove('ambiguous');
              row.classList.add('duplicate');
              actions.remove();
              return;
            }
            if (result && result.item) {
              message.textContent = requestedName + ' — adicionado manualmente como ' +
                result.item.name + ' (' + result.item.version_name + ').';
              row.classList.remove('ambiguous');
              row.classList.add('success');
              actions.remove();
            }
          }
        ).catch((error) => {
          message.textContent = 'Não foi possível conferir a sugestão: ' +
            (error.message || 'erro inesperado');
        });
      };
      actions.appendChild(button);
    }
    if (actions.childElementCount) row.appendChild(actions);
    output.appendChild(row);
  }

  function readNames(value) {
    const lines = String(value || '').split(/\r?\n/);
    const names = [];
    for (let line of lines) {
      line = line.trim();
      if (!line || line.charCodeAt(0) === 96 || line.startsWith('#')) continue;
      line = line.replace(/^(?:[-*•]\s*|\d+[.)]\s*)/, '').trim();
      for (const part of line.split(/[;,]+/)) {
        const name = part.trim();
        if (name) names.push(name);
      }
    }
    const unique = [];
    for (const name of names) {
      if (!unique.some((existing) => sameModName(existing, name))) unique.push(name);
    }
    return unique;
  }

  async function readResponse(response) {
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch {
      throw new Error(response.status === 429
        ? 'O limite de requisições foi atingido.'
        : 'Resposta inválida do servidor (HTTP ' + response.status + ').');
    }
    if (!response.ok) throw new Error(data.error || ('Erro HTTP ' + response.status));
    return data;
  }

  async function fetchJson(url, signal) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      let response;
      try {
        response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
      } catch (error) {
        if (signal && signal.aborted) throw error;
        lastError = error;
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        throw lastError;
      }
      if ([429, 502, 503, 504].includes(response.status) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        continue;
      }
      return await readResponse(response);
    }
    throw lastError || new Error('Falha ao consultar o catálogo.');
  }

  async function searchProjects(provider, name, signal) {
    const searchTerms = [...new Set(aliasesFor(name))].slice(0, 3);
    const candidates = new Map();
    const mergeResults = (data) => {
      for (const project of data.results || []) {
        if (project && project.id != null) candidates.set(String(project.id), project);
      }
    };
    let ranked = searchCore.rankProjects([], name);

    // Primeira passagem: pesquisa com filtros de versão e loader para priorizar
    // resultados relevantes. Consulta aliases em vez de aceitar títulos parecidos.
    for (const term of searchTerms) {
      const params = new URLSearchParams({
        query: term,
        limit: '50',
        page: '0',
        sort: 'downloads_desc',
        type: 'mods',
        game_version: packConfig.minecraft_version
      });
      if (packConfig.loader && packConfig.loader !== 'vanilla') {
        params.set('loader', packConfig.loader);
      }
      const data = await fetchJson('/api/' + provider + '/search?' + params.toString(), signal);
      mergeResults(data);
      ranked = searchCore.rankProjects([...candidates.values()], name);
      if (ranked.exact.length) break;
    }

    // Segunda passagem: alguns projetos antigos não aparecem quando o catálogo
    // filtra a busca por loader/versão. A busca ampla só descobre candidatos;
    // os arquivos continuam sujeitos à validação estrita abaixo.
    if (!ranked.exact.length &&
        (packConfig.minecraft_version || (packConfig.loader && packConfig.loader !== 'vanilla'))) {
      const params = new URLSearchParams({
        query: name,
        limit: '50',
        page: '0',
        sort: 'downloads_desc',
        type: 'mods'
      });
      const data = await fetchJson('/api/' + provider + '/search?' + params.toString(), signal);
      mergeResults(data);
      ranked = searchCore.rankProjects([...candidates.values()], name);
    }

    return ranked;
  }

  async function findCompatibleFile(provider, project, signal) {
    if (provider === 'modrinth') {
      const params = new URLSearchParams({ game_version: packConfig.minecraft_version });
      if (packConfig.loader && packConfig.loader !== 'vanilla') params.set('loader', packConfig.loader);
      const data = await fetchJson(
        '/api/modrinth/project/' + encodeURIComponent(project.id) + '/versions?' + params.toString(), signal
      );
      const compatible = (data.versions || []).filter((version) =>
        (version.game_versions || []).includes(packConfig.minecraft_version) &&
        (packConfig.loader === 'vanilla' || (version.loaders || []).includes(packConfig.loader)) &&
        Array.isArray(version.files) && version.files.length > 0
      );
      const chosen = compatible[0];
      if (!chosen) return null;
      return { id: String(chosen.id), name: chosen.name || chosen.version_number || 'Versão compatível' };
    }

    const params = new URLSearchParams({ limit: '50', game_version: packConfig.minecraft_version });
    if (packConfig.loader && packConfig.loader !== 'vanilla') params.set('loader', packConfig.loader);
    const data = await fetchJson(
      '/api/curseforge/mod/' + encodeURIComponent(project.id) + '/files?' + params.toString(), signal
    );
    const chosen = (data.files || []).find((file) => {
      const gameOk = (file.gameVersions || []).includes(packConfig.minecraft_version);
      // O endpoint do Hub já aplica modLoaderType quando loader=forge/fabric etc.
      // Mods antigos podem não devolver a propriedade modLoader, mesmo após esse filtro.
      const loaderOk = packConfig.loader === 'vanilla' ||
        (file.loaders || []).includes(packConfig.loader);
      return gameOk && loaderOk;
    });
    if (!chosen) return null;
    return { id: String(chosen.id), name: chosen.displayName || chosen.fileName || 'Versão compatível' };
  }

  async function findOnProvider(provider, name, signal) {
    const ranked = await searchProjects(provider, name, signal);
    if (!ranked.exact.length) {
      return {
        missing: true,
        reason: 'Nenhum título ou alias exato encontrado.',
        suggestions: ranked.suggestions.slice(0, 3)
      };
    }

    for (const match of ranked.exact) {
      const project = match.project;
      const file = await findCompatibleFile(provider, project, signal);
      if (file) return { provider, project, file, versionName: file.name };
    }

    return {
      missing: true,
      reason: 'O projeto foi encontrado, mas não publicou arquivo confirmado para Minecraft ' +
        packConfig.minecraft_version + ' ' + packConfig.loader + '.',
      suggestions: ranked.suggestions.slice(0, 3)
    };
  }

  let activeController = null;
  let importCancelled = false;

  async function enhancedBulkImport() {
    const status = $('#bulk-import-status');
    const output = $('#bulk-import-results');
    const button = $('#bulk-add-mods');
    const cancelButton = $('#bulk-cancel-mods');
    if (!packConfig) { status.textContent = 'Configure primeiro o modpack.'; return; }
    if (activeController) return;

    const names = readNames($('#bulk-mod-list') && $('#bulk-mod-list').value);
    if (!names.length) { status.textContent = 'Cole pelo menos um nome de mod, um por linha.'; return; }
    if (names.length > 100) {
      status.textContent = 'Foram identificados ' + names.length +
        ' mods. O limite é 100 por modpack; divida a lista em duas partes.';
      return;
    }
    const potentialAdds = names.filter((name) =>
      !selected.some((current) => sameModName(current.name, name))
    ).length;
    if (selected.length + potentialAdds > 100) {
      status.textContent = 'Já existem ' + selected.length + ' mods selecionados. Mesmo descontando os nomes que já estão no modpack, esta importação ultrapassaria o limite total de 100.';
      return;
    }

    importCancelled = false;
    activeController = new AbortController();
    output.innerHTML = '';
    button.disabled = true;
    if (cancelButton) cancelButton.hidden = false;

    let added = 0;
    let notFound = 0;
    let fallbackCount = 0;
    let duplicates = 0;
    let ambiguous = 0;
    let interrupted = false;
    const preferred = packProvider === 'curseforge'
      ? ['curseforge', 'modrinth'] : ['modrinth', 'curseforge'];

    try {
      for (let index = 0; index < names.length; index++) {
        if (importCancelled || activeController.signal.aborted) break;
        const name = names[index];
        status.textContent = '(' + (index + 1) + '/' + names.length + ') Verificando ' +
          name + ' · ' + added + ' adicionados…';
        let found = null;
        const providerErrors = [];
        const possibleMatches = [];

        for (const provider of preferred) {
          if (importCancelled || activeController.signal.aborted) break;
          try {
            const result = await findOnProvider(provider, name, activeController.signal);
            if (!result.missing) {
              found = result;
              if (provider !== preferred[0]) fallbackCount++;
              break;
            }
            providerErrors.push((provider === 'curseforge' ? 'CurseForge' : 'Modrinth') +
              ': ' + result.reason);
            for (const match of result.suggestions || []) {
              possibleMatches.push({
                provider,
                id: String(match.project && match.project.id || ''),
                title: match.project && (match.project.title || match.project.name || match.project.slug) || 'Projeto sem título',
                score: Number(match.score) || 0
              });
            }
          } catch (error) {
            if (activeController.signal.aborted) break;
            providerErrors.push((provider === 'curseforge' ? 'CurseForge' : 'Modrinth') +
              ': ' + (error.message || 'falha na consulta'));
          }
        }

        if (importCancelled || activeController.signal.aborted) break;
        if (!found) {
          const uniqueSuggestions = [...new Map(
            possibleMatches.map((match) => [match.provider + ':' + match.id, match])
          ).values()].sort((a, b) => b.score - a.score);

          if (uniqueSuggestions.length) {
            ambiguous++;
            addSuggestionResult(name, uniqueSuggestions.slice(0, 3));
          } else {
            notFound++;
            addResult('✕ ' + name + ' — ' +
              (providerErrors.join(' · ') || 'Nenhum resultado compatível.'), 'failed');
          }
          continue;
        }

        const item = {
          provider: found.provider,
          id: String(found.project.id),
          name: found.project.title || found.project.name || name,
          version_id: found.file.id,
          version_name: found.versionName,
          game_version: packConfig.minecraft_version,
          loader: packConfig.loader === 'vanilla' ? '' : packConfig.loader
        };
        const alreadyAdded = selected.some((current) =>
          (current.provider === item.provider && String(current.id) === item.id) ||
          sameModName(current.name, item.name)
        );
        if (alreadyAdded) {
          duplicates++;
          addResult('↷ ' + name + ' — já estava no modpack; ignorado.', 'duplicate');
          continue;
        }

        selected.push(item);
        added++;
        if (typeof draw === 'function') draw();
        if (typeof drawPackSelection === 'function') drawPackSelection();
        addResult('✓ ' + item.name + ' — ' + item.version_name + ' · ' +
          (found.provider === 'curseforge' ? 'CurseForge' : 'Modrinth') +
          (found.provider !== preferred[0] ? ' · catálogo alternativo' : ''), 'success');
      }
      interrupted = importCancelled;
      status.textContent = interrupted
        ? 'Importação cancelada. ' + added + ' mod(s) adicionados foram mantidos.'
        : 'Concluído: ' + added + ' adicionado(s), ' + notFound +
          ' sem correspondência/arquivo compatível, ' + ambiguous +
          ' com nome incerto (não adicionados), ' + duplicates + ' duplicado(s), de ' +
          names.length + ' nomes. ' +
          (fallbackCount ? fallbackCount + ' encontrado(s) no catálogo alternativo. ' : '') +
          'Revise as sugestões antes de baixar.';
    } catch (error) {
      status.textContent = 'A importação foi interrompida: ' +
        (error.message || 'erro inesperado') + '. Os mods já adicionados foram mantidos.';
      addResult('Falha de comunicação. Tente novamente; os mods já adicionados foram preservados.', 'failed');
    } finally {
      activeController = null;
      button.disabled = false;
      if (cancelButton) cancelButton.hidden = true;
      if (typeof drawPackSelection === 'function') drawPackSelection();
    }
  }

  function cancelBulkImport() {
    if (!activeController) return;
    importCancelled = true;
    activeController.abort();
    const status = $('#bulk-import-status');
    if (status) status.textContent = 'Cancelando… Os mods já adicionados serão preservados.';
  }

  function setPackProvider(provider) {
    if (!['curseforge', 'modrinth'].includes(provider)) return;
    packProvider = provider;
    document.querySelectorAll('[data-pack-provider]').forEach((button) => {
      const active = button.dataset.packProvider === provider;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function loadLegacyProfile() {
    $('#pack-name').value = $('#pack-name').value.trim() || 'Mikael Legacy Tech 1.12.2';
    $('#pack-version').value = LEGACY_VERSION;
    $('#pack-loader').value = LEGACY_LOADER;
    $('#bulk-mod-list').value = LEGACY_MODS.join('\n');
    setPackProvider('curseforge');
    const status = $('#bulk-import-status');
    if (status) status.textContent = 'Perfil carregado: ' + LEGACY_MODS.length +
      ' mods para Minecraft 1.12.2 Forge. Confirme a configuração e depois toque em Procurar e adicionar mods.';
    const profileStatus = $('#legacy-profile-status');
    if (profileStatus) profileStatus.textContent = LEGACY_MODS.length +
      ' nomes carregados. A disponibilidade será conferida antes de adicionar.';
  }

  async function verifySelectedMod(project) {
    if (project.provider === 'modrinth') {
      const params = new URLSearchParams({ game_version: packConfig.minecraft_version });
      if (packConfig.loader && packConfig.loader !== 'vanilla') params.set('loader', packConfig.loader);
      const data = await fetchJson(
        '/api/modrinth/project/' + encodeURIComponent(project.id) + '/versions?' + params.toString()
      );
      return (data.versions || []).some((version) =>
        String(version.id) === String(project.version_id) &&
        (version.game_versions || []).includes(packConfig.minecraft_version) &&
        (packConfig.loader === 'vanilla' || (version.loaders || []).includes(packConfig.loader))
      );
    }
    const params = new URLSearchParams({ limit: '50', game_version: packConfig.minecraft_version });
    if (packConfig.loader && packConfig.loader !== 'vanilla') params.set('loader', packConfig.loader);
    const data = await fetchJson(
      '/api/curseforge/mod/' + encodeURIComponent(project.id) + '/files?' + params.toString()
    );
    return (data.files || []).some((file) =>
      String(file.id) === String(project.version_id) &&
      (file.gameVersions || []).includes(packConfig.minecraft_version) &&
      (packConfig.loader === 'vanilla' ||
        (file.loaders || []).includes(packConfig.loader))
    );
  }

  async function auditCompatibility() {
    const button = $('#analyze-pack');
    if (!packConfig) return;
    button.disabled = true;
    button.textContent = 'Verificando arquivos…';
    const findings = [];
    const seenNames = new Set();
    try {
      if (!selected.length) findings.push('Nenhum mod foi selecionado.');
      for (let index = 0; index < selected.length; index++) {
        const project = selected[index];
        const duplicate = [...seenNames].some((name) => sameModName(name, project.name));
        if (duplicate) findings.push('Possível duplicata: ' + project.name + '.');
        seenNames.add(project.name);
        if (project.game_version && project.game_version !== packConfig.minecraft_version) {
          findings.push(project.name + ': Minecraft ' + project.game_version +
            ' diferente de ' + packConfig.minecraft_version + '.');
          continue;
        }
        if (project.loader && project.loader !== packConfig.loader) {
          findings.push(project.name + ': loader ' + project.loader +
            ' diferente de ' + packConfig.loader + '.');
          continue;
        }
        try {
          if (!(await verifySelectedMod(project))) {
            findings.push(project.name + ': o arquivo selecionado não foi confirmado no filtro de versão/loader do catálogo.');
          }
        } catch (error) {
          findings.push(project.name + ': falha ao confirmar o arquivo (' +
            (error.message || 'erro de consulta') + ').');
        }
        $('#bulk-import-status').textContent = 'Auditoria: ' + (index + 1) +
          '/' + selected.length + ' arquivos verificados…';
      }
      findings.push('Esta auditoria verifica os metadados publicados pelo catálogo. Ela não executa os mods nem garante ausência de conflitos ou crashes no jogo.');
      if (typeof showAnalysis === 'function') showAnalysis('Auditoria de compatibilidade', findings);
    } finally {
      button.disabled = !packConfig;
      button.textContent = 'Analisar compatibilidade';
    }
  }

  const importButton = $('#bulk-add-mods');
  if (importButton) importButton.onclick = enhancedBulkImport;
  const cancelButton = $('#bulk-cancel-mods');
  if (cancelButton) cancelButton.onclick = cancelBulkImport;
  const presetButton = $('#legacy-profile-preset');
  if (presetButton) presetButton.onclick = loadLegacyProfile;
  const analyzeButton = $('#analyze-pack');
  if (analyzeButton) analyzeButton.onclick = auditCompatibility;

  window.MikaelLegacyProfile = {
    version: LEGACY_VERSION,
    loader: LEGACY_LOADER,
    modCount: LEGACY_MODS.length,
    load: loadLegacyProfile
  };
})();