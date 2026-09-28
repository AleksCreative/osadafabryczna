// Centrum Osady używane w widoku startowym i przy centrowaniu mapy.
const MAP_CENTER = [52.057082, 20.436703];
// Granice geograficzne mapy ilustrowanej.
const IMAGE_BOUNDS = [
  [52.078133, 20.520637], // północny wschód
  [52.033089, 20.370405]  // południowy zachód
];
const TARGET_HEIGHT = 150; // Domyślna maksymalna wysokość pionowych ikon w pikselach.
const TARGET_WIDTH = 150; // Domyślna maksymalna szerokość poziomych i kwadratowych ikon w pikselach.
const SQUARE_MAX_SIZE = 70; // Maksymalny bok kwadratowej ikony budynku w pikselach.
const HORIZONTAL_MAX_WIDTH = 80; // Maksymalna szerokość poziomej ikony budynku w pikselach.
const HORIZONTAL_MAX_HEIGHT = 150; // Maksymalna wysokość poziomej ikony budynku w pikselach.
const VERTICAL_MAX_WIDTH = 150; // Maksymalna szerokość pionowej ikony budynku w pikselach.
const VERTICAL_MAX_HEIGHT = 80; // Maksymalna wysokość pionowej ikony budynku w pikselach.
const DEFAULT_BUILDING_MARKER_WIDTH = 50; // Szerokość zastępczej ikony budynku w pikselach.
const MARKER_PADDING = 6; // Wewnętrzny odstęp wokół ikony znacznika w pikselach.
const ZOOM_STEP_FACTOR = 1.2; // Skala zmiany wielkości ikon pomiędzy poziomami zoomu.
const MOBILE_PANEL_MARKER_GAP = 84; // Odstęp znacznika od panelu budynku na telefonie w pikselach.
const EXTRA_PANEL_MARGIN = 8; // Dodatkowy margines panelu budynku w pikselach.
const PANEL_MARKER_GAP_SCALE = 0.6; // Mnożnik odstępu znacznika od otwartego panelu.
const ACTIVE_MARKER_SCALE = 1.2; // Powiększenie aktywnego znacznika budynku.
const PANEL_MARKER_FLY_DURATION = 1.2; // Czas lotu do znacznika po otwarciu panelu w sekundach.
const PANEL_MARKER_FLY_TIMEOUT = 1300; // Awaryjny limit czasu lotu do znacznika w milisekundach.
const DESKTOP_POPUP_MARKER_GAP = 24; // Odstęp między znacznikiem a popupem na komputerze w pikselach.
const DESKTOP_POPUP_MARKER_TARGET_Y_RATIO = 0.78; // Docelowa pionowa pozycja znacznika przy otwartym popupie.
const USER_MARKER_Z_INDEX_OFFSET = 10000; // Priorytet wyświetlania znacznika użytkownika nad pozostałymi ikonami.
const USER_MARKER_MOVE_DURATION = 900; // Czas animacji przesunięcia znacznika użytkownika w milisekundach.
const USER_MARKER_SNAP_DISTANCE_METERS = 120; // Odległość, poniżej której znacznik użytkownika przeskakuje bez animacji.
const USER_MARKER_SIZE = 60; // Rozmiar znacznika lokalizacji użytkownika w pikselach.
const ILLUSTRATED_MARKER_EDGE_PADDING = 40; // Bezpieczny odstęp znacznika użytkownika od krawędzi ilustracji w pikselach.
const OSM_MIN_ZOOM = 7; // Najdalszy dozwolony poziom oddalenia mapy współczesnej.
const SETTLEMENT_OVERVIEW_MAX_ZOOM = 11; // Najbliższy zoom, przy którym widać zbiorczy znacznik Osady.
const USER_LOCATION_FOCUS_ZOOM = 16.5; // Zoom używany przy centrowaniu mapy na użytkowniku.
const SETTLEMENT_FOCUS_ZOOM = 16.5; // Zoom używany po kliknięciu zbiorczego znacznika Osady.
const ILLUSTRATED_SWITCH_ZOOM = 16.5; // Zoom po powrocie z odległego miejsca na mapę ilustrowaną.
const DISTANT_LOCATION_NOTICE_METERS = 300000; // Odległość uruchamiająca komunikat o dalekiej lokalizacji w metrach.
const MAP_MODE_FLY_DURATION = 1.3; // Całkowity czas lotu przy zmianie mapy w sekundach.
const MAP_ILLUSTRATED_REVEAL_LEAD_TIME = 0.25; // Ile sekund przed końcem lotu zaczyna pojawiać się ilustracja.
const MAP_LAYER_FADE_DURATION = 500; // Czas przenikania mapy ilustrowanej w milisekundach.
const MAP_LAYER_LOAD_TIMEOUT = 900; // Maksymalny czas oczekiwania na kafelki ilustracji przed przenikaniem.
const ILLUSTRATED_OVERLAY_OPACITY = 0.7; // Docelowa przezroczystość warstwy ilustracji.
const ILLUSTRATED_LABEL_OPACITY = 0.95; // Docelowa przezroczystość nazw ulic nad ilustracją.
const EDGE_GESTURE_MIN_DISTANCE = 32; // Minimalna długość gestu przy krawędzi uruchamiającego podpowiedź w pikselach.
const EDGE_NOTICE_COOLDOWN = 8000; // Minimalny odstęp między podświetleniami przełącznika w milisekundach.
const MAP_NOTICE_DURATION = 9000; // Czas wyświetlania komunikatu mapy w milisekundach.
const MAP_SWITCH_GUIDANCE_STORAGE_KEY = 'osada-map-switch-guidance-seen'; // Klucz zapamiętujący pokazanie podpowiedzi w sesji.
const MAP_CONFIG = window.OsadaFabrycznaMap || {}; // Konfiguracja mapy przekazana przez WordPress.
const MAP_LABELS = MAP_CONFIG.labels || {}; // Przetłumaczone etykiety interfejsu mapy.
const MAP_ASSETS = MAP_CONFIG.assets || {}; // Adresy plików graficznych i kafelków mapy.
// Rozszerzenia pozwalające innym modułom uzupełniać zachowanie mapy.
const MAP_EXTENSIONS = Array.isArray(window.OsadaFabrycznaMapExtensions)
  ? window.OsadaFabrycznaMapExtensions
  : [];
// Zastępcza ikona używana, gdy budynek nie ma własnego znacznika.
const DEFAULT_BUILDING_MARKER_URL = MAP_ASSETS.defaultBuildingMarker ||
  '/wp-content/themes/osadafabryczna/dist/assets/ikona-budynku.png';
// Informacja o systemowym ustawieniu ograniczającym animacje.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let activeBuildingMarker = null;
let activePanelMarker = null;
let spiderfiedCluster = null;

function notifyMapExtensions(method, ...args) {
  MAP_EXTENSIONS.forEach(extension => {
    if (typeof extension?.[method] === 'function') {
      extension[method](...args);
    }
  });
}

function getMapExtensionResults(method, ...args) {
  return MAP_EXTENSIONS.flatMap(extension => {
    if (typeof extension?.[method] !== 'function') {
      return [];
    }

    const result = extension[method](...args);
    return Array.isArray(result) ? result : (result ? [result] : []);
  });
}

function getMapMarkerClassName(building) {
  const classNames = ['building-marker'];
  notifyMapExtensions('extendMarkerClassNames', classNames, { building });
  return [...new Set(classNames.filter(Boolean))].join(' ');
}


