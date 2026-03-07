package logger

import (
	"log/slog"
	"os"
)

type Logger struct {
	*slog.Logger
}

func NewLogger() *Logger {
	opts := &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}
	// Use JSON format for structured logging best practices
	handler := slog.NewJSONHandler(os.Stdout, opts)
	slogLogger := slog.New(handler)
	slog.SetDefault(slogLogger)

	return &Logger{
		Logger: slogLogger,
	}
}
