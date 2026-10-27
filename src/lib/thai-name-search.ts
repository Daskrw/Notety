import { thaiNamesDataset } from '../data/thai-names-data.ts';

export interface ThaiNameRawEntry {
  n: string;
  c: string[];
  s: string[];
  m?: string;
}

export type ThaiMatchCategory = 'exact' | 'prefix' | 'contains' | 'closely_related' | 'similar';

export interface ThaiNameSearchResult {
  name: string;
  matchType: ThaiMatchCategory;
  categories: string[];
  sources: string[];
  meaning?: string;
  score: number;
}

export interface ThaiNameFilterOptions {
  category?: 'all' | 'male' | 'female' | 'surname' | 'first_name' | 'meaning';
  limit?: number;
}

// Strip tone marks, thanthakhat (karan), mai han-akat, mai tai khu, yamakkan
export function stripThaiDiacritics(s: string): string {
  if (!s) return '';
  return s.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '');
}

// Map cognate Thai consonants to a shared base consonant for phonetic/spelling variation matching
export function toThaiCognateSkeleton(s: string): string {
  if (!s) return '';
  return stripThaiDiacritics(s)
    .replace(/[ศษ]/g, 'ส')
    .replace(/[ธฑฒ]/g, 'ท')
    .replace(/[ภ]/g, 'พ')
    .replace(/[ณ]/g, 'น')
    .replace(/[ฎ]/g, 'ด')
    .replace(/[ฏ]/g, 'ต')
    .replace(/[ฬ]/g, 'ล')
    .replace(/[ญ]/g, 'ย');
}

// Character-level Levenshtein edit distance with short-circuit threshold
export function levenshteinDistance(a: string, b: string, maxThreshold: number = 2): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > maxThreshold) return maxThreshold + 1;

  const row = new Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = i;
    let minInRow = prev;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = val;
      if (val < minInRow) minInRow = val;
    }
    row[n] = prev;
    if (minInRow > maxThreshold) return maxThreshold + 1;
  }
  return row[n];
}

// In-memory index structures initialized once
interface IndexStore {
  exactMap: Map<string, ThaiNameRawEntry>;
  normMap: Map<string, ThaiNameRawEntry[]>;
  cognateMap: Map<string, ThaiNameRawEntry[]>;
  allEntries: ThaiNameRawEntry[];
  withMeanings: ThaiNameRawEntry[];
}

let store: IndexStore | null = null;

function getStore(): IndexStore {
  if (!store) {
    const rawList: ThaiNameRawEntry[] = (thaiNamesDataset as any).names || [];
    const exactMap = new Map<string, ThaiNameRawEntry>();
    const normMap = new Map<string, ThaiNameRawEntry[]>();
    const cognateMap = new Map<string, ThaiNameRawEntry[]>();
    const withMeanings: ThaiNameRawEntry[] = [];

    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      exactMap.set(item.n, item);

      const norm = stripThaiDiacritics(item.n);
      let nList = normMap.get(norm);
      if (!nList) {
        nList = [];
        normMap.set(norm, nList);
      }
      nList.push(item);

      const cognate = toThaiCognateSkeleton(item.n);
      let cList = cognateMap.get(cognate);
      if (!cList) {
        cList = [];
        cognateMap.set(cognate, cList);
      }
      cList.push(item);

      if (item.m) {
        withMeanings.push(item);
      }
    }

    store = {
      exactMap,
      normMap,
      cognateMap,
      allEntries: rawList,
      withMeanings,
    };
  }
  return store;
}

// Filter helper
function matchesCategory(entry: ThaiNameRawEntry, category?: ThaiNameFilterOptions['category']): boolean {
  if (!category || category === 'all') return true;
  if (category === 'meaning') return !!entry.m;
  if (category === 'first_name') {
    return entry.c.includes('male') || entry.c.includes('female') || entry.c.includes('first_name');
  }
  return entry.c.includes(category);
}

/**
 * Searches Thai names with deterministic ranking:
 * 1. Exact matches
 * 2. Prefix matches (closest length first)
 * 3. Substring / contains matches
 * 4. Closely related spellings (same diacritic-free skeleton or cognate consonant skeleton or edit distance = 1)
 * 5. Similar names (edit distance = 2)
 */
