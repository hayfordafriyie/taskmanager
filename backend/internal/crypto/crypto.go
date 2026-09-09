// Package crypto provides symmetric AES-256-GCM encryption shared between the
// backend and the frontend. Both sides hold the same base64 key from .env;
// payloads are serialized as base64(nonce || ciphertext).
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

const nonceSize = 12

// Cipher encrypts and decrypts payloads with a single shared key.
type Cipher struct {
	aead cipher.AEAD
}

// New creates a Cipher from a raw 32-byte AES-256 key.
func New(key []byte) (*Cipher, error) {
	if len(key) != 32 {
		return nil, errors.New("encryption key must be 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create aes cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create gcm: %w", err)
	}
	return &Cipher{aead: aead}, nil
}

// NewFromBase64 creates a Cipher from a base64-encoded 32-byte key.
func NewFromBase64(encoded string) (*Cipher, error) {
	key, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode key: %w", err)
	}
	return New(key)
}

// Encrypt returns base64(nonce || ciphertext) for the plaintext.
func (c *Cipher) Encrypt(plaintext []byte) (string, error) {
	nonce := make([]byte, nonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	sealed := c.aead.Seal(nil, nonce, plaintext, nil)
	out := make([]byte, 0, nonceSize+len(sealed))
	out = append(out, nonce...)
	out = append(out, sealed...)
	return base64.StdEncoding.EncodeToString(out), nil
}

// Decrypt reverses Encrypt.
func (c *Cipher) Decrypt(encoded string) ([]byte, error) {
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode payload: %w", err)
	}
	if len(raw) < nonceSize {
		return nil, errors.New("payload too short")
	}
	nonce, ct := raw[:nonceSize], raw[nonceSize:]
	plain, err := c.aead.Open(nil, nonce, ct, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt payload: %w", err)
	}
	return plain, nil
}