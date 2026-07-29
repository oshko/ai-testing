'use strict';

/**
 * String-similarity utilities shared by two subsystems:
 *   - watchlist name screening (REQ-INT-503) — needs to catch transliteration
 *     variants and reordered name parts without drowning analysts in noise;
 *   - NLP misspelling tolerance (REQ-NLP-207).
 *
 * Deliberately dependency-free and deterministic. A hosted fuzzy-matching
 * service would be a black box whose scores drift between versions, which would
 * make every screening assertion in the RTM unreproducible.
 */

/**
 * Canonical form for comparison: strip diacritics, drop punctuation, lowercase,
 * collapse whitespace. Diacritic folding is what lets `Müller` match `Muller`
 * and `José` match `Jose` — routine in sanctions screening, where source lists
 * and customer records rarely agree on transliteration.
 */
function normalize(input) {
  if (input == null) return '';
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein edit distance, two-row rolling buffer (O(min(a,b)) space). */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Edit-distance similarity in [0,1]. */
function ratio(a, b) {
  const s1 = normalize(a);
  const s2 = normalize(b);
  if (!s1 && !s2) return 1;
  const longest = Math.max(s1.length, s2.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(s1, s2) / longest;
}

/**
 * Jaro similarity — favours strings agreeing on characters in roughly the same
 * position, which suits personal names better than raw edit distance.
 */
function jaro(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const window = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const s1Matched = new Array(len1).fill(false);
  const s2Matched = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i += 1) {
    const start = Math.max(0, i - window);
    const end = Math.min(i + window + 1, len2);
    for (let j = start; j < end; j += 1) {
      if (s2Matched[j] || s1[i] !== s2[j]) continue;
      s1Matched[i] = true;
      s2Matched[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;

  // Count transpositions: matched characters that appear out of order.
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i += 1) {
    if (!s1Matched[i]) continue;
    while (!s2Matched[k]) k += 1;
    if (s1[i] !== s2[k]) transpositions += 1;
    k += 1;
  }

  const t = transpositions / 2;
  return (matches / len1 + matches / len2 + (matches - t) / matches) / 3;
}

/** Jaro-Winkler: boosts scores for strings sharing a leading prefix. */
function jaroWinkler(a, b, scalingFactor = 0.1) {
  const s1 = normalize(a);
  const s2 = normalize(b);
  const base = jaro(s1, s2);
  if (base === 0) return 0;

  let prefix = 0;
  const maxPrefix = Math.min(4, s1.length, s2.length);
  while (prefix < maxPrefix && s1[prefix] === s2[prefix]) prefix += 1;

  return base + prefix * scalingFactor * (1 - base);
}

/**
 * Order-insensitive token comparison: pairs each token of one name with its best
 * match in the other and averages. This is what catches `SMITH JOHN` against
 * `John Smith` — a match plain edit distance scores at only ~0.4 and would miss
 * entirely at a realistic screening threshold.
 */
function tokenSetSimilarity(a, b) {
  const t1 = normalize(a).split(' ').filter(Boolean);
  const t2 = normalize(b).split(' ').filter(Boolean);
  if (!t1.length || !t2.length) return 0;

  const [shorter, longer] = t1.length <= t2.length ? [t1, t2] : [t2, t1];
  const scores = shorter.map((token) =>
    Math.max(...longer.map((other) => jaroWinkler(token, other))));

  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * Composite name-match score in 0..100 used by the screening service.
 *
 * Takes the max of whole-string and token-set similarity: whole-string wins on
 * near-identical spellings, token-set wins on reordered or partial names. Taking
 * the max rather than the mean keeps recall high, which is the correct bias for
 * sanctions screening — a missed true match is a regulatory breach, whereas a
 * false positive is analyst time.
 */
function nameMatchScore(a, b) {
  const whole = jaroWinkler(a, b);
  const tokens = tokenSetSimilarity(a, b);
  return Math.round(Math.max(whole, tokens) * 10000) / 100;
}

module.exports = {
  normalize,
  levenshtein,
  ratio,
  jaro,
  jaroWinkler,
  tokenSetSimilarity,
  nameMatchScore,
};
