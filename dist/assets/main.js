// Map center and overlay bounds
const MAP_CENTER = [52.05698, 20.44018];
const IMAGE_BOUNDS = [
  [52.06504, 20.45329], // northeast
  [52.04668, 20.41437]  // southwest
];
const TARGET_HEIGHT = 100; // fixed marker height
const ZOOM_STEP_FACTOR = 1.2; // scale factor per zoom level
const MOBILE_PANEL_MARKER_GAP = 72;
const urlParams = new URLSearchParams(window.location.search);


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
  zoom: 16,
  minZoom: 15,
  maxZoom: 18,
  zoomSnap: 0.25,
  zoomDelta: 0.25,
  wheelPxPerZoomLevel: 80
});

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Add overlay image
const overlayUrl = 'wp-content/themes/osadafabryczna/dist/assets/mapa.jpg';
const overlay = L.imageOverlay(
  overlayUrl,
  IMAGE_BOUNDS,
  {
    opacity: 0.8
  }
).addTo(map);

// Fit map to overlay
map.fitBounds(IMAGE_BOUNDS);



// Locate user
map.locate({ setView: false, watch: true, maxZoom: 18 });

const userMarker = L.marker([0,0], { 
  icon: L.icon({ 
    iconUrl: '/wp-content/themes/osadafabryczna/dist/assets/user-location.png', 
    iconSize: [30,30], 
    iconAnchor: [15,15] 
  }) 
}).addTo(map);

map.on('locationfound', e => {
  userMarker.setLatLng(e.latlng);
});

map.on('locationerror', err => {
  console.warn('Geolocation error:', err.message);
});

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
    popupAnchor: [0, -TARGET_HEIGHT - 5]
  });

  const marker = L.marker([lat, lng], { icon }).addTo(map);

  // --- Marker click: mobile slide-up panel + desktop side panel ---
  marker.on('click', () => {
    if (typeof marker.bringToFront === 'function') {
      marker.bringToFront();
    }
  const targetZoom = Math.max(map.getZoom(), 17);

if (window.innerWidth < 768) {
      // --- MOBILE ---
      map.flyTo([lat, lng], targetZoom, { animate: true, duration: 0.7 });

      // Wait for flyTo to finish before opening panel
      map.once('moveend', () => {
        openPanel(budynek);

        keepMarkerAbovePanel(marker);
        window.setTimeout(() => keepMarkerAbovePanel(marker), 380);
      });

    } else {
      // --- DESKTOP ---
      map.flyTo([lat, lng], targetZoom, { animate: true, duration: 0.7 });
      openPanel(budynek);
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
  const currentZoom = map.getZoom();
  markers.forEach(marker => {
    const scale = Math.pow(ZOOM_STEP_FACTOR, currentZoom - marker.options.baseZoom);
    const newHeight = marker.options.baseHeight * scale;
    const newWidth = marker.options.baseWidth * scale;

    const icon = L.icon({
      iconUrl: marker.options.iconUrl,
      iconSize: [newWidth, newHeight],
      iconAnchor: [newWidth / 2, newHeight],
      popupAnchor: [0, -newHeight - 5]
    });

    marker.setIcon(icon);
  });
});

// Initialize everything

  addMarkers();


});



function keepMarkerAbovePanel(marker) {
  const slidePanel = document.getElementById('slide-panel');

  if (!slidePanel || !marker._map || window.innerWidth >= 768) {
    return;
  }

  const map = marker._map;
  const mapTop = map.getContainer().getBoundingClientRect().top;
  const panelHeight = slidePanel.offsetHeight || window.innerHeight * 0.6;
  const panelTopInMap = window.innerHeight - panelHeight - mapTop;
  const markerPoint = map.latLngToContainerPoint(marker.getLatLng());
  const desiredY = panelTopInMap - MOBILE_PANEL_MARKER_GAP;
  const offsetY = markerPoint.y - desiredY;

  if (offsetY > 0) {
    map.panBy([0, -offsetY], { animate: true });
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
}

function closePanel() {
  const panel = document.getElementById('slide-panel');

  if (!panel) {
    return;
  }

  panel.classList.remove('open');
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
