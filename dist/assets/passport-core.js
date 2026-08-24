(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.OsadaPassportCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const EARTH_RADIUS_METERS = 6371008.8;

  function toRadians(value) {
    return value * Math.PI / 180;
  }

  function distanceMeters(first, second) {
    const firstLat = Number(first?.latitude ?? first?.lat);
    const firstLng = Number(first?.longitude ?? first?.lng);
    const secondLat = Number(second?.latitude ?? second?.lat);
    const secondLng = Number(second?.longitude ?? second?.lng);

    if (![firstLat, firstLng, secondLat, secondLng].every(Number.isFinite)) {
      return Number.POSITIVE_INFINITY;
    }

    const latDelta = toRadians(secondLat - firstLat);
    const lngDelta = toRadians(secondLng - firstLng);
    const firstLatRadians = toRadians(firstLat);
    const secondLatRadians = toRadians(secondLat);
    const haversine = Math.sin(latDelta / 2) ** 2
      + Math.cos(firstLatRadians) * Math.cos(secondLatRadians) * Math.sin(lngDelta / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
  }

  class ProximityTracker {
    constructor(options = {}) {
      this.radiusMeters = options.radiusMeters ?? 50;
      this.maxAccuracyMeters = options.maxAccuracyMeters ?? 50;
      this.dwellMilliseconds = options.dwellMilliseconds ?? 10000;
      this.minimumReadings = options.minimumReadings ?? 2;
      this.reset();
    }

    reset() {
      this.candidateId = null;
      this.startedAt = null;
      this.readings = 0;
    }

    update(position, places, timestamp = Date.now()) {
      const latitude = Number(position?.coords?.latitude);
      const longitude = Number(position?.coords?.longitude);
      const accuracy = Number(position?.coords?.accuracy);

      if (![latitude, longitude, accuracy].every(Number.isFinite) || accuracy > this.maxAccuracyMeters) {
        this.reset();
        return { status: 'inaccurate', accuracy };
      }

      const location = { latitude, longitude };
      const candidates = (Array.isArray(places) ? places : [])
        .map(place => ({
          place,
          distance: distanceMeters(location, place)
        }))
        .filter(candidate => candidate.distance <= this.radiusMeters)
        .sort((first, second) => first.distance - second.distance);

      if (!candidates.length) {
        this.reset();
        return { status: 'outside' };
      }

      const nearest = candidates[0];
      const candidateId = String(nearest.place.placeId);

      if (this.candidateId !== candidateId) {
        this.candidateId = candidateId;
        this.startedAt = timestamp;
        this.readings = 1;
      } else {
        this.readings += 1;
      }

      const elapsedMilliseconds = Math.max(0, timestamp - this.startedAt);

      if (this.readings >= this.minimumReadings && elapsedMilliseconds >= this.dwellMilliseconds) {
        return {
          status: 'ready',
          place: nearest.place,
          distance: nearest.distance,
          readings: this.readings,
          elapsedMilliseconds
        };
      }

      return {
        status: 'dwelling',
        place: nearest.place,
        distance: nearest.distance,
        readings: this.readings,
        elapsedMilliseconds,
        remainingMilliseconds: Math.max(0, this.dwellMilliseconds - elapsedMilliseconds)
      };
    }
  }

  return {
    distanceMeters,
    ProximityTracker
  };
});
