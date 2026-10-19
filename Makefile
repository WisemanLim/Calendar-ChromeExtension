# Wise Calendar — Chrome Extension
# 의존성 없음(Vanilla JS, MV3). 시험: Node 20+ 내장 test runner. E2E: Playwright(별도 설치, README 참고).

VERSION := $(shell node -p "require('./manifest.json').version")
EXT_FILES := manifest.json app.html background.js css js icons

.PHONY: test lint e2e package clean

test:
	node --test "test/unit/*.test.mjs"

lint:
	@node -e 'JSON.parse(require("fs").readFileSync("manifest.json"))' && echo "manifest.json OK"
	@for f in background.js $$(find js -name '*.js'); do node --check $$f || exit 1; done && echo "JS syntax OK"

e2e:
	node test/e2e/run.mjs test/e2e/out

package: lint
	@mkdir -p dist
	@rm -f dist/wise-calendar-$(VERSION).zip
	zip -qr dist/wise-calendar-$(VERSION).zip $(EXT_FILES) -x '*.DS_Store'
	@echo "dist/wise-calendar-$(VERSION).zip"

clean:
	rm -rf dist test/e2e/out
