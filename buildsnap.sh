#!/bin/bash
VERSION=`jq '.version' package.json`
echo snapversion = $VERSION
sed -z -i -e "s/^version: .*/version: ${VERSION}/" snap/snapcraft.yaml
npm install
snapcraft 