export function searchThaiNames(
  query: string,
  options: ThaiNameFilterOptions = {}
): ThaiNameSearchResult[] {
  const q = query.trim();
  const limit = options.limit ?? 50;
  const categoryFilter = options.category ?? 'all';
  const { exactMap, normMap, cognateMap, allEntries } = getStore();

  if (!q) {
    // If empty query, return initial slice matching category (with preference for entries with meanings)
    const initialPool = categoryFilter === 'meaning' ? getStore().withMeanings : allEntries;
    return initialPool
      .filter((e) => matchesCategory(e, categoryFilter))
      .slice(0, limit)
      .map((e) => ({
        name: e.n,
        matchType: 'exact',
        categories: e.c,
        sources: e.s,
        meaning: e.m,
        score: 0,
      }));
  }

  const seen = new Set<string>();
  const exactResults: ThaiNameSearchResult[] = [];
  const prefixResults: ThaiNameSearchResult[] = [];
  const containsResults: ThaiNameSearchResult[] = [];
  const closelyRelatedResults: ThaiNameSearchResult[] = [];
  const similarResults: ThaiNameSearchResult[] = [];

  const qNorm = stripThaiDiacritics(q);
  const qCognate = toThaiCognateSkeleton(q);

  // 1. Exact Match Check
  const exactItem = exactMap.get(q);
  if (exactItem && matchesCategory(exactItem, categoryFilter)) {
    exactResults.push({
      name: exactItem.n,
      matchType: 'exact',
      categories: exactItem.c,
      sources: exactItem.s,
      meaning: exactItem.m,
      score: 100,
    });
    seen.add(exactItem.n);
  }

  // 2. Iterate through all items for prefix, contains, and edit distance
  for (let i = 0; i < allEntries.length; i++) {
    const item = allEntries[i];
    const name = item.n;
    if (seen.has(name)) continue;
    if (!matchesCategory(item, categoryFilter)) continue;

    // 2a. Prefix matches
    if (name.startsWith(q)) {
      const lenDiff = name.length - q.length;
      prefixResults.push({
        name,
        matchType: 'prefix',
        categories: item.c,
        sources: item.s,
        meaning: item.m,
        score: Math.max(70, 90 - lenDiff),
      });
      seen.add(name);
      continue;
    }

    // 2b. Substring matches
    if (name.includes(q)) {
      const pos = name.indexOf(q);
      containsResults.push({
        name,
        matchType: 'contains',
        categories: item.c,
        sources: item.s,
        meaning: item.m,
        score: Math.max(50, 70 - pos * 2),
      });
      seen.add(name);
      continue;
    }
  }

  // 3. Closely related spellings from normalized diacritic-free skeleton
  const normCandidates = normMap.get(qNorm) || [];
  for (const item of normCandidates) {
    if (!seen.has(item.n) && matchesCategory(item, categoryFilter)) {
      closelyRelatedResults.push({
        name: item.n,
        matchType: 'closely_related',
        categories: item.c,
        sources: item.s,
        meaning: item.m,
        score: 55,
      });
      seen.add(item.n);
    }
  }

  // 4. Closely related spellings from cognate consonant skeleton
  const cognateCandidates = cognateMap.get(qCognate) || [];
  for (const item of cognateCandidates) {
    if (!seen.has(item.n) && matchesCategory(item, categoryFilter)) {
      closelyRelatedResults.push({
        name: item.n,
        matchType: 'closely_related',
        categories: item.c,
        sources: item.s,
        meaning: item.m,
        score: 50,
      });
      seen.add(item.n);
    }
  }

  // 5. Character-level Levenshtein similarity (edit distance = 1 -> closely_related, edit distance = 2 -> similar)
  // Only evaluate candidates within reasonable length window to maintain fast execution
  if (closelyRelatedResults.length + similarResults.length < limit) {
    const qLen = q.length;
    for (let i = 0; i < allEntries.length; i++) {
      const item = allEntries[i];
      const name = item.n;
      if (seen.has(name)) continue;
      if (!matchesCategory(item, categoryFilter)) continue;

      const lenDiff = Math.abs(name.length - qLen);
      if (lenDiff > 2) continue;

      const dist = levenshteinDistance(q, name, 2);
      if (dist === 1) {
        closelyRelatedResults.push({
          name,
          matchType: 'closely_related',
          categories: item.c,
          sources: item.s,
          meaning: item.m,
          score: 45,
        });
        seen.add(name);
      } else if (dist === 2 && qLen >= 3) {
        similarResults.push({
          name,
          matchType: 'similar',
          categories: item.c,
          sources: item.s,
          meaning: item.m,
          score: 30,
        });
        seen.add(name);
      }
    }
  }

  // Sort within buckets using Thai locale collation
  const thCollator = new Intl.Collator('th-TH');
  prefixResults.sort((a, b) => b.score - a.score || a.name.length - b.name.length || thCollator.compare(a.name, b.name));
  containsResults.sort((a, b) => b.score - a.score || a.name.length - b.name.length || thCollator.compare(a.name, b.name));
  closelyRelatedResults.sort((a, b) => b.score - a.score || thCollator.compare(a.name, b.name));
  similarResults.sort((a, b) => b.score - a.score || thCollator.compare(a.name, b.name));

  return [
    ...exactResults,
    ...prefixResults,
    ...containsResults,
    ...closelyRelatedResults,
    ...similarResults,
  ].slice(0, limit);
}

export function getThaiNameDatasetMetadata() {
  return thaiNamesDataset;
}