document.addEventListener('DOMContentLoaded', () => {
const mapElement = document.getElementById('map');
if (!mapElement || typeof L === 'undefined') {
  return;
}

notifyMapExtensions('init', {
  defaultMarkerUrl: DEFAULT_BUILDING_MARKER_URL,
  closeInfoPanel: closeInfoPanelIfOpen,
  closePanel,
  refreshMarker: updateBuildingMarkerIcon,
  refreshPanel: refreshActiveBuildingPanel
});

// Array to hold all markers for zoom scaling
const markers = [];

// Initialize map
const initialZoom = 16.5;
const map = L.map('map', {
  center: MAP_CENTER,
  zoom: initialZoom,
  zoomControl: false,
  minZoom: 14,
  maxZoom: 18,
  maxBounds: IMAGE_BOUNDS,
  maxBoundsViscosity: 1,
  zoomSnap: 0.5,
  zoomDelta: 0.5,
  wheelPxPerZoomLevel: 80
});

L.control.zoom({
  position: 'topleft'
}).addTo(map);

// Add OpenStreetMap tiles (kept mostly invisible so the image overlay remains the main visual)
const osmTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  opacity: 0
}).addTo(map);

// Create a dedicated pane for street labels so they render above the image overlay
const labelsPane = map.createPane('labelsPane');
labelsPane.style.zIndex = 450;
labelsPane.style.pointerEvents = 'none';

const streetLabelTilesUrl = 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png'
  + (MAP_CONFIG.cartoBasemapKey ? `?key=${encodeURIComponent(MAP_CONFIG.cartoBasemapKey)}` : '');
const streetLabelTiles = L.tileLayer(streetLabelTilesUrl, {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  pane: 'labelsPane',
  opacity: 0.85
}).addTo(map);

// Add overlay image
/* const overlayUrl = MAP_ASSETS.mapOverlay || '/wp-content/themes/osadafabryczna/dist/assets/mapa-24-07.jpg';
const overlay = L.imageOverlay(
  overlayUrl,
  IMAGE_BOUNDS,
  {
    opacity: 1
  }
).addTo(map); */
const overlayTilesUrl =
  MAP_ASSETS.mapTiles ||
  '/wp-content/themes/osadafabryczna/dist/assets/map-tiles-v2';

const overlay = L.tileLayer(
  `${overlayTilesUrl}/{z}/{x}/{y}.webp`,
  {
    minZoom: 14,
    maxZoom: 18,
    minNativeZoom: 14,
    maxNativeZoom: 18,
    bounds: L.latLngBounds(IMAGE_BOUNDS),
    noWrap: true,
    opacity: 0.7,
    pane: 'overlayPane'
  }
).addTo(map);

// Set initial view without forcing the map to fit the entire overlay bounds,
// so the configured initial zoom level is respected.
const imageBounds = L.latLngBounds(IMAGE_BOUNDS);
const illustratedMinZoom = Math.max(14, map.getBoundsZoom(imageBounds, false));

map.setView(MAP_CENTER, initialZoom);
map.setMaxBounds(imageBounds);
map.setMinZoom(illustratedMinZoom);

let overlayVisible = true;
let mapModeTransitioning = false;
let mapModeFlightTimeout = null;
let mapModeRevealTimeout = null;
let mapLayerFadeTimeout = null;

const markerClusterGroup = typeof L.markerClusterGroup === 'function'
  ? L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
      removeOutsideVisibleBounds: true,
      maxClusterRadius: 60
    })
  : null;

if (markerClusterGroup) {
  map.addLayer(markerClusterGroup);

  markerClusterGroup.on('spiderfied', event => {
    spiderfiedCluster = event.cluster || null;
  });

  markerClusterGroup.on('unspiderfied', () => {
    spiderfiedCluster = null;
  });
}

const settlementMarkerContent = document.createElement('div');
const settlementMarkerImage = document.createElement('img');
const settlementMarkerLabel = document.createElement('span');

settlementMarkerContent.className = 'settlement-overview-marker__content';
settlementMarkerImage.className = 'settlement-overview-marker__image';
settlementMarkerImage.src = MAP_ASSETS.settlementMarker || DEFAULT_BUILDING_MARKER_URL;
settlementMarkerImage.alt = '';
settlementMarkerImage.setAttribute('aria-hidden', 'true');
settlementMarkerLabel.className = 'settlement-overview-marker__label';
settlementMarkerLabel.textContent = MAP_LABELS.settlementName || 'Osada Fabryczna';
settlementMarkerContent.append(settlementMarkerImage, settlementMarkerLabel);

const settlementMarker = L.marker(MAP_CENTER, {
  icon: L.divIcon({
    className: 'settlement-overview-marker',
    html: settlementMarkerContent,
    iconSize: [190, 88],
    iconAnchor: [95, 88]
  }),
  keyboard: true,
  title: MAP_LABELS.showSettlement || 'Pokaż Osadę Fabryczną',
  zIndexOffset: 9000
});

settlementMarker.on('click', () => {
  map.flyTo(MAP_CENTER, SETTLEMENT_FOCUS_ZOOM, {
    animate: !prefersReducedMotion,
    duration: prefersReducedMotion ? 0 : 0.8
  });
});

// Locate user
let geolocationEnabled = false;
const geolocationToggle = document.getElementById('geolocation-toggle');
let centerLocationButton = null;
let centerOnNextLocation = false;
let geolocationWatchId = null;
let lastUserLatLng = null;
let outsideLocationNeedsFocus = false;
let outsideLocationNoticeShown = false;
let distantOverviewNoticeShown = false;
const userMarker = L.marker([0,0], {
  icon: L.icon({
    iconUrl: MAP_ASSETS.userLocation || '/wp-content/themes/osadafabryczna/dist/assets/user-location.gif',
    iconSize: [USER_MARKER_SIZE, USER_MARKER_SIZE],
    iconAnchor: [USER_MARKER_SIZE / 2, USER_MARKER_SIZE / 2],
    className: 'user-location-marker'
  }),
  zIndexOffset: USER_MARKER_Z_INDEX_OFFSET
});
let userMarkerAnimationFrame = null;

function updateGeolocationButtonState(isEnabled, isSupported = true) {
  if (geolocationToggle) {
    geolocationToggle.classList.toggle('is-active', isEnabled);
    geolocationToggle.setAttribute('aria-pressed', String(isEnabled));
    geolocationToggle.title = isSupported ? '' : (MAP_LABELS.geolocationUnsupported || 'Geolocation is not supported in this browser.');
    geolocationToggle.disabled = !isSupported;

    const label = geolocationToggle.querySelector('.geolocation-toggle__label');
    if (label) {
      label.textContent = isEnabled
        ? (MAP_LABELS.locationEnabled || 'Lokalizacja: włączona')
        : (MAP_LABELS.enableLocation || 'Włącz lokalizację');
    }
  }

  if (centerLocationButton) {
    centerLocationButton.disabled = !isSupported;
    centerLocationButton.title = isSupported
      ? (MAP_LABELS.centerLocation || 'Wyśrodkuj na mojej lokalizacji')
      : (MAP_LABELS.geolocationUnsupported || 'Geolokalizacja nie jest obsługiwana w tej przeglądarce.');
  }
}

function isGeolocationSupported() {
  return 'geolocation' in navigator;
}

function handleUserLocation(latlng, position) {
  const isFirstLocationUpdate = !lastUserLatLng;
  const shouldCenterOnArrival = centerOnNextLocation;
  lastUserLatLng = latlng;

  if (!map.hasLayer(userMarker)) {
    userMarker.setLatLng(latlng);
    userMarker.addTo(map);
  }

  if (typeof userMarker.setZIndexOffset === 'function') {
    userMarker.setZIndexOffset(USER_MARKER_Z_INDEX_OFFSET);
  }

  moveUserMarkerTo(latlng);
  notifyMapExtensions('handlePosition', position);

  if (!isLocationMarkerSafelyInsideIllustration(latlng, getIllustratedZoom(map.getZoom()))) {
    if (overlayVisible && (!outsideLocationNoticeShown || shouldCenterOnArrival)) {
      outsideLocationNeedsFocus = true;
      outsideLocationNoticeShown = true;
      promptContemporaryMapSwitch(
        MAP_LABELS.outsideIllustratedMap
          || 'Twoja lokalizacja znajduje się poza mapą ilustrowaną. Przełącz na mapę współczesną, aby ją zobaczyć.'
      );
    } else if (!overlayVisible && isFirstLocationUpdate && !shouldCenterOnArrival) {
      outsideLocationNeedsFocus = true;
      focusMapOnOutsideLocation();
    }
  }

  updateSettlementMarkerVisibility();

  if (shouldCenterOnArrival) {
    focusMapOnUser();
  }
}

