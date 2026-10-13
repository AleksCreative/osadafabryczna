// Read-only wiring checks; no browser or geolocation access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mainPath = process.env.OSADA_MAP_TEST_PATH || path.join(__dirname, '../dist/assets/main.js');
const stylePath = process.env.OSADA_STYLE_TEST_PATH || path.join(__dirname, '../style.css');
const source = fs.readFileSync(mainPath, 'utf8');
const css = fs.readFileSync(stylePath, 'utf8');

for (const label of ['Wyśrodkuj na mojej lokalizacji', 'Center on my location']) {
  test(`user marker calls the shared focus action: ${label}`, () => {
    const start = source.indexOf('const userMarker = L.marker(');
    const end = source.indexOf('let userMarkerAnimationFrame', start);
    assert.ok(start >= 0 && end > start);
    let calls = 0;
    const focus = () => { calls++; };
    const context = {
      MAP_LABELS: { centerLocation: label }, MAP_ASSETS: {},
      USER_MARKER_SIZE: 60, USER_MARKER_Z_INDEX_OFFSET: 10000,
      focusMapOnUser: focus,
      L: { icon: options => options, marker: (position, options) => ({
        options, handlers: {}, on(event, handler) { this.handlers[event] = handler; },
      }) },
    };
    vm.runInNewContext(source.slice(start, end) + '\nglobalThis.marker = userMarker;', context);
    assert.equal(context.marker.handlers.click, focus);
    context.marker.handlers.click();
    assert.equal(calls, 1);
    assert.equal(context.marker.options.title, label);
    assert.equal(context.marker.options.alt, label);
    assert.equal(context.marker.options.keyboard, true);
    const buttonHandler = source.match(/centerLocationButton\.addEventListener\('click',[\s\S]*?\n    \}\);/);
    assert.ok(buttonHandler);
    assert.match(buttonHandler[0], /focusMapOnUser\(\)/);
  });
}

test('center control is below panels without lowering the action menu', () => {
  assert.match(css, /\.leaflet-control\.center-location-control\s*\{[^}]*z-index:\s*1000;/);
  assert.match(css, /\.leaflet-bottom\.leaflet-left\s*\{[^}]*z-index:\s*auto;/);
  assert.doesNotMatch(css, /\.leaflet-bottom\.leaflet-left\s*\{[^}]*z-index:\s*(1300|1400);/);
  assert.match(css, /\.leaflet-bottom\.leaflet-left \.map-control-menu\s*\{[^}]*z-index:\s*1300;/);
  assert.match(css, /\.leaflet-bottom\.leaflet-left \.map-control-menu\s*\{[^}]*z-index:\s*1400;/);
  assert.match(css, /\.info-panel\s*\{[^}]*z-index:\s*1100;/);
  assert.match(css, /#slide-panel\s*\{[^}]*z-index:\s*1250;/);
});
