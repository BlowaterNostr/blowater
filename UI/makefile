page=app
port=4507

test: bundle
	file_server ./deploy

bundle:
	deno bundle --config=./deno.json $(page).test.tsx deploy/main.mjs

app: bundle-app
	file_server --port=$(port) ./deploy

bundle-app:
	deno bundle --config=./deno.json _main.tsx deploy/main.mjs

compile-all-tests:
	deno run --allow-read --allow-env --allow-write --allow-net _compile-ui-tests.ts

build-extension:
	deno run --allow-read --allow-env --allow-write --allow-net deploy-extension.ts

build:
	deno run --allow-read --allow-env --allow-write --allow-net deploy.ts