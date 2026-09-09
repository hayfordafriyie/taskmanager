package tests

import (
	"os"
	"path/filepath"
	"runtime"

	"github.com/joho/godotenv"
)

func LoadPackageEnv() {
	_, file, _, ok := runtime.Caller(1)
	if !ok {
		return
	}
	dir := filepath.Dir(file)
	for {
		env := filepath.Join(dir, ".env")
		if _, err := os.Stat(env); err == nil {
			_ = godotenv.Load(env)
			return
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return
		}
		dir = parent
	}
}
