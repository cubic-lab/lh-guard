APP_NAME := $(shell node -e "console.log(require('./package.json').name)")
VERSION := $(shell node -e "console.log(require('./package.json').version)")
DOCKER_REGISTRY := matcloud
DOCKER_IMAGE := ${DOCKER_REGISTRY}/${APP_NAME}:${VERSION}
DOCKER_IMAGE_LATEST := ${DOCKER_REGISTRY}/${APP_NAME}:latest

PLATFORMS ?= linux/amd64,linux/arm64

.PHONY: help
help:
	@echo "commands:"
	@echo "  make setup-buildx - set buildx"
	@echo "  make build        - build multi-arch docker image"
	@echo "  make push         - build and push multi-arch image"
	@echo "  make run-amd64    - build AMD64 image"
	@echo "  make run-arm64    - build ARM64 image"
	@echo "  make clean        - clean local image"

.PHONY: setup-buildx
setup-buildx:
	@echo "set buildx"
	docker buildx create --name multiarch --use || true
	docker buildx inspect --bootstrap

.PHONY: build
build:
	@echo "Build multi-arch images: ${DOCKER_IMAGE}"
	docker buildx build \
		--platform ${PLATFORMS} \
		-t ${DOCKER_IMAGE} \
		-t ${DOCKER_IMAGE_LATEST} \
		.

.PHONY: push
push:
	@echo "Build and push multi-arch images: ${DOCKER_IMAGE}"
	docker buildx build \
		--platform ${PLATFORMS} \
		-t ${DOCKER_IMAGE} \
		-t ${DOCKER_IMAGE_LATEST} \
		--push \
		.

.PHONY: clean
clean:
	@echo "clean local image"
	docker rmi ${DOCKER_IMAGE} ${DOCKER_IMAGE_LATEST} || true