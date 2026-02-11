"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
  type KeyboardEvent,
} from "react";

// ---------------------------------------------------------------------------
// ListView — selectable list with keyboard navigation.
//
// Usage:
//   <ListView
//     items={files}
//     selected={selectedId}
//     onSelect={setSelectedId}
//     onActivate={(item) => openFile(item)}
//     renderItem={(item, { selected, focused }) => (
//       <div className="flex items-center gap-2">
//         <FileIcon name={item.name} />
//         <span>{item.name}</span>
//       </div>
//     )}
//     getKey={(item) => item.id}
//   />
// ---------------------------------------------------------------------------

interface ListViewProps<T> {
  items: T[];
  selected?: string | string[] | null;
  onSelect?: (key: string | null) => void;
  onActivate?: (item: T) => void;
  renderItem: (
    item: T,
    state: { selected: boolean; focused: boolean; index: number },
  ) => ReactNode;
  getKey: (item: T) => string;
  multiSelect?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function ListView<T>({
  items,
  selected,
  onSelect,
  onActivate,
  renderItem,
  getKey,
  multiSelect = false,
  emptyMessage = "No items",
  className = "",
}: ListViewProps<T>) {
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedSet = new Set(
    selected == null ? [] : Array.isArray(selected) ? selected : [selected],
  );

  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(items.length - 1, i)),
    [items.length],
  );

  useEffect(() => {
    setFocusIndex((prev) => clamp(prev));
  }, [items.length, clamp]);

  const scrollToIndex = useCallback((i: number) => {
    const el = listRef.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = clamp(focusIndex + 1);
          setFocusIndex(next);
          scrollToIndex(next);
          if (!multiSelect) onSelect?.(getKey(items[next]));
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = clamp(focusIndex - 1);
          setFocusIndex(prev);
          scrollToIndex(prev);
          if (!multiSelect) onSelect?.(getKey(items[prev]));
          break;
        }
        case "Home": {
          e.preventDefault();
          setFocusIndex(0);
          scrollToIndex(0);
          if (!multiSelect && items.length > 0) onSelect?.(getKey(items[0]));
          break;
        }
        case "End": {
          e.preventDefault();
          const last = items.length - 1;
          setFocusIndex(last);
          scrollToIndex(last);
          if (!multiSelect && items.length > 0) onSelect?.(getKey(items[last]));
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const item = items[focusIndex];
          if (item) {
            onSelect?.(getKey(item));
            if (e.key === "Enter") onActivate?.(item);
          }
          break;
        }
      }
    },
    [focusIndex, items, clamp, scrollToIndex, onSelect, onActivate, getKey, multiSelect],
  );

  if (items.length === 0) {
    return (
      <div className={`flex h-full items-center justify-center text-label-13 text-gray-800 ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={`overflow-y-auto outline-none ${className}`}
      role="listbox"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-multiselectable={multiSelect}
    >
      {items.map((item, i) => {
        const key = getKey(item);
        const isSelected = selectedSet.has(key);
        const isFocused = i === focusIndex;

        return (
          <div
            key={key}
            role="option"
            aria-selected={isSelected}
            className={`cursor-default select-none px-2 py-1 transition-colors
              ${isSelected ? "bg-blue-700/15 text-gray-1000" : "text-gray-1000"}
              ${isFocused && !isSelected ? "bg-gray-alpha-100" : ""}
              hover:bg-gray-alpha-200`}
            onClick={() => {
              setFocusIndex(i);
              onSelect?.(key);
            }}
            onDoubleClick={() => onActivate?.(item)}
          >
            {renderItem(item, { selected: isSelected, focused: isFocused, index: i })}
          </div>
        );
      })}
    </div>
  );
}
