SHELL := /bin/sh
.DEFAULT_GOAL := help

SEED ?= 20260813
LEAN_DIR := lean
PYTHON ?= python3
LAKE ?= lake
CORE := $(CURDIR)/scripts/imba-core
RUNNER := $(CURDIR)/scripts/run
UI_RUNNER := $(CURDIR)/scripts/run-ui

.PHONY: help build build-lean ping run demo ui ui-api test test-lean test-python contract audit clean

help:
	@echo "make build          Build the authoritative Lean core"
	@echo "make ping           Check the Lean/Python process contract"
	@echo "make run SEED=N     Start a reproducible terminal run"
	@echo "make demo SEED=N    Run the deterministic demo"
	@echo "make ui SEED=N      Start the local graphical interface"
	@echo "make test           Run Lean, Python, contract, and authority checks"
	@echo "make audit          Check Python does not reimplement core rules"

build: build-lean

build-lean:
	cd $(LEAN_DIR) && $(LAKE) build

ping: build-lean
	$(CORE) ping

run: build-lean
	IMBA_SEED=$(SEED) $(RUNNER)

demo: build-lean
	IMBA_SEED=$(SEED) $(RUNNER) --demo

ui: build-lean
	IMBA_SEED=$(SEED) PYTHON=$(PYTHON) $(UI_RUNNER)

ui-api: build-lean
	PYTHONPATH=python IMBA_CORE="$(CORE)" $(PYTHON) -m imba.web \
		--core "$(CORE)" --seed $(SEED)

test: test-lean test-python contract audit

test-lean:
	cd $(LEAN_DIR) && $(LAKE) build

test-python: build-lean
	PYTHONPATH=python IMBA_CORE="$(CORE)" $(PYTHON) -m unittest discover -s python/tests -v

contract: build-lean
	$(CORE) ping
	$(CORE) name 5
	$(CORE) beats 5 4
	$(CORE) beats 4 5
	$(CORE) fuse 4 4
	$(CORE) promote 4 2
	$(CORE) defense-roll 20260813 1 5
	$(CORE) defense-resolve 20260813 1 5 XY
	$(CORE) defense-mastery 3 RIFT 100 100
	$(CORE) first-strike 3 8 2 0
	$(CORE) tension-carry 8 3 2
	$(CORE) living-admit 0 0 0 0 3 2 XY
	$(CORE) certificate-admit 20260813 4 5 6
	$(CORE) tick-stage 4 5 4
	$(CORE) combat-admit 20260813 0 0 1 0 PLAYER ATTACK 21
	$(CORE) combat-admit 20260813 3 99 2 99 NATURE ATTACK 4
	$(CORE) world-react 20260813 2 4 100 100 30 0 0 21
	$(CORE) world-balance 20260813 2 5 100 100 30 0 0 12 20
	$(CORE) progress-observe 0 0 0 REDISTRIBUTION
	$(CORE) progress-unlock 4 0 1 FORECAST
	$(CORE) spell-law 20260813 1 1 1 0 0
	$(CORE) spell-cast 20260813 1 1 1 0 0 SHADOW RELEASE ECHO DORMANT
	$(CORE) spell-repair 20260813 1 2 9 8 0 MEMORY RELEASE ECHO VEIL
	$(CORE) journey 20260813 4

audit:
	@status=0; \
	grep -REn --include='*.py' \
		'(def[[:space:]]+beats|[[:alnum:]_]*rank[[:alnum:]_]*[[:space:]]*>[[:space:]]*[[:alnum:]_]*rank|[.]rank[[:space:]]*>[[:space:]]*[^=])' \
		python/imba || status=$$?; \
	if [ $$status -eq 0 ]; then \
		echo "ERROR: possible Python reimplementation of beats" >&2; exit 1; \
	elif [ $$status -ne 1 ]; then \
		echo "ERROR: authority audit could not run" >&2; exit $$status; \
	fi
	@echo "authority audit: no Python beats implementation detected"

clean:
	cd $(LEAN_DIR) && $(LAKE) clean
