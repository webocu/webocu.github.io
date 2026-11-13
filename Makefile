# =============================================================================
#  webocu.github.io - Homebrew Channel catalog for the WebOCU apps
#  Needs Node >= 20 and nothing else (no npm packages).
#
#  make            list the targets
#  make check      validate apps.json; fail if repo.json / index.html are stale
#  make build      regenerate repo.json and index.html from apps.json
#  make verify     every ipkUrl still serves the file apps.json describes
# =============================================================================
NODE ?= node
APP  ?=

.DEFAULT_GOAL := help

.PHONY: help
help: ## List all available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

.PHONY: sync
sync: ## Fill sha256/size of an app from its release (APP=webocu.dock [VERSION=x.y.z] [FILE=app.ipk] [ICON=1])
	@test -n "$(APP)" || { echo "usage: make sync APP=<id> [VERSION=x.y.z] [FILE=path.ipk] [ICON=1]"; exit 2; }
	$(NODE) tools/sync.mjs $(APP) $(if $(VERSION),--version $(VERSION)) $(if $(FILE),--file $(FILE)) $(if $(ICON),--icon)

.PHONY: build
build: ## Regenerate repo.json and index.html from apps.json
	$(NODE) tools/build.mjs

.PHONY: check
check: ## Validate apps.json and that the generated files are up to date
	$(NODE) tools/build.mjs --check

.PHONY: verify
verify: ## Online: release assets match the catalog (LIVE=1 also checks the published site)
	$(NODE) tools/verify.mjs $(if $(LIVE),--live)
