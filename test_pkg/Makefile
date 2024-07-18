# GNU Makefile for RadQy
CURDIR := $(shell pwd)
PY := $(VIRTUAL_ENV)/bin/python


install-local:
		$(PY) -m pip install --force-reinstall --upgrade $(CURDIR)/../dist/*.whl

run-h:
		radqy -h