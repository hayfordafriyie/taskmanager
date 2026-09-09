package graph

import (
	"context"
	"errors"
	"net"
	"net/http"
	"strings"

	"taskmanager/graph/model"
	"taskmanager/internal/auth"
	"taskmanager/types"
)

var errNotAuthenticated = errors.New("not authenticated")

var errTooManyRequests = errors.New("too many attempts, please try again later")

const (
	otpPurposeRegister      = "register"
	otpPurposePasswordReset = "password_reset"
	loginAccessAlert        = "Your Task Manager account was accessed via a new login. If this was not you, reset your password immediately."
)

func int32Ptr(v int32) *int32 {
	return &v
}

func toModelUser(u *types.UserRow) *model.User {
	if u == nil {
		return nil
	}
	return &model.User{
		ID:         u.ID,
		Phone:      u.Phone,
		FirstName:  u.FirstName,
		Surname:    u.Surname,
		OtherNames: u.OtherNames,
		CreatedAt:  u.CreatedAt,
	}
}

func otpFailureMessage(reason string) string {
	switch reason {
	case "no_active_otp":
		return "no active verification code; please request a new one"
	case "expired":
		return "verification code has expired; please request a new one"
	case "too_many_attempts":
		return "too many attempts; please request a new code"
	default:
		return "invalid verification code"
	}
}

func (r *Resolver) guardAuth(ctx context.Context, phone string) error {
	request := auth.Request(ctx)
	if request != nil {
		if ip := clientIP(request); ip != "" && !r.bruteIP.Allow("ip:"+ip) {
			return errTooManyRequests
		}
	}
	if phone != "" && !r.brutePhone.Allow("phone:"+phone) {
		return errTooManyRequests
	}
	return nil
}

func (r *Resolver) clearAuth(phone string) {
	r.brutePhone.Reset("phone:" + phone)
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		first, _, _ := strings.Cut(fwd, ",")
		if ip := strings.TrimSpace(first); ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
