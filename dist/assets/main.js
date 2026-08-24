// Map center and overlay bounds
const MAP_CENTER = [52.056438, 20.436555];
const IMAGE_BOUNDS = [
  [52.078133, 20.520637], // northeast
  [52.033089, 20.370405]  // southwest
];
const TARGET_HEIGHT = 150; // default max height for vertical-style icons
const TARGET_WIDTH = 150; // default max width for horizontal/square-style icons
const SQUARE_MAX_SIZE = 70;
const HORIZONTAL_MAX_WIDTH = 80;
const HORIZONTAL_MAX_HEIGHT = 150;
const VERTICAL_MAX_WIDTH = 150;
const VERTICAL_MAX_HEIGHT = 80;
const DEFAULT_BUILDING_MARKER_WIDTH = 50;
const MARKER_PADDING = 6; // small padding around each icon
const ZOOM_STEP_FACTOR = 1.2; // scale factor per zoom level
const MOBILE_PANEL_MARKER_GAP = 84;
const EXTRA_PANEL_MARGIN = 8;
const PANEL_MARKER_GAP_SCALE = 0.6;
const ACTIVE_MARKER_SCALE = 1.12;
const PANEL_MARKER_FLY_DURATION = 1.05;
const PANEL_MARKER_FLY_TIMEOUT = 1300;
const DESKTOP_POPUP_MARKER_GAP = 24;
const DESKTOP_POPUP_MARKER_TARGET_Y_RATIO = 0.78;
const USER_MARKER_Z_INDEX_OFFSET = 10000;
const USER_MARKER_MOVE_DURATION = 700;
const USER_MARKER_SNAP_DISTANCE_METERS = 120;
const MAP_CONFIG = window.OsadaFabrycznaMap || {};
const MAP_LABELS = MAP_CONFIG.labels || {};
const MAP_ASSETS = MAP_CONFIG.assets || {};
const PASSPORT_CORE = window.OsadaPassportCore || null;
const DEFAULT_BUILDING_MARKER_URL = MAP_ASSETS.defaultBuildingMarker ||
  '/wp-content/themes/osadafabryczna/dist/assets/ikona-budynku.png';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let activeBuildingMarker = null;
let activePanelMarker = null;
let spiderfiedCluster = null;
const passportState = {
  buildings: [],
  earnedPlaceIds: new Set(),
  unlockedPlaceIds: new Set(),
  markers: new Map(),
  dismissedPlaces: new Map(),
  latestPosition: null,
  locationEnabled: false,
  locationSupported: 'geolocation' in navigator,
  database: null,
  storageAvailable: true,
  initialized: false,
  ready: false,
  initializationPromise: null,
  passportButton: null,
  passportTrigger: null,
  challengeBuilding: null,
  challengeTrigger: null,
  modalCleanup: null,
  celebrationTimeout: null,
  proximityMessageKey: '',
  proximityMessageTimeout: null,
  proximityRecheckTimeout: null
};
const proximityTracker = PASSPORT_CORE
  ? new PASSPORT_CORE.ProximityTracker({
      radiusMeters: 50,
      maxAccuracyMeters: 50,
      dwellMilliseconds: 10000,
      minimumReadings: 2
    })
  : null;


