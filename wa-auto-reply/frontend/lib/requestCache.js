const cache = new Map();
const inflight = new Map();

export async function cachedRequest(key, fetcher, { ttlMs = 30000, force = false } = {}) {
  if (!force) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) {
      return hit.data;
    }

    if (inflight.has(key)) {
      return inflight.get(key);
    }
  }

  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      cache.set(key, { data, at: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateCachedRequest(key) {
  cache.delete(key);
  inflight.delete(key);
}
