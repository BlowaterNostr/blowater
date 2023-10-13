file = *
coverage_dir = cov_profile
test: clear-coverage
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
