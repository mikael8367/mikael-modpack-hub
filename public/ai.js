(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const history = [];
  const form = $('#ai-form');
  const input = $('#ai-input');
  const send = $('#ai-send');
  const chat = $('#ai-chat');
  const status = $('#ai-status');

  function addMessage(role, message) {
    if (!chat) return;
    const article = document.createElement('article');
    const label = document.createElement('b');
    const body = document.createElement('p');
    article.className = 'ai-message ' + (role === 'user' ? 'user' : 'assistant');
    label.textContent = role === 'user' ? 'Você' : 'Mikael AI';
    body.textContent = message;
    article.append(label, body);
    chat.appendChild(article);
    chat.scrollTop = chat.scrollHeight;
  }

  window.refreshAiStatus = async function refreshAiStatus() {
    if (!status) return;
    try {
      const response = await fetch('/api/ai/status', { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Status HTTP ' + response.status);
      status.textContent = data.message || (data.configured ? 'Mikael AI pronta' : 'API online, aguardando configuração');
      status.dataset.state = data.configured ? 'ready' : data.online ? 'setup' : 'offline';
    } catch (error) {
      status.textContent = 'Não foi possível verificar a Mikael AI: ' + error.message;
      status.dataset.state = 'offline';
    }
  };

  async function sendMessage(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
    if (!input || !send || !chat) return;
    const message = input.value.trim();
    if (!message || send.disabled) return;
    if (message.length > 12000) {
      addMessage('assistant', 'A mensagem passou do limite de 12.000 caracteres.');
      return;
    }

    addMessage('user', message);
    input.value = '';
    send.disabled = true;
    send.textContent = 'Pensando…';
    const pending = document.createElement('article');
    pending.className = 'ai-message assistant ai-pending';
    pending.textContent = 'Mikael AI está analisando…';
    chat.appendChild(pending);
    chat.scrollTop = chat.scrollHeight;

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message, history: history.slice(-12) })
      });
      const data = await response.json().catch(() => ({}));
      pending.remove();
      if (!response.ok || !data.ok || typeof data.answer !== 'string') {
        addMessage('assistant', data.error || ('A API respondeu com erro HTTP ' + response.status + '.'));
        return;
      }
      history.push({ role: 'user', text: message }, { role: 'model', text: data.answer });
      addMessage('assistant', data.answer);
    } catch (error) {
      pending.remove();
      addMessage('assistant', 'Falha de conexão com a Mikael AI: ' + (error.message || 'erro desconhecido') + '.');
    } finally {
      send.disabled = false;
      send.textContent = 'Enviar';
      input.focus();
    }
  }

  if (form) {
    // Captura o submit antes do comportamento padrão do navegador.
    form.addEventListener('submit', sendMessage, true);
    form.addEventListener('keydown', (event) => {
      if (event.target === input && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        form.requestSubmit ? form.requestSubmit(send) : sendMessage(event);
      }
    });
  }
  if (send) send.addEventListener('click', (event) => {
    event.preventDefault();
    if (form && form.requestSubmit) form.requestSubmit(send);
    else sendMessage(event);
  });
  const clear = $('#ai-clear');
  if (clear) clear.addEventListener('click', (event) => {
    event.preventDefault();
    history.length = 0;
    if (chat) chat.innerHTML = '';
    addMessage('assistant', 'Conversa limpa. Pode enviar sua próxima dúvida sobre Minecraft!');
  });

  window.addEventListener('load', () => {
    if (status) window.refreshAiStatus();
  }, { once: true });
})();
