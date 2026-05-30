import { create } from 'zustand';

interface SemesterState {
  selectedSemesterId: string | null;
  setSelectedSemesterId: (id: string | null) => void;
}

export const useSemesterStore = create<SemesterState>((set) => ({
  selectedSemesterId: localStorage.getItem('sys_selected_semester_id') || null,
  setSelectedSemesterId: (id: string | null) => {
    if (id) {
      localStorage.setItem('sys_selected_semester_id', id);
    } else {
      localStorage.removeItem('sys_selected_semester_id');
    }
    set({ selectedSemesterId: id });
  },
}));
