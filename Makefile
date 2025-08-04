JEKYLL=bundle exec jekyll
SHELL=bash

# Targets
.PHONY: all serve clean clean-dist

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

html: vendor/bundle
	$(JEKYLL) build

serve: vendor/bundle assets/dist
	$(JEKYLL) serve -w

test: assets/dist
	@echo "Opening tests.html in your browser..."
	@python -m webbrowser -t "tests.html"
