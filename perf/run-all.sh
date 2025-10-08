#!/usr/bin/env bash 

# Escenarios

SCENARIOS =(
  "load"
  "spike"
  "stress"
  "endurance"
  "breakpoint"
)

# Ejecutar todos los escenarios de rendimiento
for scenario in "${SCENARIOS[@]}"; do
  ./run-scenario.sh --${scenario} --env api"
done