import { create } from 'zustand';
import type { Topic, Progress, Submission } from '@/types';

interface TopicsState {
  topics: Topic[];
  progresses: Progress[];
  submissions: Submission[];
  selectedTopicId: string | null;
  
  // Topics
  setTopics: (topics: Topic[]) => void;
  addTopic: (topic: Topic) => void;
  updateTopic: (id: string, updates: Partial<Topic>) => void;
  
  // Progress
  setProgresses: (progresses: Progress[]) => void;
  addProgress: (progress: Progress) => void;
  updateProgress: (id: string, updates: Partial<Progress>) => void;
  getProgressesByTopic: (topicId: string) => Progress[];
  
  // Submissions
  setSubmissions: (submissions: Submission[]) => void;
  addSubmission: (submission: Submission) => void;
  updateSubmission: (id: string, updates: Partial<Submission>) => void;
  getSubmissionsByTopic: (topicId: string) => Submission[];
  
  // Selection
  setSelectedTopic: (topicId: string | null) => void;
  getSelectedTopic: () => Topic | null;
}

// Mock data
const mockTopics: Topic[] = [
  {
    id: '1',
    title: 'Nghiên cứu ứng dụng AI trong giáo dục',
    description: 'Ứng dụng trí tuệ nhân tạo để cải thiện chất lượng giáo dục',
    ownerStudentId: 'student1',
    supervisorId: 'lecturer1',
    status: 'IN_PROGRESS',
    defenseType: 'COUNCIL',
    createdAt: '2024-01-10',
    updatedAt: '2024-01-20',
    revisions: []
  },
  {
    id: '2',
    title: 'Phát triển ứng dụng di động quản lý thư viện',
    description: 'Xây dựng ứng dụng mobile để quản lý mượn trả sách thư viện',
    ownerStudentId: 'student1',
    supervisorId: 'lecturer2',
    status: 'PENDING',
    createdAt: '2024-01-15',
    updatedAt: '2024-01-15',
    revisions: []
  }
];

const mockProgresses: Progress[] = [
  {
    id: 'p1',
    topicId: '1',
    phase: 'OUTLINE',
    status: 'COMPLETED',
    dueDate: '2024-01-15',
    completedAt: '2024-01-12',
    note: 'Đề cương hoàn thành',
    feedback: 'Đề cương rất tốt, có thể tiến hành thực hiện theo kế hoạch.'
  },
  {
    id: 'p2',
    topicId: '1',
    phase: 'CHAPTER_1',
    status: 'IN_PROGRESS',
    dueDate: '2024-02-15',
    note: 'Đang viết chương 1',
    feedback: 'Cần bổ sung thêm tài liệu tham khảo cho chương 1.'
  },
  {
    id: 'p3',
    topicId: '1',
    phase: 'CHAPTER_2',
    status: 'IN_PROGRESS',
    dueDate: '2024-03-15',
    note: ''
  },
  {
    id: 'p4',
    topicId: '1',
    phase: 'CHAPTER_3',
    status: 'IN_PROGRESS',
    dueDate: '2024-04-15',
    note: ''
  },
  {
    id: 'p5',
    topicId: '1',
    phase: 'COMPLETED',
    status: 'IN_PROGRESS',
    dueDate: '2024-05-15',
    note: ''
  }
];

const mockSubmissions: Submission[] = [
  {
    id: 's1',
    topicId: '1',
    version: 'v1.0',
    files: [
      { id: 'f1', name: 'De_cuong_KLTN.docx', size: 245760, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', url: '/files/f1.docx', uploadedAt: '2024-01-12' },
      { id: 'f2', name: 'Tai_lieu_tham_khao.pdf', size: 1048576, type: 'application/pdf', url: '/files/f2.pdf', uploadedAt: '2024-01-12' }
    ],
    submittedAt: '2024-01-12',
    approved: true,
    feedback: 'Đề cương được phê duyệt. Có thể tiến hành thực hiện.'
  },
  {
    id: 's2',
    topicId: '1',
    version: 'v1.1',
    files: [
      { id: 'f3', name: 'Chuong_1_KLTN.docx', size: 512000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', url: '/files/f3.docx', uploadedAt: '2024-01-20' }
    ],
    submittedAt: '2024-01-20',
    approved: false,
    feedback: 'Cần bổ sung thêm tài liệu nghiên cứu liên quan.'
  }
];

export const useTopicsStore = create<TopicsState>((set, get) => ({
  topics: mockTopics,
  progresses: mockProgresses,
  submissions: mockSubmissions,
  selectedTopicId: null,
  
  // Topics
  setTopics: (topics) => set({ topics }),
  addTopic: (topic) => set((state) => ({ topics: [...state.topics, topic] })),
  updateTopic: (id, updates) => set((state) => ({
    topics: state.topics.map(topic => 
      topic.id === id ? { ...topic, ...updates } : topic
    )
  })),
  
  // Progress
  setProgresses: (progresses) => set({ progresses }),
  addProgress: (progress) => set((state) => ({ progresses: [...state.progresses, progress] })),
  updateProgress: (id, updates) => set((state) => ({
    progresses: state.progresses.map(progress => 
      progress.id === id ? { ...progress, ...updates } : progress
    )
  })),
  getProgressesByTopic: (topicId) => {
    return get().progresses.filter(p => p.topicId === topicId);
  },
  
  // Submissions
  setSubmissions: (submissions) => set({ submissions }),
  addSubmission: (submission) => set((state) => ({ submissions: [...state.submissions, submission] })),
  updateSubmission: (id, updates) => set((state) => ({
    submissions: state.submissions.map(submission => 
      submission.id === id ? { ...submission, ...updates } : submission
    )
  })),
  getSubmissionsByTopic: (topicId) => {
    return get().submissions.filter(s => s.topicId === topicId);
  },
  
  // Selection
  setSelectedTopic: (topicId) => set({ selectedTopicId: topicId }),
  getSelectedTopic: () => {
    const { topics, selectedTopicId } = get();
    return selectedTopicId ? topics.find(t => t.id === selectedTopicId) || null : null;
  }
}));