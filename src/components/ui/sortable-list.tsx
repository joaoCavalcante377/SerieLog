"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  /** Called with the new order after a drop (pointer or keyboard). */
  onReorder: (next: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  handleLabel: (label: string) => string;
}

const instructions: ScreenReaderInstructions = {
  draggable:
    "Para reordenar, pressione espaço ou Enter, mova com as setas para cima e para baixo e pressione espaço novamente para soltar. Esc cancela.",
};

/** Accessible sortable list: drag with mouse/touch, or focus the handle and use the keyboard. */
export function SortableList<T>({
  items,
  getId,
  getLabel,
  onReorder,
  renderItem,
  handleLabel,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);
  const labelOf = (id: string | number) => {
    const item = items.find((i) => getId(i) === String(id));
    return item ? getLabel(item) : String(id);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${labelOf(active.id)} selecionada.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${labelOf(active.id)} movida para a posição ${ids.indexOf(String(over.id)) + 1}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${labelOf(active.id)} solta na posição ${ids.indexOf(String(over.id)) + 1} de ${ids.length}.`
        : `${labelOf(active.id)} solta.`,
    onDragCancel: ({ active }) => `Movimento de ${labelOf(active.id)} cancelado.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: instructions }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2">
          {items.map((item, index) => (
            <SortableRow
              key={getId(item)}
              id={getId(item)}
              handleLabel={handleLabel(getLabel(item))}
            >
              {renderItem(item, index)}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  handleLabel,
  children,
}: {
  id: string;
  handleLabel: string;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-surface border-border flex items-start gap-2 rounded-md border p-2 ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={handleLabel}
        className="text-muted hover:text-foreground flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded"
      >
        <GripVertical className="h-5 w-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