function handleGeolocationError(error) {
  const message = error?.message || 'Nie udalo sie pobrac lokalizacji.';
  console.warn('Geolocation error:', message);
  centerOnNextLocation = false;
  centerLocationButton?.classList.remove('is-waiting');

  if (geolocationEnabled) {
    setGeolocationEnabled(false);
  }
}

function startGeolocation() {
  if (!isGeolocationSupported()) {
    updateGeolocationButtonState(false, false);
    console.warn('Geolocation is not supported in this browser.');
    return;
  }

  geolocationEnabled = true;
  notifyMapExtensions('setLocationEnabled', true);

  if (geolocationWatchId !== null) {
    navigator.geolocation.clearWatch(geolocationWatchId);
  }

  geolocationWatchId = navigator.geolocation.watchPosition(
    position => {
      handleUserLocation(L.latLng(position.coords.latitude, position.coords.longitude), position);
    },
    handleGeolocationError,
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000
    }
  );

  updateGeolocationButtonState(true, true);
}

function stopGeolocation() {
  geolocationEnabled = false;
  centerOnNextLocation = false;
  lastUserLatLng = null;
  outsideLocationNeedsFocus = false;
  outsideLocationNoticeShown = false;
  distantOverviewNoticeShown = false;
  notifyMapExtensions('setLocationEnabled', false);

  if (geolocationWatchId !== null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(geolocationWatchId);
    geolocationWatchId = null;
  }

  if (userMarkerAnimationFrame) {
    cancelAnimationFrame(userMarkerAnimationFrame);
    userMarkerAnimationFrame = null;
  }

  notifyMapExtensions('clearPosition');

  if (map.hasLayer(userMarker)) {
    userMarker.remove();
  }

  centerLocationButton?.classList.remove('is-waiting', 'is-centered');
  updateSettlementMarkerVisibility();
  updateGeolocationButtonState(false, isGeolocationSupported());
}

function setGeolocationEnabled(enabled) {
  if (enabled) {
    startGeolocation();
  } else {
    stopGeolocation();
  }
}

function easeInOutCubic(progress) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function moveUserMarkerTo(latlng) {
  if (!map.hasLayer(userMarker)) {
    userMarker.setLatLng(latlng);
    return;
  }

  if (prefersReducedMotion) {
    userMarker.setLatLng(latlng);
    return;
  }

  const currentLatLng = userMarker.getLatLng();
  const distance = currentLatLng.distanceTo(latlng);

  if (!currentLatLng.lat || distance > USER_MARKER_SNAP_DISTANCE_METERS) {
    if (userMarkerAnimationFrame) {
      cancelAnimationFrame(userMarkerAnimationFrame);
      userMarkerAnimationFrame = null;
    }

    userMarker.setLatLng(latlng);
    return;
  }

  if (userMarkerAnimationFrame) {
    cancelAnimationFrame(userMarkerAnimationFrame);
  }

  const startLatLng = userMarker.getLatLng();
  const startTime = performance.now();

  const animate = currentTime => {
    const progress = Math.min((currentTime - startTime) / USER_MARKER_MOVE_DURATION, 1);
    const easedProgress = easeInOutCubic(progress);
    const lat = startLatLng.lat + (latlng.lat - startLatLng.lat) * easedProgress;
    const lng = startLatLng.lng + (latlng.lng - startLatLng.lng) * easedProgress;

    userMarker.setLatLng([lat, lng]);

    if (progress < 1) {
      userMarkerAnimationFrame = requestAnimationFrame(animate);
    } else {
      userMarkerAnimationFrame = null;
    }
  };

  userMarkerAnimationFrame = requestAnimationFrame(animate);
}

if (geolocationToggle) {
  if (typeof L.DomEvent?.disableClickPropagation === 'function') {
    L.DomEvent.disableClickPropagation(geolocationToggle);
  }

  geolocationToggle.addEventListener('pointerdown', event => {
    event.stopPropagation();
  });

  geolocationToggle.addEventListener('click', () => {
    setGeolocationEnabled(!geolocationEnabled);
  });
}

updateGeolocationButtonState(false, isGeolocationSupported());

const overlayToggle = document.createElement('button');
const mapModeNotice = document.createElement('div');
const mapModeNoticeText = document.createElement('span');
const mapModeNoticeSwitch = document.createElement('button');
const mapModeNoticeClose = document.createElement('button');
let mapModeNoticeTimeout = null;
let mapModeNoticeAction = null;
let mapToggleAttentionTimeout = null;
let mapSwitchGuidanceAcknowledged = false;

try {
  mapSwitchGuidanceAcknowledged = sessionStorage.getItem(MAP_SWITCH_GUIDANCE_STORAGE_KEY) === '1';
} catch (error) {
  console.warn('Map guidance state is unavailable:', error);
}

mapModeNotice.className = 'map-mode-notice';
mapModeNotice.hidden = true;

mapModeNoticeText.className = 'map-mode-notice__text';
mapModeNoticeText.setAttribute('role', 'status');
mapModeNoticeText.setAttribute('aria-live', 'polite');

mapModeNoticeSwitch.className = 'map-mode-notice__switch';
mapModeNoticeSwitch.type = 'button';
mapModeNoticeSwitch.textContent = MAP_LABELS.contemporaryMap || 'Mapa współczesna';

mapModeNoticeClose.className = 'map-mode-notice__close';
mapModeNoticeClose.type = 'button';
mapModeNoticeClose.textContent = '×';
mapModeNoticeClose.setAttribute('aria-label', MAP_LABELS.dismissNotice || 'Zamknij komunikat');

mapModeNotice.append(mapModeNoticeText, mapModeNoticeSwitch, mapModeNoticeClose);
document.body.appendChild(mapModeNotice);

function hideMapModeNotice() {
  if (mapModeNoticeTimeout) {
    clearTimeout(mapModeNoticeTimeout);
    mapModeNoticeTimeout = null;
  }

  mapModeNotice.hidden = true;
  mapModeNoticeAction = null;
}

function showMapModeNotice(message, options = {}) {
  const {
    allowOnContemporary = false,
    actionLabel = MAP_LABELS.contemporaryMap || 'Mapa współczesna',
    onAction = () => setMapMode(false)
  } = options;

  if (!message || (!allowOnContemporary && !overlayVisible)) {
    return;
  }

  mapModeNoticeText.textContent = message;
  mapModeNoticeAction = typeof onAction === 'function' ? onAction : null;
  mapModeNoticeSwitch.hidden = !mapModeNoticeAction;
  mapModeNoticeSwitch.textContent = actionLabel;
  mapModeNotice.hidden = false;

  if (mapModeNoticeTimeout) {
    clearTimeout(mapModeNoticeTimeout);
  }

  mapModeNoticeTimeout = setTimeout(hideMapModeNotice, MAP_NOTICE_DURATION);
}

function acknowledgeMapSwitchGuidance() {
  mapSwitchGuidanceAcknowledged = true;

  try {
    sessionStorage.setItem(MAP_SWITCH_GUIDANCE_STORAGE_KEY, '1');
  } catch (error) {
    console.warn('Map guidance state could not be saved:', error);
  }
}

function highlightContemporaryMapButton() {
  if (!overlayVisible) {
    return;
  }

  if (mapToggleAttentionTimeout) {
    clearTimeout(mapToggleAttentionTimeout);
  }

  overlayToggle.classList.remove('needs-attention');
  void overlayToggle.offsetWidth;
  overlayToggle.classList.add('needs-attention');
  mapToggleAttentionTimeout = setTimeout(() => {
    overlayToggle.classList.remove('needs-attention');
    mapToggleAttentionTimeout = null;
  }, 2200);
}

function promptContemporaryMapSwitch(message) {
  highlightContemporaryMapButton();

  if (!mapSwitchGuidanceAcknowledged) {
    showMapModeNotice(message, { onAction: null });
  }
}