document.addEventListener('DOMContentLoaded', () => {
const mapElement = document.getElementById('map');
if (!mapElement || typeof L === 'undefined') {
  return;
}

initializePassport();

// Array to hold all markers for zoom scaling
const markers = [];

// Initialize map
const initialZoom = 17;
const map = L.map('map', {
  center: MAP_CENTER,
  zoom: initialZoom,
  zoomControl: false,
  minZoom: 14,
  maxZoom: 18,
  maxBounds: IMAGE_BOUNDS,
  maxBoundsViscosity: 1,
  zoomSnap: 1,
  zoomDelta: 1,
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

const streetLabelTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
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
map.setView(MAP_CENTER, initialZoom);
map.setMaxBounds(IMAGE_BOUNDS);
map.setMinZoom(Math.max(14, map.getBoundsZoom(IMAGE_BOUNDS, false)));

const markerClusterGroup = typeof L.markerClusterGroup === 'function'
  ? L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
      removeOutsideVisibleBounds: true,
      maxClusterRadius: 80
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

// Locate user
let geolocationEnabled = false;
const geolocationToggle = document.getElementById('geolocation-toggle');
let geolocationWatchId = null;
const userMarker = L.marker([0,0], {
  icon: L.icon({
    iconUrl: MAP_ASSETS.userLocation || '/wp-content/themes/osadafabryczna/dist/assets/user-location.gif',
    iconSize: [50, 50],
    iconAnchor: [25, 25],
    className: 'user-location-marker'
  }),
  zIndexOffset: USER_MARKER_Z_INDEX_OFFSET
});
let userMarkerAnimationFrame = null;

function updateGeolocationButtonState(isEnabled, isSupported = true) {
  if (!geolocationToggle) {
    return;
  }

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

function isGeolocationSupported() {
  return 'geolocation' in navigator;
}

function handleUserLocation(latlng, position) {
  if (!map.hasLayer(userMarker)) {
    userMarker.setLatLng(latlng);
    userMarker.addTo(map);
  }

  if (typeof userMarker.setZIndexOffset === 'function') {
    userMarker.setZIndexOffset(USER_MARKER_Z_INDEX_OFFSET);
  }

  moveUserMarkerTo(latlng);
  handlePassportPosition(position);
}

function handleGeolocationError(error) {
  const message = error?.message || 'Nie udalo sie pobrac lokalizacji.';
  console.warn('Geolocation error:', message);

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
  passportState.locationEnabled = true;
  refreshActiveBuildingVisitActions();

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
  passportState.locationEnabled = false;
  refreshActiveBuildingVisitActions();

  if (geolocationWatchId !== null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(geolocationWatchId);
    geolocationWatchId = null;
  }

  if (userMarkerAnimationFrame) {
    cancelAnimationFrame(userMarkerAnimationFrame);
    userMarkerAnimationFrame = null;
  }

  passportState.latestPosition = null;
  proximityTracker?.reset();
  cancelProximityRecheck();
  hideProximityStatus();

  if (map.hasLayer(userMarker)) {
    userMarker.remove();
  }

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

let overlayVisible = true;
const overlayToggle = document.createElement('button');

function updateOverlayToggleState() {
  overlayToggle.textContent = MAP_LABELS.changeMap || 'Zmień mapę';
  overlayToggle.setAttribute('aria-pressed', String(overlayVisible));
}

function updateMapLayerVisibility() {
  if (overlayVisible) {
    if (!map.hasLayer(overlay)) {
      overlay.addTo(map);
    }

    if (!map.hasLayer(streetLabelTiles)) {
      streetLabelTiles.addTo(map);
    }

    streetLabelTiles.setOpacity(0.95);
    osmTiles.setOpacity(0);
  } else {
    if (map.hasLayer(overlay)) {
      overlay.remove();
    }

    streetLabelTiles.setOpacity(0);
    osmTiles.setOpacity(1);
  }
}

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

  const passportButton = createPassportControlButton();
  passportState.passportButton = passportButton;
  container.appendChild(passportButton);

  overlayToggle.type = 'button';
  overlayToggle.className = 'map-control-button map-overlay-toggle';
  overlayToggle.setAttribute('aria-label', MAP_LABELS.changeMapAria || 'Zmień mapę');
  updateOverlayToggleState();

  overlayToggle.addEventListener('pointerdown', event => {
    event.stopPropagation();
  });

  overlayToggle.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();

    overlayVisible = !overlayVisible;
    updateMapLayerVisibility();
    updateOverlayToggleState();
  });

    container.appendChild(overlayToggle);

    return container;
  };

  mapControlMenu.addTo(map);
}

setupMapControlMenu();

// Fetch buildings and add markers
async function addMarkers() {
  try {
    const response = await fetch(MAP_CONFIG.restUrl || '/wp-json/wp/v2/budynek?acf_format=standard&_embed');

    if (!response.ok) {
      throw new Error(`Building data request failed with status ${response.status}.`);
    }

    const budynki = await response.json();
    passportState.buildings = budynki;
    updatePassportInterface();

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
    className: getBuildingMarkerClassName(budynek.visit?.placeId)
  });

  const marker = L.marker([lat, lng], { icon });
  if (markerClusterGroup) {
    markerClusterGroup.addLayer(marker);
  } else {
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
  marker.options.placeId = budynek.visit?.placeId || '';
  marker.options.buildingData = budynek;

  if (marker.options.placeId) {
    passportState.markers.set(marker.options.placeId, marker);
  }

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

  const classNames = [getBuildingMarkerClassName(marker.options.placeId)];

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
      markerElement.classList.toggle('building-marker--visited', passportState.earnedPlaceIds.has(marker.options.placeId));
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
  const visitArea = document.createElement('div');

  title.className = 'map-building-title';
  title.textContent = budynek.title?.rendered || '';

  subtitle.className = 'map-building-subtitle';
  subtitle.textContent = buildingData.subtitle || '';

  description.className = 'map-building-paragraph';
  appendSafeRichText(description, buildingData.short_description);

  link.className = 'map-building-link';
  link.textContent = `${MAP_LABELS.readMore || 'Czytaj więcej'} →`;

  link.href = getSafeUrl(budynek.link) || window.location.origin;

  visitArea.className = 'map-building-visit';
  renderBuildingVisitActions(visitArea, budynek);

  content.replaceChildren(title, subtitle, description, visitArea, link);
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

function formatPassportLabel(template, values) {
  let result = String(template || '');

  values.forEach((value, index) => {
    const position = index + 1;
    result = result
      .replace(new RegExp(`%${position}\\$[sd]`, 'g'), String(value))
      .replace(/%[sd]/, String(value));
  });

  return result;
}

function getBuildingTitle(building) {
  const parsed = new DOMParser().parseFromString(building?.title?.rendered || '', 'text/html');
  return parsed.body.textContent || '';
}

function getBuildingMarkerClassName(placeId) {
  const classNames = ['building-marker'];

  if (placeId && passportState.earnedPlaceIds.has(placeId)) {
    classNames.push('building-marker--visited');
  }

  return classNames.join(' ');
}

function getPassportProgress() {
  const collectibleBuildings = passportState.buildings.filter(building => building.visit?.status === 'collectible');
  const earnedCount = collectibleBuildings.filter(building => passportState.earnedPlaceIds.has(building.visit.placeId)).length;

  return {
    earnedCount,
    totalCount: collectibleBuildings.length
  };
}

function createPassportControlButton() {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'map-control-button passport-toggle';
  button.addEventListener('pointerdown', event => {
    event.stopPropagation();
  });
  button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    await initializePassport();
    openPassport(button);
  });

  updatePassportButton(button);
  return button;
}

function updatePassportButton(button = passportState.passportButton) {
  if (!button) {
    return;
  }

  const progress = getPassportProgress();
  const label = MAP_LABELS.passport || 'Paszport';

  button.textContent = progress.totalCount
    ? `${label} ${progress.earnedCount}/${progress.totalCount}`
    : label;
  button.setAttribute('aria-label', button.textContent);
}

function openPassportDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }

    const request = window.indexedDB.open('osada-passport', 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains('visits')) {
        database.createObjectStore('visits', { keyPath: 'placeId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open passport storage.'));
    request.onblocked = () => reject(new Error('Passport storage upgrade was blocked.'));
  });
}

