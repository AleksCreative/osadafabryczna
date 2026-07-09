// Map center and overlay bounds
const MAP_CENTER = [52.05698, 20.44018];
const IMAGE_BOUNDS = [
  [52.085027, 20.543456], // northeast
  [52.029078, 20.345237]  // southwest
];
const TARGET_HEIGHT = 140; // default max height for vertical-style icons
const TARGET_WIDTH = 140; // default max width for horizontal/square-style icons
const SQUARE_MAX_SIZE = 80;
const HORIZONTAL_MAX_WIDTH = 90;
const HORIZONTAL_MAX_HEIGHT = 140;
const VERTICAL_MAX_WIDTH = 140;
const VERTICAL_MAX_HEIGHT = 90;
const MARKER_PADDING = 6; // small padding around each icon
const ZOOM_STEP_FACTOR = 1.2; // scale factor per zoom level
const MOBILE_PANEL_MARKER_GAP = 84;
const EXTRA_PANEL_MARGIN = 8;
const PANEL_MARKER_GAP_SCALE = 0.6;
const ACTIVE_MARKER_SCALE = 1.12;
const PANEL_MARKER_PAN_DURATION = 0.75;
const PANEL_MARKER_PAN_TIMEOUT = 950;
const PANEL_MARKER_FLY_DURATION = 1.05;
const PANEL_MARKER_FLY_TIMEOUT = 1300;
const DESKTOP_POPUP_MARKER_GAP = 24;
const DESKTOP_POPUP_MARKER_TARGET_Y_RATIO = 0.78;
const USER_MARKER_Z_INDEX_OFFSET = 10000;
const USER_MARKER_MOVE_DURATION = 700;
const USER_MARKER_SNAP_DISTANCE_METERS = 120;
const urlParams = new URLSearchParams(window.location.search);
let activeBuildingMarker = null;
let activePanelMarker = null;
let spiderfiedCluster = null;


