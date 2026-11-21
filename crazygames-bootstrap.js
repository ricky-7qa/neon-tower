(function () {
  'use strict';
  window.NEON_CRAZYGAMES_BUILD = true;

  var nativeStorage;
  try { nativeStorage = window.localStorage; } catch (_) { nativeStorage = null; }
  var memoryStore = Object.create(null);
  var fallbackStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null; },
    setItem: function (key, value) { memoryStore[key] = String(value); },
    removeItem: function (key) { delete memoryStore[key]; },
    clear: function () { memoryStore = Object.create(null); },
    key: function (index) { return Object.keys(memoryStore)[index] || null; },
    get length() { return Object.keys(memoryStore).length; }
  };
  var activeStorage = nativeStorage || fallbackStorage;

  function storageCall(method, args) {
    try {
      if (activeStorage && typeof activeStorage[method] === 'function') {
        return activeStorage[method].apply(activeStorage, args);
      }
    } catch (error) {
      if (activeStorage !== nativeStorage && activeStorage !== fallbackStorage) {
        console.warn('[CrazyGames] Data module unavailable; falling back to browser storage.', error);
        activeStorage = nativeStorage || fallbackStorage;
      }
    }
    try {
      if (nativeStorage && typeof nativeStorage[method] === 'function') {
        return nativeStorage[method].apply(nativeStorage, args);
      }
      return fallbackStorage[method].apply(fallbackStorage, args);
    } catch (error) {
      console.warn('[Neon Tower] Storage operation failed:', error);
    }
    return method === 'getItem' || method === 'key' ? null : undefined;
  }

  window.neonStorage = {
    getItem: function (key) { return storageCall('getItem', [String(key)]); },
    setItem: function (key, value) { return storageCall('setItem', [String(key), String(value)]); },
    removeItem: function (key) { return storageCall('removeItem', [String(key)]); },
    clear: function () { return storageCall('clear', []); },
    key: function (index) { return storageCall('key', [index]); },
    get length() {
      try { return Number(activeStorage && activeStorage.length) || 0; } catch (_) { return 0; }
    }
  };

  var sdk = null;
  var environment = 'disabled';
  var sdkEnabled = false;
  var gameplayActive = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.body.appendChild(script);
    });
  }

  function updateLoadingStatus(message) {
    var status = document.getElementById('cg-loader-status');
    if (status) status.textContent = message;
  }

  window.NeonCrazyGamesBridge = {
    environment: environment,
    ready: false,
    gameplayStart: function () {
      if (!sdkEnabled || gameplayActive || !sdk || !sdk.game) return;
      try {
        sdk.game.gameplayStart();
        gameplayActive = true;
      } catch (error) { console.warn('[CrazyGames] gameplayStart failed:', error); }
    },
    gameplayStop: function () {
      if (!sdkEnabled || !gameplayActive || !sdk || !sdk.game) return;
      try {
        sdk.game.gameplayStop();
        gameplayActive = false;
      } catch (error) { console.warn('[CrazyGames] gameplayStop failed:', error); }
    }
  };

  async function boot() {
    updateLoadingStatus('CONNECTING TO CRAZYGAMES...');
    try {
      await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
      sdk = window.CrazyGames && window.CrazyGames.SDK;
      if (sdk && typeof sdk.init === 'function') {
        await sdk.init();
        environment = String(sdk.environment || 'disabled').toLowerCase();
        sdkEnabled = environment === 'crazygames' || environment === 'local';
        window.NeonCrazyGamesBridge.environment = environment;

        if (sdkEnabled) {
          window.NEON_CRAZYGAMES_SYSTEM_INFO = sdk.user && sdk.user.systemInfo ? sdk.user.systemInfo : null;
          var data = sdk.data;
          if (data && ['getItem', 'setItem', 'removeItem', 'clear'].every(function (method) {
            return typeof data[method] === 'function';
          })) activeStorage = data;

          var settings = sdk.game && sdk.game.settings ? sdk.game.settings : {};
          window.NEON_CRAZYGAMES_MUTE_AUDIO = settings.muteAudio === true;
          if (typeof sdk.game?.loadingStart === 'function') sdk.game.loadingStart();
          if (typeof sdk.game?.addSettingsChangeListener === 'function') {
            sdk.game.addSettingsChangeListener(function (nextSettings) {
              if (window.applyCrazyGamesAudioSettings) window.applyCrazyGamesAudioSettings(nextSettings);
              else window.NEON_CRAZYGAMES_MUTE_AUDIO = !!(nextSettings && nextSettings.muteAudio);
            });
          }
        }
      }
    } catch (error) {
      console.warn('[CrazyGames] SDK unavailable; continuing with browser storage.', error);
    }

    updateLoadingStatus('LOADING GAME SYSTEMS...');
    try {
      await loadScript('entidades.js?v=crazygames-basic-v1');
      await loadScript('engine.js?v=crazygames-basic-v1');
      await loadScript('level-mode-config.js?v=crazygames-basic-v1');
      await loadScript('ui.js?v=crazygames-basic-v1');

      if (window.applyCrazyGamesAudioSettings && sdkEnabled && sdk && sdk.game) {
        window.applyCrazyGamesAudioSettings(sdk.game.settings || {});
      }
      if (sdkEnabled && sdk && sdk.game && typeof sdk.game.loadingStop === 'function') sdk.game.loadingStop();
      window.NeonCrazyGamesBridge.ready = true;
      document.body.classList.remove('cg-booting');
    } catch (error) {
      console.error('[Neon Tower] Game files failed to load:', error);
      updateLoadingStatus('GAME COULD NOT LOAD. PLEASE REFRESH.');
    }
  }

  window.addEventListener('keydown', function (event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(event.key)) {
      var target = event.target;
      var isTextEntry = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (!isTextEntry) event.preventDefault();
    }
  }, { passive: false });

  boot();
})();