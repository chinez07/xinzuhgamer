// JavaScript / ad-faq.js / navegadores atuais e Node.js / perguntas frequentes do vendedor.
(function (root) {
  'use strict';
  function normalize(rows) {
    return (Array.isArray(rows) ? rows : []).slice(0, 5).map(function (row) {
      return {q: String(row && row.q || '').slice(0, 200), a: String(row && row.a || '').slice(0, 2000)};
    });
  }
  function complete(rows) {
    return normalize(rows).map(function (row) {return {q: row.q.trim(), a: row.a.trim()};})
      .filter(function (row) {return row.q && row.a;});
  }
  function editor(container, addButton, onChange) {
    var rows = [];
    function changed() {onChange(normalize(rows));}
    function render() {
      container.replaceChildren();
      rows.forEach(function (row, index) {
        var card = document.createElement('div'); card.className = 'faq-item';
        var top = document.createElement('div'); top.className = 'faq-item-top';
        var heading = document.createElement('strong'); heading.textContent = 'Pergunta ' + (index + 1);
        var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'faq-remove';
        remove.textContent = 'Remover'; remove.setAttribute('aria-label', 'Remover pergunta ' + (index + 1));
        remove.addEventListener('click', function () {rows.splice(index, 1); changed(); render();});
        top.append(heading, remove); card.append(top);
        [['q', 'Pergunta', 'Ex.: Como o produto é entregue?', 200], ['a', 'Resposta', 'Explique o que o comprador precisa saber.', 2000]].forEach(function (field) {
          var label = document.createElement('label'); label.textContent = field[1];
          var input = document.createElement(field[0] === 'q' ? 'input' : 'textarea');
          input.value = row[field[0]]; input.maxLength = field[3]; input.placeholder = field[2];
          input.setAttribute('data-faq-' + field[0], String(index));
          input.addEventListener('input', function () {row[field[0]] = input.value; changed();});
          label.append(input); card.append(label);
        });
        container.append(card);
      });
      addButton.disabled = rows.length >= 5;
      addButton.textContent = rows.length >= 5 ? 'Limite de 5 perguntas atingido' : '+ Adicionar pergunta (' + rows.length + '/5)';
    }
    addButton.addEventListener('click', function () {
      if (rows.length >= 5) return;
      rows.push({q: '', a: ''}); changed(); render();
      container.lastElementChild.querySelector('input').focus();
    });
    render();
    return {load: function (value) {rows = normalize(value); changed(); render();}, validate: function () {
      var invalid = rows.findIndex(function (row) {return !!row.q.trim() !== !!row.a.trim();});
      if (invalid < 0) return true;
      container.children[invalid].querySelector(rows[invalid].q.trim() ? 'textarea' : 'input').focus();
      return false;
    }};
  }
  function escape(value) {return String(value).replace(/[&<>"']/g, function (c) {return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function render(rows) {
    return complete(rows).map(function (row) {
      return '<details class="ad-faq-item"><summary>' + escape(root.BloxzuhContentPolicy ? root.BloxzuhContentPolicy.mask(row.q) : row.q) + '</summary><p style="white-space:pre-wrap;overflow-wrap:anywhere;margin-top:12px">' + escape(root.BloxzuhContentPolicy ? root.BloxzuhContentPolicy.mask(row.a) : row.a) + '</p></details>';
    }).join('');
  }
  var api = {normalize: normalize, complete: complete, editor: editor, render: render};
  root.BloxzuhAdFAQ = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
