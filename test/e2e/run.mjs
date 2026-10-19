// E2E — 압축해제 확장을 Chromium 에 실제 로드해 app.html(팝업/사이드패널)을 구동한다.
// 사용: PLAYWRIGHT=<playwright 모듈 경로> [CHROMIUM_PATH=<Chromium 실행파일>] node test/e2e/run.mjs [출력디렉터리]
//   (playwright 는 프로젝트 의존성이 아님 — 별도 설치 경로를 지정. README 참고)
// Open-Meteo 는 route 로 목 응답, 위치는 서울 고정.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.resolve(process.argv[2] ?? path.join(EXT, 'test/e2e/out'));
mkdirSync(OUT, { recursive: true });

const results = [];
let page;
let ctx;
let extId;

const ONLY = process.env.E2E_ONLY?.split(',').map((x) => x.trim()).filter(Boolean);

async function check(epic, name, fn) {
  if (ONLY && !ONLY.some((k) => name.includes(k))) return; // 선택 실행 (E2E_ONLY=키워드1,키워드2)
  const t0 = Date.now();
  try {
    await fn();
    results.push({ epic, name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✔ [E${epic}] ${name}`);
  } catch (e) {
    results.push({ epic, name, ok: false, error: String(e?.message ?? e).split('\n')[0] });
    console.log(`  ✖ [E${epic}] ${name} — ${e?.message?.split('\n')[0]}`);
    await page?.screenshot({ path: path.join(OUT, `fail-${results.length}.png`) }).catch(() => {});
    await openApp().catch(() => {}); // 잔존 시트/메뉴 정리 후 다음 케이스
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => assert(a === b, `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date();
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const storageGet = (k) => page.evaluate((k) => chrome.storage.local.get(k).then((r) => r[k]), k);
const listTitles = () => page.$$eval('.hero .event-item .t', (els) => els.map((e) => e.textContent));
const ctxItem = (label) => page.locator('.ctx button').filter({ has: page.locator('span', { hasText: new RegExp(`^${label.replace(/[()]/g, '\\$&')}$`) }) });
const sheetTitle = () => page.locator('.sheet .navbar .c').last().textContent();
const saveBtn = () => page.locator('.sheet').last().locator('.navbar .r button[data-role="save"]');
async function saveAndWait() {
  const n = await page.locator('.sheet').count();
  await saveAndWait();
  await page.waitForFunction((n) => document.querySelectorAll('.sheet').length < n, n);
  await page.waitForTimeout(150);
}
async function ensureSettings() {
  if (!(await page.locator('.sheet .navbar .c', { hasText: '설정' }).count())) await page.locator('.icon-btn[aria-label="설정"]').click();
}

async function dragX(selector, dx, { steps = 8, dy = 0 } = {}) {
  const box = await page.locator(selector).first().boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 80);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

async function openApp(query = '') {
  await page.goto(`chrome-extension://${extId}/app.html${query}`);
  await page.waitForSelector('.main');
  await page.waitForFunction(() => window.__wc);
}

async function selectDay(d) {
  // 메인 상태를 직접 이동 (UI 경로는 별도 케이스에서 검증)
  await page.evaluate((ms) => window.__wc.view.select(new Date(ms)), +d);
  await page.waitForTimeout(100);
}

async function main() {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'wc-e2e-'));
  ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
    viewport: { width: 380, height: 600 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    geolocation: { latitude: 37.5665, longitude: 126.978 },
    permissions: ['geolocation', 'notifications', 'clipboard-read', 'clipboard-write'],
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent('serviceworker');
  extId = new URL(sw.url()).host;
  console.log(`extension id: ${extId}`);

  // Open-Meteo 목: 오늘 기준 -7 ~ +15 일
  await ctx.route('https://api.open-meteo.com/**', (route) => {
    const time = [];
    const codes = [];
    const temps = [];
    for (let i = -7; i <= 15; i++) {
      time.push(key(addDays(today, i)));
      codes.push([0, 2, 3, 61, 71][(i + 7) % 5]);
      temps.push(20 + (i % 5));
    }
    route.fulfill({ json: { daily: { time, weather_code: codes, temperature_2m_max: temps } } });
  });

  page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  if (process.env.E2E_DEBUG) {
    page.on('console', (m) => console.log('    [console]', m.type(), m.text()));
    page.on('close', () => console.log('    [page closed]'));
    page.on('framenavigated', (f) => console.log('    [nav]', f.url()));
    ctx.on('page', (p) => console.log('    [new page]', p.url()));
  }
  await openApp();

  // ───────── Epic 6: 온보딩 ─────────
  console.log('Epic 6 — 온보딩');
  await check(6, '최초 실행 시 온보딩 4단계 → 시작하기', async () => {
    await page.waitForSelector('.onb');
    await page.screenshot({ path: path.join(OUT, '01-onboarding.png') });
    await page.locator('.onb .mode', { hasText: '개인 이벤트' }).click();
    for (let i = 0; i < 3; i++) await page.locator('.onb .cta', { hasText: '다음' }).click();
    eq(await page.locator('.onb h1').textContent(), '연동 & 알림', '4단계 제목');
    await page.locator('.onb .cta', { hasText: '시작하기' }).click();
    await page.locator('.onb').waitFor({ state: 'detached', timeout: 5000 });
    eq(await storageGet('settings.onboardingCompleted'), true, 'onboardingCompleted');
    eq(await storageGet('settings.lastSeenVersion'), '1.0.0', 'lastSeenVersion');
    eq(await storageGet('settings.plannerMode'), 'personalEvent', '선택 모드 저장');
  });
  await check(6, '재실행 시 온보딩 미노출', async () => {
    await openApp();
    await page.waitForTimeout(300);
    eq(await page.locator('.onb').count(), 0, '온보딩 없음');
  });

  // ───────── Epic 3: 메인 UI ─────────
  console.log('Epic 3 — 메인 캘린더');
  await check(3, '헤더: 연도·MONTH YEAR·Today 미노출(오늘)', async () => {
    eq(await page.locator('.year-num').textContent(), String(today.getFullYear()), '연도');
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    eq(await page.locator('.row2 .title').textContent(), `${months[today.getMonth()]} ${today.getFullYear()}`, '월 헤더');
    eq(await page.locator('.today-btn').count(), 0, 'Today 숨김');
  });
  await check(3, '주간 스트립 7셀(일~토) + 선택일 강조 + 날씨 아이콘(Open-Meteo)', async () => {
    eq(await page.locator('.week .cell').count(), 7, '7셀');
    eq(await page.locator('.week .wd').first().textContent(), 'SUN', '일요일 시작');
    eq(await page.locator(`.week .cell[data-date="${key(today)}"] .num.selected`).count(), 1, '선택일');
    await page.waitForFunction(() => Object.keys(window.__wc.ctx.weather.dailyWeather).length > 0);
    await page.evaluate(() => window.__wc.view.render());
    const wx = await page.locator('.week .wx').allTextContents();
    assert(wx.some((t) => /[☀️⛅☁️🌧️❄️]/u.test(t)), `날씨 아이콘: ${wx}`);
    assert((await page.locator('.info-bar .temp').textContent()).endsWith('°'), '최고기온 표시');
    assert(await storageGet('wc.lastFetchDate'), '갱신일 저장');
  });
  await check(3, '음력 표시 (정보 바 좌측)', async () => {
    assert(/^음력 (윤)?\d+월 \d+일$/.test(await page.locator('.info-bar .lunar').textContent()), '음력 형식');
  });
  await check(3, '월 이동 › → Today 노출 → Today 복귀', async () => {
    await page.locator('.row2 .nav-btn').last().click();
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    assert((await page.locator('.row2 .title').textContent()).includes(String(next.getFullYear())), '다음 달');
    await page.locator('.today-btn').click();
    eq(await page.locator('.today-btn').count(), 0, 'Today 복귀');
  });
  await check(3, '연 이동 ›/‹', async () => {
    await page.locator('.year .nav-btn').last().click();
    eq(await page.locator('.year-num').textContent(), String(today.getFullYear() + 1), '+1년');
    await page.locator('.year .nav-btn').first().click();
    eq(await page.locator('.year-num').textContent(), String(today.getFullYear()), '원복');
    await page.locator('.today-btn').click().catch(() => {});
  });
  await check(3, '미니 달력 2개(현재·다음 월) + 날짜 클릭 선택', async () => {
    eq(await page.locator('.minis .month').count(), 2, '2개월');
    const target = addDays(today, 3);
    await page.locator(`.minis .day[data-date="${key(target)}"]`).first().click();
    eq(await page.locator('.hero-num.cur .d').textContent(), String(target.getDate()), '히어로 날짜');
    await page.locator('.today-btn').click();
  });
  await check(3, '히어로 좌 스와이프 → 익일, 우 스와이프 → 전일', async () => {
    await dragX('.hero', -200);
    eq(await page.locator('.hero-num.cur .d').textContent(), String(addDays(today, 1).getDate()), '익일');
    await dragX('.hero', 200);
    eq(await page.locator('.hero-num.cur .d').textContent(), String(today.getDate()), '복귀');
  });
  await check(3, '주간 스트립 스와이프 ±7일', async () => {
    await dragX('.week', -120);
    eq(await page.locator(`.week .cell[data-date="${key(addDays(today, 7))}"] .num.selected`).count(), 1, '+7');
    await dragX('.week', 120);
    eq(await page.locator(`.week .cell[data-date="${key(today)}"] .num.selected`).count(), 1, '-7');
  });
  await check(3, '미니 달력 스와이프 → 월 이동', async () => {
    const before = await page.locator('.row2 .title').textContent();
    await dragX('.minis', -120);
    assert((await page.locator('.row2 .title').textContent()) !== before, '월 변경');
    await page.locator('.today-btn').click();
  });

  // ───────── Epic 4: 에디터 ─────────
  console.log('Epic 4 — 이벤트 에디터');
  await check(4, '개인이벤트 ＋: 복용 아침 약 → 프리셋·자동 yearly 저장', async () => {
    await page.locator('.add-btn').click();
    eq(await sheetTitle(), '새 개인 이벤트', '시트 제목');
    assert(await saveBtn().isDisabled(), '템플릿 전 저장 비활성');
    const names = await page.locator('.sheet .section').nth(1).locator('.row').allTextContents();
    eq(names.length, 4, '복용 템플릿 4개');
    await page.locator('.sheet .row', { hasText: '아침 약 복용' }).click();
    eq(await page.locator('.sheet input[aria-label="제목"]').inputValue(), '아침 약 복용', '제목 프리필');
    eq(await page.locator('.sheet .chip.on').first().textContent(), '아침', '프리셋 아침');
    eq(await page.locator('.sheet input[aria-label="복용 시간"]').inputValue(), '07:00', '07:00');
    await page.screenshot({ path: path.join(OUT, '04-editor-medication.png') });
    await saveAndWait();
    await page.waitForSelector('.hero .event-item');
    assert((await listTitles()).includes('07:00 아침 약 복용'), '목록 표시');
    const evs = await storageGet('events.local.v1');
    eq(evs.at(-1).rule?.freq, 'yearly', '자동 yearly');
  });
  await check(4, '약속: 비밀 약속 + 장소 → [비밀] 흐린 표시(opacity .25)', async () => {
    await page.locator('.add-btn').click();
    await page.locator('.sheet .segment button', { hasText: '약속' }).click();
    await page.locator('.sheet .row', { hasText: '[비밀] 약속' }).click();
    await page.locator('.sheet input[aria-label="장소"]').fill('강남역');
    await saveAndWait();
    const item = page.locator('.hero .event-item', { hasText: '[비밀] 약속' });
    await item.waitFor();
    eq(await item.evaluate((e) => getComputedStyle(e).opacity), '0.25', 'opacity');
    const evs = await storageGet('events.local.v1');
    eq(evs.at(-1).location, '강남역', '장소');
    eq(evs.at(-1).end - evs.at(-1).start, 120 * 60000, '120분');
  });
  await check(4, '고정: 정기작업 반복 + 개별 등록 → 날짜별 패턴 치환 이벤트 3건', async () => {
    await page.locator('.add-btn').click();
    await page.locator('.sheet .segment button', { hasText: '고정/반복' }).click();
    await page.locator('.sheet .row', { hasText: '[정기작업] (d###) yyyy-mm-dd' }).click();
    await page.locator('.sheet .toggle span').click();
    assert((await page.locator('.sheet button', { hasText: '개별' }).textContent()).includes('☑'), '개별 기본 ON');
    await page.locator('.sheet .segment button', { hasText: '매일' }).click();
    await page.locator('.sheet input[aria-label="반복 종료일"]').fill(key(addDays(today, 2)));
    await page.locator('.sheet input[aria-label="반복 종료일"]').dispatchEvent('change');
    await page.screenshot({ path: path.join(OUT, '04-editor-fixed-repeat.png') });
    await saveAndWait();
    await page.waitForTimeout(300);
    const evs = (await storageGet('events.local.v1')).filter((e) => e.title.startsWith('[정기작업]'));
    eq(evs.length, 3, '3건');
    assert(evs.every((e) => e.rule === null), '반복 없음');
    const doy = (d) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / 864e5) + 1;
    eq(evs[1].title, `[정기작업] (${String(doy(addDays(today, 1))).padStart(3, '0')}) ${key(addDays(today, 1))}`, '익일 치환');
  });
  await check(4, '＋ 롱프레스 → 1회 입력방식 선택(현재 모드 제외) → 일기: 제목 자동·경과시간·시작/종료 기록', async () => {
    const box = await page.locator('.add-btn').boundingBox();
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await page.waitForSelector('.action-sheet');
    const opts = await page.locator('.action-sheet .grp').first().locator('button').allTextContents();
    eq(opts.join(','), '일기,업무 이벤트', '다른 모드만');
    eq(await page.locator('.sheet').count(), 0, '롱프레스 후 에디터 미오픈(탭 억제)');
    await page.locator('.action-sheet button', { hasText: '일기' }).click();
    eq(await sheetTitle(), '새 일기', '일기 에디터');
    const title = await page.locator('.diary input').inputValue();
    assert(/^\[\d{4}\.\d{2}\.\d{2}\][😀😊🤯]수고했어요\.$/u.test(title), `자동 제목 ${title}`);
    await page.locator('.diary textarea').fill('오늘은 확장 프로그램을 만들었다.');
    await page.waitForTimeout(1200);
    assert((await page.locator('.diary .elapsed').textContent()) >= '00:01', '경과 시간');
    await saveAndWait();
    const ev = (await storageGet('events.local.v1')).at(-1);
    eq(ev.notes, '오늘은 확장 프로그램을 만들었다.', '본문');
    assert(ev.end - ev.start >= 1000, '시작<종료');
    eq(await storageGet('settings.plannerMode'), 'personalEvent', '모드 불변');
  });
  await check(4, '히어로 더블클릭 → 에디터, 히어로 롱프레스 → 입력방식 선택', async () => {
    const box = await page.locator('.hero').boundingBox();
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height - 30);
    eq(await sheetTitle(), '새 개인 이벤트', '더블클릭 에디터');
    await page.locator('.sheet .navbar .l button').click();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 30);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await page.waitForSelector('.action-sheet');
    await page.locator('.action-sheet .cancel').click();
  });
  await check(4, '업무 이벤트 할 일(어제 기한) → 체크리스트 인코딩 + 기한 초과 적색', async () => {
    await selectDay(addDays(today, -1));
    await page.evaluate(() => window.__wc.view.openEditor('todo'));
    eq(await sheetTitle(), '새 업무 이벤트', '업무 에디터');
    eq(await page.locator('.sheet .segment').count(), 0, '분류 피커 없음');
    await page.locator('.sheet .row', { hasText: '할 일' }).first().click();
    assert(await page.locator('.sheet .caption.err', { hasText: '기한이 지났습니다' }).isVisible(), '기한 경고');
    assert(await saveBtn().isDisabled(), '항목 없으면 저장 불가');
    await page.locator('.sheet input[aria-label="항목 1"]').fill('보고서 제출');
    await page.locator('.sheet button', { hasText: '항목 추가' }).click();
    await page.locator('.sheet input[aria-label="항목 2"]').fill('메일 회신');
    await page.locator('.sheet .tick').nth(1).click();
    await saveAndWait();
    const ev = (await storageGet('events.local.v1')).at(-1);
    eq(ev.notes, '- [ ] 보고서 제출\n- [x] 메일 회신', 'notes 인코딩');
    eq(new Date(ev.start).getHours() * 100 + new Date(ev.start).getMinutes(), 2359, '기본 23:59');
    const item = page.locator('.hero .event-item.overdue');
    await item.waitFor();
    eq(await item.evaluate((e) => getComputedStyle(e).color), 'rgb(255, 59, 48)', '적색');
  });
  await check(4, '업무 이벤트 회의: 시작/종료 + 장소', async () => {
    await page.evaluate(() => window.__wc.view.openEditor('todo'));
    await page.locator('.sheet .row', { hasText: '회의' }).click();
    eq(await page.locator('.sheet input[aria-label="시작"]').inputValue(), '10:00', '10시');
    await page.locator('.sheet input[aria-label="장소"]').fill('본사 3층');
    await saveAndWait();
    const ev = (await storageGet('events.local.v1')).at(-1);
    eq(ev.location, '본사 3층', '장소');
    eq(ev.end - ev.start, 3600000, '60분');
  });
  await check(4, '복용 사진 첨부(파일) → 미리보기 → 저장 시 eventImage 보관 + 편집 화면 표시', async () => {
    await page.locator('.today-btn').click();
    await page.locator('.add-btn').click();
    await page.locator('.sheet .row', { hasText: '저녁 약 복용' }).click();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
    await page.locator('.sheet input[type="file"]').setInputFiles({ name: 'pill.png', mimeType: 'image/png', buffer: png });
    await page.locator('.sheet img.photo').waitFor();
    await saveAndWait();
    const ev = (await storageGet('events.local.v1')).at(-1);
    const img = await storageGet(`eventImage.${ev.id}`);
    assert(img?.startsWith('data:image/jpeg'), 'JPEG dataURL 저장');
    await page.locator('.hero .event-item', { hasText: '저녁 약 복용' }).click();
    await page.locator('.sheet img.photo').waitFor();
    await page.locator('.sheet .navbar .l button').click();
  });
  await check(7, '알림 ON + 미래 이벤트 저장 → 당일 09:00 chrome.alarms 예약', async () => {
    await page.evaluate(() => window.__wc.ctx.settings.set('notificationsEnabled', true));
    await selectDay(addDays(today, 5));
    await page.locator('.add-btn').click();
    await page.locator('.sheet .segment button', { hasText: '약속' }).click();
    await page.locator('.sheet .row', { hasText: '친구와 약속' }).click();
    await saveAndWait();
    await page.waitForTimeout(200);
    const alarms = await page.evaluate(() => chrome.alarms.getAll());
    const a = alarms.find((x) => x.name.startsWith('wc-remind:'));
    assert(a, '알람 존재');
    const when = new Date(a.scheduledTime);
    eq(`${key(when)} ${when.getHours()}:${when.getMinutes()}`, `${key(addDays(today, 5))} 9:0`, '09:00');
    eq((await storageGet(a.name))?.title, '친구와 약속', '알림 본문');
  });
  await check(7, '서비스 워커: 알람 발화 → chrome.notifications 생성', async () => {
    const sw2 = ctx.serviceWorkers()[0];
    const ids = await sw2.evaluate(async () => {
      await chrome.storage.local.set({ 'wc-remind:test': { title: '테스트 알림' } });
      await chrome.alarms.create('wc-remind:test', { when: Date.now() + 50 });
      await new Promise((r) => setTimeout(r, 1500));
      return Object.keys(await chrome.notifications.getAll());
    });
    assert(ids.includes('wc-remind:test'), `알림 생성 ${ids}`);
  });

  // ───────── Epic 5: 수정/복사/삭제/검색 ─────────
  console.log('Epic 5 — 수정·복사·삭제·검색');
  await page.locator('.today-btn').click().catch(() => {});
  await check(5, '이벤트 클릭 → 편집: 시작 변경 시 종료 = 원본 간격 유지', async () => {
    await page.locator('.hero .event-item', { hasText: '[비밀] 약속' }).click();
    eq(await sheetTitle(), '일정 편집', '편집 시트');
    const s = page.locator('.sheet input[aria-label="시작"]');
    const v = await s.inputValue();
    await s.fill(v.replace(/T\d\d:\d\d/, 'T20:30'));
    await s.dispatchEvent('change');
    eq((await page.locator('.sheet input[aria-label="종료"]').inputValue()).slice(-5), '22:30', '종료 자동 +2h');
    await page.locator('.sheet input[aria-label="제목"]').fill('[비밀] 약속 (변경)');
    await saveAndWait();
    await page.locator('.hero .event-item', { hasText: '20:30 [비밀] 약속 (변경)' }).waitFor();
  });
  await check(5, '우클릭 컨텍스트 메뉴 → 복사(내용제외) → 목표 날짜', async () => {
    await page.locator('.hero .event-item', { hasText: '[비밀] 약속 (변경)' }).click({ button: 'right' });
    const items = await page.locator('.ctx button').allTextContents();
    eq(items.length, 5, '메뉴 5개');
    await ctxItem('복사 (내용제외)').click();
    eq(await sheetTitle(), '이벤트 복사', '복사 시트');
    const d = page.locator('.sheet input[aria-label="복사 날짜"]');
    await d.fill(key(addDays(today, 10)));
    await d.dispatchEvent('change');
    await saveAndWait();
    await selectDay(addDays(today, 10));
    assert((await listTitles()).includes('20:30 [비밀] 약속 (변경)'), '복사본');
  });
  await check(5, '롱프레스 메뉴 → 반복복사(내용포함) 3일', async () => {
    const item = page.locator('.hero .event-item').first();
    const box = await item.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 5);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await ctxItem('반복복사 (내용포함)').click();
    eq(await sheetTitle(), '반복 복사', '반복 복사 시트');
    await page.locator('.sheet input[aria-label="시작일"]').fill(key(addDays(today, 20)));
    await page.locator('.sheet input[aria-label="시작일"]').dispatchEvent('change');
    await page.locator('.sheet input[aria-label="종료일"]').fill(key(addDays(today, 22)));
    await page.locator('.sheet input[aria-label="종료일"]').dispatchEvent('change');
    await saveAndWait();
    for (const n of [20, 21, 22]) {
      await selectDay(addDays(today, n));
      eq((await listTitles()).length, 1, `D+${n}`);
    }
  });
  await check(5, '반복 이벤트 발생 단건 삭제(해당일만)', async () => {
    await selectDay(today);
    await page.locator('.hero .event-item', { hasText: '아침 약 복용' }).click({ button: 'right' });
    await ctxItem('삭제').click();
    await page.waitForTimeout(200);
    assert(!(await listTitles()).some((t) => t.includes('아침 약 복용')), '오늘 삭제');
    await page.locator('.year .nav-btn').last().click(); // 다음 해 같은 달 → 같은 날로 이동
    await selectDay(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()));
    assert((await listTitles()).some((t) => t.includes('아침 약 복용')), '내년 발생 유지');
    await page.locator('.today-btn').click();
  });
  await check(5, '검색: 제목·메모 → 결과 클릭 → 해당 날짜 이동 / 결과 없음', async () => {
    await page.locator('.icon-btn[aria-label="이벤트 검색"]').click();
    await page.locator('.sheet input[type="search"]').fill('메일 회신');
    await page.locator('.sheet .results .row').first().waitFor();
    await page.locator('.sheet .results .row').first().click();
    eq(await page.locator('.hero-num.cur .d').textContent(), String(addDays(today, -1).getDate()), '어제로 이동');
    await page.locator('.icon-btn[aria-label="이벤트 검색"]').click();
    await page.locator('.sheet input[type="search"]').fill('존재하지않는검색어');
    await page.locator('.sheet .caption', { hasText: '검색 결과 없음' }).waitFor();
    await page.locator('.sheet .navbar .l button').click();
    await page.locator('.today-btn').click();
  });
  await check(3, '이벤트 수 무지개 색: 미니 달력 숫자·점 + 히어로', async () => {
    const cnt = await page.evaluate(() => window.__wc.ctx.events.countFor(new Date()));
    assert(cnt >= 1, `count ${cnt}`);
    const cell = page.locator(`.minis .day[data-date="${key(today)}"]`).first();
    eq(await cell.getAttribute('data-count'), String(cnt), 'data-count');
    assert(await cell.locator('i').count(), '이벤트 점');
    const color = await page.locator('.hero-num.cur').evaluate((e) => e.style.color);
    assert(color.includes('0.28'), `히어로 opacity 0.28: ${color}`);
  });
  await check(3, '아래로 당기기 → 새로고침(날씨 강제 재조회)', async () => {
    const before = await storageGet('wc.lastFetchDate');
    await page.waitForTimeout(20);
    const box = await page.locator('.hero').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 200, { steps: 10 });
    await page.mouse.up();
    await page.locator('.toast', { hasText: '새로고침' }).waitFor();
    assert((await storageGet('wc.lastFetchDate')) > before, '재조회');
  });

  // ───────── Epic 6: 설정·고객지원 ─────────
  console.log('Epic 6 — 설정·고객지원');
  await check(6, '설정: 입력 방식 변경 영속 + 설명', async () => {
    await page.locator('.icon-btn[aria-label="설정"]').click();
    await page.selectOption('.sheet select[aria-label="입력 방식"]', 'diary');
    eq(await storageGet('settings.plannerMode'), 'diary', '저장');
    assert((await page.locator('.sheet .caption').first().textContent()).includes('일기장처럼'), '설명');
    await page.screenshot({ path: path.join(OUT, '06-settings.png') });
  });
  await check(6, '화면 테마 순환 system→dark→light→system', async () => {
    await ensureSettings();
    const btn = page.locator('.sheet .navbar .icon-btn[aria-label="화면 테마 전환"]');
    await btn.click();
    eq(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'dark');
    eq(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(0, 0, 0)', '다크 배경');
    await page.screenshot({ path: path.join(OUT, '06-settings-dark.png') });
    await btn.click();
    eq(await page.evaluate(() => document.documentElement.dataset.theme), 'light', 'light');
    await btn.click();
    eq(await page.evaluate(() => document.documentElement.dataset.theme), undefined, 'system');
    eq(await storageGet('settings.appColorScheme'), 'system', '영속');
  });
  await check(6, '알림 토글 OFF/ON 영속', async () => {
    await ensureSettings();
    await page.locator('.sheet .toggle[for], .sheet .toggle').first().click();
    eq(await storageGet('settings.notificationsEnabled'), false, 'OFF');
    await page.locator('.sheet .toggle').first().click();
    eq(await storageGet('settings.notificationsEnabled'), true, 'ON');
  });
  await check(8, 'Google 연동: 브라우저 로그인 계정 권한 요청 화면 · client ID 입력 → 권한 요청 버튼', async () => {
    await ensureSettings();
    await page.locator('.sheet .row[role="radio"]', { hasText: 'Google Calendar' }).click();
    await page.locator('.sheet .navbar .c', { hasText: 'Google Calendar 연동' }).waitFor();
    const body = () => page.locator('.sheet').last().textContent();
    assert((await body()).includes('브라우저 로그인 계정'), '로그인 계정 섹션');
    assert((await body()).includes('calendar.events'), '요청 권한');
    const extId = await page.evaluate(() => chrome.runtime.id);
    assert((await body()).includes(extId), '확장 ID 안내');
    assert((await body()).includes(`https://${extId}.chromiumapp.org/`), '리디렉션 URI 안내');
    const req = page.locator('.sheet').last().locator('[aria-label="권한 요청"]');
    assert((await req.textContent()).includes('클라이언트 ID 입력 후'), 'client ID 없을 때 안내 문구');
    await req.click();
    await page.locator('.sheet .caption.err', { hasText: '먼저 입력' }).waitFor();
    await page.locator('.sheet input[aria-label="OAuth 클라이언트 ID"]').fill('123-test.apps.googleusercontent.com');
    await page.locator('.sheet').last().locator('.btn-link', { hasText: '권한 요청' }).waitFor();
    await page.locator('.sheet').last().locator('.navbar .l button').click(); // blur 없이 바로 뒤로
    await page.waitForTimeout(200);
    eq(await storageGet('settings.googleClientId'), '123-test.apps.googleusercontent.com', '붙여넣기 즉시 저장');
    await page.locator('.sheet .row[role="radio"]', { hasText: 'Google Calendar' }).click();
    eq(await page.locator('.sheet input[aria-label="OAuth 클라이언트 ID"]').inputValue(), '123-test.apps.googleusercontent.com', '재진입 시 값 유지');
    await page.screenshot({ path: path.join(OUT, '08-google-connect.png') });
    await page.locator('.sheet').last().locator('.navbar .l button').click();
    eq(await page.evaluate(() => window.__wc.ctx.settings.storageMode), 'local', '연결 전 로컬 유지');
  });
  await check(6, '고객지원: 도움말·FAQ·일반적인 문제·동기화·디버그 로그', async () => {
    await ensureSettings();
    await page.locator('.sheet .row.link', { hasText: '고객지원' }).click();
    eq(await sheetTitle(), '고객지원', '고객지원');
    for (const [link, title, text] of [
      ['도움말 센터', '도움말 센터', '이벤트 추가'],
      ['자주 묻는 질문', '자주 묻는 질문', 'Q. 알림이 오지 않아요.'],
      ['일반적인 문제', '일반적인 문제', '오전 9시'],
      ['동기화 문제 해결 안내서', '동기화 문제 해결', 'Google Calendar'],
      ['디버그 로그 보내기', '디버그 로그', 'Wise Calendar Debug Info'],
    ]) {
      await page.locator('.sheet .row.link', { hasText: link }).last().click();
      eq(await sheetTitle(), title, link);
      assert((await page.locator('.sheet').last().textContent()).includes(text), `${link} 내용`);
      if (link === '디버그 로그 보내기') await page.screenshot({ path: path.join(OUT, '06-debug-log.png') });
      await page.locator('.sheet').last().locator('.navbar .l button').click();
    }
    assert((await page.locator('.sheet').last().textContent()).includes('1.0.0'), '버전');
  });
  await check(6, '사이드패널 페이지(app.html?view=panel) 렌더', async () => {
    await page.setViewportSize({ width: 420, height: 900 });
    await openApp('?view=panel');
    assert(await page.evaluate(() => document.body.classList.contains('panel')), 'panel class');
    eq(await page.locator('.icon-btn[aria-label="사이드패널로 열기"]').count(), 0, '패널에선 ⇥ 없음');
    await page.screenshot({ path: path.join(OUT, '06-sidepanel.png') });
    await page.setViewportSize({ width: 380, height: 600 });
    await openApp();
    eq(await page.locator('.icon-btn[aria-label="사이드패널로 열기"]').count(), 1, '팝업엔 ⇥');
  });
  await check(3, '메인 스크린샷 + 페이지 오류 없음', async () => {
    await page.screenshot({ path: path.join(OUT, '03-main.png') });
    eq(consoleErrors.length, 0, `pageerror: ${consoleErrors.join(' | ')}`);
  });

  await ctx.close();
  const pass = results.filter((r) => r.ok).length;
  writeFileSync(path.join(OUT, 'e2e-results.json'), JSON.stringify(results, null, 2));
  console.log(`\nE2E ${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await ctx?.close().catch(() => {});
  process.exit(2);
});
