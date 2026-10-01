PYTHON ?= python3
.PHONY: run stop restart test
run:
	$(PYTHON) server.py start
stop:
	$(PYTHON) server.py stop
restart:
	$(PYTHON) server.py stop
	$(PYTHON) server.py start
test:
	$(PYTHON) -m unittest discover -s tests -v
	node tests/focus.mjs
	node --check public/js/main.js
	node --check public/js/scene.js
	node --check public/js/focus.js