function loadPassportVisits(database) {
  return new Promise((resolve, reject) => {
    const placeIds = [];
    const transaction = database.transaction('visits', 'readonly');
    const request = transaction.objectStore('visits').openCursor();

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve(placeIds);
        return;
      }

      if (cursor.value?.placeId) {
        placeIds.push(String(cursor.value.placeId));
      }

      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error('Could not read passport storage.'));
    transaction.onerror = () => reject(transaction.error || new Error('Could not read passport storage.'));
  });
}

function initializePassport() {
  if (passportState.initializationPromise) {
    return passportState.initializationPromise;
  }

  passportState.initialized = true;
  passportState.initializationPromise = (async () => {
    if (!PASSPORT_CORE) {
      passportState.storageAvailable = false;
      passportState.ready = true;
      updatePassportInterface();
      return;
    }

    try {
      passportState.database = await openPassportDatabase();
      const placeIds = await loadPassportVisits(passportState.database);
      passportState.earnedPlaceIds = new Set(placeIds);
    } catch (error) {
      passportState.storageAvailable = false;
      console.warn('Passport progress will only last for this page session.', error);
    }

    passportState.ready = true;
    updatePassportInterface();
    refreshPassportMarkers();
  })();

  document.addEventListener('visibilitychange', () => {
    proximityTracker?.reset();
    cancelProximityRecheck();
    hideProximityStatus();

    if (document.visibilityState !== 'visible') {
      passportState.latestPosition = null;
    }
  });

  return passportState.initializationPromise;
}

