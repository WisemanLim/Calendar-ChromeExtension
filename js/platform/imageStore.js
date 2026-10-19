// 이벤트별 사진 저장소 — iOS EventImageStore 대응. JPEG dataURL 을 chrome.storage 에 eventId 별로 보관.
import * as storage from './storage.js';

const key = (eventId) => `eventImage.${eventId}`;

export const saveImage = (eventId, dataUrl) => storage.set(key(eventId), dataUrl);
/** 반복 발생 id(`master@yyyy-MM-dd`)는 master 사진으로 폴백 — iOS 반복 이벤트 공통 eventIdentifier 동작. */
export async function loadImage(eventId) {
  const own = await storage.get(key(eventId), null);
  const at = eventId.indexOf('@');
  return own ?? (at > 0 ? storage.get(key(eventId.slice(0, at)), null) : null);
}
export const removeImage = (eventId) => storage.remove(key(eventId));

/** 이미지 파일 → 최대 maxSide px, JPEG 0.8 dataURL (브라우저 전용). */
export async function compressImage(file, maxSide = 1024) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}
