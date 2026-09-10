package graph

import (
	"testing"
	"time"
)

func day(s string) *time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return &t
}

func TestValidateTaskDates(t *testing.T) {
	cases := []struct {
		name       string
		start, end *time.Time
		wantErr    bool
	}{
		{"both nil", nil, nil, false},
		{"only start", day("2026-09-01"), nil, false},
		{"only end", nil, day("2026-09-10"), false},
		{"ordered", day("2026-09-01"), day("2026-09-10"), false},
		{"same day", day("2026-09-01"), day("2026-09-01"), false},
		{"reversed", day("2026-09-10"), day("2026-09-01"), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateTaskDates(tc.start, tc.end)
			if tc.wantErr && err == nil {
				t.Fatal("expected an error for a reversed planned window")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}