function savePassportVisit(placeId) {
  if (!passportState.database) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const transaction = passportState.database.transaction('visits', 'readwrite');
    transaction.objectStore('visits').put({
      placeId,
      earnedAt: new Date().toISOString()
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not save passport progress.'));
    transaction.onabort = () => reject(transaction.error || new Error('Could not save passport progress.'));
  });
}

function clearPassportVisits() {
  if (!passportState.database) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const transaction = passportState.database.transaction('visits', 'readwrite');
    transaction.objectStore('visits').clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not reset passport progress.'));
    transaction.onabort = () => reject(transaction.error || new Error('Could not reset passport progress.'));
  });
}

async function requestPersistentPassportStorage() {
  if (!navigator.storage?.persist) {
    return;
  }

  try {
    await navigator.storage.persist();
  } catch (error) {
    // Persistence is a best-effort enhancement. IndexedDB remains usable.
  }
}

function updatePassportInterface() {
  updatePassportButton();
}

function refreshPassportMarkers() {
  passportState.markers.forEach(marker => updateBuildingMarkerIcon(marker));
}

function isPositionNearBuilding(position, building, radiusMeters = 50) {
  if (!PASSPORT_CORE || !position?.coords || !building?.acf) {
    return false;
  }

  const accuracy = Number(position.coords.accuracy);
  const latitude = Number(position.coords.latitude);
  const longitude = Number(position.coords.longitude);
  const buildingLatitude = Number(building.acf.latitude);
  const buildingLongitude = Number(building.acf.longitude);
  const positionAge = Math.max(0, Date.now() - Number(position.timestamp || Date.now()));

  if (![accuracy, latitude, longitude, buildingLatitude, buildingLongitude].every(Number.isFinite)) {
    return false;
  }

  if (accuracy > 50 || positionAge > 30000) {
    return false;
  }

  return PASSPORT_CORE.distanceMeters(
    { latitude, longitude },
    { latitude: buildingLatitude, longitude: buildingLongitude }
  ) <= radiusMeters;
}

function updateDismissedPlaces(position) {
  passportState.dismissedPlaces.forEach((dismissal, placeId) => {
    const building = passportState.buildings.find(item => item.visit?.placeId === placeId);
    const expired = Date.now() >= dismissal.until;
    const hasLeftArea = building && !isPositionNearBuilding(position, building, 65);

    if (expired || hasLeftArea) {
      passportState.dismissedPlaces.delete(placeId);
    }

    if (hasLeftArea) {
      passportState.unlockedPlaceIds.delete(placeId);
    }
  });
}

