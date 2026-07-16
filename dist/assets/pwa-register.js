const pwaConfig = window.OsadaFabrycznaPwa || {};
const pwaLabels = pwaConfig.labels || {};
let deferredInstallPrompt = null;

if ('serviceWorker' in navigator && pwaConfig.serviceWorkerUrl) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register(
      pwaConfig.serviceWorkerUrl,
      { scope: pwaConfig.scope }
    ).catch(function (error) {
      console.warn('PWA service worker registration failed.', error);
    });
  });
}

window.addEventListener('beforeinstallprompt', function (event) {
  event.preventDefault();
  deferredInstallPrompt = event;
  addInstallMenuItem();
});

window.addEventListener('appinstalled', function () {
  deferredInstallPrompt = null;
  removeInstallMenuItem();
});

document.addEventListener('DOMContentLoaded', function () {
  if (isIosBrowser() && !isStandalone()) {
    addInstallMenuItem();
  }
});

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosBrowser() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

function addInstallMenuItem() {
  if (isStandalone() || document.querySelector('.pwa-install-menu-item')) {
    return;
  }

  const menu = document.querySelector('.main-nav .menu');

  if (!menu) {
    return;
  }

  const item = document.createElement('li');
  const button = document.createElement('button');

  item.className = 'pwa-install-menu-item';
  button.className = 'pwa-install-button';
  button.type = 'button';
  button.textContent = pwaLabels.install || 'Dodaj do ekranu głównego';
  button.addEventListener('click', handleInstallClick);
  item.append(button);
  menu.append(item);
}

function removeInstallMenuItem() {
  const item = document.querySelector('.pwa-install-menu-item');

  if (item) {
    item.remove();
  }
}

function handleInstallClick(event) {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function () {
      deferredInstallPrompt = null;
      removeInstallMenuItem();
    });
    return;
  }

  if (isIosBrowser()) {
    openIosInstallDialog(event.currentTarget);
  }
}

function openIosInstallDialog(trigger) {
  const dialog = document.createElement('div');
  const content = document.createElement('div');
  const title = document.createElement('h2');
  const text = document.createElement('p');
  const closeButton = document.createElement('button');
  let onKeydown;

  dialog.className = 'pwa-install-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'pwa-install-dialog-title');
  content.className = 'pwa-install-dialog__content';
  title.id = 'pwa-install-dialog-title';
  title.textContent = pwaLabels.dialogTitle || 'Dodaj Osadę Fabryczną';
  text.textContent = pwaLabels.dialogText || 'W Safari stuknij Udostępnij, a następnie wybierz „Do ekranu początkowego”.';
  closeButton.className = 'pwa-install-dialog__close';
  closeButton.type = 'button';
  closeButton.textContent = pwaLabels.close || 'Zamknij';

  function closeDialog() {
    document.removeEventListener('keydown', onKeydown);
    dialog.remove();
    trigger.focus();
  }

  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) {
      closeDialog();
    }
  });

  onKeydown = function (event) {
    if (event.key === 'Escape') {
      closeDialog();
    }
  };
  document.addEventListener('keydown', onKeydown);

  content.append(title, text, closeButton);
  dialog.append(content);
  document.body.append(dialog);
  closeButton.focus();
}
