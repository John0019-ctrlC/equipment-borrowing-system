(function () {
  const dialog = document.getElementById('announcement-editor');
  const form = document.getElementById('announcement-form');
  if (!dialog || !form) return;

  const title = document.getElementById('announcement-editor-title');
  const titleInput = document.getElementById('announcement-title');
  const messageInput = document.getElementById('announcement-message');
  const audienceInput = document.getElementById('announcement-audience');
  const priorityInput = document.getElementById('announcement-priority');
  const publishAtInput = document.getElementById('announcement-publish-at');
  const attachmentInput = document.getElementById('announcement-attachment');
  const pinnedInput = form.elements.pinned;

  function resetEditor() {
    form.reset();
    form.action = '/announcements/manage';
    title.textContent = 'Create announcement';
  }

  function toLocalDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  document.querySelector('[data-create-announcement]').addEventListener('click', function () {
    resetEditor();
    dialog.showModal();
    titleInput.focus();
  });

  document.querySelectorAll('[data-edit-announcement]').forEach(function (button) {
    button.addEventListener('click', function () {
      resetEditor();
      form.action = '/announcements/manage/' + encodeURIComponent(button.dataset.id);
      title.textContent = 'Edit announcement';
      titleInput.value = button.dataset.title || '';
      messageInput.value = button.dataset.message || '';
      audienceInput.value = button.dataset.audience || 'All Users';
      priorityInput.value = button.dataset.priority || 'normal';
      publishAtInput.value = toLocalDateTime(button.dataset.publishAt);
      attachmentInput.value = button.dataset.attachmentUrl || '';
      pinnedInput.checked = button.dataset.pinned === 'true';
      dialog.showModal();
      titleInput.focus();
    });
  });

  document.querySelectorAll('[data-close-announcement]').forEach(function (button) {
    button.addEventListener('click', function () {
      dialog.close();
    });
  });

  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });

  document.querySelectorAll('[data-format]').forEach(function (button) {
    button.addEventListener('click', function () {
      const start = messageInput.selectionStart;
      const end = messageInput.selectionEnd;
      const selected = messageInput.value.slice(start, end);
      let replacement;
      switch (button.dataset.format) {
        case 'bold':
          replacement = selected ? '**' + selected + '**' : '****';
          break;
        case 'italic':
          replacement = selected ? '_' + selected + '_' : '__';
          break;
        case 'bullet':
          replacement = selected
            ? selected.split('\n').map((line) => '- ' + line).join('\n')
            : '- ';
          break;
        case 'number':
          replacement = selected
            ? selected.split('\n').map((line, index) => (index + 1) + '. ' + line).join('\n')
            : '1. ';
          break;
        case 'link': {
          const url = window.prompt('Enter a URL beginning with https://');
          if (!url) return;
          replacement = '[' + (selected || 'link text') + '](' + url + ')';
          break;
        }
        default:
          return;
      }
      messageInput.setRangeText(replacement, start, end, 'select');
      messageInput.focus();
    });
  });
})();