function focusMapOnOutsideLocation() {
  if (!lastUserLatLng || isLocationMarkerSafelyInsideIllustration(
    lastUserLatLng,
    getIllustratedZoom(map.getZoom())
  )) {
    outsideLocationNeedsFocus = false;
    return;
  }

  const distanceFromSettlement = lastUserLatLng.distanceTo(L.latLng(MAP_CENTER));
  const locationBounds = L.latLngBounds(IMAGE_BOUNDS);
  locationBounds.extend(lastUserLatLng);
  map.fitBounds(locationBounds, {
    padding: [60, 60],
    maxZoom: 15,
    animate: !prefersReducedMotion
  });
  outsideLocationNeedsFocus = false;

  if (distanceFromSettlement >= DISTANT_LOCATION_NOTICE_METERS && !distantOverviewNoticeShown) {
    distantOverviewNoticeShown = true;
    showMapModeNotice(
      MAP_LABELS.distantLocationOverview
        || 'Mapa została oddalona, aby pokazać Twoją lokalizację i Osadę Fabryczną w Żyrardowie.',
      {
        allowOnContemporary: true,
        actionLabel: MAP_LABELS.myLocation || 'Moja lokalizacja',
        onAction: focusMapOnUser
      }
    );
  }
}

function focusMapOnUser() {
  if (!isGeolocationSupported()) {
    updateGeolocationButtonState(false, false);
    return;
  }

  hideMapModeNotice();

  if (!lastUserLatLng) {
    centerOnNextLocation = true;
    centerLocationButton?.classList.add('is-waiting');

    if (!geolocationEnabled) {
      startGeolocation();
    }
    return;
  }

  centerOnNextLocation = false;
  centerLocationButton?.classList.remove('is-waiting');

  if (overlayVisible && !isLocationMarkerSafelyInsideIllustration(
    lastUserLatLng,
    getIllustratedZoom(map.getZoom())
  )) {
    outsideLocationNeedsFocus = true;
    outsideLocationNoticeShown = true;
    promptContemporaryMapSwitch(
      MAP_LABELS.outsideIllustratedMap
        || 'Twoja lokalizacja znajduje się poza mapą ilustrowaną. Przełącz na mapę współczesną, aby ją zobaczyć.'
    );
    return;
  }

  map.flyTo(lastUserLatLng, USER_LOCATION_FOCUS_ZOOM, {
    animate: !prefersReducedMotion,
    duration: prefersReducedMotion ? 0 : 0.8
  });
}

function isUserOutsideIllustratedMap() {
  return Boolean(
    lastUserLatLng
      && !isLocationMarkerSafelyInsideIllustration(
        lastUserLatLng,
        getIllustratedZoom(map.getZoom())
      )
  );
}

function shouldShowSettlementOverviewMarker() {
  if (overlayVisible) {
    return false;
  }

  return map.getZoom() <= SETTLEMENT_OVERVIEW_MAX_ZOOM
    || (isUserOutsideIllustratedMap() && !imageBounds.contains(map.getCenter()));
}

function setBuildingMarkersVisible(isVisible) {
  if (markerClusterGroup) {
    if (isVisible && !map.hasLayer(markerClusterGroup)) {
      map.addLayer(markerClusterGroup);
    } else if (!isVisible && map.hasLayer(markerClusterGroup)) {
      map.removeLayer(markerClusterGroup);
    }
    return;
  }

  markers.forEach(marker => {
    if (isVisible && !map.hasLayer(marker)) {
      marker.addTo(map);
    } else if (!isVisible && map.hasLayer(marker)) {
      marker.remove();
    }
  });
}

function updateSettlementMarkerVisibility() {
  const showSettlementMarker = shouldShowSettlementOverviewMarker();

  setBuildingMarkersVisible(!showSettlementMarker);

  if (showSettlementMarker && !map.hasLayer(settlementMarker)) {
    settlementMarker.addTo(map);
  } else if (!showSettlementMarker && map.hasLayer(settlementMarker)) {
    settlementMarker.remove();
  }
}

function updateCenterLocationButtonState() {
  if (!centerLocationButton) {
    return;
  }

  const isCentered = Boolean(
    lastUserLatLng
      && map.getZoom() >= USER_LOCATION_FOCUS_ZOOM - 1
      && map.getCenter().distanceTo(lastUserLatLng) <= 75
  );

  centerLocationButton.classList.toggle('is-centered', isCentered);
}

function getIllustratedZoom(zoom) {
  return Math.max(illustratedMinZoom, Math.min(map.getMaxZoom(), zoom));
}

function isLocationMarkerSafelyInsideIllustration(latlng, zoom) {
  if (!latlng) {
    return false;
  }

  const markerRadius = USER_MARKER_SIZE / 2;
  const safePadding = markerRadius + ILLUSTRATED_MARKER_EDGE_PADDING;
  const northWest = map.project(imageBounds.getNorthWest(), zoom);
  const southEast = map.project(imageBounds.getSouthEast(), zoom);
  const locationPoint = map.project(latlng, zoom);

  return locationPoint.x >= northWest.x + safePadding
    && locationPoint.x <= southEast.x - safePadding
    && locationPoint.y >= northWest.y + safePadding
    && locationPoint.y <= southEast.y - safePadding;
}

function updateOverlayToggleState() {
  const label = overlayVisible
    ? (MAP_LABELS.contemporaryMap || 'Mapa współczesna')
    : (MAP_LABELS.illustratedMap || 'Mapa ilustrowana');
  const ariaLabel = overlayVisible
    ? (MAP_LABELS.showContemporaryMap || 'Pokaż mapę współczesną')
    : (MAP_LABELS.showIllustratedMap || 'Pokaż mapę ilustrowaną');

  overlayToggle.textContent = label;
  overlayToggle.setAttribute('aria-label', ariaLabel);
  overlayToggle.dataset.mapMode = overlayVisible ? 'illustrated' : 'contemporary';
}

function setMapModeTransitionState(isTransitioning) {
  mapModeTransitioning = isTransitioning;
  overlayToggle.disabled = isTransitioning;
  overlayToggle.classList.toggle('is-transitioning', isTransitioning);
}

function setLayerOpacityTransition(layer, enabled) {
  const container = typeof layer.getContainer === 'function'
    ? layer.getContainer()
    : null;

  if (container) {
    container.style.transition = enabled
      ? `opacity ${MAP_LAYER_FADE_DURATION}ms ease-in-out`
      : '';
  }
}

function clearMapLayerTransitions() {
  [overlay, streetLabelTiles, osmTiles].forEach(layer => {
    setLayerOpacityTransition(layer, false);
  });
  mapElement.classList.remove('is-revealing-illustrated-map');
}

function completeMapModeTransition() {
  if (mapModeFlightTimeout) {
    clearTimeout(mapModeFlightTimeout);
    mapModeFlightTimeout = null;
  }

  if (mapModeRevealTimeout) {
    clearTimeout(mapModeRevealTimeout);
    mapModeRevealTimeout = null;
  }

  if (mapLayerFadeTimeout) {
    clearTimeout(mapLayerFadeTimeout);
    mapLayerFadeTimeout = null;
  }

  clearMapLayerTransitions();
  setMapModeTransitionState(false);
}

function updateMapLayerVisibility() {
  clearMapLayerTransitions();

  if (overlayVisible) {
    if (!map.hasLayer(overlay)) {
      overlay.addTo(map);
    }

    if (!map.hasLayer(streetLabelTiles)) {
      streetLabelTiles.addTo(map);
    }

    overlay.setOpacity(ILLUSTRATED_OVERLAY_OPACITY);
    streetLabelTiles.setOpacity(ILLUSTRATED_LABEL_OPACITY);
    osmTiles.setOpacity(0);
  } else {
    if (map.hasLayer(overlay)) {
      overlay.remove();
    }

    streetLabelTiles.setOpacity(0);
    osmTiles.setOpacity(1);
  }
}

