#!/bin/bash

# Prints all command to stdout (for debug purpose)
set -xe

service ssh start

/usr/bin/npm start
