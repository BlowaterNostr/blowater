# https://stackoverflow.com/questions/3931741/why-does-make-think-the-target-is-up-to-date
.PHONY: build-pwa build-extension

port=4507
file = *
coverage_dir = cov_profile

test: fmt clear-coverage
	deno test --config=deno.json --coverage=$(coverage_dir) --allow-net --allow-read --allow-env --trace-ops *.test.ts **/*.test.ts

test-core:
	deno test --config=deno.json --coverage=$(coverage_dir) --allow-net --trace-ops $(file).test.ts

test-db:
	deno test --config=deno.json --coverage=$(coverage_dir) --allow-net --trace-ops database.test.ts

test-features: clear-coverage
	deno test --config=deno.json --coverage=$(coverage_dir) --allow-net --trace-ops features/$(file).test.ts

cov:
	deno coverage cov_profile --lcov --output=cov_profile.lcov
	genhtml --ignore-errors unmapped -o cov_profile/html cov_profile.lcov
	file_server -p 4508 cov_profile/html

fmt:
	deno fmt

fmt-check:
	deno fmt --check

install: install-tauri
	deno install --allow-net --allow-read https://deno.land/std@0.178.0/http/file_server.ts

install-tauri:
	cargo install tauri-cli create-tauri-app

cache:
	rm -f deno.lock
	deno cache -r app/UI/_main.tsx
	deno cache -r *.ts

clear-coverage:
	rm -rf $(coverage_dir)

stats:
	cd DevOps && deno run --unstable --allow-net --allow-write --allow-read stats.ts


# build the web application
build: fmt
	deno run \
		--allow-env \
		--allow-read \
		--allow-run \
		--allow-write=/var/folders \
		_esbuild.ts
	cp -rv app/UI/assets/ build-pwa/

# in github action
build-ci: fmt
	deno lint
	deno run \
		--allow-env \
		--allow-read \
		--allow-run \
		--allow-write \
		_esbuild.ts
	cp -rv app/UI/assets/ build-pwa/

test-ui: fmt
	deno lint
	deno run \
	--allow-env \
	--allow-read \
	--allow-run \
	--allow-write=/var/folders \
	_compile-ui-tests.ts $(page)
	cp -rv app/UI/assets/ build-pwa/
	file_server -p $(port) build-pwa

dev: build
	file_server -p $(port) build-pwa

compile-all-ui-tests:
	deno run --allow-read --allow-env \
		--allow-run \
		--allow-write=--allow-write=/var/folders \
		--allow-net \
		_compile-ui-tests.ts

# in github aciton
compile-all-ui-tests-ci:
	deno run --allow-read --allow-env \
		--allow-run \
		--allow-write \
		--allow-net \
		_compile-ui-tests.ts

# build the tauri application
tauri-dev: build icon
	cargo tauri dev

tauri-build-mac: build icon
	cd tauri-app/src-tauri && cargo tauri build --target universal-apple-darwin

icon:
	cargo tauri icon app/UI/assets/logo.webp
