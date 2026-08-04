import { useCallback, useRef, useEffect } from 'react';

export interface DragBlockPayload {
  id: string;
  type: 'password' | 'ping' | 'job' | 'schedule';
  value: any;
}

interface DragState {
  isDragging: boolean;
  payload: DragBlockPayload | null;
  ghost: HTMLElement | null;
}

// Singleton drag state shared across the entire app
const dragState: DragState = {
  isDragging: false,
  payload: null,
  ghost: null,
};

let dropListeners: Array<(payload: DragBlockPayload, x: number, y: number) => void> = [];

export function registerDropListener(fn: (payload: DragBlockPayload, x: number, y: number) => void) {
  dropListeners.push(fn);
  return () => {
    dropListeners = dropListeners.filter(l => l !== fn);
  };
}

function createGhost(label: string): HTMLElement {
  const ghost = document.createElement('div');
  ghost.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 99999;
    background: white;
    border: 1px solid #d6d3d1;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    color: #44403c;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0.95;
    white-space: nowrap;
  `;
  ghost.textContent = label;
  document.body.appendChild(ghost);
  return ghost;
}

function moveGhost(ghost: HTMLElement, x: number, y: number) {
  ghost.style.left = `${x + 12}px`;
  ghost.style.top = `${y + 12}px`;
}

export function useDraggableBlock(payload: DragBlockPayload, label: string) {
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.isDragging = true;
    dragState.payload = payload;
    dragState.ghost = createGhost(label);
    moveGhost(dragState.ghost, e.clientX, e.clientY);

    const onMouseMove = (ev: MouseEvent) => {
      if (dragState.ghost) moveGhost(dragState.ghost, ev.clientX, ev.clientY);
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (dragState.ghost) {
        document.body.removeChild(dragState.ghost);
        dragState.ghost = null;
      }

      if (dragState.isDragging && dragState.payload) {
        dropListeners.forEach(fn => fn(dragState.payload!, ev.clientX, ev.clientY));
      }

      dragState.isDragging = false;
      dragState.payload = null;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [payload, label]);

  return { onMouseDown };
}
