import { Check, FileText, Minus, MoveDiagonal2, Pencil, Pin, Plus, Search, Settings, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AppData, FilterKey } from '../shared/types';
import { getTaroNoteApi } from './previewApi';
import { messages } from './i18n';
import { useSearch, useStableCallback, useToast } from './hooks';
import { buildGroupFilter, getErrorMessage, getFilterGroupId, isEditableTarget } from './utils';
import { useCategories } from './useCategories';
import { useNotes } from './useNotes';
import { useSettings } from './useSettings';
import { NotesView } from './components/NotesView';
import { CategoryPicker } from './components/CategoryPicker';
import { ResizeHandles } from './components/ResizeHandles';
import { WindowControls } from './components/WindowControls';
import { SettingsView } from './components/settings/SettingsView';

const taroNoteApi = getTaroNoteApi();

type ViewMode = 'notes' | 'settings';

// 先用浏览器环境给 Windows 一个同步初值，随后仍以主进程返回的平台为准，避免首帧闪一下 mac 窗控。
const getInitialPlatform = () => (navigator.userAgent.includes('Windows') ? 'win32' : '');

function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<ViewMode>('notes');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const { toast, showToast } = useToast();
  const [platform, setPlatform] = useState(getInitialPlatform);
  const [maximized, setMaximized] = useState(false);
  const dataLoaded = Boolean(data);
  const isWindows = platform === 'win32';
  const language = data?.settings.language ?? 'zh';
  const t = messages[language];
  const groupsById = useMemo(() => new Map((data?.groups ?? []).map((group) => [group.id, group])), [data?.groups]);
  const activeGroupId = getFilterGroupId(activeFilter);
  const { filteredNotes, searchInputRef, searchOpen, searchPanelRef, searchText, selectedIndex, setSearchOpen, setSearchText, setSelectedIndex } =
    useSearch({
      notes: data?.notes ?? [],
      groupsById,
      activeFilter,
      enabled: view === 'notes',
    });

  // 统一保存入口：IPC 失败时保留原界面数据，并明确告知用户失败原因。
  const savePayload = useStableCallback(async (payload: Parameters<typeof taroNoteApi.saveData>[0]) => {
    try {
      const nextData = await taroNoteApi.saveData(payload);
      setData(nextData);
      return nextData;
    } catch (error) {
      showToast(t.saveFailed(getErrorMessage(error)));
      return null;
    }
  });

  const notes = useNotes({
    activeFilter,
    activeGroupId,
    copyNoteRequest: taroNoteApi.copyNote,
    data,
    labels: t,
    language,
    savePayload,
    setData,
    setSelectedIndex,
    showToast,
  });

  // 分类删除后同步正在编辑的 Note 草稿，避免保留已失效的分类 ID。
  const handleCategoryRemoved = useStableCallback((groupId: string, fallbackGroupId: string, deletedNotes: boolean) => {
    notes.setDraft((current) => {
      if (current?.groupId !== groupId) {
        return current;
      }

      return deletedNotes ? null : { ...current, groupId: fallbackGroupId };
    });
  });

  const categories = useCategories({
    activeFilter,
    data,
    labels: t,
    onCategoryRemoved: handleCategoryRemoved,
    savePayload,
    setActiveFilter,
    showToast,
  });
  const {
    cancelCategoryDraft,
    cancelCategoryEdit,
    categoryDraftName,
    categoryDraftOpen,
    categoryEditInputRef,
    categoryInputRef,
    editingCategoryId,
    editingCategoryName,
    openCategoryEdit,
    removeCategory,
    saveCategoryDraft,
    saveCategoryEdit,
    setCategoryDraftName,
    setEditingCategoryName,
  } = categories;
  const { draft, notesCanvasRef, saveDraft, setDraft } = notes;

  // 打开 Note 编辑器时统一关闭分类编辑态，避免多个浮层同时出现。
  const openNewNote = useStableCallback(() => {
    categories.cancelCategoryDraft();
    categories.cancelCategoryEdit();
    notes.openNewNote();
    setView('notes');
  });

  const openEditNote = useStableCallback((note: AppData['notes'][number]) => {
    categories.cancelCategoryDraft();
    categories.cancelCategoryEdit();
    notes.openEditNote(note);
  });

  // 打开新建分类时关闭 Note 草稿，侧栏只保留一个编辑入口。
  const openCategoryDraft = useStableCallback(() => {
    notes.setDraft(null);
    categories.openCategoryDraft();
    setView('notes');
  });

  const handleCopyNote = useStableCallback(notes.copyNote);
  const handleDeleteNote = useStableCallback(notes.removeNote);
  const handleTogglePinned = useStableCallback(notes.togglePinned);
  const handleReorderNotes = useStableCallback(notes.reorderNotes);
  const { updateSetting } = useSettings({
    applySettingsRequest: taroNoteApi.applySettings,
    data,
    labels: t,
    setData,
    showToast,
  });
  const activeGroup = activeGroupId ? groupsById.get(activeGroupId) : undefined;
  // 一次遍历缓存置顶数和分类计数，避免分类较多时每个侧栏项都重新扫描全部 Note。
  const noteStats = useMemo(() => {
    const groupCounts = new Map<string, number>();
    let pinnedCount = 0;

    for (const note of data?.notes ?? []) {
      groupCounts.set(note.groupId, (groupCounts.get(note.groupId) ?? 0) + 1);
      if (note.favorite) {
        pinnedCount += 1;
      }
    }

    return { groupCounts, pinnedCount };
  }, [data?.notes]);
  const pinnedCount = noteStats.pinnedCount;
  const currentViewTitle = view === 'settings' ? t.settings : activeFilter === 'pinned' ? t.pinnedNotes : (activeGroup?.name ?? t.notes);
  const emptyNotesText = activeFilter === 'pinned' ? t.emptyPinned : activeGroup ? t.emptyCategory : t.empty;

  // 首次加载本地数据，并响应托盘菜单打开设置页的动作。
  useEffect(() => {
    let disposed = false;
    void taroNoteApi
      .getState()
      .then((nextData) => {
        if (!disposed) {
          setData(nextData);
        }
      })
      .catch((error) => {
        if (!disposed) {
          setLoadError(getErrorMessage(error));
        }
      });

    const removeOpenSettingsListener = taroNoteApi.onOpenSettings(() => {
      setView('settings');
      setSearchOpen(false);
      setDraft(null);
    });

    return () => {
      disposed = true;
      removeOpenSettingsListener();
    };
  }, []);

  // 平台与窗口最大化状态：平台决定窗控样式，最大化状态决定窗控图标与去留白/圆角。
  useEffect(() => {
    void taroNoteApi
      .getPlatform()
      .then(setPlatform)
      .catch(() => undefined);
    void taroNoteApi
      .isMaximized()
      .then(setMaximized)
      .catch(() => undefined);
    const removeWindowStateListener = taroNoteApi.onWindowState((state) => setMaximized(state.maximized));
    return () => removeWindowStateListener();
  }, []);

  // 平台与最大化状态写到 <html> data 属性，供 CSS 按平台/状态切换留白、圆角、阴影和窗控。
  useEffect(() => {
    document.documentElement.dataset.platform = isWindows ? 'win' : 'mac';
    document.documentElement.dataset.maximized = maximized ? 'true' : 'false';
  }, [isWindows, maximized]);

  const theme = data?.settings.theme;
  useEffect(() => {
    if (theme) {
      document.documentElement.dataset.theme = theme;
    }
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language, theme]);

  // 分类可能来自导入文件，若当前筛选指向了不存在的分类，就自动回到全部列表。
  useEffect(() => {
    if (!data?.groups || !activeGroupId) {
      return;
    }

    if (!data.groups.some((group) => group.id === activeGroupId)) {
      setActiveFilter('all');
    }
  }, [activeGroupId, data?.groups]);

  // 快捷键只处理列表里的复制、搜索、新建和删除，输入框聚焦时不拦截。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dataLoaded || draft || categoryDraftOpen || editingCategoryId || view !== 'notes' || isEditableTarget(event.target)) {
        return;
      }

      // Windows 按要求禁用新建/搜索组合快捷键；macOS 只响应 Cmd，避免 Ctrl 组合误触发。
      if (!isWindows && event.metaKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openNewNote();
        return;
      }

      if (!isWindows && event.metaKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(current + 1, Math.max(filteredNotes.length - 1, 0)));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === 'Enter' && filteredNotes[selectedIndex]) {
        event.preventDefault();
        void handleCopyNote(filteredNotes[selectedIndex]);
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        if (filteredNotes[selectedIndex]) {
          void handleDeleteNote(filteredNotes[selectedIndex]);
        }
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        setSearchOpen(true);
        setSearchText(event.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    categoryDraftOpen,
    dataLoaded,
    draft,
    editingCategoryId,
    filteredNotes,
    handleCopyNote,
    handleDeleteNote,
    isWindows,
    openNewNote,
    selectedIndex,
    setSearchOpen,
    setSearchText,
    setSelectedIndex,
    view,
  ]);

  if (!data) {
    return <div className="boot">{loadError ? t.loadFailed(loadError) : 'TaroNote'}</div>;
  }

  return (
    <>
      {isWindows && <ResizeHandles />}
      <main className="app-shell">
        <aside className="sidebar">
          {!isWindows && (
            <div className="traffic-lights">
              <button className="traffic red" aria-label={t.windowClose} onClick={() => void taroNoteApi.closeWindow()}>
                <X size={8} strokeWidth={3.4} />
              </button>
              <button className="traffic yellow" aria-label={t.windowMinimize} onClick={() => void taroNoteApi.minimizeWindow()}>
                <Minus size={8} strokeWidth={3.8} />
              </button>
              <button className="traffic green" aria-label={t.toggleMaximize} onClick={() => void taroNoteApi.toggleMaximize()}>
                <MoveDiagonal2 size={7} strokeWidth={3.2} />
              </button>
            </div>
          )}

          <div className="cloud-title">
            <strong>TaroNote</strong>
          </div>

          <nav className="side-nav">
            <button
              className={`sidebar-item ${view === 'notes' && activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => {
                setView('notes');
                setActiveFilter('all');
              }}
            >
              <FileText className="sidebar-item-icon" size={18} />
              <span className="sidebar-item-label">{t.allNotes}</span>
              <em className="sidebar-item-meta">{data.notes.length}</em>
            </button>
            <button
              className={`sidebar-item ${view === 'notes' && activeFilter === 'pinned' ? 'active' : ''}`}
              onClick={() => {
                setView('notes');
                setActiveFilter('pinned');
              }}
            >
              <Pin className="sidebar-item-icon" size={18} />
              <span className="sidebar-item-label">{t.pinnedNotes}</span>
              <em className="sidebar-item-meta">{pinnedCount}</em>
            </button>
          </nav>

          <div className="sidebar-section no-drag">
            <div className="sidebar-item sidebar-section-head">
              <Tag className="sidebar-item-icon" size={18} />
              <span className="sidebar-item-label">{t.categories}</span>
              <button className="sidebar-item-action" title={t.addCategory} onClick={openCategoryDraft}>
                <Plus size={16} />
              </button>
            </div>
            <div className="category-list">
              {data.groups.map((group, index) => {
                const groupFilter = buildGroupFilter(group.id);
                const isActive = view === 'notes' && activeFilter === groupFilter;
                const canDelete = index > 0;

                if (editingCategoryId === group.id) {
                  return (
                    <div className="sidebar-item category-draft-row category-edit-row" key={group.id}>
                      <input
                        ref={categoryEditInputRef}
                        value={editingCategoryName}
                        placeholder={t.categoryNamePrompt}
                        onChange={(event) => setEditingCategoryName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void saveCategoryEdit(group);
                          }

                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelCategoryEdit();
                          }
                        }}
                      />
                      <button title={t.save} onMouseDown={(event) => event.preventDefault()} onClick={() => void saveCategoryEdit(group)}>
                        <Check size={15} />
                      </button>
                      <button title={t.cancel} onMouseDown={(event) => event.preventDefault()} onClick={cancelCategoryEdit}>
                        <X size={14} />
                      </button>
                    </div>
                  );
                }

                return (
                  <div className={`sidebar-item category-row ${isActive ? 'active' : ''}`} key={group.id}>
                    <button
                      className="category-button"
                      onClick={() => {
                        setView('notes');
                        setActiveFilter(groupFilter);
                      }}
                    >
                      <span className="sidebar-item-label">{group.name}</span>
                      <em className="sidebar-item-meta">{noteStats.groupCounts.get(group.id) ?? 0}</em>
                    </button>
                    <button
                      className={canDelete ? 'category-edit' : 'category-edit solo'}
                      title={t.edit}
                      onClick={(event) => {
                        event.stopPropagation();
                        openCategoryEdit(group);
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    {canDelete && (
                      <button
                        className="category-delete"
                        title={t.delete}
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeCategory(group);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <nav className="side-nav side-nav-bottom">
            <button
              className={`sidebar-item ${view === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setView('settings');
                setSearchOpen(false);
              }}
            >
              <Settings className="sidebar-item-icon" size={18} />
              <span className="sidebar-item-label">{t.settings}</span>
            </button>
          </nav>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <h1>{currentViewTitle}</h1>
            <div className="top-actions no-drag">
              {/* 设置页不展示笔记操作入口，避免右上角出现搜索和新建按钮。 */}
              {view === 'notes' && (
                <>
                  <div className="search-cluster" ref={searchPanelRef}>
                    {searchOpen && (
                      <label className="inline-search">
                        <Search size={16} />
                        <input ref={searchInputRef} value={searchText} onChange={(event) => setSearchText(event.target.value)} />
                        {searchText && (
                          <button onClick={() => setSearchText('')}>
                            <X size={14} />
                          </button>
                        )}
                      </label>
                    )}
                    <button className="toolbar-button" title={t.search} onClick={() => setSearchOpen((open) => !open)}>
                      <Search size={18} />
                    </button>
                  </div>
                  <button className="toolbar-button" title={t.newNote} onClick={openNewNote}>
                    <Plus size={20} />
                  </button>
                </>
              )}
              {isWindows && <WindowControls labels={t} maximized={maximized} />}
            </div>
          </header>

          {view === 'notes' ? (
            <NotesView
              notes={filteredNotes}
              groupsById={groupsById}
              selectedIndex={selectedIndex}
              onCopy={handleCopyNote}
              onEdit={openEditNote}
              onDelete={handleDeleteNote}
              onTogglePinned={handleTogglePinned}
              onReorder={handleReorderNotes}
              labels={t}
              language={language}
              canvasRef={notesCanvasRef}
              emptyText={emptyNotesText}
            />
          ) : (
            <SettingsView settings={data.settings} labels={t} isWindows={isWindows} updateSetting={updateSetting} />
          )}
        </section>

        <footer className="bottom-count">{t.count(filteredNotes.length)}</footer>

        {draft && (
          <section className="note-editor no-drag">
            <div className="editor-head">
              <span>{draft.id ? t.editNote : t.newNote}</span>
              <button onClick={() => setDraft(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="editor-meta">
              <div className="editor-category">
                <span>{t.noteCategory}</span>
                <CategoryPicker
                  groups={data.groups}
                  labels={t}
                  value={draft.groupId}
                  onChange={(groupId) => setDraft((current) => (current ? { ...current, groupId } : current))}
                />
              </div>
              <button className={`editor-pin ${draft.favorite ? 'active' : ''}`} onClick={() => setDraft({ ...draft, favorite: !draft.favorite })}>
                <Pin size={16} fill={draft.favorite ? 'currentColor' : 'none'} />
                <span>{draft.favorite ? t.pinned : t.pinNote}</span>
              </button>
            </div>
            <textarea
              autoFocus
              placeholder={t.placeholder}
              value={draft.content}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
            />
            <div className="editor-actions">
              {draft.id && (
                <button
                  className="ghost danger"
                  onClick={() => {
                    const note = data.notes.find((item) => item.id === draft.id);
                    if (note) void handleDeleteNote(note);
                  }}
                >
                  {t.delete}
                </button>
              )}
              <button className="ghost" onClick={() => setDraft(null)}>
                {t.cancel}
              </button>
              <button className="solid" onClick={() => void saveDraft()}>
                {t.save}
              </button>
            </div>
          </section>
        )}

        {categoryDraftOpen && (
          <section className="note-editor category-editor no-drag">
            <div className="editor-head">
              <span>{t.addCategory}</span>
              <button onClick={cancelCategoryDraft}>
                <X size={18} />
              </button>
            </div>
            <label className="category-name-field">
              <span>{t.categoryName}</span>
              <input
                ref={categoryInputRef}
                autoFocus
                value={categoryDraftName}
                placeholder={t.categoryNamePrompt}
                onChange={(event) => setCategoryDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void saveCategoryDraft();
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelCategoryDraft();
                  }
                }}
              />
            </label>
            <div className="editor-actions">
              <button className="ghost" onClick={cancelCategoryDraft}>
                {t.cancel}
              </button>
              <button className="solid" onClick={() => void saveCategoryDraft()}>
                {t.save}
              </button>
            </div>
          </section>
        )}

        {toast && <div className="toast no-drag">{toast}</div>}
      </main>
    </>
  );
}

export default App;
