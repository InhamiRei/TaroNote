import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FilterKey, NoteGroup, NoteItem } from '../shared/types';
import { getFilterGroupId, sortNotesByActivity } from './utils';

// 返回稳定函数引用，同时始终调用最新逻辑，避免大列表子组件因为回调地址变化而重复渲染。
export const useStableCallback = <Args extends unknown[], Return>(callback: (...args: Args) => Return) => {
  const callbackRef = useRef(callback);

  // 在浏览器绘制前同步最新实现，避免状态更新后极短时间内仍调用上一轮闭包。
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: Args) => callbackRef.current(...args), []);
};

// 统一管理 Toast 生命周期，调用方只需要关心要显示的文案。
export const useToast = (duration = 1400) => {
  const [toast, setToast] = useState('');
  const timerRef = useRef<number>();

  const showToast = useCallback(
    (message: string) => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }

      setToast(message);
      timerRef.current = window.setTimeout(() => {
        setToast('');
        timerRef.current = undefined;
      }, duration);
    },
    [duration],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { toast, showToast };
};

type UseSearchOptions = {
  notes: NoteItem[];
  groupsById: ReadonlyMap<string, NoteGroup>;
  activeFilter: FilterKey;
  enabled: boolean;
};

// 搜索 Hook 集中维护输入、键盘选中项和派生列表，让 App 只负责组装视图。
export const useSearch = ({ notes, groupsById, activeFilter, enabled }: UseSearchOptions) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  // 空搜索框打开后，点击搜索区域外自动收起，避免顶栏残留输入框。
  useEffect(() => {
    if (!searchOpen || !enabled) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || searchPanelRef.current?.contains(event.target)) {
        return;
      }

      if (!searchText.trim()) {
        setSearchOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [enabled, searchOpen, searchText]);

  // Note 排序只在原始列表变化时执行；搜索输入变化时复用排序结果。
  const sortedNotes = useMemo(() => sortNotesByActivity(notes), [notes]);

  // 预先构建小写搜索索引，连续输入时无需反复拼接标题、正文和分类名。
  const noteSearchIndex = useMemo(() => {
    const index = new Map<string, string>();

    for (const note of notes) {
      index.set(note.id, `${note.title} ${note.content} ${groupsById.get(note.groupId)?.name ?? ''}`.toLowerCase());
    }

    return index;
  }, [groupsById, notes]);

  // 搜索匹配标题、正文和分类名，再按当前侧栏筛选收窄结果。
  const filteredNotes = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const groupId = getFilterGroupId(activeFilter);

    return sortedNotes.filter((note) => {
      if (activeFilter === 'pinned' && !note.favorite) {
        return false;
      }

      if (groupId && note.groupId !== groupId) {
        return false;
      }

      return query ? (noteSearchIndex.get(note.id) ?? '').includes(query) : true;
    });
  }, [activeFilter, noteSearchIndex, searchText, sortedNotes]);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(Math.max(current, 0), Math.max(filteredNotes.length - 1, 0)));
  }, [filteredNotes.length]);

  return {
    filteredNotes,
    searchInputRef,
    searchOpen,
    searchPanelRef,
    searchText,
    selectedIndex,
    setSearchOpen,
    setSearchText,
    setSelectedIndex,
  };
};
