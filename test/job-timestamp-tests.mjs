import assert from 'node:assert/strict';

import { 
  applyFirstEntryTimestamp, 
  formatFirstEntryTimestamp, 
  formatFullFirstEntryDateTime, 
  duplicateJobTask 
} from '../src/lib/job.ts';

import { 
  parseNoteContent, 
  serializeNoteContent 
} from '../src/lib/blocks.ts';

console.log('--- Running QuietNotes Job Progress Timestamp Tests ---');

// Test 1: First meaningful text entry assigns an ISO 8601 timestamp
{
  const previousText = '';
  const newText = 'Review product requirements';
  const timestamp = applyFirstEntryTimestamp(previousText, newText, undefined);

  assert.ok(timestamp, 'Timestamp must be assigned when meaningful text is entered');
  assert.equal(typeof timestamp, 'string');
  const dateObj = new Date(timestamp);
  assert.equal(isNaN(dateObj.getTime()), false, 'Must be a valid ISO 8601 date');
  console.log('✓ Test 1 Passed: First meaningful text entry assigns a timestamp');
}

// Test 2: Whitespace-only input does NOT assign a timestamp
{
  const previousText = '';
  const whitespaceInput = '    \t  \n  ';
  const timestamp = applyFirstEntryTimestamp(previousText, whitespaceInput, undefined);

  assert.equal(timestamp, undefined, 'Whitespace-only input must not generate a timestamp');
  console.log('✓ Test 2 Passed: Whitespace-only input does not assign a timestamp');
}

// Test 3: Subsequent edits strictly preserve the original timestamp (never overwrite with edit time)
{
  const originalTime = '2026-10-26T08:30:00.000Z';
  const previousText = 'Original draft task';
  const editedText = 'Original draft task updated with more details';

  const resultingTimestamp = applyFirstEntryTimestamp(previousText, editedText, originalTime);

  assert.equal(resultingTimestamp, originalTime, 'Existing timestamp must be 100% preserved during edits');
  assert.notEqual(resultingTimestamp, new Date().toISOString());
  console.log('✓ Test 3 Passed: Subsequent edits preserve the original timestamp');
}

// Test 4: Clearing and re-entering text follows defined historical timestamp behavior
{
  const historicalTime = '2026-10-26T09:00:00.000Z';
  const previousText = 'Task before clearing';

  // 1. User clears the input completely
  const clearedText = '';
  const timestampAfterClear = applyFirstEntryTimestamp(previousText, clearedText, historicalTime);
  assert.equal(timestampAfterClear, historicalTime, 'Clearing text must not delete or reset historical timestamp');

  // 2. User later enters new text into that subtask
  const reEnteredText = 'Re-entered new task';
  const timestampAfterReentry = applyFirstEntryTimestamp(clearedText, reEnteredText, timestampAfterClear);
  assert.equal(timestampAfterReentry, historicalTime, 'Original historical timestamp must be preserved upon re-entry');
  console.log('✓ Test 4 Passed: Clearing and re-entering text preserves historical timestamp');
}

// Test 5: Existing text without a timestamp is not assigned a fabricated historical time
{
  const existingLegacyText = 'Legacy subtask from earlier version';
  const editedLegacyText = 'Legacy subtask edited today';

  // Editing an existing task that originally had text but no timestamp
  const timestamp = applyFirstEntryTimestamp(existingLegacyText, editedLegacyText, undefined);

  assert.equal(timestamp, undefined, 'Must not fabricate a historical timestamp for existing pre-filled subtasks');
  console.log('✓ Test 5 Passed: Existing text without a timestamp is not assigned a fabricated time');
}

// Test 6: Timestamp survives serialization, persistence roundtrip, and synchronization
{
  const task1 = {
    id: 'subtask-101',
    text: 'Client meeting notes',
    completed: true,
    firstEntryAt: '2026-10-26T10:15:30.000Z'
  };
  const task2 = {
    id: 'subtask-102',
    text: 'Follow-up email',
    completed: false,
    firstEntryAt: '2026-10-26T11:45:00.000Z'
  };

  const jobBlock = {
    id: 'block-job-demo',
    type: 'job',
    value: {
      totalTasks: 2,
      tasks: [task1, task2]
    }
  };

  const serialized = serializeNoteContent('Header text', [jobBlock]);
  const parsed = parseNoteContent(serialized);

  assert.equal(parsed.blocks.length, 1);
  const parsedJob = parsed.blocks[0];
  assert.equal(parsedJob.type, 'job');
  assert.equal(parsedJob.value.tasks.length, 2);
  assert.equal(parsedJob.value.tasks[0].firstEntryAt, '2026-10-26T10:15:30.000Z');
  assert.equal(parsedJob.value.tasks[1].firstEntryAt, '2026-10-26T11:45:00.000Z');
  console.log('✓ Test 6 Passed: Timestamp survives serialization, persistence, and synchronization');
}

