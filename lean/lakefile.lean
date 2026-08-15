import Lake

open Lake DSL

package imba where
  version := v!"0.1.0"

@[default_target]
lean_lib Imba where

@[default_target]
lean_exe «imba-core» where
  root := `Main
