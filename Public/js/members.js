(function () {
  document.querySelectorAll('[data-edit-member]').forEach(function (button) {
    button.addEventListener('click', function () {
      const id = button.dataset.editMember;
      const form = document.getElementById('m-' + id);
      document.querySelectorAll('[form="m-' + id + '"]').forEach(function (field) {
        field.disabled = false;
      });
      button.hidden = true;
      document.querySelector('[data-save-member="' + id + '"]').hidden = false;
      document.querySelector('[data-cancel-member="' + id + '"]').hidden = false;
      document.querySelector('[form="m-' + id + '"][name="name"]').focus();
    });
  });

  document.querySelectorAll('[data-cancel-member]').forEach(function (button) {
    button.addEventListener('click', function () {
      const id = button.dataset.cancelMember;
      const form = document.getElementById('m-' + id);
      document.querySelectorAll('[form="m-' + id + '"]').forEach(function (field) {
        field.disabled = true;
      });
      document.querySelector('[data-edit-member="' + id + '"]').hidden = false;
      document.querySelector('[data-save-member="' + id + '"]').hidden = true;
      button.hidden = true;
      form.reset();
    });
  });
})();