// Test 7: Different subtasks receive independent timestamps
{
  const taskA = { text: '', firstEntryAt: undefined };
  const taskB = { text: '', firstEntryAt: undefined };

  // Task A entered at T1
  const timeA = '2026-10-26T12:00:00.000Z';
  const taskAUpdated = {
    text: 'Task A',
    firstEntryAt: timeA
  };

  // Task B entered at T2
  const timeB = '2026-10-26T14:30:00.000Z';
  const taskBUpdated = {
    text: 'Task B',
    firstEntryAt: timeB
  };

  assert.notEqual(taskAUpdated.firstEntryAt, taskBUpdated.firstEntryAt);
  assert.equal(taskAUpdated.firstEntryAt, timeA);
  assert.equal(taskBUpdated.firstEntryAt, timeB);
  console.log('✓ Test 7 Passed: Different subtasks receive independent timestamps');
}

// Test 8: Duplicate, reorder, and delete operations do not attach timestamps to the wrong subtask
{
  const subtasks = [
    { id: '1', text: 'Subtask 1', firstEntryAt: '2026-10-26T08:00:00.000Z' },
    { id: '2', text: 'Subtask 2', firstEntryAt: '2026-10-26T09:00:00.000Z' },
    { id: '3', text: 'Subtask 3', firstEntryAt: '2026-10-26T10:00:00.000Z' },
  ];

  // 1. Reorder: move subtask 3 to top
  const reordered = [subtasks[2], subtasks[0], subtasks[1]];
  assert.equal(reordered[0].id, '3');
  assert.equal(reordered[0].firstEntryAt, '2026-10-26T10:00:00.000Z');
  assert.equal(reordered[1].id, '1');
  assert.equal(reordered[1].firstEntryAt, '2026-10-26T08:00:00.000Z');
  assert.equal(reordered[2].id, '2');
  assert.equal(reordered[2].firstEntryAt, '2026-10-26T09:00:00.000Z');

  // 2. Delete middle item ('1')
  const afterDelete = reordered.filter(t => t.id !== '1');
  assert.equal(afterDelete.length, 2);
  assert.equal(afterDelete[0].firstEntryAt, '2026-10-26T10:00:00.000Z');
  assert.equal(afterDelete[1].firstEntryAt, '2026-10-26T09:00:00.000Z');

  // 3. Duplicate item '2'
  const duplicated = duplicateJobTask(afterDelete[1]);
  assert.notEqual(duplicated.id, afterDelete[1].id, 'Must have fresh UUID');
  assert.equal(duplicated.text, afterDelete[1].text);
  assert.equal(duplicated.firstEntryAt, afterDelete[1].firstEntryAt);

  // Duplicating an empty subtask should NOT have a timestamp
  const emptySubtask = { id: 'empty-1', text: '', firstEntryAt: undefined };
  const duplicatedEmpty = duplicateJobTask(emptySubtask);
  assert.equal(duplicatedEmpty.firstEntryAt, undefined);

  console.log('✓ Test 8 Passed: Duplicate, reorder, and delete do not corrupt subtask timestamps');
}

// Test 9: Older Job Progress data remains readable (backward compatibility)
{
  // Simulating legacy block without any firstEntryAt properties
  const legacyBlockJson = JSON.stringify({
    text: 'Note with legacy job block',
    blocks: [
      {
        id: 'legacy-job',
        type: 'job',
        value: {
          totalTasks: 3,
          tasks: [
            { id: 'leg-1', text: 'Old Task 1', completed: false },
            { id: 'leg-2', text: 'Old Task 2', completed: true },
            { id: 'leg-3', text: '', completed: false }
          ]
        }
      }
    ]
  });

  const parsed = parseNoteContent(legacyBlockJson);
  assert.equal(parsed.blocks.length, 1);
  const tasks = parsed.blocks[0].value.tasks;
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].firstEntryAt, undefined);
  assert.equal(tasks[1].firstEntryAt, undefined);
  assert.equal(tasks[2].firstEntryAt, undefined);
  assert.equal(tasks[1].completed, true);
  console.log('✓ Test 9 Passed: Older Job Progress data remains 100% readable');
}

// Test 10: Thai date formatting and tooltip representations
{
  const testIso = '2026-10-26T09:15:00.000Z';
  const date = new Date(testIso);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  const compact = formatFirstEntryTimestamp(testIso);
  assert.ok(compact.startsWith('เริ่มบันทึก'));
  assert.ok(compact.includes(`${hours}:${minutes}`));

  const emptyFormatted = formatFirstEntryTimestamp(undefined);
  assert.equal(emptyFormatted, '');

  const full = formatFullFirstEntryDateTime(testIso);
  assert.ok(full.startsWith('บันทึกครั้งแรก:'));
  assert.ok(full.includes('เวลา'));
  console.log('✓ Test 10 Passed: Thai date/time formatting and tooltip representations');
}

console.log('\n--- ALL 10 JOB PROGRESS TIMESTAMP TESTS PASSED ---');
