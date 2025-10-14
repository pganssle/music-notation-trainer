JEKYLL=bundle exec jekyll
SHELL=bash

# Targets
.PHONY: all serve clean clean-dist dev html

vendor/bundle:
	bundle config set --local path 'vendor/bundle'
	bundle install

clean:
	rm -rf _site

clean-dist:
	rm -rf assets/dist

assets/dist:
	npm install
	npm run build

dev: vendor/bundle assets/dist
	npm run build:dev
	$(JEKYLL) build

html: vendor/bundle assets/dist
	npm run build
	$(JEKYLL) build

# Rebuild both jekyll and npm on changes
serve: vendor/bundle assets/dist
	@trap 'kill 0' SIGINT; \
	npm run build:watch & \
	$(JEKYLL) serve -w & \
	wait

test: assets/dist
	@echo "Opening tests.html in your browser..."
	@python -m webbrowser -t "tests.html"
