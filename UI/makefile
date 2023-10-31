page=app
port=4507

test: bundle
	file_server ./deploy

bundle:
	deno bundle --config=./deno.json $(page).test.tsx deploy/main.mjs

app: build-pwa
	file_server --port=$(port) ./.build-pwa

compile-all-tests:
	deno run --allow-read --allow-env --allow-write --allow-net _compile-ui-tests.ts

build-extension:
	deno run --allow-read --allow-env --allow-write --allow-net build-extension.ts

build-pwa:
	deno run --allow-read --allow-env --allow-write --allow-net build-pwa.ts
