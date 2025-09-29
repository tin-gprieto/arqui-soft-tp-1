#!/bin/sh

echo "Ejecutando test de rendimiento: $1.yaml con environment: $2"

npm run artillery -- run $1.yaml -e $2 -o results-$1.json --output-format json

echo "Resultados en JSON: results-$1.json"
echo "Puedes visualizar los resultados en:"
echo "- Artillery Cloud: https://app.artillery.io"
echo "- O usar jq para analizar: jq . results-$1.json"
