file = *
coverage_dir = cov_profile
run:
	deno run --allow-net test.ts

test: clear-coverage
	deno test --config=deno.json --coverage=$(coverage_dir) --allow-net --allow-read --allow-env --trace-ops *.test.ts **/*.test.ts

test-core:
	deno test --config=deno.json --coverage=$(coverage_dir) --allow-net --trace-ops $(file).test.ts

test-ws:
	deno test --config=deno.json --coverage=$(coverage_dir) --allow-net --trace-ops websocket.test.ts

test-db:
	deno test --config=deno.json --coverage=$(coverage_dir) --allow-net --trace-ops database.test.ts

test-features:
	deno test --config=deno.json --coverage=$(coverage_dir) --allow-net --trace-ops features/$(file).test.ts

coverage:
	deno coverage cov_profile

fmt:
	deno fmt --options-indent-width 4 --options-line-width 110

fmt-check:
	deno fmt --options-indent-width 4 --check --options-line-width 110

install:
	deno install --allow-net --allow-read https://deno.land/std@0.178.0/http/file_server.ts

cache:
	rm -f deno.lock UI/deno.lock
	cd UI && deno cache -r _main.tsx
	deno cache -r *.ts

clear-coverage:
	rm -rf $(coverage_dir)

stats:
	cd DevOps && deno run --unstable --allow-net --allow-write --allow-read stats.ts
