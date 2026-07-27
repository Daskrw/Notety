export type BlockType = 'text' | 'password' | 'ping';

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

export type EditorBlock = TextBlock | PasswordBlock | PingBlock;

export function parseBlocks(content: string): EditorBlock[] {
  if (!content) return [{ id: crypto.randomUUID(), type: 'text', value: '' }];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
      return parsed;
    }
  } catch (e) {
    // Legacy plain text note
  }
  return [{ id: crypto.randomUUID(), type: 'text', value: content }];
}

export function serializeBlocks(blocks: EditorBlock[]): string {
  // Keeping it as JSON array is safer so we don't accidentally parse user text that looks like JSON.
  // Wait, if it's a JSON array, when the user sees a legacy plain text note and saves it, it becomes JSON.
  return JSON.stringify(blocks);
}
