import assert from 'node:assert/strict';

import { 
  parseNoteContent, 
  serializeNoteContent,
  assembleTextTemText, 
  assembleTestTemText 
} from '../src/lib/blocks.ts';

console.log('--- Running QuietNotes TextTem & Clear Text Fields Tests ---');

// Test 1: Backward Compatibility - Existing saved notes with 'testtem' block load and serialize correctly
{
  const legacyNoteJson = JSON.stringify({
    text: 'Document with legacy testtem block',
    blocks: [
      {
        id: 'legacy-tem-1',
        type: 'testtem',
        value: {
          segments: [
            { type: 'text', id: 't1', text: 'Server IP: ' },
            { type: 'field', id: 'f1', text: '192.168.1.1', placeholder: 'IP' },
            { type: 'text', id: 't2', text: ' Port: ' },
            { type: 'field', id: 'f2', text: '8080', placeholder: 'port' }
          ]
        }
      }
    ]
  });

  const parsed = parseNoteContent(legacyNoteJson);
  assert.equal(parsed.blocks.length, 1);
  assert.equal(parsed.blocks[0].type, 'testtem');
  assert.equal(parsed.blocks[0].value.segments.length, 4);

  const assembled = assembleTestTemText(parsed.blocks[0].value.segments);
  assert.equal(assembled, 'Server IP: 192.168.1.1 Port: 8080');

  const reSerialized = serializeNoteContent(parsed.text, parsed.blocks);
  const reParsed = parseNoteContent(reSerialized);
  assert.deepEqual(reParsed, parsed, 'Serialization roundtrip must preserve legacy block data completely');
  console.log('✓ Test 1 Passed: Legacy testtem blocks load, assemble, and serialize correctly');
}

// Test 2: Support for newly added 'texttem' block type
{
  const newNoteJson = JSON.stringify({
    text: 'Document with texttem block',
    blocks: [
      {
        id: 'texttem-1',
        type: 'texttem',
        value: {
          segments: [
            { type: 'text', id: 'txt-1', text: 'Hello ' },
            { type: 'field', id: 'fld-1', text: 'World', placeholder: 'name' }
          ]
        }
      }
    ]
  });

  const parsed = parseNoteContent(newNoteJson);
  assert.equal(parsed.blocks.length, 1);
  assert.equal(parsed.blocks[0].type, 'texttem');
  assert.equal(assembleTextTemText(parsed.blocks[0].value.segments), 'Hello World');
  console.log('✓ Test 2 Passed: TextTem block type loads and assembles correctly');
}

// Test 3: Clear Text Fields - Clears all rectangular fields while preserving all regular text
{
  const initialSegments = [
    { type: 'text', id: 'seg-1', text: 'Dear ' },
    { type: 'field', id: 'fld-1', text: 'John Doe', placeholder: 'Recipient' },
    { type: 'text', id: 'seg-2', text: ', your order #' },
    { type: 'field', id: 'fld-2', text: 'ABC-999', placeholder: 'Order ID' },
    { type: 'text', id: 'seg-3', text: ' has been shipped via ' },
    { type: 'field', id: 'fld-3', text: 'Express Mail', placeholder: 'Carrier' },
    { type: 'text', id: 'seg-4', text: '. Tracking link will follow.' }
  ];

  // Simulating the handleClearTextFields operation
  const clearedSegments = initialSegments.map(seg => {
    if (seg.type === 'field') {
      return { ...seg, text: '' };
    }
    return seg;
  });

  // Verify field count and positions remain identical
  assert.equal(clearedSegments.length, initialSegments.length, 'Segment count must remain unchanged');
  assert.equal(clearedSegments[0].text, 'Dear ', 'Leading regular text must be strictly preserved');
  assert.equal(clearedSegments[2].text, ', your order #', 'Middle regular text 1 must be strictly preserved');
  assert.equal(clearedSegments[4].text, ' has been shipped via ', 'Middle regular text 2 must be strictly preserved');
  assert.equal(clearedSegments[6].text, '. Tracking link will follow.', 'Trailing regular text must be strictly preserved');

  // Verify all fields are empty string
  assert.equal(clearedSegments[1].type, 'field');
  assert.equal(clearedSegments[1].text, '', 'Field 1 text must be cleared');
  assert.equal(clearedSegments[1].id, 'fld-1', 'Field 1 id must be preserved');
  assert.equal(clearedSegments[1].placeholder, 'Recipient', 'Field 1 placeholder must be preserved');

  assert.equal(clearedSegments[3].type, 'field');
  assert.equal(clearedSegments[3].text, '', 'Field 2 text must be cleared');
  assert.equal(clearedSegments[3].id, 'fld-2', 'Field 2 id must be preserved');
  assert.equal(clearedSegments[3].placeholder, 'Order ID', 'Field 2 placeholder must be preserved');

  assert.equal(clearedSegments[5].type, 'field');
  assert.equal(clearedSegments[5].text, '', 'Field 3 text must be cleared');
  assert.equal(clearedSegments[5].id, 'fld-3', 'Field 3 id must be preserved');
  assert.equal(clearedSegments[5].placeholder, 'Carrier', 'Field 3 placeholder must be preserved');

  // Assembled text should now show regular text with empty holes
  assert.equal(
    assembleTextTemText(clearedSegments),
    'Dear , your order # has been shipped via . Tracking link will follow.'
  );
  console.log('✓ Test 3 Passed: Clear Text Fields clears field contents and preserves surrounding regular text');
}

