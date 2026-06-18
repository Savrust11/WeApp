import { create } from 'zustand';
import type { Child } from '../api/children';

interface ChildState {
  activeChildId: number | null;
  children: Child[];
  setChildren: (children: Child[]) => void;
  setActiveChildId: (id: number) => void;
  activeChild: () => Child | null;
}

export const useChildStore = create<ChildState>((set, get) => ({
  activeChildId: null,
  children: [],

  setChildren: (children) =>
    set({
      children,
      activeChildId: children.length > 0 ? children[0].id : null,
    }),

  setActiveChildId: (id) => set({ activeChildId: id }),

  activeChild: () => {
    const { children, activeChildId } = get();
    return children.find((c) => c.id === activeChildId) ?? null;
  },
}));
