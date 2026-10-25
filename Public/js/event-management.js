(function () {
  const dialog = document.getElementById('event-editor');
  const form = document.getElementById('event-form');
  if (!dialog || !form) return;

  const heading = document.getElementById('event-editor-title');
  const submitButton = document.getElementById('event-submit-button');
  const statusField = document.querySelector('[data-event-status-field]');
  const fields = {
    title: document.getElementById('event-title'),
    date: document.getElementById('event-date'),
    time: document.getElementById('event-time'),
    venue: document.getElementById('event-venue'),
    limit: document.getElementById('event-limit'),
    status: document.getElementById('event-status'),
    description: document.getElementById('event-description'),
  };

  function resetEditor() {
    form.reset();
    form.action = '/events';
    heading.textContent = 'Create event';
    submitButton.textContent = 'Create Event';
    statusField.hidden = true;
    fields.limit.value = '0';
  }

  document.querySelector('[data-create-event]').addEventListener('click', function () {
    resetEditor();
    dialog.showModal();
    fields.title.focus();
  });

  document.querySelectorAll('[data-edit-event]').forEach(function (button) {
    button.addEventListener('click', function () {
      resetEditor();
      form.action = '/events/' + encodeURIComponent(button.dataset.id) + '/edit';
      heading.textContent = 'Edit event';
      submitButton.textContent = 'Save Changes';
      fields.title.value = button.dataset.title || '';
      fields.date.value = button.dataset.date || '';
      fields.time.value = button.dataset.time || '';
      fields.venue.value = button.dataset.venue || '';
      fields.limit.value = button.dataset.limit || '0';
      fields.status.value = button.dataset.status || 'open';
      fields.description.value = button.dataset.description || '';
      statusField.hidden = false;
      dialog.showModal();
      fields.title.focus();
    });
  });

  document.querySelectorAll('[data-close-event]').forEach(function (button) {
    button.addEventListener('click', function () {
      dialog.close();
    });
  });

  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });
})();
