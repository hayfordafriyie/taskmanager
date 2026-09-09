package tests

import (
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	LoadPackageEnv()
	os.Exit(m.Run())
}