function revealIllustratedMap() {
  if (prefersReducedMotion) {
    updateMapLayerVisibility();
    completeMapModeTransition();
    return;
  }

  let fadeStarted = false;
  let layerLoadTimeout = null;

  overlay.setOpacity(0);
  streetLabelTiles.setOpacity(0);
  osmTiles.setOpacity(1);

  if (!map.hasLayer(overlay)) {
    overlay.addTo(map);
  }

  if (!map.hasLayer(streetLabelTiles)) {
    streetLabelTiles.addTo(map);
  }

  mapElement.classList.add('is-revealing-illustrated-map');

  const startFade = () => {
    if (fadeStarted) {
      return;
    }

    fadeStarted = true;
    overlay.off('load', startFade);

    if (layerLoadTimeout) {
      clearTimeout(layerLoadTimeout);
      layerLoadTimeout = null;
    }

    [overlay, streetLabelTiles, osmTiles].forEach(layer => {
      setLayerOpacityTransition(layer, true);
      const container = layer.getContainer?.();
      if (container) {
        void container.offsetWidth;
      }
    });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        overlay.setOpacity(ILLUSTRATED_OVERLAY_OPACITY);
        streetLabelTiles.setOpacity(ILLUSTRATED_LABEL_OPACITY);
        osmTiles.setOpacity(0);

        mapLayerFadeTimeout = setTimeout(
          completeMapModeTransition,
          MAP_LAYER_FADE_DURATION + 80
        );
      });
    });
  };

  if (typeof overlay.isLoading === 'function' && overlay.isLoading()) {
    overlay.once('load', startFade);
    layerLoadTimeout = setTimeout(startFade, MAP_LAYER_LOAD_TIMEOUT);
  } else {
    window.requestAnimationFrame(startFade);
  }
}

function activateIllustratedMap(targetCenter, targetZoom, shouldFade) {
  overlayVisible = true;
  map.setMaxBounds(null);
  map.options.maxBoundsViscosity = 1;
  map.setView(targetCenter, targetZoom, { animate: false });
  map.setMinZoom(illustratedMinZoom);
  map.setMaxBounds(imageBounds);

  updateOverlayToggleState();
  updateSettlementMarkerVisibility();
  updateCenterLocationButtonState();

  if (shouldFade) {
    revealIllustratedMap();
  } else {
    updateMapLayerVisibility();
    completeMapModeTransition();
  }
}

function flyToIllustratedMap(targetCenter, targetZoom) {
  let flightFinished = false;

  const beginReveal = () => {
    if (overlayVisible) {
      return;
    }

    mapModeRevealTimeout = null;
    overlayVisible = true;
    updateOverlayToggleState();
    updateSettlementMarkerVisibility();
    updateCenterLocationButtonState();
    revealIllustratedMap();
  };

  const finishFlight = () => {
    if (flightFinished) {
      return;
    }

    flightFinished = true;
    map.off('moveend', finishFlight);

    if (mapModeFlightTimeout) {
      clearTimeout(mapModeFlightTimeout);
      mapModeFlightTimeout = null;
    }

    if (mapModeRevealTimeout) {
      clearTimeout(mapModeRevealTimeout);
      mapModeRevealTimeout = null;
    }

    beginReveal();
    map.options.maxBoundsViscosity = 1;
    map.setMinZoom(illustratedMinZoom);
    map.setMaxBounds(imageBounds);
    updateSettlementMarkerVisibility();
    updateCenterLocationButtonState();
  };

  map.stop();
  map.once('moveend', finishFlight);
  map.flyTo(targetCenter, targetZoom, {
    animate: true,
    duration: MAP_MODE_FLY_DURATION,
    easeLinearity: 0.22
  });
  mapModeRevealTimeout = setTimeout(
    beginReveal,
    Math.max(0, MAP_MODE_FLY_DURATION - MAP_ILLUSTRATED_REVEAL_LEAD_TIME) * 1000
  );
  mapModeFlightTimeout = setTimeout(
    finishFlight,
    MAP_MODE_FLY_DURATION * 1000 + 500
  );
}

function setMapMode(showIllustratedMap) {
  if (mapModeTransitioning || overlayVisible === showIllustratedMap) {
    return;
  }

  const currentCenter = map.getCenter();
  const currentZoom = map.getZoom();
  const centerIsInsideIllustration = imageBounds.contains(currentCenter);
  const retainedIllustratedZoom = getIllustratedZoom(currentZoom);
  const userMarkerIsInsideIllustration = isLocationMarkerSafelyInsideIllustration(
    lastUserLatLng,
    retainedIllustratedZoom
  );
  hideMapModeNotice();

  if (showIllustratedMap) {
    const targetCenter = centerIsInsideIllustration
      ? currentCenter
      : (userMarkerIsInsideIllustration ? lastUserLatLng : MAP_CENTER);
    const targetZoom = centerIsInsideIllustration || userMarkerIsInsideIllustration
      ? retainedIllustratedZoom
      : ILLUSTRATED_SWITCH_ZOOM;
    // Animate from a distant viewport even when the destination is the user's location.
    const shouldFlyToIllustration = !centerIsInsideIllustration
      && !prefersReducedMotion;

    setMapModeTransitionState(true);

    if (shouldFlyToIllustration) {
      flyToIllustratedMap(targetCenter, targetZoom);
    } else {
      activateIllustratedMap(targetCenter, targetZoom, true);
    }
    return;
  }

  overlayVisible = false;
  map.setMaxBounds(null);
  map.options.maxBoundsViscosity = 0;
  map.setMinZoom(OSM_MIN_ZOOM);

  if (outsideLocationNeedsFocus) {
    focusMapOnOutsideLocation();
  } else {
    map.setView(currentCenter, currentZoom, { animate: false });
  }

  updateMapLayerVisibility();
  updateOverlayToggleState();
  updateSettlementMarkerVisibility();
  updateCenterLocationButtonState();
}

mapModeNoticeSwitch.addEventListener('click', () => {
  const action = mapModeNoticeAction;
  hideMapModeNotice();

  if (action) {
    action();
  }
});

mapModeNoticeClose.addEventListener('click', hideMapModeNotice);

function setupMapControlMenu() {
  const mapControlMenu = L.control({
    position: 'bottomleft'
  });

  mapControlMenu.onAdd = function () {
    const container = L.DomUtil.create('div', 'map-control-menu');

    if (typeof L.DomEvent?.disableClickPropagation === 'function') {
      L.DomEvent.disableClickPropagation(container);
    }

    if (typeof L.DomEvent?.disableScrollPropagation === 'function') {
      L.DomEvent.disableScrollPropagation(container);
    }

  if (geolocationToggle) {
    geolocationToggle.classList.add('map-control-button');
    container.appendChild(geolocationToggle);
  }

  getMapExtensionResults('createMapControls').forEach(control => container.appendChild(control));

  overlayToggle.type = 'button';
  overlayToggle.className = 'map-control-button map-overlay-toggle';
  updateOverlayToggleState();

  overlayToggle.addEventListener('pointerdown', event => {
    event.stopPropagation();
  });

  overlayToggle.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();

    acknowledgeMapSwitchGuidance();
    overlayToggle.classList.remove('needs-attention');
    setMapMode(!overlayVisible);
  });

    container.appendChild(overlayToggle);

    return container;
  };

  mapControlMenu.addTo(map);
}

setupMapControlMenu();

function setupCenterLocationControl() {
  const centerLocationControl = L.control({
    position: 'bottomleft'
  });

  centerLocationControl.onAdd = function () {
    const container = L.DomUtil.create('div', 'leaflet-control center-location-control');
    centerLocationButton = L.DomUtil.create('button', 'center-location-control__button', container);
    centerLocationButton.type = 'button';
    centerLocationButton.setAttribute(
      'aria-label',
      MAP_LABELS.centerLocation || 'Wyśrodkuj na mojej lokalizacji'
    );
    centerLocationButton.innerHTML = [
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
      '<circle cx="12" cy="12" r="5"></circle>',
      '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>',
      '<circle class="center-location-control__dot" cx="12" cy="12" r="1.5"></circle>',
      '</svg>'
    ].join('');

    if (typeof L.DomEvent?.disableClickPropagation === 'function') {
      L.DomEvent.disableClickPropagation(container);
    }

    if (typeof L.DomEvent?.disableScrollPropagation === 'function') {
      L.DomEvent.disableScrollPropagation(container);
    }

    centerLocationButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      focusMapOnUser();
    });

    return container;
  };

  centerLocationControl.addTo(map);
  updateGeolocationButtonState(geolocationEnabled, isGeolocationSupported());
  updateCenterLocationButtonState();
}

