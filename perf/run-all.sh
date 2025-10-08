#!/usr/bin/env bash 

# Escenarios

SCENARIOS=(
  "load"
  "spike"
  "stress"
  "breakpoint"
  "endurance"
)

# Ejecutar todos los escenarios de rendimiento
for scenario in "${SCENARIOS[@]}"; do
  ./run-scenario.sh --${scenario} --env api
  sleep 15
done