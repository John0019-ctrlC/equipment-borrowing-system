(function () {
  const dialog = document.getElementById('catalog-borrow-dialog');
  const form = document.getElementById('catalog-borrow-form');
  if (!dialog || !form) return;

  const quantity = document.getElementById('borrow-quantity');
  const itemName = document.getElementById('borrow-item-name');
  const itemNameInput = document.getElementById('borrower-item-name');
  const itemSpec = document.getElementById('borrow-item-spec');
  const itemStock = document.getElementById('borrow-item-stock');
  const dateNeeded = document.getElementById('borrow-date-needed');
  const returnDate = document.getElementById('borrow-return-date');
  let selectedItem = null;

  function localDateString(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function openForItem(item) {
    form.reset();
    selectedItem = item;
    form.action = '/borrowing/new/' + encodeURIComponent(item.id);
    itemName.textContent = item.name;
    itemNameInput.value = item.name;
    itemSpec.textContent = item.spec || item.category;
    itemStock.textContent = item.available + ' out of ' + item.total + ' available';
    quantity.min = '1';
    quantity.max = String(item.available);
    quantity.value = '1';
    const today = localDateString(new Date());
    dateNeeded.min = today;
    returnDate.min = today;
    dialog.showModal();
    document.getElementById('borrow-quantity').focus();
  }

  document.querySelectorAll('[data-borrow-item]').forEach(function (button) {
    button.addEventListener('click', function () {
      openForItem({
        id: button.dataset.id,
        name: button.dataset.name,
        category: button.dataset.category,
        spec: button.dataset.spec,
        available: Number(button.dataset.available),
        total: Number(button.dataset.total),
        maxDays: Number(button.dataset.maxDays),
      });
    });
  });

  document.querySelectorAll('[data-close-borrow]').forEach(function (button) {
    button.addEventListener('click', function () {
      dialog.close();
    });
  });

  document.querySelectorAll('[data-quantity-change]').forEach(function (button) {
    button.addEventListener('click', function () {
      const step = Number(button.dataset.quantityChange);
      const min = Number(quantity.min) || 1;
      const max = Number(quantity.max) || 1;
      const current = Number(quantity.value);
      const next = (Number.isFinite(current) ? current : min) + step;
      quantity.value = String(Math.max(min, Math.min(max, next)));
      quantity.dispatchEvent(new Event('input', { bubbles: true }));
      quantity.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  quantity.addEventListener('input', function () {
    const min = Number(quantity.min) || 1;
    const max = Number(quantity.max) || 1;
    const value = Number(quantity.value);
    if (Number.isFinite(value) && value > max) quantity.value = String(max);
    if (Number.isFinite(value) && value < min) quantity.value = String(min);
  });

  dateNeeded.addEventListener('change', function () {
    returnDate.min = dateNeeded.value || localDateString(new Date());
    if (returnDate.value && returnDate.value < returnDate.min) returnDate.value = returnDate.min;
  });

  form.addEventListener('submit', function (event) {
    if (!selectedItem) return;
    const needed = new Date(dateNeeded.value + 'T00:00:00');
    const returning = new Date(returnDate.value + 'T00:00:00');
    const maxDays = selectedItem.maxDays;
    const days = (returning - needed) / 86400000;
    if (days > maxDays) {
      event.preventDefault();
      returnDate.setCustomValidity('This item can be borrowed for up to ' + maxDays + ' days.');
      returnDate.reportValidity();
      returnDate.addEventListener('input', function clearValidity() {
        returnDate.setCustomValidity('');
        returnDate.removeEventListener('input', clearValidity);
      });
    }
  });

  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });

  const initialItem = document.getElementById('borrow-item-initial');
  if (initialItem) openForItem(JSON.parse(initialItem.textContent));
})();
