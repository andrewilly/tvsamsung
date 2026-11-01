/* ============================================================
   DTV Stream - logica applicativa
   Target: browser TV Samsung Tizen 4.0 (Chromium 63) e browser desktop.
   Code style: ES2017 senza optional chaining / nullish coalescing,
   perche' il motore JS di un TV 2018 non li conosce.
   ============================================================ */
(function () {
  'use strict';

  var CHANNELS = window.CHANNELS || [];
  var NETWORK_LABELS = window.NETWORK_LABELS || {};
  var NETWORK_ACCENTS = { rai: '#3d7dff', mediaset: '#ff8a2b', cairo: '#ef4c5a' };

  /* hls.js 1.x usa sintassi moderna: se il TV la rifiuta si ripiega su 0.14.x,
     che e' ES5 e gira anche sui motori del 2018. */
  var HLS_SOURCES = [
    'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js',
    'https://cdn.jsdelivr.net/npm/hls.js@0.14.17/dist/hls.min.js'
  ];

  var PLAYBACK_TIMEOUT_MS = 14000;
  var LINK_NAV_DELAY_MS = 900;
  var OSD_VISIBLE_MS = 4200;
  var NUMPAD_IDLE_MS = 1800;

  var dom = {
    home: document.getElementById('screen-home'),
    player: document.getElementById('screen-player'),
    grid: document.getElementById('grid'),
    clock: document.getElementById('clock'),
    statusChip: document.getElementById('status-chip'),
    statusText: document.getElementById('status-text'),
    video: document.getElementById('video'),
    osd: document.getElementById('osd'),
    osdLcn: document.getElementById('osd-lcn'),
    osdName: document.getElementById('osd-name'),
    osdSub: document.getElementById('osd-sub'),
    hints: document.getElementById('player-hints'),
    state: document.getElementById('player-state'),
    stateCard: document.getElementById('state-card'),
    spinner: document.getElementById('spinner'),
    stateTitle: document.getElementById('state-title'),
    stateText: document.getElementById('state-text'),
    stateActions: document.getElementById('state-actions'),
    stateExtra: document.getElementById('state-extra'),
    numpad: document.getElementById('numpad'),
    numpadValue: document.getElementById('numpad-value')
  };

  var app = {
    screen: 'home',
    focus: 0,
    pendingIndex: -1,
    current: null,
    hls: null,
    engine: 'nessuno',
    actionFocus: 0,
    actions: [],
    osdTimer: null,
    hintsTimer: null,
    watchdog: null,
    navTimer: null,
    numBuffer: '',
    numTimer: null,
    triedNative: false
  };

  var tiles = [];

  /* ---------------------------------------------------------- utilita' */

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function onScreen(name) {
    app.screen = name;
    dom.home.className = name === 'home' ? 'screen is-active' : 'screen';
    dom.player.className = name === 'player' ? 'screen is-active' : 'screen';
    if (name === 'home') refreshTileFocus();
  }

  /* ---------------------------------------------------------- orologio e stato rete */

  function tickClock() {
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    dom.clock.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function refreshNetworkChip() {
    var online = navigator.onLine !== false;
    dom.statusChip.className = online ? 'chip' : 'chip is-offline';
    dom.statusText.textContent = online ? 'in linea' : 'senza rete';
  }

  window.addEventListener('online', refreshNetworkChip, false);
  window.addEventListener('offline', refreshNetworkChip, false);

  /* ---------------------------------------------------------- griglia canali */

  function buildGrid() {
    clear(dom.grid);
    tiles = [];

    var i;
    for (i = 0; i < CHANNELS.length; i++) {
      (function (index) {
        var ch = CHANNELS[index];
        var tile = make('div', 'tile net-' + ch.network);

        var top = make('div', 'tile-top');
        top.appendChild(make('div', 'tile-lcn', ch.lcn));

        var badge = make('div', 'tile-badge');
        if (ch.mode === 'hls') {
          badge.appendChild(make('b'));
          badge.appendChild(document.createTextNode('LIVE'));
        } else {
          badge.appendChild(document.createTextNode('WEB'));
        }
        top.appendChild(badge);

        var body = make('div', 'tile-body');
        body.appendChild(make('div', 'tile-net', NETWORK_LABELS[ch.network] || ''));
        body.appendChild(make('div', 'tile-name', ch.name));

        tile.appendChild(top);
        tile.appendChild(body);

        tile.addEventListener('click', function () {
          app.focus = index;
          refreshTileFocus();
          activateTile(index);
        }, false);

        dom.grid.appendChild(tile);
        tiles.push(tile);
      })(i);
    }

    app.focus = 0;
    refreshTileFocus();
  }

  function refreshTileFocus() {
    var i;
    for (i = 0; i < tiles.length; i++) {
      tiles[i].className = tiles[i].className.replace(/\s*is-focused/g, '');
      if (i === app.focus) tiles[i].className += ' is-focused';
    }
    var active = tiles[app.focus];
    if (active && active.scrollIntoView) {
      try {
        active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } catch (err) {
        active.scrollIntoView(false);
      }
    }
  }

  function spatialMove(fromIndex, dir) {
    if (!tiles.length) return -1;
    var cur = tiles[fromIndex].getBoundingClientRect();
    var cx = cur.left + cur.width / 2;
    var cy = cur.top + cur.height / 2;
    var best = -1;
    var bestScore = Infinity;

    for (var i = 0; i < tiles.length; i++) {
      if (i === fromIndex) continue;
      var r = tiles[i].getBoundingClientRect();
      var dx = (r.left + r.width / 2) - cx;
      var dy = (r.top + r.height / 2) - cy;
      var forward = (dir === 'left' && dx < -1) ||
                    (dir === 'right' && dx > 1) ||
                    (dir === 'up' && dy < -1) ||
                    (dir === 'down' && dy > 1);
      if (!forward) continue;
      var horizontal = dir === 'left' || dir === 'right';
      var primary = horizontal ? Math.abs(dx) : Math.abs(dy);
      var secondary = horizontal ? Math.abs(dy) : Math.abs(dx);
      var score = primary + secondary * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  function moveGridFocus(dir) {
    var next = spatialMove(app.focus, dir);
    if (next >= 0) {
      app.focus = next;
      refreshTileFocus();
    }
  }

  /* ---------------------------------------------------------- numpad */

  function numpadPush(digit) {
    if (app.numBuffer.length >= 3) app.numBuffer = '';
    app.numBuffer += digit;
    dom.numpadValue.textContent = app.numBuffer;
    dom.numpad.className = 'numpad is-visible';

    if (app.numTimer) clearTimeout(app.numTimer);
    app.numTimer = setTimeout(numpadCommit, NUMPAD_IDLE_MS);
  }

  function numpadCommit() {
    if (app.numTimer) {
      clearTimeout(app.numTimer);
      app.numTimer = null;
    }
    var wanted = parseInt(app.numBuffer, 10);
    app.numBuffer = '';
    dom.numpad.className = 'numpad';
    if (isNaN(wanted)) return;

    for (var i = 0; i < CHANNELS.length; i++) {
      if (CHANNELS[i].lcn === wanted) {
        app.focus = i;
        refreshTileFocus();
        activateTile(i);
        return;
      }
    }
    flashNumpadMiss();
  }

  function flashNumpadMiss() {
    dom.numpadValue.textContent = '--';
    dom.numpad.className = 'numpad is-visible';
    setTimeout(function () {
      dom.numpad.className = 'numpad';
    }, 700);
  }

  function numpadCancel() {
    if (app.numTimer) keepTimeoutClear();
    app.numBuffer = '';
    dom.numpad.className = 'numpad';
  }

  function keepTimeoutClear() {
    clearTimeout(app.numTimer);
    app.numTimer = null;
  }

  /* ---------------------------------------------------------- stato / overlay */

  function showState(options) {
    dom.spinner.className = options.spinner === false ? 'spinner is-hidden' : 'spinner';
    dom.stateTitle.textContent = options.title || '';
    dom.stateText.textContent = options.text || '';
    dom.stateExtra.textContent = options.extra || '';
    clear(dom.stateActions);

    app.actions = options.actions || [];
    app.actionFocus = 0;

    var i;
    for (i = 0; i < app.actions.length; i++) {
      (function (index) {
        var btn = make('button', 'btn' + (app.actions[index].primary ? ' btn-primary' : ''), app.actions[index].label);
        btn.type = 'button';
        btn.addEventListener('click', function () {
          runAction(index);
        }, false);
        dom.stateActions.appendChild(btn);
      })(i);
    }
    refreshActionFocus();
    dom.state.className = 'player-state';
  }

  function refreshActionFocus() {
    var buttons = dom.stateActions.children;
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].className = buttons[i].className.replace(/\s*is-focused/g, '');
      if (i === app.actionFocus) buttons[i].className += ' is-focused';
    }
  }

  function runAction(index) {
    var action = app.actions[index];
    if (action && typeof action.run === 'function') action.run();
  }

  function hideState() {
    dom.state.className = 'player-state is-hidden';
  }

  /* ---------------------------------------------------------- OSD */

  function osdShow() {
    if (!app.current) return;
    var accent = NETWORK_ACCENTS[app.current.network] || '#3d7dff';
    dom.osd.style.setProperty('--accent', accent);
    dom.osdLcn.textContent = app.current.lcn;
    dom.osdName.textContent = app.current.name;
    dom.osdSub.textContent = app.current.mode === 'hls' ? 'in diretta' : 'player ufficiale';
    dom.osd.className = 'osd is-visible';
    dom.hints.className = 'player-hints is-visible';

    if (app.osdTimer) clearTimeout(app.osdTimer);
    app.osdTimer = setTimeout(function () {
      dom.osd.className = 'osd';
      dom.hints.className = 'player-hints';
    }, OSD_VISIBLE_MS);
  }

  /* ---------------------------------------------------------- player */

  function loadScriptSequence(list, done) {
    if (!list.length) {
      done(null);
      return;
    }
    var src = list[0];
    var tag = document.createElement('script');
    tag.src = src;
    tag.async = true;
    tag.onload = function () {
      if (window.Hls && window.Hls.isSupported()) {
        app.engine = 'hls.js ' + (window.Hls.version || '');
        done(window.Hls);
      } else if (window.Hls) {
        app.engine = 'hls.js ' + (window.Hls.version || '') + ' (senza MSE)';
        done(null);
      } else {
        loadScriptSequence(list.slice(1), done);
      }
    };
    tag.onerror = function () {
      loadScriptSequence(list.slice(1), done);
    };
    document.head.appendChild(tag);
  }

  function canPlayNativeHls() {
    var v = dom.video;
    return !!(v.canPlayType && (v.canPlayType('application/vnd.apple.mpegurl') || v.canPlayType('application/x-mpegURL')));
  }

  function destroyPlayer() {
    if (app.hls) {
      try { app.hls.destroy(); } catch (err) { /* gia' distrutto */ }
      app.hls = null;
    }
    if (app.watchdog) {
      clearTimeout(app.watchdog);
      app.watchdog = null;
    }
    if (app.navTimer) {
      clearTimeout(app.navTimer);
      app.navTimer = null;
    }
    try {
      dom.video.pause();
    } catch (err) { /* nessun media attivo */ }
    dom.video.removeAttribute('src');
    try { dom.video.load(); } catch (err2) { /* motori datati */ }
  }

  function armWatchdog() {
    if (app.watchdog) clearTimeout(app.watchdog);
    app.watchdog = setTimeout(function () {
      if (dom.video.currentTime > 0 || dom.video.readyState >= 3) return;
      playbackFailed('Il canale non risponde in tempo.');
    }, PLAYBACK_TIMEOUT_MS);
  }

  function playbackFailed(reason) {
    destroyPlayer();
    showState({
      spinner: false,
      title: 'Canale non disponibile',
      text: reason + ' Il flusso puo\' essere momentaneamente interrotto o non raggiungibile dalla tua rete.',
      extra: 'motore: ' + app.engine,
      actions: [
        { label: 'Riprova', primary: true, run: function () { if (app.current) startPlayback(app.current); } },
        { label: 'Torna ai canali', run: closePlayer }
      ]
    });
  }

  function tryPlay() {
    var attempt = dom.video.play();
    if (attempt && typeof attempt.then === 'function') {
      attempt.then(function () {
        hideState();
      }).catch(function () {
        showState({
          spinner: false,
          title: 'Pronto per la visione',
          text: 'Il browser richiede un tocco per avviare la riproduzione.',
          actions: [{ label: 'Avvia', primary: true, run: function () { hideState(); tryPlay(); } }]
        });
      });
    } else {
      hideState();
    }
  }

  function attachNative(url) {
    app.engine = 'video nativo';
    dom.video.src = url;
    dom.video.load();
    armWatchdog();
    tryPlay();
  }

  function attachHls(lib, url) {
    app.hls = new lib({
      enableWorker: false,
      lowLatencyMode: false,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 3,
      fragLoadingMaxRetry: 4
    });

    app.hls.on(lib.Events.MANIFEST_PARSED, function () {
      tryPlay();
    });

    app.hls.on(lib.Events.ERROR, function (event, data) {
      if (!data || !data.fatal) return;
      if (data.type === lib.ErrorTypes.NETWORK_ERROR && !app.triedNative && canPlayNativeHls()) {
        app.triedNative = true;
        try { app.hls.destroy(); } catch (err) { /* gia' distrutto */ }
        app.hls = null;
        attachNative(url);
        return;
      }
      playbackFailed('Errore di rete sul flusso.');
    });

    app.hls.loadSource(url);
    app.hls.attachMedia(dom.video);
    armWatchdog();
  }

  function startPlayback(ch) {
    destroyPlayer();
    app.triedNative = false;
    onScreen('player');
    osdShow();
    showState({
      title: 'Connessione a ' + ch.name + '\u2026',
      text: 'Attendo il flusso video.',
      spinner: true
    });

    var nativeOk = canPlayNativeHls();

    loadScriptSequence(HLS_SOURCES.slice(0), function (lib) {
      if (lib) {
        attachHls(lib, ch.url);
        return;
      }
      if (nativeOk) {
        attachNative(ch.url);
        return;
      }
      showState({
        spinner: false,
        title: 'Riproduzione non supportata',
        text: 'Questo browser non supporta HLS ne\' Media Source Extensions. Apri il canale dal sito ufficiale del broadcaster.',
        extra: 'motore: ' + app.engine,
        actions: [
          { label: 'Apri il sito ufficiale', primary: true, run: function () { window.location.href = ch.url; } },
          { label: 'Torna ai canali', run: closePlayer }
        ]
      });
    });
  }

  function openChannel(ch) {
    app.current = ch;
    destroyPlayer();
    app.triedNative = false;
    onScreen('player');
    osdShow();

    if (ch.mode === 'link') {
      showState({
        title: 'Apro ' + ch.name,
        text: 'Il canale e\' protetto da DRM: lo guardi nel player ufficiale di ' + (NETWORK_LABELS[ch.network] || 'broadcaster') + '.',
        spinner: true,
        actions: [{ label: 'Annulla', run: closePlayer }]
      });
      app.navTimer = setTimeout(function () {
        app.navTimer = null;
        window.location.href = ch.url;
      }, LINK_NAV_DELAY_MS);
      return;
    }

    startPlayback(ch);
  }

  function closePlayer() {
    destroyPlayer();
    app.current = null;
    hideState();
    dom.osd.className = 'osd';
    dom.hints.className = 'player-hints';
    onScreen('home');
  }

  function stepChannel(delta) {
    if (!CHANNELS.length) return;
    var index = 0;
    if (app.current) {
      for (var i = 0; i < CHANNELS.length; i++) {
        if (CHANNELS[i] === app.current) { index = i; break; }
      }
    }
    index = (index + delta + CHANNELS.length) % CHANNELS.length;
    app.current = null;
    openChannel(CHANNELS[index]);
    app.focus = index;
  }

  function activateTile(index) {
    var ch = CHANNELS[index];
    if (!ch) return;
    openChannel(ch);
  }

  /* ---------------------------------------------------------- tastiera */

  function keyName(evt) {
    if (evt.key) return evt.key;
    var code = evt.keyCode;
    if (code === 37) return 'ArrowLeft';
    if (code === 38) return 'ArrowUp';
    if (code === 39) return 'ArrowRight';
    if (code === 40) return 'ArrowDown';
    if (code === 13) return 'Enter';
    if (code === 8) return 'Backspace';
    if (code === 27) return 'Escape';
    if (code >= 48 && code <= 57) return String.fromCharCode(code);
    if (code >= 96 && code <= 105) return String.fromCharCode(code - 48);
    return '';
  }

  function isBackKey(evt, name) {
    return name === 'Backspace' || name === 'Escape' || name === 'GoBack' ||
      evt.keyCode === 461 || evt.keyCode === 10009;
  }

  function handleKey(evt) {
    var name = keyName(evt);

    if (isBackKey(evt, name)) {
      evt.preventDefault();
      if (app.numBuffer) { numpadCancel(); return; }
      if (app.screen === 'player') closePlayer();
      return;
    }

    if (name === 'Enter' || evt.keyCode === 13) {
      evt.preventDefault();
      if (app.screen === 'home') {
        if (app.numBuffer) { numpadCommit(); return; }
        activateTile(app.focus);
        return;
      }
      if (app.actions.length) {
        runAction(app.actionFocus);
      } else {
        osdShow();
      }
      return;
    }

    if (name === 'ArrowLeft' || name === 'ArrowRight' || name === 'ArrowUp' || name === 'ArrowDown') {
      evt.preventDefault();
      if (app.screen === 'home') {
        moveGridFocus(name.replace('Arrow', '').toLowerCase());
        return;
      }
      if (app.actions.length) {
        if (name === 'ArrowLeft') {
          app.actionFocus = Math.max(0, app.actionFocus - 1);
        } else if (name === 'ArrowRight') {
          app.actionFocus = Math.min(app.actions.length - 1, app.actionFocus + 1);
        }
        refreshActionFocus();
        return;
      }
      if (name === 'ArrowLeft') stepChannel(-1);
      if (name === 'ArrowRight') stepChannel(1);
      return;
    }

    if (name.length === 1 && name >= '0' && name <= '9') {
      evt.preventDefault();
      numpadPush(name);
    }
  }

  document.addEventListener('keydown', handleKey, false);

  /* ---------------------------------------------------------- avvio */

  buildGrid();
  tickClock();
  setInterval(tickClock, 1000);
  refreshNetworkChip();
  onScreen('home');
})();
