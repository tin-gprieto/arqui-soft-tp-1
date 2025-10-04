#!/bin/sh

echo "Ejecutando test de rendimiento: $1.yaml con environment: $2"

npm run artillery -- run $1.yaml -e $2
