package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	_ "github.com/joho/godotenv/autoload"

	"taskmanager/graph"
	"taskmanager/internal/auth"
	"taskmanager/internal/crypto"
	"taskmanager/internal/db"
	"taskmanager/internal/notif"
	"taskmanager/internal/server"

	"github.com/99designs/gqlgen/graphql"
	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vektah/gqlparser/v2/ast"
)

// bearerOf extracts the caller's bearer token for cache-key isolation.
func bearerOf(ctx context.Context) string {
	if req := auth.Request(ctx); req != nil {
		return auth.BearerToken(req)
	}
	return ""
}

func main() {
	ctx := context.Background()

	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("database migration failed: %v", err)
	}
	log.Println("database migrated")

	go runDueReminderLoop(pool)

	smsWorker := notif.NewWorker(notif.SenderFunc(notif.SendSMSPayload), 2, 100, nil)
	defer smsWorker.Close()

	resolvers := graph.NewResolver(pool, smsWorker)

	srv := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: resolvers}))

	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})

	srv.SetQueryCache(lru.New[*ast.QueryDocument](1000))

	// Redis-backed response cache: queries are cached per (query, variables,
	// caller), and every mutation bumps the cache epoch so no stale read can
	// survive a write. If Redis is unreachable this degrades to a no-op.
	srv.AroundOperations(func(ctx context.Context, next graphql.OperationHandler) graphql.ResponseHandler {
		oc := graphql.GetOperationContext(ctx)
		if oc == nil || oc.Operation == nil {
			return next(ctx)
		}

		if oc.Operation.Operation == ast.Mutation {
			run := next(ctx)
			return func(ctx context.Context) *graphql.Response {
				resp := run(ctx)
				resolvers.InvalidateCache(context.Background())
				return resp
			}
		}

		key := resolvers.CacheKey(oc.RawQuery, graph.VariablesKey(oc.Variables), bearerOf(ctx))
		if raw, ok := resolvers.CacheGetRaw(ctx, key); ok && len(raw) > 0 {
			log.Printf("cache: hit %s", oc.Operation.Name)
			return func(context.Context) *graphql.Response {
				return &graphql.Response{Data: json.RawMessage(raw)}
			}
		}

		run := next(ctx)
		return func(ctx context.Context) *graphql.Response {
			resp := run(ctx)
			if resp != nil && len(resp.Errors) == 0 && len(resp.Data) > 0 {
				resolvers.CacheSetRaw(context.Background(), key, []byte(resp.Data))
			}
			return resp
		}
	})

	srv.Use(extension.Introspection{})
	srv.Use(extension.AutomaticPersistedQuery{
		Cache: lru.New[string](100),
	})

	sessions := crypto.NewSessionStore(30 * time.Minute)

	mux := http.NewServeMux()

	const apiV1 = "/api/v1"

	mux.Handle(apiV1+"/", playground.Handler("GraphQL playground", apiV1+"/query"))
	mux.HandleFunc(apiV1+"/session", crypto.SessionHandler(sessions))
	mux.Handle(apiV1+"/query", auth.ContextMiddleware(sessions.Middleware(srv)))
	mux.HandleFunc("GET "+apiV1+"/events", server.Events(resolvers.Realtime))
	mux.HandleFunc("GET "+apiV1+"/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		log.Fatal("SERVER_PORT is not set in .env")
	}

	if auth.JWTSecret() == "" || auth.JWTRefreshSecret() == "" {
		log.Fatal("JWT_SECRET and JWT_REFRESH_SECRET must be set in .env")
	}

	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           server.CORS(server.RateLimit(server.SecurityHeaders(mux))),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	if cert := os.Getenv("TLS_CERT"); cert != "" && os.Getenv("TLS_KEY") != "" {
		log.Printf("TLS enabled, GraphQL API v1 available at https://localhost:%s/api/v1/query", port)
		log.Fatal(httpServer.ListenAndServeTLS(cert, os.Getenv("TLS_KEY")))
	}
	log.Fatal(httpServer.ListenAndServe())
}

// runDueReminderLoop periodically creates "due soon" in-app notifications for
// assigned tasks that are not done or in review. Interval and window come from
// environment variables and default to hourly reminders within the next day.
func runDueReminderLoop(pool *pgxpool.Pool) {
	windowHours := dueReminderFloatEnv("DUE_REMINDER_WINDOW_HOURS", 24)
	interval := dueReminderDurationEnv("DUE_REMINDER_INTERVAL", time.Hour)

	runOnce := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		count, err := db.CreateDueReminders(ctx, pool, windowHours)
		if err != nil {
			log.Printf("due reminders: %v", err)
			return
		}
		if count > 0 {
			log.Printf("due reminders: created %d", count)
		}
	}

	runOnce()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		runOnce()
	}
}

func dueReminderFloatEnv(key string, fallback float64) float64 {
	v, err := strconv.ParseFloat(os.Getenv(key), 64)
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}

func dueReminderDurationEnv(key string, fallback time.Duration) time.Duration {
	v, err := strconv.Atoi(os.Getenv(key))
	if err != nil || v <= 0 {
		return fallback
	}
	return time.Duration(v) * time.Minute
}
