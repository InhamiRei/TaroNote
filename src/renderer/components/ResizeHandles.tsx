import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ResizeEdges } from '../../shared/types';
import { getTaroNoteApi } from '../previewApi';

const taroNoteApi = getTaroNoteApi();

// 八个方向：四条边 + 四个角，组合出 ResizeEdges 标记交给主进程改 Bounds。
type ResizeEdge = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const edgeMap: Record<ResizeEdge, ResizeEdges> = {
  left: { left: true },
  right: { right: true },
  top: { top: true },
  bottom: { bottom: true },
  'top-left': { top: true, left: true },
  'top-right': { top: true, right: true },
  'bottom-left': { bottom: true, left: true },
  'bottom-right': { bottom: true, right: true },
};

// 光标提示与拖拽方向一致，方便用户预判缩放行为。
const cursorMap: Record<ResizeEdge, string> = {
  left: 'ew-resize',
  right: 'ew-resize',
  top: 'ns-resize',
  bottom: 'ns-resize',
  'top-left': 'nwse-resize',
  'bottom-right': 'nwse-resize',
  'top-right': 'nesw-resize',
  'bottom-left': 'nesw-resize',
};

const edges: ResizeEdge[] = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

// Windows 无边框窗口没有稳定的原生边框缩放，用 8 条不可见边条覆盖窗口边缘，
// 拖拽时把指针坐标交给主进程改 Bounds。mac 有原生缩放，不渲染此组件。
export function ResizeHandles() {
  const rafRef = useRef(0);
  // 只缓存最新指针位置，连续 pointermove 合并到下一帧一次 IPC，避免拖垮主进程。
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  const flush = () => {
    rafRef.current = 0;
    const pointer = pointerRef.current;
    if (pointer) {
      void taroNoteApi.resize(pointer.x, pointer.y);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const edge = event.currentTarget.dataset.edge as ResizeEdge;
    const resizeEdges = edgeMap[edge];
    if (!resizeEdges) {
      return;
    }

    void taroNoteApi.startResize(resizeEdges, event.screenX, event.screenY);
    pointerRef.current = { x: event.screenX, y: event.screenY };
    event.currentTarget.setPointerCapture(event.pointerId);

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(flush);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerRef.current) {
      return;
    }

    pointerRef.current = { x: event.screenX, y: event.screenY };
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(flush);
    }
  };

  // 结束拖拽时统一清理 RAF、主进程会话和 pointer capture，避免取消拖拽后残留缩放状态。
  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerRef.current) {
      return;
    }

    void taroNoteApi.endResize();
    pointerRef.current = null;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="resize-handles" aria-hidden="true">
      {edges.map((edge) => (
        <div
          key={edge}
          className={`resize-handle resize-${edge}`}
          data-edge={edge}
          style={{ cursor: cursorMap[edge] }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
          onLostPointerCapture={finishResize}
        />
      ))}
    </div>
  );
}
