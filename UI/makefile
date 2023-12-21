# https://stackoverflow.com/questions/3931741/why-does-make-think-the-target-is-up-to-date
.PHONY: build-pwa build-extension
page=app
port=4507

test: bundle
	file_server ./deploy

bundle:
	deno bundle --config=./deno.json $(page).test.tsx deploy/main.mjs

app: fmt build-pwa
	file_server --port=$(port) ./build-pwa

compile-all-tests:
	deno run --allow-read --allow-env --allow-write --allow-net _compile-ui-tests.ts

build-extension:
	deno run --allow-read --allow-env --allow-write --allow-net _build-extension.ts

build-pwa:
	deno run --allow-read --allow-env --allow-write --allow-net _build-pwa.ts

fmt:
	deno fmt --options-indent-width 4 --options-line-width 110