setupCenterLocationControl();

let mapPointerStart = null;
let illustratedDragActive = false;
let lastEdgeNoticeAt = 0;

function isMapInteractionTarget(target) {
  return target instanceof Element && Boolean(target.closest(
    '.leaflet-control, #slide-panel, #info-panel, #info-panel-toggle'
  ));
}

function getIllustratedEdgeState() {
  const visibleBounds = map.getBounds();
  const latitudeTolerance = Math.max(0.00002, (visibleBounds.getNorth() - visibleBounds.getSouth()) * 0.015);
  const longitudeTolerance = Math.max(0.00002, (visibleBounds.getEast() - visibleBounds.getWest()) * 0.015);

  return {
    north: visibleBounds.getNorth() >= imageBounds.getNorth() - latitudeTolerance,
    south: visibleBounds.getSouth() <= imageBounds.getSouth() + latitudeTolerance,
    east: visibleBounds.getEast() >= imageBounds.getEast() - longitudeTolerance,
    west: visibleBounds.getWest() <= imageBounds.getWest() + longitudeTolerance
  };
}

function isOutwardEdgeGesture(deltaX, deltaY) {
  const edge = getIllustratedEdgeState();

  return (deltaX >= EDGE_GESTURE_MIN_DISTANCE && edge.west)
    || (deltaX <= -EDGE_GESTURE_MIN_DISTANCE && edge.east)
    || (deltaY >= EDGE_GESTURE_MIN_DISTANCE && edge.north)
    || (deltaY <= -EDGE_GESTURE_MIN_DISTANCE && edge.south);
}

function isAtIllustratedMapEdge() {
  const edge = getIllustratedEdgeState();

  return edge.north || edge.south || edge.east || edge.west;
}

function showIllustratedMapEdgeNotice() {
  const now = Date.now();

  if (!overlayVisible) {
    return;
  }

  highlightContemporaryMapButton();

  if (mapSwitchGuidanceAcknowledged || now - lastEdgeNoticeAt < EDGE_NOTICE_COOLDOWN) {
    return;
  }

  lastEdgeNoticeAt = now;
  showMapModeNotice(
    MAP_LABELS.illustratedMapEdge
      || 'To koniec mapy ilustrowanej. Przełącz na mapę współczesną, aby przejść dalej.',
    { onAction: null }
  );
}

mapElement.addEventListener('pointerdown', event => {
  if (!overlayVisible || !event.isPrimary || event.button !== 0 || isMapInteractionTarget(event.target)) {
    mapPointerStart = null;
    return;
  }

  mapPointerStart = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY
  };
}, true);

window.addEventListener('pointerup', event => {
  if (!mapPointerStart || event.pointerId !== mapPointerStart.pointerId) {
    return;
  }

  const deltaX = event.clientX - mapPointerStart.x;
  const deltaY = event.clientY - mapPointerStart.y;
  mapPointerStart = null;

  window.requestAnimationFrame(() => {
    if (overlayVisible && isOutwardEdgeGesture(deltaX, deltaY)) {
      showIllustratedMapEdgeNotice();
    }
  });
}, true);

window.addEventListener('pointercancel', event => {
  if (mapPointerStart && event.pointerId === mapPointerStart.pointerId) {
    mapPointerStart = null;
  }
}, true);

map.on('dragstart', () => {
  illustratedDragActive = overlayVisible;
});

map.on('dragend', () => {
  if (illustratedDragActive && overlayVisible && isAtIllustratedMapEdge()) {
    showIllustratedMapEdgeNotice();
  }

  illustratedDragActive = false;
});

mapElement.addEventListener('wheel', event => {
  if (overlayVisible && event.deltaY > 0 && map.getZoom() <= illustratedMinZoom) {
    showIllustratedMapEdgeNotice();
  }
}, { passive: true, capture: true });

// Fetch buildings and add markers
async function addMarkers() {
  try {
    const response = await fetch(MAP_CONFIG.restUrl || '/wp-json/wp/v2/budynek?acf_format=standard&_embed');

    if (!response.ok) {
      throw new Error(`Building data request failed with status ${response.status}.`);
    }

    const budynki = await response.json();
    notifyMapExtensions('setBuildings', budynki);

    budynki.forEach(budynek => {
      const title = budynek.title.rendered;
      const lat = budynek.acf.latitude;
      const lng = budynek.acf.longitude;
      const marker_icon = budynek.acf.marker_icon || DEFAULT_BUILDING_MARKER_URL;
      const customMarkerWidth = Number.parseInt(
        budynek.marker_icon_width ?? budynek.meta?.marker_icon_width,
        10
      );

      if (!lat || !lng) {
        console.warn(`Skipping "${title}": missing coordinates.`);
        return;
      }

      const img = new Image();
      img.src = marker_icon;

 img.onload = () => {
  // Scale the icon to fit within the target box while preserving its aspect ratio.
  const aspectRatio = img.width / img.height;
  let scale = Math.min(TARGET_HEIGHT / img.height, TARGET_WIDTH / img.width);

  if (aspectRatio >= 1.2) {
    scale = Math.min(HORIZONTAL_MAX_HEIGHT / img.height, HORIZONTAL_MAX_WIDTH / img.width);
  } else if (aspectRatio <= 0.8) {
    scale = Math.min(VERTICAL_MAX_HEIGHT / img.height, VERTICAL_MAX_WIDTH / img.width);
  } else {
    scale = Math.min(SQUARE_MAX_SIZE / img.width, SQUARE_MAX_SIZE / img.height);
  }

  const hasCustomMarkerWidth = Number.isFinite(customMarkerWidth) && customMarkerWidth >= 24;
  const isDefaultBuildingMarker = marker_icon === DEFAULT_BUILDING_MARKER_URL;
  const iconWidth = hasCustomMarkerWidth
    ? customMarkerWidth
    : (isDefaultBuildingMarker ? DEFAULT_BUILDING_MARKER_WIDTH : Math.max(24, img.width * scale));
  const iconHeight = hasCustomMarkerWidth || isDefaultBuildingMarker
    ? iconWidth / aspectRatio
    : Math.max(24, img.height * scale);
  const paddedHeight = iconHeight + MARKER_PADDING * 2;
  const paddedWidth = iconWidth + MARKER_PADDING * 2;

  const icon = L.icon({
    iconUrl: marker_icon,
    iconSize: [paddedWidth, paddedHeight],
    iconAnchor: [paddedWidth / 2, paddedHeight],
    popupAnchor: [0, -paddedHeight - 5],
    className: getMapMarkerClassName(budynek)
  });

  const marker = L.marker([lat, lng], { icon });
  if (markerClusterGroup) {
    markerClusterGroup.addLayer(marker);
  } else if (!shouldShowSettlementOverviewMarker()) {
    marker.addTo(map);
  }

  // --- Marker click: mobile slide-up panel + desktop popup ---
  marker.on('click', () => {
    setActiveBuildingMarker(marker);

    if (typeof marker.bringToFront === 'function') {
      marker.bringToFront();
    }
    const targetZoom = Math.max(map.getZoom(), 17);
    const isSpiderfiedMarker = isMarkerInSpiderfiedCluster(marker);

    openPanel(budynek, marker);

    if (isSpiderfiedMarker) {
      return;
    }

    const targetCenter = getMarkerFocusLatLng(marker, targetZoom);
    map.flyTo(targetCenter, targetZoom, {
      animate: !prefersReducedMotion,
      duration: PANEL_MARKER_FLY_DURATION,
      easeLinearity: 0.15
    });

    if (window.innerWidth < 768) {
      const panel = document.getElementById('slide-panel');

      waitForPanelOpen(panel).then(() => {
        if (typeof marker.bringToFront === 'function') {
          marker.bringToFront();
        }
      });
    }
  });

  // Store marker info for zoom scaling
  marker.options.baseHeight = iconHeight;
  marker.options.baseWidth = iconWidth;
  marker.options.baseZoom = map.getZoom();
  marker.options.iconUrl = marker_icon;
  marker.options.buildingData = budynek;

  notifyMapExtensions('registerMarker', marker);

  markers.push(marker);
};

      img.onerror = () => {
        console.warn(`Failed to load image for "${title}":`, marker_icon);
      };
    });
  } catch (error) {
    console.error('Error fetching buildings:', error);
  }
}

