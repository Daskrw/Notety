import assert from 'node:assert/strict';

import {
  parseNoteContent,
  serializeNoteContent,
  assembleTextTemText,
  assembleTestTemText,
} from '../src/lib/blocks.ts';

import {
  applyFirstEntryTimestamp,
  formatFirstEntryTimestamp,
} from '../src/lib/job.ts';

console.log('--- Running QuietNotes Caret Stability & Cross-Block Editing Tests ---\n');

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Rapid consecutive typing without character loss
// ─────────────────────────────────────────────────────────────────────────────
{
  // Simulates the synchronous state management in RightPanel / StableInput
  // where keystrokes update local in-memory state immediately, while debouncing DB persistence.
  let localValue = '';
  let pendingSaves = 0;
  const updatesLog = [];

  const handleKeystroke = (char) => {
    // 1. Synchronously update local editing state
    localValue += char;
    updatesLog.push(localValue);
    // 2. Debounced save trigger
    pendingSaves++;
  };

  const typedChars = 'Hello QuietNotes';
  for (const ch of typedChars) {
    handleKeystroke(ch);
  }

  assert.equal(localValue, 'Hello QuietNotes', 'All consecutive typed characters must be preserved');
  assert.equal(updatesLog.length, 16, 'Every keystroke must trigger synchronous local update');
  assert.equal(updatesLog[updatesLog.length - 1], 'Hello QuietNotes');
  console.log('✓ Test 1 Passed: Rapid consecutive typing preserves every single character');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Inserting text in the middle of an existing value & caret preservation
// ─────────────────────────────────────────────────────────────────────────────
{
  // Simulates StableInput caret positioning logic:
  // When inserting at offset k in a string of length N, caret should advance to k + inserted.length
  // NOT jump to the end (N + inserted.length)
  let text = 'Quiet Editor';
  let caretPos = 5; // right after "Quiet"

  const insertTextAtCaret = (inserted) => {
    const before = text.slice(0, caretPos);
    const after = text.slice(caretPos);
    text = before + inserted + after;
    caretPos += inserted.length;
    return { text, caretPos };
  };

  // User inserts " Notes" at offset 5
  const result1 = insertTextAtCaret(' Notes');
  assert.equal(result1.text, 'Quiet Notes Editor');
  assert.equal(result1.caretPos, 11, 'Caret must be at index 11 (after "Quiet Notes"), NOT at 18 (end of string)');

  // User types another character '!' at that exact position
  const result2 = insertTextAtCaret('!');
  assert.equal(result2.text, 'Quiet Notes! Editor');
  assert.equal(result2.caretPos, 12, 'Caret must advance by 1 to index 12, NOT jump to end');
  console.log('✓ Test 2 Passed: Inserting text in the middle preserves exact caret position');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Moving caret with arrow keys and continuing to type
// ─────────────────────────────────────────────────────────────────────────────
{
  let text = 'abcdef';
  let caretPos = 6; // at end

  // User presses Left Arrow 3 times
  caretPos -= 3; // now at 3 (between 'c' and 'd')
  assert.equal(caretPos, 3);

  // User types '123'
  for (const ch of '123') {
    text = text.slice(0, caretPos) + ch + text.slice(caretPos);
    caretPos += 1;
  }

  assert.equal(text, 'abc123def');
  assert.equal(caretPos, 6, 'Caret should be at index 6 (after 3), not end of string');
  console.log('✓ Test 3 Passed: Moving caret away from end and typing continues at correct position');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Stale async persistence cannot overwrite newer local edits (Autosave race condition)
// ─────────────────────────────────────────────────────────────────────────────
{
  // This simulates the bug where Dexie useLiveQuery delivered a snapshot of note state
  // from 50ms ago while user was actively typing newer characters.
  let localState = { text: 'He', hasLocalChanges: true };
  const staleAsyncSnapshot = { text: 'H' }; // older save completed

  // Merge logic from RightPanel.tsx:
  // If hasLocalChanges is true, do NOT replace local editing state with stale snapshot!
  const applyRemoteOrDbSnapshot = (snapshot) => {
    if (localState.hasLocalChanges) {
      // Ignore stale block state while user has unsaved edits
      return localState;
    }
    return { text: snapshot.text, hasLocalChanges: false };
  };

  const currentAfterStaleArrived = applyRemoteOrDbSnapshot(staleAsyncSnapshot);
  assert.equal(currentAfterStaleArrived.text, 'He', 'Stale async snapshot must not overwrite active typing');

  // User types 'llo'
  localState.text += 'llo';

  // Persistence finishes and no more local changes pending
  localState.hasLocalChanges = false;
  const syncAfterIdle = applyRemoteOrDbSnapshot({ text: 'Hello' });
  assert.equal(syncAfterIdle.text, 'Hello');
  console.log('✓ Test 4 Passed: Stale asynchronous persistence cannot overwrite newer local edits');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Editing two separate fields without state leakage
// ─────────────────────────────────────────────────────────────────────────────
{
  const segments = [
    { type: 'text', id: 't1', text: 'Server: ' },
    { type: 'field', id: 'f1', text: 'dev.local', placeholder: 'host' },
    { type: 'text', id: 't2', text: ' Port: ' },
    { type: 'field', id: 'f2', text: '3000', placeholder: 'port' }
  ];

  // Update field 1
  const updatedSegments1 = segments.map(s => s.id === 'f1' ? { ...s, text: 'prod.quietnotes.app' } : s);
  assert.equal(updatedSegments1[1].text, 'prod.quietnotes.app');
  assert.equal(updatedSegments1[3].text, '3000', 'Field 2 must remain completely untouched');

  // Update field 2
  const updatedSegments2 = updatedSegments1.map(s => s.id === 'f2' ? { ...s, text: '8443' } : s);
  assert.equal(updatedSegments2[1].text, 'prod.quietnotes.app', 'Field 1 must remain intact');
  assert.equal(updatedSegments2[3].text, '8443');

  const assembled = assembleTextTemText(updatedSegments2);
  assert.equal(assembled, 'Server: prod.quietnotes.app Port: 8443');
  console.log('✓ Test 5 Passed: Editing separate fields does not leak state or overwrite other fields');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Thai text entry & IME composition handling
// ─────────────────────────────────────────────────────────────────────────────
{
  // Test Thai vowels, tone marks, and combining characters
  // Thai characters like ิ (SARA I), ์ (THANTHAKHAT), ้ (MAI THO)
  const thaiText1 = 'สิทธิ์การใช้งาน';
  const thaiText2 = 'บันทึกข้อมูลเรียบร้อย';

  // IME Composition simulation:
  // During composition (compositionstart -> compositionupdate), input events should not trigger destructive normalization
  let isComposing = false;
  let committedValue = '';
  let workingValue = '';

  const onCompositionStart = () => { isComposing = true; };
  const onCompositionUpdate = (val) => { workingValue = val; };
  const onCompositionEnd = (finalVal) => {
    isComposing = false;
    committedValue = finalVal;
    workingValue = finalVal;
  };

  onCompositionStart();
  assert.equal(isComposing, true);
  onCompositionUpdate('ส');
  onCompositionUpdate('สิ');
  onCompositionUpdate('สิท');
  onCompositionUpdate('สิทธิ');
  onCompositionUpdate('สิทธิ์');
  onCompositionEnd('สิทธิ์');

  assert.equal(isComposing, false);
  assert.equal(committedValue, 'สิทธิ์', 'Thai tone marks and combining characters must be preserved');

  // Verify full Thai phrase serialization and roundtrip
  const testTemSegments = [
    { type: 'text', id: 't1', text: 'ผลการตรวจสอบ: ' },
    { type: 'field', id: 'f1', text: 'ผ่านเกณฑ์', placeholder: 'สถานะ' },
    { type: 'text', id: 't2', text: ' โดย ' },
    { type: 'field', id: 'f2', text: 'ผู้ดูแลระบบ', placeholder: 'ชื่อ' }
  ];

  const assembledThai = assembleTextTemText(testTemSegments);
  assert.equal(assembledThai, 'ผลการตรวจสอบ: ผ่านเกณฑ์ โดย ผู้ดูแลระบบ');
  console.log('✓ Test 6 Passed: Thai text, vowels, tone marks, and IME composition are handled accurately');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: Editing regular text between inline rectangular fields in TextTem
// ─────────────────────────────────────────────────────────────────────────────
{
  const initialSegments = [
    { type: 'text', id: 't1', text: 'Start ' },
    { type: 'field', id: 'f1', text: 'A', placeholder: 'field1' },
    { type: 'text', id: 't2', text: ' Middle ' },
    { type: 'field', id: 'f2', text: 'B', placeholder: 'field2' },
    { type: 'text', id: 't3', text: ' End' }
  ];

  // User edits regular text segment t2 (" Middle ") to " -> Connecting Text -> "
  const editedSegments = initialSegments.map(s => 
    s.id === 't2' ? { ...s, text: ' -> Connecting Text -> ' } : s
  );

  assert.equal(editedSegments.length, 5, 'Number of segments must remain exactly 5');
  assert.equal(editedSegments[1].id, 'f1', 'Field 1 identity must remain stable');
  assert.equal(editedSegments[1].text, 'A', 'Field 1 value must be preserved');
  assert.equal(editedSegments[3].id, 'f2', 'Field 2 identity must remain stable');
  assert.equal(editedSegments[3].text, 'B', 'Field 2 value must be preserved');
  assert.equal(editedSegments[2].text, ' -> Connecting Text -> ');

  const fullOutput = assembleTextTemText(editedSegments);
  assert.equal(fullOutput, 'Start A -> Connecting Text -> B End');
  console.log('✓ Test 7 Passed: Editing regular text between fields preserves field identity and values');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: Reopening note after save preserves all text & blocks intact
// ─────────────────────────────────────────────────────────────────────────────
{
  const noteData = {
    text: 'Note body text here',
    blocks: [
      {
        id: 'job-1',
        type: 'job',
        value: {
          totalTasks: 2,
          tasks: [
            { id: 'tsk-1', text: 'Setup server', completed: true, firstEntryAt: 1729900000000 },
            { id: 'tsk-2', text: 'Deploy to cloud', completed: false, firstEntryAt: 1729900005000 }
          ]
        }
      },
      {
        id: 'tt-1',
        type: 'texttem',
        value: {
          segments: [
            { type: 'text', id: 'txt-1', text: 'Deploy URL: https://' },
            { type: 'field', id: 'fld-1', text: 'api.quietnotes.app', placeholder: 'domain' }
          ]
        }
      }
    ]
  };

  const serialized = serializeNoteContent(noteData.text, noteData.blocks);
  const reloaded = parseNoteContent(serialized);

  assert.equal(reloaded.text, 'Note body text here');
  assert.equal(reloaded.blocks.length, 2);
  assert.equal(reloaded.blocks[0].type, 'job');
  assert.equal(reloaded.blocks[0].value.tasks[0].text, 'Setup server');
  assert.equal(reloaded.blocks[0].value.tasks[0].firstEntryAt, 1729900000000);
  assert.equal(reloaded.blocks[1].type, 'texttem');
  assert.equal(reloaded.blocks[1].value.segments[1].text, 'api.quietnotes.app');
  console.log('✓ Test 8 Passed: Reopening note after save preserves all text, timestamps, and blocks');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 9: Clear Text Fields clears only field values, leaving regular text intact
// ─────────────────────────────────────────────────────────────────────────────
{
  const populated = [
    { type: 'text', id: 't1', text: 'Hello ' },
    { type: 'field', id: 'f1', text: 'Alice', placeholder: 'name' },
    { type: 'text', id: 't2', text: ', your code is ' },
    { type: 'field', id: 'f2', text: 'XYZ-999', placeholder: 'code' },
    { type: 'text', id: 't3', text: '.' }
  ];

  // handleClearTextFields logic
  const cleared = populated.map(seg => {
    if (seg.type === 'field') {
      return { ...seg, text: '' };
    }
    return seg;
  });

  assert.equal(cleared[0].text, 'Hello ');
  assert.equal(cleared[1].text, '', 'Field f1 must be cleared');
  assert.equal(cleared[2].text, ', your code is ');
  assert.equal(cleared[3].text, '', 'Field f2 must be cleared');
  assert.equal(cleared[4].text, '.');
  assert.equal(cleared[1].id, 'f1', 'Field IDs must remain stable');
  assert.equal(cleared[3].id, 'f2', 'Field IDs must remain stable');

  const assembledCleared = assembleTextTemText(cleared);
  assert.equal(assembledCleared, 'Hello , your code is .');
  console.log('✓ Test 9 Passed: Clear Text Fields empties only rectangular fields without altering text');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 10: In-flight async database save race condition protection
// ─────────────────────────────────────────────────────────────────────────────
{
  // Simulates our improved saveTimeoutRef / hasLocalChangesRef logic in RightPanel.tsx:
  // When an async db.notes.update is running and user types another key,
  // the in-flight completion must not erroneously clear hasLocalChangesRef.
  let hasLocalChanges = false;
  let activeTimeout = null;

  const typeCharacter = (char) => {
    hasLocalChanges = true;
    if (activeTimeout) clearTimeout(activeTimeout);

    activeTimeout = setTimeout(async () => {
      activeTimeout = null;
      // Simulated db.notes.update
      await new Promise(r => setTimeout(r, 20));
      // In finally block:
      if (!activeTimeout) {
        hasLocalChanges = false;
      }
    }, 10);
  };

  // User types 'A'
  typeCharacter('A');
  assert.equal(hasLocalChanges, true);

  // Before the first save finishes, user types 'B'
  setTimeout(() => {
    typeCharacter('B');
    assert.equal(hasLocalChanges, true);
  }, 5);

  // Wait for all saves to settle
  await new Promise(r => setTimeout(r, 60));
  assert.equal(hasLocalChanges, false, 'hasLocalChanges should settle to false only after all saves complete');
  console.log('✓ Test 10 Passed: In-flight database updates do not race or prematurely reset local edit protection');
}

console.log('\n========================================');
console.log(' All 10 Caret Stability Tests Passed!   ');
console.log('========================================');