function getEligiblePassportPlaces(position) {
  updateDismissedPlaces(position);

  return passportState.buildings
    .filter(building => building.visit?.status === 'collectible')
    .filter(building => !passportState.earnedPlaceIds.has(building.visit.placeId))
    .filter(building => !passportState.dismissedPlaces.has(building.visit.placeId))
    .map(building => ({
      placeId: building.visit.placeId,
      latitude: Number(building.acf?.latitude),
      longitude: Number(building.acf?.longitude),
      building
    }))
    .filter(place => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
}

function isPassportLayerOpen() {
  const passportLayer = document.getElementById('passport-layer');
  const challengeLayer = document.getElementById('visit-challenge-layer');
  return Boolean((passportLayer && !passportLayer.hidden) || (challengeLayer && !challengeLayer.hidden));
}

function handlePassportPosition(position) {
  passportState.latestPosition = position;

  if (!passportState.ready || !proximityTracker || document.visibilityState !== 'visible' || isPassportLayerOpen()) {
    proximityTracker?.reset();
    cancelProximityRecheck();
    return;
  }

  const eligiblePlaces = getEligiblePassportPlaces(position);

  if (!eligiblePlaces.length) {
    proximityTracker.reset();
    cancelProximityRecheck();
    hideProximityStatus();
    return;
  }

  const result = proximityTracker.update(position, eligiblePlaces, position.timestamp || Date.now());

  if ('inaccurate' === result.status) {
    cancelProximityRecheck();
    showProximityStatus(MAP_LABELS.gpsWeak || 'GPS accuracy is too low.', 'gps-weak', 5000);
    return;
  }

  if ('outside' === result.status) {
    cancelProximityRecheck();
    hideProximityStatus();
    return;
  }

  if ('dwelling' === result.status) {
    const seconds = Math.max(1, Math.ceil(result.remainingMilliseconds / 1000));
    const title = getBuildingTitle(result.place.building);
    showProximityStatus(
      formatPassportLabel(MAP_LABELS.stayNearby || 'Stay near %1$s for %2$d more seconds…', [title, seconds]),
      `dwell-${result.place.placeId}-${seconds}`
    );
    scheduleProximityRecheck(result.remainingMilliseconds + 100);
    return;
  }

  if ('ready' === result.status) {
    proximityTracker.reset();
    cancelProximityRecheck();
    hideProximityStatus();
    passportState.unlockedPlaceIds.add(result.place.placeId);
    openVisitChallenge(result.place.building, null, false);
  }
}

function scheduleProximityRecheck(delayMilliseconds) {
  if (passportState.proximityRecheckTimeout || !('geolocation' in navigator)) {
    return;
  }

  passportState.proximityRecheckTimeout = window.setTimeout(() => {
    passportState.proximityRecheckTimeout = null;

    if (document.visibilityState !== 'visible' || isPassportLayerOpen()) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      handlePassportPosition,
      () => {
        proximityTracker?.reset();
        showProximityStatus(MAP_LABELS.gpsWeak || 'GPS accuracy is too low.', 'gps-recheck-failed', 5000);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );
  }, Math.max(250, delayMilliseconds));
}

function cancelProximityRecheck() {
  window.clearTimeout(passportState.proximityRecheckTimeout);
  passportState.proximityRecheckTimeout = null;
}

function showProximityStatus(message, key = message, autoHideMilliseconds = 0) {
  const element = document.getElementById('passport-proximity-status');

  if (!element) {
    return;
  }

  if (passportState.proximityMessageKey !== key) {
    element.textContent = message;
    passportState.proximityMessageKey = key;
  }

  element.hidden = false;
  element.classList.add('is-visible');
  window.clearTimeout(passportState.proximityMessageTimeout);

  if (autoHideMilliseconds) {
    passportState.proximityMessageTimeout = window.setTimeout(hideProximityStatus, autoHideMilliseconds);
  }
}

function hideProximityStatus() {
  const element = document.getElementById('passport-proximity-status');

  window.clearTimeout(passportState.proximityMessageTimeout);
  passportState.proximityMessageKey = '';

  if (element) {
    element.classList.remove('is-visible');
    element.hidden = true;
  }
}

function activateModal(layer, dialog, closeCallback, initialFocus) {
  const onKeydown = event => {
    if ('Escape' === event.key) {
      event.preventDefault();
      closeCallback();
      return;
    }

    if ('Tab' !== event.key) {
      return;
    }

    const focusable = Array.from(dialog.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(element => !element.hidden && element.getClientRects().length);

    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onBackdropClick = event => {
    if (event.target === layer) {
      closeCallback();
    }
  };

  document.addEventListener('keydown', onKeydown);
  layer.addEventListener('click', onBackdropClick);
  document.body.classList.add('passport-modal-open');
  window.requestAnimationFrame(() => (initialFocus || dialog).focus({ preventScroll: true }));

  return () => {
    document.removeEventListener('keydown', onKeydown);
    layer.removeEventListener('click', onBackdropClick);
  };
}

function releaseModal(layer, trigger) {
  passportState.modalCleanup?.();
  passportState.modalCleanup = null;
  layer.hidden = true;

  if (!isPassportLayerOpen()) {
    document.body.classList.remove('passport-modal-open');
  }

  if (trigger?.isConnected) {
    trigger.focus({ preventScroll: true });
  }
}

function createCloseButton(closeCallback) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'passport-dialog__close';
  button.setAttribute('aria-label', MAP_LABELS.close || 'Close');
  button.textContent = '×';
  button.addEventListener('click', closeCallback);
  return button;
}

function openPassport(trigger) {
  const layer = document.getElementById('passport-layer');

  if (!layer) {
    return;
  }

  closeInfoPanelIfOpen();
  closePanel();
  closeVisitChallenge(false);
  passportState.passportTrigger = trigger || document.activeElement;
  renderPassport(layer);
  layer.hidden = false;

  const dialog = layer.querySelector('.passport-dialog');
  const closeButton = layer.querySelector('.passport-dialog__close');
  passportState.modalCleanup = activateModal(layer, dialog, closePassport, closeButton);
}

function closePassport() {
  const layer = document.getElementById('passport-layer');

  if (!layer || layer.hidden) {
    return;
  }

  const trigger = passportState.passportTrigger;
  passportState.passportTrigger = null;
  releaseModal(layer, trigger);
  proximityTracker?.reset();
}

function createPassportCard(building) {
  const article = document.createElement('article');
  const image = document.createElement('img');
  const title = document.createElement('h3');
  const status = document.createElement('p');
  const placeId = building.visit?.placeId;
  const isEarned = passportState.earnedPlaceIds.has(placeId);
  const isCollectible = building.visit?.status === 'collectible';
  const markerIcon = building.acf?.marker_icon || DEFAULT_BUILDING_MARKER_URL;

  article.className = `passport-stamp ${isEarned ? 'passport-stamp--earned' : 'passport-stamp--locked'}`;
  image.className = 'passport-stamp__image';
  image.src = markerIcon;
  image.alt = '';
  title.className = 'passport-stamp__title';
  title.textContent = getBuildingTitle(building);
  status.className = 'passport-stamp__status';
  status.textContent = isEarned
    ? (MAP_LABELS.earned || 'Visited')
    : (isCollectible ? (MAP_LABELS.locked || 'Not visited yet') : (MAP_LABELS.comingSoon || 'Coming soon'));

  article.append(image, title, status);
  return article;
}

function renderPassportSection(titleText, buildings, modifier = '') {
  const section = document.createElement('section');
  const title = document.createElement('h2');
  const grid = document.createElement('div');

  section.className = `passport-section ${modifier}`.trim();
  title.className = 'passport-section__title';
  title.textContent = titleText;
  grid.className = 'passport-grid';
  buildings.forEach(building => grid.appendChild(createPassportCard(building)));
  section.append(title, grid);
  return section;
}

function renderPassport(layer) {
  const dialog = document.createElement('div');
  const header = document.createElement('header');
  const title = document.createElement('h1');
  const progress = document.createElement('p');
  const privacy = document.createElement('p');
  const controls = document.createElement('div');
  const resetButton = document.createElement('button');
  const progressData = getPassportProgress();
  const sortedBuildings = [...passportState.buildings].sort((first, second) =>
    getBuildingTitle(first).localeCompare(getBuildingTitle(second), MAP_CONFIG.language || 'pl')
  );
  const collectibleBuildings = sortedBuildings.filter(building => building.visit?.status === 'collectible');
  const comingSoonBuildings = sortedBuildings.filter(building => building.visit?.status !== 'collectible');

  dialog.className = 'passport-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'passport-dialog-title');
  dialog.tabIndex = -1;
  header.className = 'passport-dialog__header';
  title.id = 'passport-dialog-title';
  title.textContent = MAP_LABELS.passportTitle || 'Monument passport';
  progress.className = 'passport-dialog__progress';
  progress.textContent = formatPassportLabel(
    MAP_LABELS.passportProgress || '%1$d of %2$d stamps',
    [progressData.earnedCount, progressData.totalCount]
  );
  privacy.className = 'passport-dialog__privacy';
  privacy.textContent = `${MAP_LABELS.passportPrivacy || 'Your passport and location stay on this device.'} ${MAP_LABELS.locationPrivacy || ''}`.trim();
  resetButton.type = 'button';
  resetButton.className = 'passport-reset';
  resetButton.textContent = MAP_LABELS.resetPassport || 'Reset passport';
  resetButton.disabled = !passportState.earnedPlaceIds.size;
  resetButton.addEventListener('click', async () => {
    if (!window.confirm(MAP_LABELS.resetPassportConfirm || 'Remove all saved stamps?')) {
      return;
    }

    try {
      await clearPassportVisits();
      passportState.earnedPlaceIds.clear();
      passportState.unlockedPlaceIds.clear();
      refreshPassportMarkers();
      updatePassportButton();
      const reopenTrigger = passportState.passportTrigger || passportState.passportButton;
      closePassport();
      openPassport(reopenTrigger);
    } catch (error) {
      console.warn('Could not reset passport progress.', error);
    }
  });

  header.append(title, createCloseButton(closePassport));
  dialog.append(header, progress);

  if (!progressData.earnedCount) {
    const empty = document.createElement('p');
    empty.className = 'passport-dialog__empty';
    empty.textContent = MAP_LABELS.passportEmpty || 'Earn your first stamp at a monument.';
    dialog.appendChild(empty);
  }

  if (collectibleBuildings.length) {
    dialog.appendChild(renderPassportSection(
      MAP_LABELS.availableStamps || 'Monuments to discover',
      collectibleBuildings
    ));
  }

  if (comingSoonBuildings.length) {
    dialog.appendChild(renderPassportSection(
      MAP_LABELS.comingSoonTitle || 'Coming soon',
      comingSoonBuildings,
      'passport-section--coming-soon'
    ));
  }

  dialog.appendChild(privacy);

  if (!passportState.storageAvailable) {
    const warning = document.createElement('p');
    warning.className = 'passport-dialog__warning';
    warning.textContent = MAP_LABELS.storageUnavailable || 'Progress cannot be saved permanently in this browser.';
    dialog.appendChild(warning);
  }

  controls.className = 'passport-dialog__controls';
  controls.appendChild(resetButton);
  dialog.appendChild(controls);
  layer.replaceChildren(dialog);
}

function renderBuildingVisitActions(container, building) {
  const visit = building.visit;

  if (!visit?.placeId) {
    return;
  }

  const status = document.createElement('p');
  status.className = 'map-building-visit__status';

  if (passportState.earnedPlaceIds.has(visit.placeId)) {
    status.classList.add('is-earned');
    status.textContent = `✓ ${MAP_LABELS.earned || 'Visited'}`;
    container.appendChild(status);
    return;
  }

  if ('collectible' !== visit.status) {
    status.textContent = MAP_LABELS.comingSoon || 'Challenge coming soon';
    container.appendChild(status);
    return;
  }

  const button = document.createElement('button');
  const feedback = document.createElement('p');

  status.textContent = MAP_LABELS.locked || 'Not visited yet';
  button.type = 'button';
  button.className = 'map-building-visit__button';
  feedback.className = 'map-building-visit__feedback';
  feedback.setAttribute('role', 'status');

  if (!passportState.locationSupported) {
    feedback.textContent = MAP_LABELS.geolocationUnsupported || 'Geolocation is not supported in this browser.';
    container.append(status, feedback);
    return;
  }

  if (!passportState.locationEnabled) {
    button.textContent = MAP_LABELS.enableLocationForStamp || 'Enable location';
    feedback.textContent = MAP_LABELS.locationRequired || 'Enable location to visit this monument and earn its stamp.';
    button.addEventListener('click', () => {
      document.getElementById('geolocation-toggle')?.click();
    });
    container.append(status, button, feedback);
    return;
  }

  button.textContent = passportState.unlockedPlaceIds.has(visit.placeId)
    ? (MAP_LABELS.openChallenge || 'Open the on-site question')
    : (MAP_LABELS.checkProximity || 'Check whether I am close enough');
  button.addEventListener('click', event => {
    const isUnlocked = passportState.unlockedPlaceIds.has(visit.placeId);
    const isNear = isPositionNearBuilding(passportState.latestPosition, building);

    if (isUnlocked && isNear) {
      openVisitChallenge(building, event.currentTarget, true);
      return;
    }

    const accuracy = Number(passportState.latestPosition?.coords?.accuracy);
    feedback.textContent = Number.isFinite(accuracy) && accuracy > 50
      ? (MAP_LABELS.gpsWeak || 'GPS accuracy is too low.')
      : (MAP_LABELS.moveCloser || 'Come within 50 metres to unlock this question.');
  });

  container.append(status, button, feedback);
}

function refreshActiveBuildingVisitActions() {
  const content = document.getElementById('panel-content');
  const panel = document.getElementById('slide-panel');
  const building = activePanelMarker?.options?.buildingData;

  if (content && building && panel?.classList.contains('open')) {
    renderBuildingPanelContent(content, building);
  }
}

function openVisitChallenge(building, trigger = null, requireCurrentProximity = true) {
  const layer = document.getElementById('visit-challenge-layer');
  const visit = building?.visit;

  if (!layer || 'collectible' !== visit?.status || passportState.earnedPlaceIds.has(visit.placeId)) {
    return;
  }

  if (requireCurrentProximity && !isPositionNearBuilding(passportState.latestPosition, building)) {
    showProximityStatus(MAP_LABELS.moveCloser || 'Come within 50 metres to unlock this question.', 'move-closer', 5000);
    return;
  }

  closePassport();
  closePanel();
  passportState.challengeBuilding = building;
  passportState.challengeTrigger = trigger?.closest('#slide-panel')
    ? passportState.passportButton
    : (trigger || passportState.passportButton || document.activeElement);

  const dialog = document.createElement('div');
  const header = document.createElement('header');
  const eyebrow = document.createElement('p');
  const title = document.createElement('h1');
  const question = document.createElement('p');
  const choices = document.createElement('div');
  const feedback = document.createElement('p');

  dialog.className = 'visit-challenge-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'visit-challenge-title');
  dialog.tabIndex = -1;
  header.className = 'visit-challenge-dialog__header';
  eyebrow.className = 'visit-challenge-dialog__eyebrow';
  eyebrow.textContent = MAP_LABELS.challengeTitle || 'Look closely';
  title.id = 'visit-challenge-title';
  title.textContent = getBuildingTitle(building);
  question.className = 'visit-challenge-dialog__question';
  question.textContent = visit.question;
  choices.className = 'visit-challenge-dialog__choices';
  feedback.className = 'visit-challenge-dialog__feedback';
  feedback.setAttribute('role', 'status');
  feedback.textContent = MAP_LABELS.chooseAnswer || 'Choose one answer.';

  visit.choices.forEach(choice => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'visit-choice';
    button.textContent = choice.text;
    button.addEventListener('click', async () => {
      if (choice.id !== visit.correctChoiceId) {
        button.classList.add('is-incorrect');
        feedback.textContent = MAP_LABELS.tryAgain || 'Look again and try once more.';
        return;
      }

      choices.querySelectorAll('button').forEach(choiceButton => {
        choiceButton.disabled = true;
      });
      button.classList.add('is-correct');
      await awardPassportStamp(building);
    });
    choices.appendChild(button);
  });

  header.append(eyebrow, title, createCloseButton(() => closeVisitChallenge(true)));
  dialog.append(header, question, choices, feedback);
  layer.replaceChildren(dialog);
  layer.hidden = false;
  passportState.modalCleanup = activateModal(
    layer,
    dialog,
    () => closeVisitChallenge(true),
    choices.querySelector('button')
  );
}

function closeVisitChallenge(shouldSuppress = true) {
  const layer = document.getElementById('visit-challenge-layer');

  if (!layer || layer.hidden) {
    return;
  }

  const building = passportState.challengeBuilding;
  const trigger = passportState.challengeTrigger;

  if (shouldSuppress && building?.visit?.placeId && !passportState.earnedPlaceIds.has(building.visit.placeId)) {
    passportState.dismissedPlaces.set(building.visit.placeId, {
      until: Date.now() + 5 * 60 * 1000
    });
  }

  passportState.challengeBuilding = null;
  passportState.challengeTrigger = null;
  releaseModal(layer, trigger);
  proximityTracker?.reset();
}

async function awardPassportStamp(building) {
  const placeId = building.visit.placeId;

  await initializePassport();

  try {
    await savePassportVisit(placeId);
  } catch (error) {
    passportState.storageAvailable = false;
    console.warn('The stamp could not be saved permanently.', error);
  }

  passportState.earnedPlaceIds.add(placeId);
  passportState.dismissedPlaces.delete(placeId);
  passportState.unlockedPlaceIds.delete(placeId);
  refreshPassportMarkers();
  updatePassportInterface();
  closeVisitChallenge(false);
  showStampCelebration(building);
  requestPersistentPassportStorage();
}

function showStampCelebration(building) {
  const celebration = document.getElementById('stamp-celebration');

  if (!celebration) {
    return;
  }

  const image = document.createElement('img');
  const content = document.createElement('div');
  const title = document.createElement('strong');
  const message = document.createElement('span');

  image.src = building.acf?.marker_icon || DEFAULT_BUILDING_MARKER_URL;
  image.alt = '';
  title.textContent = MAP_LABELS.stampEarned || 'Stamp earned!';
  message.textContent = formatPassportLabel(
    MAP_LABELS.stampEarnedFor || 'You visited %s.',
    [getBuildingTitle(building)]
  );
  content.append(title, message);
  celebration.replaceChildren(image, content);
  celebration.hidden = false;
  celebration.classList.remove('is-visible');
  window.requestAnimationFrame(() => celebration.classList.add('is-visible'));
  window.clearTimeout(passportState.celebrationTimeout);
  passportState.celebrationTimeout = window.setTimeout(() => {
    celebration.classList.remove('is-visible');
    window.setTimeout(() => {
      celebration.hidden = true;
    }, prefersReducedMotion ? 0 : 250);
  }, 4500);
}
