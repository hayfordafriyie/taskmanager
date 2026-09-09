package notif

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"taskmanager/types"
)

const (
	smsMaxRetries = 3
	smsRetryDelay = 500 * time.Millisecond
)

func newSMSConfig() (*types.SMSConfig, error) {
	apiKey := os.Getenv("SMS_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("SMS_KEY")
	}
	baseURL := os.Getenv("SMS_BASE_URL")
	senderID := os.Getenv("DEFAULT_SMS_SENDER_ID")
	if senderID == "" {
		senderID = os.Getenv("SENDER_ID")
	}

	if apiKey == "" {
		return nil, errors.New("SMS_API_KEY is not set in .env")
	}
	if baseURL == "" {
		return nil, errors.New("SMS_BASE_URL is not set in .env")
	}
	if senderID == "" {
		return nil, errors.New("DEFAULT_SMS_SENDER_ID is not set in .env")
	}

	return &types.SMSConfig{
		APIKey:          apiKey,
		BaseURL:         baseURL,
		DefaultSenderID: senderID,
	}, nil
}

func SendSMSPayload(payload types.SMSPayload, senderID string) (float64, error) {
	cfg, err := newSMSConfig()
	if err != nil {
		return 0, err
	}

	if len(payload.PhoneNumbers) == 0 {
		return 0, errors.New("at least one phone number is required")
	}

	finalSender := senderID
	if finalSender == "" {
		finalSender = cfg.DefaultSenderID
	}

	formatted := make([]string, 0, len(payload.PhoneNumbers))
	for _, phone := range payload.PhoneNumbers {
		if phone == "" {
			continue
		}
		formatted = append(formatted, formatPhoneNumber(phone))
	}
	if len(formatted) == 0 {
		return 0, errors.New("no valid phone numbers provided")
	}

	requestBody := map[string]any{
		"recipient":     formatted,
		"sender":        finalSender,
		"message":       payload.Message,
		"is_schedule":   false,
		"schedule_date": "",
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return 0, err
	}

	timeout := calculateSMSClientTimeout(len(formatted))
	client := &http.Client{Timeout: timeout}

	fullURL := fmt.Sprintf("%s?key=%s", strings.TrimRight(cfg.BaseURL, "/"), urlEncode(cfg.APIKey))

	var lastErr error
	for attempt := 1; attempt <= smsMaxRetries; attempt++ {
		req, err := http.NewRequest(http.MethodPost, fullURL, bytes.NewReader(jsonBody))
		if err != nil {
			return 0, err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			if attempt < smsMaxRetries {
				time.Sleep(smsRetryDelay * time.Duration(attempt))
				continue
			}
			return 0, err
		}

		body, readErr := readResponseBody(resp)
		resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			if attempt < smsMaxRetries {
				time.Sleep(smsRetryDelay * time.Duration(attempt))
				continue
			}
			return 0, readErr
		}

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("sms service returned status %d: %s", resp.StatusCode, body)
			if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
				if attempt < smsMaxRetries {
					time.Sleep(smsRetryDelay * time.Duration(attempt))
					continue
				}
			}
			return 0, lastErr
		}

		var mResp types.MnotifyResponse
		if err := json.Unmarshal(body, &mResp); err != nil {
			bodyStr := string(body)
			if len(bodyStr) > 100 {
				bodyStr = bodyStr[:100]
			}
			lastErr = fmt.Errorf("failed to parse sms response: invalid JSON (got: %s)", bodyStr)
			if attempt < smsMaxRetries {
				time.Sleep(smsRetryDelay * time.Duration(attempt))
				continue
			}
			return 0, lastErr
		}

		if strings.EqualFold(mResp.Status, "error") || strings.EqualFold(mResp.Code, "error") {
			lastErr = fmt.Errorf("sms api error: %s", mResp.Message)
			if attempt < smsMaxRetries {
				time.Sleep(smsRetryDelay * time.Duration(attempt))
				continue
			}
			return 0, lastErr
		}

		return mResp.Summary.CreditUsed, nil
	}

	return 0, lastErr
}

func formatPhoneNumber(phone string) string {
	p := strings.TrimSpace(phone)
	if strings.HasPrefix(p, "+") {
		return p
	}
	if strings.HasPrefix(p, "00") {
		return "+" + strings.TrimPrefix(p, "00")
	}
	if strings.HasPrefix(p, "233") {
		return "+" + p
	}
	if strings.HasPrefix(p, "0") {
		return "+233" + strings.TrimPrefix(p, "0")
	}
	return p
}

func calculateSMSClientTimeout(count int) time.Duration {
	t := 10 * time.Second
	if count > 1 {
		t = time.Duration(count) * 5 * time.Second
	}
	return t
}

func urlEncode(s string) string {
	return url.QueryEscape(s)
}

func readResponseBody(resp *http.Response) ([]byte, error) {
	defer io.Copy(io.Discard, resp.Body)
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return nil, err
	}
	return body, nil
}
