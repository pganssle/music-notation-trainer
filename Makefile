# Makefile for the Music Trainer app

# Variables
JEKYLL = jekyll

# Targets
.PHONY: all build serve clean assets

all: build

build: assets
	$(JEKYLL) build

serve: assets
	$(JEKYLL) serve

clean:
	rm -rf _site

assets:
	./scripts/download_assets.sh

test:
	@echo "Opening tests.html in your browser..."
	@python -m webbrowser -t "tests.html"