// Dynamic icon scaling on zoom
map.on('zoomend', () => {
  markers.forEach(marker => {
    updateBuildingMarkerIcon(marker);
  });
  updateSettlementMarkerVisibility();
  updateCenterLocationButtonState();
});

map.on('moveend', () => {
  updateSettlementMarkerVisibility();
  updateCenterLocationButtonState();
});

map.on('move zoom resize zoomend', () => {
  updateDesktopPanelPosition();
});

window.addEventListener('resize', () => {
  updateDesktopPanelPosition();
});

// Initialize everything

  addMarkers();


});

document.addEventListener('DOMContentLoaded', () => {
  const infoPanel = document.getElementById('info-panel');
  const infoPanelToggle = document.getElementById('info-panel-toggle');
  const infoPanelClose = document.getElementById('info-panel-close');
  const infoPanelSeenKey = 'osada-info-panel-seen';

  if (!infoPanel || !infoPanelToggle || !infoPanelClose) {
    return;
  }

  function openInfoPanel() {
    infoPanel.classList.add('is-open');
    document.body.classList.add('info-panel-open');
    infoPanelToggle.classList.add('is-hidden');
    infoPanel.setAttribute('aria-hidden', 'false');
  }

  function closeInfoPanel() {
    const panelHadFocus = infoPanel.contains(document.activeElement);

    infoPanel.classList.remove('is-open');
    document.body.classList.remove('info-panel-open');
    infoPanelToggle.classList.remove('is-hidden');
    if (panelHadFocus) {
      infoPanelToggle.focus({ preventScroll: true });
    }
    infoPanel.setAttribute('aria-hidden', 'true');
  }

  let hasSeenInfoPanel = false;

  try {
    hasSeenInfoPanel = window.localStorage.getItem(infoPanelSeenKey) === 'true';
  } catch (error) {
    hasSeenInfoPanel = false;
  }

  if (hasSeenInfoPanel) {
    closeInfoPanel();
  } else {
    openInfoPanel();

    try {
      window.localStorage.setItem(infoPanelSeenKey, 'true');
    } catch (error) {
      // The panel will open again if browser storage is unavailable.
    }
  }

  infoPanelToggle.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openInfoPanel();
  });

  infoPanelClose.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeInfoPanel();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth < 768 && infoPanel.classList.contains('is-open')) {
      closeInfoPanel();
    }
  });
});

function waitForPanelOpen(panel, timeout = 800) {
  return new Promise(resolve => {
    if (!panel) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      panel.removeEventListener('transitionend', onTransitionEnd);
      window.clearTimeout(timeoutId);
      resolve();
    };

    const onTransitionEnd = event => {
      if (event.target === panel && event.propertyName === 'transform') {
        finish();
      }
    };

    panel.addEventListener('transitionend', onTransitionEnd);
    const timeoutId = window.setTimeout(finish, timeout);

    requestAnimationFrame(() => {
      const style = window.getComputedStyle(panel);
      if (!panel.classList.contains('open') || style.transitionDuration === '0s') {
        finish();
      }
    });
  });
}

function closeInfoPanelIfOpen() {
  const infoPanel = document.getElementById('info-panel');
  const infoPanelToggle = document.getElementById('info-panel-toggle');

  if (!infoPanel || !infoPanel.classList.contains('is-open')) {
    return;
  }

  const panelHadFocus = infoPanel.contains(document.activeElement);

  infoPanel.classList.remove('is-open');
  document.body.classList.remove('info-panel-open');

  if (infoPanelToggle) {
    infoPanelToggle.classList.remove('is-hidden');
    if (panelHadFocus) {
      infoPanelToggle.focus({ preventScroll: true });
    }
  }

  infoPanel.setAttribute('aria-hidden', 'true');
}

function getPanelMarkerGap() {
  return (MOBILE_PANEL_MARKER_GAP + EXTRA_PANEL_MARGIN) * PANEL_MARKER_GAP_SCALE;
}

function getPanelTopInMap(panel, mapContainer) {
  const mapRect = mapContainer.getBoundingClientRect();

  if (window.innerWidth < 768) {
    const panelStyle = window.getComputedStyle(panel);
    const panelBottom = parseFloat(panelStyle.bottom) || 0;
    const panelHeight = panel.offsetHeight || panel.getBoundingClientRect().height;

    return window.innerHeight - panelBottom - panelHeight - mapRect.top;
  }

  const panelRect = panel.getBoundingClientRect();

  return panelRect.top - mapRect.top;
}

function createBuildingMarkerIcon(marker) {
  const isActive = marker === activeBuildingMarker;
  const map = marker._map;
  const currentZoom = map ? map.getZoom() : marker.options.baseZoom;
  const zoomScale = Math.pow(ZOOM_STEP_FACTOR, currentZoom - marker.options.baseZoom);
  const activeScale = isActive ? ACTIVE_MARKER_SCALE : 1;
  const newHeight = marker.options.baseHeight * zoomScale * activeScale;
  const newWidth = marker.options.baseWidth * zoomScale * activeScale;
  const paddedHeight = newHeight + MARKER_PADDING * 2;
  const paddedWidth = newWidth + MARKER_PADDING * 2;

  const classNames = [getMapMarkerClassName(marker.options.buildingData)];

  if (isActive) {
    classNames.push('building-marker--active');
  }

  return L.icon({
    iconUrl: marker.options.iconUrl,
    iconSize: [paddedWidth, paddedHeight],
    iconAnchor: [paddedWidth / 2, paddedHeight],
    popupAnchor: [0, -paddedHeight - 5],
    className: classNames.join(' ')
  });
}

function updateBuildingMarkerIcon(marker) {
  if (!marker || !marker.options.baseHeight || !marker.options.baseWidth || !marker.options.iconUrl) {
    return;
  }

  if (isMarkerInSpiderfiedCluster(marker)) {
    const markerElement = typeof marker.getElement === 'function'
      ? marker.getElement()
      : marker._icon;

    if (markerElement) {
      markerElement.classList.toggle('building-marker--active', marker === activeBuildingMarker);
      notifyMapExtensions('syncMarkerElement', markerElement, marker);
    }

    if (marker === activeBuildingMarker && typeof marker.bringToFront === 'function') {
      marker.bringToFront();
    }

    return;
  }

  marker.setIcon(createBuildingMarkerIcon(marker));

  if (marker === activeBuildingMarker && typeof marker.bringToFront === 'function') {
    marker.bringToFront();
  }
}

function setActiveBuildingMarker(marker) {
  const previousMarker = activeBuildingMarker;
  activeBuildingMarker = marker;

  if (previousMarker && previousMarker !== marker) {
    updateBuildingMarkerIcon(previousMarker);
  }

  updateBuildingMarkerIcon(marker);
}

function clearActiveBuildingMarker() {
  const marker = activeBuildingMarker;
  activeBuildingMarker = null;
  updateBuildingMarkerIcon(marker);
}

function isMarkerInSpiderfiedCluster(marker) {
  if (!marker || !spiderfiedCluster || typeof spiderfiedCluster.getAllChildMarkers !== 'function') {
    return false;
  }

  return spiderfiedCluster.getAllChildMarkers().includes(marker);
}

