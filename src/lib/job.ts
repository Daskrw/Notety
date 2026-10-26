import type { JobTaskItem } from './blocks.ts';

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * Determines whether a first-entry timestamp should be generated or preserved
 * when a subtask's text is changed.
 *
 * Rules:
 * 1. Once assigned, an existing timestamp is strictly permanent and preserved.
 * 2. Editing, appending, or correcting text never overwrites the original timestamp.
 * 3. Clearing text (making it empty) never resets or deletes an existing timestamp.
 * 4. A new timestamp is assigned ONLY when meaningful (non-whitespace) text is
 *    entered into a previously empty subtask.
 * 5. Whitespace-only text never generates a timestamp.
 * 6. Historical text without a timestamp is never assigned a fabricated time.
 */
export function applyFirstEntryTimestamp(
  previousText: string = '',
  newText: string = '',
  existingTimestamp?: string
): string | undefined {
  // Rule 1, 2, 3: Once a timestamp exists, it is permanently preserved
  if (existingTimestamp) {
    return existingTimestamp;
  }

  const wasEmpty = !previousText || previousText.trim().length === 0;
  const isNowMeaningful = !!newText && newText.trim().length > 0;

  // Rule 4, 5: Assign ISO 8601 UTC timestamp only when meaningful text is entered into an empty subtask
  if (wasEmpty && isNowMeaningful) {
    return new Date().toISOString();
  }

  // Otherwise, remain undefined (no fabrication for legacy pre-filled text)
  return undefined;
}

/**
 * Formats an ISO 8601 timestamp into a compact, unobtrusive Thai locale string.
 *
 * Examples:
 * - Same day: "เริ่มบันทึก 09:15"
 * - Same year: "เริ่มบันทึก 26 ต.ค. 09:15"
 * - Different year: "เริ่มบันทึก 26 ต.ค. 2026 09:15"
 */
export function formatFirstEntryTimestamp(isoString?: string): string {
  if (!isoString) return '';

  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const isSameYear = d.getFullYear() === now.getFullYear();

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isToday) {
    return `เริ่มบันทึก ${timeStr}`;
  }

  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];

  if (isSameYear) {
    return `เริ่มบันทึก ${day} ${month} ${timeStr}`;
  }

  const year = d.getFullYear();
  return `เริ่มบันทึก ${day} ${month} ${year} ${timeStr}`;
}

/**
 * Formats an ISO 8601 timestamp into a full, detailed date and time string for tooltips.
 * Example: "บันทึกครั้งแรก: 26 ตุลาคม 2026 เวลา 09:15:30 น."
 */
export function formatFullFirstEntryDateTime(isoString?: string): string {
  if (!isoString) return 'ยังไม่มีการบันทึกข้อความ';

  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'ยังไม่มีการบันทึกข้อความ';

  const day = d.getDate();
  const month = THAI_MONTHS_FULL[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `บันทึกครั้งแรก: ${day} ${month} ${year} เวลา ${hours}:${minutes}:${seconds} น.`;
}

/**
 * Clones/duplicates a subtask cleanly, ensuring unique ID and proper timestamp inheritance.
 * Empty subtasks never inherit a misleading timestamp.
 */
export function duplicateJobTask(task: JobTaskItem): JobTaskItem {
  const hasText = !!task.text && task.text.trim().length > 0;
  return {
    id: crypto.randomUUID(),
    text: task.text,
    completed: false, // New duplicated task starts uncompleted
    firstEntryAt: hasText ? task.firstEntryAt : undefined,
  };
}
