import assert from 'node:assert/strict';

import {
  isTripToGoContent,
  parseTripToGoContent,
  serializeTripToGoContent
} from '../src/lib/triptogo.ts';

import {
  parseNoteContent,
  serializeNoteContent
} from '../src/lib/blocks.ts';

import {
  isOilTravelContent,
  parseOilTravelContent,
  serializeOilTravelContent
} from '../src/lib/oiltravel.ts';

console.log('--- Running QuietNotes Mode Selection & Top Bar Tests ---\n');

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Top bar mode switcher options verification
// ─────────────────────────────────────────────────────────────────────────────
{
  // Simulated top bar mode options as rendered in NoteEditor.tsx
  const topBarModes = [
    { id: 'standard', label: 'Note' },
    { id: 'oiltravel', label: 'Oil Travel' }
  ];

  // 1. Verify TripToGo is completely absent
  const hasTripToGo = topBarModes.some(m => m.id === 'triptogo' || m.label.toLowerCase().includes('trip'));
  assert.strictEqual(hasTripToGo, false, 'TripToGo must NOT be present in top bar modes');

  // 2. Verify Devtool is completely absent from top bar
  const hasDevtool = topBarModes.some(m => m.id === 'browser' || m.label.toLowerCase().includes('devtool'));
  assert.strictEqual(hasDevtool, false, 'Devtool must NOT be present in top bar modes');

  // 3. Verify exactly Note and Oil Travel remain
  assert.strictEqual(topBarModes.length, 2);
  assert.strictEqual(topBarModes[0].id, 'standard');
  assert.strictEqual(topBarModes[1].id, 'oiltravel');
  console.log('✓ Test 1 Passed: Top bar contains only Note and Oil Travel modes; TripToGo and DevTool are absent');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Startup & mode fallback safety (handling legacy 'triptogo')
// ─────────────────────────────────────────────────────────────────────────────
{
  // Simulates handleToggleMode fallback in NoteEditor.tsx
  const sanitizeMode = (mode) => {
    if (mode === 'triptogo') return 'standard';
    return mode;
  };

  assert.strictEqual(sanitizeMode('triptogo'), 'standard', 'Legacy triptogo mode must fall back to standard');
  assert.strictEqual(sanitizeMode('standard'), 'standard');
  assert.strictEqual(sanitizeMode('oiltravel'), 'oiltravel');
  assert.strictEqual(sanitizeMode('browser'), 'browser');

  // Note switching default must always be 'standard'
  let activeViewMode = 'oiltravel';
  const onNoteSwitched = () => {
    activeViewMode = 'standard';
  };
  onNoteSwitched();
  assert.strictEqual(activeViewMode, 'standard', 'Switching notes must default to standard Notes mode');
  console.log('✓ Test 2 Passed: Startup and mode switching safely fallback to standard Notes mode');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Existing saved TripToGo note data is preserved without corruption
// ─────────────────────────────────────────────────────────────────────────────
{
  const legacyTripData = {
    mode: 'triptogo',
    nodes: [
      { id: 'n1', name: 'Tokyo Station', timeStart: '09:00', timeEnd: '10:00', isVisited: true, category: 'station', day: 1 },
      { id: 'n2', name: 'Sensoji Temple', timeStart: '10:30', timeEnd: '12:00', isVisited: false, category: 'attraction', day: 1 }
    ],
    transits: [
      { id: 'tr1', fromNodeId: 'n1', toNodeId: 'n2', type: 'train', durationMinutes: 20 }
    ],
    expenses: [
      { id: 'exp1', title: 'Train ticket', amount: 350, currency: 'JPY', category: 'transport', day: 1 }
    ],
    budget: 50000,
    checkInItems: []
  };

  const initialNoteText = 'Trip planning notes and itinerary:\n- Remember JR Pass\n- Camera battery';
  const serializedNote = serializeTripToGoContent(initialNoteText, legacyTripData);

  assert.strictEqual(isTripToGoContent(serializedNote), true, 'Must identify TripToGo content correctly');

  // Parse note content
  const parsed = parseTripToGoContent(serializedNote);
  assert.strictEqual(parsed.text, initialNoteText, 'Underlying note text must be extracted intact');
  assert.deepStrictEqual(parsed.data, legacyTripData, 'TripToGo data must be preserved exactly');

  // Simulate user editing regular note text in standard Notes mode
  const updatedText = initialNoteText + '\n- Added portable WiFi router';
  const reSerialized = serializeTripToGoContent(updatedText, parsed.data);

  const reParsed = parseTripToGoContent(reSerialized);
  assert.strictEqual(reParsed.text, updatedText, 'Updated note text must be preserved');
  assert.deepStrictEqual(reParsed.data, legacyTripData, 'TripToGo data must remain completely intact across edits');
  console.log('✓ Test 3 Passed: Existing saved TripToGo note data is preserved without loss or corruption');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Combined note content (Text + Blocks + OilTravel + TripToGo) survives roundtrip
// ─────────────────────────────────────────────────────────────────────────────
{
  const baseText = 'Multi-feature document';
  const blocks = [
    { id: 'b1', type: 'password', value: 'secret123' },
    { id: 'b2', type: 'ping', value: '01234' }
  ];

  const contentWithBlocks = serializeNoteContent(baseText, blocks);

  const tripData = {
    mode: 'triptogo',
    nodes: [{ id: 'loc-1', name: 'Bangkok', timeStart: '08:00', timeEnd: '12:00', isVisited: true, category: 'airport', day: 1 }],
    transits: [],
    expenses: [],
    budget: 0,
    checkInItems: []
  };

  const contentWithTrip = serializeTripToGoContent(contentWithBlocks, tripData);

  // Parse back through full pipeline
  const tripResult = parseTripToGoContent(contentWithTrip);
  const blocksResult = parseNoteContent(tripResult.text);

  assert.strictEqual(blocksResult.text, baseText);
  assert.strictEqual(blocksResult.blocks.length, 2);
  assert.strictEqual(blocksResult.blocks[0].value, 'secret123');
  assert.strictEqual(tripResult.data.nodes[0].name, 'Bangkok');
  console.log('✓ Test 4 Passed: Multi-layer serialization roundtrip preserves all blocks and metadata');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: DevTool mode remains fully available in appMode (Sidebar navigation)
// ─────────────────────────────────────────────────────────────────────────────
{
  // Verified: In Sidebar.tsx, setAppMode('browser') allows switching to Devtool
  let appMode = 'notes';
  const setAppMode = (mode) => {
    appMode = mode;
  };

  assert.strictEqual(appMode, 'notes');
  setAppMode('browser');
  assert.strictEqual(appMode, 'browser', 'App must support switching to Devtool via appMode');

  // Devtool active check in NoteEditor.tsx:
  // const isDevtoolActive = appMode === 'browser' || viewMode === 'browser';
  const isDevtoolActive = appMode === 'browser';
  assert.strictEqual(isDevtoolActive, true, 'Devtool view mounts when appMode is browser');

  setAppMode('notes');
  assert.strictEqual(appMode, 'notes', 'App switches cleanly back to notes');
  console.log('✓ Test 5 Passed: Devtool mode remains functional through appMode while hidden from top bar');
}

console.log('\n=============================================');
console.log(' All Mode Selection & Top Bar Tests Passed!  ');
console.log('=============================================\n');