function getMarkerTargetPoint(panel, mapContainer) {
  const mapRect = mapContainer.getBoundingClientRect();
  const mapWidth = mapContainer.offsetWidth || mapRect.width;
  const mapHeight = mapContainer.offsetHeight || mapRect.height;

  if (!panel) {
    return L.point(mapWidth / 2, mapHeight / 2);
  }

  if (window.innerWidth < 768) {
    const panelTopInMap = getPanelTopInMap(panel, mapContainer);
    const desiredY = panelTopInMap - getPanelMarkerGap();

    return L.point(mapWidth / 2, Math.max(TARGET_HEIGHT, desiredY));
  }

  return L.point(mapWidth / 2, mapHeight * DESKTOP_POPUP_MARKER_TARGET_Y_RATIO);
}

function getMarkerFocusLatLng(marker, targetZoom) {
  const map = marker._map;
  const mapContainer = map.getContainer();
  const panel = document.getElementById('slide-panel');
  const targetPoint = getMarkerTargetPoint(panel, mapContainer);
  const mapSize = map.getSize();
  const markerPoint = map.project(marker.getLatLng(), targetZoom);
  const centerPoint = markerPoint.add(mapSize.divideBy(2)).subtract(targetPoint);

  return map.unproject(centerPoint, targetZoom);
}

function isDesktopPanelMode() {
  return window.innerWidth >= 768;
}

function resetPanelDesktopPosition(panel) {
  panel.style.removeProperty('--panel-left');
  panel.style.removeProperty('--panel-top');
}

function updateDesktopPanelPosition() {
  const panel = document.getElementById('slide-panel');

  if (!panel || !panel.classList.contains('open') || !isDesktopPanelMode()) {
    return;
  }

  const marker = activePanelMarker;
  const markerElement = marker && typeof marker.getElement === 'function'
    ? marker.getElement()
    : null;

  if (!markerElement) {
    return;
  }

  const markerRect = markerElement.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const panelWidth = panel.offsetWidth || panelRect.width || 380;
  const panelHeight = panel.offsetHeight || panelRect.height || 240;
  const viewportPadding = 16;
  const minLeft = viewportPadding + panelWidth / 2;
  const maxLeft = window.innerWidth - viewportPadding - panelWidth / 2;
  const centeredLeft = markerRect.left + markerRect.width / 2;
  const left = Math.min(Math.max(centeredLeft, minLeft), maxLeft);
  const minTop = viewportPadding + panelHeight + DESKTOP_POPUP_MARKER_GAP;
  const top = Math.max(minTop, markerRect.top - DESKTOP_POPUP_MARKER_GAP);

  panel.style.setProperty('--panel-left', `${left}px`);
  panel.style.setProperty('--panel-top', `${top}px`);
}

function getSafeUrl(url) {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsedUrl.protocol) ? parsedUrl.href : null;
  } catch (error) {
    return null;
  }
}

function appendSafeRichText(container, html) {
  const allowedTags = new Set(['P', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'BR', 'UL', 'OL', 'LI', 'A']);
  const documentFragment = document.createDocumentFragment();
  const parsedDocument = new DOMParser().parseFromString(html || '', 'text/html');

  function copyNode(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent));
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (!allowedTags.has(node.tagName)) {
      node.childNodes.forEach(childNode => copyNode(childNode, parent));
      return;
    }

    const element = document.createElement(node.tagName.toLowerCase());

    if (node.tagName === 'A') {
      const safeUrl = getSafeUrl(node.getAttribute('href') || '');

      if (safeUrl) {
        element.href = safeUrl;
      }
    }

    node.childNodes.forEach(childNode => copyNode(childNode, element));
    parent.appendChild(element);
  }

  parsedDocument.body.childNodes.forEach(node => copyNode(node, documentFragment));
  container.replaceChildren(documentFragment);
}

function renderBuildingPanelContent(content, budynek) {
  const buildingData = budynek.acf || {};
  const title = document.createElement('h2');
  const subtitle = document.createElement('h3');
  const description = document.createElement('div');
  const link = document.createElement('a');
  const extensionArea = document.createElement('div');

  title.className = 'map-building-title';
  title.textContent = budynek.title?.rendered || '';

  subtitle.className = 'map-building-subtitle';
  subtitle.textContent = buildingData.subtitle || '';

  description.className = 'map-building-paragraph';
  appendSafeRichText(description, buildingData.short_description);

  link.className = 'map-building-link';
  const readMoreLabel = MAP_LABELS.readMore || 'Czytaj więcej';
  const opensInNewTabLabel = MAP_LABELS.opensInNewTab || 'otwiera się w nowej karcie';
  const buildingTitle = title.textContent.trim();
  link.textContent = `${readMoreLabel} ↗`;
  link.href = getSafeUrl(budynek.link) || window.location.origin;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute(
    'aria-label',
    `${readMoreLabel}${buildingTitle ? `: ${buildingTitle}` : ''} (${opensInNewTabLabel})`
  );

  notifyMapExtensions('renderBuildingPanel', extensionArea, budynek);

  const panelElements = [title, subtitle, description];
  if (extensionArea.childNodes.length) {
    panelElements.push(extensionArea);
  }
  panelElements.push(link);
  content.replaceChildren(...panelElements);
}

// PANEL LOGIC
function openPanel(budynek, marker = null) {
  closeInfoPanelIfOpen();

  const panel = document.getElementById('slide-panel');
  const content = document.getElementById('panel-content');

  if (!panel || !content) {
    return;
  }

  renderBuildingPanelContent(content, budynek);

  activePanelMarker = marker;
  panel.style.transition = '';
  panel.style.transform = '';
  resetPanelDesktopPosition(panel);
  panel.classList.add('open');
  document.body.classList.add('map-panel-open');
  updateDesktopPanelPosition();
}

function closePanel() {
  const panel = document.getElementById('slide-panel');

  if (!panel) {
    return;
  }

  clearActiveBuildingMarker();
  activePanelMarker = null;
  panel.classList.remove('open');
  document.body.classList.remove('map-panel-open');
  panel.style.transition = '';
  panel.style.transform = '';
  resetPanelDesktopPosition(panel);
}

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('panel-close');
  const panel = document.getElementById('slide-panel');
  const handle = document.querySelector('.panel-handle');

  if (closeBtn && panel) {
    closeBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });

    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    });
  }

  if (!panel || !handle) {
    return;
  }

  let startY = 0;
  let currentY = 0;
  let panelHeight = 0;
  let isDragging = false;

  function getClientY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
  }

  function onTouchStart(e) {
    if (window.innerWidth >= 768 || !panel.classList.contains('open')) return;

    isDragging = true;
    startY = getClientY(e);
    currentY = startY;
    panelHeight = panel.offsetHeight;
    panel.style.transition = 'none';
  }

  function onTouchMove(e) {
    if (!isDragging) return;

    currentY = getClientY(e);
    const deltaY = currentY - startY;

    if (deltaY > 0) {
      e.preventDefault();
      panel.style.transform = `translateY(${deltaY}px)`;
    }
  }

  function onTouchEnd() {
    if (!isDragging) return;

    isDragging = false;
    const deltaY = currentY - startY;

    if (deltaY > panelHeight / 3) {
      closePanel();
    } else {
      panel.style.transition = 'transform 0.3s ease';
      panel.style.transform = '';
    }
  }

  handle.addEventListener('touchstart', onTouchStart, { passive: true });
  handle.addEventListener('touchmove', onTouchMove, { passive: false });
  handle.addEventListener('touchend', onTouchEnd);

  handle.addEventListener('mousedown', onTouchStart);
  document.addEventListener('mousemove', onTouchMove);
  document.addEventListener('mouseup', onTouchEnd);
});

function refreshActiveBuildingPanel() {
  const content = document.getElementById('panel-content');
  const panel = document.getElementById('slide-panel');
  const building = activePanelMarker?.options?.buildingData;

  if (content && building && panel?.classList.contains('open')) {
    renderBuildingPanelContent(content, building);
  }
}
