export type BlockType = 'text' | 'password' | 'ping' | 'job' | 'image' | 'schedule';

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface TextBlock extends BaseBlock {
  type: 'text';
  value: string;
}

export interface PasswordBlock extends BaseBlock {
  type: 'password';
  value: string;
}

export interface PingBlock extends BaseBlock {
  type: 'ping';
  value: string;
}

export interface JobTaskItem {
  id: string;
  text: string;
}

export interface JobBlockValue {
  totalTasks: number;
  tasks: JobTaskItem[];
}

export interface JobBlock extends BaseBlock {
  type: 'job';
  value: JobBlockValue | string;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  url: string;
  caption?: string;
}

export interface ScheduleDayDetail {
  dateStr: string;
  category: 'holiday' | 'work' | 'off' | 'custom';
  title?: string;
  shiftTimes?: string;
}

export interface ScheduleBlockValue {
  year: number;
  month: number;
  dayDetails: Record<string, ScheduleDayDetail>;
}

export interface ScheduleBlock extends BaseBlock {
  type: 'schedule';
  value: ScheduleBlockValue | string;
}

export type EditorBlock = TextBlock | PasswordBlock | PingBlock | JobBlock | ImageBlock | ScheduleBlock;

export interface NoteContent {
  text: string;
  blocks: EditorBlock[];
}

export function parseNoteContent(content: string): NoteContent {
  if (!content) return { text: '', blocks: [] };
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') {
      if ('text' in parsed || 'blocks' in parsed) {
        return {
          text: parsed.text || '',
          blocks: Array.isArray(parsed.blocks) ? parsed.blocks : []
        };
      }
      // If it's a legacy JSON block array
      if (Array.isArray(parsed)) {
        const textBlocks = parsed.filter(b => b.type === 'text');
        const text = textBlocks.map(b => b.value).join('\n');
        const otherBlocks = parsed.filter(b => b.type !== 'text');
        return { text, blocks: otherBlocks };
      }
    }
  } catch (e) {
    // Legacy plain text note
  }
  return { text: content, blocks: [] };
}

export function serializeNoteContent(text: string, blocks: EditorBlock[]): string {
  return JSON.stringify({ text, blocks });
}

export function parseBlocks(content: string): EditorBlock[] {
  return parseNoteContent(content).blocks;
}

export function serializeBlocks(blocks: EditorBlock[]): string {
  return JSON.stringify({ text: '', blocks });
}
