// 개인 이벤트 입력 템플릿 — iOS EventTemplate.swift 포팅. 저장 키 templates.v3.
import { fixedTitle } from './plannerLogic.js';

export const TEMPLATES_KEY = 'templates.v3';

let seq = 0;
const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `t-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** 템플릿 생성 (iOS init 기본값 준용). */
export function makeTemplate({
  id = uid(),
  name,
  category,
  titleFormat,
  dayOfYear = null,
  defaultStartHour = 9,
  defaultDurationMinutes = 60,
  isTodo = false,
}) {
  return { id, name, category, titleFormat, dayOfYear, defaultStartHour, defaultDurationMinutes, isTodo };
}

/** 이전 데이터 호환 디코딩 — isTodo 누락 시 false. */
export function normalizeTemplate(raw) {
  return makeTemplate({ ...raw, isTodo: raw.isTodo ?? false, dayOfYear: raw.dayOfYear ?? null });
}

/** 고정 이벤트 표기 `[#ddd] 제목` (fixed + dayOfYear 있을 때). */
export function fixedDisplayTitle(t) {
  if (t.category !== 'fixed' || t.dayOfYear == null) return null;
  return fixedTitle(t.dayOfYear, t.titleFormat);
}

export const templateLabel = (t) => fixedDisplayTitle(t) ?? t.titleFormat;

/**
 * 기본 시드 템플릿(v3).
 * titleFormat 에 날짜 패턴(yyyy-mm-dd, d### 등)이 포함되면 저장 시 실제 날짜로 치환된다.
 * 치환 패턴 없는 fixed/medication 항목은 저장 시 자동 yearly 반복.
 */
export function seedTemplates() {
  const T = (name, category, titleFormat, defaultStartHour, defaultDurationMinutes, isTodo = false) =>
    makeTemplate({ name, category, titleFormat, defaultStartHour, defaultDurationMinutes, isTodo });
  return [
    // 업무 이벤트 (PlannerMode.todo 전용)
    T('할 일', 'workEvent', '할 일', 9, 60, true),
    T('회의', 'workEvent', '회의', 10, 60),
    T('세미나/컨퍼런스', 'workEvent', '세미나/컨퍼런스', 9, 480),
    T('회식', 'workEvent', '회식', 18, 180),
    // 복용
    T('아침 약 복용', 'medication', '아침 약 복용', 7, 0),
    T('점심 약 복용', 'medication', '점심 약 복용', 12, 0),
    T('저녁 약 복용', 'medication', '저녁 약 복용', 18, 0),
    T('임시/긴급 복용', 'medication', '임시/긴급 복용', 9, 0),
    // 약속
    T('연인과 약속', 'appointment', '연인과 약속', 19, 120),
    T('친구와 약속', 'appointment', '친구와 약속', 14, 120),
    T('동호회/이벤트', 'appointment', '동호회/이벤트', 10, 120),
    T('비밀 약속', 'appointment', '[비밀] 약속', 19, 120),
    // 고정/반복
    T('알레르기 약 복용', 'fixed', '알레르기 약 복용 (d###)', 9, 0),
    T('약 복용 날짜 기록', 'fixed', '약 복용 yyyy-mm-dd', 9, 0),
    T('정기작업', 'fixed', '[정기작업] (d###) yyyy-mm-dd', 9, 0),
  ];
}
