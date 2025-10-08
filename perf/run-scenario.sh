#!/usr/bin/env bash

# run-scenario.sh
# echo "Ejecutando test de rendimiento: $1.yaml con environment: $2"
# npm run artillery -- run $1.yaml -e $2

# run-scenario-persist.sh
# echo "Ejecutando test de rendimiento: $1.yaml con environment: $2"
# npm run artillery -- run $1.yaml -e $2 -o results-$1.json --output-format json
# echo "Resultados en JSON: results-$1.json"
# echo "Puedes visualizar los resultados en:"
# echo "- Artillery Cloud: https://app.artillery.io"
# echo "- O usar jq para analizar: jq . results-$1.json"

# run-scenario-html.sh
# echo "Ejecutando test de rendimiento: $1.yaml con environment: $2"
# npm run artillery -- run $1.yaml -e $2 -o results-$1.json
# echo "Generando reporte HTML..."
# node generate-html-report.js results-$1.json
# echo "Resultados en JSON: results-$1.json"
# echo "Reporte HTML: results-$1.html"

set -euo pipefail

# ============================================
# Unified Artillery Scenario Runner
# ============================================

# Directorio base de tests
TEST_DIR="tests"

# Valores por defecto
ENVIRONMENT="api"
SCENARIO_FILE=""

# ---- Mostrar ayuda ----
show_help() {
  cat <<EOF
Uso: $0 [FLAG] [--env <nombre_entorno>]

Flags (elige una):
  --load           Ejecuta $TEST_DIR/load-test.yaml
  --spike          Ejecuta $TEST_DIR/spike-test.yaml
  --stress         Ejecuta $TEST_DIR/stress-test.yaml
  --endurance      Ejecuta $TEST_DIR/endurance-test.yaml
  --breakpoint     Ejecuta $TEST_DIR/breakpoint-test.yaml
  --file <path>    Ejecuta el archivo YAML especificado

Opciones adicionales:
  --env <nombre>   Define el environment de Artillery (por defecto: dev)
  -h, --help       Muestra esta ayuda

Ejemplos:
  $0 --load
  $0 --spike --env api
  $0 --file custom/test.yaml --env api
EOF
  exit 0
}

# ---- Parseo de argumentos ----
while [[ $# -gt 0 ]]; do
  case "$1" in
    --load)       SCENARIO_FILE="$TEST_DIR/load-test.yaml"; shift ;;
    --spike)      SCENARIO_FILE="$TEST_DIR/spike-test.yaml"; shift ;;
    --stress)     SCENARIO_FILE="$TEST_DIR/stress-test.yaml"; shift ;;
    --endurance)  SCENARIO_FILE="$TEST_DIR/endurance-test.yaml"; shift ;;
    --breakpoint) SCENARIO_FILE="$TEST_DIR/breakpoint-test.yaml"; shift ;;
    --file)
      shift
      if [[ $# -eq 0 ]]; then echo "Error: --file requiere un argumento"; exit 1; fi
      SCENARIO_FILE="$1"; shift ;;
    --env)
      shift
      if [[ $# -eq 0 ]]; then echo "Error: --env requiere un nombre"; exit 1; fi
      ENVIRONMENT="$1"; shift ;;
    -h|--help) show_help ;;
    *) echo "Error: flag desconocida '$1'"; show_help ;;
  esac
done

# ---- Validaciones ----
if [[ -z "$SCENARIO_FILE" ]]; then
  echo "Error: no se seleccionó ningún escenario."
  show_help
fi

if [[ ! -f "$SCENARIO_FILE" ]]; then
  echo "Error: archivo de escenario no encontrado: $SCENARIO_FILE"
  exit 1
fi

# ---- Generar nombres de salida ----
BASENAME="$(basename "$SCENARIO_FILE" .yaml)"
JSON_OUT="results-${BASENAME}.json"
HTML_OUT="results-${BASENAME}.html"

# ---- Ejecutar el test ----
echo "========================================"
echo " Ejecutando: artillery run -e ${ENVIRONMENT} ${SCENARIO_FILE}"
echo "----------------------------------------"
 npm run artillery -- run -e "$ENVIRONMENT" "$SCENARIO_FILE" -o "$JSON_OUT"

# ---- Generar reporte HTML ----
echo "Generando reporte HTML: ${HTML_OUT}"
 npm run artillery -- report --output "$HTML_OUT" "$JSON_OUT"

echo "----------------------------------------"
echo "✅ Test finalizado"
echo "📄 JSON:  $JSON_OUT"
echo "📄 HTML:  $HTML_OUT"
echo "========================================"
