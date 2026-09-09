package graph

import (
	"errors"

	"taskmanager/graph/model"
	"taskmanager/types"
)

var errNotAuthenticated = errors.New("not authenticated")

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
