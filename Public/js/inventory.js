(function () {
  const dialog = document.getElementById('add-dialog');
  const openAdd = document.getElementById('open-add');
  const closeAdd = document.getElementById('close-add');
  const cancelAdd = document.getElementById('cancel-add');

  if (dialog && openAdd) {
    openAdd.addEventListener('click', function () {
      dialog.showModal();
      document.getElementById('a-name').focus();
    });
    [closeAdd, cancelAdd].forEach(function (button) {
      button.addEventListener('click', function () {
        dialog.close();
      });
    });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
  }

  document.querySelectorAll('[data-edit-equipment]').forEach(function (button) {
    button.addEventListener('click', function () {
      const id = button.dataset.editEquipment;
      const form = document.getElementById('edit-' + id);
      Array.from(form.elements).forEach(function (input) {
        input.disabled = false;
      });
      button.hidden = true;
      document.querySelector('[data-save-equipment="' + id + '"]').hidden = false;
      document.querySelector('[data-cancel-equipment="' + id + '"]').hidden = false;
      form.querySelector('input[name="name"]').focus();
    });
  });

  document.querySelectorAll('[data-cancel-equipment]').forEach(function (button) {
    button.addEventListener('click', function () {
      const id = button.dataset.cancelEquipment;
      const form = document.getElementById('edit-' + id);
      form.reset();
      Array.from(form.elements).forEach(function (input) {
        input.disabled = true;
      });
      document.querySelector('[data-edit-equipment="' + id + '"]').hidden = false;
      document.querySelector('[data-save-equipment="' + id + '"]').hidden = true;
      button.hidden = true;
    });
  });
})();