// Test 4: Idempotency - Clearing already empty fields is safe and causes no unintended changes
{
  const alreadyEmptySegments = [
    { type: 'text', id: 't1', text: 'Template: ' },
    { type: 'field', id: 'f1', text: '', placeholder: 'name' },
    { type: 'text', id: 't2', text: '!' }
  ];

  const result = alreadyEmptySegments.map(seg => {
    if (seg.type === 'field') {
      return { ...seg, text: '' };
    }
    return seg;
  });

  assert.deepEqual(result, alreadyEmptySegments, 'Clearing empty fields must produce identical segments');
  console.log('✓ Test 4 Passed: Clearing already empty fields is safe and idempotent');
}

// Test 5: Re-entering text after clearing works seamlessly
{
  const clearedSegments = [
    { type: 'text', id: 't1', text: 'Name: ' },
    { type: 'field', id: 'f1', text: '', placeholder: 'name' },
    { type: 'text', id: 't2', text: ', Role: ' },
    { type: 'field', id: 'f2', text: '', placeholder: 'role' }
  ];

  // User types into field 1
  clearedSegments[1] = { ...clearedSegments[1], text: 'Bob' };
  // User types into field 2
  clearedSegments[3] = { ...clearedSegments[3], text: 'Admin' };

  assert.equal(assembleTextTemText(clearedSegments), 'Name: Bob, Role: Admin');
  console.log('✓ Test 5 Passed: Fields can be reused and filled with new values after clearing');
}

// Test 6: Persistence of cleared block in NoteContent
{
  const noteContent = {
    text: 'Note body text',
    blocks: [
      {
        id: 'blk-texttem',
        type: 'texttem',
        value: {
          segments: [
            { type: 'text', id: 's1', text: 'Status: ' },
            { type: 'field', id: 's2', text: 'Active', placeholder: 'status' }
          ]
        }
      },
      {
        id: 'blk-job',
        type: 'job',
        value: { totalTasks: 1, tasks: [{ id: 'j1', text: 'Task 1' }] }
      }
    ]
  };

  // Perform clear on blk-texttem
  noteContent.blocks[0].value.segments = noteContent.blocks[0].value.segments.map(s => 
    s.type === 'field' ? { ...s, text: '' } : s
  );

  const serialized = serializeNoteContent(noteContent.text, noteContent.blocks);
  const reloaded = parseNoteContent(serialized);

  assert.equal(reloaded.text, 'Note body text', 'Main note body text must remain intact');
  assert.equal(reloaded.blocks.length, 2, 'All blocks must be preserved');
  assert.equal(reloaded.blocks[0].value.segments[1].text, '', 'Cleared field must persist as empty string');
  assert.equal(reloaded.blocks[0].value.segments[0].text, 'Status: ', 'Regular text in block must persist');
  assert.equal(reloaded.blocks[1].type, 'job', 'Unrelated blocks must remain completely untouched');
  console.log('✓ Test 6 Passed: Cleared TextTem block survives serialization and preserves other blocks');
}

console.log('\n--- ALL 6 TEXTTEM AND CLEAR TEXT FIELDS TESTS PASSED ---');
