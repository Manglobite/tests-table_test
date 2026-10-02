SHELL := /bin/bash

.PHONY: run stop restart test

run:
	@./scripts/server.sh run

stop:
	@./scripts/server.sh stop

restart:
	@./scripts/server.sh restart

test:
	@python3 -m unittest discover -s tests -v
