#!/bin/sh

echo "Ejecutando test de rendimiento: $1.yaml con environment: $2"

npm run artillery -- run $1.yaml -e $2 -o results-$1.json

echo "Generando reporte HTML..."
node generate-html-report.js results-$1.json

echo "Resultados en JSON: results-$1.json"
echo "Reporte HTML: results-$1.html"
