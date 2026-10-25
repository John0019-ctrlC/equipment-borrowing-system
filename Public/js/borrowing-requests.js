(function () {
  const dialog = document.getElementById('request-detail-dialog');
  if (!dialog) return;

  const decisionForm = document.getElementById('request-decision-form');
  const returnForm = document.getElementById('request-return-form');
  const statusBadge = document.getElementById('request-dialog-status');
  const notesRow = document.getElementById('request-dialog-notes-row');
  const adminComment = document.getElementById('request-dialog-admin-comment');
  const commentInput = document.getElementById('request-admin-comment-input');

  function setText(id, value) {
    document.getElementById(id).textContent = value || '';
  }

  document.querySelectorAll('[data-view-request]').forEach(function (button) {
    button.addEventListener('click', function () {
      const requestUrl = '/borrowing/requests/' + encodeURIComponent(button.dataset.id);
      setText('request-dialog-code', button.dataset.code);
      setText('request-dialog-borrower', button.dataset.borrower);
      setText('request-dialog-school-id', button.dataset.schoolId);
      setText('request-dialog-course', button.dataset.course);
      setText('request-dialog-equipment', button.dataset.equipment + ' × ' + button.dataset.quantity);
      setText('request-dialog-date-needed', button.dataset.dateNeeded);
      setText('request-dialog-return-date', button.dataset.returnDate);
      setText('request-dialog-purpose', button.dataset.purpose);
      setText('request-dialog-notes', button.dataset.notes);
      notesRow.hidden = !button.dataset.notes;

      statusBadge.textContent = button.dataset.displayStatus;
      statusBadge.className = 'request-status request-status--' + button.dataset.displayStatus;
      setText('request-dialog-availability',
        'Item availability: ' + button.dataset.available + ' of ' + button.dataset.total + ' available in stock.');

      adminComment.hidden = !button.dataset.adminComment;
      adminComment.textContent = button.dataset.adminComment
        ? 'Admin comment: ' + button.dataset.adminComment
        : '';
      commentInput.value = '';
      decisionForm.action = requestUrl + '/decision';
      returnForm.action = requestUrl + '/returned';

      const isPending = button.dataset.status === 'pending';
      const isApproved = button.dataset.status === 'approved';
      decisionForm.hidden = !isPending;
      returnForm.hidden = !isApproved;
      dialog.showModal();
    });
  });

  document.querySelectorAll('[data-close-request]').forEach(function (button) {
    button.addEventListener('click', function () {
      dialog.close();
    });
  });

  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });
})();
