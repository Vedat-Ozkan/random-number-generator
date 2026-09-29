// Pure RNG helpers (no DOM). Source of randomness: crypto.getRandomValues only.

export function randUint32() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

// Unbiased inclusive integer in [min, max]; requires max - min + 1 <= 2**32.
export function randInt(min, max) {
  const range = max - min + 1;
  if (range === 1) return min;
  const limit = Math.floor(2 ** 32 / range) * range; // largest multiple of range
  let r;
  do { r = randUint32(); } while (r >= limit); // rejection sampling
  return min + (r % range);
}

// In-place Fisher-Yates.
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// k distinct integers in [min, max], not in `exclude`, in draw order.
export function sampleDistinct(min, max, k, exclude = new Set()) {
  const size = max - min + 1;
  let excluded = 0;
  for (const v of exclude) if (v >= min && v <= max) excluded++;
  const available = size - excluded;
  if (k > available) throw new RangeError(`Cannot draw ${k} from ${available} available`);
  if (k <= 0) return [];

  if (excluded + k <= size / 2) {
    const out = [];
    const seen = new Set();
    while (out.length < k) {
      const v = randInt(min, max);
      if (exclude.has(v) || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }

  // Dense case: size <= 2 * (excluded + k), so enumeration is bounded.
  const candidates = [];
  for (let v = min; v <= max; v++) if (!exclude.has(v)) candidates.push(v);
  for (let i = 0; i < k; i++) {
    const j = i + randInt(0, candidates.length - 1 - i);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, k);
}

export function sampleWithReplacement(min, max, k) {
  const out = [];
  for (let i = 0; i < k; i++) out.push(randInt(min, max));
  return out;
}

// Shared Number/List generate logic (spec 5.2). Pure: returns new drawn pool,
// the values and any toast notes.
export function draw({ min, max, count, noRepeat, allowDupes = false, drawn = [], sort = false, label = 'numbers', resetNote }) {
  const size = max - min + 1;
  const notes = [];
  let pool = drawn.slice();
  let values;
  if (noRepeat) {
    if (pool.length >= size) {
      pool = [];
      notes.push(resetNote || `All ${label} drawn — pool reset`);
    }
    const remaining = size - pool.length;
    const k = Math.min(count, remaining);
    if (k < count) notes.push(`Only ${k} left in pool`);
    values = sampleDistinct(min, max, k, new Set(pool));
    pool.push(...values);
  } else if (allowDupes) {
    values = sampleWithReplacement(min, max, count);
  } else {
    const k = Math.min(count, size);
    if (k < count) notes.push(`Range has only ${size} ${label}`);
    values = sampleDistinct(min, max, k);
  }
  if (sort) values.sort((a, b) => a - b);
  return { values, drawn: pool, notes };
}

// Index in [0, weights.length) with probability proportional to weights[i] (integers >= 1).
export function weightedIndex(weights, excludeSet = new Set()) {
  let total = 0;
  for (let i = 0; i < weights.length; i++) if (!excludeSet.has(i)) total += weights[i];
  if (total <= 0) throw new RangeError('No weight available');
  let r = randInt(0, total - 1);
  for (let i = 0; i < weights.length; i++) {
    if (excludeSet.has(i)) continue;
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  throw new Error('unreachable');
}

// Weighted counterpart of draw() over entry indices. Picks are distinct within a batch.
export function drawWeighted({ weights, count, noRepeat, drawn = [], label = 'items', resetNote }) {
  const size = weights.length;
  const notes = [];
  let pool = drawn.slice();
  if (noRepeat && pool.length >= size) {
    pool = [];
    notes.push(resetNote || `All ${label} drawn — pool reset`);
  }
  const available = size - (noRepeat ? pool.length : 0);
  const k = Math.min(count, available);
  if (k < count) notes.push(noRepeat ? `Only ${k} left in pool` : `List has only ${size} ${label}`);
  const exclude = new Set(noRepeat ? pool : []);
  const values = [];
  for (let i = 0; i < k; i++) {
    const idx = weightedIndex(weights, exclude);
    exclude.add(idx);
    values.push(idx);
  }
  if (noRepeat) pool.push(...values);
  return { values, drawn: pool, notes };
}

// Shuffles names and deals them round-robin. Team sizes differ by at most 1.
export function splitTeams(names, mode, n) {
  if (!names.length) return [];
  const teamCount = mode === 'teams' ? Math.min(n, names.length) : Math.ceil(names.length / n);
  const teams = Array.from({ length: teamCount }, () => []);
  shuffle(names.slice()).forEach((name, i) => teams[i % teamCount].push(name));
  return teams;
}

export function drawLottery({ n, k, bonusK, bonusN, bonusSame }) {
  const asc = (a, b) => a - b;
  const main = sampleDistinct(1, n, k).sort(asc);
  let bonus = [];
  if (bonusK > 0) {
    bonus = (bonusSame ? sampleDistinct(1, n, bonusK, new Set(main)) : sampleDistinct(1, bonusN, bonusK)).sort(asc);
  }
  return { main, bonus };
}
