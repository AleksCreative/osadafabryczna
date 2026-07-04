// Map center and overlay bounds
const MAP_CENTER = [52.05698, 20.44018];
const IMAGE_BOUNDS = [
  [52.081628, 20.502934], // northeast
  [52.033532, 20.382671]  // southwest
];
const TARGET_HEIGHT = 100; // fixed marker height
const ZOOM_STEP_FACTOR = 1.2; // scale factor per zoom level
const MOBILE_PANEL_MARKER_GAP = 72;
const EXTRA_PANEL_MARGIN = 8;
const PANEL_MARKER_GAP_SCALE = 0.6;
const ACTIVE_MARKER_SCALE = 1.12;
const PANEL_MARKER_PAN_DURATION = 0.75;
const PANEL_MARKER_PAN_TIMEOUT = 950;
const PANEL_MARKER_FLY_DURATION = 1.05;
const PANEL_MARKER_FLY_TIMEOUT = 1300;
const USER_MARKER_Z_INDEX_OFFSET = 10000;
const USER_MARKER_MOVE_DURATION = 700;
const USER_MARKER_SNAP_DISTANCE_METERS = 120;
const urlParams = new URLSearchParams(window.location.search);
let activeBuildingMarker = null;


document.addEventListener('DOMContentLoaded', () => {
const mapElement = document.getElementById('map');
if (!mapElement || typeof L === 'undefined') {
  return;
}

// Array to hold all markers for zoom scaling
const markers = [];

// Initialize map
const map = L.map('map', {
  center: MAP_CENTER,
  zoom: 15,
  minZoom: 14,
  maxZoom: 18,
  maxBounds: IMAGE_BOUNDS,
  maxBoundsViscosity: 1,
  zoomSnap: 0.15,
  zoomDelta: 0.15,
  wheelPxPerZoomLevel: 80
});

// Add OpenStreetMap tiles
const osmTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  opacity: 0
}).addTo(map);

// Add overlay image
const overlayUrl = 'wp-content/themes/osadafabryczna/dist/assets/mapa.png';
const overlay = L.imageOverlay(
  overlayUrl,
  IMAGE_BOUNDS,
  {
    opacity: 0.8
  }
).addTo(map);

// Fit map to overlay
map.fitBounds(IMAGE_BOUNDS, { animate: false });
map.setMaxBounds(IMAGE_BOUNDS);
map.setMinZoom(map.getBoundsZoom(IMAGE_BOUNDS, false));

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
  overlayToggle.textContent = overlayVisible ? 'ukryj mapę' : 'pokaż mapę';
  overlayToggle.setAttribute('aria-pressed', String(overlayVisible));
}

function updateMapLayerVisibility() {
  if (overlayVisible) {
    if (!map.hasLayer(overlay)) {
      overlay.addTo(map);
    }

    osmTiles.setOpacity(0);
  } else {
    if (map.hasLayer(overlay)) {
      overlay.remove();
    }

    osmTiles.setOpacity(1);
  }
}

function setupMapControlMenu() {
  const zoomControl = map.getContainer().querySelector('.leaflet-control-zoom');

  if (!zoomControl) {
    return;
  }

  zoomControl.classList.add('map-control-menu');

  if (geolocationToggle) {
    geolocationToggle.classList.add('map-control-button');
    zoomControl.appendChild(geolocationToggle);
  }

  overlayToggle.type = 'button';
  overlayToggle.className = 'map-control-button map-overlay-toggle';
  overlayToggle.setAttribute('aria-label', 'Przełącz widoczność mapy historycznej');
  updateOverlayToggleState();

  if (typeof L.DomEvent?.disableClickPropagation === 'function') {
    L.DomEvent.disableClickPropagation(overlayToggle);
  }

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

  zoomControl.appendChild(overlayToggle);
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
  // Scale width proportionally to fixed height
  const scale = TARGET_HEIGHT / img.height;
  const iconWidth = img.width * scale;

  const icon = L.icon({
    iconUrl: marker_icon,
    iconSize: [iconWidth, TARGET_HEIGHT],
    iconAnchor: [iconWidth / 2, TARGET_HEIGHT],
    popupAnchor: [0, -TARGET_HEIGHT - 5],
    className: 'building-marker'
  });

  const marker = L.marker([lat, lng], { icon });
  if (markerClusterGroup) {
    markerClusterGroup.addLayer(marker);
  } else {
    marker.addTo(map);
  }

  // --- Marker click: mobile slide-up panel + desktop side panel ---
  marker.on('click', () => {
    setActiveBuildingMarker(marker);

    if (typeof marker.bringToFront === 'function') {
      marker.bringToFront();
    }
  const targetZoom = Math.max(map.getZoom(), 17);

if (window.innerWidth < 768) {
      // --- MOBILE ---
      openPanel(budynek);
      const panel = document.getElementById('slide-panel');
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
      openPanel(budynek);
      const panel = document.getElementById('slide-panel');
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
  marker.options.baseHeight = TARGET_HEIGHT;
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

// Initialize everything

  addMarkers();


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

  return L.icon({
    iconUrl: marker.options.iconUrl,
    iconSize: [newWidth, newHeight],
    iconAnchor: [newWidth / 2, newHeight],
    popupAnchor: [0, -newHeight - 5],
    className: isActive ? 'building-marker building-marker--active' : 'building-marker'
  });
}

function updateBuildingMarkerIcon(marker) {
  if (!marker || !marker.options.baseHeight || !marker.options.baseWidth || !marker.options.iconUrl) {
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

  const isNarrowSidePanel = window.innerWidth >= 768
    && window.innerWidth < 1024
    && panelRect.right >= window.innerWidth - 2
    && panelRect.left < mapRect.right
    && panelRect.width < mapRect.width;

  if (!isBottomPanel && !isNarrowSidePanel) {
    return null;
  }

  return {
    height: panel.offsetHeight || panelRect.height || window.innerHeight * 0.6,
    leftInMap: panelRect.left - mapRect.left,
    mode: isBottomPanel ? 'bottom' : 'side'
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

  if (window.innerWidth < 1024) {
    const panelWidth = panel.offsetWidth || 420;
    const panelLeftInMap = window.innerWidth - panelWidth - mapRect.left;
    const desiredX = (panelLeftInMap - getPanelMarkerGap()) / 2;

    return L.point(Math.max(TARGET_HEIGHT, desiredX), mapHeight / 2);
  }

  return L.point(mapWidth / 2, mapHeight / 2);
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

    if (panelCoverage.mode === 'side') {
      const desiredX = panelCoverage.leftInMap - getPanelMarkerGap();
      const offsetX = markerPoint.x - desiredX;

      if (offsetX <= 2) {
        return;
      }

      map.panBy([offsetX, 0], {
        animate: true,
        duration: PANEL_MARKER_PAN_DURATION,
        easeLinearity: 0.15
      });
      await waitForMapMove(map);
      continue;
    }

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

// PANEL LOGIC
function openPanel(budynek) {
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

  panel.style.transition = '';
  panel.style.transform = '';
  panel.classList.add('open');
  document.body.classList.add('map-panel-open');
}

function closePanel() {
  const panel = document.getElementById('slide-panel');

  if (!panel) {
    return;
  }

  clearActiveBuildingMarker();
  panel.classList.remove('open');
  document.body.classList.remove('map-panel-open');
  panel.style.transition = '';
  panel.style.transform = '';
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
