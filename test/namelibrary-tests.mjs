import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  searchThaiNames, 
  stripThaiDiacritics, 
  toThaiCognateSkeleton, 
  levenshteinDistance,
  getThaiNameDatasetMetadata 
} from '../src/lib/thai-name-search.ts';
import { 
  parseNoteContent, 
  serializeNoteContent 
} from '../src/lib/blocks.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('--- Running QuietNotes NameLibrary Integration Tests ---');

// Test 1: Dataset file existence, size, and source metadata
console.log('Test 1: Dataset files and licensing metadata verification...');
const dataPath = path.join(projectRoot, 'src', 'data', 'thai-names.json');
const metaPath = path.join(projectRoot, 'src', 'data', 'thai-names-sources.json');

assert(fs.existsSync(dataPath), 'src/data/thai-names.json must exist');
assert(fs.existsSync(metaPath), 'src/data/thai-names-sources.json must exist');

const dataJson = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const metaJson = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

assert.strictEqual(dataJson.totalCount, 21344, 'Total names must be 21,344');
assert.strictEqual(dataJson.sources.length, 2, 'Must have 2 verified sources');
assert.strictEqual(dataJson.sources[0].id, 'corpus', 'Source 1 is corpus');
assert.strictEqual(dataJson.sources[0].license, 'Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)');
assert.strictEqual(dataJson.sources[1].id, 'orst', 'Source 2 is ORST');
assert.strictEqual(dataJson.sources[1].license, 'Open Data Common');
console.log('✓ Test 1 Passed: Dataset verified with 21,344 names and verified licenses');

// Test 2: Exact Thai spelling match
console.log('Test 2: Exact Thai spelling match test...');
const exactMatches = searchThaiNames('นภัส');
assert(exactMatches.length > 0, 'Must return results for นภัส');
assert.strictEqual(exactMatches[0].name, 'นภัส', 'First result must be exact match นภัส');
assert.strictEqual(exactMatches[0].matchType, 'exact', 'Match type must be exact');
assert(exactMatches[0].categories.includes('male') || exactMatches[0].categories.includes('female'), 'Must have gender categories');
console.log('✓ Test 2 Passed: Exact match correctly found and prioritized');

// Test 3: Prefix and substring / contains ranking
console.log('Test 3: Prefix and contains matches ranking...');
const prefixMatches = exactMatches.filter(r => r.matchType === 'prefix');
const containsMatches = exactMatches.filter(r => r.matchType === 'contains');
assert(prefixMatches.length > 0, 'Must have prefix matches starting with นภัส');
for (const p of prefixMatches) {
  assert(p.name.startsWith('นภัส'), `Prefix match ${p.name} must start with นภัส`);
}
assert(containsMatches.length > 0, 'Must have contains matches containing นภัส');
for (const c of containsMatches) {
  assert(c.name.includes('นภัส'), `Contains match ${c.name} must contain นภัส`);
}
console.log('✓ Test 3 Passed: Prefix and contains matches correctly identified');

// Test 4: Closely related spelling variants (cognate/diacritic similarity)
console.log('Test 4: Spelling variants & cognate matching...');
// "นพัส" uses พ instead of ภ -> Should find "นภัส" as closely_related
const variantMatches = searchThaiNames('นพัส');
const foundNaPhat = variantMatches.find(r => r.name === 'นภัส');
assert(foundNaPhat !== undefined, 'Must find นภัส when searching cognate variant นพัส');
assert(foundNaPhat.matchType === 'closely_related' || foundNaPhat.matchType === 'similar', 'Must be labeled as closely_related or similar');
console.log('✓ Test 4 Passed: Closely related spelling candidate found without mislabeling as verified variant');

// Test 5: Meaning preservation from Royal Society dataset
console.log('Test 5: Name meaning preservation (ORST)...');
const kanokMatches = searchThaiNames('กนกภรณ์');
assert(kanokMatches.length > 0, 'Must find กนกภรณ์');
const kanok = kanokMatches[0];
assert.strictEqual(kanok.name, 'กนกภรณ์');
assert(kanok.meaning && kanok.meaning.includes('แปลว่า ดูแลรักษาทองคำ'), 'Must preserve meaning: ดูแลรักษาทองคำ');
assert(kanok.sources.includes('orst'), 'Must cite orst as source');
console.log('✓ Test 5 Passed: Official meaning and source provenance preserved');

// Test 6: Category filtering (male, female, surname, meaning)
console.log('Test 6: Category filtering...');
const maleOnly = searchThaiNames('ก', { category: 'male', limit: 20 });
for (const m of maleOnly) {
  assert(m.categories.includes('male'), `Male search result ${m.name} must have male category`);
}
const surnameOnly = searchThaiNames('ก', { category: 'surname', limit: 20 });
for (const s of surnameOnly) {
  assert(s.categories.includes('surname'), `Surname search result ${s.name} must have surname category`);
}
const meaningOnly = searchThaiNames('ก', { category: 'meaning', limit: 20 });
for (const m of meaningOnly) {
  assert(m.meaning !== undefined && m.meaning.length > 0, `Meaning result ${m.name} must have meaning`);
}
console.log('✓ Test 6 Passed: Filtering by male, surname, and meaning works accurately');

// Test 7: Empty state and no-match handling
console.log('Test 7: Empty state and no-match handling...');
const emptyQuery = searchThaiNames('');
assert(emptyQuery.length > 0, 'Empty query should return default initial pool');
const noMatch = searchThaiNames('xyz999ไม่พบแน่นอน123');
assert.strictEqual(noMatch.length, 0, 'Unrelated nonsense query must return empty array, not spurious suggestions');
console.log('✓ Test 7 Passed: Non-matches return clean empty results without hallucinated suggestions');

// Test 8: Note serialization and coexistence with existing blocks
console.log('Test 8: Serialization and persistence of NameLibrary block...');
const noteWithBlocks = serializeNoteContent('สวัสดีครับ จดโน้ต', [
  { id: 'b1', type: 'text', value: 'First text block' },
  { id: 'b2', type: 'namelibrary', value: { query: 'นภัส', category: 'female' } },
  { id: 'b3', type: 'job', value: { totalTasks: 1, tasks: [{ id: 't1', text: 'Subtask 1' }] } },
  { id: 'b4', type: 'texttem', value: { segments: [{ type: 'text', id: 's1', text: 'Template test' }] } }
]);

const parsed = parseNoteContent(noteWithBlocks);
assert.strictEqual(parsed.text, 'สวัสดีครับ จดโน้ต');
assert.strictEqual(parsed.blocks.length, 4);

const nameBlock = parsed.blocks.find(b => b.type === 'namelibrary');
assert(nameBlock !== undefined, 'namelibrary block must be parsed');
assert.strictEqual(nameBlock.id, 'b2');
assert.deepStrictEqual(nameBlock.value, { query: 'นภัส', category: 'female' });

// Ensure other blocks untouched
assert.strictEqual(parsed.blocks.find(b => b.type === 'job')?.id, 'b3');
assert.strictEqual(parsed.blocks.find(b => b.type === 'texttem')?.id, 'b4');
console.log('✓ Test 8 Passed: NameLibrary block persists and coexists with other blocks cleanly');

console.log('\n--- ALL 8 NAMELIBRARY TESTS PASSED ---');
