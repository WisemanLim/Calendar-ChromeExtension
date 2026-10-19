// 사용자 "테마"(입력 방식) = 플래너 모드. 색 테마와 별개. iOS PlannerMode.swift / TemplateCategory 포팅.

export const PlannerMode = Object.freeze({
  diary: 'diary',
  todo: 'todo',
  personalEvent: 'personalEvent',
});

export const PLANNER_MODES = [
  {
    id: PlannerMode.diary,
    title: '일기',
    icon: '📖',
    detail: '이벤트 추가 시 일기장처럼 전체 화면으로 자유롭게 작성합니다.',
  },
  {
    id: PlannerMode.todo,
    title: '업무 이벤트',
    icon: '💼',
    detail: '할 일·회의 등 업무 이벤트 템플릿을 선택해 빠르게 입력합니다.',
  },
  {
    id: PlannerMode.personalEvent,
    title: '개인 이벤트',
    icon: '🗂️',
    detail: '복용·약속 등 개인 이벤트 템플릿을 선택해 빠르게 입력합니다.',
  },
];

export const modeInfo = (id) => PLANNER_MODES.find((m) => m.id === id) ?? PLANNER_MODES[1];

export const TemplateCategory = Object.freeze({
  workEvent: 'workEvent', // 업무 이벤트: 할 일, 회의, 세미나/컨퍼런스, 회식
  medication: 'medication', // 복용
  appointment: 'appointment', // 약속
  fixed: 'fixed', // 고정/반복
});

export const CATEGORY_TITLES = {
  workEvent: '업무 이벤트',
  medication: '복용',
  appointment: '약속',
  fixed: '고정/반복',
};

/** 개인 이벤트 모드 분류 세그먼트 (workEvent 제외). */
export const PERSONAL_CATEGORIES = ['medication', 'appointment', 'fixed'];

export const RepeatFrequency = [
  { id: 'daily', title: '매일' },
  { id: 'weekly', title: '매주' },
  { id: 'yearly', title: '매년' },
];

export const MedicationPreset = [
  { id: 'morning', title: '아침', hour: 7 },
  { id: 'lunch', title: '점심', hour: 12 },
  { id: 'evening', title: '저녁', hour: 18 },
  { id: 'custom', title: '직접', hour: null },
];

export function presetForHour(hour) {
  return MedicationPreset.find((p) => p.hour === hour)?.id ?? 'custom';
}
