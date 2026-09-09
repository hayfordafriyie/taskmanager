// Package tests contains the backend's unit and integration test suite.
//
// All tests live in a single black-box package so they are easy to find,
// and exercise the public API end to end (GraphQL over HTTP for the server
// layer, exported package functions elsewhere).
package tests