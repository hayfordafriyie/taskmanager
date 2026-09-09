package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	AccessTokenTTL  = 15 * time.Minute
	RefreshTokenTTL = 30 * 24 * time.Hour
	Header          = "Authorization"
	Scheme          = "Bearer"
	accessType      = "access"
	refreshType     = "refresh"
	issuer          = "taskmanager"
)

var (
	ErrTokenInvalid = errors.New("invalid token")
	ErrTokenType    = errors.New("unexpected token type")
)

func JWTSecret() string {
	return os.Getenv("JWT_SECRET")
}

func JWTRefreshSecret() string {
	return os.Getenv("JWT_REFRESH_SECRET")
}

type Claims struct {
	Type  string `json:"typ"`
	Nonce string `json:"sid"`
	jwt.RegisteredClaims
}

func (c Claims) UserID() (uuid.UUID, error) {
	return uuid.Parse(c.Subject)
}

func (c Claims) SessionID() (uuid.UUID, error) {
	return uuid.Parse(c.ID)
}

func newClaims(userID, sessionID uuid.UUID, typ string, ttl time.Duration) Claims {
	now := time.Now()
	return Claims{
		Type:  typ,
		Nonce: randomNonce(),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   userID.String(),
			ID:        sessionID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
}

func randomNonce() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return uniqueFallback()
	}
	return hex.EncodeToString(b)
}

var fallbackCounter uint64

func uniqueFallback() string {
	return "f" + strconv.FormatUint(atomic.AddUint64(&fallbackCounter, 1), 16)
}

func IssueAccessToken(secret string, userID, sessionID uuid.UUID, ttl time.Duration) (string, error) {
	return issue(secret, newClaims(userID, sessionID, accessType, ttl))
}

func IssueRefreshToken(secret string, userID, sessionID uuid.UUID, ttl time.Duration) (string, error) {
	return issue(secret, newClaims(userID, sessionID, refreshType, ttl))
}

func issue(secret string, claims Claims) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(secret, raw string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrTokenInvalid
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, ErrTokenInvalid
	}
	if claims.Issuer != issuer {
		return nil, ErrTokenInvalid
	}
	claims.Type = strings.ToLower(claims.Type)
	return claims, nil
}

func IsAccess(claims *Claims) bool {
	return claims != nil && claims.Type == accessType
}

func IsRefresh(claims *Claims) bool {
	return claims != nil && claims.Type == refreshType
}

func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func BearerToken(r *http.Request) string {
	parts := strings.Fields(r.Header.Get(Header))
	if len(parts) == 2 && strings.EqualFold(parts[0], Scheme) {
		return parts[1]
	}
	return ""
}

type requestKey struct{}

func WithRequest(ctx context.Context, r *http.Request) context.Context {
	return context.WithValue(ctx, requestKey{}, r)
}

func Request(ctx context.Context) *http.Request {
	r, _ := ctx.Value(requestKey{}).(*http.Request)
	return r
}

func ContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r.WithContext(WithRequest(r.Context(), r)))
	})
}
