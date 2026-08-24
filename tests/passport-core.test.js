const test = require('node:test');
const assert = require('node:assert/strict');
const { distanceMeters, ProximityTracker } = require('../dist/assets/passport-core.js');

const METERS_PER_LATITUDE_DEGREE = 111195;

function latitudeOffset(meters) {
  return meters / METERS_PER_LATITUDE_DEGREE;
}

function position(metersNorth = 0, accuracy = 10) {
  return {
    coords: {
      latitude: latitudeOffset(metersNorth),
      longitude: 0,
      accuracy
    }
  };
}

function place(placeId, metersNorth) {
  return {
    placeId,
    latitude: latitudeOffset(metersNorth),
    longitude: 0
  };
}

test('distanceMeters measures useful passport boundaries', () => {
  assert.ok(distanceMeters(position(0).coords, place('p', 30)) > 29.9);
  assert.ok(distanceMeters(position(0).coords, place('p', 30)) < 30.1);
  assert.ok(distanceMeters(position(0).coords, place('p', 50)) > 49.9);
  assert.ok(distanceMeters(position(0).coords, place('p', 50)) < 50.1);
  assert.ok(distanceMeters(position(0).coords, place('p', 80)) > 79.9);
  assert.ok(distanceMeters(position(0).coords, place('p', 80)) < 80.1);
});

test('tracker rejects readings with accuracy worse than 50 metres', () => {
  const tracker = new ProximityTracker();
  const result = tracker.update(position(0, 51), [place('nearby', 10)], 0);

  assert.equal(result.status, 'inaccurate');
  assert.equal(tracker.candidateId, null);
});

test('tracker requires at least two readings spanning ten seconds', () => {
  const tracker = new ProximityTracker();
  const nearby = [place('nearby', 20)];

  assert.equal(tracker.update(position(), nearby, 0).status, 'dwelling');
  assert.equal(tracker.update(position(), nearby, 9000).status, 'dwelling');

  const ready = tracker.update(position(), nearby, 10000);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.place.placeId, 'nearby');
});

test('tracker selects only the nearest qualifying monument', () => {
  const tracker = new ProximityTracker({ dwellMilliseconds: 1000 });
  const places = [place('farther', 40), place('nearest', 15), place('outside', 80)];

  tracker.update(position(), places, 0);
  const ready = tracker.update(position(), places, 1000);

  assert.equal(ready.status, 'ready');
  assert.equal(ready.place.placeId, 'nearest');
});

test('leaving the radius resets dwell progress', () => {
  const tracker = new ProximityTracker();
  const nearby = [place('nearby', 20)];

  tracker.update(position(), nearby, 0);
  assert.equal(tracker.update(position(100), nearby, 5000).status, 'outside');
  assert.equal(tracker.update(position(), nearby, 10000).status, 'dwelling');
  assert.equal(tracker.update(position(), nearby, 19000).status, 'dwelling');
  assert.equal(tracker.update(position(), nearby, 20000).status, 'ready');
});

test('switching to a closer monument starts a new dwell period', () => {
  const tracker = new ProximityTracker();

  tracker.update(position(), [place('first', 10)], 0);
  const switched = tracker.update(position(), [place('second', 8)], 10000);

  assert.equal(switched.status, 'dwelling');
  assert.equal(switched.place.placeId, 'second');
  assert.equal(switched.elapsedMilliseconds, 0);
});
