package testutil

import (
	"os"
	"path/filepath"
	"runtime"

	"github.com/joho/godotenv"
)

// LoadPackageEnv loads the nearest .env by walking up from the calling test
// file, so nested packages do not need to hardcode relative depth.
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