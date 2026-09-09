package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	_ "github.com/joho/godotenv/autoload"

	"taskmanager/graph"
	"taskmanager/internal/crypto"
	"taskmanager/internal/db"
	"taskmanager/internal/notif"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/vektah/gqlparser/v2/ast"
)

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

	smsWorker := notif.NewWorker(notif.SenderFunc(notif.SendSMSPayload), 2, 100, nil)
	defer smsWorker.Close()

	srv := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: graph.NewResolver(pool, smsWorker)}))

	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})

	srv.SetQueryCache(lru.New[*ast.QueryDocument](1000))

	srv.Use(extension.Introspection{})
	srv.Use(extension.AutomaticPersistedQuery{
		Cache: lru.New[string](100),
	})

	cipher, err := crypto.NewFromBase64(os.Getenv("ENCRYPTION_KEY"))
	if err != nil {
		log.Fatalf("invalid ENCRYPTION_KEY: %v", err)
	}

	mux := http.NewServeMux()

	const apiV1 = "/api/v1"

	mux.Handle(apiV1+"/", playground.Handler("GraphQL playground", apiV1+"/query"))
	mux.Handle(apiV1+"/query", crypto.Middleware(srv, cipher))
	mux.HandleFunc("GET "+apiV1+"/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	// Unversioned liveness probe for load balancers / infrastructure checks.
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	log.Printf("GraphQL API v1 available at %s/query", apiV1)

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		log.Fatal("SERVER_PORT is not set in .env")
	}

	addr := fmt.Sprintf(":%s", port)
	log.Printf("GraphQL server listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}