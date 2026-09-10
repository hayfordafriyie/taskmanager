package server

import (
	"net/http"
	"net/url"
	"os"
	"strings"
)

// CORS applies a conservative cross-origin policy:
//
//   - CORS_ORIGINS (comma-separated) is an exact allow-list when set — this is
//     what production should use, e.g. "https://app.example.com";
//   - when it is unset, only loopback origins (localhost / 127.0.0.1 / ::1) are
//     reflected so local development keeps working, while any other origin gets
//     no CORS headers at all.
//
// Requests with a disallowed Origin are never granted credentials; a preflight
// from them is rejected outright.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		h := w.Header()

		h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Encrypted, X-Requested-With")
		h.Set("Access-Control-Expose-Headers", "X-Encrypted, X-Request-Id, Set-Cookie")
		h.Set("Access-Control-Max-Age", "86400")

		if origin != "" {
			// Responses vary by Origin, so proxies must not reuse them blindly.
			h.Add("Vary", "Origin")

			if allowedOrigin(origin) {
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")
			} else if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusForbidden)
				return
			}
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// allowedOrigin reports whether the origin may use the API.
func allowedOrigin(origin string) bool {
	if list := configuredOrigins(); len(list) > 0 {
		for _, a := range list {
			if strings.EqualFold(a, origin) {
				return true
			}
		}
		return false
	}
	// No allow-list configured: permit local development only.
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	switch u.Hostname() {
	case "localhost", "127.0.0.1", "::1":
		return true
	}
	return false
}

// configuredOrigins parses CORS_ORIGINS into a normalised allow-list. A trailing
// slash is tolerated because documentation examples often include one.
func configuredOrigins() []string {
	raw := strings.TrimSpace(os.Getenv("CORS_ORIGINS"))
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		v := strings.TrimSpace(p)
		if v == "" {
			continue
		}
		out = append(out, strings.TrimRight(v, "/"))
	}
	return out
}