document.addEventListener('DOMContentLoaded', () => {
const mapElement = document.getElementById('map');
if (!mapElement || typeof L === 'undefined') {
  return;
}

// Array to hold all markers for zoom scaling
const markers = [];

// Initialize map
const initialZoom = 16;
const map = L.map('map', {
  center: MAP_CENTER,
  zoom: initialZoom,
  zoomControl: false,
  minZoom: 14,
  maxZoom: 17,
  maxBounds: IMAGE_BOUNDS,
  maxBoundsViscosity: 1,
  zoomSnap: 0.10,
  zoomDelta: 0.10,
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
  opacity: 0.95
}).addTo(map);

// Add overlay image
const overlayUrl = 'wp-content/themes/osadafabryczna/dist/assets/mapa2a.jpg';
const overlay = L.imageOverlay(
  overlayUrl,
  IMAGE_BOUNDS,
  {
    opacity: 1
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
      disableClusteringAtZoom: 16,
      removeOutsideVisibleBounds: true,
      maxClusterRadius: 400
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
    iconUrl: 'wp-content/themes/osadafabryczna/dist/assets/user-location.png',
    iconSize: [30,30],
    iconAnchor: [15,15]
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
  geolocationToggle.title = isSupported ? '' : 'Geolocation is not supported in this browser.';
  geolocationToggle.disabled = !isSupported;

  const label = geolocationToggle.querySelector('.geolocation-toggle__label');
  if (label) {
    label.textContent = isEnabled ? 'Lokalizacja: włączona' : 'Włącz lokalizację';
  }
}

function isGeolocationSupported() {
  return 'geolocation' in navigator;
}

function handleUserLocation(latlng) {
  if (!map.hasLayer(userMarker)) {
    userMarker.setLatLng(latlng);
    userMarker.addTo(map);
  }

  if (typeof userMarker.setZIndexOffset === 'function') {
    userMarker.setZIndexOffset(USER_MARKER_Z_INDEX_OFFSET);
  }

  moveUserMarkerTo(latlng);
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

  if (geolocationWatchId !== null) {
    navigator.geolocation.clearWatch(geolocationWatchId);
  }

  geolocationWatchId = navigator.geolocation.watchPosition(
    position => {
      handleUserLocation(L.latLng(position.coords.latitude, position.coords.longitude));
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

  if (geolocationWatchId !== null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(geolocationWatchId);
    geolocationWatchId = null;
  }

  if (userMarkerAnimationFrame) {
    cancelAnimationFrame(userMarkerAnimationFrame);
    userMarkerAnimationFrame = null;
  }

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

map.on('locationfound', e => {
  if (!geolocationEnabled) {
    return;
  }

  handleUserLocation(e.latlng);
});

map.on('locationerror', err => {
  handleGeolocationError(err);
});

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
  overlayToggle.textContent = overlayVisible ? 'Zmień mapę' : 'Zmień mapę';
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

  overlayToggle.type = 'button';
  overlayToggle.className = 'map-control-button map-overlay-toggle';
  overlayToggle.setAttribute('aria-label', 'Przełącz widoczność mapy historycznej');
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
    const response = await fetch('/wp-json/wp/v2/budynek?acf_format=standard&_embed');
    const budynki = await response.json();

    budynki.forEach(budynek => {
      const title = budynek.title.rendered;
      const lat = budynek.acf.latitude;
      const lng = budynek.acf.longitude;
      const marker_icon = budynek.acf.marker_icon;

      if (!lat || !lng) {
        console.warn(`Skipping "${title}": missing coordinates.`);
        return;
      }

      if (!marker_icon) {
        console.warn(`Skipping "${title}": missing marker URL.`);
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

  const iconWidth = Math.max(24, img.width * scale);
  const iconHeight = Math.max(24, img.height * scale);
  const paddedHeight = iconHeight + MARKER_PADDING * 2;
  const paddedWidth = iconWidth + MARKER_PADDING * 2;

  const icon = L.icon({
    iconUrl: marker_icon,
    iconSize: [paddedWidth, paddedHeight],
    iconAnchor: [paddedWidth / 2, paddedHeight],
    popupAnchor: [0, -paddedHeight - 5],
    className: 'building-marker'
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

if (window.innerWidth < 768) {
      // --- MOBILE ---
      openPanel(budynek, marker);
      const panel = document.getElementById('slide-panel');
      if (isSpiderfiedMarker) {
        return;
      }

      const targetCenter = getMarkerFocusLatLng(marker, targetZoom);
      map.flyTo(targetCenter, targetZoom, {
        animate: true,
        duration: PANEL_MARKER_FLY_DURATION,
        easeLinearity: 0.15
      });

      waitForPanelOpen(panel).then(() => {
        if (typeof marker.bringToFront === 'function') {
          marker.bringToFront();
        }
      });

    } else {
      // --- DESKTOP ---
      openPanel(budynek, marker);
      const panel = document.getElementById('slide-panel');
      if (isSpiderfiedMarker) {
        return;
      }

      const targetCenter = getMarkerFocusLatLng(marker, targetZoom);
      map.flyTo(targetCenter, targetZoom, {
        animate: true,
        duration: PANEL_MARKER_FLY_DURATION,
        easeLinearity: 0.15
      });

      const flyToDone = waitForMapMove(map, PANEL_MARKER_FLY_TIMEOUT);
      waitForPanelOpen(panel)
        .then(() => flyToDone)
        .then(() => queueMarkerVisibilityCheck(marker));
      window.setTimeout(() => {
        flyToDone.then(() => queueMarkerVisibilityCheck(marker));
      }, 900);
    }
  });

  // Store marker info for zoom scaling
  marker.options.baseHeight = iconHeight;
  marker.options.baseWidth = iconWidth;
  marker.options.baseZoom = map.getZoom();
  marker.options.iconUrl = marker_icon;

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
    infoPanel.classList.remove('is-open');
    document.body.classList.remove('info-panel-open');
    infoPanelToggle.classList.remove('is-hidden');
    infoPanel.setAttribute('aria-hidden', 'true');
  }

  if (window.innerWidth >= 768) {
    openInfoPanel();
  } else {
    openInfoPanel();
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
    if (window.innerWidth < 768) {
      closeInfoPanel();
    } else if (!infoPanel.classList.contains('is-open')) {
      openInfoPanel();
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

  infoPanel.classList.remove('is-open');
  document.body.classList.remove('info-panel-open');
  infoPanel.setAttribute('aria-hidden', 'true');

  if (infoPanelToggle) {
    infoPanelToggle.classList.remove('is-hidden');
  }
}

const markerVisibilityChecks = new WeakMap();

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

  return L.icon({
    iconUrl: marker.options.iconUrl,
    iconSize: [paddedWidth, paddedHeight],
    iconAnchor: [paddedWidth / 2, paddedHeight],
    popupAnchor: [0, -paddedHeight - 5],
    className: isActive ? 'building-marker building-marker--active' : 'building-marker'
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

function queueMarkerVisibilityCheck(marker) {
  const pendingCheck = markerVisibilityChecks.get(marker) || Promise.resolve();
  const nextCheck = pendingCheck
    .catch(() => {})
    .then(() => ensureMarkerVisibleAbovePanel(marker));

  markerVisibilityChecks.set(marker, nextCheck);
  return nextCheck;
}

function waitForMapMove(map, timeout = PANEL_MARKER_PAN_TIMEOUT) {
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      map.off('moveend', finish);
      window.clearTimeout(timeoutId);
      resolve();
    };

    map.once('moveend', finish);
    const timeoutId = window.setTimeout(finish, timeout);
  });
}

function getPanelCoverage(panel, mapContainer) {
  const panelRect = panel.getBoundingClientRect();
  const mapRect = mapContainer.getBoundingClientRect();
  const overlapsMap = panelRect.left < mapRect.right
    && panelRect.right > mapRect.left
    && panelRect.top < mapRect.bottom
    && panelRect.bottom > mapRect.top;

  if (!overlapsMap) {
    return null;
  }

  const isBottomPanel = window.innerWidth < 768
    && panelRect.top > mapRect.top
    && panelRect.width > mapRect.width * 0.6;

  if (!isBottomPanel) {
    return null;
  }

  return {
    height: panel.offsetHeight || panelRect.height || window.innerHeight * 0.6,
    leftInMap: panelRect.left - mapRect.left,
    mode: 'bottom'
  };
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

async function ensureMarkerVisibleAbovePanel(marker, maxAttempts = 6) {
  const slidePanel = document.getElementById('slide-panel');

  if (!slidePanel || !marker._map || !slidePanel.classList.contains('open')) {
    return;
  }

  const map = marker._map;
  const mapContainer = map.getContainer();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise(resolve => requestAnimationFrame(resolve));

    const panelCoverage = getPanelCoverage(slidePanel, mapContainer);
    if (!panelCoverage) {
      return;
    }

    const markerPoint = map.latLngToContainerPoint(marker.getLatLng());

    const panelTopInMap = getPanelTopInMap(slidePanel, mapContainer);
    const desiredY = panelTopInMap - getPanelMarkerGap();
    const offsetY = markerPoint.y - desiredY;

    if (offsetY <= 2) {
      return;
    }

    map.panBy([0, offsetY], {
      animate: true,
      duration: PANEL_MARKER_PAN_DURATION,
      easeLinearity: 0.15
    });
    await waitForMapMove(map);
  }
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

// PANEL LOGIC
function openPanel(budynek, marker = null) {
  closeInfoPanelIfOpen();

  const panel = document.getElementById('slide-panel');
  const title = budynek.title.rendered;
  const content = document.getElementById('panel-content');

  if (!panel || !content) {
    return;
  }

  content.innerHTML = `
    <h2 class="map-building-title">${title}</h2>
    <h3 class="map-building-subtitle">${budynek.acf.subtitle || ''}</h3>
    <p class="map-building-paragraph">${budynek.acf.short_description || ''}</p>
    <a class="map-building-link" href="${budynek.link}" target="_blank" rel="noopener noreferrer">Czytaj więcej →</a>
  `;

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
