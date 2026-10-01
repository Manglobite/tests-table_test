.PHONY: run stop restart test check

run:
	python3 -B server.py run

stop:
	python3 -B server.py stop

restart:
	python3 -B server.py restart

check:
	python3 -B tests/check.py
	@for file in public/js/*.js tests/*.mjs; do node --check "$$file" || exit 1; done

test: check
	node --test tests/*.mjs
	python3 -B -m unittest discover -s tests -p 'test_*.py' -v
