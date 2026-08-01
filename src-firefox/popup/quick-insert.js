(function () {
  'use strict';

  // ── Quick Insert Snippets Module ──────────────────

  const STORAGE_KEY = 'quickInsertSnippets';

  let snippets = [];
  let snippetFormIndex = -1; // -1 = new, >= 0 = editing index
  let dragSrcIndex = -1;

  // ── Storage ──────────────────────────────────────

  window.loadSnippets = function (callback) {
    chrome.storage.local.get([STORAGE_KEY], function (result) {
      snippets = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
      if (callback) callback(snippets);
    });
  };

  window.saveSnippets = function (newSnippets) {
    snippets = newSnippets;
    chrome.storage.local.set({ [STORAGE_KEY]: snippets });
  };

  // ── Insert ───────────────────────────────────────

  window.insertSnippet = function (text, targetEl) {
    const el = targetEl || document.activeElement;
    if (!el || !(el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
      return false;
    }
    el.focus();
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.setRangeText(text, start, end, 'end');
    el.focus();
    // Trigger input and change events so existing save logic fires
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  // ── Panel ─────────────────────────────────────────

  window.openQuickInsertPanel = function (targetEl) {
    const activeEl = targetEl || document.activeElement;
    renderQuickInsertModal(activeEl);
    document.getElementById('quickInsertModal').classList.remove('hidden');
  };

  function renderQuickInsertModal(targetEl) {
    const container = document.getElementById('quickInsertModalContent');
    if (!container) return;

    // Remember the element that had focus
    container._targetEl = targetEl;

    const html = `
    <div class="qi-header">
      <h3>快速插入</h3>
      <button id="qiCloseBtn" class="btn btn-icon" title="关闭">✕</button>
    </div>
    <div class="qi-list" id="qiSnippetList">
      ${renderSnippetList()}
    </div>
    <div class="qi-footer">
      <button id="qiAddBtn" class="btn btn-action">新增</button>
      <div class="qi-footer-right">
        <button id="qiImportBtn" class="btn btn-action">导入 JSON</button>
        <button id="qiExportBtn" class="btn btn-action">导出 JSON</button>
        <input type="file" id="qiImportFileInput" accept=".json,application/json" style="display:none">
      </div>
    </div>
  `;

    container.innerHTML = html;

    bindQuickInsertEvents(container);
  }

  function renderSnippetList() {
    if (snippets.length === 0) {
      return '<div class="qi-empty">暂无文本片段，请添加</div>';
    }

    return snippets
      .map(function (snippet, i) {
        const label = typeof snippet === 'object' && snippet ? snippet.label || '' : '';
        const text = typeof snippet === 'object' && snippet ? snippet.text || '' : '';
        const display = label || (text.length > 80 ? text.substring(0, 80) + '...' : text);
        return `
      <div class="qi-item" draggable="true" data-qi-index="${i}">
        <span class="qi-drag-handle" title="拖拽排序">⋮⋮</span>
        <div class="qi-item-content">
          <div class="qi-item-preview">${escapeHtml(display)}</div>
        </div>
        <div class="qi-item-actions">
          <button class="btn btn-action qi-edit-btn" data-qi-action="edit" data-qi-index="${i}">编辑</button>
          <button class="btn btn-clear qi-delete-btn" data-qi-action="delete" data-qi-index="${i}">删除</button>
        </div>
      </div>`;
      })
      .join('');
  }

  function bindQuickInsertEvents(container) {
    // Close button
    const closeBtn = document.getElementById('qiCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeQuickInsertModal);

    // Add snippet → open form modal
    const addBtn = document.getElementById('qiAddBtn');
    if (addBtn)
      addBtn.addEventListener('click', function () {
        openSnippetForm(-1);
      });

    // Snippet list click delegation
    const list = document.getElementById('qiSnippetList');
    if (list) {
      list.addEventListener('click', handleSnippetClick);
    }

    // Bind drag events on initial items (re-bound in refreshSnippetList after DOM replacement)
    if (list) {
      list.querySelectorAll('.qi-item').forEach(function (item) {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
      });
    }

    // Export
    const exportBtn = document.getElementById('qiExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', handleExportSnippets);

    // Import: click directly opens file picker
    const importBtn = document.getElementById('qiImportBtn');
    const importFileInput = document.getElementById('qiImportFileInput');
    if (importBtn && importFileInput) {
      importBtn.addEventListener('click', function () {
        importFileInput.click();
      });
      importFileInput.addEventListener('change', handleImportFile);
    }

    // Backdrop click to close
    const modal = document.getElementById('quickInsertModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          closeQuickInsertModal();
        }
      });
    }
  }

  function bindSnippetFormEvents() {
    const saveBtn = document.getElementById('snippetFormSaveBtn');
    const cancelBtn = document.getElementById('snippetFormCancelBtn');
    const modal = document.getElementById('snippetFormModal');

    if (saveBtn) saveBtn.addEventListener('click', handleSnippetFormSave);
    if (cancelBtn) cancelBtn.addEventListener('click', closeSnippetForm);

    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          closeSnippetForm();
        }
      });
    }
  }

  // ── Snippet Form Modal ───────────────────────────

  function openSnippetForm(index) {
    snippetFormIndex = index;
    const title = document.getElementById('snippetFormModalTitle');
    const labelEl = document.getElementById('snippetFormLabel');
    const textEl = document.getElementById('snippetFormText');

    if (title) title.textContent = index >= 0 ? '编辑文本片段' : '新增文本片段';

    if (labelEl && textEl) {
      if (index >= 0 && index < snippets.length) {
        const snippet = snippets[index];
        labelEl.value = typeof snippet === 'object' ? snippet.label || '' : '';
        textEl.value = typeof snippet === 'object' ? snippet.text || '' : '';
      } else {
        labelEl.value = '';
        textEl.value = '';
      }
      autoResizeTextarea(labelEl);
      autoResizeTextarea(textEl);
      setTimeout(function () {
        textEl.focus();
      }, 50);
    }

    const modal = document.getElementById('snippetFormModal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeSnippetForm() {
    const modal = document.getElementById('snippetFormModal');
    if (modal) modal.classList.add('hidden');
    snippetFormIndex = -1;
  }

  function handleSnippetFormSave() {
    const labelEl = document.getElementById('snippetFormLabel');
    const textEl = document.getElementById('snippetFormText');
    const text = (textEl?.value || '').trim();

    if (!text) {
      showToast('请输入文本内容', 'error');
      return;
    }

    const label = (labelEl?.value || '').trim();
    const newSnippet = { text: text, label: label };

    if (snippetFormIndex >= 0 && snippetFormIndex < snippets.length) {
      // Editing existing snippet
      snippets[snippetFormIndex] = newSnippet;
    } else {
      // Adding new snippet
      snippets.push(newSnippet);
    }

    window.saveSnippets(snippets);
    closeSnippetForm();
    refreshSnippetList();
  }

  // ── Snippet List Actions ─────────────────────────

  function handleSnippetClick(e) {
    const target = e.target;

    // Click on snippet item itself (to insert)
    const item = e.target.closest('.qi-item');
    if (item && !e.target.closest('button') && !e.target.closest('.qi-drag-handle')) {
      const index = parseInt(item.dataset.qiIndex, 10);
      if (!Number.isNaN(index)) {
        const snippet = snippets[index];
        const text = typeof snippet === 'object' ? snippet.text || '' : '';
        const container = document.getElementById('quickInsertModalContent');
        const targetEl = container && container._targetEl;
        if (window.insertSnippet(text, targetEl)) {
          closeQuickInsertModal();
          // Trigger blur to save via existing field logic
          if (targetEl) {
            targetEl.dispatchEvent(new Event('blur', { bubbles: true }));
          }
        }
      }
      return;
    }

    // Handle button actions
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.qiAction;
    const index = parseInt(btn.dataset.qiIndex, 10);

    if (action === 'edit') {
      openSnippetForm(index);
    } else if (action === 'delete') {
      handleDeleteSnippet(index);
    }
  }

  function handleDeleteSnippet(index) {
    if (index < 0 || index >= snippets.length) return;
    snippets.splice(index, 1);
    window.saveSnippets(snippets);
    refreshSnippetList();
  }

  function refreshSnippetList() {
    const list = document.getElementById('qiSnippetList');
    if (list) {
      list.innerHTML = renderSnippetList();
      // Re-bind drag events since innerHTML replaced the elements
      list.querySelectorAll('.qi-item').forEach(function (item) {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
      });
    }
  }

  // ── Drag & Drop Reorder ──────────────────────────

  function handleDragStart(e) {
    const item = e.target.closest('.qi-item');
    if (!item) return;
    dragSrcIndex = parseInt(item.dataset.qiIndex, 10);
    item.classList.add('qi-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e) {
    e.preventDefault();
    const item = e.target.closest('.qi-item');
    if (!item) return;
    const dropIndex = parseInt(item.dataset.qiIndex, 10);
    if (dragSrcIndex < 0 || dragSrcIndex >= snippets.length) return;
    if (dropIndex < 0 || dropIndex >= snippets.length) return;
    if (dragSrcIndex === dropIndex) return;

    // Reorder
    const moved = snippets.splice(dragSrcIndex, 1)[0];
    snippets.splice(dropIndex, 0, moved);
    window.saveSnippets(snippets);
    refreshSnippetList();
  }

  function handleDragEnd(e) {
    const item = e.target.closest('.qi-item');
    if (item) item.classList.remove('qi-dragging');
    dragSrcIndex = -1;
  }

  // ── Import / Export ──────────────────────────────

  function handleExportSnippets() {
    // Export in new format: [{ text, label }]
    const exportData = snippets.map(function (s) {
      if (typeof s === 'object' && s) {
        return { text: s.text || '', label: s.label || '' };
      }
      return { text: String(s || ''), label: '' };
    });
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quick-insert-snippets.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportFile() {
    const input = document.getElementById('qiImportFileInput');
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      let parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (err) {
        showToast('JSON 格式错误', 'error');
        return;
      }

      if (
        !Array.isArray(parsed) ||
        parsed.some(function (item) {
          return typeof item !== 'object' || !item || !item.hasOwnProperty('text');
        })
      ) {
        showToast('不支持的格式', 'error');
        return;
      }

      // Convert to standard format
      const newSnippets = parsed.map(function (item) {
        return { text: String(item.text || ''), label: String(item.label || '') };
      });

      if (newSnippets.length === 0) {
        showToast('未找到有效的文本片段', 'warning');
        return;
      }

      const existingTexts = new Set(
        snippets.map(function (s) {
          return s.text;
        })
      );
      const toAdd = [];
      let skipped = 0;
      newSnippets.forEach(function (item) {
        if (existingTexts.has(item.text)) {
          skipped++;
        } else {
          toAdd.push(item);
        }
      });

      if (toAdd.length === 0) {
        showToast('所有片段已存在，未导入', 'warning');
        return;
      }

      snippets = snippets.concat(toAdd);
      window.saveSnippets(snippets);
      refreshSnippetList();
      const msg = '已导入 ' + toAdd.length + ' 条文本片段';
      showToast(skipped > 0 ? msg + '，' + skipped + ' 条重复已跳过' : msg, 'success');
    };
    reader.readAsText(file);
    input.value = '';
  }

  // ── Close ────────────────────────────────────────

  function closeQuickInsertModal() {
    const modal = document.getElementById('quickInsertModal');
    if (modal) modal.classList.add('hidden');
    // Also close the snippet form modal
    closeSnippetForm();
  }

  window.closeQuickInsertModal = closeQuickInsertModal;

  // ── Initialize static modal events once ──────────
  bindSnippetFormEvents();
})();
