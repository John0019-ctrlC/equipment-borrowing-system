(function () {
  const root = document.documentElement;
  const body = document.body;
  const toggle = document.querySelector('.theme-toggle');
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const accountMenu = document.querySelector('[data-account-menu]');
  const accountToggle = document.querySelector('[data-account-toggle]');
  const accountLogout = document.getElementById('account-logout');

  function applyTheme(mode) {
    const isDark = mode === 'dark';
    root.dataset.mode = mode;
    body.classList.toggle('theme-dark', isDark);
    body.classList.toggle('theme-light', !isDark);
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      toggle.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  applyTheme(root.dataset.mode === 'dark' ? 'dark' : 'light');

  if (toggle) {
    toggle.addEventListener('click', function () {
      const nextMode = root.dataset.mode === 'dark' ? 'light' : 'dark';
      applyTheme(nextMode);

      try {
        localStorage.setItem('theme-mode', nextMode);
      } catch (error) {
        console.error('Unable to save the theme preference.', error);
      }
    });
  }

  if (sidebarToggle) {
    function setSidebarCollapsed(isCollapsed) {
      root.dataset.sidebarCollapsed = String(isCollapsed);
      body.classList.toggle('sidebar-collapsed', isCollapsed);
      sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
      sidebarToggle.setAttribute('aria-label', isCollapsed ? 'Expand navigation' : 'Collapse navigation');
      sidebarToggle.setAttribute('title', isCollapsed ? 'Expand navigation' : 'Collapse navigation');
    }

    setSidebarCollapsed(root.dataset.sidebarCollapsed === 'true');
    sidebarToggle.addEventListener('click', function () {
      const isCollapsed = root.dataset.sidebarCollapsed !== 'true';
      setSidebarCollapsed(isCollapsed);

      try {
        localStorage.setItem('sidebar-collapsed', String(isCollapsed));
      } catch (error) {
        console.error('Unable to save the sidebar preference.', error);
      }
    });
  }

  if (accountMenu && accountToggle && accountLogout) {
    function setAccountMenuOpen(isOpen) {
      accountLogout.hidden = !isOpen;
      accountToggle.setAttribute('aria-expanded', String(isOpen));
    }

    accountToggle.addEventListener('click', function () {
      setAccountMenuOpen(accountLogout.hidden);
    });

    document.addEventListener('click', function (event) {
      if (!accountMenu.contains(event.target)) setAccountMenuOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !accountLogout.hidden) {
        setAccountMenuOpen(false);
        accountToggle.focus();
      }
    });
  }
})();
