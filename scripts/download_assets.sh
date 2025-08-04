#!/bin/bash

# Create vendor directory
mkdir -p assets/vendor

# Download VexFlow
echo "Downloading VexFlow..."
curl -o assets/vendor/vexflow.js https://cdnjs.cloudflare.com/ajax/libs/vexflow/4.2.0/vexflow.js

# Download Fork-Awesome
echo "Downloading Fork-Awesome..."
mkdir -p assets/vendor/fork-awesome/css
curl -o assets/vendor/fork-awesome/css/fork-awesome.min.css https://cdn.jsdelivr.net/npm/fork-awesome@1.2.0/css/fork-awesome.min.css

# Download QUnit
echo "Downloading QUnit..."
mkdir -p assets/vendor/qunit
curl -o assets/vendor/qunit/qunit-2.19.1.css https://code.jquery.com/qunit/qunit-2.19.1.css
curl -o assets/vendor/qunit/qunit-2.19.1.js https://code.jquery.com/qunit/qunit-2.19.1.js
